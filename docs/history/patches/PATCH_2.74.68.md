# 2.74.68

Frontend build repair after App decomposition.

- Restores the shared 350 ms autosave delay constant consumed by the extracted persistence coordinators.
- Keeps EncounterSidebar HP callbacks on the canonical `CombatHpState` contract instead of a stale pre-refactor object shape.
- Adds the standard Vite client type reference so TypeScript recognizes side-effect CSS imports during `build:frontend`.

No parser, compiler, persistence semantics, encounter mechanics, or UI behavior are intentionally changed.
