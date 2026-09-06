# Patch 2.73 — Translation provider boundary + LibreTranslate connectivity

Parser behavior remains frozen at 2.72.

## Added

- `TranslationProvider` as a narrow MT-specific abstraction, independent from structured parser `ModelProvider`.
- `NoopTranslationProvider` for fallback/tests.
- `LibreTranslateProvider` with:
  - configurable base URL;
  - EN→UK health check through `/languages`;
  - `/translate` requests;
  - optional API key support for future hosted instances;
  - request timeout and explicit malformed-response errors.
- `translationProviderUrl` in application settings, defaulting to `http://localhost:5000`.
- Settings UI field `LibreTranslate URL` and a separate translator connectivity check.
- migration of old IndexedDB settings that do not yet contain a translation URL.

## Deliberately not added yet

- MT is not yet inserted into the document translation pipeline.
- Existing deterministic glossary/TM/rules behavior is unchanged.
- No parser code or parser routing behavior was changed.

This patch establishes the provider/configuration boundary before unresolved-prose MT is enabled.
