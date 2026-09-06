import type { StructuredModelRequest } from "./modelProvider.js";
import type { SourceCandidate } from "./sourceCandidates.js";

export type HeaderPromptMetrics = {
  sourceCharacters: number;
  candidateCount: number;
  systemPromptCharacters: number;
  userPromptCharacters: number;
  jsonSchemaCharacters: number;
  requestTextCharacters: number;
  candidateTransportCharacters: number;
  hintTransportCharacters: number;
  candidateIdOccurrencesInUserPrompt: number;
  candidateIdOccurrencesInJsonSchema: number;
  /** Historical overlay fields are retained for diagnostics compatibility. The
   * 2.74.173 compact-legacy shadow does not construct or consume an overlay. */
  shadowOverlayValid: boolean;
  shadowSourceCharacters: number | null;
  shadowCoordinateMarkerCharacters: number | null;
  shadowCoordinateCount: number | null;
  shadowStructuralClassCount: number | null;
  shadowStructuralClassLegendCharacters: number | null;
  coordinateTransportCharacterDelta: number | null;
  shadowRequestSystemPromptCharacters: number | null;
  shadowRequestUserPromptCharacters: number | null;
  shadowRequestJsonSchemaCharacters: number | null;
  shadowRequestTextCharacters: number | null;
  shadowRequestCandidateIdOccurrencesInUserPrompt: number | null;
  shadowRequestCandidateIdOccurrencesInJsonSchema: number | null;
  shadowRequestCharacterDelta: number | null;
  shadowRequestReductionRatio: number | null;
};

function sectionLength(text: string, startMarker: string, endMarker: string): number {
  const start = text.indexOf(startMarker);
  if (start < 0) return 0;
  const contentStart = start + startMarker.length;
  const end = text.indexOf(endMarker, contentStart);
  if (end < 0) return 0;
  return Math.max(0, end - contentStart);
}

function candidateTransportLength(userPrompt: string): number {
  const singlelineCoordinates = sectionLength(userPrompt, "ANNOTATED SOURCE START", "ANNOTATED SOURCE END");
  if (singlelineCoordinates > 0) return singlelineCoordinates;
  return sectionLength(userPrompt, "STRUCTURAL PROPOSALS START", "STRUCTURAL PROPOSALS END");
}

function countCandidateIds(text: string): number {
  return text.match(/C\d{3,}/gu)?.length ?? 0;
}

/**
 * Pure production diagnostics. Historical shadow/overlay fields remain nullable for
 * stored-report compatibility, but the finalized parser no longer constructs or
 * executes a Header transport A/B request.
 */
export function measureHeaderPromptRequest(
  request: StructuredModelRequest,
  rawSource: string,
  candidates: readonly SourceCandidate[],
): HeaderPromptMetrics {
  const schemaText = JSON.stringify(request.jsonSchema);
  const legacyCandidateTransportCharacters = candidateTransportLength(request.userPrompt);
  const legacyRequestCharacters = request.systemPrompt.length + request.userPrompt.length + schemaText.length;
  return {
    sourceCharacters: rawSource.length,
    candidateCount: candidates.length,
    systemPromptCharacters: request.systemPrompt.length,
    userPromptCharacters: request.userPrompt.length,
    jsonSchemaCharacters: schemaText.length,
    requestTextCharacters: legacyRequestCharacters,
    candidateTransportCharacters: legacyCandidateTransportCharacters,
    hintTransportCharacters: sectionLength(request.userPrompt, "SOURCE-SHAPE HINTS START", "SOURCE-SHAPE HINTS END"),
    candidateIdOccurrencesInUserPrompt: countCandidateIds(request.userPrompt),
    candidateIdOccurrencesInJsonSchema: countCandidateIds(schemaText),
    shadowOverlayValid: false,
    shadowSourceCharacters: null,
    shadowCoordinateMarkerCharacters: null,
    shadowCoordinateCount: null,
    shadowStructuralClassCount: null,
    shadowStructuralClassLegendCharacters: null,
    coordinateTransportCharacterDelta: null,
    shadowRequestSystemPromptCharacters: null,
    shadowRequestUserPromptCharacters: null,
    shadowRequestJsonSchemaCharacters: null,
    shadowRequestTextCharacters: null,
    shadowRequestCandidateIdOccurrencesInUserPrompt: null,
    shadowRequestCandidateIdOccurrencesInJsonSchema: null,
    shadowRequestCharacterDelta: null,
    shadowRequestReductionRatio: null,
  };
}
