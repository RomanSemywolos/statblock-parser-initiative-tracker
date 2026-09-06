# Patch 2.74 — machine translation in the document pipeline

- Parser remains frozen; no parser routing or segmentation changes.
- Added `translateEditableStatblockWithProvider()` as an async MT-aware sibling of the existing deterministic translator.
- Deterministic glossary/rules remain authoritative. Existing Ukrainian deterministic words are replaced with opaque `KEEP` tokens before MT and restored afterwards.
- Mechanical values are protected again before MT and validated against the original English fragment after restoration.
- MT is applied only to body nodes that still contain English prose; semantic section headings stay deterministic.
- Provider/token/mechanics failures degrade safely to the deterministic fragment instead of corrupting the UK branch.
- The frontend now uses the configured LibreTranslate URL when creating/recreating the Ukrainian version and reports MT translated/fallback counts plus provider latency.
- Added MT orchestration regression tests, including safe fallback when a provider corrupts a deterministic token.
