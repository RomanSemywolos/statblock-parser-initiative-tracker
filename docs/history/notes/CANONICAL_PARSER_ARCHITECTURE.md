## 2.74.211 — reject singleline BODY transport 2.74.210; restore 2.74.208 BODY baseline

The live qwen3:8b corpus rejected the 2.74.210 singleline BODY transport experiment. Expanding `class=N` into repeated candidate-local evidence and switching numeric BODY starts to direct `Cxxx` strings destabilized collapsed BODY normalization: multiple cases over-segmented heavily while Tarrasque became substantially coarser. The change did not improve the accepted geometry target.

2.74.211 therefore restores the active singleline BODY transport exactly to 2.74.208: compact class-deduplicated evidence, separate class legend, bounded numeric start suffixes, one whole-BODY geometry-only call, virtual multiline reconstruction, and the same shared deterministic multiline BODY parser. No candidate-set or semantic-parser change is introduced.

The practical singleline Header baseline also remains the 2.74.208 behavior. Remaining Header and BODY misses on qwen3:8b are documented weak-model limitations unless a future failure exposes a source-proven mode-specific bug. Mixed remains on accepted 2.74.202. See `PATCH_2.74.211.md`.

## 2.74.210 — accepted singleline Header baseline + singleline BODY transport evaluation

The live 2.74.209 prompt-only Header experiment regressed qwen3:8b and is rejected. The active singleline Header prompt is restored exactly to 2.74.208. The 2.74.208 responsibility split is now the practical singleline Header baseline: complete identity/scalar coordinate spans plus six semantic ability-label anchors, deterministic mechanical closure, exact ownership, and no fuzzy CR/PB/STA repair. Remaining weak-model scalar/STA misses are documented as model-quality limitations.

Singleline BODY is now the evaluation focus. Its semantic contract does not change: the LLM restores multiline-equivalent geometry by returning logical line starts only. The active transport now mirrors the successful mixed transport lesson: each reduced BODY candidate carries local deterministic geometry evidence, there is no `class=N` indirection or separate structural-class legend, and the model returns direct legal `Cxxx` string IDs rather than numeric suffixes. Deterministic code still owns line ends, exact source, virtual-multiline reconstruction and all downstream BODY interpretation. See `PATCH_2.74.210.md`.

## 2.74.209 singleline Header prompt de-anchoring — rejected experiment

The accepted mixed baseline remains **2.74.202**. The live 2.74.208 repeated singleline corpus supports keeping the 2.74.208 responsibility split: scalar Header facts are model-selected whole coordinate spans; abilities are six semantic label anchors followed by deterministic mechanical closure; exact BODY remains the complement; singleline BODY is unchanged. 2.74.209 changes only the singleline Header prompt. Hard-coded numeric-coordinate few-shots are removed because those coordinate values have no transferable meaning between sources and can act as accidental anchors for a small local model. The same layout information remains as coordinate-free shape notes, followed by a compact self-check requiring complete scalar spans, full STA, explicit-only Initiative, and printed ability-label anchors. No deterministic semantic repair is broadened. If live qwen3:8b remains unstable after this prompt cleanup, remaining Header misses are accepted as a current model-quality limitation rather than justification for CR/PB/STA fuzzy recovery. See `PATCH_2.74.209.md`.



## 2.74.208 singleline Header ability-anchor evaluation candidate

The accepted mixed baseline remains 2.74.202. The live 2.74.207 qwen3:8b corpus confirmed the dense coordinate/full-scalar-fact direction but showed that asking the model to predict an outer `ab` span in addition to six ability-label mappings was redundant in collapsed input. Singleline 2.74.208 therefore keeps complete identity/scalar coordinate spans, removes model-selected `ab`, and lets deterministic code reconstruct the exact six-ability region from six semantic label anchors plus mechanically proven score/modifier/save cells. The established one-candidate-left numeric ability-coordinate repair is reused only when the complete six-label mechanics independently prove the region. A later scalar claim may carve only an overlapping prefix already owned by earlier accepted scalar Header evidence. BODY is unchanged. See `PATCH_2.74.208.md`.

## 2.74.207 singleline Header full-fact evaluation candidate

The accepted mixed baseline remains 2.74.202. Singleline Header now uses the same **complete printed fact span** semantic contract as mixed, with only the coordinate presentation specialized for collapsed input: one dense neutral `Cxxx=TOKEN` stream. LLM output is coordinate spans only; deterministic code owns exact text, numbers, mechanical proof, final evidence ranges and Header ownership. The live 2.74.206 run showed that its label-only span contract was a bad mismatch for qwen3:8b: the model frequently selected field values or complete label+value facts, which a correct label-only verifier then had to reject. BODY remains unchanged for an isolated Header A/B. See `PATCH_2.74.207.md`.
# Canonical parser architecture

This file is the architectural source of truth for Header/BODY parsing. Later refactors must preserve this contract unless the user explicitly changes it.

## One canonical pipeline

The parser starts with source text.

1. **Fixed Header extraction.** The LLM identifies only the source-grounded semantics needed for the closed Header contract by selecting immutable source coordinates. Multiline/mixed use the established candidate-span contract; singleline uses the accepted 2.74.208 dense neutral `Cxxx=TOKEN` Header address stream; it selects complete identity/scalar Header facts plus six semantic ability-label spans, while deterministic code closes the exact six-ability region from printed mechanics.
2. **Deterministic Header verification.** Deterministic code validates those claims, owns exact coordinates and numbers, accepts only proven values, puts accepted values into the corresponding Header fields, and retains the original source ranges as evidence/provenance. The LLM is never authoritative for exact printed values.
3. **BODY = exact remainder.** Everything not owned by accepted Header evidence is BODY. Header is not a prefix and there is no global `bodyStart` in the ownership architecture.
4. **Normalize BODY to multiline shape only when necessary.**
   - **multiline input:** no BODY LLM call; physical multiline geometry is already the canonical BODY geometry;
   - **mixed input:** one BODY LLM call restores the logical line starts that would turn the BODY into clean multiline form;
   - **singleline input:** one BODY LLM call does the same normalization with singleline-specific deterministic hints/prompting.
5. **One deterministic BODY parser.** After BODY is physically multiline or virtually normalized to multiline geometry, the same deterministic multiline BODY parser performs all semantic/structural interpretation used downstream.

Canonical flow:

`source -> Header semantic extraction -> deterministic Header grounding/validation/evidence -> exact BODY complement -> [optional BODY-to-multiline LLM normalization] -> one shared deterministic multiline BODY parser -> product`

## Current accepted baseline and evaluation candidate

The accepted live mixed baseline is **2.74.202**. It retains the recovery behavior proven in 2.74.194/2.74.198, the ownership-aware metadata geometry accepted in 2.74.200, the contextual standalone-section-row hard geometry confirmed in 2.74.201, and the ownership-rooted comma/semicolon metadata-continuation veto confirmed by the live qwen3:8b corpus. **2.74.203 was a rejected advisory peer-pattern experiment** and is not part of the baseline. **2.74.208 Header behavior is the accepted practical singleline Header baseline; 2.74.210 is the current singleline BODY transport evaluation candidate** on top of the unchanged 2.74.202 mixed baseline. 2.74.204–2.74.207 remain experiment history/evaluation lineage: 2.74.204 showed that the simplified semantic task helped qwen but free-text output was architecturally fragile; 2.74.205 showed detached coordinate-list drift; 2.74.206 showed that label-only spans were an unnecessarily brittle contract for collapsed input.

The active recovery contract is:

- mixed BODY model-facing evidence is rendered locally at each candidate; the rejected `class=N` indirection is not active;
- mixed BODY returns direct `Cxxx` string starts; numeric-start transport from the 2.74.175 regression is not active;
- provider/task-aware BODY completion budgeting from 2.74.195 is retained without changing BODY semantics;
- singleline remains an active starts-only BODY normalization route; with the accepted 2.74.208 Header behavior its Header model returns **coordinate spans only** over one dense neutral token-card stream, selecting complete identity/scalar facts plus six ability-label semantics; deterministic code owns addressed text, values, the exact six-ability region, proof and ownership;
- 2.74.197 removes unreachable historical parser modules and retired prompt/schema contracts without changing active requests;
- 2.74.198 adds the safe Saving Throws ownership, trailing-comma continuation, first compact-list-row and dice-nowrap fixes;
- 2.74.199 is rejected experiment history because combining metadata evidence with global mixed-prompt changes improved metadata but regressed unrelated BODY starts;
- 2.74.200 keeps only the useful candidate-local ownership-aware metadata promotion and restores the mixed BODY prompt byte-for-byte to 2.74.198. Its live qwen3:8b corpus retained Dreamer/Beledros metadata gains while removing the 2.74.199 Astral/DRAKOPTERA/Looming regressions, so 2.74.200 replaces 2.74.198 as the accepted live checkpoint.

2.74.201 extends only the existing source-proven mixed hard-geometry safeguard. A short one-word or sentence-case standalone physical BODY row may be preserved as its own logical row when: (a) it is not inside the ownership-proven Header-metadata corridor, (b) the preceding physical row is not another standalone-looking row that could form a wrapped title, and (c) nearby following physical geometry reaches an independently shaped named-rule start before returning to metadata or another ambiguous standalone row. The check is vocabulary-free and is **not serialized to the model prompt**. It does not add a hard start for an inline title such as `Darkfire Abyss (...)`.

The 2.74.201 live corpus confirmed this deterministic extension: model BODY starts stayed identical to 2.74.200, the intended Astral/Beledros/Lolth/Orcus section rows were recovered deterministically, and the DRAKOPTERA/Dreamer/Looming controls did not regress. 2.74.201 therefore replaces 2.74.200 as the accepted live baseline.

2.74.202 does not change the mixed model request. It escalates one already-existing strong continuation signal only inside an ownership-rooted interleaved metadata chain: when a physical continuation row follows a printed comma or semicolon and traces back to a `header_interleaved_compact_row`, a model-returned start at that continuation coordinate is vetoed after response parsing. Colons remain advisory, ordinary BODY prose is excluded, and no new start is invented. The live qwen3:8b corpus confirmed the intended Lolth repair with no other product-output change, so 2.74.202 replaced 2.74.201 as the mixed baseline. The later 2.74.203 `repeated_title_line_pattern` advisory experiment was rejected because it improved some peer starts but destabilized unrelated qwen decisions.

The old R/A, local-card, batching/window and weighted-boundary experiments remain historical research only. They are not production fallbacks.

The only mode-specific BODY difference is the deterministic evidence/hints and, if necessary, the prompt used to restore multiline geometry. The desired output of mixed and singleline normalization is the same: **multiline-equivalent BODY geometry**, not a richer semantic representation.

## What the BODY LLM is allowed to do

For mixed/singleline BODY normalization, the LLM may answer only the geometry question required to reconstruct clean multiline BODY: where new logical lines start (or an equivalent representation of the same information).

It must **not** be asked to classify lines as feature/action/rule/metadata/description/section-content/etc. It must not assign section identities or semantic roles that the deterministic multiline parser already derives. It must not return independent overlapping semantic spans. It must not rewrite source text.

This is not merely a prompt preference. It is an architectural invariant: **the BODY LLM restores missing layout information; deterministic code owns BODY interpretation after normalization.**

## Deterministic hints

The BODY LLM receives deterministic source-shape hints because mixed and singleline input lose different kinds of layout information.

- Mixed hints describe mixed-layout evidence: trusted/weak line starts, continuation strength, candidate boundaries, and similar source-shape observations.
- Singleline hints must be designed separately for collapsed input.

Hints are evidence about geometry, not semantic answers. Different hints/prompts are allowed per mode; the target representation remains the same multiline-equivalent BODY.

## Losslessness and authority

- Source text is immutable authority.
- Accepted Header values keep exact source evidence.
- Removing Header ownership never deletes source; it defines BODY as the exact complement.
- BODY normalization changes only virtual line geometry, never source text or source coordinates.
- If the BODY LLM misses a logical line boundary, the failure is coarser geometry, not lost text or invented semantics.
- Semantic uncertainty must remain visible; no silent deletion is permitted.

## Explicit anti-drift rules

Do **not** silently add a new BODY semantic taxonomy to mixed or singleline LLM output.

Do **not** let mixed and singleline develop separate downstream semantic parsers after normalization.

Do **not** make the BODY LLM duplicate work already performed by the deterministic multiline parser.

Do **not** reintroduce `bodyStart` as the definition of Header/BODY ownership.

Do **not** confuse source ownership, virtual multiline geometry, deterministic BODY semantics, and presentation. They are separate stages.

## Prompting and model limits (2.74.142)

The normalization prompt is a model-independent task specification. Few-shot examples may be used to demonstrate representative source-shape transformations, but they must show only BODY source/candidates -> logical multiline starts. They must never add semantic output labels.

Mixed and singleline may use different deterministic hint profiles and different examples because their missing geometry differs. They must still converge on the same multiline-equivalent BODY representation before the shared deterministic parser.

Hints should preferentially expose why a boundary is plausible or implausible (for example title shape, trailing comma/semicolon, lowercase continuation, introduced list hierarchy, compact label continuation, or standalone ALL-CAPS geometry). These are advisory observations; they do not themselves create semantic ownership.

If a weak LLM still misses an ambiguous boundary after adequate candidate coordinates, hints and examples, the acceptable failure is a locally coarser line. Do not add language-specific or D&D-specific deterministic semantic guesses merely to force the last ambiguous cases. Source loss, invented text, and parallel BODY semantics remain unacceptable; an occasional coarse boundary is an acknowledged model-quality limit.

The detailed hint/few-shot contract lives in `BODY_NORMALIZATION_HINTS.md`.

## 2.74.143 clarification — standalone row followed by explanatory prose

Mixed normalization must preserve the common geometry where a standalone heading-shaped row is followed by one complete explanatory paragraph before the first named peer entry. These are separate logical lines. This is a geometry rule only: the BODY LLM still returns starts and does not classify the standalone row as a heading or the following text as section rules.

Auto Style may use the same language-independent visible shape for presentation rescue when a standalone heading-shaped paragraph is followed by either a named-rule paragraph directly or by one ordinary explanatory paragraph and then a named-rule paragraph. This presentation rescue does not create semantic section ownership and keeps `headingKind: null`.


## 2.74.208 — singleline Header ability-anchor specialization

2.74.208 keeps the mixed parser as the conceptual reference but specializes the ability contract for physically collapsed source. Scalar Header facts still use whole source-coordinate spans. Abilities do not: the model returns exactly six printed label spans mapped to `str/dex/con/int/wis/cha`, and deterministic code reconstructs the exact complete ability region by proving the surrounding numeric cells. There is no model-selected `ab` outer edge in singleline.

This is stricter, not weaker. A six-label mapping has no Header authority unless the language-neutral ability solver proves one complete six-ability region. The solver supports interleaved score/modifier cells, a separate six-label row followed by six numeric cells, and 2024 score/modifier/save cells. Save values printed inside the 2024 ability cells remain part of that ability region and are not a separate `sv` field.

A model ability coordinate that lands on the immediately following numeric cell may be repaired exactly one candidate left only when: (a) canonical ability identity came from the model, (b) the previous candidate is a compact nonnumeric printed label, and (c) the complete six-label mechanics independently prove. This reuses the established language-neutral coordinate-repair rule rather than introducing ability-name dictionaries.

For scalar claims, 2.74.208 also permits one ownership-only carve: `init`/`hp` claims may discard a leading overlap only when that exact prefix is already accepted earlier scalar Header evidence. This covers a collapsed claim such as `(28) HP 697 ...` when `(28)` is already proven as part of `Initiative +18 (28)`. The remaining HP source must still pass the ordinary scalar verifier. No unowned neighboring text is added.

The live 2.74.207 response replay is intentionally conservative: it recovers Tarrasque HP and the complete 2024 ability region from the same stored response, while leaving unrelated bad CR/PB/STA selections unresolved. Thus the specialization removes redundant geometry and reuses source-proven ownership, rather than becoming a qwen-specific semantic repair layer.

Singleline BODY is unchanged in 2.74.208. The next live corpus decides whether Header work can stop and BODY normalization can become the next phase.

## 2.74.207 — singleline Header complete-fact coordinate contract

The active singleline Header evaluation path mirrors the accepted mixed Header responsibility split and changes only the coordinate presentation required by collapsed input:

`dense neutral Cxxx=TOKEN source view -> one complete-Header-fact coordinate-selection LLM call -> deterministic text/value/range/mechanical proof -> accepted Header ownership -> exact BODY complement`

The Header model may return only:

- inclusive coordinate spans for the complete printed `name` and adjacent `size/type/subtype/alignment`;
- inclusive coordinate spans for complete printed AC, separately printed Initiative, HP, six-ability region, separately printed Saving Throws, CR and printed PB facts;
- six inclusive coordinate spans for the printed ability labels, mapped to `str/dex/con/int/wis/cha`, when an ability region is claimed.

This is intentionally the same **whole-fact** semantic contract used by mixed. The singleline-specific difference is only transport geometry: because the source has no trustworthy physical row boundaries, every non-whitespace source token is addressable as an atomic `Cxxx=TOKEN` card. The cards carry no structural class, boundary confidence, ownership or semantic hint. The model returns no source quotes and no interpreted numeric values.

Deterministic code resolves every returned ID against the actual lattice, proves identity adjacency, compact scalar mechanics, interleaved / separate-six-label / 2024 ability layouts, separately printed save sequences, nested printed PB, exact values and final evidence ranges. A syntactically valid but semantically wrong span is rejected and remains in the exact remainder. There is no fuzzy quote recovery and no language dictionary.

The generation schema constrains coordinate IDs lexically (`C` + digits) rather than repeating hundreds of valid IDs in every `s/e` enum. Existence, order and bounds are still checked deterministically against the actual candidate count. This keeps structured-output guidance without duplicating the entire address space in the schema.

Singleline BODY normalization remains unchanged in this stage so Header transport can be evaluated independently. After accepted Header ownership, BODY is still the exact complement, one starts-only geometry call restores multiline-equivalent BODY, and the shared deterministic multiline parser owns BODY semantics.

### Superseded clean-start experiments

- **2.74.204:** verbatim semantic anchors. Useful diagnostic proof that the simplified Header task helped qwen, but rejected because model text reproduction can fail exact grounding and Baphomet hallucinated a non-source `PB` label.
- **2.74.205:** coordinate-only Header with raw SOURCE plus a detached full coordinate list. Rejected after live qwen3:8b coordinate drift.
- **2.74.206:** inline `[Cxxx]token` coordinates with **label-only** field spans. Rejected after the live corpus showed repeated value-offset and complete-fact selections (`AC 25`, `HP 697`, etc.) that a correct label-only verifier had to reject. 2.74.207 keeps inline addressability but changes the semantic contract to the same complete-fact spans already proven in mixed.

## 2.74.144 — singleline joins the canonical ownership pipeline

Singleline is no longer a boundary-plus-classification experiment. It now follows the same architecture as mixed:

`fixed Header verifier -> deterministic accepted Header ownership -> exact BODY-owned coordinate set -> one singleline-specific BODY-to-multiline starts call -> shared deterministic multiline BODY parser -> product`

The singleline BODY response contains only logical line starts. There is no second BODY classification call, no BODY semantic taxonomy, and no `bodyStart` handoff in the active singleline path. The dense singleline candidate lattice, candidate-audit provenance and synthetic structural reconstruction remain only as address/shape evidence for the normalization model. They do not assign BODY semantics.

Mixed and singleline now share the same starts-only JSON contract and the same virtual-multiline reconstruction/classifier. Their prompts differ because mixed input retains partial physical line geometry while singleline input has physically collapsed geometry.

Legacy singleline boundary/classification helpers and schemas were removed during the 2.74.197 cleanup. `analyzeStatblock` routes active singleline parsing only through the starts-only normalization path described above.

### 2.74.145 address-space clarification (historical Header transport)

At this historical checkpoint, Header and BODY used different coordinate views in collapsed input. Later 2.74.204–2.74.207 experiments replaced this historical Header transport; the current 2.74.208 path uses dense neutral token cards, complete scalar fact spans, and deterministic ability-region closure from six semantic label spans.

For mixed input, surviving physical geometry may provide hard line-separation facts. A compact standalone ALL-CAPS physical BODY row and its following physical BODY row may be preserved as two logical rows before the shared multiline classifier. No semantic identity is inferred from capitalization.

## 2.74.146 clarification — mode-specific Header coordinate presentation (historical)

The fixed Header semantic contract remains universal and still uses exactly one model call. A parser mode may, however, adapt the **presentation of source coordinates** to the geometry that survived import.

At this historical checkpoint, physically collapsed singleline input used a singleline-specific coordinate presentation: sparse structural proposals plus denser exact address coordinates in one overloaded model task. That **dual-channel presentation** remains retired. The current 2.74.208 singleline Header path again uses coordinates, but exposes one dense neutral token-card stream with no structural proposal channel or model-facing boundary classes; scalar facts use complete spans and abilities use six semantic label spans; the one-call ownership architecture is unchanged.

The underlying source coordinate system remains exact and immutable throughout.


## 2.74.147 clarification — mixed may preserve stronger surviving physical geometry

The mixed BODY LLM restores missing geometry; it is not allowed to erase geometry already strongly proven by the source. In addition to the existing ALL-CAPS standalone-row safeguard, a conservative title-case standalone physical row may be deterministically retained as its own logical row when surface shape alone proves the boundary strongly enough. The following surviving physical BODY row is also kept separate.

This rule is not semantic classification. It does not identify `Legendary Actions`, `Actions`, or any other section by vocabulary. It only preserves a trusted printed line boundary. Missing whitespace after a compact title terminator may likewise affect title-shape evidence without modifying source bytes or source coordinates.

### 2.74.201 extension — contextual standalone physical rows

The same hard mixed-geometry principle may cover one-word or sentence-case standalone physical rows that the older capitalization-only safeguard cannot prove by shape alone. This extension requires surrounding physical geometry: the row must be outside ownership-proven metadata, must not be adjacent to a preceding standalone-looking row that could instead be a wrapped title, and must lead into a nearby independently shaped named-rule region before metadata/another ambiguous standalone row intervenes. The detector does not inspect section vocabulary and is not shown to the BODY model. Preserving the standalone row also preserves the immediately following surviving physical BODY row as separate content, because otherwise the printed standalone boundary would be lost again.

Inline peer titles remain model-owned unless some independent hard geometry proves their boundary. In particular, `Title (qualifier).` shape alone is not sufficient to force a mixed start.

## 2.74.150 clarification — conservative singleline BODY proposal space

Singleline BODY normalization still uses its reduced BODY coordinate view. The historical dual Header transport is not active. In the current 2.74.208 path Header gets a dense neutral token-card address stream and returns complete identity/scalar spans plus six ability-label coordinate spans; exact text, values, ability-region edges and accepted Header ownership are recovered deterministically from those selections.

The canonical singleline BODY view therefore contains:

- candidates with independent structural/mixed source-shape evidence; and
- bounded exact refinement coordinates that lie *inside* an already source-proven composite title span, where collapsed geometry can hide a section-label / first-rule split such as `Actions Multiattack.`.

Those refinement coordinates remain `address_only`; they are not promoted to semantic or structural facts merely to make them selectable. Language-neutral collapsed title shape may promote a coordinate when its own source form independently supports a compact named-rule lead. Numeric compact leads are excluded from that promotion path to avoid turning metadata values into rule-title evidence.

A singleline standalone heading may also be source-proven when it is immediately followed by a compact labelled row in the same collapsed source (`Heading Label: value`). This is geometry-only evidence and does not identify any particular section or field.

The starts-only singleline BODY generation budget is capped at 1536 output tokens. This is a generation-safety limit, not a semantic change: BODY still returns only ordered logical line starts and then converges into the shared deterministic multiline parser.


## 2.74.157 — localized ability-label evidence

The fixed Header verifier remains the only semantic model task. When it claims an `ab`
region, it must also return all six exact printed ability labels mapped to the canonical
ability identities. Those labels are semantic hints only: deterministic code grounds the
exact strings in source and the existing ability-table constraint solver proves all six
numeric cells. No score, modifier, save bonus, ownership range, or source text comes from
the model. Localized saving-throw rows may reuse the same grounded label identities; this
does not introduce a language dictionary or a second semantic parser.

## 2.74.158 — active-path exclusivity cleanup

`analyzeStatblock()` now contains only the canonical ownership-first production pipeline. The unreachable legacy half that still implemented global `bodyStart`, bounded Header scanning, semantic BODY generation, singleline boundary/classification and quote-anchor fallback has been removed from `pipeline.ts`.

This is behavior-neutral cleanup, not a parser redesign. The active contract remains:

`fixed Header locator -> deterministic accepted Header ownership -> BODY complement -> multiline directly / mixed+singleline starts-only normalization -> shared deterministic multiline BODY parser`.

An exhaustive `never` guard follows the three resolved parser modes so any future new resolved mode must be wired deliberately rather than falling through. Dedicated architecture regression tests also reject the retired prompt/task markers from `pipeline.ts`, verify the exact canonical model-task set for every resolved mode, and verify that model failures cannot fall back to a retired parser path.

## 2.74.159 — language-neutral semantic authority

The active parser must not infer semantic Header identity from a printed-language
lexicon. Candidate geometry, boundary evidence, ownership, and deterministic fact
verification are language-neutral. Printed labels become semantic only when the Header
LLM grounds them to canonical internal keys.

In particular, literal English labels such as `Armor Class` and canonical-looking
ability abbreviations such as `STR/DEX/CON/INT/WIS/CHA` are not parser authority.
`STR` remains a valid canonical/product representation only after semantic identity is
already known (for example because the LLM mapped a printed source label to `str`).

English vocabulary may still exist in translation/presentation code and legacy
compatibility helpers, but it must not feed the active candidate lattice, Header
ownership, verifier acceptance, or structured ability identity.

## 2.74.161 — ability-label evidence is independent of an `ab` span

The fixed Header verifier's `abilityLabels` mappings are first-class semantic evidence and MUST NOT be discarded merely because the verifier omitted an `ab` region claim. A complete six-label mapping may seed a language-neutral deterministic proof of the exact ability-table region.

The language boundary is strict:

- the model says what a printed label means (`Сил -> str`, `STR -> str`, or any other language);
- deterministic code may ground that printed label, prove order, numeric cells, modifiers/saves, exact ranges and non-overlap;
- deterministic code must not infer `str|dex|con|int|wis|cha` from printed vocabulary on its own.

A single candidate coordinate returned in place of a printed ability label may be resolved only to that candidate's exact compact source token. The coordinate itself contributes location, not semantics.

## 2.74.162 — printed Initiative presentation on shared Header evidence

A verified fixed Header fact and its source evidence serve different purposes. The product may render a canonical field label from semantic ownership while Evidence retains the complete immutable source span.

For a printed Initiative fact, the editable product row is therefore built from the canonical `Initiative` UI label plus the source tail beginning at the first signed numeric token that matches the already-proven Initiative value. This handles compact shared rows such as `AC 17 Initiative +7 (17)` without requiring deterministic knowledge of the printed word `Initiative`: the product row becomes `Initiative +7 (17)`, while the complete shared source row remains Evidence.

This rule is presentation-only. It does not change Header extraction, semantic classification, source ownership, grounding, or the language-neutral parser contract. AC retains its existing value-and-suffix presentation rule because qualifiers after the primary AC value can be mechanically important (for example alternate AC conditions).

If the same signed Initiative value occurs earlier in the shared evidence, the formatter may preserve an over-wide tail. This is an accepted editable-presentation ambiguity: the structured Initiative value remains correct and the exact source remains available in Evidence.

## Header model transport migration guardrail (2.74.163)

Before replacing the current duplicated Header candidate transport with an inline-coordinate shadow-source representation, the parser records diagnostic-only Header prompt metrics. The baseline instrumentation is not parser authority and must never affect candidate generation, grounding, ownership, validation, or model responses.

Migration acceptance is comparative: behavior that succeeds in the 2.74.162 control corpus must continue to succeed. Known control failures may remain or improve, but a transport change must not create new failures. Transport representation changes and candidate-set reduction are separate changes and must not be combined in one migration step.

## Header transport migration checkpoint — 2.74.164

A reversible Header coordinate overlay now exists as infrastructure only. It inserts service markers at the starts of the existing candidate lattice while keeping raw source, candidate identity/order, Header semantics, ownership, and BODY processing unchanged. The production Header model request still uses the legacy source + separate candidate transport in 2.74.164.

The overlay is intentionally semantic-free: deterministic code may expose exact coordinates but may not infer which coordinates belong to Name/AC/abilities/etc. `Cxxx-Cyyy` keeps the existing inclusive candidate contract, mapping to raw `[start(Cxxx), start(next(Cyyy)))` or EOF. Diagnostics compare legacy candidate-transport character cost with the hypothetical inline-marker cost. No candidate pruning is part of this migration stage.

## 2.74.165 migration note — measured inline Header request, not active

The parser now constructs a complete alternative Header request for diagnostics only: the exact raw source is represented by the reversible inline-coordinate overlay, the duplicated candidate-preview transport is omitted, and a fixed-size coordinate-pattern JSON schema replaces per-candidate enums. Existing deterministic source-shape hints are retained in the comparison request. This alternative request is **not sent to the model** in 2.74.165. The active Header call remains the legacy request, and all Header/BODY ownership and verification behavior is unchanged. Candidate IDs in the future inline schema are syntax-only at generation time; existence, order, raw-range mapping, and acceptance remain deterministic responsibilities.

## Header transport A/B execution guardrail (2.74.166)

During the transport migration, the legacy fixed-Header request remains authoritative. A second inline-coordinate Header request may execute only as a diagnostics shadow: its output must not affect Header ownership, BODY complement, product facts, source reconstruction, or parse success. The shadow result is independently parsed and deterministically verified against the same source/candidate lattice, then compared with the legacy verified structured Header. Shadow failures are diagnostics-only. Candidate-set reduction and BODY redesign remain out of scope.

## Header transport fidelity checkpoint — 2.74.167

The reversible inline-coordinate Header experiment must preserve the structural evidence that already exists on candidate coordinates; transport optimization must not silently erase it. The model-facing inline overlay may compactly encode existing candidate reasons, boundary scope/strength/evidence, and continuation strength/evidence, but it must not derive new semantic evidence or alter the candidate lattice. For collapsed-singleline Header requests, the existing structural/address-only/mixed presentation role and synthetic top-level/internal role are preserved as transport metadata as well.

This checkpoint also restores the established fixed-Header prompt semantics (including publication/page exclusion from `sta`, at-most-one fact per kind, explicit-vs-derived rules, and the established exact-printed ability-label semantic-hint contract) in the shadow transport. The legacy Header call remains authoritative; the inline call remains A/B diagnostics only. No BODY behavior, source ownership, candidate generation, or deterministic semantic language policy changes in 2.74.167.


## Header transport range/encoding checkpoint — 2.74.168

The inline Header A/B transport may use a transport-specific right-edge convention only behind a deterministic adapter. Inline model spans use `[s,e)`: `s` is the service marker before the fact and `e` is the first marker after it. Before any Header grounding or validation, the shadow adapter converts that boundary form back to the established inclusive candidate-span representation. The legacy Header request, generic candidate-range semantics, Header ownership, and production output remain unchanged.

Existing structural metadata may be dictionary-compressed for transport, but the compression must be lossless. A per-request class ID may replace a repeated marker payload only when the class table expands to exactly the same existing candidate reasons, boundary evidence, continuation evidence, and existing collapsed-singleline presentation roles. Class IDs carry no parser semantics. No candidate pruning, semantic inference, or evidence modification is part of this checkpoint.

## Header A/B functional-equivalence checkpoint — 2.74.169

The inline Header transport remains shadow-only. Exact equality of validated
`StructuredHeader` objects is retained for forensic A/B debugging, but it is not
the sole migration-quality metric because exact evidence spans and annotation ids
can differ while the validated Header facts are identical.

Diagnostics therefore distinguish:

1. **exact evidence equivalence** — unchanged full structured-object equality;
2. **functional Header equivalence** — final fixed-Header semantics only.

Functional equivalence ignores evidence-route bookkeeping but does not erase
source-visible differences or printed-vs-derived PB provenance. It is diagnostic
only and cannot select parser authority or weaken deterministic validation.

## Header semantic-span presentation checkpoint — 2.74.171

The inline Header A/B transport may clarify, in model instructions only, that a
candidate boundary can occur *inside* one semantic Header fact. A half-open span must
therefore end at the first boundary after the complete semantic fact, not merely at
the next coordinate after its start. The abstract transport example may demonstrate
one fact physically split across two coordinate-delimited source spans.

This clarification is not parser semantics. Deterministic code must not infer that a
particular pair of adjacent candidates belongs to one `sta` field, expand `sta` to a
neighbor, recognize publication codes, or introduce language-specific size/type
rules. The candidate lattice, validator, Header ownership, BODY complement, and
legacy authoritative request remain unchanged while this remains a shadow A/B
experiment.

## Header suffix-span transport checkpoint — 2.74.172

The Header A/B migration may label existing candidate spans with model-facing suffix
coordinates rather than rendering coordinates as boundaries before source fragments.
For candidate `Ci`, the labeled raw span remains exactly
`[start(Ci), start(Ci+1))`, or `[start(Ci), EOF)` for the final candidate. The suffix
is service metadata only and must be exactly removable so raw-source reconstruction
is unchanged.

The suffix's structural class must remain the lossless encoding of the structural
evidence attached to the span's **starting candidate**. Repositioning the marker may
not change candidate reasons, boundary evidence, continuation evidence, or existing
collapsed-singleline structural/address/synthetic roles.

Shadow `s/e` coordinates in this representation use the established inclusive
candidate-range semantics directly: `s` is the first included span ID and `e` is the
last included span ID. The 2.74.168–2.74.171 half-open shadow adapter and EOF sentinel
are superseded for this experiment. This is transport-only; legacy Header authority,
Header/BODY ownership, deterministic validation, language-neutrality, and all product
behavior remain unchanged.

## Header compact-legacy transport checkpoint — 2.74.173

The current Header transport experiment no longer inserts coordinate markers into
the model-facing source. The non-authoritative shadow call intentionally reuses the
exact authoritative legacy Header system prompt and user prompt. Its only transport
change is a fixed JSON schema for candidate coordinates (`Cxxx` syntax) instead of
per-request enumeration of all candidate IDs in both range endpoints.

This checkpoint isolates schema overhead from semantic presentation. Legacy Header
remains authoritative; the shadow result is diagnostics-only. Candidate existence,
range ordering, exact raw-source grounding, overlap/ownership checks, and numeric
proof remain deterministic. No Header semantics, BODY behavior, language-specific
parser knowledge, candidate pruning, or source rewriting is introduced here.

## Header numeric-coordinate transport checkpoint — 2.74.174

2.74.174 keeps the established legacy Header semantic presentation as the control surface: the model still reads the clean full SOURCE EXCERPT and the same separate STRUCTURAL PROPOSALS / SOURCE-SHAPE HINTS channels. The shadow experiment changes only the coordinate output encoding needed for structured generation.

In the shadow request, a visible candidate `C002` is returned as integer `2` in `s/e`. `s/e` remain an inclusive first/last candidate range. The schema constrains them as integers from `0` through `candidateCount - 1`, and deterministic code maps them back to the existing `Cxxx` candidate contract before using the established Header parser and validator. This removes per-request candidate-ID enumeration while preventing arbitrary source strings from occupying coordinate fields.

This is not an authority switch. The legacy enum-based Header request remains authoritative until real-model A/B results demonstrate acceptable semantic equivalence, transport reliability, runtime behavior, and provider/context behavior. No source pruning, semantic neighbor expansion, publication-code dictionary, STA-specific repair, or BODY change is permitted as part of this transport experiment.

---

## Historical parser checkpoint — 2.74.175 (mixed transport later superseded by 2.74.194)

The Header transport A/B series (2.74.163–2.74.174) is closed for production. Active parsing uses one established authoritative Header request; no shadow Header inference runs in the normal pipeline. Historical experimental helpers/diagnostic fields may remain for compatibility and research provenance but are not parser authority.

At that historical checkpoint the active flow already had the same ownership-first shape:

`source -> one fixed Header LLM extraction -> deterministic Header validation/evidence -> exact BODY complement -> [mixed/singleline: one starts-only BODY normalization LLM] -> shared deterministic multiline BODY parser -> product`

However, the 2.74.175 mixed model-facing `class=N` compression and numeric start IDs were later shown to regress qwen3:8b behavior. They were rolled back by the 2.74.194 recovery-control. Do not treat those transport encodings as part of the current canonical contract.

If a mixed BODY provider call fails or returns an invalid envelope, the degraded fallback may use only source-proven physical line/paragraph/document starts plus the first BODY candidate after a Header gap. The failure remains explicit in diagnostics. This fallback exists to preserve a usable multiline product without inventing semantic ownership. It is not applied to collapsed singleline input, where physical geometry cannot recover missing semantic line starts.

Model-guided ability-label candidate coordinates may be repaired from a numeric score/modifier cell to its immediately preceding compact printed token only when canonical ability identity was supplied by the model and the existing language-neutral six-label/table solver independently proves the region. This is a coordinate repair, not deterministic language semantics.

The 2.74.160 singleline Header projection remains non-production/paused. Candidate pruning based only on deterministic geometry must not become a correctness dependency.
