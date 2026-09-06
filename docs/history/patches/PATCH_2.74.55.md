# Patch 2.74.55 — restore specialized multiline parser

## What was wrong

The v2.74.46 architectural audit accidentally replaced the intended specialized multiline parser with the generic full-source structural LLM pass. That made clean multiline imports much slower and made body ownership depend on the model even though trusted physical-line geometry was already available.

## Restored contract

Multiline mode is specialized again:

1. Detect the multiline body boundary deterministically.
2. Send only the header prefix to the structural LLM.
3. Parse the body deterministically from trusted physical-line/source geometry.
4. Merge grounded header ownership with deterministic body ownership.
5. Preserve every non-empty physical source row for presentation; blank rows remain intentionally removed; no synthetic line breaks are invented.
6. Auto Style remains a downstream editable/presentation operation.

The independent essential-fact verification call is also limited to the multiline header prefix.

## Later safety work retained

This is not a rollback to the whole 2.74.45 tree. Current lossless source maps, candidate transport, semantic header field codes, multilingual ability-label grounding, compiler/editor behavior, source-preservation invariants, and later presentation fixes remain in place.

The restored header-only generation schema retains optional semantic `f` codes for grounded header spans, so the LLM can still identify localized header semantics without authoring or resizing source text.

Source-proven internal hierarchy is respected by the deterministic body: a candidate already proven `internal` (for example an introduced bullet/list sequence) cannot become a peer feature merely because its line begins with title-like text.

## Failure behavior

If the multiline header model call fails, deterministic body ownership is still preserved and unresolved header source remains visible/unclassified.

## Validation in this environment

- temporary TypeScript no-check emit: passed;
- restored `multilineDeterministic.test`: 8/8 passed;
- full dependency-backed `npm run typecheck` / `npm test` cannot be claimed here because the sandbox does not contain the project's installed Node dependencies (`@types/node`, `zod`, `undici`).
