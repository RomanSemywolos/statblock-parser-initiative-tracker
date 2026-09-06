import test from "node:test";
import assert from "node:assert/strict";

import { RuntimeCredentialStore, credentialForConfiguredEndpoint } from "./runtimeCredentialStore.js";

test("runtime custom credentials are reused only for the exact provider endpoint", () => {
  const store = new RuntimeCredentialStore();
  store.remember("https://trusted.example/v1/", "secret-key");

  assert.equal(store.get("https://trusted.example/v1"), "secret-key");
  assert.equal(store.get("https://attacker.example/v1"), undefined);
  assert.equal(store.get("https://trusted.example/credential-capture"), undefined);
});

test("environment credentials require a matching explicitly configured endpoint", () => {
  assert.equal(
    credentialForConfiguredEndpoint("https://trusted.example/v1", "https://trusted.example/v1/", "environment-secret"),
    "environment-secret",
  );
  assert.equal(
    credentialForConfiguredEndpoint("https://attacker.example/v1", "https://trusted.example/v1", "environment-secret"),
    undefined,
  );
  assert.equal(
    credentialForConfiguredEndpoint("https://trusted.example/v1", undefined, "environment-secret"),
    undefined,
  );
});
