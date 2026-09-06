# 2.74.69

Universal header boundary and ownership refactor.

- Replaces the multiline-only deterministic header boundary with one universal LLM header scan for multiline, mixed/generic, and single-line input.
- The universal scan returns both the first body candidate (`bodyStart`) and sparse semantic ownership for the header in one small response.
- Adds a mode-independent, deliberately dense header candidate lattice. It is built the same way regardless of parser mode; optional English profile evidence remains additive only and is no longer allowed to decide where the header ends.
- After `bodyStart`, the header lattice is spliced to the routed body lattice. Routing therefore begins affecting parsing only after the header boundary.
- Multiline deterministic planning now receives `bodyStartCandidate` from the universal scan and no longer calls English header classifiers to infer the header boundary.
- Mixed/generic and single-line modes now make their structural request on body-only source. The body JSON schema cannot emit name, size/type/alignment, or header-field ownership.
- Essential card-fact verification now runs only against the header prefix found by the universal scan.
- Adds body-structure diagnostics so exported parse reports preserve the second structural request/response for mixed and single-line modes.
- Removes the obsolete multiline header-only prompt/schema path.
- Adds regression coverage for mode-independent header coordinates, localized header ownership across multiline/generic modes, header spans crossing `bodyStart`, and body schemas that cannot emit header roles.

This patch intentionally does not solve localized multiline BODY section semantics yet. It isolates that remaining problem so body classification can no longer corrupt header parsing.
