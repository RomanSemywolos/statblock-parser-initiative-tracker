# Patch 2.74.1

Fix LibreTranslate browser fetch invocation.

`LibreTranslateProvider` previously stored the browser `fetch` function as a detached reference and invoked it later as an object method. In browsers where `Window.fetch` validates its receiver this caused:

`Failed to execute 'fetch' on 'Window': Illegal invocation`

The default provider now binds `globalThis.fetch` to `globalThis` when it is captured. Injected `fetchImpl` values used by tests remain unchanged.
