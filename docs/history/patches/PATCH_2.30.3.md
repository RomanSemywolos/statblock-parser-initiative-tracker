# v2.30.3 — explicit import entry point

The import composer no longer opens automatically on every page reload.

The Library sidebar now has a prominent full-width:

```text
+ Імпортувати statblock
```

button directly below the Library header. It opens the central raw-text composer. Closing the
composer or successfully submitting a job hides it again.

This is a UI-only patch. Parser, job queue, persistence, ModelProvider, SavedStatblock, encounter,
and translation-ready language versioning are unchanged.
