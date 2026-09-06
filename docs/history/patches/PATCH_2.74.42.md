# Patch 2.74.42

This patch fixes two remaining mixed-input presentation/hierarchy regressions without adding D&D vocabulary or weakening trusted multiline geometry.

## 1. Lone compact continuation labels fold after ownership is resolved

A feature span such as:

```
Bite. ... one target.
Hit: 28 ...
```

was already owned as one feature after 2.74.41, but `normalizeBodyPresentationText()` still preserved every physical compact `Label:` row as a presentation newline. This reintroduced a visual split after semantic ownership had been repaired.

Mixed presentation now folds a *lone* compact labelled continuation row back into prose. Repeated adjacent compact-labelled rows remain line-preserving presentation geometry via a vocabulary-free sequence detector. This keeps spell/list-like blocks structured while allowing ordinary `Sentence. Label: payload` continuations to render inline. Multiline mode remains unchanged and preserves every non-empty physical row.

## 2. Introduced bullet sequences are source-proven internal hierarchy

A source shape such as:

```
Feature. Choose one:
• First Option. ...
• Second Option. ...
Next Feature. ...
```

now has explicit internal-list evidence when:

- at least two adjacent non-empty rows use the same bullet marker (`-`, `+`, or `•`), and
- the immediately preceding non-empty row visibly ends in `:`.

No feature names or language-specific words are used.

In generic/mixed mode these bullet candidates receive `internal/hard + list_sequence`. The direct transport closes them into the already-open parent feature even if the structural model tries to emit the option rows as peer features. A later real peer feature remains separate. Top-level bullet lists without an introducing colon are not affected.

This also makes Auto Style consistent automatically: once both bullet rows belong to the same semantic paragraph, the existing nested-subeffect formatter renders both titles with the same italic-only style instead of styling one as nested and one as a peer feature.

## Tests

Targeted emitted tests covering presentation geometry, boundary evidence, direct transport and Auto Style: **78/78 passed**.

Full dependency-backed `npm test` / `npm run typecheck` were not run in the sandbox; the project runtime dependency set is not installed there. User Windows runs remain authoritative.
