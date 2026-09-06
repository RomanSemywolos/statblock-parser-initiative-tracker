# Patch 2.74.15

- Added presentation-only recovery for collapsed compact labelled spell rows.
  - No spell vocabulary is used.
  - The first compact row must be introduced by a preceding colon.
  - Later rows require digit-led mechanical labels such as `3/day each:` or `1st level (4 slots):`.
  - This avoids splitting ordinary `Melee Weapon Attack: ... Hit: ...` prose.
- Added Auto Style for confirmed numbered subeffect rows.
  - `1. Beguiling Gaze. ...` becomes `*1. Beguiling Gaze.* ...`.
  - The existing title-shape guard is reused, so ordinary numbered prose such as `1. The target is stunned.` remains unchanged.
- Raw source, semantic ownership, and reconstruction are unchanged; both changes are presentation/authoring transforms only.
- Targeted presentation + editor tests: 34/34 pass under the available global ts-node runtime.
