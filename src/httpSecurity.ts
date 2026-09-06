import type { IncomingMessage } from "node:http";

export const STATBLOCK_CLIENT_HEADER = "x-statblock-client";
export const STATBLOCK_CLIENT_HEADER_VALUE = "statblock-parser";

export type LocalApiSecurityOptions = {
  allowedOrigins?: readonly string[];
};

function normalizedOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLocaleLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]" || normalized === "::1";
}

function sameLoopbackOrigin(request: IncomingMessage, origin: string): boolean {
  const host = request.headers.host;
  if (host === undefined) return false;

  try {
    const requestOrigin = new URL(`http://${host}`);
    const browserOrigin = new URL(origin);
    return (
      isLoopbackHostname(requestOrigin.hostname) &&
      isLoopbackHostname(browserOrigin.hostname) &&
      browserOrigin.protocol === "http:" &&
      browserOrigin.port === requestOrigin.port &&
      browserOrigin.hostname.toLocaleLowerCase() === requestOrigin.hostname.toLocaleLowerCase()
    );
  } catch {
    return false;
  }
}

export function isAllowedApiOrigin(request: IncomingMessage, options: LocalApiSecurityOptions = {}): boolean {
  const origin = request.headers.origin;
  if (origin === undefined) return true;

  const normalized = normalizedOrigin(origin);
  if (normalized === null) return false;
  if (sameLoopbackOrigin(request, normalized)) return true;

  return (options.allowedOrigins ?? []).some((allowed) => normalizedOrigin(allowed) === normalized);
}

export function apiCorsHeaders(
  request: IncomingMessage,
  options: LocalApiSecurityOptions = {},
): Record<string, string> {
  const origin = request.headers.origin;
  if (origin === undefined || !isAllowedApiOrigin(request, options)) return {};
  return {
    "Access-Control-Allow-Origin": normalizedOrigin(origin)!,
    "Access-Control-Allow-Headers": `Content-Type, ${STATBLOCK_CLIENT_HEADER}`,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

export function hasTrustedMutationHeader(request: IncomingMessage): boolean {
  if (request.method !== "POST" && request.method !== "DELETE") return true;
  return request.headers[STATBLOCK_CLIENT_HEADER] === STATBLOCK_CLIENT_HEADER_VALUE;
}
