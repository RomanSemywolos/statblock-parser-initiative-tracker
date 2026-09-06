import test from "node:test";
import assert from "node:assert/strict";

import { HEADER_FIELDS } from "./domain.js";

test("header field contract covers every supported core statblock header category", () => {
  assert.deepEqual(HEADER_FIELDS, [
    "name",
    "size_type_alignment",
    "size",
    "creature_type",
    "creature_subtype",
    "alignment",
    "armor_class",
    "armor_type",
    "initiative",
    "hit_points",
    "speed",
    "ability_scores",
    "ability_modifiers",
    "saving_throws",
    "skills",
    "damage_vulnerabilities",
    "damage_resistances",
    "damage_immunities",
    "condition_immunities",
    "senses",
    "languages",
    "habitat",
    "challenge",
    "experience_points",
    "proficiency_bonus",
    "other_header",
  ]);
});
