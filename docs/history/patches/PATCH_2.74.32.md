# Patch 2.74.32 — multiline physical-row contract

## Goal
Make trusted `multiline` mean exactly what routing promises: every non-empty physical body row remains a distinct product-presentation row.

## Changes
- Replaced the weaker multiline paragraph-preservation hint with `preservePhysicalLines`.
- In multiline body presentation, every non-empty physical source row is preserved as exactly one `\n`.
- Blank source rows are still removed and never become blank editable rows.
- Multiline presentation no longer runs inline-row exposure that could invent extra breaks inside a physical source row.
- Singleline/mixed presentation behavior is unchanged.
- Added regression coverage for line preservation, blank-row removal, and no synthetic intra-line splitting.

## Architecture review of 2.74.31
- Section-rule colon styling remains presentation-only and source-preserving.
- Mixed mechanical continuation repair remains candidate/evidence based and does not author source text.
- The multiline missing-space repair (`Fling.The`) changes only a temporary structural view of one physical row; it neither merges nor splits source rows and remains lossless.
