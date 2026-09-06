# M7 manual test checklist

1. Add one test statblock to the encounter twice.
2. Confirm both copies start at full HP.
3. Damage only copy #1; copy #2 must not change.
4. Give copy #1 temporary HP, then apply damage larger than temp HP; temp must be consumed first.
5. Heal above maximum; current HP must stop at effective max.
6. Enter a positive value and press `Макс. ±`; effective maximum must increase.
7. Enter a negative value and press `Макс. ±`; effective maximum must decrease and current HP must clamp if necessary.
8. Press `Скинути`; base max/full current/zero temp/zero max modifier must return.
9. Change HP, press F5, and confirm the combat HP survives reload.
10. Open the same combatant in the center and confirm the central HP overlay and right card show the same state.
11. Existing M6 encounter data should load without crashing; combatants without the old HP field should be initialized once from their statblock maximum.
