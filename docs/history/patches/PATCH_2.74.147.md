# Patch 2.74.147 — narrow mixed geometry robustness

## Scope

This patch intentionally changes **mixed BODY normalization only**. Singleline 2.74.146 behavior is left untouched for a separate follow-up. No model call is added, no BODY semantic taxonomy is introduced, and source text remains immutable.

## 1. Missing whitespace after a feature-title terminator

Trusted physical-line title discovery now tolerates one missing whitespace character after `.`, `!`, or `?` when the following character is uppercase. Example:

`Possession.One creature ...`

is treated as having the same **source-shape possibility** as `Possession. One creature ...`.

The source itself is never rewritten. The change only adds the same `named_block_start` evidence that an otherwise identical trusted physical row would receive. Inline/collapsed discovery remains stricter, so ordinary prose such as `attacks.It` is not globally promoted.

## 2. Preserve trusted title-case standalone physical rows

2.74.145 already preserved a compact standalone ALL-CAPS physical BODY row and the following physical BODY row as separate logical lines even when the mixed BODY model omitted one of those starts. 2.74.147 extends that same geometry-only protection to a conservative title-case standalone row such as:

`Legendary Actions`

The new hint is deliberately narrow:

- the row must already be a trusted physical line start;
- it must satisfy the existing standalone heading surface shape;
- cased scripts require either one compact capitalized word or at least two capitalized word starts covering at least half of the cased words;
- ordinary sentence-shaped rows such as `The creature moves` are rejected;
- ALL-CAPS rows keep the existing 2.74.145 path;
- no vocabulary or section identity is encoded.

The deterministic guarantee remains purely geometric: the standalone row and the next surviving physical BODY row are kept as two logical rows. The shared multiline parser still decides presentation/structure afterward.

## Tests / validation

Added regressions for:

- `Possession.One creature ...` receiving trusted named-rule start evidence without rewriting source;
- `Legendary Actions` receiving the new mixed-only standalone-row hint;
- `The creature moves` not receiving that hint;
- pipeline regression coverage for a model that omits both the title-case standalone row and its explanatory row.

Validation available in this container:

- `sourceCandidates.test.ts` + `deterministicHints.test.ts`: **32/32 passed** using a temporary local TypeScript compile with Node type stubs;
- changed production modules `sourceCandidates.ts` and `deterministicHints.ts` compile cleanly;
- `pipeline.ts` compiles cleanly with a temporary local `zod` type stub.

The full repository suite was not run because this archive does not contain installed dependencies. Temporary stubs were removed before packaging.
