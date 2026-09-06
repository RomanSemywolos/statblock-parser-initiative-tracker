import assert from "node:assert/strict";
import test from "node:test";

import { attachBoundaryEvidence } from "./boundaryEvidence.js";
import { enforceSourceProvenFeatureBoundaries } from "./sourceProvenFeatureBoundaries.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import type { CandidateRun } from "./modelSchema.js";
import { createSourceCandidates, enrichSinglelineCandidates } from "./sourceCandidates.js";

function candidateSpanText(
  rawSource: string,
  candidates: readonly { start: number }[],
  startCandidate: number,
  endCandidate: number,
): string {
  const start = candidates[startCandidate]?.start ?? 0;
  const end = candidates[endCandidate + 1]?.start ?? rawSource.length;
  return rawSource.slice(start, end).trim();
}

test("active source-proven boundaries split peer features without English section injection", () => {
  const source =
    "Actions Multiattack. The creature makes two attacks. Tentacle. Melee Weapon Attack: +17 to hit. The target dies if reduced to 0. Gaze. The target suffers one of the following effects: 1. First Gaze. Effect one. 2. Second Gaze. Effect two. 3. Third Gaze. Effect three. Legendary Actions The creature can take 2 legendary actions, choosing from the options below. Tail. Melee Weapon Attack: +17 to hit. Maddening Gaze. The creature uses its gaze.";
  const map = createLosslessSourceMap(source);
  const candidates = attachBoundaryEvidence(
    source,
    map,
    enrichSinglelineCandidates(source, map, createSourceCandidates(source, map)),
    "singleline",
  );
  const indexOf = (text: string): number => {
    const sourceStart = source.indexOf(text);
    const index = candidates.findIndex((candidate) => candidate.start === sourceStart);
    assert.notEqual(index, -1, `candidate not found: ${text}`);
    return index;
  };

  const actions = indexOf("Actions");
  const multiattack = indexOf("Multiattack.");
  const legendary = indexOf("Legendary Actions");
  const legendaryRules = indexOf("The creature can take 2 legendary actions");
  const tail = indexOf("Tail.");

  // The model owns section semantics. Deterministic source evidence may split a
  // coarse feature span only at source-proven peer feature boundaries.
  const coarse: CandidateRun[] = [
    { classification: "actions_heading", startCandidate: actions, endCandidate: actions, field: null },
    { classification: "feature", startCandidate: multiattack, endCandidate: legendary - 1, field: null },
    {
      classification: "legendary_actions_heading",
      startCandidate: legendary,
      endCandidate: legendaryRules - 1,
      field: null,
    },
    { classification: "section_rules", startCandidate: legendaryRules, endCandidate: tail - 1, field: null },
    { classification: "feature", startCandidate: tail, endCandidate: candidates.length - 1, field: null },
  ];

  const result = enforceSourceProvenFeatureBoundaries(source, candidates, coarse);
  const texts = result.runs.map((run) => ({
    classification: run.classification,
    text: candidateSpanText(source, candidates, run.startCandidate, run.endCandidate),
  }));

  assert.ok(texts.some((run) => run.classification === "feature" && run.text.startsWith("Multiattack.")));
  assert.ok(texts.some((run) => run.classification === "feature" && run.text.startsWith("Tentacle.")));
  const gaze = texts.find((run) => run.classification === "feature" && run.text.startsWith("Gaze."));
  assert.ok(gaze);
  assert.match(gaze.text, /1\. First Gaze/);
  assert.match(gaze.text, /3\. Third Gaze/);
  assert.ok(
    texts.some((run) => run.classification === "legendary_actions_heading" && run.text === "Legendary Actions"),
  );
  assert.ok(
    texts.some(
      (run) =>
        run.classification === "section_rules" && run.text.startsWith("The creature can take 2 legendary actions"),
    ),
  );
  assert.ok(texts.some((run) => run.classification === "feature" && run.text.startsWith("Tail.")));
  assert.ok(texts.some((run) => run.classification === "feature" && run.text.startsWith("Maddening Gaze.")));
  assert.ok(result.issues.some((issue) => issue.code === "candidate_feature_split_at_internal_named_start"));
});
