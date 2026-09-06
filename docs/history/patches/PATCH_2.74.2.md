# Patch 2.74.2

Web/PDF column-wrap parser hotfix.

- Auto routing now recognizes a clean header followed by heavily soft-wrapped prose as mixed geometry and routes it to the universal/generic parser rather than deterministic multiline.
- Body presentation folds incidental physical line wraps inside a semantic node back into spaces.
- Explicit internal rows remain line-separated: numbered/lettered list items, bullets, and short colon-label rows such as `At will:` and `3/day each:`.
- Raw source, source-map spans and lossless reconstruction are unchanged.
- Added a Lolth column-wrapped regression fixture.
- Existing clean multiline Demogorgon/list regressions remain multiline.
