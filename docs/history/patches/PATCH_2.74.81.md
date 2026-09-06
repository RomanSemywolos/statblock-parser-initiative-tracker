# 2.74.81

Test-contract isolation only.

- The candidate-transport end-to-end regression now explicitly selects `multiline`.
- Its fixture is intentionally clean multiline after 2.74.80, but the test is not a router test; leaving it on `auto` coupled candidate-transport assertions to short-fixture routing heuristics and introduced an unrelated body-model call.
- The test still verifies the same candidate transport, deterministic multiline body units, exact source reconstruction, and absence of model-generated source quotes.
- No production parser behavior changed from 2.74.79/2.74.80.
