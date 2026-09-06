# M2 manual persistence checklist

The automated suite covers the repository contract with the in-memory implementation and compiles the browser IndexedDB implementation.

Once the React/browser shell exists, verify IndexedDB with this exact lifecycle:

1. Create a `SavedStatblock` and `put()` it.
2. Reload the page.
3. `list()` still contains the statblock.
4. Edit `working`, `put()` the aggregate, reload, and confirm the working edit remains.
5. Explicitly save so `backup` is created, `put()`, reload, and confirm `working/saved/backup` all survive.
6. Delete the statblock, reload, and confirm it is gone.
7. Create two statblocks and confirm `list()` orders them by `updatedAt` newest first.

Do not treat the current diagnostic parser harness as the future library UI. Browser persistence will be exercised directly by the React shell in the next milestone.
