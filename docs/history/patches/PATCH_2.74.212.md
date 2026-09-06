# Patch 2.74.212 — backend DeepL translation provider + MT safety closure

## Scope

This patch begins the translation-MVP closure. Parser routing, Header/BODY ownership, multiline/mixed/singleline parsing and product compilation are unchanged.

The existing translation architecture remains authoritative:

`English EditableStatblockDocument -> deterministic D&D localization/mechanics protection -> MT only for unresolved BODY prose -> deterministic restoration/validation -> fragment-local fallback -> Ukrainian EditableStatblockDocument`

## DeepL is now a backend provider

Added `DeepLTranslationProvider`.

- Authentication is read only by the Node backend from `DEEPL_API_KEY`.
- The API key is sent to DeepL only in the `Authorization: DeepL-Auth-Key ...` request header.
- The browser never receives or persists the DeepL key.
- Legacy API Free keys ending in `:fx` automatically use `https://api-free.deepl.com`; other keys use `https://api.deepl.com`.
- `DEEPL_API_BASE_URL` may override the endpoint for diagnostics or future account-specific routing.
- Health checks use `GET /v2/languages?type=target` and require Ukrainian (`UK`).
- Translation uses one batched `POST /v2/translate` request for the document's unresolved non-empty fragments and preserves response order.

The backend now exposes only credential-free proxy endpoints:

- `GET /api/translation/health`
- `POST /api/translation`

If `DEEPL_API_KEY` is absent, health returns a clear unconfigured state and translation returns HTTP 503. The API key is never accepted from the translation browser UI.

## Frontend provider choice

The translation settings are now honest about the two supported paths:

1. `DeepL API (ключ на backend-і)` — default.
2. `Локальний LibreTranslate` — offline/local fallback with configurable LibreTranslate URL.

Persisted settings now carry `translationProviderType: "deepl" | "libretranslate"`. Older settings are migrated to the DeepL backend choice while retaining the stored LibreTranslate URL for fallback use.

## Deterministic-island safety

The MT adapter already required every `KEEP_*` token to survive exactly once. It now additionally requires the complete token sequence to remain in original source order before restoration.

Therefore an MT provider that reorders deterministic Ukrainian islands cannot silently reorder source-owned deterministic text. That fragment falls back to the deterministic version instead.

Mechanic validation remains unchanged and authoritative after MT restoration.

## Deliberately unchanged

- No MT is applied to structured Header semantics.
- No MT is allowed to re-parse or restructure BODY nodes.
- No new regex rules were added to translate arbitrary prose.
- Existing deterministic glossary/rules remain authoritative.
- Existing LibreTranslate provider remains available.
- Parser behavior is unchanged from 2.74.211.

## Backend key setup on Windows PowerShell

For the terminal that launches the backend:

```powershell
$env:DEEPL_API_KEY="YOUR_DEEPL_KEY"
npm run app
```

The variable exists only for that PowerShell process and child processes. For a persistent user-level variable:

```powershell
[Environment]::SetEnvironmentVariable("DEEPL_API_KEY", "YOUR_DEEPL_KEY", "User")
```

Then close and reopen the terminal before starting the backend.

Do not put the key in frontend code, a `VITE_*` variable, committed source, or browser settings.

## Validation

Static/core and frontend validation plus the full compiled test suite are recorded in `VALIDATION_2.74.212.txt`.
