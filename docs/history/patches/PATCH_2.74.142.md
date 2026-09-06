# 2.74.142 — model-agnostic mixed BODY normalization guidance

This release keeps the 2.74.141 canonical architecture intact and improves only the information given to the mixed BODY normalization model plus one presentation-only Auto Style bug.

## Mixed BODY prompt

The mixed BODY LLM still returns only `{"starts":[{"s":"Cxxx"}, ...]}`. It receives no semantic output vocabulary and cannot return end coordinates or BODY roles.

The system prompt now contains seven compact few-shot examples covering characteristic shapes from the regression suite: wrapped comma lists, wrapped named entries, internal colon labels, standalone ALL-CAPS lines, introduced nested lists, multilingual text, and misleading visual/paragraph wrapping.

The examples teach only multiline geometry. They never classify output as feature, action, metadata, heading, section, etc.

## Deterministic shape evidence

Mixed BODY candidates now expose the already-computed boundary `evidence` and `continuationEvidence` codes instead of hiding the reason behind a strength value. Existing evidence includes title shape, paragraph/physical geometry, lowercase continuation, trailing separators, open lines, numeric/bracket starts, compact labels, and internal list sequences.

A new mixed-only `all_caps_standalone` advisory hint identifies compact standalone all-caps physical lines in cased scripts. It does not create a deterministic boundary or assign semantic meaning.

The mixed generation schema now also declares the returned start objects as `uniqueItems`, reducing pathological repeated-start output when supported by the model's structured decoder. The deterministic parser still deduplicates defensively.

## Auto Style

A short printed header-style row such as `Condition Immunities poisoned`, `Damage Immunities radiant`, or `Languages None` can superficially satisfy the generic standalone-heading shape. If an imported node already arrived typed as a heading, Auto Style previously preserved it, even though manually demoting it and running Auto Style again produced the correct bold label.

Auto Style now detects its already-supported printed `label + non-empty value` presentation shape before preserving a heading node. Such stale headings are demoted to paragraphs and receive the normal printed-label styling. This is presentation-only: source ownership and BODY semantics do not change.

## Architecture guardrails

No mixed BODY semantic taxonomy was reintroduced. Mixed remains:

`exact BODY -> mixed-specific hints + one LLM geometry call -> virtual multiline BODY -> shared deterministic multiline parser`

Singleline is intentionally unchanged in this release and will receive a separate normalization prompt/hint profile later, targeting the same multiline-start output.

See `BODY_NORMALIZATION_HINTS.md` and `CANONICAL_PARSER_ARCHITECTURE.md`.
