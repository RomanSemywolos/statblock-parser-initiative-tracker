# Patch 2.68.2

- Removed parser mode from the persisted AppSettings model. Parser strategy is now exclusively an import-time choice in the text input panel.
- Legacy IndexedDB settings containing `parserMode` are tolerated and the obsolete property is dropped whenever settings are rewritten.
- Styled the import parser selector with the same light control surface used by workspace settings.
