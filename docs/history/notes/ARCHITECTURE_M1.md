# Architecture M1 — product-domain foundation

M1 extends the frozen M0 parser boundary without changing parser behavior.

## Boundary

```text
raw source
  -> parser internals
  -> LosslessStatblockDocument
  -> compileToEditableStatblock()
  -> EditableStatblockDocument
  -> SavedStatblock / VersionedDocument
```

Parser internals remain import-time implementation details. Product state uses only the product-owned types exported from `src/index.ts`.

## Product-owned types

`EditableStatblockDocument` no longer exposes parser-domain section/header/ability types in its public shape. Product equivalents live in `productModel.ts`.

`SavedStatblock` is the first persistent product aggregate. It contains language versions, card configuration, parser-version metadata, and timestamps. It deliberately does not contain raw source, candidates, annotations, source maps, reports, or model responses.

## Version semantics

Each language version has three snapshots:

- `working`: autosaved editing state shown by the UI;
- `saved`: last explicit user checkpoint;
- `backup`: exactly one previous explicit checkpoint.

Operations are pure and clone documents so one snapshot cannot mutate another accidentally.

- edit/autosave -> replace `working`;
- explicit save -> `backup = saved`, `saved = working`;
- revert -> `working = saved`;
- restore backup -> `working = backup`; user may inspect/edit before explicitly saving it.

English is required. Ukrainian is optional and intentionally modeled as an independent future `VersionedDocument`.

## Card configuration

M1 stores only durable statblock-level card preferences. Default visible semantic information is name, AC and all saves. HP and initiative are encounter-runtime fields and therefore are not persisted here as ordinary card checkboxes. Arbitrary future card rows are referenced by stable editable block IDs through `customBlockIds`.

## Deliberately not in M1

- IndexedDB repository;
- React state/store;
- parse jobs or queue;
- ModelProvider abstraction;
- Combatant/Encounter state;
- editor merge/split operations;
- translation implementation;
- synchronization.

Those layers can now depend on `SavedStatblock` without importing parser internals.

## Public package API

`compileToEditableStatblock()` remains an internal parser boundary and is not exported from the package root because its input is parser-internal. External application code consumes `parseForProduct()` and the product-domain types/operations only.
