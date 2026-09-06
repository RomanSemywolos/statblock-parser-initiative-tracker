export const CANDIDATE_REASONS = [
  "document_start",
  "line_start",
  "paragraph_start",
  "sentence_start",
  "colon_start",
  "table_row_start",
  "named_block_start",
  "standalone_block_start",
] as const;

export type CandidateReason = (typeof CANDIDATE_REASONS)[number];

export type BoundaryScope = "top_level" | "internal" | "unknown";
export type BoundaryStrength = "hard" | "strong" | "weak";
export type BoundaryEvidenceKind =
  | "document_start"
  | "physical_line"
  | "paragraph"
  | "table_shape"
  | "compact_block"
  | "compact_metadata"
  | "header_interleaved_compact_row"
  | "title_shape"
  | "section_heading"
  | "list_sequence"
  | "sentence_shape";

export type CandidateContinuationStrength = "none" | "soft" | "strong";
export type CandidateContinuationEvidenceKind =
  | "previous_line_open"
  | "previous_line_trailing_separator"
  | "lowercase_line_start"
  | "numeric_line_start"
  | "leading_bracket_line_start"
  | "compact_label_after_named_start"
  | "same_physical_interleaved_row";

/**
 * Source-grounded evidence about a candidate coordinate. This constrains
 * boundaries/continuations only; it does not assign semantic ownership.
 */
export type CandidateBoundaryEvidence = {
  scope: BoundaryScope;
  strength: BoundaryStrength;
  evidence: BoundaryEvidenceKind[];
  continuationStrength: CandidateContinuationStrength;
  continuationEvidence: CandidateContinuationEvidenceKind[];
};

export type SourceCandidate = {
  id: string;
  start: number;
  startUnitId: string;
  preview: string;
  reasons: CandidateReason[];
  boundary?: CandidateBoundaryEvidence;
};
