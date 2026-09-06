# 2.74.121 — introduced-list presentation completion

Base: 2.74.120 (the clean pre-rich-style branch plus list ownership repair).

This patch does **not** change parser semantics, candidate ownership, list detection,
header routing, prompts, source visibility, or facts.

2.74.120 already proves Baphomet's `1 → 2 → 3 → 4` sequence and keeps the full
`4. Bisect.` item inside `Heartcleaver`. The remaining defect was presentation:
`normalizeBodyPresentationText()` only preserved numbered rows when consecutive
physical rows themselves formed the sequence. Wrapped PDF continuation rows between
`1.`, `2.`, `3.`, and `4.` therefore caused the already-correct structural feature
to be displayed as one flattened paragraph.

2.74.121 reuses the existing source-proven `introducedListSequenceStartGroups()`
proof in the presentation normalizer. Only confirmed marker rows keep presentation
line breaks; wrapped continuation rows are still folded into their item text.
Unintroduced/incomplete numeric prose remains folded as before.
