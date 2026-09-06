import test from "node:test";
import assert from "node:assert/strict";

import { HttpParserBackendApi } from "./parserBackendClient.js";

test("parser backend client marks credential mutations as trusted local-client requests", async () => {
  const originalFetch = globalThis.fetch;
  let requestHeaders = new Headers();
  globalThis.fetch = async (_input, init) => {
    requestHeaders = new Headers(init?.headers);
    return Response.json({
      profile: {
        id: "custom",
        displayName: "Custom",
        providerType: "openai-compatible",
        model: "vendor/model",
        health: { ok: true },
      },
    });
  };
  try {
    const client = new HttpParserBackendApi("http://127.0.0.1:3030/");
    await client.configureCustomModelProfile({ baseUrl: "https://provider.example/v1", model: "vendor/model" });
    assert.equal(requestHeaders.get("X-Statblock-Client"), "statblock-parser");
    assert.equal(requestHeaders.get("Content-Type"), "application/json");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parser backend client rejects malformed profile payloads", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ profiles: [{ id: 42 }] });
  try {
    const client = new HttpParserBackendApi("http://127.0.0.1:3030");
    assert.deepEqual(await client.listModelProfiles(), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
