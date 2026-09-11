# Patch 2.74.225

Based on 2.74.224, without the bulk Ukrainian-comment pass.

## Frontend changes

- Reduce the desktop workspace header minimum height from 124px to 78px. Keep a scrollable 60px roll-history preview alongside dice controls.
- Add an arrow that opens a tall native modal dialog with the roll history. Close using its close button, Escape, or the backdrop. Preserve natural-d20 result colors.
- Retain up to 100 rolls in session memory instead of 10; reloading still clears the history.
- Place formatting, save/checkpoint/backup actions, and the card menu in one card-owned sticky header. Copy is visible only in view mode.
- Mount the editing toolbar into the shared header using a React portal, preserving editor selection and formatting behavior.
- Align the header with the card's top edge and use a zero sticky offset within the central scroll area. Wrap controls when the card is too narrow.
- Replace the persistent autosave/checkpoint/backup note with styled hover/focus tooltips. Apply the same tooltip style to Auto-style and the history arrow.
- Close the card menu when switching editing/configuration modes.

## Validation

Regression tests cover action placement, edit/view switching, tooltips, history dialog controls, natural-d20 color preservation, and the 100-entry history limit.

Live visual scrolling validation could not be completed: the browser environment blocked the local application address. CSS layout is therefore not claimed as visually verified.

Parser, model routing, and persistence semantics are unchanged.
