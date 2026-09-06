# Patch 2.74.101

Regression repair and documentation sync on top of 2.74.100.

## Tests

- `headerFacts.test.ts` now keeps the bounded header-scan mock response strictly
  schema-shaped. Fixture-only `__bodyStartQuote` and verifier-only
  `essentialFacts` no longer leak into the strict header scan.
- The independent card-fact verifier still receives its own remapped candidate
  coordinates by source offset, so the Tiamat and Rak early-boundary tests now
  exercise the intended production path.
- Tiamat/Rak visibility assertions now test plain visible content rather than raw
  Markdown text. Auto Style may legitimately bold labels such as `Speed` or
  `Skills`; that presentation markup must not make a source-visibility test fail.

## Product compiler

- `armor_type` remains outside the fixed structured-header field set.
- When an `armor_type` fragment is source-owned beside `armor_class`, the compiler
  may use it only as presentation companion text for the AC row. Thus a verified
  AC value of `17` does not erase printed text such as `(natural armor)`.
- No new parser ownership or card-critical fact kind is introduced.

## Documentation

- README now states the current lossless / routing / fixed-header architecture and
  the integrated `TranslationProvider` / LibreTranslate layer.
- `EVIDENCE_AUTHORITY_2.74.62.md` is updated to reflect boundary-independent
  critical-fact extraction without ownership relocation.
- The thesis note is synchronized with multiline BODY specialization, the nine
  fixed critical fact kinds, and the fact that LibreTranslate integration exists
  while final MT quality evaluation is still pending.

## Verification

Run:

```bash
npm run typecheck
npm test
```

Container verification after the repair: TypeScript typecheck/build succeeded and
all 456 compiled-JS tests passed. The user-side `npm test` remains the authoritative
check for the original Windows dependency environment.
