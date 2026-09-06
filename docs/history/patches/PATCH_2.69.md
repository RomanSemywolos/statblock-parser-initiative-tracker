# Patch 2.69.0 — structural boundary evidence and layout preservation

This patch develops the lossless/source-grounded parser architecture instead of adding statblock-specific title words.

## Boundary evidence layer

Candidates now may carry structural boundary evidence:
- scope: `top_level`, `internal`, or `unknown`;
- strength: `hard`, `strong`, or `weak`;
- evidence such as physical line, paragraph, title shape, table shape, section heading, or confirmed list sequence.

The layer does not assign feature semantics. It records why a coordinate is structurally plausible and whether visible geometry makes it peer-level or nested.

Single-line prompts expose this evidence as non-authoritative structural metadata. Reconciliation also uses it conservatively: hard internal list markers cannot become peer features, while strong top-level title-shaped boundaries can recover one-word peer features in collapsed input.

Printed section headings are enforced at their exact source-proven candidate boundary so a coarse model span cannot absorb a heading. The following prose remains eligible for section rules.

## Shared sequence evidence

Sequential list detection (`1 -> 2 -> 3`, `A -> B -> C`) is now a shared structural primitive. A lone numeric sentence ending such as `reduced to 0. Gaze.` is not list evidence.

## Multiline presentation geometry

Body presentation no longer collapses all whitespace with the header normalizer. Horizontal whitespace is normalized, but source line breaks inside a body annotation are preserved. Thus one semantic feature can remain one feature while retaining internal lines such as spell-frequency rows.

No spellcasting vocabulary or feature-name vocabulary was added.
