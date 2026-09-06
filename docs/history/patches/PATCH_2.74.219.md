# Patch 2.74.219 — module-boundary refactor

This release resolves the large-file concentration identified in the repository audit without changing parser or product behavior.

## Changes

- Split frontend panels and statblock views into component-focused files while preserving compatibility barrels.
- Moved settings, parse-job polling, encounter, and dice state into domain hooks.
- Isolated the backend diagnostic HTML from the HTTP server module.
- Split Header enrichment into orchestration, ability/save, scalar-fact, and coordinate-primitive modules.
- Split the parser pipeline into shared Header coordination plus multiline, singleline, and mixed BODY stages.
- Added explicit architecture documentation for the new module boundaries.

## Compatibility

- Public parser exports are unchanged.
- `APP_HTML`, `AppPanels`, and `StatblockViews` imports remain available through their previous modules.
- Persistence formats, parsing prompts, ownership rules, and UI behavior are unchanged.

## Verification

The release gate covers TypeScript builds, 547 core tests, 12 frontend tests, linting, formatting, and package-content validation.
