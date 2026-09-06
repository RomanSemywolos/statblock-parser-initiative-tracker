import type { IncomingMessage, ServerResponse } from "node:http";
import { PARSER_MODES, type ParserMode } from "./parserRouting.js";
import {
  apiCorsHeaders,
  hasTrustedMutationHeader,
  isAllowedApiOrigin,
  type LocalApiSecurityOptions,
} from "./httpSecurity.js";

import { ParseJobConflictError, ParseJobNotFoundError, type ParseJobService } from "./parseJobService.js";
import { PUBLIC_INTERNAL_ERROR, publicParseJobSummary } from "./publicErrors.js";

const DEFAULT_MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_SOURCE_CHARACTERS = 1_000_000;

export type ParseJobHttpOptions = {
  maxRequestBytes?: number;
  maxSourceCharacters?: number;
  security?: LocalApiSecurityOptions;
};

class ParseJobPayloadTooLargeError extends Error {}

function writeJson(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  value: unknown,
  options: ParseJobHttpOptions,
): void {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...apiCorsHeaders(request, options.security),
  });
  response.end(body);
}

async function readJsonBody(request: IncomingMessage, maxRequestBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let byteLength = 0;
  let tooLarge = false;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.length;
    if (byteLength > maxRequestBytes) {
      tooLarge = true;
      continue;
    }
    chunks.push(buffer);
  }

  if (tooLarge) throw new ParseJobPayloadTooLargeError("Request body is too large.");
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// clientId separates one browser installation's jobs from another in this
// single-user local service. It is routing metadata, not authentication or an
// authorization credential; access control is enforced by the Origin and
// trusted-client-header checks above.
function clientId(url: URL): string | null {
  const value = url.searchParams.get("clientId")?.trim() ?? "";
  return value.length === 0 ? null : value;
}

export async function handleParseJobsApi(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  service: ParseJobService,
  options: ParseJobHttpOptions = {},
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/parse-jobs") && !url.pathname.startsWith("/api/parse-reports")) return false;

  if (!isAllowedApiOrigin(request, options.security)) {
    writeJson(
      request,
      response,
      403,
      { error: "This browser origin is not allowed to access the local API." },
      options,
    );
    return true;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      ...apiCorsHeaders(request, options.security),
    });
    response.end();
    return true;
  }

  if (!hasTrustedMutationHeader(request)) {
    writeJson(
      request,
      response,
      403,
      { error: "The local API requires a trusted client header for changes." },
      options,
    );
    return true;
  }

  const currentClientId = clientId(url);
  if (currentClientId === null) {
    writeJson(request, response, 400, { error: "clientId is required." }, options);
    return true;
  }

  const maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;
  const maxSourceCharacters = options.maxSourceCharacters ?? DEFAULT_MAX_SOURCE_CHARACTERS;

  try {
    if (url.pathname === "/api/parse-reports" && request.method === "GET") {
      writeJson(request, response, 200, { reports: await service.listDiagnostics(currentClientId) }, options);
      return true;
    }

    if (url.pathname === "/api/parse-reports/export" && request.method === "GET") {
      writeJson(request, response, 200, await service.exportDiagnostics(currentClientId), options);
      return true;
    }

    const reportMatch = /^\/api\/parse-reports\/([^/]+)$/u.exec(url.pathname);
    if (reportMatch !== null && request.method === "GET") {
      writeJson(
        request,
        response,
        200,
        await service.getDiagnostics(currentClientId, decodeURIComponent(reportMatch[1]!)),
        options,
      );
      return true;
    }

    if (url.pathname.startsWith("/api/parse-reports")) {
      writeJson(request, response, 405, { error: "Method not allowed." }, options);
      return true;
    }

    if (url.pathname === "/api/parse-jobs" && request.method === "GET") {
      writeJson(
        request,
        response,
        200,
        { jobs: (await service.list(currentClientId)).map(publicParseJobSummary) },
        options,
      );
      return true;
    }

    if (url.pathname === "/api/parse-jobs" && request.method === "POST") {
      if (!request.headers["content-type"]?.toLocaleLowerCase().startsWith("application/json")) {
        writeJson(request, response, 415, { error: "Expected application/json." }, options);
        return true;
      }
      const body = await readJsonBody(request, maxRequestBytes);
      const source =
        typeof body === "object" && body !== null && "source" in body && typeof body.source === "string"
          ? body.source
          : null;
      if (source === null || source.trim().length === 0) {
        writeJson(request, response, 400, { error: "The source field must contain statblock text." }, options);
        return true;
      }
      if (source.length > maxSourceCharacters) {
        writeJson(request, response, 413, { error: "The statblock text is too large." }, options);
        return true;
      }
      const modelProfileId =
        typeof body === "object" && body !== null && "modelProfileId" in body && typeof body.modelProfileId === "string"
          ? body.modelProfileId
          : null;
      const requestedParserMode =
        typeof body === "object" && body !== null && "parserMode" in body && typeof body.parserMode === "string"
          ? body.parserMode
          : "auto";
      if (!PARSER_MODES.includes(requestedParserMode as ParserMode)) {
        writeJson(request, response, 400, { error: `Unknown parserMode: ${requestedParserMode}` }, options);
        return true;
      }
      const targetStatblockId =
        typeof body === "object" && body !== null && "statblockId" in body && typeof body.statblockId === "string"
          ? body.statblockId.trim() || null
          : null;
      writeJson(
        request,
        response,
        202,
        publicParseJobSummary(
          await service.submit(
            currentClientId,
            source,
            modelProfileId,
            requestedParserMode as ParserMode,
            targetStatblockId,
          ),
        ),
        options,
      );
      return true;
    }

    const match = /^\/api\/parse-jobs\/([^/]+)(?:\/(result|retry))?$/u.exec(url.pathname);
    if (match === null) {
      writeJson(request, response, 404, { error: "Not found." }, options);
      return true;
    }
    const id = decodeURIComponent(match[1]!);
    const action = match[2] ?? null;

    if (action === null && request.method === "GET") {
      writeJson(request, response, 200, publicParseJobSummary(await service.get(currentClientId, id)), options);
      return true;
    }
    if (action === "result" && request.method === "GET") {
      writeJson(request, response, 200, await service.result(currentClientId, id), options);
      return true;
    }
    if (action === "retry" && request.method === "POST") {
      writeJson(request, response, 200, publicParseJobSummary(await service.retry(currentClientId, id)), options);
      return true;
    }
    if (action === null && request.method === "DELETE") {
      await service.delete(currentClientId, id);
      response.writeHead(204, {
        "Cache-Control": "no-store",
        ...apiCorsHeaders(request, options.security),
      });
      response.end();
      return true;
    }

    writeJson(request, response, 405, { error: "Method not allowed." }, options);
    return true;
  } catch (error) {
    if (error instanceof ParseJobNotFoundError) {
      writeJson(request, response, 404, { error: error.message }, options);
      return true;
    }
    if (error instanceof ParseJobConflictError) {
      writeJson(request, response, 409, { error: error.message }, options);
      return true;
    }
    if (error instanceof ParseJobPayloadTooLargeError) {
      writeJson(request, response, 413, { error: error.message }, options);
      return true;
    }
    if (error instanceof SyntaxError) {
      writeJson(request, response, 400, { error: "Request body must be valid JSON." }, options);
      return true;
    }
    console.error("Parse job HTTP request failed:", error);
    writeJson(request, response, 500, { error: PUBLIC_INTERNAL_ERROR }, options);
    return true;
  }
}
