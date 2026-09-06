# Patch 2.48

## Editor / Auto Style

- Header authoring markup is now visible in edit mode (`strong`/`em` render as bold/italic).
- Auto Style now normalizes known header-row labels too, writing editable markup such as `**Armor Class** 18`.
- Parser-created `EditableStatblockDocument`s receive Auto Style exactly once, at the final product compilation boundary. Existing/saved documents are not re-styled on open, so later human formatting remains authoritative.
- The one-shot button remains available and re-normalizes the current document on explicit user request.

## Localized ability grounding

- Ability-label hints are grounded as one ordered six-label source pattern rather than requiring every localized abbreviation to be globally unique.
- Recovery searches for the smallest local source region that admits one complete six-ability solution. Later localized Saving Throws / Skills rows can therefore no longer poison a valid ability table merely because deterministic field labels do not recognize their language.
- This is structural/constraint evidence, not a language-specific statblock dictionary.

## Known follow-ups

- A structural model can still merge two adjacent critical header fields (for example AC + HP). The verifier currently cannot split that ownership; source stays visible but one structured fact can be absent.
- Multilingual semantic section buckets remain a separate problem: e.g. a localized `Legendary Actions` / description heading can still receive the wrong section kind even when ability grounding succeeds.
