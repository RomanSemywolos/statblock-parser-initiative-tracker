# M8 manual test checklist

1. Add three combatants with visibly different DEX/initiative modifiers.
2. Click initiative on only one card before combat; it should move into the rolled group above unrolled cards.
3. Roll the rest manually and confirm the right sidebar sorts high to low.
4. For an equal total, confirm the higher initiative modifier appears first.
5. Press `Почати бій` with at least one unrolled combatant; existing totals must remain and only missing initiatives should roll.
6. Confirm `Раунд 1` appears, the highest combatant is marked as current, and it opens in the center.
7. Press `Далі →` repeatedly; current highlight/opened combatant must advance in initiative order.
8. Move past the last combatant and confirm the round increments to 2.
9. Damage a combatant and give it temp HP, then press `Завершити бій`; initiative, HP changes, temp HP, max modifier, round, and current turn must reset while combatants remain on the right.
10. Press F5 during an active combat and confirm initiative totals, round, current turn, and HP survive reload.
11. Load browser data created by M6/M7 and confirm it upgrades without crashing.
12. Add a new combatant during an active combat; it should receive initiative immediately and join the ordered list.
