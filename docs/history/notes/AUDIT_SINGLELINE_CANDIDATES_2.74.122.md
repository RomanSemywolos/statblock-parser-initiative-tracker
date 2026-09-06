# Singleline candidate-lattice audit — 2.74.122

This audit is observation-only. Parser behavior is unchanged from 2.74.121.

The current singleline lattice intentionally mixes exact addressability with
structural proposals. `auditSinglelineCandidateLattice()` classifies existing
coordinates by the mechanisms that can account for them; it does not create,
remove, reorder, promote, weaken, or assign ownership to candidates.

## Control corpus from parse-reports(20260903-174346).json

| Source | candidates | structural only | address only | mixed |
| --- | ---: | ---: | ---: | ---: |
| Demogorgon | 236 | 2 | 207 | 27 |
| Aspect of Tiamat | 267 | 2 | 234 | 31 |
| Tarrasque | 261 | 5 | 228 | 28 |
| Baphomet | 297 | 4 | 257 | 36 |

Origin counts overlap because one coordinate may be reachable through several
mechanisms.

| Source | dense prefix | punctuation | title look-back | named title | profile header | list marker |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Demogorgon | 159 | 43 | 66 | 11 | 12 | 3 |
| Aspect of Tiamat | 159 | 43 | 78 | 13 | 11 | 0 |
| Tarrasque | 159 | 43 | 90 | 15 | 12 | 0 |
| Baphomet | 159 | 56 | 110 | 20 | 12 | 4 |

## Main finding

The overwhelming majority of current singleline coordinates are address-only.
For the four real collapsed fixtures, 207/236, 234/267, 228/261 and 257/297
coordinates respectively have no structural origin in the audit. The fixed
160-content-unit dense prefix contributes 159 address coordinates in every case,
and title look-back adds another 66-110 potentially overlapping address points.

This confirms the design hypothesis for the next stage: exact addressability and
structural proposal space are currently conflated. The next change should separate
those roles without deleting coordinates or changing source survival.
