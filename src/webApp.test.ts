import test from "node:test";
import assert from "node:assert/strict";

import type { AddressInfo } from "node:net";

import { Script } from "node:vm";

import { APP_HTML, createStatblockAppServer } from "./webApp.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import { prepareCandidateLattice } from "./candidateLattice.js";
import { type CandidateRunClassification } from "./modelSchema.js";
import type { HeaderField } from "./domain.js";

function routedCandidates(source: string) {
  const sourceMap = createLosslessSourceMap(source);
  return prepareCandidateLattice(source, sourceMap, "auto").candidates;
}

function candidateEnvelopeFromStarts(
  classifications: Array<CandidateRunClassification | HeaderField | "continuation">,
) {
  const blocks: Array<{ k: string; s: string; e: string; f?: string; v?: string }> = [];
  const id = (index: number): string => `C${String(index).padStart(3, "0")}`;
  const modelShape = (
    classification: CandidateRunClassification | HeaderField,
  ): { k: string; f?: string; v?: string } => {
    if (classification === "name") return { k: "n" };
    if (classification === "size_type_alignment") return { k: "sta" };
    if (classification === "traits_heading") return { k: "sh", v: "t" };
    if (classification === "actions_heading") return { k: "sh", v: "a" };
    if (classification === "bonus_actions_heading") return { k: "sh", v: "ba" };
    if (classification === "reactions_heading") return { k: "sh", v: "r" };
    if (classification === "legendary_actions_heading") return { k: "sh", v: "la" };
    if (classification === "mythic_actions_heading") return { k: "sh", v: "ma" };
    if (classification === "lair_actions_heading") return { k: "sh", v: "lair" };
    if (classification === "feature") return { k: "f" };
    if (classification === "section_rules") return { k: "r" };
    if (classification === "section_content") return { k: "sc" };
    if (classification === "supplementary") return { k: "sup" };
    if (classification === "unclassified") return { k: "u" };
    void (classification as HeaderField);
    return { k: "h" };
  };

  let start = 0;
  let sourceClass: CandidateRunClassification | HeaderField =
    classifications[0] === "continuation"
      ? "unclassified"
      : (classifications[0] as CandidateRunClassification | HeaderField);
  const pushSpan = (end: number): void => {
    blocks.push({ ...modelShape(sourceClass), s: id(start), e: id(end) });
  };
  for (let index = 1; index < classifications.length; index += 1) {
    const classification = classifications[index];
    if (classification === "continuation") continue;
    pushSpan(index - 1);
    start = index;
    sourceClass = classification;
  }
  if (classifications.length > 0) pushSpan(classifications.length - 1);
  return { blocks };
}
test("serves the local UI and runs the existing lossless pipeline through its API", async () => {
  const clientScript = APP_HTML.match(/<script>([\s\S]*?)<\/script>/u)?.[1];

  assert.ok(clientScript);
  assert.doesNotThrow(() => new Script(clientScript));

  const source = [
    "Solar",
    "Armor Class 21",
    "CR 21 (XP 33,000)",
    "Traits",
    "Divine Awareness. The solar knows if it hears a lie.",
    "Actions",
    "Flying Sword. Hit: 22 damage.",
  ].join("\n");

  let modelCallCount = 0;

  const candidateSource = routedCandidates(source);
  const candidateClasses = candidateSource.map((candidate) => {
    if (candidate.preview.startsWith("Solar")) return "name";
    if (candidate.preview.startsWith("Armor Class")) return "armor_class";
    if (candidate.preview.startsWith("CR 21")) return "challenge";
    if (candidate.preview.startsWith("Traits")) return "traits_heading";
    if (candidate.preview.startsWith("Divine Awareness.")) return "feature";
    if (candidate.preview.startsWith("Actions")) return "actions_heading";
    if (candidate.preview.startsWith("Flying Sword.")) return "feature";
    return "continuation";
  });
  const candidateResponse = {
    ...candidateEnvelopeFromStarts(candidateClasses),
  };
  const headerCandidates = prepareCandidateLattice(source, createLosslessSourceMap(source), "auto").headerCandidates;
  const server = createStatblockAppServer({
    model: "test-model",
    activeProfileId: "remote",
    modelProfiles: [
      { id: "default", displayName: "test-model", providerType: "ollama", model: "test-model" },
      { id: "remote", displayName: "remote-model", providerType: "groq", model: "remote-model" },
    ],
    checkModelProfiles: async () => [
      { id: "default", displayName: "test-model", providerType: "ollama", model: "test-model", health: { ok: true } },
      {
        id: "remote",
        displayName: "remote-model",
        providerType: "groq",
        model: "remote-model",
        health: { ok: false, code: "model_unavailable", detail: "missing" },
      },
    ],
    callModel: async (request) => {
      modelCallCount += 1;
      const response = /CARD-FACT VERIFICATION MODE/u.test(request.systemPrompt)
        ? {
            essentialFacts: [
              { k: "n", s: "C000", e: "C000" },
              { k: "ac", s: "C001", e: "C001" },
              { k: "cr", s: "C002", e: "C002" },
            ],
          }
        : candidateResponse;

      return {
        rawContent: JSON.stringify(response),
        parsedContent: response,
        elapsedSeconds: 0.01,
      };
    },
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  try {
    const address = server.address() as AddressInfo;

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    assert.equal(healthResponse.headers.get("access-control-allow-origin"), null);
    assert.deepEqual(await healthResponse.json(), {
      ok: true,
      model: "test-model",
      activeProfileId: "remote",
    });

    const profilesResponse = await fetch(`${baseUrl}/api/model-profiles`);
    assert.equal(profilesResponse.status, 200);
    assert.deepEqual(await profilesResponse.json(), {
      profiles: [
        { id: "default", displayName: "test-model", providerType: "ollama", model: "test-model" },
        { id: "remote", displayName: "remote-model", providerType: "groq", model: "remote-model" },
      ],
    });

    const profileHealthResponse = await fetch(`${baseUrl}/api/model-profiles/health`);
    assert.equal(profileHealthResponse.status, 200);
    assert.deepEqual(await profileHealthResponse.json(), {
      profiles: [
        { id: "default", displayName: "test-model", providerType: "ollama", model: "test-model", health: { ok: true } },
        {
          id: "remote",
          displayName: "remote-model",
          providerType: "groq",
          model: "remote-model",
          health: { ok: false, code: "model_unavailable", detail: "The model provider is unavailable." },
        },
      ],
    });

    const pageResponse = await fetch(baseUrl);

    assert.equal(pageResponse.status, 200);

    const page = await pageResponse.text();

    assert.match(page, /id="source"/u);
    assert.match(page, /id="edit-result"/u);
    assert.match(page, /id="show-problems"/u);
    assert.match(page, /id="timing-report"/u);
    assert.match(page, /id="candidate-report"/u);
    assert.match(page, /id="raw-model"/u);
    assert.match(page, /Час виконання/u);
    assert.match(page, /100 output tokens/u);
    assert.match(page, /Частка generation/u);
    assert.match(page, /"Прогноз при " \+ targetTokens \+ " output tokens"/u);
    assert.match(page, /body\.hide-labels \.technical-label/u);
    assert.match(page, /body\.show-problem-highlights/u);
    assert.match(page, /renderSavingThrowsRow/u);
    assert.doesNotMatch(page, /ability-save/u);
    assert.match(page, /contentEditable/u);
    assert.match(page, /\/api\/parse/u);

    const parseResponse = await fetch(`${baseUrl}/api/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Statblock-Client": "statblock-parser",
      },
      body: JSON.stringify({
        source,
      }),
    });

    assert.equal(parseResponse.status, 200);

    const result = (await parseResponse.json()) as {
      normalized: string;
      document: {
        rawSource: string;
        annotations: unknown[];
        structuredHeader: { proficiencyBonus: { value: number; printed: boolean } | null };
      };
      report: {
        unclassifiedBlockCount: number;
        integrity: {
          reconstructsRawSource: boolean;
        };
      };
      candidateDebug: {
        status: string;
        candidateCount: number;
        runCount: number;
        coveredCandidateCount: number;
      } | null;
      timing: {
        totalServerSeconds: number;
        sourceMapSeconds: number;
        analyze: {
          totalSeconds: number;
          modelCallSeconds: number;
          ollama: unknown;
        };
      };
    };

    assert.equal(result.document.rawSource, source);
    assert.equal(result.report.integrity.reconstructsRawSource, true);
    // Multiline preserves structurally proven body rows as annotations even
    // when section semantics are unknown; no language dictionary is needed.
    assert.equal(result.report.unclassifiedBlockCount, 0);
    assert.equal(result.document.annotations.length, 7);
    assert.equal(typeof result.timing.totalServerSeconds, "number");
    assert.equal(typeof result.timing.sourceMapSeconds, "number");
    assert.equal(typeof result.timing.analyze.totalSeconds, "number");
    assert.equal(typeof result.timing.analyze.modelCallSeconds, "number");
    assert.equal(result.timing.analyze.ollama, null);
    assert.deepEqual(
      result.document.structuredHeader.proficiencyBonus && {
        value: result.document.structuredHeader.proficiencyBonus.value,
        printed: result.document.structuredHeader.proficiencyBonus.printed,
      },
      { value: 7, printed: false },
    );
    assert.match(result.normalized, /Divine Awareness/u);
    assert.equal(result.candidateDebug?.status, "processed");
    assert.equal(result.candidateDebug?.candidateCount, headerCandidates.length);
    assert.equal(result.candidateDebug?.coveredCandidateCount, headerCandidates.length);
    assert.ok((result.candidateDebug?.runCount ?? 0) > 0);
    assert.equal(modelCallCount, 1);

    const emptyResponse = await fetch(`${baseUrl}/api/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Statblock-Client": "statblock-parser",
      },
      body: JSON.stringify({
        source: "   ",
      }),
    });

    assert.equal(emptyResponse.status, 400);
    assert.equal(modelCallCount, 1);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("browser UI labels supplementary ownership as post-statblock description", () => {
  assert.match(APP_HTML, /description · post_statblock_content/u);
});

test("derived proficiency bonus is rendered only after the final block of its source annotation", () => {
  assert.match(APP_HTML, /proficiencyBonus\.source\s*\?\s*proficiencyBonus\.source\.annotationId/u);
  assert.match(APP_HTML, /proficiencySourceLastBlockIndex/u);
  assert.match(APP_HTML, /blockIndex === proficiencySourceLastBlockIndex/u);
  assert.doesNotMatch(APP_HTML, /annotation && annotation\.field === "challenge" && proficiencyBonus/u);
});

test("browser UI renders one explicit description heading before post-statblock supplementary content", () => {
  assert.match(APP_HTML, /postStatblockHeadingRendered/u);
  assert.match(APP_HTML, /description · section_heading/u);
  assert.match(APP_HTML, /headingContent\.textContent = "Опис"/u);
  assert.match(APP_HTML, /annotation && annotation\.role === "supplementary" && !postStatblockHeadingRendered/u);
});

test("web app configures a runtime custom OpenAI-compatible model profile", async () => {
  let profiles = [{ id: "default", displayName: "local", providerType: "ollama", model: "local-model" }];
  let received: { baseUrl: string; model: string } | null = null;
  const server = createStatblockAppServer({
    model: "local-model",
    listModelProfiles: () => profiles,
    configureCustomModelProfile: async (config) => {
      received = config;
      const custom = {
        id: "custom-openai-compatible",
        displayName: `${config.model} (OpenAI-compatible)`,
        providerType: "openai-compatible",
        model: config.model,
      };
      profiles = [profiles[0]!, custom];
      return { ...custom, health: { ok: true, detail: "available" } };
    },
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/model-profiles/custom`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
      body: JSON.stringify({ baseUrl: "https://example.invalid/v1", model: "vendor/model" }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(received, { baseUrl: "https://example.invalid/v1", model: "vendor/model" });
    const body = (await response.json()) as { profile: { id: string; model: string; health: { ok: boolean } } };
    assert.equal(body.profile.id, "custom-openai-compatible");
    assert.equal(body.profile.model, "vendor/model");
    assert.equal(body.profile.health.ok, true);

    const listResponse = await fetch(`${baseUrl}/api/model-profiles`);
    const list = (await listResponse.json()) as { profiles: Array<{ id: string; model: string }> };
    assert.equal(
      list.profiles.some((profile) => profile.id === "custom-openai-compatible" && profile.model === "vendor/model"),
      true,
    );
  } finally {
    server.close();
  }
});

test("web app accepts a runtime model API key without returning the secret", async () => {
  let received: { profileId: string; apiKey: string } | null = null;
  const server = createStatblockAppServer({
    model: "local-model",
    configureModelProfileCredential: async (config) => {
      received = config;
      return {
        id: config.profileId,
        displayName: "remote model",
        providerType: "groq",
        model: "vendor/model",
        serviceUrl: "https://example.invalid/v1",
        health: { ok: true, detail: "available" },
      };
    },
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/api/model-profiles/credential`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
      body: JSON.stringify({ profileId: "groq-qwen3.8-27b", apiKey: "secret-runtime-key" }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(received, { profileId: "groq-qwen3.8-27b", apiKey: "secret-runtime-key" });
    const text = await response.text();
    assert.equal(text.includes("secret-runtime-key"), false);
  } finally {
    server.close();
  }
});

test("web app exposes translation health and proxies translation without exposing backend credentials", async () => {
  const received: unknown[] = [];
  const server = createStatblockAppServer({
    model: "local-model",
    translationProvider: {
      id: "deepl",
      displayName: "DeepL API",
      providerType: "deepl",
      async healthCheck() {
        return { ok: true, detail: "DeepL EN→UK is available through the backend." };
      },
      async translate(request) {
        received.push(request);
        return { texts: request.texts.map((text) => `UK:${text}`), elapsedMs: 7 };
      },
    },
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${baseUrl}/api/translation/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      provider: { id: "deepl", displayName: "DeepL API", providerType: "deepl" },
      health: { ok: true, detail: "DeepL EN→UK is available through the backend." },
    });

    const translated = await fetch(`${baseUrl}/api/translation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
      body: JSON.stringify({ sourceLanguage: "en", targetLanguage: "uk", texts: ["hello", "world"] }),
    });
    assert.equal(translated.status, 200);
    assert.deepEqual(await translated.json(), { texts: ["UK:hello", "UK:world"], elapsedMs: 7 });
    assert.deepEqual(received, [{ sourceLanguage: "en", targetLanguage: "uk", texts: ["hello", "world"] }]);
  } finally {
    server.close();
  }
});

test("web app reports translation provider as unconfigured instead of accepting browser API keys", async () => {
  const server = createStatblockAppServer({ model: "local-model" });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${baseUrl}/api/translation/health`);
    assert.equal(health.status, 200);
    const value = (await health.json()) as { provider: unknown; health: { ok: boolean; detail?: string } };
    assert.equal(value.provider, null);
    assert.equal(value.health.ok, false);
    assert.match(value.health.detail ?? "", /Choose an available translation service/u);

    const translated = await fetch(`${baseUrl}/api/translation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
      body: JSON.stringify({ sourceLanguage: "en", targetLanguage: "uk", texts: ["hello"] }),
    });
    assert.equal(translated.status, 503);
  } finally {
    server.close();
  }
});

test("web app sanitizes translation provider failures", async () => {
  const server = createStatblockAppServer({
    model: "local-model",
    translationProvider: {
      id: "translation-test",
      displayName: "Translation test",
      providerType: "libretranslate",
      async healthCheck() {
        throw new Error("secret upstream health response");
      },
      async translate() {
        throw new Error("secret upstream translation response");
      },
    },
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${baseUrl}/api/translation/health`);
    assert.equal(health.status, 502);
    assert.deepEqual(await health.json(), { error: "The translation provider could not complete the request." });

    const translated = await fetch(`${baseUrl}/api/translation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Statblock-Client": "statblock-parser" },
      body: JSON.stringify({ sourceLanguage: "en", targetLanguage: "uk", texts: ["hello"] }),
    });
    assert.equal(translated.status, 502);
    const text = await translated.text();
    assert.equal(text.includes("secret upstream"), false);
    assert.match(text, /translation provider could not complete/u);
  } finally {
    server.close();
  }
});

test("local API rejects foreign browser origins and requires the mutation header", async () => {
  let configureCalls = 0;
  const server = createStatblockAppServer({
    model: "local-model",
    security: { allowedOrigins: ["http://trusted.frontend.test"] },
    configureCustomModelProfile: async () => {
      configureCalls += 1;
      return {
        id: "custom",
        displayName: "custom",
        providerType: "openai-compatible",
        model: "capture",
        health: { ok: true },
      };
    },
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const endpoint = `${baseUrl}/api/model-profiles/custom`;
    const body = JSON.stringify({ baseUrl: "https://attacker.example/v1", model: "capture" });

    const foreignHealth = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://attacker.example" },
    });
    assert.equal(foreignHealth.status, 403);
    assert.equal(foreignHealth.headers.get("access-control-allow-origin"), null);

    const trustedHealth = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://trusted.frontend.test" },
    });
    assert.equal(trustedHealth.status, 200);
    assert.equal(trustedHealth.headers.get("access-control-allow-origin"), "http://trusted.frontend.test");
    assert.deepEqual(await trustedHealth.json(), {
      ok: true,
      model: "local-model",
      activeProfileId: "default",
    });

    const foreign = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
        "X-Statblock-Client": "statblock-parser",
      },
      body,
    });
    assert.equal(foreign.status, 403);
    assert.equal(foreign.headers.get("access-control-allow-origin"), null);

    const missingHeader = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://trusted.frontend.test" },
      body,
    });
    assert.equal(missingHeader.status, 403);

    const trusted = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://trusted.frontend.test",
        "X-Statblock-Client": "statblock-parser",
      },
      body,
    });
    assert.equal(trusted.status, 200);
    assert.equal(trusted.headers.get("access-control-allow-origin"), "http://trusted.frontend.test");
    assert.equal(configureCalls, 1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
