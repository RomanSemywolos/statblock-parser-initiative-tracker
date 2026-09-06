import test from "node:test";
import assert from "node:assert/strict";
import { translateEditableStatblockWithProvider } from "./translationDocument.js";
import type { EditableStatblockDocument } from "./productModel.js";
import type { TranslationProvider } from "./translationProvider.js";

function fixture(): EditableStatblockDocument {
  return {
    formatVersion: "editable-statblock-v2",
    language: "en",
    header: {
      name: { id: "n", field: "name", text: "Test Fiend" },
      subtitle: null,
      primaryRows: [{ id: "ac", field: "armor_class", text: "Armor Class 18" }],
      abilities: {
        str: { score: 10, modifier: 0 },
        dex: { score: 16, modifier: 3 },
        con: null,
        int: null,
        wis: null,
        cha: null,
      },
      savingThrows: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
      secondaryRows: [],
    },
    body: [
      { id: "h", type: "heading", headingKind: "actions", text: "Actions" },
      {
        id: "a",
        type: "paragraph",
        text: "Claw. Melee Weapon Attack: +7 to hit. Hit: 12 (2d6 + 5) slashing damage. The target is pushed away.",
      },
    ],
    facts: {
      name: "Test Fiend",
      armorClass: 18,
      hitPointMaximum: null,
      initiative: { modifier: 3, provenance: "dex_modifier" },
      abilities: {
        str: { score: 10, modifier: 0 },
        dex: { score: 16, modifier: 3 },
        con: null,
        int: null,
        wis: null,
        cha: null,
      },
      savingThrows: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
      proficiencyBonus: null,
    },
  };
}

const provider: TranslationProvider = {
  id: "fake",
  displayName: "Fake",
  providerType: "fake",
  async healthCheck() {
    return { ok: true };
  },
  async translate(request) {
    assert.equal(request.texts.length, 1);
    assert.match(request.texts[0] ?? "", /KEEP_/u);
    assert.match(request.texts[0] ?? "", /The target is pushed away/u);
    return {
      texts: [request.texts[0]!.replace("The target is pushed away", "Ціль відштовхується")],
      elapsedMs: 4,
    };
  },
};

test("MT translates unresolved prose while deterministic Ukrainian and mechanics survive", async () => {
  const result = await translateEditableStatblockWithProvider(fixture(), provider);
  const text = result.document.body[1]?.text ?? "";
  assert.match(text, /Рукопашна атака зброєю/u);
  assert.match(text, /\+7/u);
  assert.match(text, /2d6 \+ 5/u);
  assert.match(text, /Ціль відштовхується/u);
  assert.equal(result.machineTranslatedFragmentCount, 1);
  assert.equal(result.machineFallbackFragmentCount, 0);
  assert.equal(result.issues.length, 0);
});

const brokenProvider: TranslationProvider = {
  id: "broken",
  displayName: "Broken",
  providerType: "fake",
  async healthCheck() {
    return { ok: true };
  },
  async translate(request) {
    return { texts: request.texts.map((text) => text.replace(/⟦KEEP_[A-Z]+⟧/u, "")), elapsedMs: 1 };
  },
};

test("corrupted deterministic token safely falls back", async () => {
  const result = await translateEditableStatblockWithProvider(fixture(), brokenProvider);
  assert.equal(result.machineTranslatedFragmentCount, 0);
  assert.equal(result.machineFallbackFragmentCount, 1);
  assert.match(result.document.body[1]?.text ?? "", /The target is pushed away/u);
});

const reorderedKeepProvider: TranslationProvider = {
  id: "reordered",
  displayName: "Reordered",
  providerType: "fake",
  async healthCheck() {
    return { ok: true };
  },
  async translate(request) {
    const source = request.texts[0] ?? "";
    const tokens = source.match(/⟦KEEP_[A-Z]+⟧/gu) ?? [];
    assert.ok(tokens.length >= 2);
    const first = tokens[0]!;
    const second = tokens[1]!;
    const swapped = source.replace(first, "⟦SWAP_A⟧").replace(second, first).replace("⟦SWAP_A⟧", second);
    return { texts: [swapped], elapsedMs: 1 };
  },
};

test("reordered deterministic KEEP islands safely fall back instead of changing source order", async () => {
  const result = await translateEditableStatblockWithProvider(fixture(), reorderedKeepProvider);
  assert.equal(result.machineTranslatedFragmentCount, 0);
  assert.equal(result.machineFallbackFragmentCount, 1);
  assert.match(result.document.body[1]?.text ?? "", /The target is pushed away/u);
});
