import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { OpenAICompatibleModelProvider } from "./openAICompatibleProvider.js";

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

test("OpenAI-compatible provider sends parser schema and returns provider-neutral metrics", async () => {
  let requestBody: any = null;
  let authorization = "";
  const server = createServer(async (request, response) => {
    authorization = String(request.headers.authorization ?? "");
    if (request.url === "/v1/models") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "example/model" }] }));
      return;
    }
    requestBody = await readJson(request);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        choices: [{ message: { content: '{"starts":[{"s":"C001"}]}' }, finish_reason: "stop" }],
        usage: {
          prompt_tokens: 123,
          completion_tokens: 17,
          prompt_time: 0.12,
          completion_time: 0.34,
          total_time: 0.46,
        },
      }),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  try {
    const address = server.address() as AddressInfo;
    const provider = new OpenAICompatibleModelProvider({
      id: "remote",
      displayName: "Remote model",
      providerType: "groq",
      model: "example/model",
      apiKey: "test-key",
      baseUrl: `http://127.0.0.1:${address.port}/v1/`,
      reasoningEffort: "none",
    });
    const schema = {
      type: "object",
      properties: { starts: { type: "array" } },
      required: ["starts"],
      additionalProperties: false,
    };
    const result = await provider.generateStructured({
      model: "ignored-request-model",
      systemPrompt: "system",
      userPrompt: "user",
      jsonSchema: schema,
      temperature: 0,
      seed: 42,
      numCtx: 16384,
      numPredict: 321,
      timeoutMs: 5000,
    });

    assert.equal(authorization, "Bearer test-key");
    assert.equal(requestBody.model, "example/model");
    assert.deepEqual(requestBody.messages, [
      { role: "system", content: "system" },
      { role: "user", content: "user" },
    ]);
    assert.equal(requestBody.max_completion_tokens, 321);
    assert.equal(requestBody.seed, 42);
    assert.equal(requestBody.reasoning_effort, "none");
    assert.equal("num_ctx" in requestBody, false);
    assert.deepEqual(requestBody.response_format, {
      type: "json_schema",
      json_schema: {
        name: "statblock_parser_response",
        strict: false,
        schema,
      },
    });
    assert.deepEqual(result.parsedContent, { starts: [{ s: "C001" }] });
    assert.equal(result.performance?.promptEvalCount, 123);
    assert.equal(result.performance?.evalCount, 17);
    assert.equal(result.performance?.promptEvalSeconds, 0.12);
    assert.equal(result.performance?.evalSeconds, 0.34);
    assert.equal(result.performance?.totalSeconds, 0.46);

    assert.deepEqual(await provider.healthCheck(), { ok: true, detail: "Model example/model is available." });
  } finally {
    server.close();
  }
});

test("OpenAI-compatible health check verifies the configured model id", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "other/model" }] }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  try {
    const address = server.address() as AddressInfo;
    const provider = new OpenAICompatibleModelProvider({
      id: "remote",
      model: "wanted/model",
      apiKey: "test-key",
      baseUrl: `http://127.0.0.1:${address.port}`,
    });
    const health = await provider.healthCheck();
    assert.equal(health.ok, false);
    assert.equal(health.code, "model_unavailable");
    assert.match(health.detail ?? "", /wanted\/model/u);
  } finally {
    server.close();
  }
});

test("OpenAI-compatible provider retries one rate-limit response when Retry-After is bounded", async () => {
  let calls = 0;
  const server = createServer(async (request, response) => {
    if (request.url === "/models") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "example/model" }] }));
      return;
    }
    await readJson(request);
    calls += 1;
    if (calls === 1) {
      response.writeHead(429, { "Content-Type": "application/json", "Retry-After": "0" });
      response.end(JSON.stringify({ error: { message: "rate limited" } }));
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
      }),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  try {
    const address = server.address() as AddressInfo;
    const provider = new OpenAICompatibleModelProvider({
      id: "remote",
      model: "example/model",
      apiKey: "test-key",
      baseUrl: `http://127.0.0.1:${address.port}`,
      maxRateLimitRetries: 1,
    });
    await provider.generateStructured({
      model: "ignored",
      systemPrompt: "system",
      userPrompt: "user",
      jsonSchema: { type: "object", properties: {}, additionalProperties: false },
    });
    assert.equal(calls, 2);
  } finally {
    server.close();
  }
});

test("OpenAI-compatible provider omits Authorization for endpoints without a configured API key", async () => {
  let authorization: string | null = "not-called";
  const server = createServer((request, response) => {
    authorization = request.headers.authorization ?? null;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "local/model" }] }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  try {
    const address = server.address() as AddressInfo;
    const provider = new OpenAICompatibleModelProvider({
      id: "custom",
      model: "local/model",
      baseUrl: `http://127.0.0.1:${address.port}`,
    });
    assert.equal((await provider.healthCheck()).ok, true);
    assert.equal(authorization, null);
  } finally {
    server.close();
  }
});

test("OpenAI-compatible provider can cap BODY completions without capping Header completions", async () => {
  const bodies: any[] = [];
  const server = createServer(async (request, response) => {
    if (request.url === "/models") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "example/model" }] }));
      return;
    }
    bodies.push(await readJson(request));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  try {
    const address = server.address() as AddressInfo;
    const provider = new OpenAICompatibleModelProvider({
      id: "remote",
      model: "example/model",
      baseUrl: `http://127.0.0.1:${address.port}`,
      bodyCompletionTokenCap: 768,
    });
    const base = {
      model: "ignored",
      systemPrompt: "system",
      userPrompt: "user",
      jsonSchema: { type: "object", properties: {}, additionalProperties: false },
      numPredict: 2400,
    } as const;
    await provider.generateStructured({ ...base, task: "body" });
    await provider.generateStructured({ ...base, task: "header" });
    assert.equal(bodies[0]?.max_completion_tokens, 768);
    assert.equal(bodies[1]?.max_completion_tokens, 2400);
  } finally {
    server.close();
  }
});
