import assert from "node:assert/strict";
import test from "node:test";

import { createConfiguredModelProviders } from "./configuredModelProviders.js";

test("configured providers always expose local and Groq benchmark catalog", () => {
  const configured = createConfiguredModelProviders({ OLLAMA_MODEL: "qwen3:8b" });
  assert.equal(configured.defaultProfileId, "default");
  assert.deepEqual(
    configured.providers.map((provider) => [provider.id, provider.providerType, provider.model]),
    [
      ["default", "ollama", "qwen3:8b"],
      ["groq-qwen3.8-27b", "groq", "qwen/qwen3.8-27b"],
      ["groq-gpt-oss-20b", "groq", "openai/gpt-oss-20b"],
      ["groq-gpt-oss-120b", "groq", "openai/gpt-oss-120b"],
    ],
  );
  assert.equal(configured.providers[0]?.serviceUrl, "http://localhost:11434/api/chat");
  assert.equal(configured.providers[1]?.serviceUrl, "https://api.groq.com/openai/v1");
});

test("configured providers keep the same catalog when a Groq key is supplied", () => {
  const configured = createConfiguredModelProviders({
    OLLAMA_MODEL: "qwen3:8b",
    GROQ_API_KEY: "secret-test-key",
  });
  assert.deepEqual(
    configured.providers.map((provider) => provider.id),
    ["default", "groq-qwen3.8-27b", "groq-gpt-oss-20b", "groq-gpt-oss-120b"],
  );
});
