# M13 manual test checklist

## Automated first

From the project root:

```bash
npm install
npm run typecheck
npm test
npm run build
npm run build:frontend
```

Then start the complete product:

```bash
npm run dev:product
```

## Single import

1. From the project root run `npm run dev:product` to start backend and React frontend together.
2. Open `+ Імпортувати`.
3. Paste a real statblock and press `Розібрати`.
4. Confirm the import field closes immediately.
5. Continue using another statblock/encounter while parsing runs.
6. Confirm the sidebar shows `У черзі` / `Розбирається · N с`.
7. When complete, confirm exactly one new SavedStatblock appears.
8. F5 and confirm it remains.

## Queue

1. Submit 5–6 real statblocks one after another without waiting.
2. Confirm at most one is `processing`; the rest remain `queued`.
3. Confirm each eventually appears exactly once in the local library.
4. Confirm completing one job never changes the statblock currently open in the center.

## Browser reload

1. Submit several jobs.
2. F5 while one is processing and others are queued.
3. Confirm the same jobs return in the sidebar and continue.

## Backend restart

1. Submit at least two jobs.
2. Stop the backend while one is processing.
3. Start it again.
4. Confirm the former `processing` job is re-run and queued jobs are preserved.
5. Confirm all results eventually import.

## Failed/retry

1. Temporarily configure an invalid model profile or otherwise force a real backend job failure.
2. Confirm the failed job remains visible with an error and retained source.
3. Restore the backend/model configuration.
4. Press `Повторити`.
5. Confirm it completes without pasting the source again.

## ACK/idempotency

1. Complete a job and verify the resulting `SavedStatblock.id` equals the job `statblockId`.
2. Simulate/reproduce an ACK failure if convenient (or inspect with devtools).
3. Confirm a repeated completed-result delivery performs upsert/ACK and does not duplicate the statblock.

## Client routing

1. Open the application in another browser/profile/device.
2. Confirm its parse-job list is independent.
3. This is routing only; do not treat `clientId` as authentication.

## Regression

Verify that the old diagnostic `/api/parse` page still parses a known regression statblock.
Then regression-test Zuggtmoy, Aboleth, Arasta/Scion through the new React import flow.
