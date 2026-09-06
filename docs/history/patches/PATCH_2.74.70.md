# 2.74.70

Test-contract cleanup after the universal header-scan refactor.

- Multiline deterministic-body unit tests now receive an explicit externally owned body boundary instead of rediscovering it with the removed English-specific helper.
- Header-scan failure regression now asserts the new language-neutral failure contract: no semantic annotations are invented when the universal boundary scan fails; exact source remains preserved/unclassified.
- No production parser behavior changed from 2.74.69.
