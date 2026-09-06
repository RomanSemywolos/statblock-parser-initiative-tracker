import assert from "node:assert/strict";
import test from "node:test";

import { createLosslessSourceMap } from "./losslessSource.js";
import { createSourceCandidates, enrichSinglelineCandidates } from "./sourceCandidates.js";

const fixtures = [
  {
    source:
      "Demogorgon Huge Fiend (Demon), Chaotic Evil Armor Class 22 (natural armor) Hit Points 406 (28d12 + 224) Speed 50 ft., Swim 50 ft. STR 29 (+9) DEX 14 (+2) CON 26 (+8) INT 20 (+5) WIS 17 (+3) CHA 25 (+7) Saving Throws DEX +10, CON +16, WIS +11, CHA +15 Traits Magic Resistance. Demogorgon has advantage on saving throws. Magic Weapons. Demogorgon’s weapon attacks are magical. Actions Multiattack. Demogorgon makes two attacks. Tentacle. Melee Weapon Attack: +17 to hit. Gaze. The target suffers one of several effects: 1. Beguiling Gaze. The target is stunned. 2. Hypnotic Gaze. The target is charmed. Legendary Actions Demogorgon can take 2 legendary actions. Tail. Melee Weapon Attack: +17 to hit.",
    expected: [
      [0, ["document_start", "line_start"]],
      [11, ["standalone_block_start"]],
      [16, ["standalone_block_start"]],
      [22, ["standalone_block_start"]],
      [31, ["standalone_block_start"]],
      [39, ["standalone_block_start"]],
      [44, ["standalone_block_start"]],
      [75, ["standalone_block_start"]],
      [104, ["standalone_block_start"]],
      [130, ["table_row_start"]],
      [202, ["standalone_block_start"]],
      [251, ["standalone_block_start"]],
      [258, ["named_block_start", "standalone_block_start"]],
      [319, ["named_block_start"]],
      [375, ["standalone_block_start"]],
      [383, ["standalone_block_start"]],
      [426, ["named_block_start"]],
      [469, ["named_block_start"]],
      [518, ["sentence_start"]],
      [560, ["sentence_start"]],
      [601, ["standalone_block_start"]],
      [619, ["standalone_block_start"]],
      [660, ["named_block_start"]],
    ],
  },
  {
    source:
      "Actions Tentacle. The target dies if its maximum is reduced to 0. Gaze. The target suffers one of the following: 1. First Effect. Text. 2. Second Effect. Text. 3. Third Effect. Text.",
    expected: [
      [0, ["document_start", "line_start", "standalone_block_start"]],
      [8, ["named_block_start", "standalone_block_start"]],
      [66, ["named_block_start"]],
      [113, ["sentence_start"]],
      [130, ["named_block_start"]],
      [136, ["sentence_start"]],
      [154, ["named_block_start"]],
      [160, ["sentence_start"]],
      [177, ["named_block_start"]],
    ],
  },
  {
    source:
      "Marilith Decimator Large fiend (demon), chaotic evil Armor Class 18 Hit Points 189 Speed 40 ft. STR 18 (+4) DEX 20 (+5) CON 18 (+4) INT 18 (+4) WIS 16 (+3) CHA 20 (+5) Saving Throws Dex +10 Actions Multiattack. The marilith attacks. Tail! The target is hit. Reactions Parry. The marilith adds 5 to its AC.",
    expected: [
      [0, ["document_start", "line_start"]],
      [9, ["standalone_block_start"]],
      [19, ["standalone_block_start"]],
      [25, ["standalone_block_start"]],
      [31, ["standalone_block_start"]],
      [40, ["standalone_block_start"]],
      [48, ["standalone_block_start"]],
      [53, ["standalone_block_start"]],
      [68, ["standalone_block_start"]],
      [83, ["standalone_block_start"]],
      [96, ["table_row_start"]],
      [168, ["standalone_block_start"]],
      [190, ["standalone_block_start"]],
      [198, ["named_block_start", "standalone_block_start"]],
      [233, ["named_block_start"]],
      [258, ["standalone_block_start"]],
      [268, ["standalone_block_start"]],
      [302, ["named_block_start"]],
    ],
  },
] as const;

test("singleline enrichment preserves all legacy structural coordinates while allowing additional weak multilingual coordinates", () => {
  for (const fixture of fixtures) {
    const map = createLosslessSourceMap(fixture.source);
    const candidates = enrichSinglelineCandidates(fixture.source, map, createSourceCandidates(fixture.source, map));
    const starts = new Set(candidates.map((candidate) => candidate.start));
    for (const [start] of fixture.expected) {
      assert.ok(starts.has(start), `legacy structural coordinate missing at source offset ${start}`);
    }

    // The new lattice is deliberately over-complete: weak token coordinates may
    // be added so unknown/localized collapsed headers remain addressable.
    // Parity therefore means legacy structural coordinates are preserved, not
    // that the candidate array remains byte-for-byte sparse.
    assert.ok(candidates.length >= fixture.expected.length);
  }
});
