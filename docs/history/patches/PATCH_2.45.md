# v2.45.0 — explicit styling, closed product header, cleaner structural prompting

This patch builds on the v2.44 structural-ownership reset. It deliberately keeps
source ownership with the structural LLM/candidate partition while making the
product editor degrade more safely when that structure is wrong.

## Editor: explicit Auto Style instead of invisible formatting

- Removed presentation-only automatic lead-sentence formatting from body view and edit hydration.
- Removed edit-time automatic bold injection for known header-label prefixes.
- Added **Автостиль** in the edit toolbar. It is an explicit one-shot transform:
  - creature name → bold authoring markup;
  - subtitle → italic authoring markup;
  - known/existing section headings → heading nodes + bold authoring markup;
  - short named rule prefixes ending in `.` → bold italic authoring markup.
- The transform writes ordinary `*`, `**`, `***` authoring markup into the editable product document and never runs implicitly afterwards.
- Standard name/subtitle/section CSS no longer forces bold/italic on top of user markup, so B/I can add or remove formatting even on section headings/name/subtitle.
- Card-config previews now render stored authoring markup rather than exposing literal asterisks.

This makes style a user-owned document property. Auto Style can establish the normal look, but it does not fight later human edits.

## Product header: closed parser-owned field set

Parser output may now populate the structured product header only with known
header semantics (AC, HP, speed, skills, resistances, immunities, senses,
languages, challenge, PB, etc., plus the structured abilities/saves slots).

- Parser `other_header`, null-field and unclassified pre-section fragments are no longer emitted as arbitrary header rows.
- Those fragments stay in exact source order as normal editable body paragraphs before the first explicit section — effectively implicit Traits content.
- If a printed Saving Throws span was not actually reconstructed into structured saves, its raw text also remains visibly editable rather than being hidden.
- Human-created custom header rows via `+ Рядок хедера` remain possible as an explicit override.

This is intentionally asymmetric: parser uncertainty falls into the freely
editable body; only recognized structured fields get the rigid header UI.

## Structural parser prompt: remove contradictions and candidate-grid bias

The candidate prompt previously contained a direct contradiction: an early
instruction said not to partition/cover the candidate list, while later rules
required exhaustive ordered coverage. v2.45 removes that contradiction.

The structural request now emphasizes:

- candidates are coordinates, not logical blocks;
- one logical block commonly spans many candidates;
- every meaningful candidate must be covered exactly once;
- uncertainty is `u`, not a gap;
- attack-roll / Hit / Failure / Success / save-resolution pieces remain inside their named feature;
- a named rule before Actions ends the header even when there is no printed Traits heading;
- a named feature is not a section heading merely because its name contains words such as Action, Resistance, Reaction or Legendary;
- heading `v` describes the heading itself, not the previous/next active section.

Two explicit structural examples were added for the failure classes seen in the
v2.44 diagnostics: Nabassu-style unheaded traits and Aboleth-style multi-candidate
save-resolution actions.

## Conservative handling of self-contradictory structural output

When the structural model assigns two incompatible classifications to the exact
same candidate span, direct transport no longer lets JSON output order decide
which interpretation wins. The exact span is preserved once as `unclassified`
and a `candidate_structural_exact_conflict_abstained` warning is emitted.

This is not semantic repair: no alternative meaning is inferred. The system
simply abstains on an internally contradictory model claim while preserving
source ownership.

## Validation performed in this environment

- Targeted runtime tests compiled to JS and executed with Node:
  - editable document/compiler/prompt: 31/31 passed;
  - candidate transport: 11/11 passed.
- Frontend TS/TSX syntax/type-shape transpilation passed with `tsc --noEmit --noCheck`.
- Core source syntax/type-shape transpilation passed with `tsc --noEmit --noCheck`.
- A runtime smoke using the real v2.44 Nabassu lossless report confirmed that parser-owned unknown header fragments no longer appear in product header rows; they remain ordered body content.

A dependency-backed full `npm test` / production Vite build was not run because
this sandbox copy has no `node_modules`.
