# Header ownership architecture

Status: canonical architecture rule from v2.74.133 onward. This document supersedes older notes that describe Header as a source prefix or `bodyStart` as the authority for Header/BODY ownership.

## Current implementation note — 2.74.205

The staged sections below preserve the historical migration record. The singleline migration that they describe as future work was completed later (2.74.144 onward). Current active ownership is shared by all modes:

`whole source -> closed Header semantic locator -> deterministic accepted Header ownership -> exact BODY complement -> multiline direct / mixed+singleline starts-only normalization -> shared deterministic multiline BODY parser`

There is no active global `bodyStart` authority in multiline, mixed, or singleline. Historical references below are retained to explain how the architecture arrived here, not as instructions for the current implementation.


### Singleline Header transport from 2.74.205

Singleline preserves the same closed Header semantics and ownership invariant and returns to the project-wide rule that the model selects **coordinates only**. Its one Header call receives raw collapsed source plus one flat address list containing **every non-whitespace source unit**. The list deliberately carries no model-facing structural class, boundary strength, semantic proposal or ownership claim. The model returns inclusive name/STA coordinate spans, first-token coordinates for fixed-field labels, and first-token coordinates for the six mapped ability labels. Deterministic code reads the addressed source bytes, proves mechanical field shapes, extracts numeric values, supports both interleaved abilities and separate six-label-row layouts, and creates exact ownership.

This density is intentional. Mixed can use surviving physical geometry to maintain a sparse coordinate lattice; collapsed singleline cannot safely use the old title/body heuristics to decide which unknown Header labels deserve addresses. The complete token-address space therefore keeps candidate pruning out of Header correctness while reusing the mixed ownership/complement architecture after selection.

The old sparse-structural + dense-address dual presentation remains historical only. The temporary 2.74.204 verbatim-quote experiment is also historical: live qwen identified Header semantics well, but a non-source `PB` response on Baphomet demonstrated why model-authored source text is not an acceptable grounding contract.

## Non-negotiable invariant

Header is **not a prefix of the source** and BODY is **not everything after one global boundary**.

Header is the set of independently grounded fixed-header facts that the model proposes and deterministic code accepts. Every source region that is not accepted as Header remains in the BODY/remainder coordinate space. No model or deterministic helper may hide source merely because it appears before or after a guessed boundary.

The fixed Header contract is closed to:

- creature name;
- creature classification / size-type-subtype-alignment line;
- Armor Class;
- printed Initiative;
- Hit Points;
- the complete six-ability region;
- printed Saving Throws / printed save-column evidence;
- Challenge / CR;
- printed Proficiency Bonus.

Speed, Skills, vulnerabilities/resistances/immunities, condition immunities, Senses, Languages, Habitat and similar metadata are not fixed-header correctness dependencies. Unless a later product decision explicitly changes the closed contract, they remain lossless BODY/remainder content.

## Three distinct concepts

Do not collapse these concepts again:

1. **Semantic fact evidence** — the exact grounded source span that proves a fixed Header fact.
2. **Header presentation row** — the full physical printed row shown in the Header when an accepted fact intersects that row. Presentation can be wider than the semantic evidence, but widening presentation never widens semantic authority.
3. **BODY structure** — the complement of accepted Header presentation/evidence in source order, parsed independently of Header semantics.

A structured fact can therefore be proven by a narrow exact span while the user sees the complete printed row. Conversely, text sharing a physical neighborhood with Header evidence does not become a semantic Header fact automatically.

## Failure contract for weak LLMs

LLM mistakes must degrade structure, not truth or losslessness.

- Omitted Header fact -> it remains BODY/remainder; source is still visible.
- Unsupported Header claim -> deterministic validation rejects it; source remains BODY/remainder.
- Malformed/failed Header model call -> no unsafe Header ownership is invented.
- Exact printed numbers are extracted and checked deterministically; the model does not become authority for the number.
- Unknown BODY semantics -> preserve as structurally weaker/unclassified content rather than inventing semantics.

A weak model may make the result less convenient. It must not make the source disappear or manufacture exact information.

## Multiline — v2.74.133 architecture

Multiline uses exactly one semantic LLM task in the normal path:

`whole source -> fixed-header locator -> deterministic validation -> accepted Header ownership -> full-row Header presentation -> complement rows -> deterministic multiline BODY`

There is no Header/BODY boundary LLM and no `bodyStart` authority in the multiline path. BODY is parsed from physical non-empty line geometry. A BODY-specific LLM call is forbidden in multiline because deterministic structure is sufficient.

For abilities, optional model-read labels are only semantic hints inside an explicitly grounded complete ability region. They must literally occur inside that region. In strict ownership mode, deterministic validation must not expand a proposed ability region into adjacent source merely to make it parse; a bad/truncated proposal is rejected instead.

## Mixed — v2.74.135 architecture

Mixed now uses the same fixed-header ownership model as multiline:

`whole source -> fixed-header locator -> deterministic validation -> accepted Header ownership -> ownership-complement BODY coordinates -> one mixed BODY LLM`

There is no global `bodyStart` and no source suffix. The BODY model may see the complete original source as context, but candidate coordinates intersecting accepted Header ownership are explicitly forbidden. Header text is therefore contextual only, never eligible BODY ownership. Returned BODY spans are rejected if they include or bridge across any forbidden Header-owned candidate.

This preserves two independent properties at once:

- whole-source semantic context remains available to a weak model;
- ownership is still the exact complement of accepted Header evidence rather than a guessed prefix/suffix cut.

Unclaimed compact metadata remains BODY/remainder source. If its narrower structural role is unclear, the BODY model must return `u` rather than inventing a heading/feature. Omitted or rejected BODY material remains explicit unclassified source. Unknown localized section headings are allowed to survive with `section:null`; later semantic resolution is separate from structural transport.

Normal mixed execution therefore has exactly two semantic model tasks: one fixed Header locator and one BODY structural parser.

## Singleline — historical migration stage (superseded by 2.74.144)

The migration target was:

`whole source -> same fixed-header locator -> deterministic validation -> accepted Header ownership -> exact complement/remainder -> singleline BODY parser`

At this historical stage the boundary-pass + frozen-block classification-pass was still experimental. The later 2.74.144 migration replaced it with one starts-only BODY normalization call using singleline-specific language-neutral hints, while preserving the same Header ownership invariants.

## Anti-regression rules

1. Never reintroduce `bodyStart` as Header/BODY ownership authority.
2. Never define Header as `source.slice(0, bodyStart)`.
3. Never make a Header locator unable to see a valid fixed-header fact because another stage guessed an early BODY boundary.
4. Never let strict deterministic Header recovery search arbitrary BODY and silently promote it to Header semantics.
5. Never let strict fixed-header validation grow an evidence span into an adjacent unrelated row to rescue a weak model proposal.
6. Never call a BODY LLM in multiline.
7. Never use an LLM for exact mechanics that deterministic validation can establish from grounded source.
8. Never trade losslessness or factual grounding for prettier structure.
9. Keep semantic ownership, source geometry, product placement and presentation as separate layers.
10. During staged migration, legacy `bodyStart` references in unmigrated modes are technical debt, not architectural precedent.

## Historical migration order

1. v2.74.133–2.74.134: multiline ownership-first path and strict ability-region repair.
2. v2.74.135: mixed ownership-first path.
3. later completed in v2.74.144: singleline migration to one starts-only BODY normalization call.

Each stage was kept independently testable so untouched modes could remain behaviorally isolated as much as possible.

## Ability-region truncation rule (v2.74.134, shared by multiline and mixed from v2.74.135)

A fixed-header LLM claim is semantic evidence, not authoritative numeric geometry. A weak model may correctly identify the six-ability table but stop the `ab` span on the final ability label before its printed value. In ownership-first multiline mode this is repaired deterministically under a narrow rule:

- the left edge of the verifier claim never moves;
- only the right edge may extend;
- extension candidates are complete physical source rows, never arbitrary token/unit boundaries;
- the first (smallest) extension that proves all six abilities is accepted;
- the search stops immediately after that proof and must not continue into a following standalone metadata row merely to collect richer evidence;
- if no complete six-ability table can be proved, the claim is rejected and the source remains visible BODY/unclassified evidence.

This is deliberately different from legacy source-recovery logic, which may search for the richest constraint-proven table when ownership is not being assigned. Ownership-first Header construction must prefer the smallest sufficient proof so deterministic recovery cannot silently annex unrelated BODY/metadata.

## Mixed BODY prompt stability rule — v2.74.136

Ownership migration must not silently replace the mature BODY structural contract. Header/BODY ownership and BODY semantic parsing are separate concerns.

For mixed input:

- the Header task establishes only validated fixed-Header ownership;
- the BODY task keeps the established mixed structural distinctions for headings, section rules, named features, section content, supplementary content, and uncertainty;
- ownership restrictions are added as coordinate eligibility constraints, not as a replacement BODY taxonomy/prompt;
- the BODY prompt must contain one consistent coverage rule: cover every meaningful BODY-eligible coordinate exactly once and omit every Header-owned coordinate;
- generic prompt clauses for other protocols (`abilityLabels`, header-field `h` spans, unconditional all-candidate coverage) are forbidden in this BODY request;
- deterministic BODY hints must not cross or reference accepted Header ownership;
- if the model still crosses Header ownership, deterministic transport rejects that span and preserves the source rather than annexing Header text.

This rule exists specifically to prevent an architectural refactor of ownership from degrading an already-stable semantic BODY parser.

## Mixed BODY generation surface rule (v2.74.137)

Ownership exclusions are a deterministic interface constraint, not a semantic task for the BODY model. The mixed BODY model may see the full source for context, but its structural proposal grid and generation schema must expose only BODY-eligible candidate coordinates. Header-owned coordinates may be named once as context/exclusions, but must not remain legal `s`/`e` output values. Do not repeat ownership tags on every candidate row: this adds prompt noise without adding semantic information.

This rule does not change the ownership-first architecture and must not be used to restore a global `bodyStart`.

### Mixed BODY semantic surface — v2.74.138

The fixed Header contract and BODY semantic vocabulary are separate concerns.
Removing a compact metadata row from fixed Header ownership does **not** make that
row a section heading or feature. Mixed BODY therefore has a dedicated `m`
(`body_metadata`) answer for compact metadata/remainder. It is BODY-owned and is
materialized as neutral body content (`section_content`, `section:null`); it must not
be promoted back into Header ownership.

Ownership mechanics stay outside the LLM semantic task. The BODY prompt lists only
legal BODY coordinates and uses explicit hard gap markers where accepted Header
ownership interrupts the coordinate space. The JSON schema restricts span endpoints
to BODY coordinates, model spans crossing a Header gap are rejected, and deterministic
transport receives the same Header coordinates as protected barriers. No downstream
repair may annex them.

Prompt-size diagnostics must compare the same model task. In the v2.74.132 corpus the
Looming Harvest BODY request was 5450 prompt-eval tokens; the 2823-token value was the
legacy header-scan request. v2.74.137 BODY was 6458 tokens. The v2.74.138 interface is
intentionally compact again while retaining whole-source context.

## Historical mixed BODY model-view rule — v2.74.139 (superseded by v2.74.141)

Ownership restrictions belong to deterministic code, but the model still needs a coherent semantic view of its task. Therefore mixed BODY must not receive accepted Header text as ordinary source context while being forbidden to address it. Build a BODY-only model view from the exact complement and preserve every removed Header interval as an explicit non-crossable gap. Keep original source coordinates unchanged.

Do not trade away the mature BODY structural contract to save prompt size. `sh` remains only printed heading text; `f` owns complete feature mechanics and continuations; `r/sc/sup/u` retain their established meanings. Compact metadata outside the fixed Header contract may use BODY semantic role `m`, but this never changes its source ownership back to Header.


## Historical mixed BODY minimal boundary contract — v2.74.140 (superseded by v2.74.141)

The mixed BODY model has exactly one structural job: partition BODY-owned source into logical blocks. Its output is an ordered set of block starts plus one binary property for each start: `h=true` only when that block is an actually printed section heading; otherwise `h=false`.

The model does **not** classify ordinary BODY blocks as feature, action, rule, metadata, section content, supplementary content, description, or uncertainty. Those distinctions are not required by the editable product and must not be silently added back to the mixed LLM task. Ordinary blocks materialize as neutral BODY paragraphs (`section_content`, `section:null`). Printed headings materialize as `section_heading`, also with `section:null`; the exact heading text remains source authority.

The model does **not** return end coordinates. Deterministic code builds each block end from the next returned start within the same contiguous BODY-owned segment. The first coordinate of every BODY segment is inserted as a deterministic start when necessary because a Header ownership gap is already a proven hard boundary. Therefore mixed model output cannot express overlapping spans and cannot create semantic holes inside a BODY segment. A missed model boundary can only make one paragraph too coarse; it cannot delete source.

Accepted Header ranges are removed from the BODY model view and represented as hard gaps. Original `Cxxx` coordinates are retained. No `bodyStart` or global source suffix is reintroduced.

Canonical mixed flow:

`whole source -> fixed Header locator -> deterministic Header validation/ownership -> exact BODY complement -> one BODY boundary+heading call -> deterministic partition -> neutral BODY paragraphs/headings -> product`

This contract is intentionally the target for the later singleline simplification as well. Do not extend it there until mixed is validated.

## Canonical BODY normalization architecture — v2.74.141 (supersedes mixed semantic parts of v2.74.136–2.74.140)

The architectural target is not “a better mixed semantic parser.” There is one BODY parser: the deterministic multiline parser.

- Header LLM extracts only fixed Header evidence.
- Deterministic code validates it, fills Header fields, and keeps exact source evidence.
- BODY is the exact complement of accepted Header ownership.
- Multiline BODY goes directly to deterministic multiline parsing.
- Mixed BODY gets exactly one additional LLM operation: restore logical line starts so the BODY becomes multiline-equivalent. The mixed LLM does not classify headings, features, metadata, rules, descriptions, or any other semantic role.
- Singleline must later use the same target: one LLM normalization step to multiline-equivalent BODY, with singleline-specific deterministic hints/prompting, then the same deterministic multiline parser.

Thus mode-specific intelligence ends at multiline normalization. Downstream BODY semantics are shared.

Canonical flow:

`source -> Header extraction -> deterministic Header validation/evidence -> exact BODY complement -> optional BODY-to-multiline normalization -> shared deterministic multiline BODY parser -> product`

In v2.74.141 the mixed schema is only `{"starts":[{"s":"Cxxx"}, ...]}`. No `h/k/v/e` semantic fields are legal. Starts create virtual logical rows; the shared deterministic multiline classifier then assigns all downstream BODY roles exactly as it does for physically multiline input.

See `CANONICAL_PARSER_ARCHITECTURE.md`. Treat that file as the anti-drift source of truth.


## Mixed normalization guidance — v2.74.142

The v2.74.141 geometry-only contract remains unchanged. v2.74.142 improves only the evidence and examples supplied to the mixed normalizer. Candidate rows expose deterministic boundary evidence and continuation evidence; a mixed-only ALL-CAPS standalone observation may be supplied as advisory geometry. The prompt includes representative few-shot `candidates -> starts` examples. None of these hints assigns BODY semantics or creates ownership.

The generation schema remains starts-only and now requests unique start objects when supported by structured decoding. Deterministic code still validates/deduplicates.

Singleline remains on its existing experimental path in 2.74.142. Its later migration must use a separate singleline-specific prompt/hint profile while producing the same multiline-start representation.

See `BODY_NORMALIZATION_HINTS.md`.
