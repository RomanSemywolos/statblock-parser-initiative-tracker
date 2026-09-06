import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { createLosslessSourceMap } from "./losslessSource.js";
import type { ModelProfile, ModelProfileStatus } from "./modelProvider.js";
import type { TranslationProvider, TranslationRequest } from "./translationProvider.js";

import { analyzeStatblock, type StructureModelCaller } from "./pipeline.js";
import { PARSER_MODES, type ParserMode } from "./parserRouting.js";

import { createParserReport, renderNormalizedStatblock } from "./renderer.js";
import type { ParseJobService } from "./parseJobService.js";
import { handleParseJobsApi } from "./parseJobHttp.js";
import {
  PUBLIC_INTERNAL_ERROR,
  PUBLIC_MODEL_ERROR,
  PUBLIC_TRANSLATION_ERROR,
  publicModelProfileStatuses,
  publicTranslationHealth,
} from "./publicErrors.js";
import {
  apiCorsHeaders,
  hasTrustedMutationHeader,
  isAllowedApiOrigin,
  type LocalApiSecurityOptions,
} from "./httpSecurity.js";

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;

const MAX_SOURCE_CHARACTERS = 1_000_000;

export { APP_HTML } from "./diagnosticAppHtml.js";
import { APP_HTML } from "./diagnosticAppHtml.js";

export type StatblockAppOptions = {
  model: string;
  callModel?: StructureModelCaller;
  parseJobs?: ParseJobService;
  modelProfiles?: ModelProfile[];
  listModelProfiles?: () => ModelProfile[];
  checkModelProfiles?: () => Promise<ModelProfileStatus[]>;
  configureCustomModelProfile?: (config: {
    baseUrl: string;
    model: string;
    apiKey?: string;
  }) => Promise<ModelProfileStatus>;
  configureModelProfileCredential?: (config: { profileId: string; apiKey: string }) => Promise<ModelProfileStatus>;
  translationProvider?: TranslationProvider;
  activeProfileId?: string;
  timeoutMs?: number;
  numCtx?: number;
  numPredict?: number;
  security?: LocalApiSecurityOptions;
};

class PayloadTooLargeError extends Error {
  constructor() {
    super("Request body is too large.");
    this.name = "PayloadTooLargeError";
  }
}

function writeJson(response: ServerResponse, statusCode: number, value: unknown): void {
  const body = JSON.stringify(value);

  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  let byteLength = 0;

  let tooLarge = false;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

    byteLength += buffer.length;

    if (byteLength > MAX_REQUEST_BYTES) {
      tooLarge = true;
      continue;
    }

    chunks.push(buffer);
  }

  if (tooLarge) {
    throw new PayloadTooLargeError();
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requestUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? "/", "http://localhost");
}

export function createStatblockAppServer(options: StatblockAppOptions): Server {
  return createServer(async (request, response) => {
    const url = requestUrl(request);
    const isApiRequest = url.pathname.startsWith("/api/");

    if (isApiRequest && !isAllowedApiOrigin(request, options.security)) {
      writeJson(response, 403, { error: "This browser origin is not allowed to access the local API." });
      return;
    }

    if (isApiRequest) {
      for (const [name, value] of Object.entries(apiCorsHeaders(request, options.security))) {
        response.setHeader(name, value);
      }
    }

    if (request.method === "OPTIONS" && isApiRequest) {
      response.writeHead(204, {
        ...apiCorsHeaders(request, options.security),
      });
      response.end();
      return;
    }

    if (isApiRequest && !hasTrustedMutationHeader(request)) {
      writeJson(response, 403, { error: "The local API requires a trusted client header for changes." });
      return;
    }

    if (
      options.parseJobs !== undefined &&
      (await handleParseJobsApi(request, response, url, options.parseJobs, { security: options.security }))
    ) {
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/model-profiles") {
      writeJson(response, 200, {
        profiles: options.listModelProfiles?.() ??
          options.modelProfiles ?? [
            {
              id: "default",
              displayName: options.model,
              providerType: "ollama",
            },
          ],
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/model-profiles/custom") {
      if (options.configureCustomModelProfile === undefined) {
        writeJson(response, 404, { error: "Custom model profiles are not supported by this backend." });
        return;
      }
      if (!request.headers["content-type"]?.toLocaleLowerCase().startsWith("application/json")) {
        writeJson(response, 415, { error: "Expected application/json." });
        return;
      }
      try {
        const body = await readJsonBody(request);
        const baseUrl =
          typeof body === "object" && body !== null && "baseUrl" in body && typeof body.baseUrl === "string"
            ? body.baseUrl.trim()
            : "";
        const model =
          typeof body === "object" && body !== null && "model" in body && typeof body.model === "string"
            ? body.model.trim()
            : "";
        const apiKey =
          typeof body === "object" && body !== null && "apiKey" in body && typeof body.apiKey === "string"
            ? body.apiKey.trim()
            : "";
        if (baseUrl.length === 0 || model.length === 0) {
          writeJson(response, 400, { error: "baseUrl and model are required." });
          return;
        }
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(baseUrl);
        } catch {
          writeJson(response, 400, { error: "baseUrl must be a valid URL." });
          return;
        }
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          writeJson(response, 400, { error: "baseUrl must use http or https." });
          return;
        }
        if (baseUrl.length > 2048 || model.length > 300) {
          writeJson(response, 400, { error: "Custom model configuration is too long." });
          return;
        }
        writeJson(response, 200, {
          profile: await options.configureCustomModelProfile({ baseUrl, model, ...(apiKey === "" ? {} : { apiKey }) }),
        });
      } catch (error) {
        if (error instanceof SyntaxError) writeJson(response, 400, { error: "Request body must be valid JSON." });
        else {
          console.error("Custom model configuration failed:", error);
          writeJson(response, 502, { error: PUBLIC_MODEL_ERROR });
        }
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/model-profiles/credential") {
      if (options.configureModelProfileCredential === undefined) {
        writeJson(response, 404, { error: "Model credentials are not supported by this backend." });
        return;
      }
      if (!request.headers["content-type"]?.toLocaleLowerCase().startsWith("application/json")) {
        writeJson(response, 415, { error: "Expected application/json." });
        return;
      }
      try {
        const body = await readJsonBody(request);
        const profileId =
          typeof body === "object" && body !== null && "profileId" in body && typeof body.profileId === "string"
            ? body.profileId.trim()
            : "";
        const apiKey =
          typeof body === "object" && body !== null && "apiKey" in body && typeof body.apiKey === "string"
            ? body.apiKey.trim()
            : "";
        if (profileId.length === 0 || apiKey.length === 0) {
          writeJson(response, 400, { error: "profileId and apiKey are required." });
          return;
        }
        if (profileId.length > 200 || apiKey.length > 4096) {
          writeJson(response, 400, { error: "Model credential configuration is too long." });
          return;
        }
        writeJson(response, 200, { profile: await options.configureModelProfileCredential({ profileId, apiKey }) });
      } catch (error) {
        if (error instanceof SyntaxError) writeJson(response, 400, { error: "Request body must be valid JSON." });
        else {
          console.error("Model credential configuration failed:", error);
          writeJson(response, 502, { error: PUBLIC_MODEL_ERROR });
        }
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/model-profiles/health") {
      if (options.checkModelProfiles === undefined) {
        writeJson(response, 200, { profiles: [] });
        return;
      }
      try {
        writeJson(response, 200, { profiles: publicModelProfileStatuses(await options.checkModelProfiles()) });
      } catch (error) {
        console.error("Model health check failed:", error);
        writeJson(response, 502, { error: PUBLIC_MODEL_ERROR });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/translation/health") {
      if (options.translationProvider === undefined) {
        writeJson(response, 200, {
          provider: null,
          health: {
            ok: false,
            detail: "Translation is not configured. Choose an available translation service in settings.",
          },
        });
        return;
      }
      try {
        writeJson(response, 200, {
          provider: {
            id: options.translationProvider.id,
            displayName: options.translationProvider.displayName,
            providerType: options.translationProvider.providerType,
          },
          health: publicTranslationHealth(await options.translationProvider.healthCheck()),
        });
      } catch (error) {
        console.error("Translation health check failed:", error);
        writeJson(response, 502, { error: PUBLIC_TRANSLATION_ERROR });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/translation") {
      if (options.translationProvider === undefined) {
        writeJson(response, 503, {
          error: "Translation is not configured. Choose an available translation service in settings.",
        });
        return;
      }
      if (!request.headers["content-type"]?.toLocaleLowerCase().startsWith("application/json")) {
        writeJson(response, 415, { error: "Expected application/json." });
        return;
      }
      try {
        const body = await readJsonBody(request);
        if (typeof body !== "object" || body === null) {
          writeJson(response, 400, { error: "Translation request must be a JSON object." });
          return;
        }
        const sourceLanguage =
          "sourceLanguage" in body && (body.sourceLanguage === "en" || body.sourceLanguage === "uk")
            ? body.sourceLanguage
            : null;
        const targetLanguage =
          "targetLanguage" in body && (body.targetLanguage === "en" || body.targetLanguage === "uk")
            ? body.targetLanguage
            : null;
        const texts =
          "texts" in body && Array.isArray(body.texts) && body.texts.every((entry) => typeof entry === "string")
            ? (body.texts as string[])
            : null;
        if (sourceLanguage === null || targetLanguage === null || texts === null) {
          writeJson(response, 400, { error: "sourceLanguage, targetLanguage and string[] texts are required." });
          return;
        }
        if (texts.length > 500 || texts.reduce((total, text) => total + text.length, 0) > MAX_SOURCE_CHARACTERS) {
          writeJson(response, 413, { error: "Translation request is too large." });
          return;
        }
        const translationRequest: TranslationRequest = { sourceLanguage, targetLanguage, texts };
        writeJson(response, 200, await options.translationProvider.translate(translationRequest));
      } catch (error) {
        if (error instanceof PayloadTooLargeError) writeJson(response, 413, { error: error.message });
        else if (error instanceof SyntaxError) writeJson(response, 400, { error: "Request body must be valid JSON." });
        else {
          console.error("Translation request failed:", error);
          writeJson(response, 502, { error: PUBLIC_TRANSLATION_ERROR });
        }
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": Buffer.byteLength(APP_HTML),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(APP_HTML);
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, {
        ok: true,
        model: options.model,
        activeProfileId: options.activeProfileId ?? "default",
      });
      return;
    }

    if (request.method !== "POST" || url.pathname !== "/api/parse") {
      writeJson(response, 404, {
        error: "Not found.",
      });
      return;
    }

    if (!request.headers["content-type"]?.toLocaleLowerCase().startsWith("application/json")) {
      writeJson(response, 415, {
        error: "Expected application/json.",
      });
      return;
    }

    try {
      const parseRequestStartedAt = performance.now();
      const body = await readJsonBody(request);

      const source =
        typeof body === "object" && body !== null && "source" in body && typeof body.source === "string"
          ? body.source
          : null;
      const requestedParserMode =
        typeof body === "object" && body !== null && "parserMode" in body && typeof body.parserMode === "string"
          ? body.parserMode
          : "auto";
      if (!PARSER_MODES.includes(requestedParserMode as ParserMode)) {
        writeJson(response, 400, { error: `Unknown parserMode: ${requestedParserMode}` });
        return;
      }
      if (source === null || source.trim().length === 0) {
        writeJson(response, 400, {
          error: "The source field must contain statblock text.",
        });
        return;
      }

      if (source.length > MAX_SOURCE_CHARACTERS) {
        writeJson(response, 413, {
          error: "The statblock text is too large.",
        });
        return;
      }

      const sourceMapStartedAt = performance.now();
      const sourceMap = createLosslessSourceMap(source);
      const sourceMapSeconds = (performance.now() - sourceMapStartedAt) / 1000;

      const analyzed = await analyzeStatblock({
        rawSource: source,
        sourceMap,
        model: options.model,
        callModel: options.callModel,
        timeoutMs: options.timeoutMs,
        numCtx: options.numCtx,
        numPredict: options.numPredict,
        parserMode: requestedParserMode as ParserMode,
      });

      const normalized = renderNormalizedStatblock(analyzed.document);
      const report = createParserReport(analyzed.document);
      const totalServerSeconds = (performance.now() - parseRequestStartedAt) / 1000;

      writeJson(response, 200, {
        normalized,
        document: analyzed.document,
        report,
        candidateDebug: analyzed.candidateDebug,
        rawModelContent: analyzed.rawModelContent,
        parserRouting: analyzed.parserRouting,
        timing: {
          totalServerSeconds,
          sourceMapSeconds,
          analyze: analyzed.timing,
        },
      });
    } catch (error: unknown) {
      if (error instanceof PayloadTooLargeError) {
        writeJson(response, 413, {
          error: error.message,
        });
        return;
      }

      if (error instanceof SyntaxError) {
        writeJson(response, 400, {
          error: "The request body is not valid JSON.",
        });
        return;
      }

      console.error("Synchronous parse request failed:", error);
      writeJson(response, 500, { error: PUBLIC_INTERNAL_ERROR });
    }
  });
}
