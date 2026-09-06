import { useEffect, useMemo, useState, type Dispatch, type DragEvent, type SetStateAction } from "react";
import {
  addStatblockCombatant,
  addStubCombatant,
  advanceCombatTurn,
  d20WithModifier,
  endCombat,
  removeCombatant,
  rollCombatantInitiative,
  setCombatantInitiative,
  setStatblockCombatantLimitedUse,
  startCombat,
  updateCombatantHp,
  updateStubCombatant,
  type CombatHpState,
  type DiceExpression,
  type DiceRollResult,
  type EncounterRepository,
  type EncounterState,
  type ProductAbilityKey,
  type SavedStatblock,
} from "statblock-parser-core/product";
import { abilityOrder } from "../statblockUi";
import { combatantDisplayName, type OpenedEntity } from "../openedEntity";
import { createEncounterAutosaveCoordinator } from "../persistenceOrchestration";

const emptyStubSaves = (): Record<ProductAbilityKey, string> => ({
  str: "",
  dex: "",
  con: "",
  int: "",
  wis: "",
  cha: "",
});

type UseEncounterControllerOptions = {
  repository: EncounterRepository;
  autosaveDelayMs: number;
  libraryById: ReadonlyMap<string, SavedStatblock>;
  opened: OpenedEntity;
  setOpened: Dispatch<SetStateAction<OpenedEntity>>;
  reportError: (error: unknown) => void;
  performRoll: (expression: DiceExpression, label: string) => DiceRollResult;
};

export function useEncounterController({
  repository,
  autosaveDelayMs,
  libraryById,
  opened,
  setOpened,
  reportError,
  performRoll,
}: UseEncounterControllerOptions) {
  const [encounter, setEncounter] = useState<EncounterState | null>(null);
  const [dragOverEncounter, setDragOverEncounter] = useState(false);
  const [showStubForm, setShowStubForm] = useState(false);
  const [stubName, setStubName] = useState("");
  const [stubHp, setStubHp] = useState("");
  const [stubAc, setStubAc] = useState("");
  const [stubInitiative, setStubInitiative] = useState("");
  const [stubSaves, setStubSaves] = useState<Record<ProductAbilityKey, string>>(emptyStubSaves);
  const autosave = useMemo(
    () => createEncounterAutosaveCoordinator(repository, autosaveDelayMs, reportError),
    [autosaveDelayMs, reportError, repository],
  );

  useEffect(() => () => autosave.dispose(), [autosave]);

  async function persistEncounter(next: EncounterState) {
    await autosave.persistImmediately(next);
    setEncounter(next);
  }

  function autosaveEncounter(next: EncounterState) {
    setEncounter(next);
    autosave.schedule(next);
  }

  async function addToEncounter(statblockId: string) {
    const statblock = libraryById.get(statblockId);
    if (statblock === undefined) return;
    const current = encounter ?? (await repository.get());
    let next = addStatblockCombatant(current, statblockId, {
      document: statblock.versions.en.working,
      cardConfig: statblock.cardConfig,
      hitPointMaximum: statblock.versions.en.working.facts.hitPointMaximum,
      initiativeModifier: statblock.versions.en.working.facts.initiative?.modifier ?? 0,
    });
    const added = next.combatants[next.combatants.length - 1];
    if (current.active && added !== undefined) next = rollCombatantInitiative(next, added.id);
    await persistEncounter(next);
    if (added !== undefined) setOpened({ kind: "combatant", combatantId: added.id });
  }

  async function createStub() {
    const current = encounter ?? (await repository.get());
    const parseOptional = (value: string): number | null =>
      value.trim() === "" ? null : Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : null;
    const savingThrows = Object.fromEntries(
      abilityOrder.map((ability) => [ability, parseOptional(stubSaves[ability])]),
    ) as Record<ProductAbilityKey, number | null>;
    let next = addStubCombatant(current, {
      displayName: stubName,
      hitPointMaximum: parseOptional(stubHp),
      armorClass: parseOptional(stubAc),
      initiativeModifier: parseOptional(stubInitiative),
      savingThrows,
    });
    const added = next.combatants[next.combatants.length - 1];
    if (current.active && added !== undefined) next = rollCombatantInitiative(next, added.id);
    await persistEncounter(next);
    if (added !== undefined) setOpened({ kind: "combatant", combatantId: added.id });
    setStubName("");
    setStubHp("");
    setStubAc("");
    setStubInitiative("");
    setStubSaves(emptyStubSaves());
    setShowStubForm(false);
  }

  async function changeCombatantHp(combatantId: string, hp: CombatHpState) {
    if (encounter === null) return;
    const next = updateCombatantHp(encounter, combatantId, hp);
    if (next !== encounter) await persistEncounter(next);
  }

  function changeLimitedUse(combatantId: string, key: string, maximum: number, value: number) {
    if (encounter === null) return;
    const next = setStatblockCombatantLimitedUse(encounter, combatantId, key, maximum, value);
    if (next !== encounter) autosaveEncounter(next);
  }

  async function rollInitiative(combatantId: string) {
    if (encounter === null) return;
    const combatant = encounter.combatants.find((entry) => entry.id === combatantId);
    if (combatant === undefined) return;
    const name = combatantDisplayName(combatant, encounter);
    const result = performRoll(d20WithModifier(combatant.initiativeModifier), `${name} · ініціатива`);
    await persistEncounter(setCombatantInitiative(encounter, combatantId, result.total));
  }

  async function changeInitiative(combatantId: string, value: number | null) {
    if (encounter !== null) await persistEncounter(setCombatantInitiative(encounter, combatantId, value));
  }

  async function changeStubCombatant(combatantId: string, patch: Parameters<typeof updateStubCombatant>[2]) {
    if (encounter === null) return;
    const next = updateStubCombatant(encounter, combatantId, patch);
    if (next !== encounter) autosaveEncounter(next);
  }

  async function beginCombat() {
    if (encounter === null || encounter.combatants.length === 0) return;
    const next = startCombat(encounter);
    await persistEncounter(next);
    if (next.currentCombatantId !== null) setOpened({ kind: "combatant", combatantId: next.currentCombatantId });
  }

  async function nextCombatant() {
    if (encounter === null) return;
    const next = advanceCombatTurn(encounter);
    if (next === encounter) return;
    await persistEncounter(next);
    if (next.currentCombatantId !== null) setOpened({ kind: "combatant", combatantId: next.currentCombatantId });
  }

  async function finishCombat() {
    if (encounter !== null) await persistEncounter(endCombat(encounter));
  }

  async function removeFromEncounter(combatantId: string) {
    if (encounter === null) return;
    const next = removeCombatant(encounter, combatantId);
    if (next === encounter) return;
    await persistEncounter(next);
    if (opened?.kind !== "combatant" || opened.combatantId !== combatantId) return;
    const fallback = next.combatants[0];
    if (fallback !== undefined) {
      setOpened({ kind: "combatant", combatantId: fallback.id });
      return;
    }
    const firstLibraryId = libraryById.keys().next().value as string | undefined;
    setOpened(firstLibraryId === undefined ? null : { kind: "library", statblockId: firstLibraryId });
  }

  function allowEncounterDrop(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragOverEncounter(true);
  }

  function leaveEncounterDrop(event: DragEvent) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragOverEncounter(false);
  }

  function dropOnEncounter(event: DragEvent) {
    event.preventDefault();
    setDragOverEncounter(false);
    const statblockId =
      event.dataTransfer.getData("application/x-statblock-id") || event.dataTransfer.getData("text/plain");
    if (statblockId !== "") void addToEncounter(statblockId);
  }

  return {
    encounter,
    setEncounter,
    persistEncounter,
    autosaveEncounter,
    addToEncounter,
    createStub,
    changeCombatantHp,
    changeLimitedUse,
    rollInitiative,
    changeInitiative,
    changeStubCombatant,
    beginCombat,
    nextCombatant,
    finishCombat,
    removeFromEncounter,
    dragOverEncounter,
    allowEncounterDrop,
    leaveEncounterDrop,
    dropOnEncounter,
    showStubForm,
    setShowStubForm,
    stubName,
    setStubName,
    stubHp,
    setStubHp,
    stubAc,
    setStubAc,
    stubInitiative,
    setStubInitiative,
    stubSaves,
    setStubSaves,
  };
}
