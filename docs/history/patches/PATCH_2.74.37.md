# Patch 2.74.37 — mixed boundaries require positive block evidence

## Why

In mixed web/PDF input, a physical newline is often only a visual wrap. The candidate lattice already carries a `boundary` confidence layer (`scope`, `strength`, and evidence kinds), but generic physical line starts were being promoted to `top_level/strong` even when no independent source shape suggested a real new block. Compact `Label:` rows were additionally tagged as `standalone_block_start`, which overstated their evidence.

## Changes

- Non-multiline `line_start` is now only `unknown/weak` `physical_line` evidence.
- Trusted multiline keeps physical rows as `top_level/hard` geometry.
- A mixed boundary becomes strong/hard only through independent evidence such as title shape, compact standalone block shape, section heading, paragraph, table shape, etc.
- Generic compact `Label:` row enrichment keeps the source coordinate (`line_start`) but no longer claims `standalone_block_start` merely from the colon-label shape.
- Added explicit `document_start` boundary evidence so the first candidate remains `top_level/hard` after physical-line demotion.

## Intended effect

`reach 30 ft., ...` does not become a plausible new block merely because the source wrapped there. A separate `Hit: ...` row can remain available as a structural coordinate and receive a continuation hint, but it is not presented to the model as a strong sibling-block boundary. A real title-shaped row such as `Claw. ...` remains `top_level/strong` through independent `title_shape` evidence.

No D&D label vocabulary was added.
