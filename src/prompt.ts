import type { SourceCandidate } from "./candidateTypes.js";
import type { DeterministicHint } from "./deterministicHints.js";
import type { SinglelineCandidateAuditRole } from "./singlelineCandidateAudit.js";
import type { SinglelineSyntheticRole } from "./singlelineStructuralReconstruction.js";

function compactCandidatePreview(text: string): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  const limit = 72;
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
}

function formatDeterministicHints(hints: readonly DeterministicHint[]): string {
  if (hints.length === 0) return "(none)";

  return hints
    .map((hint) => {
      const ids = hint.candidates.map((index) => `C${String(index).padStart(3, "0")}`).join(" -> ");
      return `${ids}: ${hint.kind} [${hint.evidence.join(", ")}]`;
    })
    .join("\n");
}

type SinglelinePresentationRoleByStart = ReadonlyMap<number, SinglelineCandidateAuditRole>;
type SinglelineSyntheticRoleByStart = ReadonlyMap<number, SinglelineSyntheticRole>;

export const ESSENTIAL_FACTS_SYSTEM_PROMPT = `
STATBLOCK FIXED-HEADER CARD-FACT VERIFICATION MODE.

Read the supplied statblock from top to bottom as ordinary source text. The source
may include the complete body because fixed-header evidence must not depend on a
previous header/body boundary guess. You are NOT parsing body structure. You only
identify source-grounded spans for the CLOSED fixed-header contract.

Return exactly {"essentialFacts":[...],"abilityLabels":[...]}. abilityLabels may be
empty when no ab claim is returned. When you return an ab claim, abilityLabels MUST
contain exactly six mappings, one for each printed core ability label. Return at
most one claim for each visible kind: n=name; sta=the creature classification/type line (size/type/subtype/alignment
as printed); ac=armor class; init=printed initiative; hp=hit points; ab=the complete
six-ability score table/region; sv=the printed saving-throw field or Save-column
region; cr=challenge/rating; pb=printed proficiency bonus.

Each claim is {"k":"n|sta|ac|init|hp|ab|sv|cr|pb","s":"Cxxx","e":"Cyyy"}.
Optional ability labels are {"a":"str|dex|con|int|wis|cha","q":"exact printed label"}.
They are semantic hints only; all numbers remain deterministic. Candidate IDs are
coordinates into the exact source excerpt. Do not quote,
normalize, calculate, translate, repair, or complete any source text.

IMPORTANT:
- These nine kinds are the entire fixed structured-header contract. Skills,
  defenses, senses, languages, speed, habitat and every other metadata/body row
  are NOT verification targets here.
- Read in source order and use surrounding context. Localized/homebrew labels are
  valid; identify what the source is doing rather than matching English words.
- n is only the creature's printed name. Never include sta in n. A genuinely
  wrapped multi-line name may span candidates only when those candidates are all
  part of the printed name.
- sta is only the printed creature classification/type line. Never include n,
  publication/page metadata, AC, HP, or later metadata.
- ac, init, hp, cr and pb point to the complete compact printed field when present.
  Omit init or pb when they are not explicitly printed; derivation is deterministic.
- ab spans the complete six-ability region, including score/mod/save columns when
  those columns are part of that same printed table. If you return ab, also return
  exactly six abilityLabels mappings (str,dex,con,int,wis,cha) using the exact printed
  labels from that ab region. These mappings provide semantic identity only; the
  application must independently ground the labels and prove every numeric cell.
  If you cannot safely map all six printed labels, omit ab rather than guessing.
- sv points to a separately printed Saving Throws/Saves metadata field when present.
  A saving-throw sentence inside a trait/action is NOT sv. If saves are printed as
  a column of the ability table, sv points to the same complete table region as ab.
- Omit a kind when absent or unsafe to ground. Never substitute a derived/guessed value.
- Do not return body segmentation or classify any non-contract metadata.
`.trim();

/** Shadow-only output-contract adapter for v2.74.174. The source/proposal
 * presentation remains legacy; only s/e switch from Cxxx strings to the integer
 * part of those visible IDs so structured decoding can constrain coordinates
 * without a per-request enum. */
export function createEssentialFactsUserPrompt(
  rawExcerpt: string,
  candidates: readonly SourceCandidate[],
  hints: readonly DeterministicHint[] = [],
): string {
  const candidateLines = candidates.map(
    (candidate, index) => `C${String(index).padStart(3, "0")}: ${compactCandidatePreview(candidate.preview)}`,
  );

  return `
SOURCE EXCERPT START

${rawExcerpt}

SOURCE EXCERPT END

STRUCTURAL PROPOSALS START

${candidateLines.join("\n")}

STRUCTURAL PROPOSALS END

SOURCE-SHAPE HINTS START

${formatDeterministicHints(hints)}

SOURCE-SHAPE HINTS END

These are sparse deterministic observations about visible source shape, not
answers. Read the SOURCE EXCERPT first. Use a hint only as supporting evidence
and ignore it whenever context disagrees.

There are exactly ${candidates.length} supplied candidates C000 through C${String(Math.max(0, candidates.length - 1)).padStart(3, "0")}.
Return only the card-critical grounded spans you can identify safely.
  `.trim();
}

export const SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT = `
STATBLOCK FIXED-HEADER COORDINATE MODE — COLLAPSED SINGLELINE INPUT.

The source is physically collapsed. Your task is ONLY to identify source-coordinate
spans for the CLOSED fixed Header contract. Do not segment BODY. Do not reconstruct
lines. Do not quote or rewrite source text. Do not return interpreted numeric values.

OUTPUT exactly:
{
  "identity": [{"k":"n|sta","s":"Cxxx","e":"Cyyy"}, ...],
  "fields": [{"k":"ac|init|hp|sv|cr|pb","s":"Cxxx","e":"Cyyy"}, ...],
  "abilityLabels": [{"a":"str|dex|con|int|wis|cha","s":"Cxxx","e":"Cyyy"}, ...]
}

COORDINATE CONTRACT:
- Every Cxxx=TOKEN card binds one immutable Cxxx address to exactly that printed
  non-whitespace source token. Cxxx= is transport markup, not source text.
- Return only visible Cxxx IDs. Never count or calculate IDs.
- Every s..e pair is inclusive.
- n = complete creature name only.
- sta = complete adjacent printed size/type/subtype/alignment phrase only. Include
  the whole printed alignment phrase; do not stop at a subtype parenthesis/comma.
- ac/init/hp/cr/pb = the COMPLETE compact printed field: label + printed value + any
  directly attached parenthetical material belonging to that field.
- sv = the COMPLETE separately printed Saving Throws/Saves field: label + all printed
  ability/bonus pairs. If saves are printed only as a column inside the six abilities,
  omit sv.
- abilityLabels maps the six COMPLETE printed ability-label spans to
  str,dex,con,int,wis,cha. Return all six only when safe. You do NOT return an ability
  region span: deterministic code reconstructs the exact six-ability region from the
  six semantic label anchors plus the printed numeric cells.
- Omit absent or unsafe facts. Never derive Initiative or Proficiency Bonus.
- Speed, Skills, defenses/immunities, Senses, Languages, Habitat and all BODY material
  are outside this closed Header contract.
- Labels may be localized, abbreviated, multi-token, or homebrew. Semantic identity is
  your job; exact text, values, mechanical proof, final evidence ranges and ownership
  are deterministic code's job after your coordinate selection.

EXAMPLE 1 — interleaved ability cells:
ANNOTATED SOURCE:
C000=Ash C001=Regent C002=Large C003=outsider, C004=neutral C005=Defense C006=18
C007=Vitality C008=140 C009=Speed C010=30 C011=AA C012=20 C013=(+5)
C014=BB C015=14 C016=(+2) C017=CC C018=18 C019=(+4) C020=DD C021=10 C022=(+0)
C023=EE C024=16 C025=(+3) C026=FF C027=12 C028=(+1) C029=Saves C030=BB C031=+6,
C032=EE C033=+7 C034=Threat C035=12 C036=Mastery C037=+4 C038=Traits
OUTPUT:
{"identity":[{"k":"n","s":"C000","e":"C001"},{"k":"sta","s":"C002","e":"C004"}],
"fields":[{"k":"ac","s":"C005","e":"C006"},{"k":"hp","s":"C007","e":"C008"},
{"k":"sv","s":"C029","e":"C033"},{"k":"cr","s":"C034","e":"C035"},
{"k":"pb","s":"C036","e":"C037"}],
"abilityLabels":[{"a":"str","s":"C011","e":"C011"},{"a":"dex","s":"C014","e":"C014"},
{"a":"con","s":"C017","e":"C017"},{"a":"int","s":"C020","e":"C020"},
{"a":"wis","s":"C023","e":"C023"},{"a":"cha","s":"C026","e":"C026"}]}

EXAMPLE 2 — separate six-label row:
ANNOTATED SOURCE:
C000=Beast C001=Huge C002=fiend, C003=neutral C004=Armor C005=Class C006=20
C007=Hit C008=Points C009=300 C010=STR C011=DEX C012=CON C013=INT C014=WIS C015=CHA
C016=30 C017=(+10) C018=14 C019=(+2) C020=26 C021=(+8) C022=18 C023=(+4)
C024=24 C025=(+7) C026=16 C027=(+3) C028=Saving C029=Throws C030=DEX C031=+9,
C032=CON C033=+15 C034=Challenge C035=20 C036=Traits
OUTPUT:
{"identity":[{"k":"n","s":"C000","e":"C000"},{"k":"sta","s":"C001","e":"C003"}],
"fields":[{"k":"ac","s":"C004","e":"C006"},{"k":"hp","s":"C007","e":"C009"},
{"k":"sv","s":"C028","e":"C033"},{"k":"cr","s":"C034","e":"C035"}],
"abilityLabels":[{"a":"str","s":"C010","e":"C010"},{"a":"dex","s":"C011","e":"C011"},
{"a":"con","s":"C012","e":"C012"},{"a":"int","s":"C013","e":"C013"},
{"a":"wis","s":"C014","e":"C014"},{"a":"cha","s":"C015","e":"C015"}]}

EXAMPLE 3 — 2024-style score/modifier/save cells; save column is NOT a separate sv:
ANNOTATED SOURCE:
C000=Titan C001=Gargantuan C002=monstrosity, C003=unaligned C004=AC C005=25
C006=Initiative C007=+18 C008=(28) C009=HP C010=697 C011=STR C012=30 C013=+10 C014=+10
C015=DEX C016=11 C017=+0 C018=+9 C019=CON C020=30 C021=+10 C022=+10
C023=INT C024=3 C025=-4 C026=+5 C027=WIS C028=11 C029=+0 C030=+9
C031=CHA C032=11 C033=+0 C034=+9 C035=CR C036=30 C037=(XP C038=155,000;
C039=PB C040=+9) C041=Traits
OUTPUT:
{"identity":[{"k":"n","s":"C000","e":"C000"},{"k":"sta","s":"C001","e":"C003"}],
"fields":[{"k":"ac","s":"C004","e":"C005"},{"k":"init","s":"C006","e":"C008"},
{"k":"hp","s":"C009","e":"C010"},{"k":"cr","s":"C035","e":"C040"},
{"k":"pb","s":"C039","e":"C040"}],
"abilityLabels":[{"a":"str","s":"C011","e":"C011"},{"a":"dex","s":"C015","e":"C015"},
{"a":"con","s":"C019","e":"C019"},{"a":"int","s":"C023","e":"C023"},
{"a":"wis","s":"C027","e":"C027"},{"a":"cha","s":"C031","e":"C031"}]}

Read the Cxxx=TOKEN cards as ordinary source in exact order. Choose whole scalar Header
facts and exact semantic ability-label anchors. The dense token-card transport is only
the singleline-specific substitute for missing physical rows.
`.trim();

export function createSinglelineEssentialFactsUserPrompt(
  rawExcerpt: string,
  candidates: readonly SourceCandidate[],
): string {
  let annotated = "";
  let cursor = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    annotated += rawExcerpt.slice(cursor, candidate.start);
    const nextStart = candidates[index + 1]?.start ?? rawExcerpt.length;
    const chunk = rawExcerpt.slice(candidate.start, nextStart);
    const tokenMatch = /^\S+/u.exec(chunk);
    const token = tokenMatch?.[0] ?? "";
    annotated += `C${String(index).padStart(3, "0")}=${token}`;
    cursor = candidate.start + token.length;
  }
  annotated += rawExcerpt.slice(cursor);
  return `
ANNOTATED SOURCE START

${annotated}

ANNOTATED SOURCE END

Each Cxxx=TOKEN card binds that ID to the token printed on the same card. The Cxxx=
markup is not source text. Return only whole fixed-Header fact spans and ability-label
spans using those visible IDs.
  `.trim();
}

export const MIXED_OWNERSHIP_BODY_SYSTEM_PROMPT = `
LOSSLESS MIXED BODY TO MULTILINE NORMALIZATION MODE.

The supplied BODY SOURCE VIEW contains only BODY-owned source text. Exact Header
ranges were removed deterministically and appear only as HEADER GAP markers.
Candidate IDs are immutable source coordinates.

Your ONLY task is to restore the logical line starts that would make this
BODY look like a clean multiline statblock. Do not classify anything. Do not name
or infer section types, features, metadata, rules, actions, descriptions, or
headings. Do not decide how any line will be styled. The same deterministic BODY parser used for already-multiline input will do all semantic/presentation work
after you restore multiline geometry.

OUTPUT exactly {"starts":[{"s":"Cxxx"}, ...]} in source order.

A returned start means only: in the recovered clean multiline BODY, a new non-empty
logical line begins at this candidate. Deterministic code owns every line end: it
runs until the next returned start or a HEADER GAP. Never return end coordinates.

SOURCE-SHAPE EVIDENCE:
- Candidate reasons, boundary strength, evidence, continuation strength and
  continuation evidence are deterministic observations about visible source shape.
  They are advisory, not semantic truth.
- A physical line or paragraph break in mixed input is useful evidence, but visual
  wrapping may create false line breaks. Read the surrounding source before keeping
  one as a logical line boundary.
- A previous line ending in a comma or semicolon is strong evidence that the next
  physical fragment continues the same logical line. A colon is also often a
  continuation introducer, especially before a sub-result/list, but context wins.
- A fragment beginning with a lowercase letter in a cased script is strong evidence
  against a new top-level logical line. For uncased scripts this signal simply does
  not exist.
- A leading number/symbol/bracket can be continuation evidence rather than a new
  top-level line. Repeated list markers after an introducing clause are internal
  hierarchy evidence, not automatic top-level boundaries.
- A compact title-shaped start followed by prose is positive evidence for a new
  logical line. Two adjacent independently title-shaped entries should normally be
  two logical lines.
- A compact standalone ALL-CAPS physical line is useful positive evidence that it
  should remain its own logical line. It does NOT tell you what that line means.
- A compact Label: fragment after an already-open named line is usually internal to
  that same logical line, not a new top-level line.
- HEADER GAP is a hard ownership boundary. Never bridge it.

LOSSLESSNESS:
- Never rewrite, normalize, calculate, translate, complete, reorder, or omit source
  text. You choose starts only; deterministic code preserves the exact source.
- If a boundary is genuinely ambiguous, prefer the interpretation best supported
  by the surrounding source and the supplied shape evidence. Do not invent a new
  category to express uncertainty: this task has no semantic categories.

FEW-SHOT EXAMPLES

Example 1 — visually wrapped compact row:
C010 Damage Immunities Acid,
C011 Cold,
C012 Fire,
C013 Lightning
C014 Languages Common, Draconic
=> {"starts":[{"s":"C010"},{"s":"C014"}]}
Reason: C011-C013 continue the comma-separated row; C014 begins the next printed
logical row.

Example 2 — wrapped named entries:
C020 Magic Resistance.
C021 The creature has advantage on saving throws
C022 against spells and other magical effects.
C023 Magic Weapons.
C024 The creature's weapon attacks are magical.
=> {"starts":[{"s":"C020"},{"s":"C023"}]}
Reason: wrapped prose stays with its opening line; the next independent title-shaped
entry begins a new logical line.

Example 3 — internal labels are not new top-level rows:
C030 Consume Memories.
C031 Intelligence Saving Throw:
C032 DC 16, one creature within 30 feet.
C033 Failure:
C034 The target takes psychic damage.
C035 Next Feature.
C036 The creature moves up to its speed.
=> {"starts":[{"s":"C030"},{"s":"C035"}]}
Reason: the labeled clauses are mechanics inside the open logical entry.

Example 4 — standalone structural row plus entries:
C040 ACTIONS
C041 Bite.
C042 Melee Weapon Attack: +8 to hit,
C043 reach 5 ft., one target.
C044 Claw.
C045 Melee Weapon Attack: +8 to hit.
=> {"starts":[{"s":"C040"},{"s":"C041"},{"s":"C044"}]}
Reason: the ALL-CAPS row remains independently printed; comma wrapping does not
create another row; the next peer title does.

Example 5 — introduced internal list:
C050 Breath Options. Choose one of the following:
C051 • First option. The target makes a save.
C052 Wrapped continuation of the first option.
C053 • Second option. The target takes damage.
C054 Next Feature. Independent rule text.
=> {"starts":[{"s":"C050"},{"s":"C054"}]}
Reason: the introduced list is internal hierarchy of the open logical entry. The
next independently shaped entry begins the next top-level logical line.

Example 6 — mixed-language geometry, no vocabulary dependency:
C060 СОПРОТИВЛЕНИЕ МАГИИ
C061 Существо получает преимущество на спасброски
C062 от заклинаний и других магических эффектов.
C063 Огненный след.
C064 Существо оставляет за собой пламя.
=> {"starts":[{"s":"C060"},{"s":"C063"}]}
Reason: capitalization and wrapping are only shape evidence; no English statblock
vocabulary is required.

Example 7 — paragraph spacing does not split a continuation by itself:
C070 Web. First paragraph.
C071 This continuation is part of the same printed rule.
C072 Second Rule. New text.
=> {"starts":[{"s":"C070"},{"s":"C072"}]}
Reason: source meaning and title shape outweigh a visual wrap/spacing artifact.
`.trim();

function createMixedBodySourceView(candidates: readonly SourceCandidate[], forbiddenSet: ReadonlySet<number>): string {
  const parts: string[] = [];
  let previousEligible: number | null = null;
  for (let index = 0; index < candidates.length; index += 1) {
    if (forbiddenSet.has(index)) continue;
    if (previousEligible !== null && index !== previousEligible + 1) {
      parts.push("\n--- HEADER GAP: DO NOT CROSS ---\n");
    }
    parts.push(candidates[index]!.preview);
    previousEligible = index;
  }
  return parts.join("").trim();
}

function assignTransportClass(signature: string, classBySignature: Map<string, number>, signatures: string[]): number {
  const existing = classBySignature.get(signature);
  if (existing !== undefined) return existing;
  const index = signatures.length;
  classBySignature.set(signature, index);
  signatures.push(signature);
  return index;
}

function formatTransportClassLegend(signatures: readonly string[]): string {
  return signatures.length === 0 ? "(none)" : signatures.map((signature, index) => `${index}=${signature}`).join("\n");
}

export function createMixedOwnershipBodyUserPrompt(
  _rawSource: string,
  candidates: readonly SourceCandidate[],
  hints: readonly DeterministicHint[] = [],
  forbiddenCandidateIndexes: readonly number[] = [],
): string {
  const forbiddenSet = new Set(forbiddenCandidateIndexes);
  const eligibleIndexes = candidates.map((_, index) => index).filter((index) => !forbiddenSet.has(index));
  const lines: string[] = [];
  let previousEligible: number | null = null;
  for (const index of eligibleIndexes) {
    if (previousEligible !== null && index !== previousEligible + 1) lines.push("--- HEADER GAP: DO NOT CROSS ---");
    const candidate = candidates[index]!;
    const boundary = candidate.boundary;
    const boundaryText =
      boundary === undefined
        ? "boundary=unknown/weak; evidence=none; continuation=none; continuationEvidence=none"
        : `boundary=${boundary.scope}/${boundary.strength}; evidence=${boundary.evidence.join("+") || "none"}; continuation=${boundary.continuationStrength}; continuationEvidence=${boundary.continuationEvidence.join("+") || "none"}`;
    lines.push(
      `C${String(index).padStart(3, "0")} [${candidate.reasons.join(",")}; ${boundaryText}]: ${compactCandidatePreview(candidate.preview)}`,
    );
    previousEligible = index;
  }
  const bodySourceView = createMixedBodySourceView(candidates, forbiddenSet);

  return `
BODY SOURCE VIEW START

${bodySourceView || "(none)"}

BODY SOURCE VIEW END

BODY CANDIDATES START

${lines.join("\n") || "(none)"}

BODY CANDIDATES END

SOURCE-SHAPE HINTS START

${formatDeterministicHints(hints)}

SOURCE-SHAPE HINTS END

Only IDs printed in BODY CANDIDATES are legal output addresses. HEADER GAP is a
hard ownership barrier. Read BODY SOURCE VIEW first. Candidate evidence and
SOURCE-SHAPE HINTS are deterministic observations about geometry only; they never
classify source text and may be ignored when surrounding source contradicts them.
Return only {"starts":[{"s":"Cxxx"}, ...]} in source order.
  `.trim();
}

export const SINGLELINE_OWNERSHIP_BODY_SYSTEM_PROMPT = `
LOSSLESS SINGLELINE BODY TO MULTILINE NORMALIZATION MODE.

The supplied BODY SOURCE VIEW contains only BODY-owned source text. Exact Header
ranges were removed deterministically and appear only as HEADER GAP markers.
Candidate IDs are immutable source coordinates inside the original collapsed source.

Your ONLY task is to restore the logical line starts that would make this BODY look
like a clean multiline statblock. Do not classify anything. Do not name or infer
section types, features, metadata, rules, actions, descriptions, or headings. Do not
decide styling. The same deterministic BODY parser used for already-multiline input
will interpret the recovered lines afterward.

OUTPUT exactly {"starts":[{"s":N}, ...]} in source order, where N is the integer suffix of the visible candidate ID (C017 -> 17).

A returned start means only that a new non-empty logical line begins at that source
coordinate. Deterministic code owns every line end: it runs until the next returned
start or a HEADER GAP. Never return end coordinates.

SINGLELINE SOURCE-SHAPE EVIDENCE:
- The original BODY is physically collapsed, so whitespace alone is weak evidence.
  Use punctuation, title-shaped leads, repeated peer patterns, and supplied
  deterministic candidate evidence together.
- A compact title-shaped lead followed by prose is positive evidence for a logical
  line start. Two independently title-shaped peer entries normally start two lines.
- A standalone structural-looking phrase can be its own logical line even when it
  has no terminal punctuation. If it is followed by one complete explanatory prose
  unit and then named peers, that explanatory prose starts its own logical line too.
- A comma, semicolon, open delimiter, lowercase continuation, or syntactically open
  fragment is evidence against inserting a new logical line there.
- A compact Label: clause inside an already-open named entry is usually internal to
  that line, not a new top-level line.
- Repeated numbered/bulleted/list-marker material after an introducing clause is
  internal hierarchy unless surrounding context clearly starts a new peer entry.
- Candidate audit/synthetic roles are shape evidence only. top_level, internal,
  structural, and address_only are NOT semantic labels and do not force output.
- HEADER GAP is a hard ownership boundary. Never bridge it.

LOSSLESSNESS:
- Never rewrite, normalize, calculate, translate, complete, reorder, or omit source
  text. You choose starts only; deterministic code preserves exact source.
- If a boundary is genuinely ambiguous, prefer a locally coarser line rather than
  inventing semantics or a language-specific rule.

FEW-SHOT EXAMPLES

Example 1 — collapsed section-like row and named peers:
C010 Special Options C011 First Option. C012 The creature moves. C013 Second Option. C014 The creature attacks.
=> {"starts":[{"s":10},{"s":11},{"s":13}]}
Reason: the standalone phrase and the two independent title-shaped peers become
separate multiline rows; prose after each peer remains with that peer.

Example 2 — collapsed metadata/list continuation:
C020 Damage Immunities acid, C021 cold, C022 fire C023 Languages Common, Draconic C024 Actions
=> {"starts":[{"s":20},{"s":23},{"s":24}]}
Reason: comma-separated values remain one line; the next independently printed row
and standalone structural-looking phrase begin new lines.

Example 3 — named entry with internal labels:
C030 Consume Memories. C031 Intelligence Saving Throw: C032 DC 16, one creature. C033 Failure: C034 The target takes damage. C035 Next Feature. C036 The creature moves.
=> {"starts":[{"s":30},{"s":35}]}
Reason: internal resolution labels belong to the open entry; the next peer title
begins the next logical line.

Example 4 — standalone row, explanatory prose, then peers:
C040 LEGENDARY OPTIONS C041 The creature can take three options, choosing from below. C042 Move. C043 The creature moves. C044 Attack. C045 The creature attacks.
=> {"starts":[{"s":40},{"s":41},{"s":42},{"s":44}]}
Reason: the explanatory prose is a separate multiline row between the standalone
row and the named peers.

Example 5 — introduced internal list:
C050 Breath Choices. C051 Choose one of the following: C052 1. First choice. C053 Text. C054 2. Second choice. C055 Text. C056 Next Feature. C057 Text.
=> {"starts":[{"s":50},{"s":56}]}
Reason: the introduced list stays internal to the open logical entry.

Example 6 — language-independent geometry:
C060 ОСОБЫЕ ДЕЙСТВИЯ C061 Существо может выбрать один вариант. C062 Огненный след. C063 Существо оставляет пламя. C064 Ледяной след. C065 Существо оставляет лёд.
=> {"starts":[{"s":60},{"s":61},{"s":62},{"s":64}]}
Reason: no English vocabulary is required; only collapsed peer geometry is being
recovered.
`.trim();

export function createSinglelineOwnershipBodyUserPrompt(
  _rawSource: string,
  candidates: readonly SourceCandidate[],
  hints: readonly DeterministicHint[] = [],
  forbiddenCandidateIndexes: readonly number[] = [],
  rolesByStart?: SinglelinePresentationRoleByStart,
  syntheticRolesByStart?: SinglelineSyntheticRoleByStart,
): string {
  const forbiddenSet = new Set(forbiddenCandidateIndexes);
  const eligibleIndexes = candidates.map((_, index) => index).filter((index) => !forbiddenSet.has(index));
  const lines: string[] = [];
  const classBySignature = new Map<string, number>();
  const signatures: string[] = [];
  let previousEligible: number | null = null;
  for (const index of eligibleIndexes) {
    if (previousEligible !== null && index !== previousEligible + 1) lines.push("--- HEADER GAP: DO NOT CROSS ---");
    const candidate = candidates[index]!;
    const auditRole = rolesByStart?.get(candidate.start) ?? "mixed";
    const syntheticRole = syntheticRolesByStart?.get(candidate.start) ?? null;
    const boundary = candidate.boundary;
    const shape = [...new Set([...candidate.reasons, ...(boundary?.evidence ?? [])])].join("+") || "none";
    const continuation = boundary?.continuationStrength ?? "none";
    const continuationEvidence = boundary?.continuationEvidence ?? [];
    const signature = `audit=${auditRole}; synthetic=${syntheticRole ?? "none"}; shape=${shape}; continuation=${continuation}${continuationEvidence.length > 0 ? `:${continuationEvidence.join("+")}` : ""}`;
    const transportClass = assignTransportClass(signature, classBySignature, signatures);
    lines.push(
      `C${String(index).padStart(3, "0")} [class=${transportClass}]: ${compactCandidatePreview(candidate.preview)}`,
    );
    previousEligible = index;
  }
  const structuralClassLegend = formatTransportClassLegend(signatures);
  const bodySourceView = createMixedBodySourceView(candidates, forbiddenSet);
  return `
BODY SOURCE VIEW START

${bodySourceView || "(none)"}

BODY SOURCE VIEW END

BODY CANDIDATES START

${lines.join("\n") || "(none)"}

BODY CANDIDATES END

BODY STRUCTURAL CLASSES START

${structuralClassLegend}

BODY STRUCTURAL CLASSES END

SOURCE-SHAPE HINTS START

${formatDeterministicHints(hints)}

SOURCE-SHAPE HINTS END

Only IDs printed in BODY CANDIDATES are legal output addresses. HEADER GAP is a
hard ownership barrier. Read BODY SOURCE VIEW first. Candidate audit/synthetic
roles, boundary evidence, and hints are deterministic observations about geometry
only; they never classify source text and may be ignored when context contradicts
them. Class numbers only deduplicate repeated evidence. Return only
{"starts":[{"s":N}, ...]} in source order, using the integer suffix of the visible
Cxxx address (C017 -> 17).
  `.trim();
}

/** Shadow-only inline-coordinate Header transport. Production still uses the
 * legacy Header request as authority; this contract exists for A/B migration. */
