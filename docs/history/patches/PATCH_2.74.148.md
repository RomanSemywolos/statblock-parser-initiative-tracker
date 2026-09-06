# Patch 2.74.148 — real parser model profile switching

## Scope

This patch finishes the model-profile infrastructure without changing the parser prompts, Header/BODY architecture, or number of model calls per parse.

## Changes

- Added `OpenAICompatibleModelProvider` for server-side Chat Completions providers with JSON Schema structured output.
- Added `ModelProviderRegistry`; profile IDs now resolve to distinct provider-backed parse runners.
- `GET /api/model-profiles` now exposes all configured profiles instead of a hard-coded Ollama-only row.
- The existing frontend selector now controls the provider that actually executes a submitted parse job.
- Local Ollama remains the `default` profile for backward compatibility with stored settings/jobs.
- When `GROQ_API_KEY` is present, the backend registers:
  - `groq-qwen3.8-27b` → `qwen/qwen3.8-27b`
  - `groq-gpt-oss-20b` → `openai/gpt-oss-20b`
  - `groq-gpt-oss-120b` → `openai/gpt-oss-120b`
- Groq/OpenAI-compatible transport maps the existing parser request to `messages`, `response_format.json_schema`, `temperature`, `seed`, and `max_completion_tokens`. Ollama-only `numCtx` is intentionally not forwarded.
- Provider-neutral timing/token metrics are populated from OpenAI-compatible `usage` fields when available.
- API keys remain backend-only and are never included in profile discovery or diagnostics.

## Regression found while running the full suite

The 2.74.147 title-case mixed hard-geometry safeguard was too broad: it could treat a one-word visual wrap such as `Flying` as a standalone heading and could split a tabular header such as `Mod\tSave` away from its table. 2.74.148 narrows that safeguard to multi-word title-case physical rows and excludes tabular rows. This preserves the requested `Legendary Actions` protection without those regressions.

## Validation

- Root TypeScript typecheck: passed.
- Full compiled Node test suite: **549/549 passed**.
- Added tests for OpenAI-compatible request/response mapping, provider registry behavior, conditional Groq profile registration, HTTP profile discovery, and parse-job execution through the selected profile.
- Real Groq inference was not executed because no user API key was available in the build environment; the transport was integration-tested against a local HTTP mock.
