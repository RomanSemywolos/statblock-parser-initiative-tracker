# Hardcoded English audit — v2.74.108

## Scope

Production-code audit of language-specific vocabulary in the parser/product pipeline after v2.74.107. The goal is to distinguish:

- legitimate presentation / translation vocabulary;
- explicit optional language-profile enrichment;
- inactive legacy code;
- language vocabulary that can change structure or visibility.

## Findings

### 1. Active Auto Style English section whitelist — removed

`editableDocument.ts` contained `AUTO_STYLE_EXACT_SECTION_HEADINGS` with English section names (`traits`, `actions`, etc.). It was active and could promote only those exact English paragraph labels to headings.

This was a real architecture regression: presentation rescue depended on vocabulary rather than source shape.

v2.74.108 removes the whitelist. Paragraph-to-heading rescue now requires only:

1. the current paragraph has standalone heading shape (`surfaceStandaloneHeadingRow`);
2. the following visible paragraph begins with a source-shaped named rule;
3. the promoted node receives `headingKind: null`.

No section identity is inferred. Tests prove equivalent behavior for `TRAITS`, `Действия`, `ДІЇ`, `SPECIAL POWERS`, and `ΩМЕГА РОЗДІЛ`, and also prove that wording alone is insufficient.

### 2. `sectionStructure.ts` English section dictionary — legacy / non-production

The only non-test importer is `legacyCandidateReconciler.ts`, which is explicitly the legacy reconciliation engine. The active candidate transport does not call `sectionStructure.ts`.

Therefore this dictionary does not explain current parser behavior. It should be removed/quarantined with the legacy engine during later cleanup, but changing it is not required for current production correctness.

### 3. `headerLexicon.ts` — active explicit English profile enrichment

This module is active and intentionally owns English printed header aliases. It is used in four relevant ways:

- `candidateLattice.ts` -> `createEnglishCandidateStructuralEvidence`: positive coordinate/boundary evidence;
- `candidateTransport.ts` -> `classifyDeterministicHeaderField`: semantic fallback after verifier/model evidence;
- `annotationCompiler.ts` -> `findDeterministicHeaderStarts`: splitting coarse English header spans;
- `editableDocument.ts`: presentation styling of known printed English header labels.

This is not the same violation as the removed section whitelist because the module is explicitly a language-profile layer and does not control source visibility. However, there is one real parity limitation: for multiple compact header fields printed on one short physical line, English profile anchors can create an internal coordinate that an unknown/localized language may not receive. Thus English profile evidence is currently additive not only in confidence, but occasionally in addressability.

No v2.74.108 production change is made here because fixing that safely belongs to the candidate-lattice contract, not Auto Style. Recommended follow-up: guarantee a bounded language-neutral inline header coordinate lattice first, then let language profiles only strengthen/classify already-existing coordinates. At that point `prepareCandidateLattice` should accept a generic profile interface rather than instantiate English evidence directly.

### 4. Other English strings

The following are legitimate and should remain:

- canonical product/UI labels (`Armor Class`, `Hit Points`, `Challenge Rating`, etc.);
- translation glossary/UI labels;
- multilingual examples inside LLM prompts;
- tests and fixtures.

These do not determine source ownership or visibility.

## Invariant after v2.74.108

Auto Style section-heading rescue is vocabulary-free and presentation-only. A change of printed section wording with identical source shape/context must not change whether the row is visually promoted. Semantic section identity remains owned by the semantic parser/model, not Auto Style.
