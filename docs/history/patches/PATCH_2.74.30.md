# Patch 2.74.30 — trusted multiline paragraph geometry

## Goal
Preserve strong body paragraph-boundary evidence in trusted multiline imports without restoring blank rows or turning ordinary visual wraps into hard line breaks.

## Changes
- `normalizeBodyPresentationText()` now accepts `preserveParagraphBreaks`.
- When enabled, one or more blank physical source rows between non-empty body lines become exactly one presentation newline.
- The blank row itself is still discarded; `\n\n` is never reintroduced by this rule.
- Ordinary single physical newlines continue to fold to spaces unless existing list/compact-row evidence already preserves them.
- `compileToEditableStatblock()` accepts `parserStructure` and enables paragraph preservation only for `multiline`.
- Product parser/job runner now pass the resolved parser structure into compilation.
- Added regression tests for preserved paragraph boundaries, folded visual wraps, and absence of blank editable rows.

## Non-goals
- No global `multiline => preserve every newline` behavior.
- No parser/candidate boundary changes.
- No changes to header normalization.
