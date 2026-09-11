export const CUSTOM_MODEL_PROFILE_ID = "custom-openai-compatible" as const;

export type StructuredModelRequest = {
  model: string;
  task?: "header" | "body";
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: unknown;
  temperature?: number;
  seed?: number;
  numCtx?: number;
  numPredict?: number;
  timeoutMs?: number;
};

export type ModelPerformanceMetrics = {
  totalSeconds: number | null;
  loadSeconds: number | null;
  promptEvalSeconds: number | null;
  promptEvalCount: number | null;
  evalSeconds: number | null;
  evalCount: number | null;
};

export type StructuredModelResult = {
  rawContent: string;
  parsedContent: unknown;
  elapsedSeconds: number;
  performance?: ModelPerformanceMetrics;
};

export class StructuredModelInvalidJsonError extends Error {
  readonly rawContent: string;
  readonly elapsedSeconds: number;
  readonly doneReason: string | null;

  constructor(message: string, rawContent: string, elapsedSeconds = 0, doneReason: string | null = null) {
    super(message);
    this.name = "StructuredModelInvalidJsonError";
    this.rawContent = rawContent;
    this.elapsedSeconds = elapsedSeconds;
    this.doneReason = doneReason;
  }
}

export type StructureModelCaller = (request: StructuredModelRequest) => Promise<StructuredModelResult>;

export type ModelHealth = {
  ok: boolean;
  detail?: string;
  code?: "unauthorized" | "rate_limited" | "model_unavailable" | "catalog_unconfirmed" | "http_error" | "network_error";
  retryAfterSeconds?: number;
};

export type ModelProfileStatus = ModelProfile & {
  health: ModelHealth;
};

export interface ModelProvider {
  id: string;
  displayName: string;
  providerType: string;
  model: string;
  serviceUrl?: string;
  generateStructured(request: StructuredModelRequest): Promise<StructuredModelResult>;
  healthCheck(): Promise<ModelHealth>;
}

export type ModelProfile = {
  id: string;
  displayName: string;
  providerType: string;
  model: string;
  serviceUrl?: string;
};
