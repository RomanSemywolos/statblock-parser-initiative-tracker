# v2.36 manual checklist

## Continuous body editing

1. Open Edit mode on a statblock with at least three actions.
2. Drag-select from the middle of action 1 into action 2.
3. Type replacement text. Selection must behave as one continuous document.
4. Put caret at the beginning of action 2 and press Backspace. The blocks must merge once, without
   duplicated text.
5. Put caret at the end of action 1 and press Delete. The next block must merge once.
6. Put caret at the beginning of a line and press Enter. It must create an empty preceding paragraph,
   not duplicate the line.
7. Select text across two body blocks and press Backspace/Delete.
8. Apply B/I to a selection spanning normal body text.
9. Reload and confirm the normalized body structure persists.

## Header recovery

1. Use a statblock whose parser missed the monster name.
2. Enter Edit mode.
3. Type a name into the visible `Назва істоти` slot.
4. Reload and confirm it is now the document name.
5. Edit the literal `Armor Class ...` text, including its label.
6. Clear a header row and leave it; it should disappear.
7. Press Enter at the final non-empty header row; a new editable header row should appear.
8. Confirm there is no `+ Рядок хедера` and no `+ Абзац` button.

## Library

1. Confirm library cards display only names.
2. Rename one using the pencil control.
3. Confirm the working document name changes.
4. Confirm pre-existing encounter copies retain their old snapshot.
5. Add a new encounter copy; it should use the renamed library document.

## Tracker names

1. Add two copies of the same creature.
2. Click rename on `Creature #2`.
3. Confirm the field initially contains `Creature #2`, not a blank value.
4. Change it to `Сильніший`.

## Card configuration

1. Configure a library card.
2. Add a new combatant and confirm it inherits that configuration.
3. Open the combatant and choose `Налаштувати картку`.
4. Change its configuration.
5. Confirm the library and sibling combatants do not change.

## Stub

1. Create through `Додати учасника`.
2. Confirm it opens in normal view, not Edit mode.
3. Press `Редагувати` and edit it normally.

## Header stability

Repeatedly toggle Edit and Card Configuration. The right action area and centered dice controls
should not jump horizontally when button text changes.
