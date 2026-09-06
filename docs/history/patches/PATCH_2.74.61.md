# Patch 2.74.61 — Encounter card snapshot contract

## Scope

This patch aligns the React shell with the existing `StatblockCombatant` snapshot model.

## Production behavior

- Encounter cards now always render statblock content from `combatant.document` and `combatant.cardConfig`, both captured when the combatant is created.
- Later edits to the library statblock no longer silently change AC, saves, custom card content, or the base card name of existing combatants.
- Per-combatant overrides (name, AC, saves, HP, initiative) continue to take precedence.
- Opening a combatant in the center pane is unchanged: the app resolves the current library statblock first and falls back to the combatant snapshot only if the source statblock is unavailable.
- Initiative roll labels now use the same snapshot-backed combatant name as the encounter card.

## Contract clarification

`StatblockCombatant.document` and `.cardConfig` are explicitly documented as encounter-card snapshots / source fallbacks. They are not the canonical library document used by the full center view.

## Tests

The existing cloned-document snapshot regression now also verifies that later source AC and saving-throw mutations do not leak into the combatant snapshot. Existing card-config clone tests continue to cover independent card configuration.

## Non-goals

No parser, ownership, compiler, translation, persistence, or combat HP semantics changed.
