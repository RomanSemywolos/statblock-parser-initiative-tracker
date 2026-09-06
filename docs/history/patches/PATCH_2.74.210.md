# Patch 2.74.210 — reject 2.74.209 Header prompt experiment + align singleline BODY transport with stable mixed

## Decision after the live 2.74.209 corpus

The 2.74.209 prompt-only Header experiment is rejected.

Removing coordinate-bearing Header few-shots and adding a long final self-check did not improve qwen3:8b. It created new regressions: the model began widening several ability anchors from the printed label to `label + score`, Astral Dreadnought lost the complete six-ability proof, Baphomet lost HP, and Demogorgon/Aspect still had scalar-coordinate misses.

Therefore 2.74.210 restores `SINGLELINE_ESSENTIAL_FACTS_SYSTEM_PROMPT` exactly to the live 2.74.208 prompt. The 2.74.208 singleline Header architecture is now the practical baseline. Remaining STA/CR/PB/scalar misses on qwen3:8b are documented as a model-quality limitation, not repaired by broader deterministic semantics.

## Singleline BODY change

2.74.210 starts the next phase: singleline BODY normalization.

The architectural target remains unchanged:

`accepted Header ownership -> exact BODY complement -> one geometry-only BODY call -> virtual multiline -> shared deterministic multiline BODY parser`

The previous active singleline BODY transport still contained two mechanisms already shown to be harmful in the historical mixed regression:

1. model-facing `class=N` indirection for candidate evidence;
2. numeric BODY start IDs (`{"s":17}`) instead of direct source-address strings (`{"s":"C017"}`).

2.74.210 removes both from the active singleline BODY path.

### New singleline BODY transport

- one whole-BODY call remains;
- the reduced singleline BODY candidate lattice remains unchanged;
- every candidate now carries its deterministic evidence locally, in the same style as the accepted mixed transport;
- audit/synthetic provenance is printed inline as geometry evidence, not compressed through a separate class legend;
- BODY output uses direct `Cxxx` string IDs;
- JSON schema enumerates only legal BODY-owned `Cxxx` IDs;
- parser budgeting is calculated from the exact string-ID payload;
- numeric singleline BODY generation/parsing helpers are removed from active code;
- deterministic virtual-multiline reconstruction and the shared multiline BODY parser are unchanged.

This is intentionally a transport change, not a new BODY semantic model and not a new heuristic family.

## Explicit non-changes

No change to:

- source text or source coordinates;
- Header ownership rules;
- the 2.74.208 ability-anchor solver;
- the one-candidate-left ability repair;
- scalar-prefix overlap carve;
- mixed baseline 2.74.202;
- multiline;
- singleline BODY candidate-set generation;
- downstream deterministic BODY semantics;
- Auto Style;
- language-neutrality rules.

No `bodyStart`, BODY semantic taxonomy, R/A edits, local windows, batching, weights, or language dictionaries are introduced.

## Acceptance rule

Run the same singleline corpus on qwen3:8b.

Primary BODY targets:

- peer named rules should no longer split at every title token (`Legendary` / `Resistance`, `World-Shaking` / `Movement`, etc.);
- section-like collapsed rows (`Actions`, `Bonus Actions`, `Legendary Actions`, localized equivalents) should recover as their own logical rows when candidate geometry supports them;
- internal labels such as `Saving Throw:`, `Failure:`, `Hit:` remain inside the currently open logical entry;
- introduced numbered/list material remains internal unless a new peer begins;
- exact source reconstruction must remain lossless.

If this direct local-evidence/string-ID transport materially improves BODY starts, keep it and tune BODY only from that baseline. If it does not, do not compensate with a second semantic BODY parser; treat the remaining misses as model-quality/candidate-evidence limitations and reassess the singleline candidate view separately.
