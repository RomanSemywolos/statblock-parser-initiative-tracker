# Patch 2.60.1

## Auto Style regression fix

- Fixed a regression introduced by the short colon-label italic rule in 2.60.0.
- `autoStyleColonLead()` no longer strips authoring markup produced earlier in the same Auto Style pass.
- Feature/action titles such as `Multiattack.`, `Bite.`, and `Legendary Resistance (3/Day).` therefore retain their bold/bold-italic styling even when the following prose contains a colon.
- Short plain line-leading labels such as `Cantrips (at will):` and `1st level (4 slots):` are still italicized.
- Added a regression test covering feature titles followed by later colons and Auto Style idempotence.

## Verification note

The targeted dependency-backed test command could not complete in the sandbox within the timeout, so this patch does not claim a passing npm/tsx test run. The change is intentionally narrow and covered by the added regression assertions.
