# 2.74.78 — language-neutral structural quality repair

> Historical note: the proposed narrow LLM pass for localized multiline section headings was later superseded by 2.74.83/2.74.84. Clean multiline BODY now requires no BODY LLM; presentation-only headings are structural and semantic section identity is deferred unless a product feature explicitly needs it.


This patch addresses regressions visible when comparing the 2.74.77 corpus with 2.74.68.

## Production changes

1. **Safe bounded-header windows**
   - bounded scans no longer truncate a physical multiline row in the middle;
   - collapsed/mixed scans avoid cutting inside weak/internal candidate runs when a nearby top-level boundary is available;
   - this changes excerpt geometry only. Candidate evidence still does not decide semantic header/body ownership.

2. **Mandatory semantic identity for header fields**
   - every bounded-header block now carries `f`; `n/sta/u` use `f=none`; every `h` must use a real semantic field code or `oth`;
   - this prevents English deterministic enrichment from being the accidental reason English headers are richer than localized ones.

3. **Deterministic standalone saving throws**
   - the production header request no longer asks the model to read numeric save bonuses;
   - once a source span is grounded as `saving_throws`, deterministic code pairs grounded canonical/model ability labels with the immediately printed signed integer;
   - model-provided numeric save facts remain accepted only as compatibility fallback when deterministic extraction did not already prove the same fact.

4. **Body heading structural sanitizer**
   - a body-model `sh` claim is accepted only when its printed span has compact heading shape;
   - a source-proven named rule misclassified as `sh` is merged with contiguous feature/rules prose into one feature;
   - implausible heading claims without independent named-rule evidence are left unowned for the lossless partitioner rather than fabricating a section boundary.

5. **Optional profile heading correction generalized**
   - when an exact optional English profile anchor proves a printed section heading, it may correct a wrong section subtype as well as fill a missing subtype;
   - this is enrichment only and is not required for language-neutral correctness.

## Deliberately not included

Localized multiline section-heading semantics (`Действия`, `Легендарные действия`, etc.) remain a separate next step. The intended solution is a narrow semantic pass over structurally proven standalone heading candidates, not language dictionaries and not broad LLM parsing of deterministic multiline body.

> Superseded by 2.74.83–2.74.85: clean multiline does not run a BODY semantic section pass, and active pre-LLM candidate evidence no longer contains language-profile section anchors.
