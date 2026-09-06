import { fetch } from "undici";

import { callOllamaStructured } from "./ollamaClient.js";
import type { ModelHealth, ModelProvider, StructuredModelRequest, StructuredModelResult } from "./modelProvider.js";

export type OllamaModelProviderOptions = {
  id?: string;
  displayName?: string;
  model: string;
  healthUrl?: string;
};

export class OllamaModelProvider implements ModelProvider {
  readonly id: string;
  readonly displayName: string;
  readonly providerType = "ollama";
  readonly model: string;
  readonly serviceUrl: string;
  private readonly healthUrl: string;

  constructor(options: OllamaModelProviderOptions) {
    this.id = options.id ?? "default";
    this.displayName = options.displayName ?? options.model;
    this.model = options.model;
    const configuredUrl = process.env.OLLAMA_URL ?? "http://localhost:11434/api/chat";
    this.serviceUrl = configuredUrl.replace(/\/+$/u, "");
    this.healthUrl = options.healthUrl ?? this.serviceUrl.replace(/\/api\/chat\/?$/u, "/api/tags");
  }

  generateStructured(request: StructuredModelRequest): Promise<StructuredModelResult> {
    return callOllamaStructured({
      ...request,
      model: this.model,
    });
  }

  async healthCheck(): Promise<ModelHealth> {
    try {
      const response = await fetch(this.healthUrl);
      return response.ok ? { ok: true } : { ok: false, detail: `HTTP ${response.status}` };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
