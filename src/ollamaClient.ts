import { Agent, fetch } from "undici";

import { z } from "zod";

import type { StructuredModelRequest, StructuredModelResult } from "./modelProvider.js";
import { StructuredModelInvalidJsonError } from "./modelProvider.js";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434/api/chat";

const ollamaAgent = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
});

const OllamaResponseSchema = z.object({
  message: z.object({
    content: z.string(),
  }),
  done_reason: z.string().optional(),
  total_duration: z.number().optional(),
  load_duration: z.number().optional(),
  prompt_eval_count: z.number().int().nonnegative().optional(),
  prompt_eval_duration: z.number().optional(),
  eval_count: z.number().int().nonnegative().optional(),
  eval_duration: z.number().optional(),
});

export class OllamaInvalidJsonError extends StructuredModelInvalidJsonError {}

export async function callOllamaStructured(input: StructuredModelRequest): Promise<StructuredModelResult> {
  const startedAt = Date.now();

  const signal = input.timeoutMs === undefined ? undefined : AbortSignal.timeout(input.timeoutMs);

  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    dispatcher: ollamaAgent,
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: [
        {
          role: "system",
          content: input.systemPrompt,
        },
        {
          role: "user",
          content: input.userPrompt,
        },
      ],
      stream: false,
      think: false,
      format: input.jsonSchema,
      options: {
        temperature: input.temperature ?? 0,
        seed: input.seed ?? 42,
        num_ctx: input.numCtx ?? 16384,
        num_predict: input.numPredict ?? 4096,
      },
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(`Ollama request failed with HTTP ${response.status}: ${responseText.slice(0, 500)}`);
  }

  const outerJson: unknown = await response.json();

  const outer = OllamaResponseSchema.parse(outerJson);

  const rawContent = outer.message.content;

  const elapsedSeconds = (Date.now() - startedAt) / 1000;

  let parsedContent: unknown;

  try {
    parsedContent = JSON.parse(rawContent);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    throw new OllamaInvalidJsonError(
      `Ollama returned invalid JSON: ${message}${outer.done_reason === undefined ? "" : `; done_reason=${outer.done_reason}`}`,
      rawContent,
      elapsedSeconds,
      outer.done_reason ?? null,
    );
  }

  const nanosecondsToSeconds = (value: number | undefined): number | null =>
    value === undefined ? null : value / 1_000_000_000;

  return {
    rawContent,
    parsedContent,
    elapsedSeconds,
    performance: {
      totalSeconds: nanosecondsToSeconds(outer.total_duration),
      loadSeconds: nanosecondsToSeconds(outer.load_duration),
      promptEvalSeconds: nanosecondsToSeconds(outer.prompt_eval_duration),
      promptEvalCount: outer.prompt_eval_count ?? null,
      evalSeconds: nanosecondsToSeconds(outer.eval_duration),
      evalCount: outer.eval_count ?? null,
    },
  };
}
