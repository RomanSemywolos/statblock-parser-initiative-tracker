# v2.32 — Editor-owned product document

v2.32 removes parser-derived `blocks[]` from the canonical product model.

## Boundary

The parser still owns its lossless annotations/blocks/source map internally.

The only transition is:

```text
raw source
  -> lossless parser document
  -> compileToEditableStatblock()
  -> EditableStatblockDocument v2
```

After compilation the product document contains no parser roles, annotation IDs, source spans,
candidate IDs, or parser block semantics.

## Canonical authoring model

```ts
type EditableStatblockDocument = {
  formatVersion: "editable-statblock-v2";
  language: string;
  header: EditableStatblockHeader;
  body: EditableStatblockNode[];
  facts: StatblockFacts;
};
```

The header owns:

- name;
- subtitle / size-type-alignment text;
- ordered primary rows (AC / Initiative / HP / Speed);
- structured six abilities;
- structured six saving throws;
- ordered secondary rows (skills, vulnerabilities/resistances/immunities, senses, languages,
  habitat, challenge, XP, proficiency bonus and arbitrary other header rows).

The body owns only authoring nodes:

```ts
paragraph { id, text }
heading   { id, headingKind?, text }
```

Node IDs are product/editor IDs. They are not parser identities.

## Editing

The React editor renders the header semantically and body nodes as a visually continuous document.

For body content:

- Enter splits the current node and creates a fresh editor-owned paragraph ID.
- Backspace at the start merges with the previous node.
- `+ Абзац` creates a paragraph without parser participation.
- H toggles paragraph/heading.
- B/I use the lightweight internal authoring markup already introduced in v2.31.

Header rows can also be added without parser participation.

Abilities and saves are edited as structured values in their normal header table/row.

## Facts

Gameplay facts remain a separate deterministic projection for encounter logic.

Editing header text refreshes AC/HP/initiative/PB locally.
Editing an ability updates the corresponding fact and, when the save was only a fallback, that save.
Body prose never runs the parser and does not affect header facts.

## Renderer

The normal product renderer no longer reconstructs a statblock by walking parser-derived blocks.

It explicitly renders:

1. name;
2. subtitle;
3. primary header rows;
4. six-column ability table;
5. six saving throws;
6. secondary header rows;
7. authoring body nodes.

This restores the intentional structured-header presentation used by the diagnostic parser while
keeping the product data model independent.

## Card configuration

`customBlockIds` is replaced by `customContentIds`.

Custom card content can point to editor-owned body nodes or editable header rows. A stable virtual
`builtin-abilities` content ID represents the structured ability table.

## Migration

`SavedStatblock` is now `saved-statblock-v2`.

Repository reads automatically migrate `saved-statblock-v1` / `editable-statblock-v1` data and
write the migrated value back to IndexedDB.

Migration preserves old body block IDs as new authoring node IDs where possible. Therefore existing
custom card references to ordinary features/headings continue to work.

Legacy custom ability-table card references migrate to the virtual `builtin-abilities` content ID.

Library JSON export is now format version 2, while import accepts both format 1 and format 2 and
normalizes them to v2.

A completed parse job left on the backend from the previous version is also safe: the
`createSavedStatblock()` boundary defensively normalizes the runtime document before persistence.

## Translation consequence

Translation no longer depends on parser blocks.

Future EN -> UK translation operates on:

- structured header values/rows;
- current editor-owned body nodes.

If the user creates a new paragraph, it is simply another translation unit. If the user splits or
merges paragraphs, translation sees the current document structure. Stable node IDs remain useful
for incremental translation/source-change tracking, but are owned by the editor rather than by the
parser.
