export {
  DEFAULT_CARD_CONFIG,
  createSavedStatblock,
  createVersionedDocument,
  createOrReplaceSavedStatblockUkrainian,
  restoreBackupToWorking,
  restoreSavedStatblockEnglishBackupToWorking,
  restoreSavedStatblockUkrainianBackupToWorking,
  replaceSavedStatblockFromParse,
  revertSavedStatblockEnglishWorking,
  revertSavedStatblockUkrainianWorking,
  revertWorkingToSaved,
  saveSavedStatblockEnglish,
  saveSavedStatblockUkrainian,
  saveWorkingDocument,
  updateSavedStatblockCardConfig,
  updateSavedStatblockEnglishWorking,
  updateSavedStatblockUkrainianWorking,
  updateWorkingDocument,
} from "./savedStatblock.js";
export type { CreateSavedStatblockOptions, ReplaceSavedStatblockFromParseOptions } from "./savedStatblock.js";

export { PRODUCT_STATBLOCK_SECTIONS } from "./productModel.js";

export type {
  CardConfig,
  EditableAbilityFact,
  EditableHeaderEvidenceField,
  EditableHeaderRow,
  EditableInitiativeFact,
  EditableStatblockDocument,
  EditableStatblockHeader,
  EditableStatblockNode,
  ImportedParserMode,
  ImportedParserStructure,
  ProductAbilityKey,
  ProductHeaderField,
  ProductStatblockSection,
  SavedStatblock,
  SavedStatblockLanguageVersions,
  StatblockFacts,
  VersionedDocument,
} from "./productModel.js";

export {
  compareSavedStatblocksByName,
  IndexedDbStatblockRepository,
  MemoryStatblockRepository,
} from "./statblockRepository.js";
export type { IndexedDbStatblockRepositoryOptions, StatblockRepository } from "./statblockRepository.js";

export {
  addStatblockCombatant,
  addStubCombatant,
  advanceCombatTurn,
  createCombatHpState,
  createEmptyEncounter,
  createStatblockCombatant,
  createStubCombatant,
  damageCombatHp,
  damageCombatant,
  effectiveCombatHpMaximum,
  endCombat,
  grantTemporaryCombatHp,
  grantTemporaryHpToCombatant,
  healCombatHp,
  healCombatant,
  initializeCombatantHp,
  modifyCombatHpMaximum,
  orderedEncounterCombatants,
  modifyCombatantHpMaximum,
  removeCombatant,
  removeCombatantsForStatblock,
  rollCombatantInitiative,
  resetCombatHp,
  resetCombatantHp,
  setCombatantInitiative,
  setCombatantNameOverride,
  setStatblockCombatantLimitedUse,
  startCombat,
  updateStatblockCombatantDocument,
  updateStatblockCombatantCard,
  updateStatblockCombatantCardConfig,
  updateStubCombatant,
  updateCombatantHp,
} from "./encounterModel.js";
export type {
  CombatHpState,
  Combatant,
  InitiativeRandomSource,
  CreateStatblockCombatantOptions,
  CreateStubCombatantOptions,
  EncounterState,
  StubCombatantPatch,
  StatblockCombatant,
  StatblockCombatantCardPatch,
  StubAbilityKey,
  StubCombatant,
} from "./encounterModel.js";

export { IndexedDbEncounterRepository, MemoryEncounterRepository } from "./encounterRepository.js";
export type { EncounterRepository, IndexedDbEncounterRepositoryOptions } from "./encounterRepository.js";

export {
  addEditableHeaderRow,
  applyEditableAutoStyle,
  editEditableAbility,
  editEditableHeaderText,
  editEditableNodeText,
  editEditableSavingThrow,
  ensureEditableHeaderSubtitle,
  insertEditableNodeAfter,
  setEditableHeaderName,
  setEditableHeaderSubtitle,
  mergeEditableNodeWithNext,
  mergeEditableNodeWithPrevious,
  refreshEditableStatblockFacts,
  removeEditableHeaderRow,
  removeEditableNode,
  replaceEditableBody,
  splitEditableNodeAt,
  splitEditableNodeText,
  toggleEditableNodeHeading,
} from "./editableDocument.js";
export type { NodeIdFactory } from "./editableDocument.js";

export { isLegacySavedStatblock, migrateEditableStatblockDocument, migrateSavedStatblock } from "./productMigration.js";

export {
  d20WithModifier,
  findDiceExpressions,
  findD20Modifiers,
  findLimitedUseExpressions,
  findRechargeExpressions,
  formatDiceExpression,
  normalizeDiceExpression,
  parseDiceExpression,
  rollDice,
  rollDiceText,
} from "./dice.js";
export type {
  DiceExpression,
  D20ModifierMatch,
  DiceExpressionMatch,
  LimitedUseExpressionMatch,
  RechargeExpressionMatch,
  DiceRollResult,
  RandomSource,
} from "./dice.js";

export { createLibraryExport, parseLibraryExport, serializeLibraryExport } from "./libraryTransfer.js";
export type { LibraryExportV2 } from "./libraryTransfer.js";

export { APP_SETTINGS_FORMAT_VERSION, createAppSettings, updateAppSettings } from "./settings.js";
export type { AppSettings, CreateAppSettingsOptions, TranslationProviderType } from "./settings.js";

export { IndexedDbSettingsRepository, MemorySettingsRepository } from "./settingsRepository.js";
export type { IndexedDbSettingsRepositoryOptions, SettingsRepository } from "./settingsRepository.js";

export { HttpParserBackendApi } from "./parserBackendClient.js";
export { CUSTOM_MODEL_PROFILE_ID } from "./modelProvider.js";
export type {
  ParserBackendApi,
  ParserBackendHealth,
  ParserModelProfile,
  ParserModelProfileStatus,
  ParserModelHealth,
} from "./parserBackendClient.js";

export { HttpParseJobsApi } from "./parseJobClient.js";
export type { HttpParseJobsApiOptions, ParseJobsApi } from "./parseJobClient.js";
export type {
  ParseJobError,
  ParseJobFailureStage,
  ParseJobResult,
  ParseJobStatus,
  ParseJobSummary,
} from "./parseJobs.js";

export {
  protectTranslationMechanics,
  restoreTranslationMechanics,
  validateTranslationMechanics,
} from "./translationMechanics.js";
export type {
  MechanicsValidationIssue,
  MechanicsValidationResult,
  ProtectedMechanic,
  ProtectedMechanicKind,
  ProtectedTranslationText,
} from "./translationMechanics.js";
export { TRANSLATION_GLOSSARY, applyExactGlossary, findGlossaryMatches, glossaryEntry } from "./translationGlossary.js";
export type { GlossaryMatch, TranslationGlossaryEntry } from "./translationGlossary.js";
export { applyDndTranslationRules } from "./translationRules.js";
export type { RuleTranslation } from "./translationRules.js";
export { prepareEnglishForUkrainianTranslation } from "./translationPipeline.js";
export type { DeterministicTranslationPreparation } from "./translationPipeline.js";

export { NoopTranslationProvider } from "./translationProvider.js";
export type {
  TranslationLanguage,
  TranslationProvider,
  TranslationProviderHealth,
  TranslationRequest,
  TranslationResult,
} from "./translationProvider.js";
export { LibreTranslateProvider } from "./libreTranslateProvider.js";
export type { LibreTranslateProviderOptions } from "./libreTranslateProvider.js";
export { DeepLTranslationProvider } from "./deeplTranslationProvider.js";
export type { DeepLTranslationProviderOptions } from "./deeplTranslationProvider.js";
export { HttpBackendTranslationProvider } from "./backendTranslationProvider.js";
export type { HttpBackendTranslationProviderOptions } from "./backendTranslationProvider.js";

export {
  translateEditableStatblockDeterministic,
  translateEditableStatblockWithProvider,
} from "./translationDocument.js";
export type { DeterministicDocumentTranslation, MachineDocumentTranslation } from "./translationDocument.js";

export { PARSER_MODES, detectParserStructure } from "./parserRouting.js";
export type {
  ParserMode,
  ResolvedParserMode,
  DetectedParserStructure,
  ParserRoutingDecision,
  ParserRoutingSignal,
} from "./parserRouting.js";

export { awaitAutosaveWritesForIds, cancelPendingAutosavesForIds } from "./autosaveCoordination.js";
