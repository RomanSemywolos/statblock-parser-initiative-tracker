# Patch 2.74.168 — Header inline range adapter + lossless structural classes

## Scope

This patch remains inside the Header transport A/B migration. It adds no parser semantics, no new candidate evidence, no candidate pruning, and no production authority change. The legacy Header call remains authoritative; the inline call remains diagnostics-only. BODY, source ownership, language-neutrality, ability semantics, and reconstruction are unchanged.

The patch addresses two findings from the 2.74.167 corpus without mixing in any unrelated redesign.

## 1. Inline right-edge coordinates now match the representation

The 2.74.167 model repeatedly treated an inline marker at the start of the next candidate as the right boundary of the previous fact. That is the natural interpretation of markers inserted *between* source characters, but the existing parser contract stores inclusive candidate spans.

The inline prompt now states the transport convention as `[s,e)`: `s` is the marker before the fact and `e` is the first marker after it. A shadow-only adapter converts that boundary representation back to the established inclusive candidate range before `candidateHeaderFacts()` or deterministic Header validation sees it.

Example:

- model-facing source: `⟦C002⟧Armor Class 18 ⟦C003⟧Hit Points ...`;
- inline model answer: `ac C002-C003`;
- adapter result: legacy span `C002-C002`.

The current overlay deliberately adds no EOF sentinel because candidate-set/coordinate-set changes remain out of scope. If no later marker exists at EOF, `s===e` is retained as the explicit single-candidate fallback. This does not affect ordinary Header facts, which are followed by later source coordinates in complete statblocks.

The generic `resolveHeaderCoordinateRange()` helper retains the legacy inclusive semantics; only the shadow response adapter knows about `[s,e)`. Production parsing therefore cannot accidentally inherit the transport convention.

## 2. Existing structural evidence is dictionary-compressed, not removed

2.74.167 serialized the full existing structural signature on every coordinate, for example:

`⟦C043|lpsn;TSplTs;N⟧`

That preserved fidelity but tokenized poorly. 2.74.168 keeps exactly the same information and replaces repeated signatures with per-request structural classes:

`⟦C043|7⟧`

with a lossless class table such as:

`7=lpsn;TSplTs;N`

The class ID has no semantics. Classes are assigned deterministically in first-occurrence order and are only a dictionary encoding of the already-existing candidate reasons, boundary scope/strength/evidence, continuation strength/evidence, and (for collapsed singleline) the existing structural/address/mixed plus synthetic role. No evidence is inferred, strengthened, weakened, added, or omitted.

Repeated candidates with the same structural signature now pay the signature cost once per request instead of once per marker. The raw source and all candidate starts remain unchanged, and overlay stripping still reconstructs the exact source.

## Diagnostics

Header prompt metrics now also record:

- `shadowStructuralClassCount`;
- `shadowStructuralClassLegendCharacters`.

This makes the dictionary cost visible in the next A/B report.

A deterministic reconstruction of the 14-report 2.74.167 corpus predicts about **158,602 request characters** for the 2.74.168 shadow requests versus **194,696** legacy request characters, or **18.54% aggregate character reduction**. This is about **1.65% fewer request characters than 2.74.167 shadow transport** even after adding the explicit `[s,e)` instruction. This is only a character estimate; the next real model run must determine actual tokenizer cost.

## Deliberately unchanged

- legacy Header request and authority;
- fixed Header kinds and semantic rules;
- exact printed ability-label contract;
- candidate generation and candidate count;
- candidate pruning/projection;
- deterministic language policy;
- BODY normalization/classification;
- source ownership and reconstruction.

## Validation

- `tsc --noEmit` — PASS
- `tsc` — PASS
- compiled core suite — **584/584 PASS**

New/updated regression coverage verifies the inline `[s,e)` to legacy-inclusive adapter, same-coordinate EOF fallback, lossless structural-class reuse, preservation of collapsed-singleline roles, exact overlay reversibility, and continued shadow-only authority.
