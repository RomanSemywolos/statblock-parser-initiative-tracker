import assert from "node:assert/strict";
import test from "node:test";

import type { ModelProvider, StructuredModelRequest, StructuredModelResult } from "./modelProvider.js";
import { ModelProviderRegistry } from "./modelProviderRegistry.js";

function fakeProvider(id: string, model: string, providerType = "test"): ModelProvider {
  return {
    id,
    displayName: `${id} display`,
    providerType,
    model,
    async generateStructured(_request: StructuredModelRequest): Promise<StructuredModelResult> {
      return { rawContent: "{}", parsedContent: {}, elapsedSeconds: 0 };
    },
    async healthCheck() {
      return { ok: true };
    },
  };
}

test("model provider registry resolves multiple profiles and exposes public metadata only", () => {
  const local = fakeProvider("default", "local-model", "ollama");
  const remote = fakeProvider("remote", "remote-model", "groq");
  const registry = new ModelProviderRegistry([local, remote], "default");

  assert.equal(registry.resolve("default"), local);
  assert.equal(registry.resolve("remote"), remote);
  assert.deepEqual(registry.listProfiles(), [
    { id: "default", displayName: "default display", providerType: "ollama", model: "local-model" },
    { id: "remote", displayName: "remote display", providerType: "groq", model: "remote-model" },
  ]);
  assert.throws(() => registry.resolve("missing"), /Unknown parser model profile/u);
});

test("model provider registry rejects duplicate and missing default profile ids", () => {
  const local = fakeProvider("same", "a");
  const duplicate = fakeProvider("same", "b");
  assert.throws(() => new ModelProviderRegistry([local, duplicate], "same"), /Duplicate model profile id/u);
  assert.throws(() => new ModelProviderRegistry([local], "missing"), /Default model profile is not registered/u);
});

test("model provider registry reports health for every profile", async () => {
  const local = fakeProvider("default", "local-model", "ollama");
  const remote = fakeProvider("remote", "remote-model", "groq");
  remote.healthCheck = async () => ({ ok: false, code: "model_unavailable", detail: "missing" });
  const registry = new ModelProviderRegistry([local, remote], "default");
  assert.deepEqual(await registry.checkProfiles(), [
    {
      id: "default",
      displayName: "default display",
      providerType: "ollama",
      model: "local-model",
      health: { ok: true },
    },
    {
      id: "remote",
      displayName: "remote display",
      providerType: "groq",
      model: "remote-model",
      health: { ok: false, code: "model_unavailable", detail: "missing" },
    },
  ]);
});

test("model provider registry can upsert a runtime custom profile", () => {
  const local = fakeProvider("default", "local-model", "ollama");
  const registry = new ModelProviderRegistry([local], "default");
  const custom = fakeProvider("custom-openai-compatible", "custom/model", "openai-compatible");
  registry.upsert(custom);
  assert.equal(registry.resolve("custom-openai-compatible"), custom);
  assert.equal(
    registry.listProfiles().some((profile) => profile.model === "custom/model"),
    true,
  );

  const replacement = fakeProvider("custom-openai-compatible", "replacement/model", "groq");
  registry.upsert(replacement);
  assert.equal(registry.resolve("custom-openai-compatible"), replacement);
  assert.equal(registry.listProfiles().filter((profile) => profile.id === "custom-openai-compatible").length, 1);
});
