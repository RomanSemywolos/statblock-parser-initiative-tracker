# BODY normalization hints and prompting contract

This document defines the model-facing normalization layer for BODY geometry. It is subordinate to `CANONICAL_PARSER_ARCHITECTURE.md`: hints may improve normalization quality, but they may not turn the BODY LLM into a semantic parser.

## Target task

For mixed or collapsed input, the BODY LLM must recover only the logical non-empty line starts that would make the exact BODY source look like clean multiline input. It never rewrites text and never labels a line as a feature, action, metadata row, section heading, rule, description, etc.

The target is deliberately model-agnostic. The same contract should work with any instruction-following model that can consume the candidate coordinates and emit the simple JSON schema. Model-specific tuning belongs in generation settings, not in semantic prompt rules.

## Evidence classes

Hints are advisory source-shape evidence. They are not deterministic boundaries.

### Evidence supporting a new logical line

- an independently title-shaped start;
- a strong paragraph/physical separation that is not contradicted by continuation evidence;
- an independently printed peer title after an already complete entry;
- a compact standalone ALL-CAPS physical line in a cased script;
- hard source geometry such as a BODY segment start after a validated Header gap.

ALL-CAPS is intentionally phrased as `standalone line evidence`, not `section heading evidence`. The downstream deterministic multiline parser and Auto Style decide what the line means or how it looks.

### Evidence against a new logical line

- previous physical fragment ends in a comma or semicolon;
- previous fragment is syntactically open / lacks closing sentence punctuation;
- current fragment begins with a lowercase letter in a cased script;
- current fragment begins with a number or bracket and surrounding structure suggests continuation;
- a compact `Label:` row follows an already-open named entry;
- a repeated list marker belongs to an introduced list sequence;
- a short named title is followed by wrapped prose that completes the same entry.

For uncased scripts, case-based evidence is absent rather than negative.

## Existing deterministic evidence reused by mixed normalization

The candidate lattice and boundary-evidence layer already provide reusable shape observations including:

- `title_shape`;
- `paragraph` / `physical_line`;
- `list_sequence`;
- `previous_line_trailing_separator`;
- `previous_line_open`;
- `lowercase_line_start`;
- `numeric_line_start`;
- `leading_bracket_line_start`;
- `compact_label_after_named_start`;
- `named_rule_continuation`;
- `labeled_continuation`.

2.74.142 additionally emits mixed-only `all_caps_standalone` advisory evidence. It does not alter source ownership or create a deterministic split.

## Few-shot policy

Mixed and singleline prompts may have different examples because they lose different geometry. Examples must demonstrate only `source/candidates -> logical line starts`.

A good example teaches one or two recurring geometry decisions:

1. wrapped comma-separated metadata/list row;
2. named entry + wrapped prose;
3. two adjacent independently named entries;
4. internal `Label:` mechanics clauses inside one open entry;
5. standalone structural-looking line without assigning its semantic type;
6. introduced nested list that does not become top-level blocks;
7. paragraph/visual wrap that remains continuation;
8. non-English example proving that English vocabulary is not required.

Examples must not emit `feature`, `heading`, `metadata`, section kinds, or any other BODY semantic taxonomy.

## Mixed versus singleline

### Mixed

Mixed input still preserves partial physical geometry. Its prompt should therefore expose physical-line/paragraph evidence, continuation evidence, candidate boundary evidence, and mixed-only shape hints. Physical newlines are evidence, not authority.

### Singleline

Singleline input needs a denser start lattice and stronger positive start evidence because most original line boundaries are gone. It will receive its own prompt and hint profile, but must eventually produce the same output contract: logical multiline starts only, followed by the same deterministic multiline BODY parser.

2.74.142 intentionally does **not** migrate the existing singleline semantic pipeline yet.

## Honest model limits

A weak model can still miss a genuinely ambiguous boundary after good hints and examples. When that happens, the acceptable failure is a locally coarser logical line. Exact source text remains preserved.

Do not repair the last ambiguous cases by introducing language-specific or D&D-specific deterministic boundary rules into the universal geometry layer merely to imitate an LLM decision. Add a deterministic rule only when source shape itself proves the geometry and the rule remains valid across languages/content domains supported by the parser.

Systematic model errors should first be addressed by better candidate coordinates, better shape evidence, or a representative few-shot example. Isolated ambiguous errors are a model-quality limit, not justification for architectural drift.


## Singleline profile (2.74.144)

Singleline uses the same starts-only output contract as mixed, but the evidence profile is different because physical newlines are absent or untrustworthy. The model receives the dense singleline address lattice plus diagnostic-only candidate-audit and synthetic reconstruction roles. These roles are explicitly presented as geometry evidence, not semantic labels.

Useful positive evidence includes compact title-shaped leads, repeated peer-title patterns, standalone structural-looking phrases, and a standalone phrase followed by one explanatory prose unit before named peers. Useful negative evidence includes comma/semicolon continuation, open delimiters, lowercase continuation, compact internal `Label:` clauses, and introduced repeated list markers.

The singleline prompt contains representative few-shot transformations for: collapsed standalone rows plus named peers; compact comma-separated rows; internal labelled mechanics; standalone row + explanatory prose + peers; introduced internal lists; and a non-English example. Every example outputs only logical line starts.

The singleline model is intentionally allowed to miss an ambiguous boundary and produce a locally coarser line. The remedy for systematic failures is better shape evidence or examples, not deterministic language/D&D semantic guessing.

## 2.74.145 corrections

Singleline Header addressability and BODY normalization addressability are now explicitly different views. The Header verifier may retain the bounded dense-prefix token lattice. BODY normalization filters out a coordinate when `dense_prefix_address` is its only audited origin; any independently supported coordinate remains available. This prevents weak models from reading raw token density as boundary evidence while preserving language-neutral exact addresses around real structural shapes.

Mixed no longer uses the 2.74.143 prompt example that explicitly taught `standalone row -> explanatory paragraph -> peers`. For surviving physical geometry, a compact standalone ALL-CAPS BODY row and the immediately following physical BODY row are preserved as separate logical lines deterministically. This is a geometry invariant only; it does not identify a heading or section meaning.


## 2.74.147 mixed robustness

Two additional mixed-only source-shape safeguards are permitted. First, a trusted physical row may recover named-rule title evidence when exactly one whitespace character is missing after terminal punctuation and the next visible character is uppercase (`Title.Prose`). This changes evidence only; the source is never normalized or rewritten.

Second, hard preservation of already printed physical geometry is not limited to ALL-CAPS rows. A conservative title-case standalone physical row may receive the same guarantee when its shape itself is strong: compact standalone row, trusted physical boundary, and enough capitalized word starts to reject ordinary sentence prose. This remains geometry-only and must not encode section names or D&D vocabulary.

## 2.74.150 singleline proposal discipline

Singleline BODY normalization no longer exposes the general dense exact-address lattice as a set of plausible rows. The main BODY proposal set is restricted to coordinates with independent structural/mixed source-shape evidence.

A narrow exception exists for exact coordinates inside an already source-proven composite title span. These are shown only as refinement addresses because collapsed source can print a standalone label and first rule without a delimiter (`Actions Multiattack.`). They remain `address_only`; the evidence does not semantically classify either phrase.

Existing language-neutral compact named-rule shape can elevate a collapsed coordinate when that coordinate itself begins a bounded non-numeric title lead. Numeric compact leads remain address-only to avoid confusing metadata rows with named rules.

Singleline BODY is a starts-only task and has a 1536-token output ceiling to prevent repetition/runaway generation from consuming the generic 4096-token budget. This limit does not change Header verification, source ownership, or downstream BODY parsing.


## 2.74.199 ownership-aware mixed compact-row experiment

2.74.199 tested an advisory evidence overlay added only **after** deterministic Header verification had produced exact accepted ownership ranges. A short physical BODY row could receive `header_interleaved_compact_row` when its entire physical row was unowned and lay between accepted Header ownership islands. The coordinate relation itself remained language-neutral and did not create a start.

The same experiment also exposed new evidence terminology in the mixed system prompt, added a metadata-oriented few-shot, and emitted a short-open lexical continuation hint for narrow-column rows. The live qwen3:8b corpus was mixed: several metadata rows improved, but unrelated BODY starts regressed. Therefore the combined 2.74.199 prompt/evidence package is rejected as a stable baseline.

## 2.74.200 prompt-isolation follow-up

2.74.200 keeps only the candidate-local ownership-aware row promotion for evaluation while restoring the mixed BODY system prompt byte-for-byte to 2.74.198. The 2.74.199 global evidence explanations and metadata few-shot are removed so the next corpus run isolates the effect of local candidate evidence from prompt-wide behavioral drift.

The short-open lexical shape is no longer a model-facing hint. A narrow list-like physical row ending in one short lexical fragment may use that shape only as an **internal promotion veto**: the immediately following uppercase physical fragment is not upgraded to `header_interleaved_compact_row`. This does not strengthen continuation, add a candidate, remove a candidate, or choose a logical start. Multiple separators are required so ordinary completed values such as `..., яд` do not trigger the veto.

Existing source-proven continuation evidence still has priority, especially a literal trailing comma/semicolon and lowercase continuation. The BODY LLM remains authoritative for mixed logical starts. If the 2.74.200 live corpus preserves the metadata gains without the unrelated 2.74.199 regressions, the overlay can be promoted; otherwise it should be reverted/redesigned rather than compensated with more global prompt complexity.
