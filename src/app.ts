import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { createStatblockAppServer } from "./webApp.js";
import { createConfiguredModelProviders, createGroqProvider } from "./configuredModelProviders.js";
import { CUSTOM_MODEL_PROFILE_ID } from "./modelProvider.js";
import { OpenAICompatibleModelProvider } from "./openAICompatibleProvider.js";
import { ModelProviderRegistry } from "./modelProviderRegistry.js";
import { JsonFileParseJobStore } from "./parseJobStore.js";
import { JsonFileParseDiagnosticsStore } from "./parseDiagnosticsStore.js";
import { ParseJobExecutionError, ParseJobService } from "./parseJobService.js";
import { createProductParseJobRunner } from "./productParseJobRunner.js";
import { PACKAGE_VERSION } from "./version.js";
import { DeepLTranslationProvider } from "./deeplTranslationProvider.js";
import { RuntimeCredentialStore, credentialForConfiguredEndpoint } from "./runtimeCredentialStore.js";

const HOST = process.env.STATBLOCK_APP_HOST ?? "127.0.0.1";

const PORT_TEXT = process.env.STATBLOCK_APP_PORT ?? "3030";

const PORT = Number(PORT_TEXT);

const JOB_STORE_PATH = resolve(process.env.STATBLOCK_JOB_STORE ?? ".statblock-parser/parse-jobs.json");
const REPORT_PATH = resolve(process.env.STATBLOCK_REPORT_PATH ?? ".statblock-parser/parse-reports.json");
const ALLOWED_ORIGINS = (process.env.STATBLOCK_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

const configuredModels = createConfiguredModelProviders();
const modelRegistry = new ModelProviderRegistry(configuredModels.providers, configuredModels.defaultProfileId);
const defaultProvider = modelRegistry.resolve(modelRegistry.defaultProfileId);
const runtimeApiKeys = new Map<string, string>();
const customRuntimeCredentials = new RuntimeCredentialStore();
const deepLApiKey = process.env.DEEPL_API_KEY?.trim();
const deepLBaseUrl = process.env.DEEPL_API_BASE_URL?.trim();
const translationProvider = deepLApiKey
  ? new DeepLTranslationProvider({
      apiKey: deepLApiKey,
      ...(deepLBaseUrl ? { baseUrl: deepLBaseUrl } : {}),
    })
  : undefined;
const runners = new Map(
  configuredModels.providers.map(
    (provider) => [provider.id, createProductParseJobRunner({ provider, parserVersion: PACKAGE_VERSION })] as const,
  ),
);

const parseJobs = new ParseJobService({
  store: new JsonFileParseJobStore(JOB_STORE_PATH),
  defaultModelProfileId: modelRegistry.defaultProfileId,
  diagnosticsStore: new JsonFileParseDiagnosticsStore(REPORT_PATH),
  resolveRunner: (profileId) => {
    const runner = runners.get(profileId);
    if (runner === undefined) {
      throw new ParseJobExecutionError("model", `Unknown parser model profile: ${profileId}`);
    }
    return runner;
  },
});

await parseJobs.initialize();

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error(`STATBLOCK_APP_PORT must be an integer from 1 to 65535; received ${JSON.stringify(PORT_TEXT)}.`);
}

function openBrowser(url: string): void {
  if (process.env.STATBLOCK_APP_NO_OPEN === "1") {
    return;
  }

  const command = process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open";

  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });

    child.on("error", () => {
      // Надрукована адреса залишається надійним запасним способом, якщо системного відкривача немає.
    });
    child.unref();
  } catch {
    // Якщо запуск браузера не вдався, користувач усе одно може відкрити надруковану адресу вручну.
  }
}

const server = createStatblockAppServer({
  model: defaultProvider.model,
  callModel: (request) => defaultProvider.generateStructured(request),
  parseJobs,
  listModelProfiles: () => modelRegistry.listProfiles(),
  checkModelProfiles: () => modelRegistry.checkProfiles(),
  configureCustomModelProfile: async ({ baseUrl, model, apiKey: suppliedApiKey }) => {
    const hostname = new URL(baseUrl).hostname.toLocaleLowerCase();
    const isGroq = hostname === "api.groq.com" || hostname.endsWith(".groq.com");
    const supplied = suppliedApiKey?.trim();
    if (supplied) customRuntimeCredentials.remember(baseUrl, supplied);
    const apiKey =
      supplied ||
      customRuntimeCredentials.get(baseUrl) ||
      (isGroq
        ? credentialForConfiguredEndpoint(
            baseUrl,
            process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1",
            process.env.GROQ_API_KEY,
          )
        : credentialForConfiguredEndpoint(
            baseUrl,
            process.env.OPENAI_COMPATIBLE_API_BASE_URL,
            process.env.OPENAI_COMPATIBLE_API_KEY,
          ));
    const provider = new OpenAICompatibleModelProvider({
      id: CUSTOM_MODEL_PROFILE_ID,
      displayName: `${model} (${isGroq ? "Groq" : "OpenAI-compatible"})`,
      providerType: isGroq ? "groq" : "openai-compatible",
      model,
      baseUrl,
      apiKey,
    });
    modelRegistry.upsert(provider);
    runners.set(provider.id, createProductParseJobRunner({ provider, parserVersion: PACKAGE_VERSION }));
    return {
      id: provider.id,
      displayName: provider.displayName,
      providerType: provider.providerType,
      model: provider.model,
      serviceUrl: provider.serviceUrl,
      health: await provider.healthCheck(),
    };
  },
  configureModelProfileCredential: async ({ profileId, apiKey }) => {
    const existing = modelRegistry.resolve(profileId);
    if (existing.providerType !== "groq") {
      throw new Error(
        "API-ключ через інтерфейс наразі підтримується для готових Groq-профілів; для інших сервісів використайте власну модель.",
      );
    }
    const normalizedApiKey = apiKey.trim();
    runtimeApiKeys.set(profileId, normalizedApiKey);
    const provider = createGroqProvider(
      profileId,
      normalizedApiKey,
      existing.serviceUrl ?? "https://api.groq.com/openai/v1",
    );
    if (provider === null) throw new Error(`Unknown Groq model profile: ${profileId}`);
    modelRegistry.upsert(provider);
    runners.set(provider.id, createProductParseJobRunner({ provider, parserVersion: PACKAGE_VERSION }));
    return {
      id: provider.id,
      displayName: provider.displayName,
      providerType: provider.providerType,
      model: provider.model,
      serviceUrl: provider.serviceUrl,
      health: await provider.healthCheck(),
    };
  },
  activeProfileId: modelRegistry.defaultProfileId,
  translationProvider,
  security: { allowedOrigins: ALLOWED_ORIGINS },
});

server.on("error", (error) => {
  console.error("Failed to start the statblock app:");
  console.error(error);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;

  console.log(`Lossless Statblock Parser is running at ${url}`);
  console.log(`Default parser model: ${defaultProvider.displayName}`);
  console.log(
    `Available parser profiles: ${modelRegistry
      .listProfiles()
      .map((profile) => profile.id)
      .join(", ")}`,
  );
  console.log(`Translation provider: ${translationProvider?.displayName ?? "not configured (set DEEPL_API_KEY)"}`);
  console.log(`Parse job store: ${JOB_STORE_PATH}`);
  console.log(`Parse diagnostics: ${REPORT_PATH}`);
  console.log("Press Ctrl+C to stop the app.");

  openBrowser(url);
});
