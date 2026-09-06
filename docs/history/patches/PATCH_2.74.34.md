# Patch 2.74.34

Systematic cleanup of the recent labelled-continuation and missing-space fixes.

- Removed the transport-level `Hit:` / `Failure:` / `Success:` vocabulary rule. Generic transport no longer overrides model ownership merely because a line has a known 5e label.
- Kept a vocabulary-free `labeled_continuation` relationship hint for an adjacent physical `Label:` row after a named rule. It is hint-only, requires a real line boundary, and is disabled across paragraph breaks.
- Generic/mixed candidate enrichment and Auto Style now share one compact `Label:` surface-shape helper.
- Multiline structural classification and Auto Style now share one trusted title-boundary helper, including the copied-text `Name.Prose` defect. The source is never rewritten.
- Auto Style no longer names `Recharge`, `Costs`, or `Day` to choose feature emphasis. Compact numeric parenthetical metadata is recognized by shape instead; longer prose parentheticals remain bold-only.
- Added regressions proving arbitrary `Outcome:` labels receive the same structural treatment, transport does not force their ownership, paragraph breaks block continuation hints, and missing-space title recovery rejects ordinary sentence starts.
