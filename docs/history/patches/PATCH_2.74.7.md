# Patch 2.74.7

Fix false numbered-list preservation in body presentation.

- Adds shared line-level sequential-list structural primitive.
- A lone `23)` at the start of a visually wrapped continuation is no longer treated as a list item.
- Numbered/lettered rows retain line breaks only when adjacent non-empty rows prove a sequence beginning `1 -> 2` or `A -> B`.
- Parser routing now reuses the same line-level primitive instead of maintaining a duplicate implementation.
- Raw source, source map, semantic ownership, multiline/singleline routing behavior and product schema are unchanged.
