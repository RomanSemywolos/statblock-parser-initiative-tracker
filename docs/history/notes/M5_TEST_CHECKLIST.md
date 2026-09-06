# M5 manual test checklist

1. Start the frontend and add a test statblock.
2. Open it and enter **Редагувати** mode.
3. Change `Armor Class 18` to `Armor Class 20`.
   - The left library row and encounter card should show AC 20 immediately.
   - Wait at least half a second, press F5, and confirm AC 20 remains: this proves working autosave.
4. Press **Повернутися до збереженої**.
   - AC should return to 18.
5. Change AC to 20 again and press **Зберегти**.
   - Working and saved should now match.
6. Change AC to 22 and press **Зберегти** again.
   - **Завантажити резервну** should now be enabled.
7. Press **Завантажити резервну**.
   - Working should become the previous explicit checkpoint (AC 20), while it is shown as different from saved (AC 22).
8. Put the cursor inside an action block and press **Розділити │**.
   - Two blocks should appear and survive F5.
9. Press **Об’єднати ↑** on the second part.
   - The block should become one again and preserve the previous block's semantic role.
10. Add two encounter copies of the same statblock, edit the library document, and verify both cards reflect the updated facts while the encounter copies remain separate entries.
