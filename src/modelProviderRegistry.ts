import type { ModelProfile, ModelProfileStatus, ModelProvider } from "./modelProvider.js";

export class ModelProviderRegistry {
  private readonly providers: Map<string, ModelProvider>;
  readonly defaultProfileId: string;

  constructor(providers: readonly ModelProvider[], defaultProfileId: string) {
    if (providers.length === 0) throw new Error("At least one model provider is required.");
    this.providers = new Map();
    for (const provider of providers) {
      if (this.providers.has(provider.id)) throw new Error(`Duplicate model profile id: ${provider.id}`);
      this.providers.set(provider.id, provider);
    }
    if (!this.providers.has(defaultProfileId)) {
      throw new Error(`Default model profile is not registered: ${defaultProfileId}`);
    }
    this.defaultProfileId = defaultProfileId;
  }

  upsert(provider: ModelProvider): void {
    if (provider.id === this.defaultProfileId && !this.providers.has(provider.id)) {
      throw new Error("Cannot replace a missing default model profile through upsert.");
    }
    this.providers.set(provider.id, provider);
  }

  resolve(profileId: string): ModelProvider {
    const provider = this.providers.get(profileId);
    if (provider === undefined) throw new Error(`Unknown parser model profile: ${profileId}`);
    return provider;
  }

  listProfiles(): ModelProfile[] {
    return [...this.providers.values()].map((provider) => ({
      id: provider.id,
      displayName: provider.displayName,
      providerType: provider.providerType,
      model: provider.model,
      ...(provider.serviceUrl === undefined ? {} : { serviceUrl: provider.serviceUrl }),
    }));
  }

  async checkProfiles(): Promise<ModelProfileStatus[]> {
    return Promise.all(
      [...this.providers.values()].map(async (provider) => ({
        id: provider.id,
        displayName: provider.displayName,
        providerType: provider.providerType,
        model: provider.model,
        ...(provider.serviceUrl === undefined ? {} : { serviceUrl: provider.serviceUrl }),
        health: await provider.healthCheck(),
      })),
    );
  }
}
