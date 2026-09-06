# Lossless Statblock Parser

A local-first D&D statblock parser, editor, library, translator, and encounter tracker. It preserves the original source, delegates bounded structural decisions to a language model, and verifies source ownership deterministically before producing editable cards.

> Current release: **2.74.219**. Historical patch notes and validation logs are archived under [`docs/history`](docs/history/README.md); they are evidence, not current documentation.

## Highlights

- Lossless parsing for multiline, mixed, and collapsed single-line statblocks.
- Exact Header/BODY source ownership with deterministic validation.
- React editor with autosave, explicit save points, and immutable parser/translation backups.
- Local IndexedDB library with JSON import/export.
- English-to-Ukrainian translation through a backend-held DeepL key or LibreTranslate.
- Encounter tracker with per-combatant HP, initiative, overrides, dice rolls, and persistent limited-use counters such as `(3/Day = 2)`.
- Responsive sticky sidebars and mobile overlay drawers.
- Local API protection against cross-origin browser access and credential reuse across custom endpoints.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- A parser provider: local Ollama, Groq, or an OpenAI-compatible endpoint
- Optional DeepL API access for translation

## Quick start

```bash
npm install
npm run dev:product
```

This starts the backend at `http://127.0.0.1:3030` and the Vite frontend at `http://localhost:5173`.

For the backend-only diagnostic UI:

```bash
npm run app
```

## Configuration

Environment variables are read only by the backend.

| Variable                         | Purpose                                             | Default                                |
| -------------------------------- | --------------------------------------------------- | -------------------------------------- |
| `STATBLOCK_APP_HOST`             | Backend bind address                                | `127.0.0.1`                            |
| `STATBLOCK_APP_PORT`             | Backend port                                        | `3030`                                 |
| `STATBLOCK_ALLOWED_ORIGINS`      | Comma-separated additional browser origins          | none                                   |
| `STATBLOCK_JOB_STORE`            | Parse-job JSON path                                 | `.statblock-parser/parse-jobs.json`    |
| `STATBLOCK_REPORT_PATH`          | Diagnostic-report JSON path                         | `.statblock-parser/parse-reports.json` |
| `OLLAMA_MODEL`                   | Local parser model                                  | `qwen3:8b`                             |
| `GROQ_API_KEY`                   | Groq credential                                     | unset                                  |
| `GROQ_BASE_URL`                  | Groq-compatible endpoint                            | Groq API                               |
| `OPENAI_COMPATIBLE_API_BASE_URL` | Trusted endpoint allowed to use the environment key | unset                                  |
| `OPENAI_COMPATIBLE_API_KEY`      | Key for that exact trusted endpoint                 | unset                                  |
| `DEEPL_API_KEY`                  | Backend-only DeepL credential                       | unset                                  |
| `DEEPL_API_BASE_URL`             | Optional DeepL-compatible base URL                  | DeepL API                              |

A custom-model key entered in the UI is retained only in backend memory and scoped to the exact configured base URL. It is never returned to the browser or reused for another endpoint.

## Commands

```bash
npm test
npm run typecheck
npm run build
npm run build:frontend
npm run lint
npm run format:check
npm pack --dry-run
```

## Parser architecture

The active parser contract is:

1. The Header model selects bounded source coordinates for the closed Header schema.
2. Deterministic code validates text, values, mechanics, ranges, and ownership.
3. BODY is the exact complement of accepted Header ownership.
4. Mixed and single-line BODY may use one starts-only call to restore multiline-equivalent geometry.
5. One deterministic multiline BODY parser owns downstream semantics.

The active single-line Header contract is the **2.74.208 behavior**: complete scalar coordinate spans plus six semantic ability-label anchors; deterministic code closes and verifies the exact ability region. The removed free-text `quoteAnchor` reconciliation layer is not part of the current pipeline.

See [Architecture](docs/ARCHITECTURE.md) for ownership, persistence, and encounter details.

## Data and backups

- Library, settings, and encounter state are stored locally in IndexedDB.
- Parse jobs and diagnostic reports are stored by the backend in JSON files.
- A manual save updates the explicit saved checkpoint.
- “Load backup” restores the original parser result; for Ukrainian it restores the most recent machine translation result.
- A backup baseline changes only after reparsing or retranslating, never after manual or automatic edits.
- Library JSON export/import is the supported portable backup mechanism.

## Security

API responses never use `Access-Control-Allow-Origin: *`; browser origins must be same-origin loopback or explicitly listed. State-changing requests require `X-Statblock-Client: statblock-parser`, forcing a protected CORS preflight for cross-origin callers.

Binding to `0.0.0.0` exposes the service to the local network. Do that only intentionally and configure `STATBLOCK_ALLOWED_ORIGINS` narrowly. `clientId` separates browser job queues but is not authentication.

See [Security](docs/SECURITY.md) for the full threat model.

## Project layout

```text
src/                 parser core, mode-specific pipeline stages, providers, persistence, HTTP backend
frontend/src/        React shell, domain hooks, UI components, and frontend tests
scripts/             development and reproducible generation scripts
docs/                current architecture, development, and security docs
docs/history/        archived patch notes, audits, and validation logs
.github/workflows/   continuous integration
```

## Development

Current instructions, test layers, and release checks are in [Development](docs/DEVELOPMENT.md). Treat files under `docs/history/` as historical context rather than current contracts.

## License

[ISC](LICENSE)
