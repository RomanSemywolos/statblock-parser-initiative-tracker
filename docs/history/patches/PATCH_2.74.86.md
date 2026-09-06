# Patch 2.74.86 — multiline section-boundary and product-unit invariant

This patch repairs the remaining end-to-end consequences of the 2.74.79–2.74.85 routing/section cleanup.

## Multiline structural section boundaries

A standalone heading-shaped physical BODY row in trusted `multiline` input is now emitted as `unknown_section_heading`, not generic `unclassified`.

This classification is structural only. It does **not** assign `actions`, `reactions`, `legendary_actions`, or any other language-dependent semantic subtype. Its purpose is to prove that a section boundary occurred so transport can clear previous section ownership. Content after that boundary remains unresolved until semantic ownership is independently known.

Therefore an unknown localized heading can never silently leave subsequent features in the previous implicit/explicit section.

## End-to-end physical-row invariant

The lossless annotation compiler may legitimately coalesce adjacent unresolved source into one `unclassified` document gap because no semantic annotation owns those spans. That storage detail must not leak into the editable multiline product.

When `parserStructure === "multiline"`, `compileToEditableStatblock` now enforces the routing contract at the product boundary as well: every non-empty physical BODY row becomes a separate editable object. This guard applies to unresolved gaps and to any multi-row BODY annotation that reaches the compiler unexpectedly. Header annotations are not split.

Blank physical rows remain separators and do not become editable body objects.

## Singleline boundary evidence

The old regression that expected punctuation-free English `Legendary Actions` to receive deterministic `hard/top_level` evidence was stale. That strength came from the removed English section-anchor channel. Such a coordinate remains available to the BODY LLM, but deterministic evidence no longer promotes it from vocabulary.

## Authority split

- Physical multiline BODY geometry: deterministic and immutable.
- Structural unknown section boundary: deterministic shape evidence is allowed.
- Language-dependent section meaning: LLM only where required.
- Section ownership after an unknown boundary: unresolved; never inherited or dictionary-repaired.
- Editable multiline object boundaries: deterministic physical-row guard.
