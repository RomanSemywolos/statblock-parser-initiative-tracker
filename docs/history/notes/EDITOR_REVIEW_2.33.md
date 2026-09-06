# v2.33 — editor behavior review

This revision treats the statblock editor as an editing system rather than a collection of
contentEditable fields.

## Problems found

### 1. Header rows could become permanent empty rows

Header rows were text-editable but structural deletion was not connected to empty text.

Fix:
- deleting the final character removes a primary/secondary header row;
- an empty newly-added header row is removed when it loses focus;
- Backspace/Delete on an already-empty header row removes it;
- Enter never creates a multiline header field.

Removing AC/HP/etc. goes through `removeEditableHeaderRow()` so deterministic facts refresh.

### 2. Backspace joined paragraphs but moved the caret to the wrong place

The old implementation:
- merged the nodes;
- inserted an artificial newline;
- focused the end of the whole merged node.

That does not behave like deleting a paragraph boundary.

Fix:
- Backspace at the start removes exactly the boundary;
- texts concatenate directly;
- previous editor node ID survives;
- caret is restored at the exact join position.

### 3. Delete had no symmetric paragraph-boundary behavior

Fix:
- Delete at the end of a body node merges the following node into the current node;
- current editor node ID survives;
- caret remains at the former boundary.

Pure operation: `mergeEditableNodeWithNext()`.

### 4. Structural edits could visibly jump

Focus restoration previously relied mainly on `requestAnimationFrame()` and often moved to the end
of a node.

Fix:
- structural edits store a pending `{id, plainTextOffset}`;
- focus is restored after the new document has rendered;
- Backspace/Delete preserve the exact join offset;
- H preserves the current caret instead of moving it to the end;
- newly-created paragraphs/header rows receive focus automatically.

### 5. Enter inside formatted text could corrupt authoring markup

The former implementation converted a plain-text caret offset into an offset in the serialized
`**bold**` / `*italic*` string. Splitting inside a formatted span could produce malformed halves
such as an unmatched `**`.

Fix:
- Enter now splits the actual DOM Range;
- each cloned before/after fragment is serialized independently;
- both resulting node texts therefore contain valid formatting markup.

Pure operation: `splitEditableNodeText()`.

### 6. Mixed bold+italic did not round-trip reliably

The lightweight authoring renderer now understands canonical `***bold italic***` in both normal
view and editor hydration.

### 7. IME composition safety

Enter/Backspace/Delete structural handling does not intercept a keyboard event while the browser is
in an IME composition sequence.

## Resulting body keyboard model

- ordinary typing: native browser editing + onInput sync;
- Enter: split current authoring node;
- Shift+Enter: soft line break inside the node;
- Backspace at node start: merge with previous;
- Delete at node end: merge with next;
- selection + Backspace/Delete: native deletion inside the current editing host;
- selection + Enter: selection is replaced by a paragraph boundary.

Empty body paragraphs remain allowed deliberately; they are real authoring paragraphs.

## Header keyboard model

Primary/secondary header rows are one-line fields:
- deleting all text deletes the row;
- Enter moves to the next row, or creates a new `other_header` row if needed;
- an abandoned empty newly-created row is cleaned up.

Name and subtitle remain special fixed header elements rather than removable ordinary rows.

## Remaining deliberate limitations

This is still a lightweight authoring editor, not a full rich-text framework.

- arbitrary nested/overlapping combinations of bold and italic are not modeled as a general span tree;
  canonical bold, italic, and whole-span bold+italic round-trip correctly;
- selections spanning more than one separate contentEditable body node are not transformed as one
  cross-node operation;
- paste of multi-paragraph rich HTML is normalized by the browser/serializer rather than imported
  as a full rich-text document.

Those limitations are explicit and no longer interfere with the normal statblock editing path.
