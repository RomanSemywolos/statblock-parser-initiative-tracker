# Audit follow-ups after v2.74.29

Deferred intentionally; no behavior change in this patch:

- Candidate reconciliation: keep the legacy `reconcileCandidateRuns()` world for now. Later audit which policies are still required by the active direct-response transport and either retire or clearly isolate the historical path.
- Translation: return later to translation architecture/provider/glossary work, including the non-portable glossary generator script.
- Frontend: large `App.tsx` decomposition/polish is deferred.
- Persistence: bulk library import vs pending autosave coordination is remembered for a later persistence pass.
- Documentation: README/current architecture rewrite is deferred; milestone documents remain historical.
- Compiler hygiene: consider `noUnusedLocals` / `noUnusedParameters` after cleanup, not during parser stabilization.
