# Patch 2.74.16

Regression fix for mixed routing and body presentation.

## Router

- Header-shaped words are no longer accepted as header routing evidence after an explicit body section heading (`Traits`, `Actions`, etc.).
- This prevents wrapped prose such as `speed in a straight line ...` from moving `lastIsolatedHeaderIndex` into the body and hiding a real soft-wrapped region.
- Sectionless statblocks intentionally retain the previous behavior because there is no equally strong region boundary.

## Presentation

- A physical short `label:` row now needs a source-visible label-like initial character (uppercase letter or digit) before its source newline is preserved.
- Lowercase prose wraps such as `three attacks: one with ...` are folded back into ordinary prose.
- Confirmed collapsed spell-row sequences remain unchanged and continue to use their stronger sequence proof.

## Validation

Runtime smoke checks covered:
- full Adult Imperial Dragon sample -> `generic` / `mixed` with `soft_wrapped_column` evidence;
- ordinary clean multiline -> remains `multiline`;
- collapsed one-line source -> remains `singleline`;
- preserved header + collapsed body -> remains `generic` / `mixed`;
- `three attacks:` hard wrap folds to prose;
- physical and collapsed spellcasting rows remain split;
- ordinary `Melee Weapon Attack: ... Hit: ...` remains unsplit.

The broader audit findings from the preceding review are intentionally not changed in this patch.
