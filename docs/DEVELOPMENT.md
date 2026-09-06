# Development

## Install and run

```bash
npm install
npm run dev:product
```

`dev:product` starts the backend and frontend together and supplies the standard Vite loopback origins to the backend allowlist.

## Verification

Run the complete gate before committing:

```bash
npm test
npm run typecheck
npm run build:frontend
npm run lint
npm run format:check
npm pack --dry-run
```

The test suite has two layers:

- Node tests under `src/*.test.ts` cover parser contracts, providers, HTTP integration, stores, migrations, repositories, and domain logic.
- Vitest/jsdom tests under `frontend/src/*.test.ts(x)` cover App hydration, components, editor presentation, autosave coordination, polling exclusion, IndexedDB, and transfer flows.

## Adding behavior

1. Preserve raw source and ownership invariants.
2. Add a regression that fails without the change.
3. Keep provider/network behavior behind interfaces.
4. Validate persisted or imported data before it reaches UI state.
5. Update current docs, not historical patch notes.

## Translation glossary generation

```bash
python scripts/buildTranslationGlossary.py path/to/glossary.xlsx
```

Use `--output` only when generating outside the default `src/translationGlossaryData.ts` target.

## Documentation policy

- `README.md` and top-level files in `docs/` are current.
- `docs/history/patches/` records old changes.
- `docs/history/notes/` contains superseded architecture, audits, and checklists.
- `docs/history/validation/` contains old command output.

Historical documents are retained for investigation but must not be cited as the current contract.

For the release smoke test, follow [Manual testing](MANUAL_TESTING.md).
