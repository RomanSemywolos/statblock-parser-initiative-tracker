# Patch 2.74.198 — mixed safe-fix pass

## Scope

This patch intentionally stops before the broader ownership-aware mixed metadata-corridor change. It applies the low-risk fixes agreed from the 2.74.197 QA corpus and keeps the mixed BODY LLM as the authority for restored logical line starts. No deterministic hard start was added for `Darkfire Abyss`, `Strands of the Demonweave`, or other parenthetical feature titles.

## Changes

1. **Complete printed saving-throw row evidence**
   - Structured save values remain grounded to their exact narrow ability/bonus spans.
   - When those grounded saves are proven to share one physical row, `savingThrowEvidence` expands to the complete physical row (unless that row is already the ability-table evidence).
   - This prevents residual BODY fragments such as `**Saving Throws**` / `**Спасброски**` while keeping semantic fact evidence exact.

2. **Trailing-separator continuation precedence**
   - In generic/mixed geometry, source-visible `,`, `;`, or `:` at the end of the previous physical line is attached before compact-metadata promotion.
   - A continuation row therefore cannot become `boundary=top_level/strong` *only* because its own contents also look like compact metadata.
   - The ADRAKNID shape `Skills ... Perception +17,` / `Stealth +19, Survival +11` now yields weak boundary + strong continuation for the second row.

3. **First compact labelled list row after an introducing newline**
   - Presentation proof may cross exactly one physical newline after an introducing colon.
   - It does not cross a blank paragraph.
   - Confirmed inline compact-label starts are preserved explicitly during presentation folding, so a wrapped first item such as `Cantrips (at will): ...` remains the first row of the internal list.

4. **Average + dice nowrap presentation**
   - Viewer rendering groups forms such as `5 (1d10)` in a nowrap span while keeping the dice expression itself clickable.
   - Editor auto-formatting applies the same nowrap presentation group.
   - Source/product text is unchanged.

## QA replay observations

Replaying the stored 2.74.197 model responses through 2.74.198 confirms deterministic downstream behavior:

- Dreamer: `Saving Throws Dex +8, Wis +9, Cha +12` is full Header evidence; `Cantrips (at will)` becomes the first preserved spell-list row.
- Astral Dreadnought: `Спасброски Лов +5, Мдр +9` is full Header evidence.
- ADRAKNID: the BODY request now presents `Stealth +19, Survival +11` as `boundary=unknown/weak` with `continuation=strong` and `previous_line_trailing_separator`, instead of a competing strong metadata boundary.

The stored BODY response still contains the old ADRAKNID start, as expected in a replay. A live qwen3:8b corpus run is required to measure whether the changed evidence alters model selection.
