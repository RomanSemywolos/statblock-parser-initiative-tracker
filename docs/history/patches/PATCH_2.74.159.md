# 2.74.159 — active parser language-neutralization

This patch removes deterministic English semantic privilege from the active parser.

Production changes:

- shared candidate/Header lattice no longer calls the English candidate evidence
  profile;
- Header transport no longer infers semantic fields from the English Header lexicon;
- ability identity is no longer inferred/confirmed from literal
  `STR/DEX/CON/INT/WIS/CHA` source text;
- six ability identities now require grounded LLM `abilityLabels`, while all numeric
  and layout validation remains deterministic;
- source-only canonical English ability recovery now abstains;
- ownership-first truncated ability repair uses language-neutral content-unit and
  column-consistency evidence;
- active multiline BODY feature-shape helpers were split into `featureShape.ts` so
  the BODY classifier does not depend on the English Header classifier module.

Preserved invariants:

- fixed Header contract is unchanged;
- Header is not a prefix and no `bodyStart` returns;
- mixed/singleline BODY still uses exactly one starts-only normalization call;
- multiline BODY remains deterministic and model-free;
- source coordinates/text/coverage remain deterministic authority;
- canonical internal keys such as `str`/`dex` remain valid after LLM semantic mapping;
- presentation/translation may still contain English vocabulary without feeding parser
  semantics.

Validation:

- `tsc --noEmit`: PASS
- compiled Node test suite: 563/563 PASS
