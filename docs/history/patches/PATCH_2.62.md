# Patch 2.62.0 — Parser routing foundation

This patch starts the parser-architecture redesign after M14 localization was frozen.

## Added

- Deterministic `ParserRouter` over normalized source shape.
- Parser modes: `auto`, `multiline`, `singleline`, `generic`.
- Auto mode scores visible source structure without an LLM and selects the specialized structural prompt.
- Manual parser-mode override in product settings and the legacy parser harness.
- Multiline-specialized prompt: preserves already-good physical block boundaries and merges only visible continuations.
- Single-line-specialized prompt: explicitly recovers inline header/section/feature boundaries from collapsed text.
- Parser-routing decision and evidence are stored in parse diagnostics.
- Parse jobs persist the selected parser mode; old jobs migrate to `auto`.
- `parseForProduct()` accepts an optional parser mode.

## Scope

This is the routing foundation only. Multiline body parsing is still LLM-assisted in 2.62; the next parser milestone can replace that body stage with deterministic block assignment while retaining a small LLM header interpreter. D&D Beyond deterministic source adapters are also planned as a separate strategy.
