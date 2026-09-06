import test from "node:test";
import assert from "node:assert/strict";

import { createLosslessSourceMap } from "./losslessSource.js";
import { createSourceCandidates, enrichGenericCandidates, enrichSinglelineCandidates } from "./sourceCandidates.js";
import { attachBoundaryEvidence } from "./boundaryEvidence.js";
import { candidateHeaderFacts, candidateResponseToDirectResponse } from "./candidateTransport.js";
import type { CandidateRun, ParsedCandidateModelResponse } from "./modelSchema.js";

function parsed(runs: CandidateRun[], _candidateCount: number): ParsedCandidateModelResponse {
  return {
    runs,
    debugRuns: runs,
    abilityLabels: [],
    savingThrows: [],
    returnedCandidateCount: runs.length,
    issues: [],
  };
}

function candidateIndexStartingWith(candidates: ReturnType<typeof createSourceCandidates>, prefix: string): number {
  const index = candidates.findIndex((candidate) => candidate.preview.startsWith(prefix));
  assert.notEqual(index, -1, `Missing candidate starting with ${prefix}`);
  return index;
}

function candidateIndexAtSourceText(
  candidates: ReturnType<typeof createSourceCandidates>,
  source: string,
  text: string,
): number {
  const offset = source.indexOf(text);
  assert.notEqual(offset, -1, `Missing source text ${text}`);
  const index = candidates.findIndex((candidate) => candidate.start === offset);
  assert.notEqual(index, -1, `Missing candidate at source text ${text}`);
  return index;
}

function annotationSourceText(
  source: string,
  sourceMap: ReturnType<typeof createLosslessSourceMap>,
  annotation: { startUnitId: string; endUnitId: string },
): string {
  const start = sourceMap.units.find((unit) => unit.id === annotation.startUnitId);
  const end = sourceMap.units.find((unit) => unit.id === annotation.endUnitId);
  assert.ok(start && end);
  return source.slice(start.start, end.end);
}

test("verified identity may carve an independently grounded name prefix from classification", () => {
  const source = "Baphomet Huge fiend, chaotic evil Armor Class 22";
  const starts = [0, source.indexOf("Huge"), source.indexOf("Armor Class")];
  const candidates = starts.map((start, index) => ({
    id: `candidate-${index}`,
    start,
    startUnitId: `unit-${index}`,
    preview: source.slice(start, starts[index + 1] ?? source.length),
    reasons: [index === 0 ? ("document_start" as const) : ("sentence_start" as const)],
  }));
  const value = parsed([], candidates.length);
  value.essentialFacts = [
    { kind: "name", startCandidate: 0, endCandidate: 0 },
    { kind: "size_type_alignment", startCandidate: 0, endCandidate: 1 },
  ];
  const facts = candidateHeaderFacts({ rawSource: source, annotations: [] } as any, value, candidates);
  const type = facts.essentialRegions?.find((region) => region.kind === "size_type_alignment");
  assert.equal(type?.start, source.indexOf("Huge"));
  assert.equal(source.slice(type!.start, type!.end).trim(), "Huge fiend, chaotic evil");
  assert.ok(facts.issues.some((issue) => issue.code === "verified_identity_prefix_carved"));
});

test("verified identity rejects identical name and classification spans instead of inventing a split", () => {
  const source = "Demogorgon Huge Fiend (Demon), Chaotic Evil Armor Class 22";
  const starts = [0, source.indexOf("Armor Class")];
  const candidates = starts.map((start, index) => ({
    id: `candidate-${index}`,
    start,
    startUnitId: `unit-${index}`,
    preview: source.slice(start, starts[index + 1] ?? source.length),
    reasons: [index === 0 ? ("document_start" as const) : ("sentence_start" as const)],
  }));
  const value = parsed([], candidates.length);
  value.essentialFacts = [
    { kind: "name", startCandidate: 0, endCandidate: 0 },
    { kind: "size_type_alignment", startCandidate: 0, endCandidate: 0 },
  ];
  const facts = candidateHeaderFacts({ rawSource: source, annotations: [] } as any, value, candidates);
  assert.equal(
    facts.essentialRegions?.some((region) => region.kind === "name" || region.kind === "size_type_alignment"),
    false,
  );
  assert.ok(facts.issues.some((issue) => issue.code === "verified_identity_identical_span_rejected"));
});

test("direct candidate transport preserves model gaps as explicit unclassified ownership", () => {
  const source = [
    "Creature",
    "Large fiend, evil",
    "Armor Class 16",
    "Magic Resistance.",
    "The creature has advantage.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSourceCandidates(source, sourceMap);
  const armor = candidateIndexStartingWith(candidates, "Armor Class");
  const magic = candidateIndexStartingWith(candidates, "Magic Resistance.");
  const runs: CandidateRun[] = [
    { classification: "name", field: null, startCandidate: 0, endCandidate: 0 },
    { classification: "size_type_alignment", field: null, startCandidate: 1, endCandidate: 1 },
    { classification: "header_field", field: null, startCandidate: armor, endCandidate: armor },
    // Deliberately omit the tail: direct transport must not guess a feature.
  ];
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, parsed(runs, candidates.length));
  assert.ok(transported.issues.some((current) => current.code === "candidate_structural_gap_preserved"));
  assert.ok(
    transported.debug.runs.some((run) => run.classification === "unclassified" && run.startCandidate === magic),
  );
  assert.equal(transported.debug.coveredCandidateCount, candidates.length);
});

test("direct verifier evidence cannot turn saving-throw prose into a saving_throws header field", () => {
  const source = ["Creature", "Armor Class 16", "saving throws against spells and other magical effects."].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSourceCandidates(source, sourceMap);
  const prose = candidateIndexStartingWith(candidates, "saving throws against");
  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: 0, endCandidate: 0 },
      { classification: "header_field", field: null, startCandidate: 1, endCandidate: 1 },
      { classification: "header_field", field: null, startCandidate: prose, endCandidate: prose },
    ],
    candidates.length,
  );
  value.essentialFacts = [{ kind: "saving_throws", startCandidate: prose, endCandidate: prose }];
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const annotation = transported.response.candidates.find((current) => current.candidateIndex === prose)?.annotation;
  assert.ok(annotation && annotation.role === "header_field");
  assert.equal(annotation.field, "other_header");
});

test("direct candidate transport abstains on contradictory classifications for the exact same span", () => {
  const rawSource = "Creature\nActions\nBite. Text.";
  const sourceMap = createLosslessSourceMap(rawSource);
  const candidates = createSourceCandidates(rawSource, sourceMap);
  const parsed = {
    runs: [
      { classification: "name" as const, startCandidate: 0, endCandidate: 0, field: null },
      { classification: "header_field" as const, startCandidate: 1, endCandidate: 1, field: null },
      { classification: "actions_heading" as const, startCandidate: 1, endCandidate: 1, field: null },
      { classification: "feature" as const, startCandidate: 2, endCandidate: candidates.length - 1, field: null },
    ],
    debugRuns: [],
    abilityLabels: [],
    savingThrows: [],
    essentialFacts: [],
    returnedCandidateCount: 4,
    issues: [],
  };

  const result = candidateResponseToDirectResponse(rawSource, sourceMap, candidates, parsed);
  assert.ok(result.issues.some((current) => current.code === "candidate_structural_exact_conflict_abstained"));
  assert.ok(result.debug.runs.some((run) => run.startCandidate === 1 && run.classification === "unclassified"));
});

test("direct verifier can validate a localized printed save row from grounded ability+bonus shape", () => {
  const source = ["Существо", "Спасброски Лов +5, Мдр +9", "Действия"].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSourceCandidates(source, sourceMap);
  const saves = candidateIndexStartingWith(candidates, "Спасброски");
  const actions = candidateIndexStartingWith(candidates, "Действия");
  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: 0, endCandidate: 0 },
      { classification: "header_field", field: null, startCandidate: saves, endCandidate: saves },
      { classification: "actions_heading", field: null, startCandidate: actions, endCandidate: actions },
    ],
    candidates.length,
  );
  value.abilityLabels = [
    { ability: "dex", labelQuote: "Лов" },
    { ability: "wis", labelQuote: "Мдр" },
  ];
  value.essentialFacts = [{ kind: "saving_throws", startCandidate: saves, endCandidate: saves }];

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const annotation = transported.response.candidates.find((current) => current.candidateIndex === saves)?.annotation;
  assert.ok(annotation && annotation.role === "header_field");
  assert.equal(annotation.field, "saving_throws");
});

test("direct candidate transport honors localized header semantics supplied by the structural model", () => {
  const source = ["Существо", "Навыки Восприятие +9", "Чувства тёмное зрение 120 футов"].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSourceCandidates(source, sourceMap);
  const skills = candidateIndexStartingWith(candidates, "Навыки");
  const senses = candidateIndexStartingWith(candidates, "Чувства");
  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: 0, endCandidate: 0 },
      { classification: "header_field", field: "skills", startCandidate: skills, endCandidate: skills },
      { classification: "header_field", field: "senses", startCandidate: senses, endCandidate: senses },
    ],
    candidates.length,
  );
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const fields = transported.response.candidates.flatMap((current) =>
    current.annotation.role === "header_field" ? [current.annotation.field] : [],
  );
  assert.ok(fields.includes("skills"));
  assert.ok(fields.includes("senses"));
});

test("single-line direct transport preserves multilingual model-owned header spans without deterministic English interval repair", () => {
  const source =
    "Астральный Дредноут Громадный монстр Класс Доспеха 20 Хиты 297 Скорость 15 футов Антимагический конус. Текст.";
  const sourceMap = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, sourceMap);
  const candidates = enrichSinglelineCandidates(source, sourceMap, base);
  const indexAtOffset = (text: string) => {
    const offset = source.indexOf(text);
    assert.notEqual(offset, -1);
    const index = candidates.findIndex((candidate) => candidate.start === offset);
    assert.notEqual(index, -1, `Missing candidate at ${text}`);
    return index;
  };
  const name = indexAtOffset("Астральный");
  const sta = indexAtOffset("Громадный");
  const armor = indexAtOffset("Класс");
  const hp = indexAtOffset("Хиты");
  const speed = indexAtOffset("Скорость");
  const feature = indexAtOffset("Антимагический");
  const runs: CandidateRun[] = [
    { classification: "name", field: null, startCandidate: name, endCandidate: sta - 1 },
    { classification: "size_type_alignment", field: null, startCandidate: sta, endCandidate: armor - 1 },
    { classification: "header_field", field: "armor_class", startCandidate: armor, endCandidate: hp - 1 },
    { classification: "header_field", field: "hit_points", startCandidate: hp, endCandidate: speed - 1 },
    { classification: "header_field", field: "speed", startCandidate: speed, endCandidate: feature - 1 },
    { classification: "feature", field: null, startCandidate: feature, endCandidate: candidates.length - 1 },
  ];

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, parsed(runs, candidates.length));
  const fields = transported.response.candidates.flatMap((candidate) =>
    candidate.annotation.role === "header_field" ? [candidate.annotation.field] : [],
  );
  assert.ok(fields.includes("armor_class"));
  assert.ok(fields.includes("hit_points"));
  assert.ok(fields.includes("speed"));
  assert.equal(
    transported.issues.some((current) => current.code.startsWith("singleline_")),
    false,
  );
});

test("single-line direct transport splits a coarse localized feature at a source-proven peer title", () => {
  const source = "Действия Укус. Существо атакует. Клешни. Существо атакует снова.";
  const sourceMap = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, sourceMap);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichSinglelineCandidates(source, sourceMap, base),
    "singleline",
  );
  const indexAtOffset = (text: string): number => {
    const offset = source.indexOf(text);
    const index = candidates.findIndex((candidate) => candidate.start === offset);
    assert.notEqual(index, -1, `Missing candidate at ${text}`);
    return index;
  };
  const actions = indexAtOffset("Действия");
  const bite = indexAtOffset("Укус.");
  const claw = indexAtOffset("Клешни.");
  const value = parsed(
    [
      { classification: "actions_heading", field: null, startCandidate: actions, endCandidate: actions },
      { classification: "feature", field: null, startCandidate: bite, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    enforceSourceProvenFeatureBoundaries: true,
  });
  const features = transported.response.candidates.filter((candidate) => candidate.annotation.role === "feature");
  assert.equal(features.length, 2);
  assert.ok(features.some((candidate) => candidate.candidateIndex === bite));
  assert.ok(features.some((candidate) => candidate.candidateIndex === claw));
  assert.ok(transported.issues.some((issue) => issue.code === "candidate_feature_split_at_internal_named_start"));
});

test("generic direct transport splits a coarse feature only at existing safe source-proven sibling starts", () => {
  const source = [
    "Actions",
    "Kiss of Lolth. Melee Weapon Attack: +15 to hit, reach",
    "15 ft., one creature. Hit: 26 piercing damage.",
    "This curse is suppressed for 24 hours by any effect",
    "that cures the Poisoned condition.",
    "Impaling Legs. Melee Weapon Attack: +15 to hit, reach",
    "15 ft., one creature. Hit: 20 piercing damage.",
    "Insidious Embrace. One creature within 15 feet of Lolth",
    "must succeed on a DC 23 Strength saving throw.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, sourceMap);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, base),
    "generic",
  );
  const actions = candidateIndexStartingWith(candidates, "Actions");
  const kiss = candidateIndexStartingWith(candidates, "Kiss of Lolth.");
  const impaling = candidateIndexStartingWith(candidates, "Impaling Legs.");
  const insidious = candidateIndexStartingWith(candidates, "Insidious Embrace.");

  const value = parsed(
    [
      { classification: "actions_heading", field: null, startCandidate: actions, endCandidate: actions },
      { classification: "feature", field: null, startCandidate: kiss, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    enforceSourceProvenFeatureBoundaries: true,
  });

  const features = transported.response.candidates.filter((candidate) => candidate.annotation.role === "feature");
  assert.equal(features.length, 3);
  assert.ok(transported.issues.some((issue) => issue.code === "candidate_feature_split_at_internal_named_start"));
  assert.ok(impaling > kiss && insidious > impaling);
});

test("generic source-proven boundary enforcement does not split a wrapped unfinished continuation", () => {
  const source = [
    "Actions",
    "Multiattack. The erlking may forgo one attack to use the Hide or",
    "Misty Step action.",
    "Naturalize (Costs 2 Actions). The erlking uses its",
    "Naturalize action.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, sourceMap);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, base),
    "generic",
  );
  const misty = candidates.find((candidate) => candidate.preview.startsWith("Misty Step action."));
  const naturalizeTail = candidates.find((candidate) => candidate.preview.startsWith("Naturalize action."));
  assert.ok(misty);
  assert.ok(naturalizeTail);
  assert.equal(misty.boundary?.scope, "unknown");
  assert.equal(misty.boundary?.strength, "weak");
  assert.equal(naturalizeTail.boundary?.scope, "unknown");
  assert.equal(naturalizeTail.boundary?.strength, "weak");
});

test("generic direct transport preserves separate sibling starts in a coarse traits feature", () => {
  const source = [
    "Nexus of the Great Web. Lolth knows the location,",
    "identity, and current hit points of any creature in contact with a spider's web, and cannot be Surprised.",
    "By the Dark Mother's Design. Lolth does not roll initiative.",
    "Instead, she may take her turn after another creature's turn.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, sourceMap);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, base),
    "generic",
  );
  const nexus = candidateIndexStartingWith(candidates, "Nexus of the Great Web.");
  const design = candidateIndexStartingWith(candidates, "By the Dark Mother's Design.");
  const value = parsed(
    [{ classification: "feature", field: null, startCandidate: nexus, endCandidate: candidates.length - 1 }],
    candidates.length,
  );
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    enforceSourceProvenFeatureBoundaries: true,
  });
  const features = transported.response.candidates.filter((candidate) => candidate.annotation.role === "feature");
  assert.equal(features.length, 2);
  assert.ok(design > nexus);
});

test("generic direct transport keeps a weak strong compact-label continuation inside the preceding feature", () => {
  const source = [
    "Actions",
    "Bite. Melee Weapon Attack: +16 to hit, reach 15 ft., one target.",
    "Outcome: 28 piercing damage.",
    "Claw. Melee Weapon Attack: +16 to hit, reach 10 ft., one target.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, sourceMap);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, base),
    "generic",
  );
  const actions = candidateIndexStartingWith(candidates, "Actions");
  const bite = candidateIndexStartingWith(candidates, "Bite.");
  const outcome = candidateIndexStartingWith(candidates, "Outcome:");
  const claw = candidateIndexStartingWith(candidates, "Claw.");

  const value = parsed(
    [
      { classification: "actions_heading", field: null, startCandidate: actions, endCandidate: actions },
      { classification: "feature", field: null, startCandidate: bite, endCandidate: bite },
      { classification: "feature", field: null, startCandidate: outcome, endCandidate: outcome },
      { classification: "feature", field: null, startCandidate: claw, endCandidate: claw },
    ],
    candidates.length,
  );
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    enforceSourceProvenFeatureBoundaries: true,
  });

  const features = transported.response.candidates.filter((candidate) => candidate.annotation.role === "feature");
  assert.equal(features.length, 2);
  assert.equal(
    features.some((candidate) => candidate.candidateIndex === outcome),
    false,
  );
  assert.ok(features.some((candidate) => candidate.candidateIndex === bite));
  assert.ok(features.some((candidate) => candidate.candidateIndex === claw));
});

test("generic direct transport preserves localized title-shaped header ownership without an English subtype", () => {
  const source = [
    "Істота",
    "Великий чужинець",
    "Таємна Властивість. Незвичне значення метаданих у локалізованому статблоці.",
    "Дії",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, sourceMap);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, base),
    "generic",
  );
  const customHeader = candidateIndexStartingWith(candidates, "Таємна Властивість.");
  const actions = candidateIndexStartingWith(candidates, "Дії");

  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: 0, endCandidate: 0 },
      { classification: "size_type_alignment", field: null, startCandidate: 1, endCandidate: 1 },
      { classification: "header_field", field: null, startCandidate: customHeader, endCandidate: customHeader },
      { classification: "actions_heading", field: null, startCandidate: actions, endCandidate: actions },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    enforceSourceProvenFeatureBoundaries: true,
  });
  const annotation = transported.response.candidates.find(
    (candidate) => candidate.candidateIndex === customHeader,
  )?.annotation;
  assert.ok(annotation && annotation.role === "header_field");
  assert.equal(annotation.field, "other_header");
  assert.equal(
    transported.issues.some((current) => current.code === "candidate_header_reclassified_as_feature"),
    false,
  );
});

test("generic direct transport closes a weak strong-continuation coordinate into the preceding feature", () => {
  const source = ["Actions", "Bite. Primary rule text.", "Outcome: continuation text.", "Claw. Another rule."].join(
    "\n",
  );
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const actions = candidateIndexStartingWith(candidates, "Actions");
  const bite = candidateIndexStartingWith(candidates, "Bite.");
  const outcome = candidateIndexStartingWith(candidates, "Outcome:");
  const claw = candidateIndexStartingWith(candidates, "Claw.");
  assert.equal(candidates[outcome]?.boundary?.strength, "weak");
  assert.equal(candidates[outcome]?.boundary?.continuationStrength, "strong");

  const value = parsed(
    [
      { classification: "actions_heading", field: null, startCandidate: actions, endCandidate: actions },
      { classification: "feature", field: null, startCandidate: bite, endCandidate: bite },
      { classification: "feature", field: null, startCandidate: outcome, endCandidate: outcome },
      { classification: "feature", field: null, startCandidate: claw, endCandidate: claw },
    ],
    candidates.length,
  );
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    enforceSourceProvenFeatureBoundaries: true,
  });

  assert.ok(
    transported.issues.some(
      (current) => current.code === "candidate_source_proven_continuation_closed" && current.candidateIndex === outcome,
    ),
  );
  const featureStarts = transported.response.candidates
    .filter((candidate) => candidate.annotation.role === "feature")
    .map((candidate) => candidate.candidateIndex);
  assert.deepEqual(featureStarts, [bite, claw]);
});

test("source-shape continuation never erases separately model-owned header rows", () => {
  const source = ["Creature", "Speed 40 ft.", "mod", "save", "Str", "24", "+7", "+7", "Skills Deception +14"].join(
    "\n",
  );
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const speed = candidateIndexStartingWith(candidates, "Speed 40 ft.");
  const mod = candidateIndexStartingWith(candidates, "mod");
  const save = candidateIndexStartingWith(candidates, "save");
  const str = candidateIndexStartingWith(candidates, "Str");
  const score = candidateIndexStartingWith(candidates, "24");
  const firstModifier = candidateIndexStartingWith(candidates, "+7");
  const skills = candidateIndexStartingWith(candidates, "Skills Deception +14");

  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: 0, endCandidate: 0 },
      { classification: "header_field", field: null, startCandidate: speed, endCandidate: speed },
      { classification: "header_field", field: null, startCandidate: mod, endCandidate: mod },
      { classification: "header_field", field: null, startCandidate: save, endCandidate: save },
      { classification: "header_field", field: null, startCandidate: str, endCandidate: str },
      { classification: "header_field", field: null, startCandidate: score, endCandidate: score },
      { classification: "header_field", field: null, startCandidate: firstModifier, endCandidate: firstModifier },
      {
        classification: "header_field",
        field: null,
        startCandidate: firstModifier + 1,
        endCandidate: firstModifier + 1,
      },
      { classification: "header_field", field: null, startCandidate: skills, endCandidate: skills },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    enforceSourceProvenFeatureBoundaries: true,
  });

  const starts = transported.response.candidates.map((candidate) => candidate.candidateIndex);
  assert.ok(starts.includes(mod));
  assert.ok(starts.includes(save));
  assert.ok(starts.includes(str));
  assert.ok(starts.includes(score));
  assert.equal(
    transported.response.candidates.find((candidate) => candidate.candidateIndex === speed)?.annotation.role,
    "header_field",
  );
});

test("strong continuation closure never erases an explicit model section heading in an unknown language", () => {
  const source = ["Arc Strike. Primary rule text.", "розділ:", "Next Rule. More text."].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const first = candidateIndexStartingWith(candidates, "Arc Strike.");
  const heading = candidateIndexStartingWith(candidates, "розділ:");
  const next = candidateIndexStartingWith(candidates, "Next Rule.");
  assert.equal(candidates[heading]?.boundary?.strength, "weak");

  const value = parsed(
    [
      { classification: "feature", field: null, startCandidate: first, endCandidate: first },
      { classification: "actions_heading", field: null, startCandidate: heading, endCandidate: heading },
      { classification: "feature", field: null, startCandidate: next, endCandidate: next },
    ],
    candidates.length,
  );
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    enforceSourceProvenFeatureBoundaries: true,
  });
  assert.ok(
    transported.response.candidates.some(
      (candidate) => candidate.candidateIndex === heading && candidate.annotation.role === "section_heading",
    ),
  );
});

test("generic transport keeps a source-proven introduced bullet sequence inside its parent feature", () => {
  const source = [
    "Breath Weapons. The creature uses one of the following options:",
    "• Antimagic Bomb. First effect.",
    "• Force Breath. Second effect.",
    "Claw. Another feature.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const breath = candidateIndexStartingWith(candidates, "Breath Weapons.");
  const anti = candidateIndexStartingWith(candidates, "• Antimagic Bomb.");
  const force = candidateIndexStartingWith(candidates, "• Force Breath.");
  const claw = candidateIndexStartingWith(candidates, "Claw.");

  const value = parsed(
    [
      { classification: "feature", field: null, startCandidate: breath, endCandidate: anti - 1 },
      { classification: "feature", field: null, startCandidate: anti, endCandidate: anti },
      { classification: "feature", field: null, startCandidate: force, endCandidate: force },
      { classification: "feature", field: null, startCandidate: claw, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const features = transported.debug.runs.filter((run) => run.classification === "feature");
  assert.deepEqual(
    features.map((run) => [run.startCandidate, run.endCandidate]),
    [
      [breath, force],
      [claw, candidates.length - 1],
    ],
  );
  assert.ok(transported.issues.some((issue) => issue.code === "candidate_source_proven_internal_list_closed"));
});

test("direct transport keeps a localized six-row vertical ability table under one header owner", () => {
  const source = [
    "Существо",
    "Сил 28 (+9)",
    "Лов 7 (-2)",
    "Тел 25 (+7)",
    "Инт 5 (-3)",
    "Мдр 14 (+2)",
    "Хар 18 (+4)",
    "Спасброски Лов +5, Мдр +9",
    "Антимагический конус. Текст.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const idx = (prefix: string) => candidateIndexStartingWith(candidates, prefix);
  const rows = ["Сил 28", "Лов 7", "Тел 25", "Инт 5", "Мдр 14", "Хар 18"].map(idx);
  const saves = idx("Спасброски");
  const feature = idx("Антимагический конус");
  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: 0, endCandidate: 0 },
      ...rows.map((row) => ({
        classification: "header_field" as const,
        field: null,
        startCandidate: row,
        endCandidate: row,
      })),
      { classification: "header_field", field: null, startCandidate: saves, endCandidate: saves },
      { classification: "feature", field: null, startCandidate: feature, endCandidate: feature },
    ],
    candidates.length,
  );
  value.abilityLabels = [
    { ability: "str", labelQuote: "Сил" },
    { ability: "dex", labelQuote: "Лов" },
    { ability: "con", labelQuote: "Тел" },
    { ability: "int", labelQuote: "Инт" },
    { ability: "wis", labelQuote: "Мдр" },
    { ability: "cha", labelQuote: "Хар" },
  ];

  const result = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const abilityAnnotation = result.response.candidates.find(
    (candidate) => candidate.candidateIndex === rows[0],
  )?.annotation;
  assert.ok(abilityAnnotation && abilityAnnotation.role === "header_field");
  assert.equal(abilityAnnotation.startUnitId, candidates[rows[0]]?.startUnitId);
  // Only the first table row owns the six-row span after source-proven closure.
  assert.equal(
    result.response.candidates.some((candidate) => rows.slice(1).includes(candidate.candidateIndex)),
    false,
  );
  assert.ok(result.issues.some((issue) => issue.code === "candidate_source_proven_internal_table_closed"));
});

test("single-line transport does not infer a semantic Initiative field from an English label", () => {
  const source = "Creature AC 17 Initiative +7 (17) HP 50";
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichSinglelineCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "singleline",
  );
  const ac = candidateIndexStartingWith(candidates, "AC");
  const hp = candidateIndexStartingWith(candidates, "HP");
  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: 0, endCandidate: ac - 1 },
      { classification: "header_field", field: "armor_class", startCandidate: ac, endCandidate: hp - 1 },
      { classification: "header_field", field: "hit_points", startCandidate: hp, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const header = transported.response.candidates.filter((entry) => entry.annotation.role === "header_field");
  assert.equal(
    header.some((entry) => entry.annotation.role === "header_field" && entry.annotation.field === "initiative"),
    false,
  );
});

test("two consecutive unknown named-rule header spans become an implicit traits region without changing a lone custom header", () => {
  const source = [
    "Creature",
    "Amphibious. The kraken can breathe air and water.",
    "Freedom of Movement. The kraken ignores difficult terrain.",
    "Actions",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const amphibious = candidateIndexStartingWith(candidates, "Amphibious.");
  const freedom = candidateIndexStartingWith(candidates, "Freedom of Movement.");
  const actions = candidateIndexStartingWith(candidates, "Actions");
  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: 0, endCandidate: 0 },
      { classification: "header_field", field: null, startCandidate: amphibious, endCandidate: amphibious },
      { classification: "header_field", field: null, startCandidate: freedom, endCandidate: freedom },
      { classification: "actions_heading", field: null, startCandidate: actions, endCandidate: actions },
    ],
    candidates.length,
  );
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    enforceSourceProvenFeatureBoundaries: true,
  });
  assert.equal(
    transported.response.candidates.find((entry) => entry.candidateIndex === amphibious)?.annotation.role,
    "feature",
  );
  assert.equal(
    transported.response.candidates.find((entry) => entry.candidateIndex === freedom)?.annotation.role,
    "feature",
  );
});

test("a standalone feature title owns its following weak prose row", () => {
  const source = [
    "Actions",
    "Twisting Havoc (Recharge 5-6).",
    "Each creature of the fiend's choice must succeed on a saving throw or become Charmed.",
    "Claw. Another rule.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const actions = candidateIndexStartingWith(candidates, "Actions");
  const twisting = candidateIndexStartingWith(candidates, "Twisting Havoc");
  const claw = candidateIndexStartingWith(candidates, "Claw.");
  const value = parsed(
    [
      { classification: "actions_heading", field: null, startCandidate: actions, endCandidate: actions },
      { classification: "feature", field: null, startCandidate: twisting, endCandidate: twisting },
      { classification: "feature", field: null, startCandidate: claw, endCandidate: claw },
    ],
    candidates.length,
  );
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    enforceSourceProvenFeatureBoundaries: true,
  });
  const annotation = transported.response.candidates.find((entry) => entry.candidateIndex === twisting)?.annotation;
  assert.ok(annotation && annotation.role === "feature");
  assert.match(annotationSourceText(source, sourceMap, annotation), /Twisting Havoc[\s\S]*Each creature/u);
});

test("localized printed saving throws can be classified from grounded ability labels without an essential-facts rescue", () => {
  const source = ["Существо", "Спасброски Лов +5, Мдр +9", "Действия"].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSourceCandidates(source, sourceMap);
  const saves = candidateIndexStartingWith(candidates, "Спасброски");
  const actions = candidateIndexStartingWith(candidates, "Действия");
  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: 0, endCandidate: 0 },
      { classification: "header_field", field: null, startCandidate: saves, endCandidate: saves },
      { classification: "actions_heading", field: null, startCandidate: actions, endCandidate: actions },
    ],
    candidates.length,
  );
  value.abilityLabels = [
    { ability: "dex", labelQuote: "Лов" },
    { ability: "wis", labelQuote: "Мдр" },
  ];
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const annotation = transported.response.candidates.find((entry) => entry.candidateIndex === saves)?.annotation;
  assert.ok(annotation && annotation.role === "header_field");
  assert.equal(annotation.field, "saving_throws");
});

test("description heading is transported as its own section block", () => {
  const source = ["Creature", "Описание", "Древнее чудовище из пустоты."].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSourceCandidates(source, sourceMap);
  const description = candidateIndexStartingWith(candidates, "Описание");
  const prose = candidateIndexStartingWith(candidates, "Древнее");
  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: 0, endCandidate: 0 },
      { classification: "description_heading", field: null, startCandidate: description, endCandidate: description },
      { classification: "section_content", field: null, startCandidate: prose, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );
  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const annotation = transported.response.candidates.find((entry) => entry.candidateIndex === description)?.annotation;
  assert.ok(annotation && annotation.role === "section_heading");
  assert.equal(annotation.section, "description");
});

test("hybrid introduced bullet ownership is independent of dense candidate distance", () => {
  const source = [
    "Breath Weapons (Recharge 5–6). The dragon uses one of the following breath weapons: • Antimagic Bomb. The dragon spits a globule of antimagic at a point within 60 feet which explodes in a 20-foot radius centered on that point. Each spell or magical effect in the area is dispelled as if affected by a dispel magic spell (+6 to dispel spells of 6th level or higher).",
    "• Force Breath. The dragon exhales pure disintegrating force in a 300-foot line that is 5 feet wide. Everything in that line must attempt a DC 22 Dexterity saving throw, taking 93 (17d10) force damage on a failure, or half as much on a success.",
    "Claw. Another feature.",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const breath = candidateIndexAtSourceText(candidates, source, "Breath Weapons");
  const anti = candidateIndexAtSourceText(candidates, source, "• Antimagic Bomb.");
  const force = candidateIndexAtSourceText(candidates, source, "• Force Breath.");
  const claw = candidateIndexAtSourceText(candidates, source, "Claw.");
  assert.ok(force - anti > 4, "fixture must exercise dense candidate spacing between proven bullet markers");

  const value = parsed(
    [
      { classification: "feature", field: null, startCandidate: breath, endCandidate: anti - 1 },
      { classification: "feature", field: null, startCandidate: anti, endCandidate: force - 1 },
      { classification: "feature", field: null, startCandidate: force, endCandidate: claw - 1 },
      { classification: "feature", field: null, startCandidate: claw, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const features = transported.debug.runs.filter((run) => run.classification === "feature");
  assert.deepEqual(
    features.map((run) => [run.startCandidate, run.endCandidate]),
    [
      [breath, claw - 1],
      [claw, candidates.length - 1],
    ],
  );
  assert.ok(transported.issues.some((issue) => issue.code === "candidate_source_proven_internal_list_closed"));
});

test("unknown section semantics are never invented or inherited across the boundary", () => {
  const source = "Creature Actions Bite. Text. Legendary Actions Tail. Text.";
  const sourceMap = createLosslessSourceMap(source);
  const base = createSourceCandidates(source, sourceMap);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichSinglelineCandidates(source, sourceMap, base),
    "singleline",
  );
  const name = candidateIndexAtSourceText(candidates, source, "Creature");
  const actions = candidateIndexAtSourceText(candidates, source, "Actions");
  const bite = candidateIndexAtSourceText(candidates, source, "Bite.");
  const legendary = candidateIndexAtSourceText(candidates, source, "Legendary Actions");
  const tail = candidateIndexAtSourceText(candidates, source, "Tail.");
  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: name, endCandidate: actions - 1 },
      { classification: "actions_heading", field: null, startCandidate: actions, endCandidate: actions },
      { classification: "feature", field: null, startCandidate: bite, endCandidate: legendary - 1 },
      { classification: "unknown_section_heading", field: null, startCandidate: legendary, endCandidate: legendary },
      { classification: "feature", field: null, startCandidate: tail, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const legendaryAnnotation = transported.response.candidates.find(
    (candidate) => candidate.candidateIndex === legendary,
  )?.annotation;
  const tailAnnotation = transported.response.candidates.find(
    (candidate) => candidate.candidateIndex === tail,
  )?.annotation;

  assert.equal(legendaryAnnotation, undefined);
  assert.equal(tailAnnotation, undefined);
  assert.ok(transported.issues.some((current) => current.code === "candidate_section_semantics_unresolved"));
});
test("multiline transport preserves proven body roles with null section semantics", () => {
  const source = "Creature\nActions\nBite. Text.";
  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSourceCandidates(source, sourceMap);
  const name = candidateIndexAtSourceText(candidates, source, "Creature");
  const actions = candidateIndexAtSourceText(candidates, source, "Actions");
  const bite = candidateIndexAtSourceText(candidates, source, "Bite.");
  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: name, endCandidate: name },
      { classification: "unknown_section_heading", field: null, startCandidate: actions, endCandidate: actions },
      { classification: "feature", field: null, startCandidate: bite, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    preserveUnknownSectionStructure: true,
  });
  const heading = transported.response.candidates.find((candidate) => candidate.candidateIndex === actions)?.annotation;
  const feature = transported.response.candidates.find((candidate) => candidate.candidateIndex === bite)?.annotation;

  assert.ok(heading);
  assert.equal(heading.role, "section_heading");
  assert.equal("section" in heading ? heading.section : undefined, null);
  assert.ok(feature);
  assert.equal(feature.role, "feature");
  assert.equal("section" in feature ? feature.section : undefined, null);
  assert.equal(
    transported.issues.some((current) => current.code === "candidate_section_semantics_unresolved"),
    false,
  );
});

test("text-identical subtitle ownership abstains while duplicate printed source stays unresolved", () => {
  const source = "Token Image: Rak Tulkhesh\nRak Tulkhesh\nArmor Class 10\nActions\nBite. Text.";
  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSourceCandidates(source, sourceMap);
  const firstName = candidateIndexAtSourceText(candidates, source, "Rak Tulkhesh");
  const secondNameOffset = source.indexOf("Rak Tulkhesh", source.indexOf("Rak Tulkhesh") + 1);
  const secondName = candidates.findIndex((candidate) => candidate.start === secondNameOffset);
  assert.notEqual(secondName, -1);
  const armor = candidateIndexAtSourceText(candidates, source, "Armor Class");
  const actions = candidateIndexAtSourceText(candidates, source, "Actions");
  const bite = candidateIndexAtSourceText(candidates, source, "Bite.");
  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: firstName, endCandidate: firstName },
      { classification: "size_type_alignment", field: null, startCandidate: secondName, endCandidate: secondName },
      { classification: "header_field", field: "armor_class", startCandidate: armor, endCandidate: armor },
      { classification: "actions_heading", field: null, startCandidate: actions, endCandidate: actions },
      { classification: "feature", field: null, startCandidate: bite, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  assert.equal(
    transported.response.candidates.some(
      (candidate) =>
        candidate.annotation.role === "header_field" && candidate.annotation.field === "size_type_alignment",
    ),
    false,
  );
  assert.ok(
    transported.debug.runs.some((run) => run.startCandidate === secondName && run.classification === "unclassified"),
  );
  assert.ok(transported.issues.some((current) => current.code === "candidate_duplicate_identity_subtitle_abstained"));
});

test("candidate transport deterministically carves a trailing creature classification out of an overlapping name span", () => {
  const source = [
    "Aspect of Tiamat",
    "Gargantuan Dragon (Chromatic), Chaotic Evil",
    "Armor Class 23 (natural armor)",
  ].join("\n");
  const sourceMap = createLosslessSourceMap(source);
  const candidates = createSourceCandidates(source, sourceMap);
  const classification = candidateIndexStartingWith(candidates, "Gargantuan Dragon");
  const armor = candidateIndexStartingWith(candidates, "Armor Class");
  const value = parsed(
    [
      { classification: "name", field: null, startCandidate: 0, endCandidate: classification },
      {
        classification: "size_type_alignment",
        field: null,
        startCandidate: classification,
        endCandidate: classification,
      },
      { classification: "header_field", field: "armor_class", startCandidate: armor, endCandidate: armor },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  assert.ok(transported.issues.some((current) => current.code === "candidate_identity_overlap_carved"));

  const nameAnnotation = transported.response.candidates.find((current) => current.candidateIndex === 0)?.annotation;
  assert.ok(nameAnnotation && nameAnnotation.role === "header_field" && nameAnnotation.field === "name");
  assert.equal(annotationSourceText(source, sourceMap, nameAnnotation), "Aspect of Tiamat");

  const classificationAnnotation = transported.response.candidates.find(
    (current) => current.candidateIndex === classification,
  )?.annotation;
  assert.ok(
    classificationAnnotation &&
      classificationAnnotation.role === "header_field" &&
      classificationAnnotation.field === "size_type_alignment",
  );
  assert.equal(
    annotationSourceText(source, sourceMap, classificationAnnotation),
    "Gargantuan Dragon (Chromatic), Chaotic Evil",
  );
});

test("introduced ordered list stays inside the parent feature even when PDF wrapping separates list markers", () => {
  const source = `Heartcleaver. On a critical hit, the target suffers one additional effect selected at random:
1. Curse of Brutality. The target must succeed on a save.
Wrapped continuation for the first result.
2. Crush Bones. The target must succeed on a save.
Another wrapped continuation.
3. Cleave Limb. The target loses a limb.
4. Bisect. The target dies.
Desecration Breath. Another feature.`;
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const heartcleaver = candidateIndexAtSourceText(candidates, source, "Heartcleaver.");
  const first = candidateIndexAtSourceText(candidates, source, "1. Curse of Brutality.");
  const second = candidateIndexAtSourceText(candidates, source, "2. Crush Bones.");
  const third = candidateIndexAtSourceText(candidates, source, "3. Cleave Limb.");
  const fourth = candidateIndexAtSourceText(candidates, source, "4. Bisect.");
  const desecration = candidateIndexAtSourceText(candidates, source, "Desecration Breath.");

  const value = parsed(
    [
      { classification: "feature", field: null, startCandidate: heartcleaver, endCandidate: first - 1 },
      { classification: "feature", field: null, startCandidate: first, endCandidate: second - 1 },
      { classification: "feature", field: null, startCandidate: second, endCandidate: third - 1 },
      { classification: "feature", field: null, startCandidate: third, endCandidate: fourth - 1 },
      { classification: "feature", field: null, startCandidate: fourth, endCandidate: desecration - 1 },
      { classification: "feature", field: null, startCandidate: desecration, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const features = transported.debug.runs.filter((run) => run.classification === "feature");
  assert.deepEqual(
    features.map((run) => [run.startCandidate, run.endCandidate]),
    [
      [heartcleaver, desecration - 1],
      [desecration, candidates.length - 1],
    ],
  );
  assert.ok(transported.issues.some((issue) => issue.code === "candidate_source_proven_internal_list_closed"));
});

test("introduced wrapped em-dash list stays inside the parent feature", () => {
  const source = `Random Effects. Choose one result:
— First effect. The first option begins here.
Wrapped continuation for the first option.
Still the same option.
— Second effect. The second option begins here.
Wrapped continuation for the second option.
Next Feature. Independent rule.`;
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const parent = candidateIndexAtSourceText(candidates, source, "Random Effects.");
  const first = candidateIndexAtSourceText(candidates, source, "— First effect.");
  const second = candidateIndexAtSourceText(candidates, source, "— Second effect.");
  const next = candidateIndexAtSourceText(candidates, source, "Next Feature.");
  const value = parsed(
    [
      { classification: "feature", field: null, startCandidate: parent, endCandidate: first - 1 },
      { classification: "feature", field: null, startCandidate: first, endCandidate: second - 1 },
      { classification: "feature", field: null, startCandidate: second, endCandidate: next - 1 },
      { classification: "feature", field: null, startCandidate: next, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const features = transported.debug.runs.filter((run) => run.classification === "feature");
  assert.deepEqual(
    features.map((run) => [run.startCandidate, run.endCandidate]),
    [
      [parent, next - 1],
      [next, candidates.length - 1],
    ],
  );
});

test("introduced ordered list absorbs a split final item title after a standalone marker coordinate", () => {
  const source = `Heartcleaver. On a critical hit, the target suffers one additional effect selected at random:\n1. Curse of Brutality. First result prose.\n2. Crush Bones. Second result prose.\n3. Cleave Limb. Third result prose.\n4. Bisect. Fourth result prose.\nDesecration Breath. Another feature.`;
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const heartcleaver = candidateIndexAtSourceText(candidates, source, "Heartcleaver.");
  const fourthMarker = candidateIndexAtSourceText(candidates, source, "4.");
  const bisect = candidateIndexAtSourceText(candidates, source, "Bisect.");
  const desecration = candidateIndexAtSourceText(candidates, source, "Desecration Breath.");
  assert.ok(fourthMarker < bisect);

  const value = parsed(
    [
      { classification: "feature", field: null, startCandidate: heartcleaver, endCandidate: fourthMarker },
      { classification: "feature", field: null, startCandidate: bisect, endCandidate: desecration - 1 },
      { classification: "feature", field: null, startCandidate: desecration, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value);
  const features = transported.debug.runs.filter((run) => run.classification === "feature");
  assert.deepEqual(
    features.map((run) => [run.startCandidate, run.endCandidate]),
    [
      [heartcleaver, desecration - 1],
      [desecration, candidates.length - 1],
    ],
  );
});

test("introduced ordered list re-closes final same-line item title after source-proven feature splitting", () => {
  const source = `Heartcleaver. On a critical hit, the target suffers one additional effect selected at random:
1. Curse of Brutality. First result prose.
2. Crush Bones. Second result prose.
3. Cleave Limb. Third result prose.
4. Bisect. Fourth result prose.
Desecration Breath. Another feature.`;
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const heartcleaver = candidateIndexAtSourceText(candidates, source, "Heartcleaver.");
  const fourthMarker = candidateIndexAtSourceText(candidates, source, "4.");
  const bisect = candidateIndexAtSourceText(candidates, source, "Bisect.");
  const desecration = candidateIndexAtSourceText(candidates, source, "Desecration Breath.");
  assert.ok(fourthMarker < bisect);

  // Mirror the real Baphomet failure: the model owns Heartcleaver through the
  // final marker, while deterministic named-rule splitting later separates
  // each list-item title (including Bisect) before list closure runs.
  const value = parsed(
    [
      { classification: "feature", field: null, startCandidate: heartcleaver, endCandidate: fourthMarker },
      { classification: "feature", field: null, startCandidate: bisect, endCandidate: desecration - 1 },
      { classification: "feature", field: null, startCandidate: desecration, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    enforceSourceProvenFeatureBoundaries: true,
  });
  const features = transported.debug.runs.filter((run) => run.classification === "feature");
  assert.deepEqual(
    features.map((run) => [run.startCandidate, run.endCandidate]),
    [
      [heartcleaver, desecration - 1],
      [desecration, candidates.length - 1],
    ],
  );
  assert.ok(transported.issues.some((issue) => issue.code === "candidate_feature_split_at_internal_named_start"));
  assert.ok(transported.issues.some((issue) => issue.code === "candidate_source_proven_internal_list_closed"));
});

test("final standalone list marker does not absorb a title on the next physical row", () => {
  const source = `Random Table. Choose one:
1. First result. Prose.
2. Second result. Prose.
3. Third result. Prose.
4.
Next Feature. Independent rule.`;
  const sourceMap = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    sourceMap,
    enrichGenericCandidates(source, sourceMap, createSourceCandidates(source, sourceMap)),
    "generic",
  );
  const parent = candidateIndexAtSourceText(candidates, source, "Random Table.");
  const fourthMarker = candidateIndexAtSourceText(candidates, source, "4.");
  const next = candidateIndexAtSourceText(candidates, source, "Next Feature.");
  const value = parsed(
    [
      { classification: "feature", field: null, startCandidate: parent, endCandidate: fourthMarker },
      { classification: "feature", field: null, startCandidate: next, endCandidate: candidates.length - 1 },
    ],
    candidates.length,
  );

  const transported = candidateResponseToDirectResponse(source, sourceMap, candidates, value, {
    enforceSourceProvenFeatureBoundaries: true,
  });
  const features = transported.debug.runs.filter((run) => run.classification === "feature");
  assert.deepEqual(
    features.map((run) => [run.startCandidate, run.endCandidate]),
    [
      [parent, fourthMarker],
      [next, candidates.length - 1],
    ],
  );
});
