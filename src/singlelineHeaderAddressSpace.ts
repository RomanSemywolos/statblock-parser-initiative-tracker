import type { LosslessSourceMap } from "./domain.js";
import type { SourceCandidate } from "./candidateTypes.js";

/**
 * Exact address space for the collapsed singleline Header selector.
 *
 * Mixed input can use surviving physical/source geometry to keep its Header
 * coordinate lattice sparse. Fully collapsed input cannot: pruning token starts
 * would make completeness depend on a heuristic about where an unfamiliar Header
 * label may begin. The singleline Header therefore gets one address for every
 * non-whitespace source unit.
 *
 * These candidates are addresses only. Except for the unavoidable document-start
 * marker on C000, they intentionally carry no candidate reasons or boundary
 * evidence. The model sees only Cxxx + exact source token text; deterministic code
 * owns all text, values, mechanical proof, ranges, and accepted Header ownership.
 */
export function createSinglelineHeaderAddressSpace(rawSource: string, sourceMap: LosslessSourceMap): SourceCandidate[] {
  const contentUnits = sourceMap.units.filter((unit) => unit.kind === "content");
  return contentUnits.map((unit, index, all) => ({
    id: `candidate-${index}`,
    start: unit.start,
    startUnitId: unit.id,
    preview: rawSource.slice(unit.start, all[index + 1]?.start ?? rawSource.length),
    reasons: index === 0 ? ["document_start"] : [],
  }));
}
