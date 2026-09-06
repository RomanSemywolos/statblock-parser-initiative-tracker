# v2.37 — stable identity rows, warm statblock palette, safer deletion

## Permanent name/type rows

The product compiler now always emits two authoring header slots:

1. monster name;
2. size/type/alignment subtitle.

If parsing found nothing, the slot text is simply empty.

Existing editable-v2 documents are normalized on repository migration. Existing encounter-v3
snapshots are also normalized when the application loads them.

Clearing the name or subtitle in Edit mode no longer deletes the slot. It leaves an empty editable
row.

The semantic `facts.name` still remains `null` for an empty name, so Library UI can display
`Без назви` without inventing a product name.

## Library

Library rows once again only read the current statblock name. The v2.36 inline library rename UI was
removed.

AC is not displayed in Library rows.

## Edit-mode formatting

The continuous body editor remains, including native cross-paragraph selection and native
Enter/Backspace/Delete behavior.

Existing authoring markup is hydrated into the editable surface, so bold/italic and heading
presentation remain visible while editing.

Header rows remain fully editable as literal text.

## Roll typography

Interactive affordances remain, but the mechanical number itself is no longer visually over-weighted.

The following are normal font weight with a dotted interactive underline:
- saving throw modifiers;
- attack modifiers;
- dice expressions inside damage / HP formulas.

Dice expressions no longer use the special filled background.

Inline roll results remain bold, as they are transient results rather than source mechanics.

## Warm statblock palette

The statblock surface returns to the earlier warm parchment-like colors:

- background: `#f3ead8`;
- main text: `#67472f`.

This applies to normal view, Edit mode, and statblock-based configuration surfaces.

## Header actions

Edit and Card Configuration controls are stacked vertically in a reserved right-side header column.

Both buttons have enough fixed width for their full Ukrainian labels on one line, avoiding header
reflow when toggling between open/closed mode text.

## Safer Library deletion

Clicking `×` on a Library statblock now opens the browser-native confirmation dialog:

```text
Видалити "Name" з бібліотеки?

Enter — підтвердити · Esc — скасувати
```

This keeps accidental deletion difficult while allowing repeated cleanup with a quick click + Enter
workflow.
