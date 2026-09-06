# 2.74.73

Test-contract repair after the two-stage header refactor.

- Updated `headerFacts.test.ts` model fixtures to answer the header-boundary locator separately from the semantic header request.
- Updated the web-app integration fixture for the boundary → header semantics → verification call sequence.
- No production parser behavior changed from 2.74.72.
