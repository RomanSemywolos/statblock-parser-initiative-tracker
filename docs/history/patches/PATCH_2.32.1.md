# v2.32.1 — final combat/UI polish before translation

## Inline rolls

Only one inline result is visible in the central statblock at a time. A new inline roll removes the
previous result. The rendered suffix is now only:

```text
= 18
```

The source expression/modifier is already visible and is not duplicated. Inline results remain
transient React state and disappear on reload.

## Header / dice notebook

Quick dice buttons now live in the left side of the main workspace header. `Налаштування` is above
them.

The expression input and roll notebook remain directly below the header. The notebook now has a
fixed, taller viewport with overflow scrolling from the start instead of growing with early entries.

Library Export/Import moved inside the Settings panel.

## Palette

Controls, text fields, cards, roller and settings explicitly use dark foreground colors suited to
the existing light beige palette. Status colors were darkened for contrast.

## Encounter initiative

Mini-card initiative now has two separate controls:

```text
Init [ 17 ] +3
```

- the result is a numeric input and can be entered/cleared manually;
- the underlined modifier is the interactive roll target;
- clicking the modifier rolls `1d20 + modifier`, stores the total as the combatant initiative and
  adds the roll to the shared notebook.

Manual initiative mutation is implemented in the pure encounter model as
`setCombatantInitiative()`, not as direct React object mutation.
