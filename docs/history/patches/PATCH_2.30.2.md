# v2.30.2 — Windows launcher + one-install setup

This patch addresses the first Windows product-launch failure.

## Windows-safe launcher

The previous `dev:product` spawned `npm.cmd` directly. On the tested Windows + Node 24 setup,
Node returned `spawn EINVAL` before either child process started.

The launcher now uses:

```text
process.execPath + process.env.npm_execpath
```

so both backend and frontend npm commands are child Node processes rather than direct `.cmd`
executables.

Windows shutdown still uses `taskkill /T /F` so the npm/tsx/vite child trees are cleaned up.

## One install

The React frontend is now declared as an npm workspace:

```json
"workspaces": ["frontend"]
```

A fresh project therefore needs only:

```bash
npm install
npm run dev:product
```

The frontend keeps its local `file:..` dependency on `statblock-parser-core`; npm workspace
installation supports and links this arrangement.

No parser, job queue, product model, IndexedDB, import semantics, or encounter behavior changed.
