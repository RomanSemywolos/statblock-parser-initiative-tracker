# v2.32.2 — unified workspace header

The previous layout stacked two separate horizontal layers above the statblock:

1. workspace title / Working state / edit controls;
2. dice input / roll history.

This made the roll notebook push the statblock too far down and visually separated the edit controls
from the content they operate on.

v2.32.2 replaces both layers with one compact workspace header containing:

- Settings;
- quick dice;
- free-form dice expression;
- fixed-height scrollable roll history;
- Edit / Card Configuration / Next controls.

The redundant workspace title (`Combatant`, duplicated creature name, and Working status text) is
removed. The creature name already exists as the statblock title.

The statblock now starts immediately below this one header.

The Library action label is also changed from `+ Імпортувати statblock` to `+ Додати statblock`.
