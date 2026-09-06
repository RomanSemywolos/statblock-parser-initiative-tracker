# v2.30.1 — Import composer / backend UX fix

This patch fixes two issues found during the first real M13 browser run.

1. The raw statblock input was technically present but hidden behind a toggle inside the 260 px
   library sidebar. It is now a large central-workspace composer and is visible on initial launch.
2. Background parse-job polling no longer turns a missing backend into a permanent red
   `Failed to fetch` import error. Backend reachability is shown as a neutral status; an explicit
   failed import gives a useful message with the configured Backend URL.
3. `npm run dev:product` starts the parser backend and Vite frontend together. This is now the
   recommended local product launch command.

No parser logic, queue semantics, product DTOs, IndexedDB schema, or encounter behavior changed.
