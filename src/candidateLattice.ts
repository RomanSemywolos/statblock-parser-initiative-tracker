import type { LosslessSourceMap } from "./domain.js";
import { attachBoundaryEvidence } from "./boundaryEvidence.js";
import type { SourceCandidate } from "./candidateTypes.js";
import { detectParserStructure, type ParserMode, type ParserRoutingDecision } from "./parserRouting.js";
import { auditSinglelineCandidateLattice, type SinglelineCandidateAudit } from "./singlelineCandidateAudit.js";
import { createSinglelineHeaderAddressSpace } from "./singlelineHeaderAddressSpace.js";
import {
  reconstructSinglelineStructure,
  type SinglelineStructuralReconstruction,
} from "./singlelineStructuralReconstruction.js";
import {
  createSourceCandidates,
  enrichGenericCandidates,
  enrichMultilineCandidates,
  enrichSinglelineCandidates,
} from "./sourceCandidates.js";

export type PreparedCandidateLattice = {
  routing: ParserRoutingDecision;
  baseCandidates: SourceCandidate[];
  routedCandidates: SourceCandidate[];
  candidates: SourceCandidate[];
  headerCandidates: SourceCandidate[];
  singlelineAudit: SinglelineCandidateAudit | null;
  singlelineStructure: SinglelineStructuralReconstruction | null;
};

/**
 * BODY-only singleline proposal space. The fixed Header verifier keeps the
 * full exact address lattice, but BODY multiline normalization should see only
 * coordinates for which the audit has independent source-shaped structural
 * evidence. Address-only coordinates remain available to Header verification;
 * they are not presented as plausible BODY line starts.
 */
export function singlelineBodyNormalizationCandidates(prepared: PreparedCandidateLattice): SourceCandidate[] {
  const auditByStart = new Map((prepared.singlelineAudit?.entries ?? []).map((entry) => [entry.start, entry] as const));
  return prepared.candidates.filter((candidate) => {
    const audit = auditByStart.get(candidate.start);
    if (audit === undefined || audit.role !== "address_only") return true;
    // A source-proven composite title may contain a collapsed section label and
    // its first named rule with no delimiter between them (`Actions Multiattack.`).
    // Keep only the exact coordinates inside that bounded composite as refinement
    // addresses; they remain address_only in the prompt and are not promoted to
    // structural proposals.
    return audit.origins.includes("composite_title_refinement");
  });
}

/**
 * Builds coordinate address spaces consumed by the parser.
 *
 * This is intentionally a preparation/coordinate layer only:
 * - `candidates` is the routed BODY-oriented lattice;
 * - `headerCandidates` is one mode-independent, source-shape-aware header-scan lattice;
 * - semantic language profiles do not participate in candidate generation or boundary evidence;
 * - boundary evidence describes plausible boundaries;
 * - no semantic ownership is assigned here.
 *
 * Production and integration tests should use this helper instead of manually
 * reconstructing the lattice pipeline. Low-level tests of an individual stage
 * may still call that stage directly.
 */
export function prepareCandidateLattice(
  rawSource: string,
  sourceMap: LosslessSourceMap,
  requestedMode: ParserMode = "auto",
): PreparedCandidateLattice {
  const routing = detectParserStructure(rawSource, requestedMode);
  const baseCandidates = createSourceCandidates(rawSource, sourceMap);
  // Active parser coordinates are language-neutral. Semantic labels are supplied by
  // the Header LLM and grounded later; no printed-language lexicon may enrich the
  // candidate lattice or boundary evidence.
  const routedCandidates =
    routing.selectedMode === "singleline"
      ? enrichSinglelineCandidates(rawSource, sourceMap, baseCandidates)
      : routing.selectedMode === "multiline"
        ? enrichMultilineCandidates(rawSource, sourceMap, baseCandidates)
        : enrichGenericCandidates(rawSource, sourceMap, baseCandidates);
  const candidates = attachBoundaryEvidence(rawSource, sourceMap, routedCandidates, routing.selectedMode);
  const singlelineStructure =
    routing.selectedMode === "singleline" ? reconstructSinglelineStructure(rawSource, sourceMap, candidates) : null;
  const singlelineAudit =
    routing.selectedMode === "singleline"
      ? auditSinglelineCandidateLattice(
          rawSource,
          sourceMap,
          baseCandidates,
          candidates,
          singlelineStructure ?? undefined,
        )
      : null;

  // Header verification is ownership-first in every mode, but the address space is
  // mode-specific. Mixed/multiline can exploit surviving source geometry. Fully
  // collapsed singleline cannot safely prune unknown printed labels by geometry, so
  // its Header selector receives one flat address for every non-whitespace source
  // unit. No boundary classes, structural proposals, or deterministic semantics are
  // transported with those addresses.
  const headerCandidates =
    routing.selectedMode === "singleline"
      ? createSinglelineHeaderAddressSpace(rawSource, sourceMap)
      : attachBoundaryEvidence(
          rawSource,
          sourceMap,
          enrichGenericCandidates(rawSource, sourceMap, baseCandidates),
          "generic",
        );
  return {
    routing,
    baseCandidates,
    routedCandidates,
    candidates,
    headerCandidates,
    singlelineAudit,
    singlelineStructure,
  };
}
