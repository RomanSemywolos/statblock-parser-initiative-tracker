# Patch 2.74.217 — security, persistence ordering, coverage, and repository hygiene

This release resolves prioritized audit items 1, 2, 3, 4, 5, and 7. Large-file decomposition and the separate minor-issues list are intentionally deferred.

## Security

- Replaced wildcard CORS with exact same-loopback/allowlisted origins.
- Added a required custom header for API mutations.
- Scoped runtime custom-provider credentials to the exact normalized endpoint.
- Restricted environment OpenAI-compatible credentials to an explicitly configured matching base URL.

## Concurrency

- Immediate statblock and encounter writes serialize after in-flight autosaves.
- Parse-job synchronization is single-flight and cannot overlap interval cycles.

## Tests

- Added Vitest/jsdom coverage for App hydration, components, editor presentation, autosave, job polling, IndexedDB, and library transfer.
- Added backend client, security integration, runtime credential, translation proxy, and JSON job-store regressions.

## Documentation and tooling

- Replaced the stale root README with current GitHub-facing documentation.
- Moved old patch notes, audits, architecture experiments, and validation logs under `docs/history/`.
- Added GitHub Actions, ESLint, Prettier, ISC LICENSE, engines/author/repository metadata, and an npm package allowlist.
- Replaced absolute glossary-generator paths with portable CLI arguments.
