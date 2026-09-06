# Patch 2.74.67 — frontend decomposition completion

Behavior-preserving structural cleanup.

- Moved rich statblock rendering/editing and card-configuration UI out of `App.tsx` into `frontend/src/StatblockViews.tsx`.
- Moved library, settings, import, and encounter sidebar presentation into `frontend/src/AppPanels.tsx`.
- `App.tsx` remains the React state/effect/action orchestration shell and top-level workspace composition.
- No parser, compiler, persistence, encounter-domain, localization, or source-ownership behavior is intentionally changed.
- Version synchronized to 2.74.67.

Validation intentionally deferred to the requested combined checkpoint: `npm run typecheck`, `npm test`, `npm run build:frontend`.
