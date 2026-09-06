# Patch 2.74.97 — packaging/test correction for 2.74.96

Base: **2.74.96**. No production parser logic changed.

- Corrects `src/version.ts` so runtime diagnostics report 2.74.97 consistently with package metadata.
- Corrects the standalone-save evidence regression test to verify source ownership by exact source span instead of a synthetic annotation ID that enrichment is allowed to replace.
- The boundary-independent verifier and source-proven ability-table recovery introduced in 2.74.96 are unchanged.
