# 2.74.139 — mixed BODY quality restoration after ownership migration

## What the 2.74.138 corpus showed

2.74.138 fixed one real problem: compact non-Header metadata could be emitted as BODY-owned `m` instead of being forced into false headings. However, the shortened mixed BODY prompt removed structural distinctions that the small qwen3:8b model had relied on in the stable pre-migration mixed parser. The result was not a uniform quality gain: some metadata improved, while real BODY structure regressed. In particular, the model sometimes extended `sh` over an entire section, overlapped that heading span with later `f` spans, split continuation prose into peer features, or omitted feature candidates.

The other remaining mismatch was contextual: 2.74.138 still sent the complete raw statblock to the BODY model even though Header-owned candidates were unavailable in the BODY coordinate space. That made the model read text it could not legally classify and forced it to reconcile a full-source narrative with a sparse candidate list.

## Changes

- Restored the mature mixed BODY structural contract from the stable parser:
  - `sh` is only the printed heading text, not the section it introduces;
  - `f` includes all mechanics, labelled clauses, sub-results and continuation paragraphs;
  - adjacent independently named rules stay separate;
  - `r`, `sc`, `sup`, `u` retain their established narrow meanings;
  - continuation strength is evidence against splitting;
  - restored the richer abstract examples for adjacent features, section intro prose, nested mechanics and spell-frequency continuation.
- Retained the new `m` role for compact BODY-owned metadata, with an explicit rule that wrapped continuations of one metadata field belong to the same `m` block.
- Replaced full raw-source context in the mixed BODY request with a deterministic `BODY SOURCE VIEW` made only from BODY-owned source intervals. Removed Header intervals are represented as explicit `HEADER GAP: DO NOT CROSS` barriers. Original candidate IDs remain unchanged.
- BODY JSON schema still permits only BODY-eligible candidate IDs.
- Header ownership remains exact and deterministic; no `bodyStart` ownership boundary was restored.
- Added regression assertions that mixed BODY requests do not contain accepted Header source text and that the mature structural distinctions remain in the model contract.

## Architecture

Normal mixed remains exactly:

`whole source -> fixed Header locator -> deterministic verification -> exact Header ownership -> BODY-only source view + original BODY coordinates -> one BODY LLM -> deterministic transport`

The BODY source view is a presentation for the model, not a new source representation. Lossless compilation continues to use the immutable original source and original coordinates.

## Verification

- `tsc --noEmit -p tsconfig.json`: pass
- compiled Node test suite: 528/528 pass
