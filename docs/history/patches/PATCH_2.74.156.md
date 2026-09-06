# Patch 2.74.156 — linguistic-model selector and runtime API credentials

This patch completes the settings UX around linguistic models without changing parser semantics.

## Linguistic model selector

- The selector is now a model catalog rather than a custom-profile editor.
- The local Ollama profile and the three Groq benchmark profiles are registered and listed even when no Groq API key is present.
- A stable placeholder reads `Обрати лінгвістичну модель`.
- `Обрати іншу модель…` enters custom-model editing.
- A previously saved custom model appears as its own `Власна модель — <model>` choice.
- The obsolete `Змінити власну модель` button was removed.

## Provider details

For a predefined model, service URL and model ID are read-only values supplied by the backend registry. For `Обрати іншу модель…`, those same positions become editable URL and model-ID fields. After saving, the custom configuration returns to read-only presentation.

## API keys

Remote models expose a separate password field for an API key. The key is never stored in AppSettings, IndexedDB, or localStorage and is never returned by the backend API. It is kept only in backend process memory for the current run. Environment keys remain supported; a blank UI field means the backend may use its environment credential. A runtime key must be re-entered after a full backend restart unless an environment key is configured.

Groq benchmark profiles can therefore be selected before credentials exist; health checking reports authorization failure until a valid key is supplied.

## Layout

The default statblock-language control now aligns to the top of its grid cell instead of stretching vertically. Translation-provider layout remains unchanged.

## Validation

- Core TypeScript typecheck: passed.
- Frontend TypeScript typecheck: passed.
- Compiled Node test suite: 558/558 passed.
