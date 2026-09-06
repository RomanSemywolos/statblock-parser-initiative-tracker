# Patch 2.74.125

Audit-only checkpoint for the planned ownership-based parser handoff.

## Added

- `AUDIT_BODYSTART_DEPENDENCIES_2.74.125.md`
  - traces every active production dependency on the scalar `bodyStart`;
  - distinguishes direct boundary dependencies from downstream annotation-derived
    "first body" helpers and unrelated local structural ceilings;
  - records the exact migration order toward
    `accepted header ownership -> exact remainder -> structure parser`.

## Behavior

No parser behavior, prompt, schema, routing, candidate, transport, compiler,
renderer, or Auto Style behavior changes in this patch.

The only runtime-visible code change is the package version bump to `2.74.125`.
