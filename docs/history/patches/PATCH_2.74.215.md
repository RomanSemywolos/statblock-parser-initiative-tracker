# Patch 2.74.215 — sidebar scrolling and user-facing messages

## Scope

This patch changes browser layout, scrollbar presentation and user-visible service messages. Parser behavior and persisted product data are unchanged.

## Sidebar behavior

- The left sidebar begins with `Бібліотека` and its usage hint; both scroll away with the content.
- The library import button follows that introduction and sticks to the top edge once reached.
- The right `Encounter` introduction, hint and participant form likewise scroll away.
- The encounter status and combat actions stick to the top edge once reached.
- Automatic current-turn scrolling targets the whole right sidebar and reserves space for the sticky combat controls.
- Firefox and Chromium/WebKit sidebar scrollbars use a narrower neutral thumb with hover feedback.
- The obsolete internal milestone label `M13` is no longer rendered.

## User messages

- Settings describe only the choices the user needs to make, without environment-variable or backend-storage notes.
- Import connection failures direct the user to connection settings instead of exposing `Failed to fetch` or a development command.
- Model errors distinguish unavailable models, rejected access keys, request limits and connection failures.
- Translation checks and translation results use localized DeepL/LibreTranslate messages instead of raw provider responses, HTTP details or deterministic-pipeline terminology.
- Failed parse jobs pass through the same user-facing error mapping.

## Validation

- TypeScript strict typecheck.
- Core build and complete compiled Node test suite.
- Frontend TypeScript and Vite production build.
