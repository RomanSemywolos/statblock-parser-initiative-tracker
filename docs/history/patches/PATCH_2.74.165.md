# Patch 2.74.165 — measured inline Header request (diagnostics only)

## Scope

This patch builds the complete proposed inline-coordinate Header request beside the active legacy request and measures it. It does **not** send the inline request to the model and does not change parser authority, Header/BODY ownership, candidate generation, or deterministic verification.

## Added

- `INLINE_ESSENTIAL_FACTS_SYSTEM_PROMPT` and `createInlineEssentialFactsUserPrompt(...)`.
  - model-facing source is the reversible 2.74.164 coordinate overlay;
  - no duplicated `STRUCTURAL PROPOSALS` candidate preview list;
  - existing deterministic source-shape hints are retained for this comparison;
  - ability-label `q` is defined as an inline Cxxx coordinate, so the model never needs to reproduce source text.
- `createInlineEssentialFactsGenerationJsonSchema()`.
  - fixed-size schema;
  - `s`/`e` use the syntactic pattern `^C\\d{3,}$` instead of enumerating every candidate ID;
  - candidate existence/order remains a deterministic post-generation responsibility.
- Header diagnostics now report the complete alternative-request character budget:
  - `shadowRequestSystemPromptCharacters`
  - `shadowRequestUserPromptCharacters`
  - `shadowRequestJsonSchemaCharacters`
  - `shadowRequestTextCharacters`
  - candidate-ID occurrence counts
  - absolute character delta and reduction ratio versus the active request.

## Non-changes / migration guard

Production still sends the 2.74.164/2.74.163 legacy Header request: raw source + separate candidate transport + candidate-enum schema. Architecture regression tests explicitly assert that production requests contain no inline markers, do not use the INLINE system prompt, and still expose the legacy candidate enum.

No second Header LLM call was added. The alternative request is constructed locally for diagnostics only.

## Acceptance rule

2.74.162 remains the behavioral baseline. Existing successful cases must not regress. Known baseline failures (including the stochastic Cradle ability-label miss) may remain or improve but are not repaired in this migration patch.

## Validation

- `npm run typecheck`: PASS
- `npm run build`: PASS
- full compiled Node test suite: 577/577 PASS
