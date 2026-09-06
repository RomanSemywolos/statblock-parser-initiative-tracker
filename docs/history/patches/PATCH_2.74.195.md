# Patch 2.74.195 — replay 2.74.177 BODY completion budgeting on the recovered mixed baseline

Base: 2.74.194 recovery control.

Purpose: replay one previously validated transport/runtime change and nothing else.

Changes:
- structured model requests now identify `task: "header" | "body"`;
- BODY starts-only requests derive `numPredict` from the largest legal starts payload;
- an explicit caller `numPredict` still acts as a smaller ceiling;
- OpenAI-compatible providers may impose a BODY-only service cap;
- built-in Groq profiles use the previously validated 768-token BODY service cap;
- local Ollama receives the parser's full task-derived BODY budget;
- Header completion behavior remains unchanged.

Recovery-specific adaptation:
- 2.74.177 was originally implemented after the 2.74.175 mixed transport change and therefore budgeted numeric mixed start indexes;
- 2.74.195 preserves the recovered 2.74.173-style mixed interface from 2.74.194 and budgets the exact legal `Cxxx` string addresses instead;
- mixed prompt, candidate evidence, output schema semantics, source ownership, geometry and deterministic downstream behavior are otherwise unchanged from 2.74.194.

Explicitly NOT replayed:
- 2.74.176 fixed global BODY cap;
- singleline retirement/cleanup from 2.74.185+;
- R/A, local cards, batching, context preflight, weights or candidate pruning from 2.74.189–193.

Quality-control expectation:
- on the same local qwen3:8b corpus used for 2.74.194, selected mixed starts should remain the same; only the request `task` marker and BODY `numPredict` ceiling should differ.
