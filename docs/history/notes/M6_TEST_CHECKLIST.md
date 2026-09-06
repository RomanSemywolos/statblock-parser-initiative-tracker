# M6 manual test checklist

1. Run the frontend as in M5.
2. Open a fixture statblock.
3. Click `STR` under ability checks. Confirm a `1d20+modifier` result appears in history.
4. Click a saving throw. Confirm it uses the save value rather than the raw ability modifier when they differ.
5. Click an inline dice expression such as `2d6+3` in the statblock body. Confirm individual dice and total are shown.
6. Edit a block and enter `1к20 + 8`, leave edit mode, then click it. Confirm it rolls and displays canonical `1d20+8` in history while source text remains `1к20 + 8`.
7. Use quick buttons `d4`, `d6`, `d20`, `d100`.
8. Enter `3d6+4` in the global field and press Enter; repeat using the button.
9. Enter invalid text. Confirm the UI shows an error and does not create a roll.
10. Add a statblock to the encounter and click a save directly on its right-hand card without opening it.
11. Reload the page. Statblocks/encounter must persist as before; roll history may reset.
12. Re-run M5 edit/save/backup/merge/split checks to confirm dice rendering did not change document persistence.
