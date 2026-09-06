# Patch 2.74.153 — settings draft foundation

This patch is deliberately limited to step 1 of the settings UX rewrite. It changes settings semantics before the visual restructuring.

## Saved settings vs draft settings

- Opening Settings initializes an editable draft from the last saved `AppSettings`.
- Changing the linguistic-model profile no longer writes immediately to IndexedDB and no longer changes the parser runtime configuration.
- Changing the default statblock language no longer writes immediately either.
- Custom model URL/ID and translation settings remain draft values until `Зберегти`.
- `Зберегти` commits the whole draft atomically to `AppSettings` and then refreshes the draft from the normalized saved value.
- Reopening Settings resets the draft to the last saved values.

## Runtime boundary

- Parse/import continues to use the saved `settings` object only. Unsaved model changes cannot silently affect a parse job.
- Health-check buttons intentionally use the current draft so a new model/endpoint can be tested before it is saved.

## Deferred to the next steps

- Read-only selected-model details vs editable custom-model fields.
- Vertical layout for translation provider details.
- Unsaved-changes Save / Discard / Stay guard when leaving Settings or starting another action.
