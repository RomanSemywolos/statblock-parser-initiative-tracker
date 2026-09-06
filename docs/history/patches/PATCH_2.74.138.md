# Patch 2.74.138 — mixed quality restoration without ownership rollback

## Scope

This patch keeps the v2.74.135+ ownership-first architecture intact and makes only
local mixed BODY interface/transport corrections after corpus comparison against
v2.74.121 and v2.74.132.

## Findings

The quality regression had two concrete causes:

1. The fixed Header contract intentionally no longer owns rows such as Speed,
   Skills, defenses, Senses and Languages, so those rows now reach the mixed BODY
   parser. The BODY taxonomy had no correct answer for compact metadata, which
   pushed the model toward false `sh`/`f` classifications.
2. The v2.74.136/137 BODY prompt carried too much ownership-protocol explanation.
   Ownership is deterministic pipeline state and should not be a semantic burden
   on the small BODY model.

A separate audit also corrected a diagnostics misunderstanding: for Looming Harvest
v2.74.132 the actual BODY request was 5450 prompt-eval tokens. The previously quoted
2823 value belonged to the legacy header scan, not the BODY request. v2.74.137 BODY
was 6458 tokens: a real increase, but about 18.5%, not a doubling.

## Changes

- Added mixed BODY output code `m` -> internal `body_metadata`.
  - It means compact metadata/remainder that is BODY-owned but is neither a section
    heading nor a feature.
  - It is transported as neutral `section_content` with `section:null`.
  - It never becomes Header ownership.
- Replaced the long v2.74.137 ownership lecture with a compact BODY contract.
- BODY proposals contain only legal BODY coordinates.
- Missing Header-owned coordinates are represented only as `HEADER GAP` barriers.
- JSON schema still permits only BODY-eligible endpoint IDs.
- Deterministic hints crossing Header ownership remain filtered out.
- Added `protectedCandidateIndexes` to candidate transport. Every downstream
  deterministic continuation repair restores accepted Header coordinates as hard
  unclassified barriers before materialization, so transport cannot annex Header
  source after the model-level guard.
- Kept `enforceSourceProvenFeatureBoundaries:false` for ownership-first mixed. The
  v2.74.135 continuation regression test proves that globally re-enabling it can
  split a legitimate continuation paragraph whose first sentence looks title-like.
  This patch therefore does not trade one known regression for another.

## Prompt size

Using the exact Looming Harvest source from the v2.74.137 report and the same fixed
Header verifier result, the generated mixed BODY request shrank from 26,561 prompt
characters in v2.74.137 to 17,464 characters in v2.74.138. Actual Ollama token count
must be measured on the user's local qwen runtime, but the static request is now
smaller than the old v2.74.132 request in characters while retaining whole-source
context.

## Validation

- `tsc --noEmit -p tsconfig.json` — passed.
- Full compiled Node test suite — 528/528 passed.
- Added coverage that `m` parses to `body_metadata` and remains distinct from Header
  ownership / section headings.

## Non-changes

- No `bodyStart` was restored to mixed.
- Fixed Header ownership remains the closed essential contract.
- Multiline and singleline behavior were not redesigned.
- Auto Style was not touched.
