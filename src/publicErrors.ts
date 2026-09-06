import type { ModelHealth, ModelProfileStatus } from "./modelProvider.js";
import type { ParseJobError, ParseJobSummary } from "./parseJobs.js";
import type { TranslationProviderHealth } from "./translationProvider.js";

export const PUBLIC_INTERNAL_ERROR = "The local service could not complete the request.";
export const PUBLIC_MODEL_ERROR = "The model provider could not complete the request.";
export const PUBLIC_TRANSLATION_ERROR = "The translation provider could not complete the request.";

function publicParseFailure(error: ParseJobError): ParseJobError {
  const message =
    error.stage === "model"
      ? PUBLIC_MODEL_ERROR
      : error.stage === "parser" || error.stage === "compile"
        ? "The statblock could not be parsed."
        : PUBLIC_INTERNAL_ERROR;
  return { ...error, message };
}

export function publicParseJobSummary(summary: ParseJobSummary): ParseJobSummary {
  return { ...structuredClone(summary), error: summary.error === null ? null : publicParseFailure(summary.error) };
}

export function publicModelHealth(health: ModelHealth): ModelHealth {
  return health.ok ? health : { ...health, detail: "The model provider is unavailable." };
}

export function publicModelProfileStatuses(statuses: readonly ModelProfileStatus[]): ModelProfileStatus[] {
  return statuses.map((status) => ({ ...status, health: publicModelHealth(status.health) }));
}

export function publicTranslationHealth(health: TranslationProviderHealth): TranslationProviderHealth {
  return health.ok ? health : { ok: false, detail: "The translation provider is unavailable." };
}
