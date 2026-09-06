# Evidence authority contract — updated through 2.74.105

The parser deliberately separates source geometry, candidate coordinates, semantic ownership, verification, and presentation. Evidence may inform a later layer only within the authority listed here.

## Source geometry

Examples: physical line/paragraph boundaries, tables, bullets, printed formatting.

Authority:
- may create or preserve source coordinates;
- may contribute boundary/continuation evidence;
- may not assign a statblock semantic role by itself.

## Candidate structural evidence

Examples: optional language-profile header/section anchors, ability-table anchors.

Authority:
- may add grounded candidate coordinates;
- may strengthen/refine boundary evidence;
- may refine a semantic subtype only when an existing semantic owner already covers the same printed span;
- may not invent, move, or enlarge semantic ownership.

## Boundary evidence

Examples: hard/strong/weak top-level boundaries, internal boundaries, continuation evidence.

Authority:
- may constrain or split ownership at source-proven coordinates;
- may prove that a coordinate is internal to an already-open owner;
- may not choose the semantic class of an otherwise unowned span.

## Model semantic claims

Authority:
- may propose semantic ownership only over existing candidate coordinates;
- remain subject to deterministic source invariants and conflict handling;
- conflicting or unsupported claims degrade to unresolved/unclassified source rather than silently deleting source-visible material.

## Critical-fact verification

Current fixed card-critical kinds: name, creature classification, AC, HP, printed
Initiative, ability scores, printed Saving Throws, Challenge/CR and Proficiency
Bonus.

Authority:
- may independently prove a structured fact from any grounded source span, even
  when an imperfect `bodyStart` left that span BODY-owned;
- deterministic validators must read exact printed numbers/structure from source
  and reject unsupported or conflicting claims; verifier semantics do not bypass
  those structural proofs (for example, a verifier-proposed PB still has to be a
  structurally possible printed PB field);
- may not move, resize, replace, or otherwise rewrite semantic/source ownership;
- fact extraction therefore does not by itself imply semantic ownership movement.
  Product presentation may separately relocate the exact verified source range
  into Evidence, but only as a visible source placement; that relocation does not
  rewrite parser ownership.

This independence applies after a usable header/body scan has been obtained. A
complete header-scan/model-envelope failure may still terminate the current
pipeline before the verifier runs.

## Product compiler

Authority:
- may translate proven semantics into editable product structure;
- may relocate an exact grounded source interval only after materializing that
  same interval in another visible product surface;
- must treat ordinary editable content as the default placement of source;
- semantic/header/section ownership has no authority to suppress source from the
  product by itself;
- copied annotation text is not an imported-text authority; product text is
  reconstructed from `rawSource` coordinates;
- must verify product-visible coverage of every non-whitespace source unit before
  returning an editable document;
- must not infer new parser ownership.

## Presentation / Auto Style

Examples: bold labels, italic rule titles, nested bullet visual treatment.

Authority:
- may alter presentation metadata/markup only;
- may read semantic/source relationships for context;
- may not rewrite source spans, parser ownership, facts, or section semantics.

This contract is intentionally stricter than a generic heuristic pipeline. A useful signal does not gain semantic authority merely because it is accurate on common D&D/English inputs.
