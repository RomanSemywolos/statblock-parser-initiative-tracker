# Patch 2.74.108

## Purpose

Remove the active English-only Auto Style section-heading rescue and replace it with a language/vocabulary-free presentation rule, then audit remaining hardcoded English production paths.

## Production change

- Removed `AUTO_STYLE_EXACT_SECTION_HEADINGS`.
- Added contextual presentation-only heading rescue:
  - current paragraph must have standalone heading shape;
  - following paragraph must begin with a source-shaped named rule;
  - rescued heading is always `headingKind: null`;
  - wording alone never promotes a paragraph.
- No parser ownership, section identity, source placement, candidate transport, evidence, CR/PB, or fixed-header behavior changed.

## Tests

Added metamorphic/multilingual coverage proving identical rescue behavior for English, Ukrainian, Russian, homebrew English wording, and arbitrary Unicode wording, plus negative metadata/wording-only cases.

Targeted `editableDocument` TypeScript compile passed and its compiled test suite passed 57/57. Full repository typecheck remains unavailable in this container because the copied dependency tree is missing `zod` and `undici`.

## Audit result

See `AUDIT_HARDCODED_ENGLISH_2.74.108.md`. The remaining old English section dictionary is legacy-only. `headerLexicon.ts` is active explicit English profile enrichment; it does not control visibility, but its candidate-lattice addressability asymmetry should be handled in a separate architectural patch.
