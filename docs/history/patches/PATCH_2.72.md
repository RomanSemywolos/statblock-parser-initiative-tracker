# 2.72.0 — top-level routing evidence + canonical multiline presentation

This patch addresses the Demogorgon case where a clean multiline source was routed as `mixed`, and completes the presentation rule for blank source rows.

## Architectural review

The prior direction remains valid: source geometry, semantic ownership, and product presentation are separate concerns. The problem was that Auto routing still used a flatter structural heuristic than the parser itself. Confirmed numbered subeffects such as `1. ... / 2. ... / 3. ...` could create several title-like punctuation anchors on physical lines and were incorrectly counted as evidence of collapsed top-level structure.

No statblock vocabulary or feature names were added.

## Auto routing

Routing now treats a confirmed sequential list (`1 -> 2 -> 3` or `A -> B -> C`) as **internal hierarchy evidence** and neutralizes those lines for top-level collapse scoring. This means:

- clean multiline header/body + numbered subeffects => `multiline`;
- genuinely collapsed body such as `Actions Multiattack. ... Bite. ...` => still `mixed` when combined with a clean multiline region;
- fully collapsed input remains `singleline`.

A diagnostic `internal_list_geometry` signal records when this neutralization was used.

The definition of `mixed` is therefore stricter: a mixed source must contain both a clean multiline region and a locally proven **top-level** collapsed region. Internal lists and continuation rows do not qualify.

## Product presentation

`normalizeBodyPresentationText()` still preserves every non-empty physical source row, but now collapses all empty source rows from product presentation:

`line A\n\nline B\n\n\nline C` -> `line A\nline B\nline C`.

Raw source, source map, spans, and reconstruction are untouched. Blank lines remain recoverable evidence; they simply no longer become visual spacing in the editable/rendered statblock.

This keeps the intended separation:

- raw/evidence layer: exact source;
- semantic layer: feature/section ownership;
- product presentation: canonical statblock layout.

## Regression coverage

Added regression coverage for:

1. a Demogorgon-like clean multiline statblock with `1/2/3` Gaze subeffects routing to `multiline`, not `mixed`;
2. existing genuine mixed/collapsed cases remaining unchanged;
3. blank source rows being removed while non-empty multiline geometry remains;
4. compiler-level preservation of non-empty internal feature rows after Auto Style.

Targeted parser/presentation/multiline/source-candidate tests pass 32/32; boundary-evidence test passes 1/1; the new compiler-level presentation regression passes 1/1. Production `parserRouting.ts` and `normalizer.ts` pass strict targeted TypeScript checking. The pre-existing full `editableCompiler.test.ts` suite is not claimed as green because two unrelated baseline expectations already disagree with current Auto Style / initiative provenance behavior.
