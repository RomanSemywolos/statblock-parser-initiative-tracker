# Patch 2.74.28

- Kept the v2.74.27 same-line named-block tightening and expanded its regression coverage with positive compact multiword titles and negative sentence-shaped continuations. The rule remains surface/geometry based and does not use D&D feature vocabulary.
- Refined bullet Auto Style so the bullet character alone is no longer treated as proof of a nested subeffect.
  - A bullet row that occurs after content already owned by the same semantic paragraph is treated as an internal subeffect and gets italic item-label styling.
  - A semantic paragraph whose first content row is itself bulleted is allowed to represent a peer feature exported with list/Markdown punctuation; the marker is preserved and a title-shaped feature lead receives normal bold-italic peer styling.
- Added regressions for both nested breath-weapon bullets and peer `-`, `+`, and `•` feature rows.
- Fixed package/runtime version drift left by the previous package: both package metadata and `src/version.ts` now report 2.74.28.
