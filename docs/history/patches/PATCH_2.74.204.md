# 2.74.204 — singleline Header clean start, stage 1

Baseline: 2.74.202 accepted mixed baseline.

This release intentionally changes only the active **singleline Header transport and deterministic grounding**. The existing singleline starts-only BODY normalization remains unchanged so the first live A/B can isolate Header quality.

## Why this was rewritten

The retired singleline Header request exposed two overlapping coordinate channels to the model:

- sparse `SINGLELINE HEADER STRUCTURAL PROPOSALS`;
- dense `SINGLELINE HEADER EXACT ADDRESS COORDINATES`.

On real collapsed input qwen3:8b confused address coordinates with semantics (for example ability labels could be returned as Initiative/STA claims). This was not a safe foundation to tune further.

## New active singleline Header contract

The Header model receives the **raw collapsed source only**. It returns no candidate IDs and no numeric values.

Output has three semantic-anchor channels:

- `identity`: exact verbatim full source spans for `name` and `size_type_alignment`;
- `fieldLabels`: exact printed labels for AC, separately printed Initiative, HP, separately printed Saving Throws, CR and printed PB;
- `abilityLabels`: exact printed ability labels mapped to `str/dex/con/int/wis/cha`.

Example shape:

```json
{
  "identity": [
    { "k": "n", "q": "Aspect of Tiamat" },
    { "k": "sta", "q": "Gargantuan Dragon (Chromatic), Chaotic Evil" }
  ],
  "fieldLabels": [
    { "k": "ac", "q": "Armor Class" },
    { "k": "hp", "q": "Hit Points" },
    { "k": "sv", "q": "Saving Throws" },
    { "k": "cr", "q": "Challenge" },
    { "k": "pb", "q": "Proficiency Bonus" }
  ],
  "abilityLabels": [
    { "a": "str", "q": "STR" },
    { "a": "dex", "q": "DEX" },
    { "a": "con", "q": "CON" },
    { "a": "int", "q": "INT" },
    { "a": "wis", "q": "WIS" },
    { "a": "cha", "q": "CHA" }
  ]
}
```

## Deterministic authority

New `src/singlelineHeaderAnchors.ts` owns the conversion from semantic anchors to accepted Header evidence.

It deterministically:

1. grounds `name` at the first non-whitespace source position;
2. grounds STA only as the exact span adjacent to the grounded name;
3. grounds field/ability label quotes as exact source substrings;
4. proves AC/HP/Initiative/CR/PB compact numeric shape immediately after the semantic label;
5. completes only balanced parenthetical material belonging to that compact field;
6. proves a complete six-label repeated ability region and its numeric cells;
7. proves separately printed Saving Throws as repeated mapped ability-label + signed-bonus pairs;
8. extracts all actual numbers later through the established deterministic Header machinery;
9. rejects semantic claims whose local source shape is incompatible instead of creating ownership.

The model is therefore semantic authority only for *what the printed label/span means*. It is not authority for coordinates or values.

## 2024 compact-row support

The deterministic scalar proof supports forms such as:

- `AC 25`
- `Initiative +18 (28)`
- `HP 697 (34d20 + 340)`
- `CR 30 (XP 155,000; PB +9)`
- nested printed `PB +9` inside the CR parenthetical.

The six-ability proof also supports row cells containing score + modifier + printed save, e.g. `STR 30 +10 +10`.

## Pipeline isolation

For active `singleline`:

- `pipeline.ts` now detects routing before preparing Header candidates;
- no Header candidate lattice is constructed for the singleline Header call;
- Header prompt metrics report `candidateCount=0` and no `Cxxx` occurrences;
- accepted deterministic Header ownership still defines BODY as its exact complement;
- BODY still uses the existing reduced singleline lattice, starts-only LLM call, virtual multiline reconstruction and shared deterministic multiline parser.

Multiline and mixed Header requests are unchanged.

## Diagnostics

`essentialVerification.singlelineAnchors` records:

- parsed identity anchors;
- parsed field-label anchors;
- parsed ability-label anchors;
- deterministically grounded essential source regions.

Grounding failures are explicit warning issues and do not create Header ownership.

## Regression tests

Added `singlelineHeaderAnchors.test.ts` covering:

- localized RU identity/abilities/saves;
- 2024 Initiative and nested PB inside CR;
- rejection of a semantically wrong existing quote (`STR` claimed as Initiative);
- source-prefix/adjacency requirements for identity.

Architecture/prompt tests now assert that the active singleline Header request contains no candidate coordinates or old Structural/Exact Address sections.

## Acceptance-corpus dry check

Using the four unique collapsed sources from the supplied 2.74.202 report and deterministic synthetic semantic-anchor responses, the new grounder produced the intended Header regions for:

- Astral Dreadnought;
- Aspect of Tiamat;
- Demogorgon;
- Tarrasque.

The full pipeline then recovered expected name, STA, AC, HP, abilities, saves/embedded save column, CR, PB, and printed Initiative where present. This is a deterministic contract check only; **2.74.204 still requires a live qwen3:8b run before its Header prompt quality is accepted**.

## Explicitly unchanged

- mixed parser behavior from 2.74.202;
- multiline parser behavior;
- singleline BODY prompt/schema/lattice/normalization;
- BODY semantic authority rules;
- no `bodyStart`;
- no language dictionary in parser correctness;
- no deterministic semantic BODY splitting.
