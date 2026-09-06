import type { ParserMode } from "./parserRouting.js";
import type { EditableStatblockDocument, ImportedParserStructure } from "./productModel.js";

export type ParseJobStatus = "queued" | "processing" | "completed" | "failed";
export type ParseJobFailureStage = "model" | "parser" | "compile" | "internal";

export type ParseJobError = {
  stage: ParseJobFailureStage;
  message: string;
};

export type ParseJobResult = {
  editableDocument: EditableStatblockDocument;
  parserVersion: string;
  statblockId: string;
  parserStructure?: ImportedParserStructure;
  parserMode?: ParserMode;
  rawSource?: string;
};

export type ParseJobSummary = {
  id: string;
  clientId: string;
  statblockId: string;
  modelProfileId: string;
  parserMode?: ParserMode;
  replaceExisting?: boolean;
  displayHint: string;
  status: ParseJobStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: ParseJobError | null;
  attempt: number;
};

export type ParseJobRecord = ParseJobSummary & {
  rawText: string | null;
  result: ParseJobResult | null;
};

export function parseJobSummary(record: ParseJobRecord): ParseJobSummary {
  const { rawText: _rawText, result: _result, ...summary } = record;
  return structuredClone(summary);
}

export function parseJobDisplayHint(rawText: string): string {
  const first = rawText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (first === undefined) return "Statblock";
  return first.length <= 80 ? first : `${first.slice(0, 77)}…`;
}
