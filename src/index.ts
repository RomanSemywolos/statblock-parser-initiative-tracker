export { parseForProduct } from "./productParser.js";
export type { ParseForProductInput } from "./productParser.js";
export {
  DEFAULT_CARD_CONFIG,
  createSavedStatblock,
  createVersionedDocument,
  createOrReplaceSavedStatblockUkrainian,
  restoreBackupToWorking,
  restoreSavedStatblockEnglishBackupToWorking,
  restoreSavedStatblockUkrainianBackupToWorking,
  revertSavedStatblockEnglishWorking,
  revertSavedStatblockUkrainianWorking,
  revertWorkingToSaved,
  saveSavedStatblockEnglish,
  saveSavedStatblockUkrainian,
  saveWorkingDocument,
  updateSavedStatblockEnglishWorking,
  updateSavedStatblockUkrainianWorking,
  updateWorkingDocument,
} from "./savedStatblock.js";
export type { CreateSavedStatblockOptions } from "./savedStatblock.js";
export type {
  CardConfig,
  EditableAbilityFact,
  EditableHeaderRow,
  EditableInitiativeFact,
  EditableStatblockDocument,
  EditableStatblockHeader,
  EditableStatblockNode,
  ImportedParserStructure,
  ProductAbilityKey,
  ProductHeaderField,
  ProductStatblockSection,
  SavedStatblock,
  SavedStatblockLanguageVersions,
  StatblockFacts,
  VersionedDocument,
} from "./productModel.js";

export { isLegacySavedStatblock, migrateEditableStatblockDocument, migrateSavedStatblock } from "./productMigration.js";
export { IndexedDbStatblockRepository, MemoryStatblockRepository } from "./statblockRepository.js";
export type { IndexedDbStatblockRepositoryOptions, StatblockRepository } from "./statblockRepository.js";

export {
  addStatblockCombatant,
  createEmptyEncounter,
  createStatblockCombatant,
  removeCombatant,
  removeCombatantsForStatblock,
  setStatblockCombatantLimitedUse,
} from "./encounterModel.js";
export type { CreateStatblockCombatantOptions, EncounterState, StatblockCombatant } from "./encounterModel.js";
export { IndexedDbEncounterRepository, MemoryEncounterRepository } from "./encounterRepository.js";
export type { EncounterRepository, IndexedDbEncounterRepositoryOptions } from "./encounterRepository.js";

export {
  d20WithModifier,
  findDiceExpressions,
  findLimitedUseExpressions,
  formatDiceExpression,
  normalizeDiceExpression,
  parseDiceExpression,
  rollDice,
  rollDiceText,
} from "./dice.js";
export type {
  DiceExpression,
  DiceExpressionMatch,
  LimitedUseExpressionMatch,
  DiceRollResult,
  RandomSource,
} from "./dice.js";

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
export { assertValidSourceOwnershipMap, resolveAcceptedHeaderOwnership } from "./sourceOwnership.js";
export type {
  SourceOwnershipChannel,
  SourceOwnershipMap,
  SourceOwnershipOwner,
  SourceOwnershipProvenance,
  SourceOwnershipRange,
} from "./sourceOwnership.js";
export { assertValidRemainderView, buildRemainderView } from "./sourceRemainder.js";
export type { RemainderDiscontinuity, RemainderSegment, RemainderView } from "./sourceRemainder.js";
export { auditSinglelineCandidateLattice, SINGLELINE_CANDIDATE_AUDIT_ORIGINS } from "./singlelineCandidateAudit.js";
export { reconstructSinglelineStructure, SINGLELINE_SYNTHETIC_EVIDENCE } from "./singlelineStructuralReconstruction.js";
export type {
  SinglelineStructuralReconstruction,
  SinglelineSyntheticEntry,
  SinglelineSyntheticEvidenceKind,
  SinglelineSyntheticRole,
} from "./singlelineStructuralReconstruction.js";
export type {
  SinglelineCandidateAudit,
  SinglelineCandidateAuditEntry,
  SinglelineCandidateAuditOrigin,
  SinglelineCandidateAuditRole,
} from "./singlelineCandidateAudit.js";
