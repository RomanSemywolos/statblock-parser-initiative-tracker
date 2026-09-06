# Patch 2.74.84 — multiline presentation hardening and contract alignment

## Production

- Keeps the 2.74.79 invariant: every non-empty physical multiline BODY row is one immutable logical unit.
- Clean multiline BODY makes no structural BODY LLM call.
- Manual paragraph→heading toggle no longer maps EN/UA/RU wording to semantic section kinds; it creates `headingKind: null`.
- Auto Style remains language-neutral and may promote only heading-shaped standalone multiline rows to presentation headings with `headingKind: null` unless semantic ownership already exists.
- Refines the heading-shape rule for cased scripts: the first cased letter must be uppercase. This rejects lowercase structural/table noise such as `mod` and `save` without using any language vocabulary. Uncased scripts remain eligible.

## Tests

- Adds regression coverage that lowercase multiline table/noise labels remain paragraphs.
- Updates stale multiline tests that expected deterministic English `section="actions"` ownership. They now verify exact feature preservation plus unresolved standalone section rows.
- Updates the web integration expectation: `Traits` and `Actions` are semantically unresolved in clean multiline parsing, so the parser report counts two unclassified blocks while exact source reconstruction and user-visible styling remain intact.

## Documentation

- `README.md` and `ROUTING_CONTRACT_2.74.79.md` now state the current authoritative mode contract.
- Historical 2.74.78/2.74.79 notes that proposed a later multiline section-heading LLM pass are explicitly marked as superseded.
- Language understanding is delegated to LLM semantics only when a product feature actually needs that meaning; it is not a prerequisite for clean multiline parsing or Auto Style.

## Known remaining section work

`candidateTransport.ts` still contains optional English-profile section enrichment, and the quarantined legacy reconciler still contains older deterministic section classification. This patch does not broaden that scope. The next dedicated section pass should replace language-dependent semantic interpretation with LLM semantics plus deterministic grounding/structure validation rather than adding more language dictionaries.
