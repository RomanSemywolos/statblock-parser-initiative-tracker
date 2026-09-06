# Patch 2.74.41 — source-proven continuation closure

## Why this patch exists

v2.74.39/40 made mixed boundary evidence more internally consistent, but left strong continuation evidence advisory. In real mixed PDF/web input this still allowed the structural model to create sibling spans at coordinates that the deterministic source layer already considered weak continuations. The visible regressions included:

- `Bite. ...` followed by a physical `Hit: ...` row becoming two body blocks;
- wrapped `Damage Immunities ... / Slashing from Nonmagical Attacks` losing the wrapped line from the header;
- wrapped `Condition Immunities ... / Poisoned` losing the wrapped line from the header.

The fix does **not** restore the old broad model-overwriting heuristics. It adds two narrow ownership-closure invariants.

## 1. Strong continuation closes backward into a compatible existing owner

On the active direct candidate transport path, a candidate with:

- `boundary.strength === "weak"`; and
- `continuationStrength === "strong"`; and
- no explicit model section-heading classification

may no longer open a sibling span when the immediately preceding owner is compatible.

Compatible closures are intentionally narrow:

- previous `feature` + current `feature | unclassified | section_content`;
- previous `header_field` + current `header_field | unclassified`.

The candidate inherits the **identity of the previous model run**, not merely its classification. Two adjacent features remain distinct unless a continuation rule explicitly moves a candidate under the previous owner.

This is vocabulary-free. A compact `Label:` row, lowercase wrap, trailing-separator continuation, etc. can provide strong source-shape continuation evidence without knowing labels such as `Hit`, `Failure`, or any D&D term.

Explicit model section headings are exempt so a localized/homebrew heading that deterministic title/profile logic does not understand is not erased.

## 2. Soft continuation can close only inside a bounded profile-header interval

`soft` continuation remains advisory by itself. However, when a weak continuation coordinate lies **between two independently grounded `profile_header_anchor` starts**, it is bounded on both sides by known header starts. If the first anchor is already model-owned as `header_field`, weak continuation coordinates in that interval stay inside that preceding header owner.

This fixes narrow-column wraps such as:

```text
Damage Immunities Poison; Bludgeoning, Piercing, and
Slashing from Nonmagical Attacks
Condition Immunities ...
```

without teaching the structural layer the word `and` or the phrase `Slashing from Nonmagical Attacks`.

The profile remains additive/localizable: absence of profile evidence proves nothing about an unknown language.

## 3. No semantic enrichment change

Product-level derived saves remain unchanged. When printed saves omit an ability and no printed Save-column overrides it, the editable/product compiler may still expose the ordinary ability modifier as the fallback save. That behavior is intentional and unrelated to parser ownership.

## Regression coverage

Added/updated direct-transport regressions verify that:

- a weak strong compact-label continuation is absorbed into the preceding feature;
- wrapped header continuations between grounded header anchors are absorbed into the preceding header;
- an explicit localized model section heading is never erased by continuation closure;
- an exact Fraz-Urb'luu mixed regression survives an intentionally wrong model response where `Slashing...` is classified as a feature, `Poisoned` is unclassified, and `Hit:` is classified as a separate feature.

## Validation in the sandbox

Project runtime dependencies are still unavailable, so the authoritative Windows dependency-backed suite must be run by the user. Sandbox validation used `tsc --noCheck` emission followed by Node tests.

- targeted relevant suite: **107/107 passed** before the exact Fraz regression was added;
- final `candidateTransport` suite including exact Fraz regression: **14/14 passed**;
- wider emitted suite: **314 runnable tests passed**; **8** test files failed to start because runtime `zod` is unavailable; there were no assertion failures among runnable tests.

Full `npm test` / dependency-backed `npm run typecheck` were **not** run in the sandbox.
