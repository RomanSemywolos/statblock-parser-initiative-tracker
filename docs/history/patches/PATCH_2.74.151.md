# Patch 2.74.151 — configurable parser model selector

This patch replaces the effectively preset-only parser-model setting with a combined preset/custom selector while keeping model credentials server-side.

## Changes

- Renamed the settings control from **Профіль моделі парсера** to **Модель парсера**.
- Existing backend profiles remain selectable presets.
- Added **Власна OpenAI-compatible модель…** with:
  - `OpenAI-compatible Base URL`;
  - exact `Model ID`.
- Added `POST /api/model-profiles/custom` for one runtime custom profile (`custom-openai-compatible`).
- Runtime custom profile registration/upsert also creates/replaces its parse-job runner, so selection changes the real provider used by parsing.
- Saved custom configuration is automatically re-registered before a parse, which makes it resilient to backend restarts.
- Custom Base URL and Model ID are persisted locally in app settings; API keys are not.
- Groq custom endpoints use server-side `GROQ_API_KEY`; other compatible endpoints use `OPENAI_COMPATIBLE_API_KEY`; no-auth endpoints are also supported.
- `OpenAICompatibleModelProvider` now omits the Authorization header when no key is configured.
- Existing per-profile health/error UI also applies to the custom profile.
- Added URL/protocol/length validation for custom configuration.

## Architecture

No parser architecture changes. Header/BODY calls, model routing through parse jobs, source ownership, candidate geometry, and deterministic multiline normalization are untouched. This patch changes only model-provider configuration and settings UI.

## Validation

- Core TypeScript typecheck: passed.
- Compiled Node tests: **557/557 passed** (355 + 202 in two serial batches).
- Added tests for runtime registry upsert, custom-profile HTTP registration, persisted custom settings, and no-auth OpenAI-compatible health requests.
- Frontend typecheck reaches only the pre-existing `StatblockViews.tsx` `proficiency_bonus` mismatch; no new frontend type errors from this patch were reported.
