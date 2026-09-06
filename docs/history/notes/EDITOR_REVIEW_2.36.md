# v2.36 — continuous editor and encounter card configuration

## Why the old editor felt unpredictable

The body used one independent `contentEditable` element per paragraph/heading.

That made browser-native editing impossible across logical block boundaries:

- a selection could not naturally cross from one paragraph host into another;
- Enter, Backspace and Delete at boundaries had to be simulated manually;
- focus/caret restoration after every structural change could race React rendering;
- browser formatting and editor-owned node splitting were two different editing models.

v2.36 removes that mismatch.

## One body editing surface

The statblock body is now one `contentEditable` root.

Inside it the browser owns the immediate editing experience. Top-level DOM blocks are normalized back
into editor-owned nodes on input:

```text
<div> -> paragraph
<h1..h6> -> heading
```

Existing `data-node-id` values are preserved. New blocks get fresh editor IDs. Chromium clones data
attributes when Enter is pressed at the start of an ordinary block, so normalization explicitly
detects duplicate cloned IDs and replaces the duplicate with a new ID.

This means:

- selection can span multiple body paragraphs;
- Enter is native paragraph splitting;
- Backspace at a boundary is native merge-with-previous;
- Delete at a boundary is native merge-with-next;
- deleting a selection across paragraph boundaries is native;
- bold/italic may span the selected body content without a per-node selection barrier.

The editor still serializes the lightweight authoring markup back to the product model.

A direct headless Chromium check confirmed:
- cross-block selection works;
- Backspace at the beginning of a block produces `AlphaBeta`;
- Delete at the end of a block produces `AlphaBeta`;
- deleting a cross-block selection merges the surviving text naturally.

## Header editing

Known labels such as `Armor Class` remain semantic/bold in normal rendering, but Edit mode no longer
places the label outside the editable area.

Every existing header row is edited as the complete row text. Therefore a bad parser classification
does not trap an immutable label in the UI.

Name and subtitle are always represented by editable authoring slots in Edit mode, even when the
parser produced `null`. This directly supports recovering a missing monster name without rerunning
the parser.

The visible `+ Рядок хедера` button is removed. Header rows can still be created with Enter from the
last non-empty header row. An empty row is removed when abandoned.

The visible `+ Абзац` button is removed. Body paragraphs are created with ordinary Enter.

## Library rows

Library cards now show only the statblock name, not AC.

A rename control edits the current working document name directly. Existing encounter snapshots are
not affected; future copies inherit the renamed library document.

## Tracker names

The per-copy rename field now starts with the combatant's actual current displayed name, including an
automatic `#1/#2` form when that is what the card currently shows. The user edits that value rather
than starting from a blank override.

## Card configuration on encounter copies

`Налаштувати картку` is available for an opened statblock combatant as well as for a library
statblock.

Library configuration changes the library `cardConfig`.

Encounter configuration changes only that combatant's snapshotted `cardConfig`.

Thus:
- configure library, then create a combatant -> the new combatant inherits it;
- configure an existing combatant -> sibling copies and library are unchanged.

## Stub initial mode

`Додати учасника` creates and opens the stub in normal view. Editing starts only after the user
presses `Редагувати`.

## Header control stability

The right-side action area now reserves a fixed width. Edit and Card Configuration buttons also have
fixed widths, so toggling between `Редагувати` / `Закрити редагування` or card-config labels does not
reflow the roll area and the rest of the header.
