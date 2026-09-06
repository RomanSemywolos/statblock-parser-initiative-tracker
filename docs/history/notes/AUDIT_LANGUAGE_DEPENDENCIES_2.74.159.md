# Audit: deterministic language dependencies — 2.74.159

## Rule

The active parser must not obtain semantic advantage from a printed-language lexicon.
Deterministic code may reason about source geometry, punctuation, numeric/mechanical
constraints, source coordinates, and canonical internal field/ability keys *after*
the model has supplied semantic identity. It must not infer or confirm semantic
identity because the source literally says `Armor Class`, `STR`, `DEX`, etc.

This distinction is important:

- allowed: the Header LLM grounds printed `СИЛ` and returns `str`; deterministic code
  then validates the grounded label position and numeric score/modifier structure;
- allowed: internal/product code calls the canonical ability key `str` or renders
  `STR` as an English UI/presentation label;
- forbidden: parser candidate geometry gets stronger because source says
  `Armor Class`;
- forbidden: source `STR` is treated as Strength without a model-grounded mapping;
- forbidden: a candidate becomes `initiative`, `hit_points`, etc. because an English
  label matched a deterministic lexicon.

## Findings before 2.74.159

Three active-path violations were found.

1. `candidateLattice.ts` unconditionally called
   `createEnglishCandidateStructuralEvidence(rawSource)`. English header labels and
   the literal `STR DEX CON INT WIS CHA` sequence could add candidate/boundary
   evidence (`profile_header_anchor` / `profile_header_internal`). This affected the
   shared Header lattice used by multiline, mixed, and singleline modes.

2. `candidateTransport.ts` could fall back to
   `classifyDeterministicHeaderField(range.text)`, which uses the English header
   lexicon. Thus a source span could receive semantic Header field identity from
   English text rather than the verifier/model.

3. `headerFacts.ts` and `abilityTableResolver.ts` treated literal English canonical
   ability abbreviations as semantic evidence. In particular, source-only
   `STR/DEX/CON/INT/WIS/CHA` recognition could recover/confirm ability identity even
   when the LLM supplied no `abilityLabels` mapping.

These behaviors violated language neutrality even though they were intended as
additive/fallback evidence.

## Changes in 2.74.159

### Candidate lattice

The active `prepareCandidateLattice()` now supplies an empty, language-neutral
`CandidateStructuralEvidence` object. No English profile is consulted by the active
candidate lattice or Header lattice. The field is named `structuralEvidence` to avoid
implying a selected language profile.

The old `englishCandidateEvidence.ts` helper remains only for low-level legacy/tests;
it is not imported by the active parser path.

### Header semantic field identity

`candidateTransport.ts` no longer uses the English deterministic Header classifier as
a semantic fallback. Semantic Header identity must come from verifier/model output;
deterministic code only validates compatible source/mechanical shape.

### Ability semantic identity

The active structured Header path no longer recognizes `STR/DEX/CON/INT/WIS/CHA`
directly from source as canonical semantic identities.

Ability resolution now requires model-grounded `abilityLabels` containing all six
printed-label -> canonical-key mappings. Once those mappings are grounded,
deterministic code still owns:

- exact source coordinates;
- order/uniqueness of the six grounded labels;
- score extraction;
- modifier arithmetic;
- printed modifier/save validation;
- matrix/interleaved layout constraints;
- minimal right-edge repair of a verifier-truncated ability region.

The old source-only canonical ability probe now deliberately abstains instead of
assigning English semantics.

### Right-edge repair

Removing the English semantic shortcut exposed a real geometry issue in collapsed
ability tables: a verifier span ending at the final CHA score could either stop before
the printed modifier or expand into a following standalone save row. The ownership-
first repair now uses source content-unit boundaries and language-neutral column
consistency: if the first five ability cells all carry a printed modifier/save column,
the sixth cell must carry that column as well before the repair is considered complete.

### BODY feature shape

The language-neutral named-feature shape helpers used by the active multiline BODY
classifier were moved to `featureShape.ts`. The active multiline classifier therefore
does not depend on the English Header classifier module merely to get punctuation/title
shape functions.

## Intentionally retained English code

English vocabulary still exists where English is the *data/presentation language*, not
parser authority:

- `headerLexicon.ts` and `headerClassifier.ts` remain for presentation/translation and
  legacy compatibility callers;
- translation/UI code may render or recognize English labels after semantic field
  identity already exists;
- canonical internal keys are still `str`, `dex`, `con`, `int`, `wis`, `cha`.

None of these retained pieces are allowed to feed the active candidate lattice,
Header ownership, verifier acceptance, or structured ability identity. Architecture
regression tests now enforce that separation.

## Validation

- system `tsc --noEmit`: PASS
- compiled core test suite: 563 / 563 PASS
- new architecture regressions verify:
  - active parser modules do not import `englishCandidateEvidence` or `headerLexicon`;
  - prepared English singleline input receives no `profile_header_anchor` or
    `profile_header_internal` boundary evidence;
  - direct English source-only ability probing abstains;
  - model-grounded ability mappings still permit deterministic numeric recovery.
