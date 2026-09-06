# M5 — Editable working/saved/backup statblocks

M5 turns the M4 library into an editable product workspace without changing parser internals.

## Version semantics

Each language version keeps three independent snapshots:

- `working`: the live editable document. UI changes update this immediately and persist with a short IndexedDB debounce.
- `saved`: the last explicit checkpoint created by the user.
- `backup`: the `saved` checkpoint that existed before the most recent explicit save.

Explicit save performs `backup = saved; saved = working`. Revert copies `saved` to `working`. Backup restore copies `backup` to `working` and does not silently replace `saved`.

## Editing boundary

Editing happens only on `EditableStatblockDocument`. The parser is never called again.

Pure product operations:

- `editEditableBlockText`
- `mergeEditableBlockWithPrevious`
- `splitEditableBlockAt`
- `refreshEditableStatblockFacts`

Merge keeps the previous block's semantic role. Split creates a fresh block id and inherits the original block's role/section/field.

## Fact refresh

M5 locally refreshes facts that can be proven from edited product text: name, AC, HP, printed initiative, standard ability rows and standard saving-throw rows. Missing printed saves fall back to ability modifiers. If a fact cannot be proven after editing, it becomes `null`; user text is never rewritten.

## React behavior

The editor works for a statblock opened from either the library or an encounter instance because combatants reference the shared library statblock. Editing therefore updates every combatant view of that statblock, while future combat-only HP/initiative state remains instance-owned.
