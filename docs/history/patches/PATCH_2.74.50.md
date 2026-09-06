# Patch 2.74.50

## Goal
Restore the boundary between candidate geometry, semantic ownership and product presentation after the multilingual dense-lattice changes, while strengthening the project's zero-loss contract.

## Lossless invariant strengthened
A source fragment may be used as deterministic evidence without becoming disposable.

**Evidence may inform interpretation, but source-visible material must remain user-visible unless semantic equivalence is proven.**

In particular, repeated ability-table presentation labels such as:

```text
mod
save
mod
save
mod
save
```

may help prove that the following rows form an ability table, but they are not claimed by the promoted `ability_scores` annotation. The promoted region starts at the first proven ability label (`Str`/equivalent). The prefix remains independently source-owned and reaches the editable document as visible, removable content.

Regression coverage now asserts both parser-level preservation and final editable-document visibility for all three `mod` and all three `save` rows.

## Initiative
- Added modern compact `Initiative` to single-line English profile evidence.
- A coarse header span may split at an independently grounded Initiative anchor.
- Printed initiative fact extraction trusts semantic ownership and reads the signed modifier without requiring the English word itself.
- Prevents `AC 17 Initiative +7 (17)` from falling back to an automatically derived DEX initiative.

## Dense candidate lattice is not product structure
- Coordinates inside a profile-proven multi-word field label are hard-internal geometry.
- Weak/unowned dense coordinates between proven boundaries do not become editable rows merely because they exist.
- Same-physical-row fragments inside a compact profile-grounded field remain inside that field until another independent boundary.
- This addresses splits such as `Armor / Class`, `Hit / Points`, `Saving / Throws`, and tokenized immunity values.

## Continuations
- Bracket-led physical rows such as `(60 ft. with Mistlight Steed)` are strong continuations of the preceding field.
- Source-proven wrapped header continuation can correct a mistaken body classification, but cannot erase separately model-owned header rows without relational continuation proof.
- Standalone feature title + following weak prose row close into one feature block.
- Header interval closure stops at independently model-owned body blocks, preventing late body text from being swallowed by the final header field.

## Implicit traits and mixed body structure
- Consecutive unknown named-rule-shaped spans before an explicit section can form an implicit traits region instead of editable header rows.
- Hybrid bullet sequences are recognized when the first bullet follows an introducing colon on the same line and later bullets continue on following physical lines.

## Localized semantics
- Grounded localized saving-throw rows can be classified from already grounded ability labels without an English label dictionary.
- Added a real `description` section kind through schema/transport/product/editor/translation flow so localized `Опис` / `Описание` / `Description` headings can remain standalone blocks.
- Auto-style/header presentation expanded for localized saving-throw labels.

## Ability-table ownership
- Source-only ability recovery remains bounded to the first proven ability label and never walks backward through unresolved metadata.
- Repeated two-label column prefixes can be observed as evidence but remain outside `ability_scores` ownership.
- This preserves noise for user review instead of hiding it.

## Validation in the available sandbox
- Targeted resolver/transport/editable suite: 46/46 passed after the strengthened user-visible preservation assertion.
- Broader emitted suite: 347 test entries; 339 passed; 8 startup failures caused by missing sandbox dependencies (`zod` / `undici`); 0 assertion failures among runnable tests.
- Full dependency-backed `npm test` and normal `npm run typecheck` still require the user's dependency-complete Windows environment.
