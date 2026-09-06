# Manual testing

Use this checklist after a release build or before publishing the repository.

## Start the product

```bash
npm install
npm run dev:product
```

Open `http://localhost:5173`. Keep the backend terminal visible so unexpected provider or persistence errors are easy to spot.

## Core smoke test

1. Open **Settings**, select a parser model, and check the connection.
2. Add one multiline statblock and one collapsed single-line statblock.
3. Confirm that each parse job completes once, creates one library entry, and disappears from the job list.
4. Open both cards and compare name, AC, HP, abilities, saves, sections, and source text with the input.
5. Reload the page and confirm that the library, settings, and opened encounter data remain available.

## Editing and backups

1. Edit a header field and a BODY paragraph; wait for autosave and reload.
2. Make another edit, press **Save**, make a third edit, and use **Return to saved**. The manually saved version must return.
3. Use **Load backup**. The original parse result must return, not the most recent manual or automatic save.
4. Reparse the statblock. While the job is queued or processing, deletion must be blocked.
5. After reparse completes, **Load backup** must restore the new parse baseline.
6. If translation is configured, repeat the save/revert/backup checks for Ukrainian. A new translation may replace only the Ukrainian backup baseline.

## Card configuration and counters

1. Open **Configure card**. AC and HP must remain present in the card header and must not be removable.
2. Move the complete AC or HP row below the card as with any other row; its header value must still remain visible at the top.
3. Move a formatted feature below the card. Bold and italic markup must render, not appear as literal `***` characters.
4. For text such as `(3/Day)`, change the counter up and down. It must stay between `0` and `3` and display as `(3/Day = N)`.
5. Move that row below a library card and a combat card. The counter must remain interactive in both places.
6. Reload. Library-card and per-combatant counter values must persist independently.
7. Collapse and expand a moved row. Its compact form must remain one line and its interactive counter must still work.

## Encounter

1. Add the same library creature twice. Confirm that two separate combatants are created.
2. Change HP, initiative, and limited-use counters independently on both instances.
3. Start combat. **End combat** and **Next** must remain pinned at the top of the right sidebar.
4. Press **Next** repeatedly. The active combatant must scroll directly below the pinned controls, and the round count must advance correctly.
5. Edit the library card and confirm that linked combatants show the current library presentation while keeping their own HP, initiative, overrides, and counters.

## Layout and overlays

1. On a wide viewport, scroll the center and each sidebar independently. Scrollbars should be thin and consistently styled.
2. In the left sidebar, the introductory Library text may scroll away, while **Add statblock** remains flush with the top.
3. In the right sidebar, the Encounter introduction may scroll away, while the battle heading and controls remain flush with the top.
4. Narrow the viewport until both sidebars become edge strips. Open each strip and click outside it; the sidebar must close.
5. Open a card action menu and click outside it; the menu must close.

## Settings guard and failures

1. Change a setting and click outside Settings. Verify the save/discard/stay confirmation.
2. Stop the backend and attempt a parse or connection check. The UI must show a user-facing message without raw `Failed to fetch`, environment-variable instructions, or upstream secrets.
3. Restart the backend and confirm normal recovery without clearing browser storage.
