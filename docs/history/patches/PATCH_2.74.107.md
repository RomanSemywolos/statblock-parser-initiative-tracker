# Patch 2.74.107 — generic compact-evidence completion and printed-PB authority

This patch deliberately addresses only the first two follow-ups from the 2.74.106 audit. The language-specific Auto Style heading fallback is left unchanged for a separate audit.

## 1. Generic compact evidence boundary resolver

The 2.74.106 Challenge-only parenthesis completion has been replaced by one deterministic resolver used by verified compact fixed-header facts. A verifier coordinate may extend only to complete an already-open parenthetical inside a source-proven corridor bounded by the next physical line break or the next independently grounded essential fact.

If the imported source itself contains an unmatched opening parenthesis, the resolver abstains and preserves the malformed source span exactly as printed. There is no parse failure, no invented closing delimiter, and no scan into later body content.

This keeps the collapsed-Demogorgon recovery (`Challenge 26 (90,000 XP)`) while making the mechanism field-agnostic rather than Challenge-specific.

## 2. Printed PB no longer has to agree with CR

An unverified semantic `proficiency_bonus` proposal is no longer validated by comparing its value to the CR-derived PB. CR derivation is fallback/diagnostic evidence only and can never overrule a structurally compatible printed scalar.

Instead, deterministic code checks whether the proposed source span has the shape of one compact signed scalar field: exactly one signed numeric atom and exactly one numeric atom overall, within a compact source span. This rejects misclassified Saving Throws rows and similar multi-number metadata without requiring any English label or D&D expected value.

If a structurally compatible printed PB conflicts with CR, the printed PB wins and `proficiency_bonus_cr_mismatch` is emitted.

## Regression coverage

Added regressions for:
- a printed PB that intentionally disagrees with CR while verifier PB evidence is absent;
- generic right-edge completion on Hit Points rather than Challenge;
- a genuinely unclosed Challenge parenthetical, which remains unchanged and still yields the visible rating without collapsing the parse;
- existing Saving Throws-as-PB rejection remains in place.

The English Auto Style section-heading whitelist from 2.74.106 is intentionally not changed in this patch; it is scheduled for the next broader vocabulary/hardcode audit.
