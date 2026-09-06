import type {
  HeaderFactSource,
  LosslessStatblockDocument,
  ParseIssue,
  ProficiencyBonusFact,
  StructuredHeader,
} from "./domain.js";
import type { ParsedModelHeaderFacts } from "./modelSchema.js";
import {
  CHALLENGE_VALUE_PATTERN,
  PROFICIENCY_BONUS_VALUE_PATTERN,
  headerAnnotations,
  issue,
  normalizeSignedNumber,
  parseChallengeRating,
  proficiencyBonusForChallenge,
} from "./headerFactPrimitives.js";

export type EssentialRegion = NonNullable<ParsedModelHeaderFacts["essentialRegions"]>[number];

export function trimmedEssentialEvidence(
  document: LosslessStatblockDocument,
  region: EssentialRegion | null,
): HeaderFactSource | null {
  if (region === null) return null;
  const boundedStart = Math.max(0, Math.min(document.rawSource.length, region.start));
  const boundedEnd = Math.max(boundedStart, Math.min(document.rawSource.length, region.end));
  if (!(boundedStart < boundedEnd)) return null;
  const raw = document.rawSource.slice(boundedStart, boundedEnd);
  const leading = raw.length - raw.trimStart().length;
  const trailing = raw.length - raw.trimEnd().length;
  const start = boundedStart + leading;
  const end = boundedEnd - trailing;
  if (!(start < end)) return null;
  const evidence = document.rawSource.slice(start, end);
  const owner =
    document.annotations.find((annotation) => annotation.source.start <= start && annotation.source.end >= end) ?? null;
  return {
    annotationId: owner?.id ?? `verified-essential-${region.kind}`,
    start,
    end,
    evidence,
  };
}

export function essentialRegion(
  regions: readonly EssentialRegion[],
  kind: EssentialRegion["kind"],
): EssentialRegion | null {
  return regions.find((region) => region.kind === kind) ?? null;
}

export function resolveCompactEvidenceBoundary(
  document: LosslessStatblockDocument,
  source: HeaderFactSource | null,
  region: EssentialRegion | null,
  regions: readonly EssentialRegion[],
): HeaderFactSource | null {
  if (source === null || region === null) return source;

  // A verifier coordinate is an address, not permission to invent text. When a
  // compact fact ends in the middle of a balanced parenthetical, deterministic
  // code may complete only the missing right edge inside a source-proven corridor:
  // before the next physical line break or independently grounded essential fact.
  // If the source itself contains an unmatched opening
  // parenthesis, no closure exists inside that safe corridor and the original
  // (malformed but real) source span is preserved unchanged.
  const opens = Array.from(source.evidence).filter((char) => char === "(").length;
  const closes = Array.from(source.evidence).filter((char) => char === ")").length;
  if (opens <= closes) return source;

  const nextEssentialStart =
    regions
      .filter((candidate) => candidate.start >= region.end && candidate.start > source.end)
      .map((candidate) => candidate.start)
      .sort((left, right) => left - right)[0] ?? null;
  const nextLineBreakIndex = document.rawSource.slice(source.end).search(/[\r\n]/u);
  const nextLineBreak = nextLineBreakIndex < 0 ? null : source.end + nextLineBreakIndex;
  const safeBounds = [nextEssentialStart, nextLineBreak].filter(
    (value): value is number => value !== null && value > source.end,
  );
  if (safeBounds.length === 0) return source;
  const bound = Math.min(...safeBounds);
  const tail = document.rawSource.slice(source.end, bound);
  let depth = opens - closes;

  for (let index = 0; index < tail.length; index += 1) {
    const char = tail[index]!;
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        const end = source.end + index + 1;
        return {
          annotationId: source.annotationId,
          start: source.start,
          end,
          evidence: document.rawSource.slice(source.start, end),
        };
      }
    }
  }

  return source;
}

export function resolvedEssentialEvidence(
  document: LosslessStatblockDocument,
  regions: readonly EssentialRegion[],
  kind: EssentialRegion["kind"],
): HeaderFactSource | null {
  const region = essentialRegion(regions, kind);
  return resolveCompactEvidenceBoundary(document, trimmedEssentialEvidence(document, region), region, regions);
}

export function compactEvidence(source: HeaderFactSource | null, maxLength = 320): HeaderFactSource | null {
  if (source === null) return null;
  if (source.evidence.length > maxLength) return null;
  if (source.evidence.split(/\r?\n/u).filter((row) => row.trim().length > 0).length > 3) return null;
  return source;
}

export function verifiedTextFact(
  document: LosslessStatblockDocument,
  regions: readonly EssentialRegion[],
  kind: "name" | "size_type_alignment",
): StructuredHeader["name"] {
  const source = compactEvidence(resolvedEssentialEvidence(document, regions, kind), 240);
  if (source === null) return null;
  return { text: source.evidence.replace(/\s+/gu, " ").trim(), provenance: "model_evidence", source };
}

export function fallbackTextFact(
  document: LosslessStatblockDocument,
  field: "name" | "size_type_alignment",
): StructuredHeader["name"] {
  const annotations = headerAnnotations(document, [field]);
  if (annotations.length !== 1) return null;
  const annotation = annotations[0]!;
  const evidence = annotation.text.trim();
  if (evidence.length === 0) return null;
  return {
    text: evidence.replace(/\s+/gu, " "),
    provenance: "deterministic_header_parse",
    source: {
      annotationId: annotation.id,
      start: annotation.source.start,
      end: annotation.source.end,
      evidence: annotation.text,
    },
  };
}

export function verifiedIntegerFact(
  document: LosslessStatblockDocument,
  regions: readonly EssentialRegion[],
  kind: "armor_class" | "hit_points",
): StructuredHeader["armorClass"] {
  const source = compactEvidence(resolvedEssentialEvidence(document, regions, kind));
  if (source === null) return null;
  const match = /(?<!\d)(\d{1,5})(?!\d)/u.exec(source.evidence);
  if (match === null) return null;
  const value = Number(match[1]);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return { value, provenance: "model_evidence", source };
}

export function fallbackIntegerFact(
  document: LosslessStatblockDocument,
  field: "armor_class" | "hit_points",
): StructuredHeader["armorClass"] {
  const annotations = headerAnnotations(document, [field]);
  if (annotations.length !== 1) return null;
  const annotation = annotations[0]!;
  const match = /(?<!\d)(\d{1,5})(?!\d)/u.exec(annotation.text);
  if (match === null) return null;
  const value = Number(match[1]);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return {
    value,
    provenance: "deterministic_header_parse",
    source: {
      annotationId: annotation.id,
      start: annotation.source.start + match.index,
      end: annotation.source.start + match.index + match[0].length,
      evidence: match[0],
    },
  };
}

export function verifiedInitiativeFact(
  document: LosslessStatblockDocument,
  regions: readonly EssentialRegion[],
): StructuredHeader["initiative"] {
  const source = compactEvidence(resolvedEssentialEvidence(document, regions, "initiative"));
  if (source === null) return null;
  const match = /([+\-−‒–—﹣－＋]\d{1,3})/u.exec(source.evidence);
  if (match === null) return null;
  const value = normalizeSignedNumber(match[1]);
  if (!Number.isSafeInteger(value)) return null;
  return { value, provenance: "model_evidence", source };
}

export function fallbackInitiativeFact(document: LosslessStatblockDocument): StructuredHeader["initiative"] {
  const annotations = headerAnnotations(document, ["initiative"]);
  if (annotations.length !== 1) return null;
  const annotation = annotations[0]!;
  const match = /([+\-−‒–—﹣－＋]\d{1,3})/u.exec(annotation.text);
  if (match === null) return null;
  const value = normalizeSignedNumber(match[1]);
  if (!Number.isSafeInteger(value)) return null;
  return {
    value,
    provenance: "deterministic_header_parse",
    source: {
      annotationId: annotation.id,
      start: annotation.source.start + match.index,
      end: annotation.source.start + match.index + match[0].length,
      evidence: match[0],
    },
  };
}

export function challengeFactFromEvidence(
  document: LosslessStatblockDocument,
  regions: readonly EssentialRegion[],
): StructuredHeader["challenge"] {
  const source = compactEvidence(resolvedEssentialEvidence(document, regions, "challenge"));
  if (source === null) return null;
  const match = CHALLENGE_VALUE_PATTERN.exec(source.evidence);
  if (match === null) return null;
  const value = parseChallengeRating(match[1]);
  if (value === null) return null;
  return { value, provenance: "model_evidence", source };
}

export function challengeFactFromHeader(document: LosslessStatblockDocument): StructuredHeader["challenge"] {
  const annotations = headerAnnotations(document, ["challenge"]);
  if (annotations.length !== 1) return null;
  const annotation = annotations[0]!;
  const match = CHALLENGE_VALUE_PATTERN.exec(annotation.text);
  if (match === null) return null;
  const value = parseChallengeRating(match[1]);
  if (value === null) return null;
  return {
    value,
    provenance: "deterministic_header_parse",
    source: {
      annotationId: annotation.id,
      start: annotation.source.start + match.index,
      end: annotation.source.start + match.index + match[0].length,
      evidence: match[0],
    },
  };
}

export function scalarSignedFieldCandidate(
  text: string,
): { value: number; matchIndex: number; matchText: string } | null {
  const leading = text.length - text.trimStart().length;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 240) return null;
  if (trimmed.split(/\r?\n/u).filter((row) => row.trim().length > 0).length > 3) return null;

  const signedMatches = Array.from(trimmed.matchAll(/[+\-−‒–—﹣－＋]\d{1,3}/gu));
  if (signedMatches.length !== 1) return null;

  // A scalar printed field must expose exactly one numeric atom. This rejects
  // structurally incompatible semantic mistakes such as saving-throw lists,
  // initiative rows with a parenthetical score, or ordinary unsigned metadata,
  // without comparing the printed value to a CR-derived expectation.
  const numericAtoms = Array.from(trimmed.matchAll(/[+\-−‒–—﹣－＋]?\d+(?:[.,]\d+)?/gu));
  if (numericAtoms.length !== 1) return null;

  const match = signedMatches[0]!;
  const value = normalizeSignedNumber(match[0]);
  if (!Number.isSafeInteger(value)) return null;
  return { value, matchIndex: leading + match.index, matchText: match[0] };
}

export function structuredProficiencyBonus(
  document: LosslessStatblockDocument,
  issues: ParseIssue[],
  essentialRegions: readonly EssentialRegion[] = [],
): ProficiencyBonusFact | null {
  const challengeAnnotations = headerAnnotations(document, ["challenge"]);
  const proficiencyAnnotations = headerAnnotations(document, ["proficiency_bonus", "challenge"]);
  const semanticChallengeCandidates = challengeAnnotations.flatMap((annotation) => {
    const match = CHALLENGE_VALUE_PATTERN.exec(annotation.text);
    if (match === null) return [];
    const value = parseChallengeRating(match[1]);
    if (value === null) return [];
    return [
      {
        value,
        source: {
          annotationId: annotation.id,
          start: annotation.source.start + match.index,
          end: annotation.source.start + match.index + match[0].length,
          evidence: match[0],
        },
      },
    ];
  });
  const verifiedChallengeSource = compactEvidence(resolvedEssentialEvidence(document, essentialRegions, "challenge"));
  const verifiedChallengeCandidate = (() => {
    if (verifiedChallengeSource === null) return null;
    const match = CHALLENGE_VALUE_PATTERN.exec(verifiedChallengeSource.evidence);
    const value = match === null ? null : parseChallengeRating(match[1]);
    return value === null ? null : { value, source: verifiedChallengeSource };
  })();

  // The independent fixed-header verifier exists precisely so a wrong semantic
  // ownership decision cannot poison a proven card fact. Once CR is independently
  // grounded, unrelated annotations labelled `challenge` are diagnostics only and
  // must not block deterministic PB derivation (UTTERANCE OF DAMNATION regression).
  const challengeCandidates =
    verifiedChallengeCandidate === null ? semanticChallengeCandidates : [verifiedChallengeCandidate];
  const challengeValues = new Set(challengeCandidates.map((candidate) => candidate.value));

  if (challengeValues.size > 1) {
    issues.push(
      issue(
        "conflicting_challenge_rating",
        "warning",
        "Conflicting grounded Challenge Ratings were found; proficiency bonus was not derived automatically.",
        { values: [...challengeValues], evidence: challengeCandidates.map((candidate) => candidate.source.evidence) },
      ),
    );
    return null;
  }

  const challenge = challengeCandidates[0] ?? null;
  const derivedValue = challenge === null ? null : proficiencyBonusForChallenge(challenge.value);

  const verifiedPbSource = compactEvidence(resolvedEssentialEvidence(document, essentialRegions, "proficiency_bonus"));
  const verifiedPbCandidate = (() => {
    if (verifiedPbSource === null) return null;

    // A verifier claim is still only a semantic proposal over grounded source.
    // It must satisfy the same deterministic source-shape proof as any other
    // printed PB claim. The one exception is a PB printed inline inside the
    // independently grounded Challenge field: that source row is not scalar by
    // construction, but overlap with the selected Challenge evidence proves the
    // enclosing field that owns the inline signed value.
    const overlapsSelectedChallenge =
      challenge !== null &&
      verifiedPbSource.start < challenge.source.end &&
      challenge.source.start < verifiedPbSource.end;
    if (overlapsSelectedChallenge) {
      const match = PROFICIENCY_BONUS_VALUE_PATTERN.exec(verifiedPbSource.evidence);
      if (match === null) return null;
      return {
        value: normalizeSignedNumber(match[1]),
        source: verifiedPbSource,
      };
    }

    const scalar = scalarSignedFieldCandidate(verifiedPbSource.evidence);
    if (scalar === null) {
      issues.push(
        issue(
          "unproven_verified_proficiency_bonus",
          "warning",
          "A verifier-proposed proficiency-bonus region was preserved as source but rejected for the structured PB fact because its source shape was incompatible with one printed scalar field.",
          { challengeRating: challenge?.value ?? null, derived: derivedValue, evidence: verifiedPbSource.evidence },
        ),
      );
      return null;
    }

    return {
      value: scalar.value,
      // Keep the complete grounded field as provenance. The numeric atom proves
      // the value, while Evidence must be able to show the exact printed row.
      source: verifiedPbSource,
    };
  })();

  const annotationCandidates = proficiencyAnnotations.flatMap((annotation) => {
    if (annotation.field === "challenge") {
      const match = PROFICIENCY_BONUS_VALUE_PATTERN.exec(annotation.text);
      if (match === null) return [];
      const value = normalizeSignedNumber(match[1]);
      const source = {
        annotationId: annotation.id,
        start: annotation.source.start + match.index,
        end: annotation.source.start + match.index + match[0].length,
        evidence: match[0],
      };

      // Inline PB is valid only inside the same source field that supplied the
      // selected CR. A bad semantic `challenge` span may contain arbitrary signed
      // mechanics later in body prose; those numbers must never become PB.
      if (challenge !== null && annotation.id === challenge.source.annotationId) return [{ value, source }];
      return [];
    }

    const sourceText = document.rawSource.slice(annotation.source.start, annotation.source.end);
    const scalar = scalarSignedFieldCandidate(sourceText);
    if (scalar !== null) {
      return [
        {
          value: scalar.value,
          // The scalar proof establishes the value, but provenance remains the
          // complete exact printed field so product Evidence never hides the
          // original standalone PB row behind a normalized card label.
          source: {
            annotationId: annotation.id,
            start: annotation.source.start,
            end: annotation.source.end,
            evidence: sourceText,
          },
        },
      ];
    }

    issues.push(
      issue(
        "unverified_proficiency_bonus_candidate_rejected",
        "warning",
        "A model-owned proficiency-bonus row was not independently verified and was structurally incompatible with a single printed scalar field, so it was rejected instead of becoming a card fact.",
        { challengeRating: challenge?.value ?? null, derived: derivedValue, evidence: sourceText },
      ),
    );
    return [];
  });

  const explicitCandidates =
    verifiedPbCandidate === null
      ? annotationCandidates
      : [
          verifiedPbCandidate,
          ...annotationCandidates.filter((candidate) => candidate.value === verifiedPbCandidate.value),
        ];
  const explicitValues = new Set(explicitCandidates.map((candidate) => candidate.value));

  if (explicitValues.size > 1) {
    issues.push(
      issue(
        "conflicting_proficiency_bonus",
        "warning",
        "Conflicting explicitly printed proficiency bonuses were found; no value was selected automatically.",
        { values: [...explicitValues], evidence: explicitCandidates.map((candidate) => candidate.source.evidence) },
      ),
    );
    return null;
  }

  const explicit = explicitCandidates[0] ?? null;

  if (explicit !== null) {
    if (derivedValue !== null && explicit.value !== derivedValue) {
      issues.push(
        issue(
          "proficiency_bonus_cr_mismatch",
          "warning",
          "The explicitly printed proficiency bonus conflicts with the value derived from grounded CR; the printed source value was preserved.",
          {
            challengeRating: challenge?.value,
            printed: explicit.value,
            derived: derivedValue,
            evidence: explicit.source.evidence,
          },
        ),
      );
    }
    return {
      value: explicit.value,
      printed: true,
      challengeRating: challenge?.value ?? null,
      provenance: verifiedPbCandidate !== null ? "model_evidence" : "deterministic_header_parse",
      source: explicit.source,
    };
  }

  if (challenge !== null && derivedValue !== null) {
    return {
      value: derivedValue,
      printed: false,
      challengeRating: challenge.value,
      provenance: "deterministic_cr_derivation",
      source: challenge.source,
    };
  }

  if (challengeAnnotations.length > 0) {
    issues.push(
      issue(
        "unparsed_challenge_rating",
        "warning",
        "A grounded Challenge field exists, but its numeric rating could not be read safely enough to derive proficiency bonus.",
        { evidence: challengeAnnotations.map((annotation) => annotation.text) },
      ),
    );
  }

  return null;
}
