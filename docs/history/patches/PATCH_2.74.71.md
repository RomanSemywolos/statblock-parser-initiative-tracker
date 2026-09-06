# 2.74.71 — restore header/body ownership boundaries

This patch corrects the architectural regression introduced by 2.74.69/2.74.70.

- Header boundary discovery is a separate tiny LLM decision. It receives a bounded starting excerpt and returns only `bodyStart`.
- Shared semantic header parsing runs only on the already-cut header prefix.
- Header coordinates are mode-independent but source-shape-aware; physically multiline sources are no longer exploded through the single-line candidate lattice.
- Parser routing runs on the body only, after the header boundary is known. Header formatting therefore cannot force a multiline body into mixed/generic mode.
- Multiline body parsing is deterministic again and does not make a body structural LLM request.
- Soft-wrapped continuation rows no longer make an otherwise physical multiline body mixed by themselves. Mixed routing still requires genuinely collapsed peer structures.
- Generic/singleline body requests use a dedicated short body-only prompt instead of embedding the old full-statblock prompt.
- Parse diagnostics exports the actual body `parserRouting` decision.
- Regression tests were updated around boundary -> header semantics -> body-only routing and mode-independent localized header parsing.
