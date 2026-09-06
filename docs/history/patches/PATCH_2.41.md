# v2.41.0 — separate card-fact verification pass

This patch removes the v2.40 multi-task interference between structural segmentation and card-critical extraction.

## Structural pass

- The primary LLM request is structural again: `blocks` + `abilityLabels` only.
- It still receives and reads the complete source and the complete ordered candidate lattice.
- No deterministic section/header scaffold is injected into the prompt; homebrew wording remains visible to the model as ordinary source.

## Independent essential verification

- A second, deliberately narrow request reads the same complete source in order and returns only grounded spans for name, AC, HP, the six-ability region, and printed saves.
- Its schema has only `essentialFacts`; it cannot emit body blocks, headings, features, or section roles.
- `numPredict` is capped at 768 because the response can contain at most five tiny spans. The full context is preserved (`numCtx` unchanged).
- Failure or invalid JSON is non-fatal: the successful structural parse is retained unchanged and a diagnostic issue records the verification failure.

## Collaboration / safety boundary

- Valid verifier claims are reconciled with deterministic evidence as in v2.40: agreement, model-only evidence, deterministic-only evidence, and explicit conflicts.
- A verifier claim is not allowed to reshape source that the structural pass already placed in the body. Such a claim produces `essential_fact_outside_structural_header` instead.
- This keeps verification useful for odd/homebrew header wording without giving the second pass authority over feature segmentation.

## Diagnostics

Parse reports now additionally retain the exact verification request, raw verification response, parsed grounded facts, issues, elapsed time, and provider performance metrics. Timing separates structural and verification model-call time.

## Regression coverage added

- structural schema no longer contains `essentialFacts`;
- essential verification has its own tiny schema/parser;
- structural and verification requests are distinct;
- verification failure cannot erase a successful structural parse;
- verifier claims pointing into the structural body cannot reclassify body content.
