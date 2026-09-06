import { describe, expect, it } from "vitest";
import {
  createEmptyEncounter,
  createStatblockCombatant,
  type EditableStatblockDocument,
} from "statblock-parser-core/product";

import { hydrateEncounterState } from "./encounterHydration";

function documentWithoutSubtitle(): EditableStatblockDocument {
  const abilities = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  const savingThrows = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  return {
    formatVersion: "editable-statblock-v2",
    language: "en",
    header: {
      name: { id: "name", field: "name", text: "Goblin" },
      subtitle: null,
      primaryRows: [],
      abilities,
      savingThrows,
      secondaryRows: [],
      evidence: [],
    },
    body: [],
    facts: {
      name: "Goblin",
      armorClass: null,
      hitPointMaximum: null,
      initiative: null,
      abilities,
      savingThrows,
      proficiencyBonus: null,
    },
  };
}

describe("hydrateEncounterState", () => {
  it("does not rewrite a current encounter merely because subtitle is null", () => {
    const encounter = createEmptyEncounter("2026-09-06T00:00:00.000Z");
    encounter.combatants = [
      createStatblockCombatant("goblin", {
        id: "goblin-1",
        now: "2026-09-06T00:00:00.000Z",
        document: documentWithoutSubtitle(),
      }),
    ];
    expect(hydrateEncounterState(encounter, [])).toEqual({ encounter, changed: false });
  });
});
