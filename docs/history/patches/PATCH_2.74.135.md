# Patch 2.74.135 — mixed ownership-first migration

## Scope

This patch performs only stage 2 of the Header/BODY architecture migration: **mixed** input. Multiline behavior from 2.74.134 is retained. Singleline remains on its current experimental path and is intentionally not redesigned here.

## Architecture change

Mixed no longer uses the universal `bodyStart` scan or a suffix selected by one global boundary. Its normal path is now:

`whole source -> fixed Header locator -> deterministic Header validation -> accepted Header ownership -> BODY complement -> one mixed BODY LLM`

The fixed Header contract is unchanged: name, size/type/alignment, AC, printed Initiative, HP, six abilities, printed saves, CR, and printed PB. Exact printed numbers remain deterministic.

The BODY model sees the complete original source for context, but candidates intersecting accepted Header ownership are explicitly forbidden. A returned BODY span that includes a forbidden candidate is rejected in full. The source is not discarded: rejected/omitted material remains lossless unclassified content. This prevents a weak model from annexing Header evidence or bridging across Header gaps.

No `bodyStart`, source prefix, or source suffix participates in mixed ownership. Header facts may occur after BODY-like material and are still independently grounded.

## Mixed BODY failure contract

- Header verifier misses a field -> it remains BODY/remainder; source is preserved.
- Header verifier proposes unsupported evidence -> deterministic validation rejects it.
- BODY model omits material -> the compiler leaves it explicit/unclassified.
- BODY model crosses Header ownership -> that BODY span is rejected; Header evidence remains intact.
- BODY model fails -> validated Header facts survive and all exact remainder source stays visible/unclassified.
- Unresolved compact metadata -> `u`, not a fabricated feature/heading.

## Structural transport

Unknown/localized printed section headings in mixed BODY are transported with `section:null` instead of disappearing merely because a known section enum cannot yet be assigned. Section semantics remain a later concern.

## Tests

Pipeline tests were updated to the new two-call mixed contract and new regressions were added for:

- exactly two mixed model tasks;
- non-contiguous Header facts appearing after BODY-like source;
- forbidden Header candidate masking;
- rejection of BODY spans crossing Header ownership;
- lossless preservation of omitted BODY content;
- incomplete ability-like tables remaining outside fixed Header semantics.

Validation in the container:

- TypeScript typecheck: passed.
- Compiled Node test suite: **527/527 passed**.

## Not changed

- Singleline still uses the existing experimental Header scan + whole-source boundary/classification architecture.
- Auto Style is not addressed in this patch.
- No broad cleanup of legacy `bodyStart` infrastructure was attempted; remaining references belong to the not-yet-migrated singleline/compatibility path and are technical debt, not architectural precedent.
