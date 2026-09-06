import assert from "node:assert/strict";
import test from "node:test";

import { LibreTranslateProvider } from "./libreTranslateProvider.js";
import { DeepLTranslationProvider } from "./deeplTranslationProvider.js";
import { HttpBackendTranslationProvider } from "./backendTranslationProvider.js";
import { NoopTranslationProvider } from "./translationProvider.js";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("NoopTranslationProvider preserves fragments exactly", async () => {
  const provider = new NoopTranslationProvider();
  const result = await provider.translate({ sourceLanguage: "en", targetLanguage: "uk", texts: ["Alpha", "", "Beta"] });
  assert.deepEqual(result.texts, ["Alpha", "", "Beta"]);
  assert.equal((await provider.healthCheck()).ok, true);
});

test("LibreTranslateProvider health check requires EN to UK support", async () => {
  const provider = new LibreTranslateProvider({
    baseUrl: " http://localhost:5000/ ",
    fetchImpl: async (input) => {
      assert.equal(String(input), "http://localhost:5000/languages");
      return jsonResponse([
        { code: "en", name: "English", targets: ["uk"] },
        { code: "uk", name: "Ukrainian", targets: ["en"] },
      ]);
    },
  });
  const health = await provider.healthCheck();
  assert.equal(health.ok, true);
});

test("LibreTranslateProvider sends each non-empty fragment to translate API", async () => {
  const requests: unknown[] = [];
  const provider = new LibreTranslateProvider({
    baseUrl: "http://localhost:5000",
    fetchImpl: async (input, init) => {
      assert.equal(String(input), "http://localhost:5000/translate");
      requests.push(JSON.parse(String(init?.body)));
      const body = requests.at(-1) as { q: string };
      return jsonResponse({ translatedText: `UK:${body.q}` });
    },
  });
  const result = await provider.translate({ sourceLanguage: "en", targetLanguage: "uk", texts: ["one", "", "two"] });
  assert.deepEqual(result.texts, ["UK:one", "", "UK:two"]);
  assert.deepEqual(requests, [
    { q: "one", source: "en", target: "uk", format: "text" },
    { q: "two", source: "en", target: "uk", format: "text" },
  ]);
});

test("LibreTranslateProvider reports malformed translation responses", async () => {
  const provider = new LibreTranslateProvider({
    baseUrl: "http://localhost:5000",
    fetchImpl: async () => jsonResponse({ unexpected: true }),
  });
  await assert.rejects(
    provider.translate({ sourceLanguage: "en", targetLanguage: "uk", texts: ["text"] }),
    /invalid translation response/u,
  );
});

test("DeepLTranslationProvider uses backend-only auth header, batches fragments, and preserves empty slots", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const provider = new DeepLTranslationProvider({
    apiKey: "test-key:fx",
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), init });
      if (String(input).includes("/languages")) {
        assert.equal(new Headers(init?.headers).get("Authorization"), "DeepL-Auth-Key test-key:fx");
        return jsonResponse([
          { language: "EN", name: "English" },
          { language: "UK", name: "Ukrainian" },
        ]);
      }
      assert.equal(String(input), "https://api-free.deepl.com/v2/translate");
      assert.equal(new Headers(init?.headers).get("Authorization"), "DeepL-Auth-Key test-key:fx");
      const body = JSON.parse(String(init?.body)) as {
        text: string[];
        source_lang: string;
        target_lang: string;
        preserve_formatting: boolean;
      };
      assert.deepEqual(body, {
        text: ["one", "two"],
        source_lang: "EN",
        target_lang: "UK",
        preserve_formatting: true,
      });
      return jsonResponse({ translations: [{ text: "один" }, { text: "два" }] });
    },
  });
  assert.equal((await provider.healthCheck()).ok, true);
  const result = await provider.translate({ sourceLanguage: "en", targetLanguage: "uk", texts: ["one", "", "two"] });
  assert.deepEqual(result.texts, ["один", "", "два"]);
  assert.equal(requests.length, 2);
});

test("DeepLTranslationProvider uses Pro endpoint for non-Free keys", async () => {
  const provider = new DeepLTranslationProvider({
    apiKey: "paid-key",
    fetchImpl: async (input) => {
      assert.equal(String(input), "https://api.deepl.com/v2/translate");
      return jsonResponse({ translations: [{ text: "текст" }] });
    },
  });
  const result = await provider.translate({ sourceLanguage: "en", targetLanguage: "uk", texts: ["text"] });
  assert.deepEqual(result.texts, ["текст"]);
});

test("HttpBackendTranslationProvider proxies health and translation through parser backend", async () => {
  const provider = new HttpBackendTranslationProvider({
    baseUrl: "http://localhost:3030/",
    fetchImpl: async (input, init) => {
      if (String(input).endsWith("/api/translation/health")) {
        return jsonResponse({ health: { ok: true, detail: "DeepL ready" } });
      }
      assert.equal(String(input), "http://localhost:3030/api/translation");
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init?.headers).get("X-Statblock-Client"), "statblock-parser");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        sourceLanguage: "en",
        targetLanguage: "uk",
        texts: ["hello"],
      });
      return jsonResponse({ texts: ["привіт"], elapsedMs: 12 });
    },
  });
  assert.deepEqual(await provider.healthCheck(), { ok: true, detail: "DeepL ready" });
  assert.deepEqual(await provider.translate({ sourceLanguage: "en", targetLanguage: "uk", texts: ["hello"] }), {
    texts: ["привіт"],
    elapsedMs: 12,
  });
});
