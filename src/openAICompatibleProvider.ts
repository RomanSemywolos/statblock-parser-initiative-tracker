import { fetch, type Dispatcher } from "undici";
import { z } from "zod";

import {
  StructuredModelInvalidJsonError,
  type ModelHealth,
  type ModelPerformanceMetrics,
  type ModelProvider,
  type StructuredModelRequest,
  type StructuredModelResult,
} from "./modelProvider.js";

export type OpenAICompatibleReasoningEffort = "none" | "low" | "medium" | "high";

export type OpenAICompatibleModelProviderOptions = {
  id: string;
  displayName?: string;
  providerType?: string;
  model: string;
  apiKey?: string;
  baseUrl: string;
  reasoningEffort?: OpenAICompatibleReasoningEffort;
  structuredOutputStrict?: boolean;
  maxRateLimitRetries?: number;
  maxRetryAfterSeconds?: number;
  bodyCompletionTokenCap?: number;
  dispatcher?: Dispatcher;
};

const ChatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
        }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
      prompt_time: z.number().nonnegative().optional(),
      completion_time: z.number().nonnegative().optional(),
      total_time: z.number().nonnegative().optional(),
    })
    .optional(),
});

const ModelsResponseSchema = z.object({
  data: z.array(z.object({ id: z.string() })).default([]),
});

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, "");
}

function performanceMetrics(
  elapsedSeconds: number,
  usage: z.infer<typeof ChatCompletionResponseSchema>["usage"],
): ModelPerformanceMetrics {
  return {
    totalSeconds: usage?.total_time ?? elapsedSeconds,
    loadSeconds: null,
    promptEvalSeconds: usage?.prompt_time ?? null,
    promptEvalCount: usage?.prompt_tokens ?? null,
    evalSeconds: usage?.completion_time ?? null,
    evalCount: usage?.completion_tokens ?? null,
  };
}

type UndiciResponse = Awaited<ReturnType<typeof fetch>>;

function retryAfterSeconds(response: UndiciResponse): number | undefined {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(0, (date - Date.now()) / 1000);
}

function safeResponseDetail(text: string): string {
  const collapsed = text.replace(/\s+/gu, " ").trim();
  return collapsed.length <= 500 ? collapsed : `${collapsed.slice(0, 497)}…`;
}

function requestErrorMessage(
  displayName: string,
  providerType: string,
  status: number,
  responseText: string,
  retryAfter?: number,
): string {
  const detail = safeResponseDetail(responseText);
  if (status === 401 || status === 403) {
    const keyHint =
      providerType === "groq"
        ? "Перевір GROQ_API_KEY у середовищі backend-а й перезапусти backend."
        : "Перевір API-ключ, налаштований для цього OpenAI-compatible сервісу.";
    return `${displayName}: API відхилив ключ або цей ключ не має доступу до моделі (HTTP ${status}). ${keyHint}${detail ? ` Відповідь: ${detail}` : ""}`;
  }
  if (status === 429) {
    const wait = retryAfter === undefined ? "" : ` Спробуй ще раз приблизно через ${Math.ceil(retryAfter)} с.`;
    return `${displayName}: перевищено ліміт запитів/токенів API (HTTP 429).${wait}${detail ? ` Відповідь: ${detail}` : ""}`;
  }
  if (status === 404) {
    return `${displayName}: API endpoint або модель ${JSON.stringify(displayName)} недоступні (HTTP 404).${detail ? ` Відповідь: ${detail}` : ""}`;
  }
  return `${displayName}: запит до API завершився HTTP ${status}.${detail ? ` Відповідь: ${detail}` : ""}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenAICompatibleInvalidJsonError extends StructuredModelInvalidJsonError {}

export class OpenAICompatibleModelProvider implements ModelProvider {
  readonly id: string;
  readonly displayName: string;
  readonly providerType: string;
  readonly model: string;
  readonly serviceUrl: string;

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly reasoningEffort: OpenAICompatibleReasoningEffort | undefined;
  private readonly structuredOutputStrict: boolean;
  private readonly maxRateLimitRetries: number;
  private readonly maxRetryAfterSeconds: number;
  private readonly bodyCompletionTokenCap: number | undefined;
  private readonly dispatcher: Dispatcher | undefined;

  constructor(options: OpenAICompatibleModelProviderOptions) {
    this.id = options.id;
    this.displayName = options.displayName ?? options.model;
    this.providerType = options.providerType ?? "openai-compatible";
    this.model = options.model;
    this.apiKey = options.apiKey?.trim() || undefined;
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.serviceUrl = this.baseUrl;
    this.reasoningEffort = options.reasoningEffort;
    this.structuredOutputStrict = options.structuredOutputStrict ?? false;
    this.maxRateLimitRetries = Math.max(0, Math.floor(options.maxRateLimitRetries ?? 1));
    this.maxRetryAfterSeconds = Math.max(0, options.maxRetryAfterSeconds ?? 60);
    this.bodyCompletionTokenCap =
      options.bodyCompletionTokenCap === undefined
        ? undefined
        : Math.max(1, Math.floor(options.bodyCompletionTokenCap));
    this.dispatcher = options.dispatcher;
  }

  async generateStructured(input: StructuredModelRequest): Promise<StructuredModelResult> {
    const startedAt = Date.now();
    const signal = input.timeoutMs === undefined ? undefined : AbortSignal.timeout(input.timeoutMs);

    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
      stream: false,
      temperature: input.temperature ?? 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "statblock_parser_response",
          strict: this.structuredOutputStrict,
          schema: input.jsonSchema,
        },
      },
    };

    if (input.seed !== undefined) body.seed = input.seed;
    if (input.numPredict !== undefined) {
      const providerAdjusted =
        input.task === "body" && this.bodyCompletionTokenCap !== undefined
          ? Math.min(input.numPredict, this.bodyCompletionTokenCap)
          : input.numPredict;
      body.max_completion_tokens = providerAdjusted;
    }
    if (this.reasoningEffort !== undefined) body.reasoning_effort = this.reasoningEffort;

    let finalResponse: UndiciResponse | null = null;
    for (let attempt = 0; attempt <= this.maxRateLimitRetries; attempt += 1) {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        dispatcher: this.dispatcher,
        signal,
        headers: {
          ...(this.apiKey === undefined ? {} : { Authorization: `Bearer ${this.apiKey}` }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        finalResponse = response;
        break;
      }
      const retryAfter = retryAfterSeconds(response);
      if (
        response.status === 429 &&
        attempt < this.maxRateLimitRetries &&
        retryAfter !== undefined &&
        retryAfter <= this.maxRetryAfterSeconds
      ) {
        await response.body?.cancel();
        await sleep(Math.ceil(retryAfter * 1000));
        continue;
      }

      const responseText = await response.text();
      throw new Error(
        requestErrorMessage(this.displayName, this.providerType, response.status, responseText, retryAfter),
      );
    }

    if (finalResponse === null) throw new Error(`${this.displayName}: API request failed.`);

    const outer = ChatCompletionResponseSchema.parse(await finalResponse.json());
    const choice = outer.choices[0]!;
    const rawContent = choice.message.content ?? "";
    const elapsedSeconds = (Date.now() - startedAt) / 1000;

    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(rawContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new OpenAICompatibleInvalidJsonError(
        `${this.displayName} returned invalid JSON: ${message}${choice.finish_reason == null ? "" : `; finish_reason=${choice.finish_reason}`}`,
        rawContent,
        elapsedSeconds,
        choice.finish_reason ?? null,
      );
    }

    return {
      rawContent,
      parsedContent,
      elapsedSeconds,
      performance: performanceMetrics(elapsedSeconds, outer.usage),
    };
  }

  async healthCheck(): Promise<ModelHealth> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        dispatcher: this.dispatcher,
        headers: this.apiKey === undefined ? {} : { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!response.ok) {
        const retryAfter = retryAfterSeconds(response);
        const detail = safeResponseDetail(await response.text());
        if (response.status === 401) {
          return {
            ok: false,
            code: "unauthorized",
            detail: `API key rejected (HTTP 401)${detail ? `: ${detail}` : ""}`,
          };
        }
        if (response.status === 429) {
          return {
            ok: false,
            code: "rate_limited",
            retryAfterSeconds: retryAfter,
            detail: `Rate limit reached (HTTP 429)${detail ? `: ${detail}` : ""}`,
          };
        }
        if (response.status >= 400 && response.status < 500) {
          return {
            ok: true,
            code: "catalog_unconfirmed",
            detail: `Provider did not expose a usable /models catalog (HTTP ${response.status}). ${this.model} will be verified by the first parsing request.`,
          };
        }
        return { ok: false, code: "http_error", detail: `HTTP ${response.status}${detail ? `: ${detail}` : ""}` };
      }

      let models;
      try {
        models = ModelsResponseSchema.parse(await response.json());
      } catch {
        return {
          ok: true,
          code: "catalog_unconfirmed",
          detail: `Provider connection succeeded, but /models returned an unsupported catalog format. ${this.model} will be verified by the first parsing request.`,
        };
      }
      if (!models.data.some((entry) => entry.id === this.model)) {
        return {
          ok: true,
          code: "catalog_unconfirmed",
          detail: `Provider connection succeeded, but ${this.model} was not listed by /models. Availability will be verified by the first request.`,
        };
      }
      return { ok: true, detail: `Model ${this.model} is available.` };
    } catch (error) {
      return {
        ok: false,
        code: "network_error",
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
