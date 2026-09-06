# v2.33 manual editor checklist

Use a statblock with several header fields, Actions, and at least two actions.

1. Header deletion
   - click a Damage Resistance / Languages / AC row;
   - Ctrl+A, Backspace;
   - the row should disappear, not remain blank;
   - reload and confirm it stays deleted.

2. New empty header
   - click `+ Рядок хедера`;
   - click elsewhere without typing;
   - the empty row should disappear.

3. Backspace boundary
   - put caret at the beginning of the second action;
   - Backspace;
   - nodes join;
   - caret stays exactly where the paragraph boundary was.

4. Delete boundary
   - put caret at the end of the first of two actions;
   - Delete;
   - nodes join;
   - caret stays at the former boundary.

5. Empty paragraph
   - Enter to create an empty paragraph;
   - Backspace at its start should remove/join it naturally.

6. Enter
   - put caret in the middle of a paragraph;
   - Enter;
   - two paragraphs result;
   - focus is in the new paragraph at offset 0.

7. Formatted Enter
   - make a phrase bold;
   - place caret inside that phrase;
   - Enter;
   - both resulting pieces should retain valid bold formatting without visible `**`.

8. Delete a selection
   - select text inside one paragraph;
   - Backspace/Delete;
   - only selection disappears; nodes do not unexpectedly merge.

9. Heading toggle
   - put caret in the middle of a paragraph;
   - press H;
   - caret should remain at the same logical location.

10. Rapid typing
    - type continuously in a long action;
    - autosave should not move the caret or cause visible text jumping.

11. Reload
    - reload after all structural edits;
    - structure and text should be unchanged.
