# Patch 2.63.0 — Multiline body without LLM segmentation

## Goal

Make the clean multiline path stop asking the language model to rediscover body boundaries that normalization has already preserved.

## Changes

- Added `multilineDeterministic.ts`.
- Multiline routing now builds a deterministic body plan from normalized candidate geometry.
- The body boundary is selected from isolated standard section headings or the first strong named feature after a sufficiently proven header prefix.
- Standard section headings are assigned deterministically.
- Named multiline entries become deterministic `feature` spans.
- Wrapped/continuation paragraphs stay inside the preceding feature until the next proven boundary.
- Introductory prose immediately after a section heading becomes `section_rules`.
- Statblocks without an explicit `Traits` heading use `traits` as the initial body section.
- Added a dedicated multiline header-only LLM prompt and generation schema. In multiline mode the structural LLM sees only the header prefix and can return only name, size/type/alignment, generic header spans, or abstention.
- The independent critical-fact verifier is also restricted to the same header prefix in multiline mode.
- If the header-only LLM call fails, the deterministic body is still compiled and preserved; only unresolved header material remains unclassified.
- Parser diagnostics now record the detected header/body boundary and number of deterministic body runs.

## Tests

- Added deterministic multiline body-plan regression coverage.
- Added an end-to-end multiline pipeline test asserting that body prose is absent from the LLM requests and section/features are produced deterministically.
- The dependency-free routing/body tests pass in the current sandbox.
- Targeted TypeScript compilation for production files passes.
- The end-to-end pipeline test could not execute in this sandbox because installed runtime dependencies (notably `zod`) are absent; it is included for the normal project environment.
