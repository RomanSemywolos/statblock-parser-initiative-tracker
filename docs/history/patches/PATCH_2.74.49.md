# Patch 2.74.49

## Fixed: profile continuation could erase independently model-owned header rows

A regression exposed by the fragmented ability-table test showed that the candidate continuation layer could merge distinct model-owned `header_field` rows into the preceding English-profile header anchor. In the failing fixture, `Speed 40 ft.` absorbed `mod`, `save`, and the fragmented ability rows up to `Skills`. Source-only ability recovery then correctly promoted the `Str ... Cha` region, but because the oversized Speed annotation overlapped that region, promotion removed the whole annotation and therefore discarded semantic ownership for `Speed` and the generic column labels. Raw source remained lossless, but header ownership was wrong.

### Production change

`candidateTransport.ts` now treats independently model-owned `header_field` spans as grounded ownership:

- strong continuation closure may close an `unclassified` header continuation into the preceding header owner, but does not erase a separate `header_field` owner;
- profile-bounded header continuation may still repair body-like/unclassified misclassifications between trusted header anchors, but skips separately model-owned `header_field` spans.

This preserves the existing source-proven repairs for wrapped rows such as `Slashing from Nonmagical Attacks` / `Poisoned`, while preventing profile evidence from flattening fragmented tables or localized/custom header rows.

### Regression coverage

Added a direct transport regression proving that `Speed -> mod/save -> fragmented ability cells -> Skills` preserves every separately model-owned header row. Existing continuation regressions continue to pass.

### Validation

- `candidateTransport.test.ts`: 19/19 passed in emitted sandbox execution.
- widest emitted sandbox suite: 334 entries, 326 passed, 8 test-file startup failures caused by unavailable runtime dependencies (`zod` / `undici`), and 0 assertion failures among runnable tests.
- The exact dependency-backed `headerFacts.test.ts` case cannot run in this sandbox because `zod` is unavailable; Windows `npm test` remains authoritative for that test.
