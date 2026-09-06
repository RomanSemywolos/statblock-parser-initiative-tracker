import type { CompiledAnnotation, HeaderFactSource, HeaderField, LosslessStatblockDocument } from "./domain.js";

export type SourceOwnershipChannel = "header" | "header_evidence";

export type SourceOwnershipProvenance =
  "accepted_header_annotation" | "structured_header_fact" | "structured_header_evidence";

export type SourceOwnershipOwner = {
  channel: SourceOwnershipChannel;
  provenance: SourceOwnershipProvenance;
  annotationId: string | null;
  field: HeaderField | null;
};

export type SourceOwnershipRange = {
  start: number;
  end: number;
  owners: SourceOwnershipOwner[];
};

export type SourceOwnershipMap = {
  rawLength: number;
  ranges: SourceOwnershipRange[];
};

type ProposedOwnership = {
  start: number;
  end: number;
  owner: SourceOwnershipOwner;
};

function ownerKey(owner: SourceOwnershipOwner): string {
  return `${owner.channel}\u0000${owner.provenance}\u0000${owner.annotationId ?? ""}\u0000${owner.field ?? ""}`;
}

function sortedOwners(owners: Iterable<SourceOwnershipOwner>): SourceOwnershipOwner[] {
  return [...owners].sort((left, right) => ownerKey(left).localeCompare(ownerKey(right)));
}

function sameOwners(left: readonly SourceOwnershipOwner[], right: readonly SourceOwnershipOwner[]): boolean {
  return left.length === right.length && left.every((owner, index) => ownerKey(owner) === ownerKey(right[index]!));
}

function acceptedAnnotationProposal(rawSource: string, annotation: CompiledAnnotation): ProposedOwnership | null {
  if (annotation.role !== "header_field" && annotation.role !== "header_content") return null;
  if (!(
    annotation.source.start >= 0 &&
    annotation.source.start < annotation.source.end &&
    annotation.source.end <= rawSource.length
  ))
    return null;
  if (rawSource.slice(annotation.source.start, annotation.source.end) !== annotation.text) return null;

  return {
    start: annotation.source.start,
    end: annotation.source.end,
    owner: {
      channel: "header",
      provenance: "accepted_header_annotation",
      annotationId: annotation.id,
      field: annotation.field,
    },
  };
}

function groundedFactProposal(
  rawSource: string,
  source: HeaderFactSource | null | undefined,
  field: HeaderField,
  provenance: "structured_header_fact" | "structured_header_evidence",
): ProposedOwnership | null {
  if (source === null || source === undefined) return null;
  if (!(source.start >= 0 && source.start < source.end && source.end <= rawSource.length)) return null;
  if (rawSource.slice(source.start, source.end) !== source.evidence) return null;

  return {
    start: source.start,
    end: source.end,
    owner: {
      channel: "header_evidence",
      provenance,
      annotationId: source.annotationId || null,
      field,
    },
  };
}

function structuredHeaderProposals(document: LosslessStatblockDocument): ProposedOwnership[] {
  const header = document.structuredHeader;
  const proposals: ProposedOwnership[] = [];
  const addFact = (source: HeaderFactSource | null | undefined, field: HeaderField): void => {
    const proposal = groundedFactProposal(document.rawSource, source, field, "structured_header_fact");
    if (proposal !== null) proposals.push(proposal);
  };
  const addEvidence = (source: HeaderFactSource | null | undefined, field: HeaderField): void => {
    const proposal = groundedFactProposal(document.rawSource, source, field, "structured_header_evidence");
    if (proposal !== null) proposals.push(proposal);
  };

  addFact(header.name?.source, "name");
  addFact(header.sizeTypeAlignment?.source, "size_type_alignment");
  addFact(header.armorClass?.source, "armor_class");
  addFact(header.initiative?.source, "initiative");
  addFact(header.hitPoints?.source, "hit_points");
  addFact(header.challenge?.source, "challenge");
  if (header.proficiencyBonus?.printed) addFact(header.proficiencyBonus.source, "proficiency_bonus");

  addEvidence(header.abilityEvidence, "ability_scores");
  addEvidence(header.savingThrowEvidence, "saving_throws");

  for (const ability of Object.values(header.abilities)) {
    if (ability !== null) addFact(ability.source, "ability_scores");
  }
  for (const save of header.savingThrows) addFact(save.source, "saving_throws");

  return proposals;
}

function normalizeOwnership(rawLength: number, proposals: readonly ProposedOwnership[]): SourceOwnershipRange[] {
  const boundaries = [...new Set(proposals.flatMap((proposal) => [proposal.start, proposal.end]))]
    .filter((value) => value >= 0 && value <= rawLength)
    .sort((left, right) => left - right);
  const result: SourceOwnershipRange[] = [];

  for (let index = 0; index + 1 < boundaries.length; index += 1) {
    const start = boundaries[index]!;
    const end = boundaries[index + 1]!;
    if (!(start < end)) continue;

    const ownerMap = new Map<string, SourceOwnershipOwner>();
    for (const proposal of proposals) {
      if (proposal.start <= start && end <= proposal.end) ownerMap.set(ownerKey(proposal.owner), proposal.owner);
    }
    if (ownerMap.size === 0) continue;

    const owners = sortedOwners(ownerMap.values());
    const previous = result.at(-1);
    if (previous !== undefined && previous.end === start && sameOwners(previous.owners, owners)) {
      previous.end = end;
    } else {
      result.push({ start, end, owners });
    }
  }

  return result;
}

/**
 * Resolve the exact source ranges that the current compiled document has already
 * accepted as Header ownership or as grounded Header evidence.
 *
 * This is deliberately downstream of model proposals: rejected/uncompiled model
 * claims are absent from `document.annotations`, and malformed/stale fact sources
 * are ignored rather than creating ownership. The resolver does not infer a
 * prefix boundary and does not decide anything about the remainder's semantics.
 */
export function resolveAcceptedHeaderOwnership(document: LosslessStatblockDocument): SourceOwnershipMap {
  const proposals = document.annotations
    .map((annotation) => acceptedAnnotationProposal(document.rawSource, annotation))
    .filter((proposal): proposal is ProposedOwnership => proposal !== null);
  proposals.push(...structuredHeaderProposals(document));

  const map: SourceOwnershipMap = {
    rawLength: document.rawSource.length,
    ranges: normalizeOwnership(document.rawSource.length, proposals),
  };
  assertValidSourceOwnershipMap(document.rawSource, map);
  return map;
}

/**
 * Infrastructure invariant for the ownership layer. Ranges must be an exact,
 * ordered, disjoint view over the original source coordinate system. The gaps
 * between them are the implicit remainder; sweeping owned ranges plus those gaps
 * must cover [0, rawSource.length) exactly once.
 */
export function assertValidSourceOwnershipMap(rawSource: string, map: SourceOwnershipMap): void {
  if (map.rawLength !== rawSource.length)
    throw new Error("Source ownership rawLength does not match raw source length.");

  let cursor = 0;
  let partitionLength = 0;
  for (const range of map.ranges) {
    if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end)) {
      throw new Error("Source ownership range coordinates must be safe integers.");
    }
    if (!(0 <= range.start && range.start < range.end && range.end <= rawSource.length)) {
      throw new Error("Source ownership range lies outside the raw source.");
    }
    if (range.start < cursor) throw new Error("Source ownership ranges must be ordered and non-overlapping.");
    if (range.owners.length === 0)
      throw new Error("Every source ownership range must have at least one accepted owner.");

    // The unowned gap and the owned interval together advance the exact original
    // coordinate sweep; no replacement/concatenated source is constructed here.
    partitionLength += range.start - cursor;
    partitionLength += range.end - range.start;
    cursor = range.end;
  }
  partitionLength += rawSource.length - cursor;

  if (partitionLength !== rawSource.length) {
    throw new Error("Owned ranges plus implicit remainder do not partition the exact raw source.");
  }
}
