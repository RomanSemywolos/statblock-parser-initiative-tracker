# 2.74.25

Reconciliation contract fix.

- Adds the missing symmetric safety path for a model-classified `header_field` that has no independently proven field and no deterministic header semantics, but does have strong source-grounded named-feature shape.
- Such a run is reclassified to `feature` with `candidate_header_reclassified_as_feature` instead of silently surviving as `other_header`.
- The guard requires `run.field === null`, `deterministicHeader === null`, and strong feature-start evidence, so verified/known headers are untouched.
- Adds a direct reconciler regression test; candidateReconciler suite is 23/23 locally.
