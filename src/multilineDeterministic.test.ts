import test from "node:test";
import assert from "node:assert/strict";

import { createLosslessSourceMap } from "./losslessSource.js";
import { createSourceCandidates, enrichMultilineCandidates } from "./sourceCandidates.js";
import { createMixedMultilineNormalizationPlan, createMultilineOwnershipPlan } from "./multilineDeterministic.js";
import { prepareCandidateLattice } from "./candidateLattice.js";

function createBodyPlanAfter(source: string, candidates: readonly { start: number }[], marker: string) {
  const bodyOffset = source.indexOf(marker);
  assert.ok(bodyOffset >= 0, `Missing body marker: ${marker}`);
  return createMultilineOwnershipPlan(source, candidates as any, {
    rawLength: source.length,
    ranges:
      bodyOffset === 0
        ? []
        : [
            {
              start: 0,
              end: bodyOffset,
              owners: [
                {
                  channel: "header_evidence" as const,
                  provenance: "structured_header_evidence" as const,
                  annotationId: null,
                  field: null,
                },
              ],
            },
          ],
  });
}

const source = `Adult Black Dragon
Huge dragon, chaotic evil
Armor Class 19 (natural armor)
Hit Points 195 (17d12 + 85)
Speed 40 ft., fly 80 ft., swim 40 ft.
STR DEX CON INT WIS CHA
23 (+6) 14 (+2) 21 (+5) 14 (+2) 13 (+1) 17 (+3)
Saving Throws DEX +7, CON +10, WIS +6, CHA +8
Skills Perception +11, Stealth +7
Damage Immunities acid
Senses blindsight 60 ft., darkvision 120 ft., passive Perception 21
Languages Common, Draconic
Challenge 14 (11,500 XP)
Proficiency Bonus +5
Amphibious. The dragon can breathe air and water.
Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead.
Actions
Multiattack. The dragon makes three attacks.
Bite. Melee Weapon Attack: +11 to hit, reach 10 ft., one target.
Legendary Actions
The dragon can take 3 legendary actions, choosing from the options below.
Detect. The dragon makes a Wisdom (Perception) check.
Tail Attack. The dragon makes a tail attack.`;

test("multiline body plan keeps header prefix for LLM and builds body deterministically", () => {
  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSourceCandidates(source, sourceMap);
  const plan = createBodyPlanAfter(source, candidates, "Amphibious.");

  assert.ok(plan.headerRuns.length > 0);
  const runTypes = plan.bodyRuns.map((run) => run.classification);
  assert.equal(runTypes[0], "feature");
  // Standalone section-looking rows are preserved structurally without
  // language-dependent semantic ownership. Presentation may style them later.
  assert.ok(runTypes.filter((type) => type === "unknown_section_heading").length >= 2);
  assert.ok(runTypes.includes("section_rules"));
  assert.ok(runTypes.filter((type) => type === "feature").length >= 6);

  assert.equal(
    plan.headerRuns.some((run) =>
      source
        .slice(candidates[run.startCandidate]!.start, candidates[run.endCandidate + 1]?.start ?? source.length)
        .includes("Amphibious."),
    ),
    false,
  );
});

test("multiline body never splits a feature at an inline sentence candidate", () => {
  const source = `Ancient Black Dragon
Gargantuan Dragon, Chaotic Evil
Armor Class 22 (natural armor)
Hit Points 367 (21d20 + 147)
Speed 40 ft., Fly 80 ft., Swim 40 ft.
Saving Throws DEX +9, CON +14, WIS +9, CHA +11
Senses Blindsight 60 ft., Darkvision 120 ft., Passive Perception 26
Languages Common, Draconic
Challenge 21 (33,000 XP)
Proficiency Bonus +7
Traits
Amphibious. The dragon can breathe air and water.
Actions
Multiattack. The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.
Bite. Melee Weapon Attack: +15 to hit, reach 15 ft., one target.
Legendary Actions
The dragon can take 3 legendary actions, choosing from the options below.
Detect. The dragon makes a Wisdom (Perception) check.`;

  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSourceCandidates(source, sourceMap);
  const plan = createBodyPlanAfter(source, candidates, "Traits");

  const multiattackStart = candidates.findIndex((candidate) => candidate.preview.startsWith("Multiattack."));
  const inlineSentence = candidates.findIndex((candidate) =>
    candidate.preview.startsWith("The dragon can use its Frightful Presence."),
  );
  assert.ok(multiattackStart >= 0);
  // Candidate generation now rejects sentence-shaped same-line pseudo titles
  // before the multiline planner sees them. The invariant remains the same:
  // the continuation belongs to Multiattack and cannot become a sibling run.
  assert.equal(inlineSentence, -1);

  const multiattackRun = plan.bodyRuns.find(
    (run) => run.classification === "feature" && run.startCandidate === multiattackStart,
  );
  assert.ok(multiattackRun);
  const runStart = candidates[multiattackRun.startCandidate]?.start ?? 0;
  const runEnd = candidates[multiattackRun.endCandidate + 1]?.start ?? source.length;
  const runText = source.slice(runStart, runEnd);
  assert.match(runText, /Multiattack\. The dragon can use its Frightful Presence\. It then makes three attacks/u);
  assert.doesNotMatch(runText, /\nBite\./u);
});

test("multiline specialization uses complete physical lines so markup and internal punctuation cannot hide sibling features", () => {
  const source = `Kraken
Gargantuan monstrosity (titan), Chaotic Evil
- **Armor Class **18 (Natural Armor)
- **Hit Points **472 (27d20+189)
- **Speed **20 ft., swim 60 ft.
Saving Throws Str +17, Dex +7, Con +14, Int +13, Wis +11
Damage Immunities Lightning
Senses Truesight 120 Ft.
Languages Abyssal
Challenge 23 (50,000 XP)
* ***Amphibious***. The kraken can breathe air and water.
## Actions
- ***Multiattack.*** The kraken makes three tentacle attacks.
- ***Bite.*** Melee Weapon Attack: +17 to hit, reach 5 ft., one target. Hit: 23 (3d8 + 10) piercing damage.
- ***Tentacle.*** Melee Weapon Attack: +17 to hit, reach 30 ft., one target. Hit: 20 (3d6 + 10) bludgeoning damage.
- ***Fling.*** One Large or smaller object is thrown.
## Legendary Actions
Kraken can take 3 legendary actions, choosing from the options below.
- **Tentacle Attack or Fling.**The kraken makes one tentacle attack or uses its Fling.
- **Lightning Storm (Costs 2 Actions).**The kraken uses Lightning Storm.
- **Ink Cloud (Costs 3 Actions).**While underwater, the kraken expels an ink cloud.`;

  const sourceMap = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, sourceMap);
  const candidates = enrichMultilineCandidates(source, sourceMap, base);
  const plan = createBodyPlanAfter(source, candidates, "Amphibious");

  const featureTexts = plan.bodyRuns
    .filter((run) => run.classification === "feature")
    .map((run) =>
      source.slice(candidates[run.startCandidate]!.start, candidates[run.endCandidate + 1]?.start ?? source.length),
    );

  assert.ok(featureTexts.some((text) => text.includes("Multiattack.") && !text.includes("Bite.")));
  assert.ok(featureTexts.some((text) => text.includes("Bite.") && !text.includes("Tentacle.")));
  assert.ok(featureTexts.some((text) => text.includes("Tentacle.") && !text.includes("Fling.")));
  assert.ok(
    featureTexts.some(
      (text) => text.includes("Tentacle Attack or Fling.") && !text.includes("Lightning Storm (Costs 2 Actions)."),
    ),
  );
  assert.ok(
    featureTexts.some(
      (text) => text.includes("Lightning Storm (Costs 2 Actions).") && !text.includes("Ink Cloud (Costs 3 Actions)."),
    ),
  );
});

test("multiline body keeps every non-empty physical line as a separate logical run", () => {
  const source = `Empyrean
Huge Celestial, Chaotic Good
Armor Class 22
Hit Points 313
Speed 50 ft.
Saving Throws STR +10
Senses truesight 120 ft.
Languages all
Challenge 23
Innate Spellcasting. The empyrean's innate spellcasting ability is Charisma.
At will: greater restoration, pass without trace, water breathing, water walk
1/day each: commune, dispel evil and good, earthquake, fire storm, plane shift
Actions
Maul. Melee Weapon Attack: +17 to hit.`;

  const sourceMap = createLosslessSourceMap(source);
  const candidates = enrichMultilineCandidates(source, sourceMap, createSourceCandidates(source, sourceMap));
  const plan = createBodyPlanAfter(source, candidates, "Innate Spellcasting.");
  const bodyTexts = plan.bodyRuns.map((run) =>
    source
      .slice(candidates[run.startCandidate]!.start, candidates[run.endCandidate + 1]?.start ?? source.length)
      .trim(),
  );

  assert.ok(bodyTexts.includes("Innate Spellcasting. The empyrean's innate spellcasting ability is Charisma."));
  assert.ok(bodyTexts.includes("At will: greater restoration, pass without trace, water breathing, water walk"));
  assert.ok(bodyTexts.includes("1/day each: commune, dispel evil and good, earthquake, fire storm, plane shift"));
  assert.ok(bodyTexts.includes("Actions"));
  assert.ok(bodyTexts.every((text) => !/\n[^\n]/u.test(text)));
});

test("multiline feature boundaries depend on the title lead, not terminal punctuation at end of a long row", () => {
  const source = `Kraken
Gargantuan monstrosity (titan), Chaotic Evil
Armor Class 18
Hit Points 472
Speed 20 ft., swim 60 ft.
Saving Throws Str +17, Dex +7, Con +14, Int +13, Wis +11
Damage Immunities Lightning
Senses Truesight 120 ft.
Languages Abyssal
Challenge 23
Actions
Multiattack. The kraken makes three tentacle attacks, each of which it can replace with one use of Fling.
Bite. Melee Weapon Attack: +17 to hit, reach 5 ft., one target. Hit: 23 (3d8 + 10) piercing damage. If swallowed, the target is restrained
Tentacle. Melee Weapon Attack: +17 to hit, reach 30 ft., one target. Hit: 20 (3d6 + 10) bludgeoning damage. The target is grappled
Fling. One Large or smaller object held or creature grappled by the kraken is thrown.`;

  const sourceMap = createLosslessSourceMap(source);
  const candidates = enrichMultilineCandidates(source, sourceMap, createSourceCandidates(source, sourceMap));
  const plan = createBodyPlanAfter(source, candidates, "Actions");
  const featureStarts = plan.bodyRuns
    .filter((run) => run.classification === "feature")
    .map((run) =>
      source
        .slice(candidates[run.startCandidate]!.start, candidates[run.startCandidate + 1]?.start ?? source.length)
        .trim(),
    );

  assert.ok(featureStarts.some((text) => text.startsWith("Multiattack.")));
  assert.ok(featureStarts.some((text) => text.startsWith("Bite.")));
  assert.ok(featureStarts.some((text) => text.startsWith("Tentacle.")));
  assert.ok(featureStarts.some((text) => text.startsWith("Fling.")));
});

test("multiline planner never merges continuation-looking physical rows with their owning feature", () => {
  const source = `Baphomet
Huge Fiend, Chaotic Evil
Armor Class 22
Hit Points 275
Speed 40 ft.
Saving Throws Dex +8
Senses truesight 120 ft.
Languages all
Challenge 23
Innate Spellcasting. Baphomet's spellcasting ability is Charisma (spell save DC 18). He can innately cast the following spells, requiring no material components.
At will: detect magic
3/day each: dispel magic, dominate beast, hunter's mark, maze, wall of stone
1/day each: teleport
Actions
Multiattack. Baphomet makes three attacks
Gore. Melee Weapon Attack: +17 to hit, reach 10 ft., one target`;

  const sourceMap = createLosslessSourceMap(source);
  const candidates = enrichMultilineCandidates(source, sourceMap, createSourceCandidates(source, sourceMap));
  const plan = createBodyPlanAfter(source, candidates, "Innate Spellcasting.");
  const bodyTexts = plan.bodyRuns.map((run) =>
    source
      .slice(candidates[run.startCandidate]!.start, candidates[run.endCandidate + 1]?.start ?? source.length)
      .trim(),
  );

  assert.ok(bodyTexts.some((text) => text.startsWith("Innate Spellcasting.") && !text.includes("\nAt will:")));
  assert.ok(bodyTexts.includes("At will: detect magic"));
  assert.ok(bodyTexts.includes("3/day each: dispel magic, dominate beast, hunter's mark, maze, wall of stone"));
  assert.ok(bodyTexts.includes("1/day each: teleport"));
  assert.ok(bodyTexts.includes("Actions"));
});

test("multiline physical-line invariant is language-neutral for unknown section labels", () => {
  const source = `Астральный дредноут
Огромная аберрация, законно-злая
Класс Доспеха 20
Хиты 297
Скорость 15 фт.
Необычная природа. Дредноут не нуждается в воздухе, еде, воде или сне.
Действия
Мультиатака. Астральный дредноут совершает одну атаку Укусом и две атаки Клешнями.
Клешни. Рукопашная атака оружием: +16 к попаданию.
Легендарные действия
Астральный Дредноут может совершить 3 легендарных действия.
Клешни. Астральный дредноут совершает одну атаку Клешнями.`;

  const sourceMap = createLosslessSourceMap(source);
  const candidates = enrichMultilineCandidates(source, sourceMap, createSourceCandidates(source, sourceMap));
  const plan = createBodyPlanAfter(source, candidates, "Необычная природа.");
  const bodyTexts = plan.bodyRuns.map((run) =>
    source
      .slice(candidates[run.startCandidate]!.start, candidates[run.endCandidate + 1]?.start ?? source.length)
      .trim(),
  );

  assert.ok(bodyTexts.includes("Действия"));
  assert.ok(bodyTexts.includes("Легендарные действия"));
  assert.ok(bodyTexts.includes("Астральный Дредноут может совершить 3 легендарных действия."));
  assert.ok(bodyTexts.every((text) => !text.includes("Действия\nМультиатака")));
  assert.ok(bodyTexts.every((text) => !text.includes("Легендарные действия\nАстральный")));

  const actionRun = plan.bodyRuns[bodyTexts.indexOf("Действия")];
  const legendaryRun = plan.bodyRuns[bodyTexts.indexOf("Легендарные действия")];
  assert.equal(actionRun?.classification, "unknown_section_heading");
  assert.equal(legendaryRun?.classification, "unknown_section_heading");
});

test("multiline deterministic body treats exclamation and question feature titles like period titles", () => {
  const source = `Guardian
Large construct, lawful neutral
Armor Class 18
Hit Points 120
Speed 30 ft.
Actions
Tally Ho! The guardian emits a rallying cry that empowers nearby allies.
Who Goes There? The guardian challenges one creature it can see.`;
  const sourceMap = createLosslessSourceMap(source);
  const candidates = enrichMultilineCandidates(source, sourceMap, createSourceCandidates(source, sourceMap));
  const plan = createBodyPlanAfter(source, candidates, "Actions");
  const starts = plan.bodyRuns
    .filter((run) => run.classification === "feature")
    .map((run) =>
      source
        .slice(candidates[run.startCandidate]!.start, candidates[run.startCandidate + 1]?.start ?? source.length)
        .trim(),
    );
  assert.ok(starts.some((text) => text.startsWith("Tally Ho!")));
  assert.ok(starts.some((text) => text.startsWith("Who Goes There?")));
});

test("multiline body recognizes sibling feature rows when copied title punctuation loses its following space", () => {
  const source = `Kraken
Gargantuan monstrosity (titan), Chaotic Evil
Armor Class 18
Hit Points 472
Speed 20 ft., swim 60 ft.
Saving Throws Str +17, Dex +7, Con +14, Int +13, Wis +11
Senses Truesight 120 ft.
Languages Abyssal
Challenge 23
Legendary Actions
Kraken can take 3 legendary actions, choosing from the options below.
Tentacle Attack or Fling.The kraken makes one tentacle attack or uses its Fling.
Lightning Storm (Costs 2 Actions).The kraken uses Lightning Storm.
Ink Cloud (Costs 3 Actions).While underwater, the kraken expels an ink cloud in a 60-foot radius.`;

  const sourceMap = createLosslessSourceMap(source);
  const candidates = enrichMultilineCandidates(source, sourceMap, createSourceCandidates(source, sourceMap));
  const plan = createBodyPlanAfter(source, candidates, "Legendary Actions");
  const featureTexts = plan.bodyRuns
    .filter((run) => run.classification === "feature")
    .map((run) =>
      source.slice(candidates[run.startCandidate]!.start, candidates[run.endCandidate + 1]?.start ?? source.length),
    );

  assert.ok(
    featureTexts.some((text) => text.startsWith("Tentacle Attack or Fling.") && !text.includes("Lightning Storm")),
  );
  assert.ok(
    featureTexts.some((text) => text.startsWith("Lightning Storm (Costs 2 Actions).") && !text.includes("Ink Cloud")),
  );
  assert.ok(featureTexts.some((text) => text.startsWith("Ink Cloud (Costs 3 Actions).")));
});

test("ownership-first multiline plan treats accepted header rows as a set, not a prefix", () => {
  const source = [
    "Creature",
    "Speed 30 ft.",
    "Armor Class 18 (natural armor)",
    "Unowned Metadata 7",
    "Challenge 10 (5,900 XP)",
    "Actions",
    "Bite. Text.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = enrichMultilineCandidates(source, sourceMap, createSourceCandidates(source, sourceMap));
  const range = (text: string, field: "name" | "armor_class" | "challenge") => {
    const start = source.indexOf(text);
    assert.ok(start >= 0);
    return {
      start,
      end: start + text.length,
      owners: [
        {
          channel: "header_evidence" as const,
          provenance: "structured_header_fact" as const,
          annotationId: null,
          field,
        },
      ],
    };
  };
  const ownership = {
    rawLength: source.length,
    ranges: [range("Creature", "name"), range("Armor Class 18", "armor_class"), range("Challenge 10", "challenge")],
  };

  const plan = createMultilineOwnershipPlan(source, candidates, ownership);
  const sliceRun = (run: { startCandidate: number; endCandidate: number }) =>
    source
      .slice(candidates[run.startCandidate]!.start, candidates[run.endCandidate + 1]?.start ?? source.length)
      .trim();
  const headerTexts = plan.headerRuns.map(sliceRun);
  const bodyTexts = plan.bodyRuns.map(sliceRun);

  assert.deepEqual(headerTexts, ["Creature", "Armor Class 18 (natural armor)", "Challenge 10 (5,900 XP)"]);
  assert.ok(bodyTexts.includes("Speed 30 ft."));
  assert.ok(bodyTexts.includes("Unowned Metadata 7"));
  assert.ok(bodyTexts.includes("Actions"));
  assert.ok(bodyTexts.includes("Bite. Text."));
  assert.ok(plan.signals.includes("body_definition=complement_of_header_rows"));
});

test("ownership-first multiline plan expands narrow semantic evidence only to its physical presentation row", () => {
  const source = "Armor Class 18 (natural armor)\nActions\nBite. Text.";
  const sourceMap = createLosslessSourceMap(source);
  const candidates = enrichMultilineCandidates(source, sourceMap, createSourceCandidates(source, sourceMap));
  const ownership = {
    rawLength: source.length,
    ranges: [
      {
        start: source.indexOf("18"),
        end: source.indexOf("18") + 2,
        owners: [
          {
            channel: "header_evidence" as const,
            provenance: "structured_header_fact" as const,
            annotationId: null,
            field: "armor_class" as const,
          },
        ],
      },
    ],
  };

  const plan = createMultilineOwnershipPlan(source, candidates, ownership);
  assert.equal(plan.headerRuns.length, 1);
  const run = plan.headerRuns[0]!;
  const headerRow = source
    .slice(candidates[run.startCandidate]!.start, candidates[run.endCandidate + 1]?.start ?? source.length)
    .trim();
  assert.equal(headerRow, "Armor Class 18 (natural armor)");
  assert.equal(run.field, "armor_class");
  assert.equal(
    plan.bodyRuns.some(
      (bodyRun) =>
        source
          .slice(
            candidates[bodyRun.startCandidate]!.start,
            candidates[bodyRun.endCandidate + 1]?.start ?? source.length,
          )
          .trim() === "Actions",
    ),
    true,
  );
});

test("mixed normalization supplies only virtual multiline geometry, then uses the same deterministic BODY semantics", () => {
  const mixed = [
    "Speed 40 ft.",
    "Traits",
    "Amphibious. The dragon can breathe",
    "air and water.",
    "Second Trait. The dragon sees",
    "through fog.",
    "Actions",
    "Bite. Melee Weapon Attack:",
    "+10 to hit.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(mixed);
  const candidates = prepareCandidateLattice(mixed, sourceMap, "generic").candidates;
  const at = (marker: string): number => {
    const offset = mixed.indexOf(marker);
    assert.ok(offset >= 0);
    const index = candidates.findIndex((candidate, candidateIndex) => {
      const next = candidates[candidateIndex + 1]?.start ?? mixed.length;
      return candidate.start <= offset && offset < next;
    });
    assert.ok(index >= 0, `missing ${marker}`);
    return index;
  };
  const allowed = candidates.map((_, index) => index);
  const plan = createMixedMultilineNormalizationPlan(mixed, candidates, allowed, [
    at("Speed 40 ft."),
    at("Traits"),
    at("Amphibious."),
    at("Second Trait."),
    at("Actions"),
    at("Bite."),
  ]);

  assert.deepEqual(
    plan.bodyRuns.map((run) => run.classification),
    ["feature", "unknown_section_heading", "feature", "feature", "unknown_section_heading", "feature"],
  );
  assert.match(plan.signals.join(" "), /restore_multiline_logical_lines_only/u);
});
