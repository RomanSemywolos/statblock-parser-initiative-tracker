# M12 — Settings and backend connection infrastructure

M12 adds persistent browser settings without moving user library data to the backend.

## Product boundary

`AppSettings` stores:

- `backendUrl`
- `activeParserModelProfileId`
- `updatedAt`

Settings are accessed through `SettingsRepository`. The browser implementation uses a separate
`statblock-parser-settings` IndexedDB database so the existing v1 library/encounter database is not
silently version-bumped by this milestone.

## Backend connection

`HttpParserBackendApi` is a small product-safe client for:

- `GET /health`
- `GET /api/model-profiles`

The backend now exposes a real model-provider registry. The local Ollama model remains the `default`
profile, and additional providers can register independent profile IDs. Parse jobs persist the selected
`modelProfileId`, and the worker resolves the corresponding provider/runner at execution time. The
frontend selector therefore changes the model that actually executes the parse rather than only storing
a display preference.

When `GROQ_API_KEY` is present at backend startup, three OpenAI-compatible Groq benchmark profiles are
registered in addition to local Ollama: `groq-qwen3.8-27b`, `groq-gpt-oss-20b`, and
`groq-gpt-oss-120b`. API keys remain server-side and are never returned by `/api/model-profiles`.

JSON API responses include permissive CORS headers for LAN/browser development, and OPTIONS preflight
is supported.

## Frontend

The Library header has a Settings panel with:

- configurable Backend URL;
- connection check;
- parser model profile display/selection;
- local persistence.

The default backend URL uses the frontend page hostname on port 3030. Therefore a phone opening the
frontend from `192.168.x.x` naturally defaults to the same PC instead of `localhost`.

No parser pipeline, statblock document, encounter behavior, or library storage semantics are changed.


## Runtime custom OpenAI-compatible profile (2.74.151)

The frontend model setting is no longer limited to statically configured presets. It may request one runtime custom profile (`custom-openai-compatible`) using only a `baseUrl` and exact `model` identifier. `POST /api/model-profiles/custom` validates those public connection parameters and asks the backend to construct/upsert the provider and its parse-job runner. The profile then appears through the same registry/list/health path as presets.

Secrets remain backend-owned. A Groq hostname uses `GROQ_API_KEY`; other OpenAI-compatible endpoints use `OPENAI_COMPATIBLE_API_KEY` when configured. Empty credentials are permitted for local/no-auth compatible endpoints. The frontend never sends, persists, or receives those secrets. The custom profile is intentionally singular and replaceable rather than creating an unbounded registry from UI input.
