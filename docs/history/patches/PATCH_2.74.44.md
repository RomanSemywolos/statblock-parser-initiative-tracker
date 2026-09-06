# Patch 2.74.44

Test-only TypeScript compatibility fix after 2.74.43.

- Removed obsolete/nonexistent `semanticRole` and `section` properties from the localized sentence-case Auto Style paragraph fixture in `src/editableDocument.test.ts`.
- `EditableStatblockNode` paragraph shape remains `{ id, type: "paragraph", text }`.
- No production parser, boundary, transport, compiler, renderer, or Auto Style behavior changed.
- Semantic enrichment for saving throws is unchanged.
