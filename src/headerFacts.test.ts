import test from "node:test";
import assert from "node:assert/strict";

import { reconstructBlocks } from "./annotationCompiler.js";
import { compileToEditableStatblock } from "./editableCompiler.js";
import { enrichStructuredHeader, proficiencyBonusForChallenge } from "./headerFacts.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import { prepareCandidateLattice } from "./candidateLattice.js";
import { analyzeStatblock } from "./pipeline.js";

function response(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    header: [],
    abilityRows: [],
    savingThrows: [],
    sectionHeadings: [],
    sectionRules: [],
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryActions: [],
    mythicActions: [],
    lairActions: [],
    sectionContent: [],
    supplementaryQuotes: [],
    ...overrides,
  };
}

function modelResult(parsedContent: unknown) {
  return { rawContent: JSON.stringify(parsedContent), parsedContent, elapsedSeconds: 0.1 };
}

function fixtureCaller(source: string, parsedContent: unknown) {
  const headerCandidates = prepareCandidateLattice(source, createLosslessSourceMap(source), "generic").headerCandidates;
  const id = (index: number) => `C${String(index).padStart(3, "0")}`;
  const spanForQuote = (quote: string) => {
    const startOffset = source.indexOf(quote);
    assert.notEqual(startOffset, -1, `Missing fixture quote ${quote}`);
    const startIndex = headerCandidates.findIndex((candidate) => candidate.start === startOffset);
    assert.notEqual(startIndex, -1, `Missing fixture candidate for ${quote}`);
    let endIndex = startIndex;
    const endOffset = startOffset + quote.length;
    while (endIndex + 1 < headerCandidates.length && headerCandidates[endIndex + 1]!.start < endOffset) endIndex += 1;
    return { s: id(startIndex), e: id(endIndex) };
  };
  const fieldCode: Record<string, string> = {
    armor_class: "ac",
    initiative: "init",
    hit_points: "hp",
    speed: "spd",
    ability_scores: "ab",
    saving_throws: "sv",
    skills: "sk",
    damage_vulnerabilities: "dv",
    damage_resistances: "dr",
    damage_immunities: "di",
    condition_immunities: "ci",
    senses: "se",
    languages: "lang",
    habitat: "hab",
    challenge: "cr",
    experience: "xp",
    proficiency_bonus: "pb",
    other_header: "oth",
  };
  const semanticFixture = () => {
    if (typeof parsedContent === "object" && parsedContent !== null && "blocks" in parsedContent) {
      const direct = parsedContent as { blocks?: unknown; abilityLabels?: unknown; savingThrows?: unknown };
      // The fixed Header request uses a strict response envelope. Verifier-only
      // fixture fields must never leak into the model response.
      return {
        blocks: direct.blocks ?? [],
        abilityLabels: direct.abilityLabels ?? [],
        savingThrows: direct.savingThrows ?? [],
      };
    }
    const value = parsedContent as {
      header?: Array<{ field: string; sourceQuote: string }>;
      abilityRows?: Array<{ ability: string; labelQuote: string; sourceQuote?: string }>;
    };
    const blocks = (value.header ?? []).map((entry) =>
      entry.field === "name"
        ? { k: "n", ...spanForQuote(entry.sourceQuote) }
        : entry.field === "size_type_alignment"
          ? { k: "sta", ...spanForQuote(entry.sourceQuote) }
          : {
              k: "h",
              ...spanForQuote(entry.sourceQuote),
              ...(fieldCode[entry.field] ? { f: fieldCode[entry.field] } : {}),
            },
    );
    let abilityLabels = (value.abilityRows ?? [])
      .filter(
        (entry) =>
          entry.sourceQuote === undefined ||
          (source.includes(entry.sourceQuote) && entry.sourceQuote.includes(entry.labelQuote)),
      )
      .map((entry) => ({ a: entry.ability, q: entry.labelQuote }));
    if (abilityLabels.length === 0) {
      const abilityBlock = (value.header ?? []).find((entry) => entry.field === "ability_scores")?.sourceQuote ?? "";
      const canonical = [
        ["str", "STR"],
        ["dex", "DEX"],
        ["con", "CON"],
        ["int", "INT"],
        ["wis", "WIS"],
        ["cha", "CHA"],
      ] as const;
      if (canonical.every(([, label]) => new RegExp(`\\b${label}\\b`, "iu").test(abilityBlock))) {
        abilityLabels = canonical.map(([a, q]) => ({ a, q }));
      }
    }
    const savingThrows = (
      (parsedContent as { savingThrows?: Array<{ ability: string; bonus: number; sourceQuote: string }> })
        .savingThrows ?? []
    ).map((entry) => ({ ability: entry.ability, bonus: entry.bonus, evidenceQuote: entry.sourceQuote }));
    return { blocks, abilityLabels, savingThrows };
  };

  const verifierCandidates = headerCandidates;

  const remapEssentialFacts = (facts: unknown): unknown[] => {
    if (!Array.isArray(facts)) return [];
    return facts.flatMap((raw) => {
      if (typeof raw !== "object" || raw === null) return [];
      const fact = raw as { k?: unknown; s?: unknown; e?: unknown };
      if (typeof fact.k !== "string" || typeof fact.s !== "string" || typeof fact.e !== "string") return [];
      const parseId = (value: string) => /^C(\d+)$/u.exec(value);
      const sm = parseId(fact.s);
      const em = parseId(fact.e);
      if (sm === null || em === null) return [];
      const sourceStart = headerCandidates[Number(sm[1])]?.start;
      const sourceEnd = headerCandidates[Number(em[1]) + 1]?.start ?? source.length;
      if (sourceStart === undefined || !(sourceStart < sourceEnd)) return [];
      const startIndex = verifierCandidates.findIndex((candidate) => candidate.start === sourceStart);
      if (startIndex < 0) return [];
      let endIndex = startIndex;
      while (endIndex + 1 < verifierCandidates.length && verifierCandidates[endIndex + 1]!.start < sourceEnd)
        endIndex += 1;
      return [{ k: fact.k, s: id(startIndex), e: id(endIndex) }];
    });
  };

  return async (request: { systemPrompt: string; userPrompt: string }) => {
    if (/CARD-FACT VERIFICATION MODE/u.test(request.systemPrompt)) {
      const suppliedEssentialFacts = (parsedContent as { essentialFacts?: unknown }).essentialFacts;
      let essentialFacts = remapEssentialFacts(suppliedEssentialFacts);
      if (
        essentialFacts.length === 0 &&
        typeof parsedContent === "object" &&
        parsedContent !== null &&
        "header" in parsedContent
      ) {
        const kindCode: Record<string, string> = {
          name: "n",
          size_type_alignment: "sta",
          armor_class: "ac",
          initiative: "init",
          hit_points: "hp",
          ability_scores: "ab",
          saving_throws: "sv",
          challenge: "cr",
          proficiency_bonus: "pb",
        };
        essentialFacts = (
          (parsedContent as { header?: Array<{ field: string; sourceQuote: string }> }).header ?? []
        ).flatMap((entry) =>
          kindCode[entry.field] === undefined ? [] : [{ k: kindCode[entry.field], ...spanForQuote(entry.sourceQuote) }],
        );
      }
      if (
        essentialFacts.length === 0 &&
        typeof parsedContent === "object" &&
        parsedContent !== null &&
        "blocks" in parsedContent
      ) {
        const direct = parsedContent as { blocks?: Array<{ k?: string; f?: string; s?: string; e?: string }> };
        const fieldKind: Record<string, string> = {
          ac: "ac",
          init: "init",
          hp: "hp",
          ab: "ab",
          sv: "sv",
          cr: "cr",
          pb: "pb",
        };
        essentialFacts = (direct.blocks ?? []).flatMap((block) => {
          if (typeof block.s !== "string" || typeof block.e !== "string") return [];
          if (block.k === "n") return [{ k: "n", s: block.s, e: block.e }];
          if (block.k === "sta") return [{ k: "sta", s: block.s, e: block.e }];
          if (block.k === "h" && typeof block.f === "string" && fieldKind[block.f] !== undefined) {
            return [{ k: fieldKind[block.f], s: block.s, e: block.e }];
          }
          return [];
        });
      }
      return modelResult({ essentialFacts, abilityLabels: semanticFixture().abilityLabels ?? [] });
    }
    if (/BODY-ONLY/u.test(request.systemPrompt)) return modelResult({ blocks: [], abilityLabels: [] });
    return modelResult(parsedContent);
  };
}

function routedCandidates(source: string) {
  const sourceMap = createLosslessSourceMap(source);
  return prepareCandidateLattice(source, sourceMap, "generic").headerCandidates;
}

function exactSourceSpanCandidateIds(
  _source: string,
  candidates: ReturnType<typeof routedCandidates>,
  start: number,
  end: number,
): { s: string; e: string } {
  const startIndex = candidates.findIndex((candidate) => candidate.start === start);
  assert.notEqual(startIndex, -1, `Missing candidate at source offset ${start}`);
  let endIndex = startIndex;
  while (endIndex + 1 < candidates.length && candidates[endIndex + 1]!.start < end) endIndex += 1;
  const id = (index: number): string => `C${String(index).padStart(3, "0")}`;
  return { s: id(startIndex), e: id(endIndex) };
}

test("deterministically structures all six ability scores and Save-column values from a grounded table", async () => {
  const table = [
    "Mod\tSave",
    "STR\t23\t+6\t+6",
    "DEX\t12\t+1\t+6",
    "CON\t21\t+5\t+5",
    "Mod\tSave",
    "INT\t18\t+4\t+4",
    "WIS\t15\t+2\t+7",
    "CHA\t18\t+4\t+4",
  ].join("\n");
  const source = `Adult Copper Dragon\n${table}\nActions\nRend. Text.`;
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Adult Copper Dragon" },
      { field: "ability_scores", sourceQuote: table },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: ["Rend. Text."],
  });

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });

  assert.deepEqual(
    Object.values(result.document.structuredHeader.abilities).map((ability) => ability?.score),
    [23, 12, 21, 18, 15, 18],
  );
  assert.deepEqual(
    result.document.structuredHeader.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["str", 6],
      ["dex", 6],
      ["con", 5],
      ["int", 4],
      ["wis", 7],
      ["cha", 4],
    ],
  );
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("deterministically structures a canonical horizontal ability table", async () => {
  const table = "STR DEX CON INT WIS CHA\n23 (+6) 30 (+10) 27 (+8) 23 (+6) 18 (+4) 27 (+8)";
  const source = `Creature\n${table}\nActions\nAttack. Text.`;
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Creature" },
      { field: "ability_scores", sourceQuote: table },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: [{ nameQuote: "Attack.", sourceQuote: "Attack. Text." }],
  });

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });

  assert.deepEqual(
    Object.values(result.document.structuredHeader.abilities).map((ability) => ability?.score),
    [23, 30, 27, 23, 18, 27],
  );
  assert.deepEqual(
    Object.values(result.document.structuredHeader.abilities).map((ability) => ability?.modifier),
    [6, 10, 8, 6, 4, 8],
  );
  assert.ok(
    Object.values(result.document.structuredHeader.abilities).every(
      (ability) => ability?.provenance === "model_evidence",
    ),
  );
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("uses grounded model labels only to map localized horizontal abilities while deriving all numbers from source", async () => {
  const table = "СИЛ ЛОВ ТЕЛ ІНТ МДР ХАР\n23 (+6) 30 (+10) 27 (+8) 23 (+6) 18 (+4) 27 (+8)";
  const source = `Істота\n${table}\nДії\nУкус. Текст.`;
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Істота" },
      { field: "ability_scores", sourceQuote: table },
    ],
    abilityRows: [
      { ability: "str", labelQuote: "СИЛ", sourceQuote: table },
      { ability: "dex", labelQuote: "ЛОВ", sourceQuote: table },
      { ability: "con", labelQuote: "ТЕЛ", sourceQuote: table },
      { ability: "int", labelQuote: "ІНТ", sourceQuote: table },
      { ability: "wis", labelQuote: "МДР", sourceQuote: table },
      { ability: "cha", labelQuote: "ХАР", sourceQuote: table },
    ],
  });

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });

  assert.deepEqual(
    Object.values(result.document.structuredHeader.abilities).map((ability) => ability?.score),
    [23, 30, 27, 23, 18, 27],
  );
  assert.equal(result.document.structuredHeader.abilities.dex?.modifier, 10);
  assert.ok(
    Object.values(result.document.structuredHeader.abilities).every(
      (ability) => ability?.provenance === "model_evidence",
    ),
  );
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("accepts localized model-read ability labels and save facts only through exact grounded header evidence", async () => {
  const abilities = "СИЛ 24 (+7)\nЛОВ 16 (+3)\nТЕЛ 23 (+6)\nІНТ 15 (+2)\nМДР 22 (+6)\nХАР 17 (+3)";
  const saves = "Ряткидки ЛОВ +10, ТЕЛ +13, МДР +13";
  const source = `Араста\n${abilities}\n${saves}\nДії\nУкус. Текст.`;
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Араста" },
      { field: "ability_scores", sourceQuote: abilities },
      { field: "saving_throws", sourceQuote: saves },
    ],
    abilityRows: [
      { ability: "str", labelQuote: "СИЛ", sourceQuote: abilities },
      { ability: "dex", labelQuote: "ЛОВ", sourceQuote: abilities },
      { ability: "con", labelQuote: "ТЕЛ", sourceQuote: abilities },
      { ability: "int", labelQuote: "ІНТ", sourceQuote: abilities },
      { ability: "wis", labelQuote: "МДР", sourceQuote: abilities },
      { ability: "cha", labelQuote: "ХАР", sourceQuote: abilities },
    ],
    savingThrows: [
      { ability: "dex", bonus: 10, sourceQuote: "ЛОВ +10," },
      { ability: "con", bonus: 13, sourceQuote: "ТЕЛ +13," },
      { ability: "wis", bonus: 13, sourceQuote: "МДР +13" },
    ],
  });

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });

  assert.equal(result.document.structuredHeader.abilities.str?.modifier, 7);
  assert.equal(result.document.structuredHeader.abilities.dex?.provenance, "model_evidence");
  assert.deepEqual(
    result.document.structuredHeader.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["dex", 10],
      ["con", 13],
      ["wis", 13],
    ],
  );
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("incomplete verified ability evidence abstains safely even when the model also proposes an ungrounded label", async () => {
  const source = "Solar\nSTR 26 (+8)\nActions\nAttack. Text.";
  // Express the negative grounding case in the CURRENT candidate contract.
  // DEX is absent from the source, so production must reject this model label
  // while still recovering the canonical STR row deterministically.
  const parsed = {
    blocks: [
      { k: "n", s: "C000", e: "C000" },
      { k: "h", f: "ab", s: "C001", e: "C001" },
    ],
    abilityLabels: [{ a: "dex", q: "DEX" }],
    savingThrows: [],
  };

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });

  assert.ok(Object.values(result.document.structuredHeader.abilities).every((ability) => ability === null));
  assert.ok(result.document.issues.some((current) => current.code === "unproven_verified_ability_region"));
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("refuses a horizontal ability table when a printed modifier contradicts its score", async () => {
  const table = "STR DEX CON INT WIS CHA\n23 (+7) 30 (+10) 27 (+8) 23 (+6) 18 (+4) 27 (+8)";
  const source = `Creature\n${table}\nActions\nAttack. Text.`;
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Creature" },
      { field: "ability_scores", sourceQuote: table },
    ],
  });

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });

  assert.ok(Object.values(result.document.structuredHeader.abilities).every((ability) => ability === null));
  assert.ok(result.document.issues.some((current) => current.code === "unproven_verified_ability_region"));
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("derives the mandatory proficiency bonus from every safely grounded numeric CR", async () => {
  assert.deepEqual(
    [
      [0, 2],
      [0.5, 2],
      [4, 2],
      [5, 3],
      [21, 7],
      [30, 9],
    ].map(([cr]) => proficiencyBonusForChallenge(cr)),
    [2, 2, 2, 3, 7, 9],
  );

  const source = "Solar\nCR 21 (XP 33,000)\nActions\nAttack. Text.";
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Solar" },
      { field: "challenge", sourceQuote: "CR 21 (XP 33,000)" },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: [{ nameQuote: "Attack.", sourceQuote: "Attack. Text." }],
  });
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });

  assert.deepEqual(result.document.structuredHeader.proficiencyBonus, {
    value: 7,
    printed: false,
    challengeRating: 21,
    provenance: "deterministic_cr_derivation",
    source: result.document.structuredHeader.proficiencyBonus?.source,
  });
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("preserves an explicitly printed PB and reports a CR mismatch instead of silently rewriting it", async () => {
  const source = "Creature\nCR 21 (XP 33,000; PB +6)\nActions\nAttack. Text.";
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Creature" },
      { field: "challenge", sourceQuote: "CR 21 (XP 33,000; PB +6)" },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: [{ nameQuote: "Attack.", sourceQuote: "Attack. Text." }],
  });
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });

  assert.equal(result.document.structuredHeader.proficiencyBonus?.value, 6);
  assert.equal(result.document.structuredHeader.proficiencyBonus?.printed, true);
  assert.ok(result.document.issues.some((current) => current.code === "proficiency_bonus_cr_mismatch"));
});

test("recovers six vertical canonical abilities from separate generic header spans", async () => {
  const abilityLines = ["STR 21 (+5)", "DEX 17 (+3)", "CON 19 (+4)", "INT 14 (+2)", "WIS 16 (+3)", "CHA 18 (+4)"];
  const source = [
    "Hythonia",
    "Large Monstrosity, Lawful Evil",
    "Armor Class 17",
    "Hit Points 199",
    "Speed 40 ft.",
    ...abilityLines,
    "Saving Throws STR +11, CON +10, CHA +10",
    "Actions",
    "Claws. Text.",
  ].join("\n");
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Hythonia" },
      { field: "size_type_alignment", sourceQuote: "Large Monstrosity, Lawful Evil" },
      { field: "armor_class", sourceQuote: "Armor Class 17" },
      { field: "hit_points", sourceQuote: "Hit Points 199" },
      { field: "speed", sourceQuote: "Speed 40 ft." },
      { field: "ability_scores", sourceQuote: abilityLines.join("\n") },
      { field: "saving_throws", sourceQuote: "Saving Throws STR +11, CON +10, CHA +10" },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: [{ nameQuote: "Claws.", sourceQuote: "Claws. Text." }],
  });
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });
  assert.deepEqual(
    Object.values(result.document.structuredHeader.abilities).map((ability) => ability?.score),
    [21, 17, 19, 14, 16, 18],
  );
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("recovers interleaved PDF ability labels that trail the previous numeric cell", async () => {
  const source = [
    "Adult Gold Dragon",
    "Huge dragon, lawful good",
    "Armor Class 19",
    "Hit Points 256",
    "Speed 40 ft.",
    "STR",
    "27 (+8)DEX",
    "14 (+2)CON",
    "25 (+7)INT",
    "16 (+3)WIS",
    "15 (+2)CHA",
    "24 (+7)",
    "Saving Throws Dex +8, Con +13, Wis +8, Cha +13",
    "Actions",
    "Bite. Text.",
  ].join("\n");
  const parsed = {
    blocks: [
      { k: "n", s: "C000", e: "C000" },
      { k: "sta", s: "C001", e: "C001" },
      { k: "h", s: "C002", e: "C002" },
      { k: "h", s: "C003", e: "C003" },
      { k: "h", s: "C004", e: "C004" },
      { k: "h", s: "C005", e: "C005" },
      { k: "h", s: "C006", e: "C006" },
      { k: "h", s: "C007", e: "C007" },
      { k: "h", s: "C008", e: "C008" },
      { k: "h", s: "C009", e: "C009" },
      { k: "h", s: "C010", e: "C010" },
      { k: "h", s: "C011", e: "C011" },
      { k: "h", s: "C012", e: "C012" },
    ],
    abilityLabels: [
      { a: "str", q: "STR" },
      { a: "dex", q: "DEX" },
      { a: "con", q: "CON" },
      { a: "int", q: "INT" },
      { a: "wis", q: "WIS" },
      { a: "cha", q: "CHA" },
    ],
    essentialFacts: [{ k: "ab", s: "C005", e: "C011" }],
  };
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });
  assert.deepEqual(
    Object.values(result.document.structuredHeader.abilities).map((ability) => ability?.score),
    [27, 14, 25, 16, 15, 24],
  );
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("recovers score modifier and save columns without depending on their printed column names", async () => {
  const source = [
    "Arch-hag",
    "Large Fey, Neutral Evil",
    "AC 20",
    "HP 333",
    "Speed 40 ft.",
    "mod",
    "save",
    "mod",
    "save",
    "mod",
    "save",
    "Str 24",
    "+7",
    "+7",
    "Dex",
    "15",
    "+2",
    "+9",
    "Con",
    "23",
    "+6",
    "+6",
    "Int",
    "19",
    "+4",
    "+4",
    "Wis",
    "19",
    "+4",
    "+11",
    "Cha",
    "25",
    "+7",
    "+7",
    "Skills Deception +14",
    "CR 21 (PB +7)",
    "Traits",
    "Magic Resistance. Text.",
  ].join("\n");
  const blocks = [
    { k: "n", s: "C000", e: "C000" },
    { k: "sta", s: "C001", e: "C001" },
    { k: "h", s: "C002", e: "C002" },
    { k: "h", s: "C003", e: "C003" },
    { k: "h", s: "C004", e: "C004" },
    ...Array.from({ length: 29 }, (_, i) => ({
      k: "h",
      s: `C${String(i + 5).padStart(3, "0")}`,
      e: `C${String(i + 5).padStart(3, "0")}`,
    })),
    { k: "h", s: "C034", e: "C034" },
    { k: "h", s: "C035", e: "C035" },
  ];
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, {
      blocks,
      abilityLabels: [
        { a: "str", q: "Str" },
        { a: "dex", q: "Dex" },
        { a: "con", q: "Con" },
        { a: "int", q: "Int" },
        { a: "wis", q: "Wis" },
        { a: "cha", q: "Cha" },
      ],
      essentialFacts: [
        { k: "ab", s: "C011", e: "C033" },
        { k: "sv", s: "C011", e: "C033" },
      ],
    }),
  });
  assert.deepEqual(
    Object.values(result.document.structuredHeader.abilities).map((ability) => ability?.score),
    [24, 15, 23, 19, 19, 25],
  );
  assert.deepEqual(
    result.document.structuredHeader.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["str", 7],
      ["dex", 9],
      ["con", 6],
      ["int", 4],
      ["wis", 11],
      ["cha", 7],
    ],
  );
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("uses exact model label semantics for localized fragmented abilities while all numeric facts remain deterministic", async () => {
  const source = [
    "Істота",
    "Велика фея",
    "Захист 20",
    "Життя 200",
    "Рух 30",
    "СИЛ 24",
    "+7",
    "ЛОВ",
    "15",
    "+2",
    "ТЕЛ",
    "23",
    "+6",
    "ІНТ",
    "19",
    "+4",
    "МДР",
    "19",
    "+4",
    "ХАР",
    "25",
    "+7",
    "Дії",
    "Укус. Текст.",
  ].join("\n");
  const blocks = [
    { k: "n", s: "C000", e: "C000" },
    { k: "sta", s: "C001", e: "C001" },
    ...Array.from({ length: 20 }, (_, i) => ({
      k: "h",
      s: `C${String(i + 2).padStart(3, "0")}`,
      e: `C${String(i + 2).padStart(3, "0")}`,
    })),
  ];
  const abilityLabels = [
    { a: "str", q: "СИЛ" },
    { a: "dex", q: "ЛОВ" },
    { a: "con", q: "ТЕЛ" },
    { a: "int", q: "ІНТ" },
    { a: "wis", q: "МДР" },
    { a: "cha", q: "ХАР" },
  ];
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, {
      blocks,
      abilityLabels,
      essentialFacts: [{ k: "ab", s: "C005", e: "C021" }],
    }),
  });
  assert.deepEqual(
    Object.values(result.document.structuredHeader.abilities).map((ability) => ability?.score),
    [24, 15, 23, 19, 19, 25],
  );
  assert.ok(
    Object.values(result.document.structuredHeader.abilities).every(
      (ability) => ability?.provenance === "model_evidence",
    ),
  );
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("promotes proven fragmented ability mechanics without swallowing repeated column-label noise", async () => {
  const source = [
    "Arch-hag",
    "Large Fey, Neutral Evil",
    "AC 20",
    "Initiative +16 (26)",
    "HP 333",
    "Speed 40 ft.",
    "mod",
    "save",
    "mod",
    "save",
    "mod",
    "save",
    "Str",
    "24",
    "+7",
    "+7",
    "Dex",
    "15",
    "+2",
    "+9",
    "Con",
    "23",
    "+6",
    "+6",
    "Int",
    "19",
    "+4",
    "+4",
    "Wis",
    "19",
    "+4",
    "+11",
    "Cha",
    "25",
    "+7",
    "+7",
    "Skills Deception +14",
    "CR 21 (PB +7)",
    "Traits",
    "Magic Resistance. Text.",
  ].join("\n");
  const candidates = routedCandidates(source);
  const lines = source.split("\n");
  const blocks: Array<{ k: string; s: string; e: string; v?: string }> = [];
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const span = exactSourceSpanCandidateIds(source, candidates, offset, offset + line.length);
    if (index === 0) blocks.push({ k: "n", ...span });
    else if (index === 1) blocks.push({ k: "sta", ...span });
    else if (line === "Traits") blocks.push({ k: "sh", ...span, v: "t" });
    else if (line === "Magic Resistance. Text.") blocks.push({ k: "f", ...span });
    else blocks.push({ k: "h", ...span });
    offset += line.length + 1;
  }
  const abilityStart = source.indexOf("Str\n24");
  const abilityEnd = source.indexOf("\nSkills Deception");
  const abilitySpan = exactSourceSpanCandidateIds(source, candidates, abilityStart, abilityEnd);
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, {
      blocks,
      abilityLabels: [
        { a: "str", q: "Str" },
        { a: "dex", q: "Dex" },
        { a: "con", q: "Con" },
        { a: "int", q: "Int" },
        { a: "wis", q: "Wis" },
        { a: "cha", q: "Cha" },
      ],
      essentialFacts: [
        { k: "ab", s: abilitySpan.s, e: abilitySpan.e },
        { k: "sv", s: abilitySpan.s, e: abilitySpan.e },
      ],
    }),
  });
  const abilityAnnotations = result.document.annotations.filter(
    (annotation) => annotation.role === "header_field" && annotation.field === "ability_scores",
  );
  assert.equal(abilityAnnotations.length, 1);
  assert.match(abilityAnnotations[0].text, /^Str\n24/u);
  assert.match(abilityAnnotations[0].text, /Cha\n25\n\+7\n\+7$/u);
  // Lossless means user-visible, not merely reconstructable inside parser internals.
  // Column-label noise may be useful evidence for ability recovery, but unless it
  // is proven semantically redundant it must survive into the editable document.
  const editable = compileToEditableStatblock(result.document, { parserStructure: "multiline" });
  assert.equal(editable.body.filter((node) => node.text.trim() === "mod").length, 3);
  assert.equal(editable.body.filter((node) => node.text.trim() === "save").length, 3);
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("recovers and promotes a one-line alternating ability table through the final CHA value", async () => {
  const row = "STR 16 (+3) DEX 21 (+5) CON 18 (+4) INT 18 (+4) WIS 20 (+5) CHA 14 (+2)";
  const source = [
    "Githzerai Anarch",
    "Medium Humanoid (Gith), Lawful Neutral",
    "Armor Class 20",
    "Hit Points 144",
    "Speed 30 ft.",
    row,
    "Saving Throws STR +8, DEX +10, INT +9, WIS +10",
    "Traits",
    "Psychic Defense. Text.",
  ].join("\n");
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Githzerai Anarch" },
      { field: "size_type_alignment", sourceQuote: "Medium Humanoid (Gith), Lawful Neutral" },
      { field: "armor_class", sourceQuote: "Armor Class 20" },
      { field: "hit_points", sourceQuote: "Hit Points 144" },
      { field: "speed", sourceQuote: "Speed 30 ft." },
      { field: "ability_scores", sourceQuote: row },
      { field: "saving_throws", sourceQuote: "Saving Throws STR +8, DEX +10, INT +9, WIS +10" },
    ],
    sectionHeadings: [{ section: "traits", sourceQuote: "Traits" }],
    traits: [{ nameQuote: "Psychic Defense.", sourceQuote: "Psychic Defense. Text." }],
  });
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });
  assert.deepEqual(
    Object.values(result.document.structuredHeader.abilities).map((ability) => ability?.score),
    [16, 21, 18, 18, 20, 14],
  );
  assert.equal(result.document.annotations.filter((annotation) => annotation.field === "ability_scores").length, 1);
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("recovers a canonical vertical ability block directly from header source when model ownership leaves it unclassified", async () => {
  const abilityBlock = [
    "STR",
    "30 (+10)",
    "DEX",
    "14 (+2)",
    "CON",
    "30 (+10)",
    "INT",
    "21 (+5)",
    "WIS",
    "20 (+5)",
    "CHA",
    "26 (+8)",
  ].join("\n");
  const source = [
    "Aspect of Tiamat",
    "Gargantuan Dragon (Chromatic), Chaotic Evil",
    "Armor Class 23 (natural armor)",
    "Hit Points 574 (28d20 + 280)",
    "Speed 60 ft., Burrow 60 ft., Fly 120 ft., Swim 60 ft.",
    abilityBlock,
    "Saving Throws DEX +11, CON +19, WIS +14, CHA +17",
    "Skills Intimidation +26, Perception +23",
    "Actions",
    "Multiattack. Text.",
  ].join("\n");
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Aspect of Tiamat" },
      { field: "size_type_alignment", sourceQuote: "Gargantuan Dragon (Chromatic), Chaotic Evil" },
      { field: "armor_class", sourceQuote: "Armor Class 23 (natural armor)" },
      { field: "hit_points", sourceQuote: "Hit Points 574 (28d20 + 280)" },
      { field: "speed", sourceQuote: "Speed 60 ft., Burrow 60 ft., Fly 120 ft., Swim 60 ft." },
      { field: "ability_scores", sourceQuote: abilityBlock },
      { field: "saving_throws", sourceQuote: "Saving Throws DEX +11, CON +19, WIS +14, CHA +17" },
      { field: "skills", sourceQuote: "Skills Intimidation +26, Perception +23" },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: [{ nameQuote: "Multiattack.", sourceQuote: "Multiattack. Text." }],
  });

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });

  assert.deepEqual(
    Object.values(result.document.structuredHeader.abilities).map((ability) => ability?.score),
    [30, 14, 30, 21, 20, 26],
  );
  assert.deepEqual(
    Object.values(result.document.structuredHeader.abilities).map((ability) => ability?.modifier),
    [10, 2, 10, 5, 5, 8],
  );
  const abilityAnnotations = result.document.annotations.filter((annotation) => annotation.field === "ability_scores");
  assert.equal(abilityAnnotations.length, 1);
  assert.equal(abilityAnnotations[0]?.text, abilityBlock);
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("source-only vertical ability recovery abstains on an inconsistent printed modifier", async () => {
  const abilityBlock = [
    "STR",
    "30 (+10)",
    "DEX",
    "14 (+2)",
    "CON",
    "30 (+10)",
    "INT",
    "21 (+4)",
    "WIS",
    "20 (+5)",
    "CHA",
    "26 (+8)",
  ].join("\n");
  const source = ["Creature", "Armor Class 20", abilityBlock, "Actions", "Attack. Text."].join("\n");
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Creature" },
      { field: "armor_class", sourceQuote: "Armor Class 20" },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: [{ nameQuote: "Attack.", sourceQuote: "Attack. Text." }],
  });
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });
  assert.equal(
    result.document.annotations.some((annotation) => annotation.field === "ability_scores"),
    false,
  );
  assert.ok(Object.values(result.document.structuredHeader.abilities).every((ability) => ability === null));
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("fixed header contract is boundary-independent and carves Tiamat classification out of the verified name", async () => {
  const source = [
    "Aspect of Tiamat",
    "Gargantuan Dragon (Chromatic), Chaotic Evil",
    "Armor Class 23 (natural armor)",
    "Hit Points 574 (28d20 + 280)",
    "Speed 60 ft., Fly 120 ft.",
    "STR",
    "30 (+10)",
    "DEX",
    "14 (+2)",
    "CON",
    "30 (+10)",
    "INT",
    "21 (+5)",
    "WIS",
    "20 (+5)",
    "CHA",
    "26 (+8)",
    "Saving Throws DEX +11, CON +19, WIS +14, CHA +17",
    "Skills Intimidation +26, Perception +23",
    "Challenge 30 (155,000 XP)",
    "Proficiency Bonus +9",
    "Traits",
    "Legendary Resistance (5/Day). Text.",
  ].join("\n");
  const candidates = routedCandidates(source);
  const span = (text: string) =>
    exactSourceSpanCandidateIds(source, candidates, source.indexOf(text), source.indexOf(text) + text.length);
  const name = span("Aspect of Tiamat");
  const type = span("Gargantuan Dragon (Chromatic), Chaotic Evil");
  const ac = span("Armor Class 23 (natural armor)");
  const hp = span("Hit Points 574 (28d20 + 280)");
  const speed = span("Speed 60 ft., Fly 120 ft.");
  const abilityStart = source.indexOf("STR\n30 (+10)");
  const abilityEnd = source.indexOf("\nSaving Throws");
  const abilities = exactSourceSpanCandidateIds(source, candidates, abilityStart, abilityEnd);
  const savesText = "Saving Throws DEX +11, CON +19, WIS +14, CHA +17";
  const saves = span(savesText);
  const challenge = span("Challenge 30 (155,000 XP)");
  const pb = span("Proficiency Bonus +9");

  const parsed = {
    blocks: [
      // Deliberately reproduce the known model defect: name swallows the type row.
      { k: "n", s: name.s, e: type.e, f: "none" },
      { k: "sta", s: type.s, e: type.e, f: "none" },
      { k: "h", s: ac.s, e: ac.e, f: "ac" },
      { k: "h", s: hp.s, e: hp.e, f: "hp" },
      { k: "h", s: speed.s, e: speed.e, f: "spd" },
      { k: "h", s: abilities.s, e: abilities.e, f: "ab" },
    ],
    abilityLabels: [
      { a: "str", q: "STR" },
      { a: "dex", q: "DEX" },
      { a: "con", q: "CON" },
      { a: "int", q: "INT" },
      { a: "wis", q: "WIS" },
      { a: "cha", q: "CHA" },
    ],
    savingThrows: [],
    essentialFacts: [
      // The verifier repeats the same bad overlap; deterministic evidence reconciliation must carve it too.
      { k: "n", s: name.s, e: type.e },
      { k: "sta", s: type.s, e: type.e },
      { k: "ac", s: ac.s, e: ac.e },
      { k: "hp", s: hp.s, e: hp.e },
      { k: "ab", s: abilities.s, e: abilities.e },
      { k: "sv", s: saves.s, e: saves.e },
      { k: "cr", s: challenge.s, e: challenge.e },
      { k: "pb", s: pb.s, e: pb.e },
    ],
  };

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });
  const fixed = result.document.structuredHeader;
  assert.equal(fixed.name?.text, "Aspect of Tiamat");
  assert.equal(fixed.sizeTypeAlignment?.text, "Gargantuan Dragon (Chromatic), Chaotic Evil");
  assert.equal(fixed.armorClass?.value, 23);
  assert.equal(fixed.hitPoints?.value, 574);
  assert.equal(fixed.initiative, null);
  assert.deepEqual(
    Object.values(fixed.abilities).map((ability) => ability?.score),
    [30, 14, 30, 21, 20, 26],
  );
  assert.deepEqual(
    fixed.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["dex", 11],
      ["con", 19],
      ["wis", 14],
      ["cha", 17],
    ],
  );
  assert.equal(fixed.challenge?.value, 30);
  assert.equal(fixed.proficiencyBonus?.value, 9);
  assert.equal(fixed.proficiencyBonus?.printed, true);
  assert.equal(fixed.savingThrowEvidence?.evidence, savesText);

  const editable = compileToEditableStatblock(result.document, { parserStructure: "multiline" });
  assert.equal(editable.facts.name, "Aspect of Tiamat");
  assert.equal(editable.header.subtitle?.text, "*Gargantuan Dragon (Chromatic), Chaotic Evil*");
  assert.equal(editable.facts.armorClass, 23);
  assert.equal(editable.facts.hitPointMaximum, 574);
  assert.deepEqual(editable.facts.initiative, { modifier: 2, provenance: "dex_modifier" });
  assert.deepEqual(
    editable.header.secondaryRows.map((row) => row.field),
    ["challenge", "proficiency_bonus"],
  );
  assert.equal(
    editable.body.some((node) => node.text.replace(/\*/gu, "").includes("Speed 60 ft.")),
    true,
  );
  assert.equal(
    editable.body.some((node) => node.text.replace(/\*/gu, "").includes("Skills Intimidation")),
    true,
  );
  // Verified ability/save source moves into the product Evidence panel and must not be duplicated in BODY.
  assert.equal(
    editable.body.some((node) => node.text.replace(/\*/gu, "").includes("Saving Throws DEX +11")),
    false,
  );
  assert.equal(
    editable.header.evidence?.some((item) => item.text.includes("Saving Throws DEX +11")),
    true,
  );
  assert.equal(
    editable.body.some((node) => node.text.replace(/\*/gu, "").includes("Challenge 30")),
    false,
  );
  assert.equal(
    editable.header.evidence?.some((item) => item.fields.includes("challenge") && item.text.includes("Challenge 30")),
    true,
  );
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("fixed header recovers a Rak-Tulkhesh vertical ability/save table across an early body boundary", async () => {
  const source = [
    "Rak Tulkhesh",
    "Huge Fiend, Neutral Evil",
    "AC 23 (natural armor; 25 versus ranged attacks)",
    "Initiative +4 (14)",
    "HP 478 (33d12 + 264)",
    "Speed 40 ft., Climb 40 ft., Fly 80 ft.",
    "mod",
    "save",
    "mod",
    "save",
    "mod",
    "save",
    "Str",
    "29",
    "+9",
    "+17",
    "Dex",
    "19",
    "+4",
    "+4",
    "Con",
    "27",
    "+8",
    "+16",
    "Int",
    "21",
    "+5",
    "+5",
    "Wis",
    "22",
    "+6",
    "+14",
    "Cha",
    "26",
    "+8",
    "+16",
    "Skills Athletics +17, Intimidation +16, Perception +14",
    "CR 28 (XP 120 000; PB +8)",
    "Traits",
    "Deadly Critical. Text.",
  ].join("\n");
  const candidates = routedCandidates(source);
  const span = (text: string) =>
    exactSourceSpanCandidateIds(source, candidates, source.indexOf(text), source.indexOf(text) + text.length);
  const name = span("Rak Tulkhesh");
  const type = span("Huge Fiend, Neutral Evil");
  const ac = span("AC 23 (natural armor; 25 versus ranged attacks)");
  const init = span("Initiative +4 (14)");
  const hp = span("HP 478 (33d12 + 264)");
  const speed = span("Speed 40 ft., Climb 40 ft., Fly 80 ft.");
  const abilityStart = source.indexOf("mod\nsave\nmod\nsave\nmod\nsave");
  const abilityEnd = source.indexOf("\nSkills Athletics");
  const abilities = exactSourceSpanCandidateIds(source, candidates, abilityStart, abilityEnd);
  const cr = span("CR 28 (XP 120 000; PB +8)");

  const parsed = {
    blocks: [
      { k: "n", s: name.s, e: name.e, f: "none" },
      { k: "sta", s: type.s, e: type.e, f: "none" },
      { k: "h", s: ac.s, e: ac.e, f: "ac" },
      { k: "h", s: init.s, e: init.e, f: "init" },
      { k: "h", s: hp.s, e: hp.e, f: "hp" },
      { k: "h", s: speed.s, e: speed.e, f: "spd" },
    ],
    abilityLabels: [
      { a: "str", q: "Str" },
      { a: "dex", q: "Dex" },
      { a: "con", q: "Con" },
      { a: "int", q: "Int" },
      { a: "wis", q: "Wis" },
      { a: "cha", q: "Cha" },
    ],
    savingThrows: [],
    essentialFacts: [
      { k: "n", s: name.s, e: name.e },
      { k: "sta", s: type.s, e: type.e },
      { k: "ac", s: ac.s, e: ac.e },
      { k: "init", s: init.s, e: init.e },
      { k: "hp", s: hp.s, e: hp.e },
      { k: "ab", s: abilities.s, e: abilities.e },
      { k: "sv", s: abilities.s, e: abilities.e },
      { k: "cr", s: cr.s, e: cr.e },
      { k: "pb", s: cr.s, e: cr.e },
    ],
  };

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });
  const fixed = result.document.structuredHeader;
  assert.equal(fixed.name?.text, "Rak Tulkhesh");
  assert.equal(fixed.sizeTypeAlignment?.text, "Huge Fiend, Neutral Evil");
  assert.equal(fixed.armorClass?.value, 23);
  assert.equal(fixed.initiative?.value, 4);
  assert.equal(fixed.hitPoints?.value, 478);
  assert.deepEqual(
    Object.values(fixed.abilities).map((ability) => ability?.score),
    [29, 19, 27, 21, 22, 26],
  );
  assert.deepEqual(
    Object.values(fixed.abilities).map((ability) => ability?.printedSave),
    [17, 4, 16, 5, 14, 16],
  );
  assert.deepEqual(
    fixed.savingThrows.map((save) => [save.ability, save.bonus]),
    [
      ["str", 17],
      ["dex", 4],
      ["con", 16],
      ["int", 5],
      ["wis", 14],
      ["cha", 16],
    ],
  );
  assert.equal(fixed.challenge?.value, 28);
  assert.equal(fixed.proficiencyBonus?.value, 8);
  assert.equal(fixed.abilityEvidence?.evidence, source.slice(abilityStart, abilityEnd));

  const editable = compileToEditableStatblock(result.document, { parserStructure: "multiline" });
  assert.deepEqual(editable.facts.initiative, { modifier: 4, provenance: "printed" });
  assert.equal(editable.facts.savingThrows.cha, 16);
  const tableEvidence = editable.header.evidence?.find((item) => item.fields.includes("ability_scores"));
  assert.deepEqual(tableEvidence?.fields, ["ability_scores", "saving_throws"]);
  assert.equal(tableEvidence?.text, source.slice(abilityStart, abilityEnd));
  assert.equal(
    editable.body.some((node) =>
      ["mod", "save", "Str", "Dex", "Con", "Int", "Wis", "Cha"].includes(node.text.replace(/\*/gu, "")),
    ),
    false,
  );
  assert.equal(
    editable.body.some((node) => node.text.replace(/\*/gu, "").includes("Skills Athletics")),
    true,
  );
  assert.equal(
    editable.body.some((node) => node.text.replace(/\*/gu, "").includes("CR 28")),
    false,
  );
  assert.equal(
    editable.header.evidence?.some((item) => item.fields.includes("challenge") && item.text.includes("CR 28")),
    true,
  );
  assert.equal(reconstructBlocks(result.document.blocks), source);
});

test("rejects an unverified standalone PB semantic proposal that is really a saving-throws row", async () => {
  const source = [
    "Balor",
    "Saving Throws Str +14, Con +12, Wis +9, Cha +12",
    "Challenge 19 (22,000 XP)",
    "Actions",
    "Attack. Text.",
  ].join("\n");
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Balor" },
      { field: "proficiency_bonus", sourceQuote: "Saving Throws Str +14, Con +12, Wis +9, Cha +12" },
      { field: "challenge", sourceQuote: "Challenge 19 (22,000 XP)" },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: [{ nameQuote: "Attack.", sourceQuote: "Attack. Text." }],
  });

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });

  assert.equal(result.document.structuredHeader.proficiencyBonus?.value, 6);
  assert.equal(result.document.structuredHeader.proficiencyBonus?.printed, false);
  assert.equal(result.document.structuredHeader.proficiencyBonus?.provenance, "deterministic_cr_derivation");
  assert.equal(result.document.integrity.reconstructsRawSource, true);
});

test("rejects a structurally impossible verifier PB claim instead of trusting verifier semantics", async () => {
  const source = [
    "Balor",
    "Saving Throws Str +14, Con +12, Wis +9, Cha +12",
    "Challenge 19 (22,000 XP)",
    "Actions",
    "Attack. Text.",
  ].join("\n");
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Balor" },
      { field: "proficiency_bonus", sourceQuote: "Saving Throws Str +14, Con +12, Wis +9, Cha +12" },
      { field: "challenge", sourceQuote: "Challenge 19 (22,000 XP)" },
    ],
    essentialFacts: [
      {
        k: "pb",
        ...exactSourceSpanCandidateIds(
          source,
          routedCandidates(source),
          source.indexOf("Saving Throws"),
          source.indexOf("\nChallenge"),
        ),
      },
      {
        k: "cr",
        ...exactSourceSpanCandidateIds(
          source,
          routedCandidates(source),
          source.indexOf("Challenge 19"),
          source.indexOf("\nActions"),
        ),
      },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: [{ nameQuote: "Attack.", sourceQuote: "Attack. Text." }],
  });

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });

  assert.equal(result.document.structuredHeader.proficiencyBonus?.value, 6);
  assert.equal(result.document.structuredHeader.proficiencyBonus?.printed, false);
  assert.equal(result.document.structuredHeader.proficiencyBonus?.provenance, "deterministic_cr_derivation");
  assert.ok(result.document.issues.some((current) => current.code === "unproven_verified_proficiency_bonus"));
});

test("rejects a verifier PB claim grounded in body mechanics and falls back to CR", async () => {
  const source = [
    "UTTERANCE",
    "Challenge 12 (8,400 XP)",
    "Traits",
    "Spellcasting. Its spellcasting ability is Charisma (spell save DC 17, +9 to hit with spell attacks).",
  ].join("\n");
  const candidates = routedCandidates(source);
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "UTTERANCE" },
      { field: "challenge", sourceQuote: "Challenge 12 (8,400 XP)" },
    ],
    essentialFacts: [
      {
        k: "cr",
        ...exactSourceSpanCandidateIds(source, candidates, source.indexOf("Challenge 12"), source.indexOf("\nTraits")),
      },
      { k: "pb", ...exactSourceSpanCandidateIds(source, candidates, source.indexOf("Spellcasting."), source.length) },
    ],
    sectionHeadings: [{ section: "traits", sourceQuote: "Traits" }],
    traits: [
      {
        nameQuote: "Spellcasting.",
        sourceQuote:
          "Spellcasting. Its spellcasting ability is Charisma (spell save DC 17, +9 to hit with spell attacks).",
      },
    ],
  });

  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });

  assert.equal(result.document.structuredHeader.proficiencyBonus?.value, 4);
  assert.equal(result.document.structuredHeader.proficiencyBonus?.printed, false);
  assert.ok(result.document.issues.some((current) => current.code === "unproven_verified_proficiency_bonus"));
});

test("preserves a structurally valid printed PB even when it disagrees with CR and the verifier omitted PB", async () => {
  const source = "Creature\nChallenge 12 (8,400 XP)\nProficiency Bonus +5\nActions\nAttack. Text.";
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Creature" },
      { field: "challenge", sourceQuote: "Challenge 12 (8,400 XP)" },
      { field: "proficiency_bonus", sourceQuote: "Proficiency Bonus +5" },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: [{ nameQuote: "Attack.", sourceQuote: "Attack. Text." }],
  });
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });
  const challengeStart = source.indexOf("Challenge 12");
  const challengeEnd = challengeStart + "Challenge 12 (8,400 XP)".length;

  const enriched = enrichStructuredHeader(result.document, {
    abilityRows: [],
    abilityLabels: [],
    savingThrows: [],
    essentialRegions: [{ kind: "challenge", start: challengeStart, end: challengeEnd }],
    issues: [],
  });

  assert.equal(enriched.structuredHeader.proficiencyBonus?.value, 5);
  assert.equal(enriched.structuredHeader.proficiencyBonus?.printed, true);
  assert.equal(enriched.structuredHeader.proficiencyBonus?.provenance, "deterministic_header_parse");
  assert.ok(enriched.issues.some((current) => current.code === "proficiency_bonus_cr_mismatch"));

  const editable = compileToEditableStatblock(enriched, { parserStructure: "multiline" });
  const pbEvidence = editable.header.evidence?.find((item) => item.fields.includes("proficiency_bonus"));
  assert.equal(pbEvidence?.text, "Proficiency Bonus +5");
  assert.equal(
    editable.body.some((node) => node.text.replace(/\*/gu, "").includes("Proficiency Bonus +5")),
    false,
  );
});

test("independently verified CR remains authoritative for PB derivation despite a conflicting semantic challenge annotation", async () => {
  const source = "Creature\nChallenge 12 (8,400 XP)\nActions\nAttack. Text 99.";
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Creature" },
      { field: "challenge", sourceQuote: "Challenge 12 (8,400 XP)" },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: [{ nameQuote: "Attack.", sourceQuote: "Attack. Text 99." }],
  });
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });
  const challenge = result.document.structuredHeader.challenge;
  assert.ok(challenge);
  const attackStart = source.indexOf("Attack. Text 99.");
  result.document.annotations.push({
    id: "bad-challenge-body-ownership",
    candidateIndex: 999,
    provenance: "model_span",
    role: "header_field",
    field: "challenge",
    section: null,
    source: {
      startUnitId: "unit-0",
      endUnitId: "unit-0",
      start: attackStart,
      end: source.length,
    },
    text: "Attack. Text 99.",
  });

  const enriched = enrichStructuredHeader(result.document, {
    abilityRows: [],
    abilityLabels: [],
    savingThrows: [],
    essentialRegions: [{ kind: "challenge", start: challenge.source.start, end: challenge.source.end }],
    issues: [],
  });

  assert.equal(enriched.structuredHeader.challenge?.value, 12);
  assert.equal(enriched.structuredHeader.proficiencyBonus?.value, 4);
  assert.equal(enriched.structuredHeader.proficiencyBonus?.printed, false);
});

test("compact evidence boundary completion is generic and preserves genuinely unclosed source unchanged", async () => {
  const source =
    "Creature\nHit Points 100 (12d10 + 36)\nChallenge 5 (1,800 XP\nProficiency Bonus +3\nActions\nAttack. Text.";
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Creature" },
      { field: "hit_points", sourceQuote: "Hit Points 100 (12d10 + 36)" },
      { field: "challenge", sourceQuote: "Challenge 5 (1,800 XP" },
      { field: "proficiency_bonus", sourceQuote: "Proficiency Bonus +3" },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: [{ nameQuote: "Attack.", sourceQuote: "Attack. Text." }],
  });
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });
  const hpStart = source.indexOf("Hit Points 100");
  const hpTruncatedEnd = source.indexOf(" + 36)");
  const challengeStart = source.indexOf("Challenge 5");
  const challengeEnd = source.indexOf("\nProficiency Bonus");
  const pbStart = source.indexOf("Proficiency Bonus +3");
  const pbEnd = pbStart + "Proficiency Bonus +3".length;

  const enriched = enrichStructuredHeader(result.document, {
    abilityRows: [],
    abilityLabels: [],
    savingThrows: [],
    essentialRegions: [
      { kind: "hit_points", start: hpStart, end: hpTruncatedEnd },
      { kind: "challenge", start: challengeStart, end: challengeEnd },
      { kind: "proficiency_bonus", start: pbStart, end: pbEnd },
    ],
    issues: [],
  });

  assert.equal(enriched.structuredHeader.hitPoints?.source.evidence, "Hit Points 100 (12d10 + 36)");
  assert.equal(enriched.structuredHeader.challenge?.source.evidence, "Challenge 5 (1,800 XP");
  assert.equal(enriched.structuredHeader.challenge?.value, 5);
  assert.equal(enriched.structuredHeader.proficiencyBonus?.value, 3);
});

test("verified CR evidence deterministically completes a truncated trailing parenthetical before the next essential field", async () => {
  const source = "Creature\nChallenge 26 (90,000 XP)\nProficiency Bonus +8\nActions\nAttack. Text.";
  const parsed = response({
    header: [
      { field: "name", sourceQuote: "Creature" },
      { field: "challenge", sourceQuote: "Challenge 26 (90,000 XP)" },
      { field: "proficiency_bonus", sourceQuote: "Proficiency Bonus +8" },
    ],
    sectionHeadings: [{ section: "actions", sourceQuote: "Actions" }],
    actions: [{ nameQuote: "Attack.", sourceQuote: "Attack. Text." }],
  });
  const result = await analyzeStatblock({
    rawSource: source,
    sourceMap: createLosslessSourceMap(source),
    model: "test-model",
    callModel: fixtureCaller(source, parsed),
  });
  const challengeStart = source.indexOf("Challenge 26");
  const truncatedChallengeEnd = source.indexOf(" XP)");
  const pbStart = source.indexOf("Proficiency Bonus +8");
  const pbEnd = pbStart + "Proficiency Bonus +8".length;

  const enriched = enrichStructuredHeader(result.document, {
    abilityRows: [],
    abilityLabels: [],
    savingThrows: [],
    essentialRegions: [
      { kind: "challenge", start: challengeStart, end: truncatedChallengeEnd },
      { kind: "proficiency_bonus", start: pbStart, end: pbEnd },
    ],
    issues: [],
  });

  assert.equal(enriched.structuredHeader.challenge?.source.evidence, "Challenge 26 (90,000 XP)");
  assert.equal(enriched.structuredHeader.challenge?.source.end, source.indexOf("\nProficiency Bonus"));
  assert.equal(enriched.structuredHeader.proficiencyBonus?.value, 8);
});
