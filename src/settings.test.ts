import assert from "node:assert/strict";
import test from "node:test";

import { createAppSettings, updateAppSettings } from "./settings.js";
import { MemorySettingsRepository } from "./settingsRepository.js";

test("settings normalize backend URL and update independently", () => {
  const initial = createAppSettings({
    backendUrl: " http://localhost:3030/ ",
    now: "2026-08-27T10:00:00.000Z",
  });
  assert.equal(initial.backendUrl, "http://localhost:3030");
  assert.equal(initial.activeParserModelProfileId, null);
  assert.equal(initial.translationProviderType, "deepl");
  assert.equal(initial.translationProviderUrl, "http://localhost:5000");
  assert.equal(initial.defaultStatblockLanguage, "en");

  const updated = updateAppSettings(initial, { activeParserModelProfileId: "local-qwen" }, "2026-08-27T11:00:00.000Z");
  assert.equal(updated.backendUrl, initial.backendUrl);
  assert.equal(updated.activeParserModelProfileId, "local-qwen");
  assert.equal(updated.translationProviderType, "deepl");
  assert.equal(updated.translationProviderUrl, initial.translationProviderUrl);
  assert.equal(updated.defaultStatblockLanguage, "en");
  assert.equal(updated.updatedAt, "2026-08-27T11:00:00.000Z");
  const localized = updateAppSettings(
    updated,
    {
      defaultStatblockLanguage: "uk",
      translationProviderType: "libretranslate",
      translationProviderUrl: " http://localhost:5000/ ",
    },
    "2026-08-27T12:00:00.000Z",
  );
  assert.equal(localized.defaultStatblockLanguage, "uk");
  assert.equal(localized.translationProviderType, "libretranslate");
  assert.equal(localized.translationProviderUrl, "http://localhost:5000");

  const legacy = { ...updated, parserMode: "singleline" } as typeof updated & { parserMode: string };
  const cleaned = updateAppSettings(legacy, {}, "2026-08-27T13:00:00.000Z");
  assert.equal("parserMode" in cleaned, false);
});

test("MemorySettingsRepository uses copy-in/copy-out semantics", async () => {
  const repository = new MemorySettingsRepository();
  const value = createAppSettings({ backendUrl: "http://localhost:3030" });
  await repository.put(value);
  const first = await repository.get();
  assert.ok(first);
  first.backendUrl = "http://mutated.invalid";
  assert.equal((await repository.get())?.backendUrl, "http://localhost:3030");
  await repository.clear();
  assert.equal(await repository.get(), undefined);
});

test("settings persist custom parser model connection without secrets", () => {
  const initial = createAppSettings({
    backendUrl: "http://localhost:3030",
    customParserModel: { baseUrl: "https://api.groq.com/openai/v1", model: "qwen/qwen3.8-27b" },
  });
  assert.deepEqual(initial.customParserModel, {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "qwen/qwen3.8-27b",
  });
  const updated = updateAppSettings(initial, {
    activeParserModelProfileId: "custom-openai-compatible",
    customParserModel: { baseUrl: "http://localhost:1234/v1", model: "local/custom" },
  });
  assert.equal(updated.activeParserModelProfileId, "custom-openai-compatible");
  assert.deepEqual(updated.customParserModel, { baseUrl: "http://localhost:1234/v1", model: "local/custom" });
});
