# v2.43.0 — trust-boundary repair and LLM-owned section headings

This is a repair release after the v2.42 diagnostics exposed a user-visible text-loss path and an English-only section-heading assumption.

## 1. Product-loss firewall

- Product header compilation now stops at the first structural body block.
- Any later source part is rendered in body even if a conflicting layer attached a header field semantic to it.
- Body-owned text therefore cannot disappear merely because a verifier/deterministic claim was wrong.
- Regression fixture covers the Nabassu `Magic Resistance ... saving throws against spells ...` failure.

## 2. Verifier cannot own structural body

- Essential claims at/after the structural body boundary remain diagnostics-only.
- Deterministic-only AC/HP/save scanning is now limited to that same structural header range; it cannot re-introduce a rejected verifier claim from body prose.
- English `Saving Throws` deterministic recognition now requires actual ability/save-shaped content after the label, so prose beginning with `saving throws against ...` is not a header field.

## 3. Identity conflict repair

- When the structural LLM returns overlapping `name` and `size_type_alignment` spans at the trailing edge of the name, reconciliation carves the shared classification candidates out of the name.
- Independent name verification can confirm the structural span, fill a missing name, or record disagreement; it cannot widen an already grounded structural name.
- This addresses the repeated Tiamat `C000-C001 name` + `C001 STA` self-contradiction without inventing content.

## 4. Section heading text is no longer predefined

- Structural generation now allows `sh` spans and requires the LLM to assign only a semantic bucket (`traits`, `actions`, etc.).
- The printed heading text itself may be English, Ukrainian, Russian, or homebrew wording.
- Candidate reconciliation, quote anchoring, and annotation compilation no longer validate heading text against an English dictionary and no longer recover omitted headings deterministically.
- No hidden `Actions`/`Legendary Actions` word list is required by the candidate path.
- The semantic section bucket remains because it is useful for grouping body content and card/editor rendering.

## 5. Localized critical header fields

- Reconciled explicit critical field ownership from the verifier is preserved by candidate transport even if the English deterministic classifier does not recognize the printed label.
- Once AC/HP semantic ownership is grounded, product facts parse the first printed integer rather than requiring an English label.
- A Russian smoke fixture resolves `Класс Доспеха 20` -> AC 20 and `Хиты 297` -> HP 297.

## Validation actually run

- 29 targeted candidate-reconciliation + editable-compiler tests passed.
- 12 annotation-compiler tests passed.
- 8 candidate-transport tests passed.
- 3 prompt tests passed.
- Runtime smoke tests passed for:
  - Tiamat identity overlap;
  - Nabassu Magic Resistance product preservation;
  - localized Russian `Действия` section heading;
  - Russian critical name / AC / HP and `Легендарные действия`.
- Full source and frontend TypeScript syntax/type-shape transpilation (`--noCheck`) passed.
- Full dependency-backed npm suite was not run in this sandbox because `node_modules`/`zod` are unavailable.
