# Patch 2.74.57 — multiline test-contract correction

This is a test-only patch. Production parser behavior is unchanged from 2.74.56.

## Why the tests failed

Two `pipeline.test.ts` assertions still encoded the temporary full-source multiline architecture that was intentionally removed in 2.74.55.

1. A multiline header-model outage no longer makes the entire document unclassified. The header prefix remains unresolved, while the deterministic multiline body is still compiled. The regression now verifies the preserved `Actions` heading and `Bite. Text.` feature, exact source reconstruction, and the `multiline_header_model_failed` issue.
2. The end-to-end multiline transport test no longer expects the old `CANDIDATE-PARTITION MODE` system prompt. It now expects `MULTILINE HEADER-ONLY MODE`; the independent essential-fact pass remains `CARD-FACT VERIFICATION MODE`.

No production source files were changed other than version metadata.
