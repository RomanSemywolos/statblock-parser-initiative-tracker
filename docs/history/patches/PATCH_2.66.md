# Patch 2.66.0 — Auto-classifier geometry hardening

This patch keeps all parser implementations unchanged and improves only deterministic Auto routing.

## Changes

- Replaced broad inline `Capitalized phrase.` counting with conservative `credibleFeatureAnchors()` evidence.
- Sentence-like continuations such as `The dragon...`, `A creature...`, `If...`, `It...`, `On...` no longer count as collapsed feature starts for routing.
- Feature anchors are accepted only at plausible structural boundaries: physical line start, after sentence-ending punctuation, or after an inline section heading; title-like shape is required.
- Added per-line structural observations instead of relying mainly on global counts.
- Added clean multiline run detection, including consecutive isolated header fields and structural blocks.
- Added isolated-vs-collapsed structural anchor density (`isolatedRatio`) as a deterministic shape signal.
- `mixed` now requires coexistence of genuinely preserved multiline geometry and locally collapsed geometry, or a genuinely mixed weak anchor ratio.
- Removed the old `<= 3 lines => singleline` fallback. Short clean statblocks can now route to multiline from anchor density.
- Weak inputs with no useful anchors use line-length/concentration geometry only as the last deterministic tie-breaker.
- Universal/generic parser behavior is unchanged; Auto still routes mixed input to it.

## Regression coverage

Added tests for:

- clean multiline;
- fully collapsed single-line;
- mixed header/body geometry;
- long normal prose not creating false collapse evidence;
- `Multiattack. The dragon...` / sentence-like continuation false positives;
- three-line clean statblock;
- four physically separated but internally collapsed lines;
- manual override.
