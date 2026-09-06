# 2.74.76

Test-contract cleanup after restoring saving throws to the bounded header scan.

- Updated multiline and pipeline schema assertions for the restored `savingThrows` channel.
- Updated the multiline mock response to satisfy the current bounded-header schema.
- Corrected the legacy quote-fixture adapter in `headerFacts.test.ts`: an old `abilityRows` hint is translated to the new exact-label contract only when its legacy `sourceQuote` is actually grounded in the source and contains the label. This preserves the meaning of the ungrounded-label regression test instead of accidentally turning its deliberately false hint into a grounded contradictory hint.
- No production parser behavior changed from 2.74.75.
