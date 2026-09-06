# Patch 2.74.155 — unsaved settings guard

This release completes step 3 of the settings workflow introduced in 2.74.153–154.

## What changed

- Settings now have an explicit unsaved-changes guard.
- Runtime actions continue to use the last saved settings until the draft is committed.
- If the settings draft differs from the saved configuration and the user tries to leave settings or start a guarded external action, the app remembers that action and asks what to do:
  - **Зберегти зміни** — save the draft, close settings, then continue the original action.
  - **Скасувати зміни** — restore the last saved settings, close settings, then continue the original action.
  - **Залишитися в налаштуваннях** — keep the draft and cancel the attempted action.
- Closing settings with no draft changes remains immediate.
- The guard is shared by the main navigation/action entry points rather than duplicating save/discard logic in each handler.
- Saving from the guard only continues the pending action after `saveSettings()` succeeds.

## Covered action surfaces

The shared guard is used for settings close, library open/add/remove/import actions, parser-job retry/dismiss, main dice control, language/edit/card controls, editor checkpoint/revert/backup controls, and principal encounter actions.

## Validation

- Core TypeScript typecheck: passed.
- Compiled Node test suite: **557/557 passed**.
- Frontend typecheck reaches only the pre-existing unrelated `StatblockViews.tsx` `proficiency_bonus` error; this patch introduced no additional frontend TypeScript errors.
