# v2.40.0 — collaborative essential-fact parsing

This pass hardens the parser around the fields that feed the encounter card: name,
Armor Class, Hit Points, ability scores and saving throws.

## Dedicated LLM essential-fact channel

The sparse structural response now also asks the model for `essentialFacts`:

```json
{"k":"n|ac|hp|ab|sv","s":"Cxxx","e":"Cyyy"}
```

These are source-span claims only. The model does not rewrite or calculate values.
They are deliberately independent from the ordinary structural `blocks` channel, so a
coarse structural grouping cannot silently erase a more focused name/AC/HP/ability/save
claim.

## Collaboration rather than winner-takes-all correction

For AC, HP and separately printed saving throws, deterministic header grammar is an
independent evidence source:

- model + deterministic source agree -> `essential_fact_agreement`;
- only the model has a grounded claim -> `essential_fact_model_only`;
- only deterministic grammar has one unique grounded span ->
  `essential_fact_deterministic_only`;
- the two point to different spans -> `essential_fact_conflict` and the disputed
  critical semantic slot is left unresolved instead of choosing a winner.

Ability-table claims are additionally checked against the six exact canonical labels
when available. Localized labels can still be supplied by the model hint channel.

A dedicated name claim is intentionally allowed to refine a coarse structural name
span. Any leftover source is preserved as unclassified header material instead of being
silently appended to the creature name.

## Ability / Save-column ownership

An `ab` essential claim can own the complete ability-table source region even when the
coarse structural model fragmented the table into many tiny header spans or omitted
trailing cells. A `sv` claim may overlap the same table; it is retained as independent
evidence while the ability-table annotation owns the shared lossless source range.

This directly covers vertical 2024-style score/mod/save layouts such as Zariel's table,
including the final CHA modifier/save cells.

## No silent save fallback when a printed Save column is incomplete

The product compiler still derives non-proficient saves from ability modifiers for
classic statblocks that only print a subset in a separate Saving Throws field.

However, when the source is clearly a full Save-column ability table and one printed
save cannot be recovered, that ability stays `null`. The compiler no longer silently
substitutes the ability modifier and presents it as though parsing succeeded.

## Permanent repair slots

Name was already a permanent product slot. AC and HP are now also emitted as labelled
repair slots (`Armor Class`, `Hit Points`) when parsing cannot resolve their values.
Removing those rows in the editor clears the value but retains the labelled slot.
Abilities and all six saving-throw controls were already structurally permanent.

## Regression coverage

Added regression coverage for:

- Aspect of Tiamat: coarse `name=C000-C001`, `sta=C002` plus focused essential claims;
- a fragmented vertical Zariel-style ability table ending in `CHA 30 +10 +18`;
- explicit model/deterministic critical-field conflict;
- incomplete printed Save-column data remaining unresolved;
- permanent empty AC/HP repair slots.
