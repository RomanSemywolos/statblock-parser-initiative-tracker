export function defaultBackendUrl(): string {
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${window.location.hostname}:3030`;
}

export function defaultTranslationProviderUrl(): string {
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${window.location.hostname}:5000`;
}

export function getOrCreateClientId(): string {
  const key = "statblock-parser-client-id";
  const existing = window.localStorage.getItem(key);
  if (existing !== null && existing.length > 0) return existing;
  const value =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, value);
  return value;
}
