# Patch 2.74.152 — user-facing model settings + clearer provider status

This patch is intentionally UI/configuration-facing. Parser semantics, candidate generation, prompts, deterministic validators, and model-call counts are unchanged from 2.74.151.

## Settings UI

- Renamed the parser-provider selector to **Лінгвістична модель**. Parser mode remains a separate import-time choice (`auto` / multiline / singleline / generic).
- Removed `Backend URL` from the normal settings UI. The application keeps using the persisted/default backend URL internally.
- Replaced the always-visible translation URL with **Модель для перекладу**:
  - `Локальний перекладач (LibreTranslate)`
  - `Обрати свій перекладач…`
- Technical service fields are now shown only after choosing a custom provider:
  - custom linguistic model: `Адреса сервісу моделі` + `Назва / ID моделі`;
  - custom translator: `Адреса сервісу перекладу`.
- Import UI no longer exposes the backend URL. It shows only whether the parsing system is connected and links to `Налаштування моделей`.

## Provider status UX

- Backend health and model health are no longer compressed into messages such as `qwen3:8b · моделі 1/2`.
- The status line now reports the selected linguistic model specifically.
- Only the selected model's provider error is surfaced prominently; unrelated unavailable profiles no longer flood the settings panel.
- Raw provider responses are collapsed under `Технічні деталі`.
- Groq 401/403 errors explicitly tell the user to verify `GROQ_API_KEY` in the backend environment and restart the backend.
- Generic OpenAI-compatible errors no longer incorrectly instruct every provider user to check `GROQ_API_KEY`.

## Groq 401 diagnosis

For a custom URL under `api.groq.com`, 2.74.151/152 already select `GROQ_API_KEY` server-side. Therefore an HTTP 401 from Groq means the running backend sent a credential Groq rejected. Typical causes are an incorrect/revoked key or setting the environment variable after the backend process had already started. Restart `npm run dev:product` after setting the key.

## Validation

- Core TypeScript typecheck: passed.
- Compiled Node test suite: 557/557 passed.
- Frontend typecheck with local package path mapping reaches only the pre-existing unrelated `StatblockViews.tsx` `proficiency_bonus` evidence-map error; no new errors originate from this patch.
