# Patch 2.74.10

## Ability-table source recovery

- Replaced the layout-specific source fallback for canonical vertical `SCORE (MOD)` blocks with a generic canonical six-label source-window probe.
- The source probe understands only the ordered canonical label chain `STR -> DEX -> CON -> INT -> WIS -> CHA` and exact source-unit boundaries. Numeric interpretation remains exclusively in `resolveAbilityTableFromHeader()`.
- Candidate source windows are proved by the existing layout-independent constraint resolver. No score, modifier, or saving-throw fact is created by the scanner itself.
- When nested windows are all valid, the probe prefers the uniquely richest grounded mechanical evidence (six scores plus actually printed modifiers/saves), then the shortest equally-rich interval. This prevents a fragmented final CHA save cell from being dropped merely because a smaller six-score solution already exists.
- `enrichStructuredHeader()` now compares the ordinary annotation-based proof with the source proof and promotes the source interval only when it recovers strictly more grounded printed evidence, or when the ordinary proof cannot recover all six abilities. Existing correct ownership therefore remains authoritative.

## Rak Tulkhesh regression

Added a regression where semantic ownership omits the final `CHA +16` cell from a `score / mod / save` table. The ordinary resolver reproduces the 5-save failure; source recovery proves the full region and recovers all six printed saves.

## Initiative

No parser change. A grounded printed row such as `Initiative +4 (14)` is deliberately preserved verbatim in the editable product header, while `facts.initiative.modifier` reads only `+4`. The parenthetical value is therefore presentation/source evidence, not the encounter initiative modifier.

## Validation

- `abilityTableResolver.test.ts`: 3/3 passing in emitted-JS smoke run, including the new fragmented final-save regression.
- Changed core modules emit successfully under global TypeScript; remaining diagnostics are environment-only missing `zod` / Node typings.
