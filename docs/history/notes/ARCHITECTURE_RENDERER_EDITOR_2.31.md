# v2.31 — Product statblock renderer/editor revision

This revision fixes the product presentation layer before translation work.

## Renderer

`EditableStatblockDocument.blocks` remain the internal stable structure, but the normal product view
no longer exposes block metadata or separate technical ability/save panels.

The central statblock renders the document in source order, with semantic projections for:

- ability scores/modifiers as a real six-column ability table;
- all six saving throws as one in-statblock row;
- normal name/subtitle/header/section/body styling.

Ability modifiers and saving throw bonuses are clickable where they are displayed.

Signed modifiers found in normal statblock prose (`+12`, `-2`, etc.) are also clickable as d20
modifiers, except when they are already part of a dice expression or numeric range.

## Inline roll feedback

A click still writes to the global roll history, but also records a transient result in the central
statblock:

```text
+6 (1к20+6)=18
```

The inline result is React-only presentation state. It is never written to
`EditableStatblockDocument`, `SavedStatblock`, IndexedDB, or encounter persistence, and therefore
does not survive page reload.

## Editor

The old visible block-debug editor (metadata labels, merge, split, per-block boxes) is removed from
the product UI.

Internally blocks still exist for stable IDs, translation and card configuration. In edit mode they
are presented as one visually continuous statblock page:

- no block borders;
- no parser/product metadata for normal lines;
- no merge/split controls;
- section headings alone have a small human-facing heading-type chip.

Formatting controls:

- **B** applies bold to the current selection;
- *I* applies italic to the current selection;
- **H** toggles the active paragraph between normal content and a section heading.

The editor itself is `contenteditable`, so the user sees normal rich text rather than markup
characters. Internally, bold/italic are serialized to a tiny `**...**` / `*...*` authoring syntax
inside `block.text`. Normal rendering interprets that syntax. This avoids persisting arbitrary HTML
or introducing a rich-text framework into the translation/persistence boundary.

Existing working/saved/backup autosave semantics are unchanged.
