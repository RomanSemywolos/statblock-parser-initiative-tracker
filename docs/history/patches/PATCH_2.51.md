# v2.51.0 — explicit initiative header fallback

## Goal
Make initiative a visible, permanent header concept before the translation phase, while preserving exceptional statblocks whose printed initiative differs from Dexterity.

## Behavior
- A grounded source `Initiative` header field remains the authoritative display row. Its source text is preserved as-is through semantic compilation; Auto Style only formats the recognized label for presentation.
- If no grounded initiative row exists, the product compiler creates `Initiative +N` from the structured Dexterity modifier.
- The derived row uses stable id `header-initiative-derived` and keeps fact provenance as `dex_modifier`, not `printed`.
- A real printed row keeps fact provenance `printed` and continues to override the Dexterity fallback for encounter initiative.
- The fallback is inserted in the primary header near AC/HP, so initiative no longer silently exists only in `facts`.
- If Dexterity itself is unresolved, no fake numeric initiative is invented.

## Trust boundary
This does not ask deterministic code to infer an exceptional initiative bonus. Exceptional initiative is used only when a source-owned `initiative` span exists (model/deterministic grounding). The deterministic fallback is only the ordinary DEX modifier.

## Validation
- Added compiler regression coverage for visible DEX-derived initiative row and its provenance.
- Extended printed-initiative regression to assert the printed row survives as `Initiative +9 (19)` after Auto Style and overrides DEX.
- `tsc --noEmit --noCheck` passed for the changed compiler/editor/test path.
- Full dependency-backed npm test / Vite build was not run: this sandbox worktree has no `node_modules`; an attempted `npx --no-install tsx` test invocation timed out.
