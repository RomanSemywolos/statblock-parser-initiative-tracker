# Patch 2.61.0 — deterministic localization freeze

## Decision

M14 localization is closed for the current parser-improvement cycle at the deterministic/manual-edit level. Machine translation is deliberately disabled and is not a runtime dependency. Unresolved English prose is preserved in the Ukrainian branch for manual editing rather than being guessed or sent to an MT model.

## Final deterministic cleanup

- Fixed `Success: Half damage.` as a complete standardized outcome phrase. The former broad `Half damage` substitution no longer creates malformed mixed prose such as `takes only Половина шкоди.`
- `to hit with spell attacks` now has priority over the shorter generic `to hit` rule, preventing mixed output such as `до влучання with spell attacks`.
- `(Costs N Action[s])` is translated after protected numeric mechanics are restored, with Ukrainian agreement: `1 дію`, `2–4 дії`, `5+ дій`.
- Added physical resistance qualifiers `from Magic Weapons`, `from Magical Weapons`, and `from Magical Attacks`.
- Product translation status explicitly says that machine translation is disabled and unresolved English prose is intended for manual editing.
- Updated package version constant to match the package manifest.

## Scope boundary

This patch does not add prose-level regex translation. Natural-language trait/action descriptions, unique names, spell names, and context-sensitive grammatical phrases may remain English. The parser can now move on without introducing an MT service or model dependency.
