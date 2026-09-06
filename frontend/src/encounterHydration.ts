import {
  createCombatHpState,
  migrateEditableStatblockDocument,
  type Combatant,
  type EditableStatblockDocument,
  type EncounterState,
  type SavedStatblock,
  type StatblockCombatant,
  type StubCombatant,
} from "statblock-parser-core/product";

function normalizeLimitedUses(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
      .map(([key, remaining]) => [key, Math.max(0, Math.trunc(remaining))]),
  );
}

export function hydrateEncounterState(
  storedEncounter: EncounterState,
  library: readonly SavedStatblock[],
): { encounter: EncounterState; changed: boolean } {
  const valuesById = new Map(library.map((entry) => [entry.id, entry]));
  let changed = false;
  const combatants = storedEncounter.combatants
    .map((entry) => {
      if ((entry as Combatant).kind === "stub") {
        const legacyStub = entry as StubCombatant & { formatVersion?: string };
        if (legacyStub.formatVersion === "stub-combatant-v2") return legacyStub;
        changed = true;
        return { ...legacyStub, formatVersion: "stub-combatant-v2" as const };
      }

      const legacy = entry as StatblockCombatant & {
        document?: EditableStatblockDocument;
        nameOverride?: string | null;
        formatVersion?: string;
      };
      if (
        legacy.formatVersion === "statblock-combatant-v3" &&
        legacy.document !== undefined &&
        (legacy as StatblockCombatant).cardConfig !== undefined
      ) {
        const document = migrateEditableStatblockDocument(legacy.document);
        const limitedUses = normalizeLimitedUses(legacy.limitedUses);
        // A missing subtitle is valid. Only an actually migrated name row or
        // limited-use state should schedule a persistence write on startup.
        if (
          legacy.document.header.name === null ||
          JSON.stringify(limitedUses) !== JSON.stringify(legacy.limitedUses)
        ) {
          changed = true;
        }
        return { ...legacy, document, limitedUses };
      }

      const source = valuesById.get(legacy.statblockId);
      if (source === undefined) {
        changed = true;
        return null;
      }

      changed = true;
      const document = structuredClone(source.versions.en.working);
      return {
        ...legacy,
        formatVersion: "statblock-combatant-v3" as const,
        document,
        cardConfig: structuredClone(source.cardConfig),
        nameOverride: legacy.nameOverride ?? null,
        limitedUses: {},
        hp:
          legacy.hp ??
          (document.facts.hitPointMaximum === null ? null : createCombatHpState(document.facts.hitPointMaximum)),
        initiativeModifier: legacy.initiativeModifier ?? document.facts.initiative?.modifier ?? 0,
        initiativeRoll: legacy.initiativeRoll ?? null,
      };
    })
    .filter((entry): entry is Combatant => entry !== null);

  const legacyEncounter = storedEncounter as EncounterState & {
    active?: boolean;
    round?: number | null;
    currentCombatantId?: string | null;
    formatVersion?: string;
  };
  if (
    legacyEncounter.formatVersion !== "encounter-v3" ||
    legacyEncounter.active === undefined ||
    legacyEncounter.round === undefined ||
    legacyEncounter.currentCombatantId === undefined
  ) {
    changed = true;
  }
  const encounter: EncounterState = {
    ...storedEncounter,
    formatVersion: "encounter-v3",
    combatants,
    active: legacyEncounter.active ?? false,
    round: legacyEncounter.round ?? null,
    currentCombatantId: legacyEncounter.currentCombatantId ?? null,
  };
  return { changed, encounter };
}
