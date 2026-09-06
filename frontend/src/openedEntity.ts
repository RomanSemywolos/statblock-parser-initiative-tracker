import type {
  Combatant,
  EditableStatblockDocument,
  EncounterState,
  SavedStatblock,
  StatblockCombatant,
} from "statblock-parser-core/product";

export type OpenedEntity = { kind: "library"; statblockId: string } | { kind: "combatant"; combatantId: string } | null;

export function resolveOpenedCombatant(opened: OpenedEntity, encounter: EncounterState | null): Combatant | null {
  if (opened?.kind !== "combatant" || encounter === null) return null;
  return encounter.combatants.find((entry) => entry.id === opened.combatantId) ?? null;
}

export function resolveOpenedStatblock(
  opened: OpenedEntity,
  openedCombatant: Combatant | null,
  libraryById: ReadonlyMap<string, SavedStatblock>,
): SavedStatblock | null {
  if (opened === null) return null;
  if (opened.kind === "library") return libraryById.get(opened.statblockId) ?? null;
  if (openedCombatant === null || openedCombatant.kind !== "statblock") return null;
  return libraryById.get(openedCombatant.statblockId) ?? null;
}

export function resolveOpenedDocument(
  opened: OpenedEntity,
  openedCombatant: Combatant | null,
  openedStatblock: SavedStatblock | null,
  libraryLanguage: "en" | "uk",
): EditableStatblockDocument | null {
  if (opened?.kind === "library") {
    if (libraryLanguage === "uk") {
      return openedStatblock?.versions.uk?.working ?? openedStatblock?.versions.en.working ?? null;
    }
    return openedStatblock?.versions.en.working ?? null;
  }
  if (openedCombatant?.kind === "statblock") {
    return openedStatblock?.versions.en.working ?? openedCombatant.document;
  }
  return null;
}

export function resolveOpenedCardConfig(
  opened: OpenedEntity,
  openedCombatant: Combatant | null,
  openedStatblock: SavedStatblock | null,
): StatblockCombatant["cardConfig"] | SavedStatblock["cardConfig"] | null {
  if (opened?.kind === "library") return openedStatblock?.cardConfig ?? null;
  if (openedCombatant?.kind === "statblock") return openedStatblock?.cardConfig ?? openedCombatant.cardConfig;
  return null;
}

export function combatantDisplayName(
  combatant: Combatant,
  encounter: EncounterState,
  sourceDocument?: EditableStatblockDocument | null,
): string {
  if (combatant.kind === "stub") return combatant.displayName;
  if (combatant.nameOverride !== null) return combatant.nameOverride;

  const base = sourceDocument?.facts.name ?? combatant.document.facts.name ?? "Без назви";
  const siblings = encounter.combatants.filter(
    (entry) => entry.kind === "statblock" && entry.statblockId === combatant.statblockId,
  );
  if (siblings.length <= 1) return base;
  const index = siblings.findIndex((entry) => entry.id === combatant.id);
  return `${base} #${index + 1}`;
}
