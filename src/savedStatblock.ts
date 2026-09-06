import type {
  CardConfig,
  EditableStatblockDocument,
  SavedStatblock,
  VersionedDocument,
  ImportedParserMode,
  ImportedParserStructure,
} from "./productModel.js";
import { migrateEditableStatblockDocument, migrateSavedStatblock } from "./productMigration.js";

export const DEFAULT_CARD_CONFIG: Readonly<CardConfig> = Object.freeze({
  showName: true,
  showArmorClass: true,
  showSavingThrows: true,
  customContentIds: [],
});

export type CreateSavedStatblockOptions = {
  parserVersion: string;
  parserStructure?: ImportedParserStructure | null;
  parserMode?: ImportedParserMode | null;
  rawSource?: string | null;
  id?: string;
  now?: string;
  idFactory?: () => string;
};

function cloneDocument(document: EditableStatblockDocument): EditableStatblockDocument {
  return structuredClone(document);
}

function resolveNow(now?: string): string {
  return now ?? new Date().toISOString();
}

function resolveId(options: CreateSavedStatblockOptions): string {
  if (options.id !== undefined) return options.id;
  if (options.idFactory !== undefined) return options.idFactory();
  return crypto.randomUUID();
}

export function createVersionedDocument(document: EditableStatblockDocument, now?: string): VersionedDocument {
  const timestamp = resolveNow(now);
  const migrated = migrateEditableStatblockDocument(document);
  return {
    working: cloneDocument(migrated),
    saved: cloneDocument(migrated),
    backup: cloneDocument(migrated),
    workingUpdatedAt: timestamp,
    savedAt: timestamp,
  };
}

export function createSavedStatblock(
  englishDocument: EditableStatblockDocument,
  options: CreateSavedStatblockOptions,
): SavedStatblock {
  const timestamp = resolveNow(options.now);
  return {
    formatVersion: "saved-statblock-v2",
    id: resolveId(options),
    versions: {
      en: createVersionedDocument(englishDocument, timestamp),
    },
    cardConfig: {
      ...DEFAULT_CARD_CONFIG,
      customContentIds: [],
    },
    importedWithParserVersion: options.parserVersion,
    importedParserStructure: options.parserStructure ?? null,
    importedParserMode: options.parserMode ?? null,
    rawSource: options.rawSource ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export type ReplaceSavedStatblockFromParseOptions = {
  parserVersion: string;
  parserStructure?: ImportedParserStructure | null;
  parserMode?: ImportedParserMode | null;
  rawSource: string | null;
  now?: string;
};

export function replaceSavedStatblockFromParse(
  statblock: SavedStatblock,
  englishDocument: EditableStatblockDocument,
  options: ReplaceSavedStatblockFromParseOptions,
): SavedStatblock {
  const current = migrateSavedStatblock(statblock);
  const timestamp = resolveNow(options.now);
  return {
    ...current,
    versions: {
      en: createVersionedDocument(englishDocument, timestamp),
    },
    cardConfig: {
      ...current.cardConfig,
      customContentIds: [],
    },
    importedWithParserVersion: options.parserVersion,
    importedParserStructure: options.parserStructure ?? null,
    importedParserMode: options.parserMode ?? null,
    rawSource: options.rawSource,
    updatedAt: timestamp,
  };
}

export function updateWorkingDocument(
  version: VersionedDocument,
  document: EditableStatblockDocument,
  now?: string,
): VersionedDocument {
  return {
    ...version,
    working: cloneDocument(document),
    workingUpdatedAt: resolveNow(now),
  };
}

export function saveWorkingDocument(version: VersionedDocument, now?: string): VersionedDocument {
  const timestamp = resolveNow(now);
  return {
    working: cloneDocument(version.working),
    saved: cloneDocument(version.working),
    // The backup is the immutable parser/translation baseline. Manual saves
    // update only the explicit checkpoint and must never rotate the baseline.
    backup: version.backup === null ? null : cloneDocument(version.backup),
    workingUpdatedAt: timestamp,
    savedAt: timestamp,
  };
}

export function revertWorkingToSaved(version: VersionedDocument, now?: string): VersionedDocument {
  return {
    ...version,
    working: cloneDocument(version.saved),
    workingUpdatedAt: resolveNow(now),
  };
}

export function restoreBackupToWorking(version: VersionedDocument, now?: string): VersionedDocument {
  if (version.backup === null) return version;
  return {
    ...version,
    working: cloneDocument(version.backup),
    workingUpdatedAt: resolveNow(now),
  };
}

export function updateSavedStatblockEnglishWorking(
  statblock: SavedStatblock,
  document: EditableStatblockDocument,
  now?: string,
): SavedStatblock {
  const current = migrateSavedStatblock(statblock);
  const timestamp = resolveNow(now);
  return {
    ...current,
    versions: {
      ...current.versions,
      en: updateWorkingDocument(current.versions.en, document, timestamp),
    },
    updatedAt: timestamp,
  };
}

export function saveSavedStatblockEnglish(statblock: SavedStatblock, now?: string): SavedStatblock {
  const current = migrateSavedStatblock(statblock);
  const timestamp = resolveNow(now);
  return {
    ...current,
    versions: {
      ...current.versions,
      en: saveWorkingDocument(current.versions.en, timestamp),
    },
    updatedAt: timestamp,
  };
}

export function revertSavedStatblockEnglishWorking(statblock: SavedStatblock, now?: string): SavedStatblock {
  const current = migrateSavedStatblock(statblock);
  const timestamp = resolveNow(now);
  return {
    ...current,
    versions: {
      ...current.versions,
      en: revertWorkingToSaved(current.versions.en, timestamp),
    },
    updatedAt: timestamp,
  };
}

export function restoreSavedStatblockEnglishBackupToWorking(statblock: SavedStatblock, now?: string): SavedStatblock {
  const current = migrateSavedStatblock(statblock);
  const timestamp = resolveNow(now);
  const restored = restoreBackupToWorking(current.versions.en, timestamp);
  if (restored === current.versions.en) return current;
  return {
    ...current,
    versions: {
      ...current.versions,
      en: restored,
    },
    updatedAt: timestamp,
  };
}

export function createOrReplaceSavedStatblockUkrainian(
  statblock: SavedStatblock,
  document: EditableStatblockDocument,
  now?: string,
): SavedStatblock {
  const current = migrateSavedStatblock(statblock);
  const timestamp = resolveNow(now);
  return {
    ...current,
    versions: { ...current.versions, uk: createVersionedDocument(document, timestamp) },
    updatedAt: timestamp,
  };
}

export function updateSavedStatblockUkrainianWorking(
  statblock: SavedStatblock,
  document: EditableStatblockDocument,
  now?: string,
): SavedStatblock {
  const current = migrateSavedStatblock(statblock);
  if (current.versions.uk === undefined) return createOrReplaceSavedStatblockUkrainian(current, document, now);
  const timestamp = resolveNow(now);
  return {
    ...current,
    versions: { ...current.versions, uk: updateWorkingDocument(current.versions.uk, document, timestamp) },
    updatedAt: timestamp,
  };
}

export function saveSavedStatblockUkrainian(statblock: SavedStatblock, now?: string): SavedStatblock {
  const current = migrateSavedStatblock(statblock);
  if (current.versions.uk === undefined) return current;
  const timestamp = resolveNow(now);
  return {
    ...current,
    versions: { ...current.versions, uk: saveWorkingDocument(current.versions.uk, timestamp) },
    updatedAt: timestamp,
  };
}

export function revertSavedStatblockUkrainianWorking(statblock: SavedStatblock, now?: string): SavedStatblock {
  const current = migrateSavedStatblock(statblock);
  if (current.versions.uk === undefined) return current;
  const timestamp = resolveNow(now);
  return {
    ...current,
    versions: { ...current.versions, uk: revertWorkingToSaved(current.versions.uk, timestamp) },
    updatedAt: timestamp,
  };
}

export function restoreSavedStatblockUkrainianBackupToWorking(statblock: SavedStatblock, now?: string): SavedStatblock {
  const current = migrateSavedStatblock(statblock);
  if (current.versions.uk === undefined) return current;
  const timestamp = resolveNow(now);
  const restored = restoreBackupToWorking(current.versions.uk, timestamp);
  if (restored === current.versions.uk) return current;
  return { ...current, versions: { ...current.versions, uk: restored }, updatedAt: timestamp };
}

export function updateSavedStatblockCardConfig(
  statblock: SavedStatblock,
  cardConfig: CardConfig,
  now?: string,
): SavedStatblock {
  const current = migrateSavedStatblock(statblock);
  return {
    ...current,
    cardConfig: {
      ...cardConfig,
      showArmorClass: true,
      customContentIds: [...cardConfig.customContentIds],
    },
    updatedAt: resolveNow(now),
  };
}
