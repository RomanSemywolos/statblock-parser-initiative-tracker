function credentialScope(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
  return url.toString();
}

export class RuntimeCredentialStore {
  private readonly values = new Map<string, string>();

  remember(baseUrl: string, apiKey: string): void {
    const value = apiKey.trim();
    if (value.length === 0) return;
    this.values.set(credentialScope(baseUrl), value);
  }

  get(baseUrl: string): string | undefined {
    return this.values.get(credentialScope(baseUrl));
  }
}

export function credentialForConfiguredEndpoint(
  requestedBaseUrl: string,
  configuredBaseUrl: string | undefined,
  configuredApiKey: string | undefined,
): string | undefined {
  const apiKey = configuredApiKey?.trim();
  const baseUrl = configuredBaseUrl?.trim();
  if (!apiKey || !baseUrl) return undefined;
  return credentialScope(requestedBaseUrl) === credentialScope(baseUrl) ? apiKey : undefined;
}
