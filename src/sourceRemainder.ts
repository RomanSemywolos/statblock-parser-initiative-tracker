import type { SourceOwnershipMap, SourceOwnershipRange } from "./sourceOwnership.js";
import { assertValidSourceOwnershipMap } from "./sourceOwnership.js";

export type RemainderSegment = {
  index: number;
  start: number;
  end: number;
  text: string;
  precededByOwnership: boolean;
  followedByOwnership: boolean;
};

export type RemainderDiscontinuity = {
  start: number;
  end: number;
  text: string;
  ownership: SourceOwnershipRange;
};

export type RemainderView = {
  rawLength: number;
  segments: RemainderSegment[];
  discontinuities: RemainderDiscontinuity[];
};

function pushRemainderSegment(
  rawSource: string,
  segments: RemainderSegment[],
  start: number,
  end: number,
  precededByOwnership: boolean,
  followedByOwnership: boolean,
): void {
  if (!(start < end)) return;
  segments.push({
    index: segments.length,
    start,
    end,
    text: rawSource.slice(start, end),
    precededByOwnership,
    followedByOwnership,
  });
}

/**
 * Build the exact complement of accepted source ownership without concatenating
 * separated source fragments. Every accepted ownership interval becomes an
 * explicit discontinuity between remainder segments, so later structural logic
 * can treat that gap as a hard source boundary instead of inventing adjacency.
 *
 * This is infrastructure only: the view does not classify the remainder and is
 * not yet used by parser routing or LLM transport.
 */
export function buildRemainderView(rawSource: string, ownership: SourceOwnershipMap): RemainderView {
  assertValidSourceOwnershipMap(rawSource, ownership);

  const segments: RemainderSegment[] = [];
  const discontinuities: RemainderDiscontinuity[] = [];
  let cursor = 0;

  for (const range of ownership.ranges) {
    pushRemainderSegment(rawSource, segments, cursor, range.start, cursor > 0, true);

    discontinuities.push({
      start: range.start,
      end: range.end,
      text: rawSource.slice(range.start, range.end),
      ownership: range,
    });
    cursor = range.end;
  }

  pushRemainderSegment(rawSource, segments, cursor, rawSource.length, cursor > 0, false);

  const view: RemainderView = {
    rawLength: rawSource.length,
    segments,
    discontinuities,
  };
  assertValidRemainderView(rawSource, ownership, view);
  return view;
}

/**
 * Validate that ownership discontinuities and remainder segments form one exact,
 * ordered partition of the original source coordinate space. Segment text and
 * discontinuity text must be exact raw-source slices; no synthetic concatenated
 * source is allowed.
 */
export function assertValidRemainderView(rawSource: string, ownership: SourceOwnershipMap, view: RemainderView): void {
  assertValidSourceOwnershipMap(rawSource, ownership);
  if (view.rawLength !== rawSource.length) {
    throw new Error("Remainder view rawLength does not match raw source length.");
  }
  if (view.discontinuities.length !== ownership.ranges.length) {
    throw new Error("Remainder discontinuities must correspond one-to-one with accepted ownership ranges.");
  }

  for (let index = 0; index < view.discontinuities.length; index += 1) {
    const discontinuity = view.discontinuities[index]!;
    const range = ownership.ranges[index]!;
    if (discontinuity.start !== range.start || discontinuity.end !== range.end || discontinuity.ownership !== range) {
      throw new Error("Remainder discontinuity does not match its accepted ownership range.");
    }
    if (discontinuity.text !== rawSource.slice(range.start, range.end)) {
      throw new Error("Remainder discontinuity text does not match the exact raw source slice.");
    }
  }

  let expectedSegmentIndex = 0;
  for (const segment of view.segments) {
    if (segment.index !== expectedSegmentIndex) {
      throw new Error("Remainder segment indices must be contiguous and ordered.");
    }
    expectedSegmentIndex += 1;
    if (!Number.isSafeInteger(segment.start) || !Number.isSafeInteger(segment.end)) {
      throw new Error("Remainder segment coordinates must be safe integers.");
    }
    if (!(0 <= segment.start && segment.start < segment.end && segment.end <= rawSource.length)) {
      throw new Error("Remainder segment lies outside the raw source.");
    }
    if (segment.text !== rawSource.slice(segment.start, segment.end)) {
      throw new Error("Remainder segment text does not match the exact raw source slice.");
    }
  }

  type PartitionPart = { start: number; end: number; kind: "owned" | "remainder" };
  const parts: PartitionPart[] = [
    ...ownership.ranges.map((range) => ({ start: range.start, end: range.end, kind: "owned" as const })),
    ...view.segments.map((segment) => ({ start: segment.start, end: segment.end, kind: "remainder" as const })),
  ].sort((left, right) => left.start - right.start || left.end - right.end);

  let cursor = 0;
  for (const part of parts) {
    if (part.start !== cursor) {
      throw new Error("Accepted ownership plus remainder segments must partition the raw source exactly once.");
    }
    cursor = part.end;
  }
  if (cursor !== rawSource.length) {
    throw new Error("Accepted ownership plus remainder segments do not reach the end of the raw source.");
  }

  for (const segment of view.segments) {
    const preceding = ownership.ranges.some((range) => range.end === segment.start);
    const following = ownership.ranges.some((range) => range.start === segment.end);
    if (segment.precededByOwnership !== preceding || segment.followedByOwnership !== following) {
      throw new Error("Remainder segment hard-boundary flags do not match accepted ownership gaps.");
    }
  }
}
