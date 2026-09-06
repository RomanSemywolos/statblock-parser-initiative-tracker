# Patch 2.67.0 — specialized collapsed-text candidate lattice

This patch changes only the specialized single-line path. The universal parser and its candidate lattice/prompt remain unchanged.

## Why

Prompt specialization alone did not improve difficult collapsed statblocks because the model still received coordinates designed for the universal parser. A flattened source can require boundaries that do not exist as physical lines, while the universal lattice also contains noisy sentence/title proposals that are useful as fallback evidence but harmful when every line boundary is already lost.

## Changes

- Added `enrichSinglelineCandidates()` after deterministic parser routing. It is used only when the selected parser mode is `singleline`.
- Kept the universal/generic path on the original `createSourceCandidates()` output.
- Added a dense vocabulary-free identity prefix lattice before the first known header field, allowing the model to separate name and classification without a size/type/alignment word list.
- Added shape-only detection for repeated compact `UPPERCASE-LABEL + integer + (signed integer)` cells. Four or more adjacent cells create one table-row start proposal; no specific ability labels are required.
- Inline section headings now expose both their left and right edges so the heading can be separated from following section rules in collapsed text.
- Rebuilt body feature proposals conservatively for single-line mode: only compact title-shaped `Name.` leads survive; generic sentence-start noise from the universal lattice is not inherited.
- Multiword title interiors are suppressed so `Two Heads.` produces one proposal rather than separate `Two` / `Heads` proposals.
- Numbered/lettered list items expose only their list marker as hierarchy evidence. The title inside a numbered item is deliberately not promoted to another top-level feature candidate. This lets a parent feature safely contain structured numbered outcomes.
- Added a single-line-specific user prompt that displays candidate reasons and explicitly distinguishes candidate evidence from semantic ownership.
- Strengthened the specialized system prompt around one-word feature titles, adjacent flattened features, section-heading/rules separation, and nested numbered/lettered lists. The rules are structural and do not name concrete monster features/actions.

## Demogorgon stress-case geometry

The specialized lattice can now represent, without feature-name vocabulary:

- `Demogorgon | Huge ... | Armor Class ...`
- `Speed ... | <six compact ability cells> | Saving Throws ...`
- `Traits | first feature ...`
- separate adjacent title-shaped traits such as `X. ... | Y. ...`
- `Actions | first feature ... | one-word feature. ...`
- one parent feature containing `1. ... 2. ... 3. ...` nested outcomes
- `Legendary Actions | section rules ... | first legendary feature ...`

## Verification

- 22/22 targeted tests passed (`sourceCandidates`, specialized single-line prompt, parser routing).
- Targeted TypeScript production compile passed for `pipeline.ts`, `sourceCandidates.ts`, `prompt.ts`, and `parserRouting.ts`.
- No claim is made for a full npm/runtime suite in the sandbox.
