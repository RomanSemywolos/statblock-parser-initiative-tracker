import assert from "node:assert/strict";
import test from "node:test";

import type { SourceOwnershipMap } from "./sourceOwnership.js";
import { assertValidRemainderView, buildRemainderView } from "./sourceRemainder.js";

const owner = {
  channel: "header" as const,
  provenance: "accepted_header_annotation" as const,
  annotationId: "header",
  field: "other_header" as const,
};

function map(raw: string, ranges: Array<[number, number]>): SourceOwnershipMap {
  return {
    rawLength: raw.length,
    ranges: ranges.map(([start, end]) => ({ start, end, owners: [owner] })),
  };
}

test("remainder view is the exact complement of accepted ownership", () => {
  const raw = "AAAA header BBBB evidence CCCC";
  const firstStart = raw.indexOf("header");
  const secondStart = raw.indexOf("evidence");
  const ownership = map(raw, [
    [firstStart, firstStart + "header".length],
    [secondStart, secondStart + "evidence".length],
  ]);

  const view = buildRemainderView(raw, ownership);

  assert.deepEqual(
    view.segments.map(({ start, end, text }) => ({ start, end, text })),
    [
      { start: 0, end: firstStart, text: raw.slice(0, firstStart) },
      { start: firstStart + 6, end: secondStart, text: raw.slice(firstStart + 6, secondStart) },
      { start: secondStart + 8, end: raw.length, text: raw.slice(secondStart + 8) },
    ],
  );
  assert.deepEqual(
    view.discontinuities.map(({ start, end, text }) => ({ start, end, text })),
    [
      { start: firstStart, end: firstStart + 6, text: "header" },
      { start: secondStart, end: secondStart + 8, text: "evidence" },
    ],
  );
});

test("owned intervals are hard discontinuities and never create synthetic adjacency", () => {
  const raw = "Feature A. HEADER Feature B.";
  const start = raw.indexOf("HEADER");
  const ownership = map(raw, [[start, start + "HEADER".length]]);
  const view = buildRemainderView(raw, ownership);

  assert.equal(view.segments.length, 2);
  assert.equal(view.segments[0]!.text, "Feature A. ");
  assert.equal(view.segments[0]!.followedByOwnership, true);
  assert.equal(view.segments[1]!.text, " Feature B.");
  assert.equal(view.segments[1]!.precededByOwnership, true);
  assert.equal(view.segments[0]!.end, start);
  assert.equal(view.segments[1]!.start, start + "HEADER".length);
});

test("empty ownership leaves one exact remainder segment", () => {
  const raw = "Everything remains visible.";
  const view = buildRemainderView(raw, map(raw, []));

  assert.equal(view.discontinuities.length, 0);
  assert.deepEqual(view.segments, [
    {
      index: 0,
      start: 0,
      end: raw.length,
      text: raw,
      precededByOwnership: false,
      followedByOwnership: false,
    },
  ]);
});

test("fully owned source leaves no remainder segment", () => {
  const raw = "Header only";
  const view = buildRemainderView(raw, map(raw, [[0, raw.length]]));

  assert.equal(view.segments.length, 0);
  assert.equal(view.discontinuities.length, 1);
  assert.equal(view.discontinuities[0]!.text, raw);
});

test("remainder validator rejects invented concatenated or mutated source", () => {
  const raw = "AAA HEADER BBB";
  const start = raw.indexOf("HEADER");
  const ownership = map(raw, [[start, start + 6]]);
  const view = buildRemainderView(raw, ownership);

  const mutated = {
    ...view,
    segments: view.segments.map((segment, index) => (index === 1 ? { ...segment, text: "BBB" } : segment)),
  };
  assert.throws(() => assertValidRemainderView(raw, ownership, mutated), /exact raw source slice/u);
});

test("remainder validator rejects a missing coordinate interval", () => {
  const raw = "AAA HEADER BBB";
  const start = raw.indexOf("HEADER");
  const ownership = map(raw, [[start, start + 6]]);
  const view = buildRemainderView(raw, ownership);
  const broken = {
    ...view,
    segments: view.segments.map((segment, index) =>
      index === 1 ? { ...segment, start: segment.start + 1, text: raw.slice(segment.start + 1, segment.end) } : segment,
    ),
  };

  assert.throws(() => assertValidRemainderView(raw, ownership, broken), /partition the raw source exactly once/u);
});
