# v2.34 — renderer semantics and light-theme cleanup

## Recharge interaction

Canonical `(Recharge 4-6)` / `(Recharge 5–6)` constructs are now deterministic interactive
mechanics.

`findRechargeExpressions()` recognizes the whole parenthesized construct and maps it to `1d6`.
The whole construct is clickable and uses the same transient single inline result as other rolls.

The matcher accepts a configurable list of labels, so the later Ukrainian translation can register
the glossary-approved equivalent without changing the mechanic.

## Dice header

Quick `d4 d6 d8 d10 d12 d20 d100` buttons were removed.

The free-form dice expression is now the central roll control on the same top line as Settings and
the statblock action buttons. Its initial value is `1к20`. The fixed-height roll history remains
inside the same header underneath the centered expression control.

## Light forms

Settings and Add Participant forms now explicitly use the application's light palette for:
- panel backgrounds;
- inputs;
- selects;
- buttons;
- placeholders and focus states.

They no longer depend on browser/system dark form styling.

## Statblock semantic typography

Known structured header field names render as bold labels, for example:
- Armor Class
- Hit Points
- Speed
- Skills
- Damage Resistances
- Damage Immunities
- Condition Immunities
- Senses
- Languages
- Challenge
- Proficiency Bonus

This semantic label rendering is also used in Edit mode and Card Configuration without adding
formatting markup to stored source text.

Ability scores and ability modifiers are no longer bold. Modifier interaction remains indicated by
the dotted underline.

## Stable style across modes

Edit mode now explicitly preserves statblock title, subtitle and section-heading typography.

Card Configuration now visually preserves:
- the actual statblock title;
- subtitle style;
- structured header-label emphasis;
- the six-column ability table;
- section-heading typography.

## Automatic ability/trait name emphasis

A paragraph whose first sentence ends within 60 characters is treated as a likely trait/action name
for presentation only:

`Fiendish Rot. ...`

renders the `Fiendish Rot.` prefix bold italic.

This does not mutate the authoring document and therefore does not interfere with translation or
manual editing.

If a Recharge construct occurs inside that short title, it remains interactive.
