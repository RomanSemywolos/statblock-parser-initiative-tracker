# Patch 2.74.54

## Scope
Test-only TypeScript contract fix following 2.74.53.

## Fix
`src/editableCompiler.test.ts` accessed `editable.header.name.text` directly even though the production `EditableHeader.name` contract is nullable. The fixture guarantees that a name exists, but TypeScript correctly required the test to narrow the nullable value after compilation.

The regression test now performs `assert.ok(editable.header.name)` before reading `.text`.

No parser, transport, compiler, editor, presentation, or runtime behavior was changed.

## Version
Synchronized package metadata and `src/version.ts` to `2.74.54`.
