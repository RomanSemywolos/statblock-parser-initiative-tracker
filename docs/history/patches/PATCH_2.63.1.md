# Patch 2.63.1 — strict multiline boundaries

- Multiline parsing now trusts physical normalization boundaries: inline sentence/named-block candidates can no longer split an already intact line-level feature.
- This keeps `Multiattack. The dragon can use its Frightful Presence. It then ...` as one feature.
- Auto Style now treats compact parenthetical feature metadata such as `(Recharge 5–6)` and `(Costs 2 Actions)` like ordinary feature names and applies bold-italic styling consistently.
- Added regressions for both cases.
