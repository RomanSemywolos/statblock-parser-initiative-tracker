# Patch 2.74.149 — model-provider health and visible API failures

This patch finishes the operational side of the multi-model switch introduced in 2.74.148. It does not change parser prompts, candidate lattices, Header/BODY ownership, routing, or the number of model calls.

## Provider health is now real

`ModelProviderRegistry.checkProfiles()` asks every configured provider for health and returns only public profile metadata plus a provider-neutral health object.

`GET /api/model-profiles/health` exposes that health to the frontend. The normal profile list remains unchanged.

For OpenAI-compatible providers the health check now:

- performs the authenticated `/models` request;
- distinguishes rejected credentials, rate limiting, HTTP errors, and network errors;
- verifies that the exact configured model ID is actually present in the provider's `/models` response.

A valid API key therefore no longer makes a removed or inaccessible model look healthy.

## Frontend behaviour

The existing “Перевірити backend” action now checks both backend health and every parser model profile.

The model selector marks checked profiles as `доступна` / `недоступна`. Unavailable profiles are disabled after a health check. A failed remote profile does not incorrectly mark the local backend itself as offline.

For unavailable profiles the settings UI shows a user-facing explanation for:

- rejected/unauthorized API key;
- API rate limit;
- configured model missing from provider;
- provider/network failure;
- other HTTP failures.

The technical provider response is appended when available. No API key is returned to the browser.

Runtime parse failures also use clearer provider error messages, so a failed job reports e.g. credential, rate-limit, or HTTP failure instead of a generic request failure.

## Bounded 429 retry

The OpenAI-compatible transport now retries one HTTP 429 response only when the server supplied `Retry-After` and the requested wait is at most 60 seconds. The retry count and maximum wait are hard bounded (`maxRateLimitRetries`, `maxRetryAfterSeconds`).

This deliberately does not retry arbitrary failures and does not loop forever. A request that is intrinsically too large for a provider quota still fails visibly after the bounded retry path.

## Structured output

`strict: false` remains unchanged. This patch does not alter the parser's JSON contracts merely to fit one provider's strict-schema subset; deterministic validation remains the common post-model authority.

## Validation

- Root TypeScript typecheck: pass.
- Compiled Node test suite: **552/552 passed**.
- Added coverage for exact model-ID health validation, registry-wide health, health HTTP endpoint, and bounded 429 retry.
- Frontend TypeScript check reaches the same pre-existing unrelated `StatblockViews.tsx` `proficiency_bonus` error already present in 2.74.148; no new frontend type errors were introduced by this patch.
