# Patch 2.74.100

Test-harness repair on top of 2.74.99. No parser/routing behavior was added.

## Why the remaining three tests failed

1. The fixed-header integration fixture advertised `__bodyStartQuote` but the mock
   header model ignored it and always placed the boundary at the first real section
   heading. The tests therefore did not exercise the intended early-boundary case.

2. The structural header scan and the independent card-fact verifier use different
   candidate arrays after an early boundary. The fixture reused header-scan Cxxx
   coordinates for the verifier. Production does not do that.

3. The AC fragment compiler test injected `(natural armor)` only into annotation
   text and fake offsets; those bytes were absent from `rawSource`, violating the
   project's lossless grounding invariant.

## Changes

- `fixtureCaller()` now honors `__bodyStartQuote`.
- The test harness reconstructs the same combined verifier candidate lattice as
  production and remaps verifier facts by source offsets.
- The AC fragment test now inserts ` (natural armor)` into the actual raw source,
  updates the source map/offsets, and creates a real source-owned fragment before
  checking product rendering.
- Version metadata bumped to 2.74.100.

Production parser, BODY routing, header field set, verifier prompt, and fixed-header
semantics are unchanged from 2.74.99.


## Post-run erratum

A later compiled-JS run showed that 2.74.100 did not fully close the three
remaining failures. Two fixed-header integration fixtures still leaked
fixture-only/verifier-only fields into the strict header-scan envelope, and the
AC qualifier test exposed a real compiler presentation regression: `armor_type`
was filtered out before the AC row attempted to fold it back into presentation.
These are repaired in 2.74.101.
