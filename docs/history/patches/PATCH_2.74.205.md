# 2.74.205 — singleline Header coordinate clean start

## Status

Evaluation candidate on top of the accepted **2.74.202 mixed baseline**.

2.74.204 was intentionally diagnostic only. Its live qwen3:8b run showed that a much simpler singleline Header semantic task is viable, but it also demonstrated why model-authored source quotes are not an acceptable final grounding contract: Baphomet returned a non-source `PB` quote and deterministic grounding correctly rejected it.

2.74.205 keeps the simplified task and restores the project-wide invariant:

> **LLM selects source coordinates; deterministic code owns source text, numbers, mechanical proof, ranges, and ownership.**

## Architecture

The mixed parser remains the architectural reference:

`whole source -> one fixed Header locator -> deterministic Header validation/ownership -> exact BODY complement -> one starts-only BODY normalization call -> shared deterministic multiline BODY parser`

Singleline now follows that same ownership pipeline with a mode-specific Header address presentation:

`raw collapsed source + complete flat token-address space -> Header coordinate selector -> deterministic singleline Header proof -> accepted Header ownership -> exact BODY complement -> existing singleline starts-only BODY call -> shared multiline BODY parser`

The important specialization is the address space:

- mixed can remain sparse because surviving physical/source geometry is genuine evidence;
- fully collapsed singleline cannot safely prune unfamiliar Header labels by title/body geometry;
- therefore **every non-whitespace source unit gets one immutable Cxxx Header address**;
- Header addresses carry no model-facing structural role, boundary strength, confidence, title shape, ownership, or semantic proposal.

This deliberately retires the old singleline Header dependence on `STRUCTURAL PROPOSALS + EXACT ADDRESS COORDINATES` and also avoids making the old singleline BODY/title heuristics a Header correctness dependency.

## Model contract

The singleline Header model returns only integer coordinate selections:

- `identity`: inclusive `s/e` spans for `n` and `sta`;
- `fieldStarts`: first-token coordinates for `ac`, printed `init`, `hp`, printed `sv`, `cr`, printed `pb`;
- `abilityLabels`: first-token coordinates mapped to `str/dex/con/int/wis/cha`.

The model returns no source quote and no numeric value.

## Deterministic proof

`src/singlelineHeaderCoordinates.ts` turns coordinate selections into proven Header evidence.

It validates/proves:

- name starts at source content start;
- STA is adjacent to the accepted name span;
- scalar field starts lead to a compact printed label plus the required numeric shape;
- balanced parenthetical payloads remain part of the printed field;
- six interleaved ability cells (`STR 30 (+10) ...`);
- 2024 score/mod/save cells (`STR 30 +10 +10 ...`);
- separate six-label rows (`STR DEX CON INT WIS CHA 30 (+10) ...`);
- multi-token ability labels, whose exact ends are derived deterministically;
- standalone Saving Throws rows from already mapped printed ability labels;
- nested printed PB inside CR parentheticals (`CR 30 (XP ...; PB +9)`).

A wrong coordinate can only become Header ownership when its source bytes also satisfy the field's deterministic mechanical proof. Unsupported claims are rejected and remain in the lossless remainder.

## New complete singleline Header address space

`src/singlelineHeaderAddressSpace.ts` is intentionally simple:

- one coordinate per non-whitespace `LosslessSourceMap` content unit;
- source order only;
- C000 retains only the unavoidable document-start marker internally;
- all later Header address candidates carry no reasons and no boundary evidence;
- no candidate pruning, title detection, body-start estimate, language profile, or D&D vocabulary participates.

The model-facing prompt serializes only Cxxx plus the exact addressed source token.

## Baphomet ability-layout repair

The 2.74.204 live corpus also exposed a separate deterministic issue. Baphomet prints abilities as:

`STR DEX CON INT WIS CHA 30 (+10) 14 (+2) 26 (+8) 18 (+4) 24 (+7) 16 (+3)`

All six semantic labels were identified correctly, but the first clean-start grounder only understood interleaved label/cell layout. 2.74.205 proves both layouts directly; no fallback Header model call is required.

## Isolation

This stage changes **singleline Header transport/grounding only**.

It does not change:

- accepted mixed 2.74.202 behavior;
- multiline behavior;
- singleline BODY candidate lattice;
- singleline BODY prompt/hints;
- starts-only BODY response schema;
- shared deterministic multiline BODY parser;
- translator or UI behavior.

A live 2.74.205 qwen3:8b corpus is required before accepting the Header prompt/coordinate presentation as the singleline baseline.

## Validation summary

- core strict TypeScript: PASS;
- clean core build: PASS;
- Node tests: **524/524 PASS**;
- frontend strict TypeScript: PASS;
- complete-token Header address-space regression tests: PASS;
- 2.74.204 live semantic selections transposed deterministically into the new coordinate space on Astral Dreadnought, Aspect of Tiamat, Baphomet, Demogorgon, and Tarrasque: all intended Header regions grounded with zero grounding issues;
- full stored-response pipeline replay on those five cases: 5/5 exact source reconstruction, two calls per case, Header and BODY stages completed;
- singleline Header coordinate counts on those sources: 568–817 addresses, exactly one per non-whitespace source unit;
- measured Header request text on those sources: approximately 15.7k–19.7k characters including system prompt, user prompt, and JSON schema.
