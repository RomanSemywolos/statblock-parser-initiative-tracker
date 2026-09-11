export type ParserModelProfile = {
  id: string;
  displayName: string;
  providerType: string;
  model?: string;
  serviceUrl?: string;
};

export type ParserModelHealth = {
  ok: boolean;
  detail?: string;
  code?: "unauthorized" | "rate_limited" | "model_unavailable" | "catalog_unconfirmed" | "http_error" | "network_error";
  retryAfterSeconds?: number;
};

export type ParserModelProfileStatus = ParserModelProfile & {
  health: ParserModelHealth;
};

export type ParserBackendHealth = {
  ok: true;
  activeProfileId: string;
  model: string;
};

export interface ParserBackendApi {
  healthCheck(): Promise<ParserBackendHealth>;
  listModelProfiles(): Promise<ParserModelProfile[]>;
  checkModelProfiles(): Promise<ParserModelProfileStatus[]>;
  configureCustomModelProfile(config: {
    baseUrl: string;
    model: string;
    apiKey?: string;
  }): Promise<ParserModelProfileStatus>;
  configureModelProfileCredential(config: { profileId: string; apiKey: string }): Promise<ParserModelProfileStatus>;
}

function parseProfile(entry: unknown): ParserModelProfile | null {
  if (typeof entry !== "object" || entry === null) return null;
  const item = entry as Partial<ParserModelProfile>;
  if (typeof item.id !== "string" || typeof item.displayName !== "string" || typeof item.providerType !== "string")
    return null;
  return {
    id: item.id,
    displayName: item.displayName,
    providerType: item.providerType,
    ...(typeof item.model === "string" ? { model: item.model } : {}),
    ...(typeof item.serviceUrl === "string" ? { serviceUrl: item.serviceUrl } : {}),
  };
}

export class HttpParserBackendApi implements ParserBackendApi {
  constructor(private readonly backendUrl: string) {}

  private url(path: string): string {
    return `${this.backendUrl.replace(/\/+$/u, "")}${path}`;
  }

  private async errorMessage(response: Response, fallback: string): Promise<string> {
    try {
      const value = (await response.json()) as { error?: unknown };
      if (typeof value.error === "string" && value.error.trim() !== "") return value.error;
    } catch {
      // Fall through to the stable HTTP message.
    }
    return `${fallback} (HTTP ${response.status}).`;
  }

  async healthCheck(): Promise<ParserBackendHealth> {
    const response = await fetch(this.url("/health"));
    if (!response.ok) throw new Error(await this.errorMessage(response, "Backend health check failed"));
    const value = (await response.json()) as Partial<ParserBackendHealth>;
    if (value.ok !== true || typeof value.model !== "string") {
      throw new Error("Backend returned an invalid health response.");
    }
    return {
      ok: true,
      model: value.model,
      activeProfileId: typeof value.activeProfileId === "string" ? value.activeProfileId : "default",
    };
  }

  async listModelProfiles(): Promise<ParserModelProfile[]> {
    const response = await fetch(this.url("/api/model-profiles"));
    if (!response.ok) throw new Error(await this.errorMessage(response, "Model profile request failed"));
    const value = (await response.json()) as { profiles?: unknown };
    if (!Array.isArray(value.profiles)) throw new Error("Backend returned an invalid model profile response.");
    return value.profiles.map(parseProfile).filter((entry): entry is ParserModelProfile => entry !== null);
  }

  async configureCustomModelProfile(config: {
    baseUrl: string;
    model: string;
    apiKey?: string;
  }): Promise<ParserModelProfileStatus> {
    const response = await fetch(this.url("/api/model-profiles/custom"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error(await this.errorMessage(response, "Custom model configuration failed"));
    const value = (await response.json()) as { profile?: unknown };
    const entry = value.profile;
    const profile = parseProfile(entry);
    if (profile === null || typeof entry !== "object" || entry === null)
      throw new Error("Backend returned an invalid custom model response.");
    const health = (entry as { health?: unknown }).health;
    if (typeof health !== "object" || health === null || typeof (health as { ok?: unknown }).ok !== "boolean")
      throw new Error("Backend returned an invalid custom model health response.");
    const raw = health as Partial<ParserModelHealth>;
    return {
      ...profile,
      health: {
        ok: raw.ok === true,
        ...(typeof raw.detail === "string" ? { detail: raw.detail } : {}),
        ...(typeof raw.code === "string" ? { code: raw.code as ParserModelHealth["code"] } : {}),
        ...(typeof raw.retryAfterSeconds === "number" ? { retryAfterSeconds: raw.retryAfterSeconds } : {}),
      },
    };
  }

  async configureModelProfileCredential(config: {
    profileId: string;
    apiKey: string;
  }): Promise<ParserModelProfileStatus> {
    const response = await fetch(this.url("/api/model-profiles/credential"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error(await this.errorMessage(response, "Model credential configuration failed"));
    const value = (await response.json()) as { profile?: unknown };
    const entry = value.profile;
    const profile = parseProfile(entry);
    if (profile === null || typeof entry !== "object" || entry === null)
      throw new Error("Backend returned an invalid model credential response.");
    const health = (entry as { health?: unknown }).health;
    if (typeof health !== "object" || health === null || typeof (health as { ok?: unknown }).ok !== "boolean")
      throw new Error("Backend returned an invalid model credential health response.");
    const raw = health as Partial<ParserModelHealth>;
    return {
      ...profile,
      health: {
        ok: raw.ok === true,
        ...(typeof raw.detail === "string" ? { detail: raw.detail } : {}),
        ...(typeof raw.code === "string" ? { code: raw.code as ParserModelHealth["code"] } : {}),
        ...(typeof raw.retryAfterSeconds === "number" ? { retryAfterSeconds: raw.retryAfterSeconds } : {}),
      },
    };
  }

  async checkModelProfiles(): Promise<ParserModelProfileStatus[]> {
    const response = await fetch(this.url("/api/model-profiles/health"));
    if (!response.ok) throw new Error(await this.errorMessage(response, "Model health request failed"));
    const value = (await response.json()) as { profiles?: unknown };
    if (!Array.isArray(value.profiles)) throw new Error("Backend returned an invalid model health response.");
    const result: ParserModelProfileStatus[] = [];
    for (const entry of value.profiles) {
      const profile = parseProfile(entry);
      if (profile === null || typeof entry !== "object" || entry === null) continue;
      const health = (entry as { health?: unknown }).health;
      if (typeof health !== "object" || health === null || typeof (health as { ok?: unknown }).ok !== "boolean")
        continue;
      const raw = health as Partial<ParserModelHealth>;
      result.push({
        ...profile,
        health: {
          ok: raw.ok === true,
          ...(typeof raw.detail === "string" ? { detail: raw.detail } : {}),
          ...(typeof raw.code === "string" ? { code: raw.code as ParserModelHealth["code"] } : {}),
          ...(typeof raw.retryAfterSeconds === "number" ? { retryAfterSeconds: raw.retryAfterSeconds } : {}),
        },
      });
    }
    return result;
  }
}
