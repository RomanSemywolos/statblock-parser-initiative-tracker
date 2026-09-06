# Patch 2.74.38 — mixed boundary evidence is now authoritative

## Problem
Mixed/generic parsing still produced the same continuation splits after 2.74.37. The boundary layer correctly demoted bare physical newlines to `unknown/weak`, but the generic model prompt did not include boundary metadata at all, and the deterministic feature splitter still had legacy paths that could promote a line/title shape without positive boundary evidence. Mixed candidate suppression also risked hiding real boundaries in localized or uncased text.

## Changes
- Generic/mixed model proposals now include `boundary=scope/strength` and evidence, matching the information already available to single-line mode.
- The structural prompt explicitly defines `weak`, `strong`, and `hard`: a physical newline alone is not positive top-level evidence in mixed input.
- Structural rules no longer name English/5e continuation labels such as Hit/Failure/Success; they describe compact labelled mechanics/resolution rows by shape.
- Generic enrichment now keeps every non-empty physical line start as a candidate coordinate. These coordinates remain weak unless independent source shape promotes them. This preserves flexibility for localized, homebrew, non-Latin, and uncased scripts.
- Deterministic feature-boundary enforcement no longer treats `line_start` or a multiword title-like string as sufficient to split a model-owned feature. It requires independent positive boundary evidence.
- Existing multiline geometry is unchanged. Single-line specialization is unchanged.

## Target behavior
For mixed input:
- wrapped `reach 30 ft...` -> candidate exists, `unknown/weak`, physical-line evidence only;
- line-leading `Label: ...` continuation -> candidate exists, `unknown/weak`, plus optional vocabulary-free continuation hint when source shape supports it;
- real peer feature such as `Bite. ...` / `Claw. ...` -> independently title-shaped, `top_level/strong` or stronger.

## Validation
- Targeted emitted suite: 119/119 passed.
- Wider emitted suite: 305 runnable tests passed; 8 test files could not start because the sandbox lacks runtime `zod`, with no assertion failures among runnable tests.
- `tsc --noEmit --noCheck` over `src/*.ts` passed.
- Exact mixed example inspection confirmed the model prompt now receives weak evidence for `reach...` and line-leading continuation labels, while peer named features receive positive top-level evidence.
