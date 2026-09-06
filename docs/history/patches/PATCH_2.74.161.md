# 2.74.161 — language-neutral ability/saving-throw regression repair

This corrective patch is based on 2.74.159. The 2.74.160 singleline Header projection is intentionally NOT included.

## Why this patch exists

2.74.159 correctly removed active English-vocabulary semantics, but it exposed and amplified a hidden dependency in ability recovery:

- `abilityLabels` from the fixed Header LLM were discarded unless the same response also contained an `ab` region claim;
- a model that correctly supplied `Сил -> str`, `Лов -> dex`, ... but omitted `ab` could no longer seed deterministic table recovery;
- some small-model responses use one candidate coordinate (`q:"C005"`) instead of the literal printed label; those mappings were previously lost;
- saving throws then degraded secondarily because the canonical ability identities were unavailable.

## Corrected contract

`abilityLabels` are independent semantic evidence. An `ab` claim is useful but is not a prerequisite.

The active contract is now:

1. LLM supplies semantic identity only: printed label -> `str|dex|con|int|wis|cha`.
2. Deterministic code grounds all six labels in exact source coordinates and requires one unique tight ordered chain.
3. Deterministic numeric/table constraints prove the exact six-ability region.
4. The proven region may be promoted to Header ownership without using any language dictionary.
5. Exact candidate references such as `q:"C005"` are accepted only when that one coordinate resolves to one compact printed source token; they are converted to the exact printed label before semantic grounding.
6. Saving-throw parsing continues to use only the model-grounded printed labels plus deterministic signed-number/source-shape checks.

No `STR`/`DEX`/English label dictionary was restored to the active parser.

## Edge-repair clarification

The 2.74.159 right-edge column-completion guard is retained. Testing shows it is not the cause of the broad regression: it prevents a collapsed verified region from stopping after the sixth score while dropping the sixth printed modifier/save. It is language-neutral and does not assign ability semantics.

The broad regression was instead caused by dropping otherwise-correct model label mappings when `ab` was omitted.

## Regression coverage

Added tests prove:

- Russian/localized six-label mappings recover all six abilities even when `ab` and `sv` are omitted;
- adjacent printed saves are recovered without a Russian/English save-label dictionary;
- candidate-coordinate label hints resolve to exact printed source labels;
- source-only English probing remains disabled;
- existing localized truncated-region behavior is preserved.

## Validation

- targeted strict TypeScript check: PASS
- compiled core test suite: 566 / 566 PASS
- no 2.74.160 Header projection code is included
