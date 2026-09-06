# Patch 2.74.52 — presentation-only header label recovery

## Problem
After the multilingual candidate/ownership refactor, header label styling still depended too strongly on successful semantic classification. Rows whose source text visibly began with a known printed header label could remain unstyled when the parser deliberately kept their ownership unresolved. This was especially visible for localized rows such as `Спасброски ...` and `Сопротивление урону ...`.

## Architectural decision
Do not restore the old English structural splitter or let presentation vocabulary claim semantic ownership.

Header label recognition is now allowed as a presentation-only language profile:
- it may bold the exact source substring that matches a known printed label;
- it never changes `row.field`, node type, parser ownership, structured facts, source spans, or source text;
- unresolved parser-owned material may remain an ordinary editable paragraph while still receiving the conventional visual label treatment.

This preserves the architecture:
`source geometry + multilingual semantics + optional language/profile evidence + deterministic source invariants`, while presentation remains free to apply conventional formatting without becoming a parser.

## Safety constraints
- A known label must begin at the physical/editable line start.
- It must end at whitespace, `:`, or end-of-line; `Senses. ...` is therefore not mistaken for a header label.
- For cased scripts, the printed label must begin with an uppercase letter/abbreviation. Lowercase prose such as `saving throws against spells...` is left untouched.
- Exact printed spelling/casing is preserved.
- No content is removed or hidden.

## Product behavior
- Correctly owned header rows still use their exact printed labels.
- A misclassified/unresolved header row can still display `**Сопротивление урону** ...` without being reclassified.
- An unresolved editable paragraph can display `**Спасброски** Лов +5, Мдр +9` while remaining a paragraph.
- Empty required repair slots now render as `**Armor Class**` / `**Hit Points**`, matching the standard header presentation.

## Tests
Added regressions proving that:
- presentation fallback does not change semantic ownership;
- unresolved localized preamble/header text can be styled without promotion;
- a feature titled `Senses.` remains a feature;
- lowercase prose beginning with `saving throws` remains ordinary prose.

Validation in the sandbox:
- focused editable/header suite: 71/71 passed;
- broad emitted suite: 350 entries, 342 passed, 8 dependency-startup failures (`zod`/`undici` unavailable), 0 runnable assertion failures;
- frontend TypeScript noCheck validation passed.

Normal dependency-backed `npm test` / `npm run typecheck` should still be run in the user's Windows environment.
