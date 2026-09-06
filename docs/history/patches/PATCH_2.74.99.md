# Patch 2.74.99

Narrow regression repair on top of 2.74.98.

## Production fixes
- Reconcile the proof-safe trailing `name` / creature-classification overlap before generic structural overlap rejection. This lets `Aspect of Tiamat` keep the unique name prefix while the independently grounded classification owns its trailing row.
- Preserve complete source-owned AC/HP/Initiative rows in the editable header when available. Structured numeric facts prove card values; they no longer erase source qualifiers such as `(natural armor)`.
- Preserve an explicitly semantically-owned printed Initiative row for direct/legacy compiled documents even when `structuredHeader.initiative` has not yet been materialized. DEX-derived initiative is only the fallback when no printed Initiative row exists.

## Test fixes
- Fixed the new candidate-transport regression test to inspect annotation unit ranges through the annotation itself rather than a nonexistent `.source` property.
- Fixed the new fixed-header integration fixtures to use the actual universal-header candidate lattice (`headerCandidates`) used by the header model/verifier, rather than BODY-routing candidates.

No routing, BODY parser, LLM call architecture, or header-field set was changed.
