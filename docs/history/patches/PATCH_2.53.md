# v2.53 — M14.1–14.2 translation UI and independent UK working copy

- Adds EN/UK language controls for library statblocks.
- `Перекласти → UK` creates a deterministic partial Ukrainian document from current EN working state.
- Existing UK is never silently overwritten; explicit retranslation requires confirmation and replaces the UK working/saved/backup lineage.
- EN and UK have independent working/saved/backup checkpoints using the existing `SavedStatblockLanguageVersions` model.
- Editing, Save, Revert, Restore Backup operate on the selected language.
- Translation leaves unresolved prose in English by design until MT is added.
- Standard semantic section headings are localized from `headingKind`, while prose/header text goes through M14.1–14.2 protector/rules/glossary pipeline.
- Mechanics validation result is surfaced after translation.
- Encounter inheritance remains EN for now; this patch is the library translation/test surface, not encounter-language selection.
