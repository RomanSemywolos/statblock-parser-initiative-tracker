# Patch 2.74.154 — Settings UI step 2

This release changes presentation only around model/translation settings while keeping the saved/draft semantics introduced in 2.74.153.

- Ready linguistic-model profiles now expose their service URL and model ID as read-only metadata.
- Selecting a ready profile updates the read-only metadata immediately.
- Selecting `Обрати свою модель…` opens editable service URL and model ID fields.
- After a successful Save, custom-model fields leave edit mode and are shown as read-only saved metadata.
- A saved custom model can be explicitly reopened for editing with `Змінити власну модель`.
- Translation custom-service input is grouped directly below the translation-model selector instead of occupying the neighboring grid column.
- Public model profile metadata now optionally contains `serviceUrl`; provider secrets remain backend-only.
- No parser architecture, prompts, model-call count, or parsing semantics changed.

The unsaved-settings interception dialog is intentionally deferred to the next step.
