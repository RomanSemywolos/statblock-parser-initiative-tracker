# M4 manual test checklist

1. Start the M3/M4 React frontend and make sure at least one test statblock exists in the left library.
2. Click `+` next to that statblock twice.
   - The right sidebar must show two separate cards (`#1`, `#2`).
   - The library must still contain only one saved statblock.
3. Drag the same statblock from the left sidebar to the right sidebar.
   - A third combatant must appear.
   - Dragging must copy, never remove the library row.
4. Click each combatant card.
   - The center must open the same underlying statblock.
   - The center heading must identify the selected combatant copy when duplicates exist.
5. Press `×` on the second combatant.
   - Only that combatant disappears.
   - The saved statblock and other copies remain.
6. Reload the page (F5).
   - The right-side encounter list must survive reload.
7. Delete the saved statblock from the left sidebar.
   - All encounter copies that reference it must disappear as well.
   - Reload once more and verify no orphan cards return.
