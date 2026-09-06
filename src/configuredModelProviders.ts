import type { ModelProvider } from "./modelProvider.js";
import { OllamaModelProvider } from "./ollamaProvider.js";
import { OpenAICompatibleModelProvider } from "./openAICompatibleProvider.js";

export type ConfiguredModelProviders = {
  providers: ModelProvider[];
  defaultProfileId: string;
};

export const GROQ_PROFILE_SPECS = [
  {
    id: "groq-qwen3.8-27b",
    displayName: "Qwen 3.8 27B (Groq)",
    model: "qwen/qwen3.8-27b",
    reasoningEffort: "none" as const,
  },
  {
    id: "groq-gpt-oss-20b",
    displayName: "GPT-OSS 20B (Groq)",
    model: "openai/gpt-oss-20b",
    reasoningEffort: "low" as const,
  },
  {
    id: "groq-gpt-oss-120b",
    displayName: "GPT-OSS 120B (Groq)",
    model: "openai/gpt-oss-120b",
    reasoningEffort: "low" as const,
  },
] as const;

export function createGroqProvider(
  profileId: string,
  apiKey?: string,
  baseUrl = "https://api.groq.com/openai/v1",
): OpenAICompatibleModelProvider | null {
  const spec = GROQ_PROFILE_SPECS.find((entry) => entry.id === profileId);
  if (spec === undefined) return null;
  return new OpenAICompatibleModelProvider({
    id: spec.id,
    displayName: spec.displayName,
    providerType: "groq",
    model: spec.model,
    apiKey,
    baseUrl,
    reasoningEffort: spec.reasoningEffort,
    // Built-in Groq profiles target the free/on-demand service tier used by the
    // application. Keep only BODY starts-only completions below its observed OTPM
    // request ceiling; Header requests are not affected.
    bodyCompletionTokenCap: 768,
  });
}

export function createConfiguredModelProviders(env: NodeJS.ProcessEnv = process.env): ConfiguredModelProviders {
  const ollamaModel = env.OLLAMA_MODEL ?? "qwen3:8b";
  const providers: ModelProvider[] = [
    new OllamaModelProvider({
      id: "default",
      displayName: `${ollamaModel} (local Ollama)`,
      model: ollamaModel,
    }),
  ];

  const groqApiKey = env.GROQ_API_KEY?.trim();
  const groqBaseUrl = env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1";
  for (const spec of GROQ_PROFILE_SPECS) {
    const provider = createGroqProvider(spec.id, groqApiKey, groqBaseUrl);
    if (provider !== null) providers.push(provider);
  }

  return { providers, defaultProfileId: "default" };
}
