# M0 — frozen parser boundary

Version 2.17.0 freezes the current lossless sparse parser as the import core for the MVP.
The parser may continue to have internal diagnostics and regression tooling, but product
code must not depend on candidates, annotations, source maps, model responses or parser
reports.

## Public product boundary

Application/backend code imports from `src/index.ts` (compiled as `dist/index.js`).
At M0 the product parser still accepts a model name string; M3 will replace that temporary runtime detail with `ModelProvider` / `ModelProfile`.
The main entry point is:

```ts
parseForProduct(input): Promise<EditableStatblockDocument>
```

Internally it runs:

```text
raw text
  -> lossless source map
  -> sparse model transport
  -> reconciliation / quote anchoring
  -> lossless compiler / structured header
  -> compileToEditableStatblock
  -> EditableStatblockDocument
```

Only the final `EditableStatblockDocument` crosses the product boundary.

`analyzeStatblock`, `LosslessStatblockDocument`, candidates, annotations, parser report,
raw model output and timing diagnostics remain parser-internal / diagnostic APIs. The
legacy synchronous web harness is retained only for parser regression testing until the
React frontend replaces it.

## Editable product document

The product document intentionally does not preserve source coordinates or parser
provenance. It contains:

- ordered logical editable blocks;
- normalized visible text;
- semantic block role / section / header field where known;
- gameplay facts needed by later MVP layers.

Gameplay facts currently include name, AC, max HP, initiative modifier, six abilities,
six usable saving throws and proficiency bonus. Saving throws fall back to the ability
modifier when no printed save is available. Initiative uses a printed Initiative bonus
when present and otherwise falls back to Dexterity modifier.

The product document is the future canonical EN/UK editable representation. Parser
internals are disposable after a successful import.

## Explicit non-goals of M0

M0 does not implement:

- React frontend;
- IndexedDB persistence;
- async job queue;
- ModelProvider abstraction;
- encounter/combat state;
- editing/versioning UI;
- translation;
- synchronization.

Those layers consume the M0 product boundary rather than extending the parser document.

## Diagnostic harness

`npm run app` / `npm run dev:harness` still starts the old synchronous diagnostic UI.
It deliberately exposes parser report/candidate/raw-model data and is not the planned MVP
frontend. It is retained because it is useful for parser regression tests.
