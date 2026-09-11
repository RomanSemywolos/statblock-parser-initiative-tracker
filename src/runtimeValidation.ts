import {
  PRODUCT_ABILITY_KEYS,
  PRODUCT_HEADER_FIELDS,
  PRODUCT_STATBLOCK_SECTIONS,
  type CardConfig,
  type EditableHeaderRow,
  type EditableStatblockDocument,
  type StatblockFacts,
} from "./productModel.js";
import type { EncounterState } from "./encounterModel.js";
import type { AppSettings } from "./settings.js";
import type { ParseJobRecord } from "./parseJobs.js";
import type { ParseDiagnosticsReport } from "./parseDiagnostics.js";

type UnknownRecord = Record<string, unknown>;

const HEADER_FIELDS = new Set<string>(PRODUCT_HEADER_FIELDS);
const SECTIONS = new Set<string>(PRODUCT_STATBLOCK_SECTIONS);
const ABILITY_KEYS = new Set<string>(PRODUCT_ABILITY_KEYS);
const EVIDENCE_FIELDS = new Set([
  "armor_class",
  "hit_points",
  "ability_scores",
  "saving_throws",
  "challenge",
  "proficiency_bonus",
]);

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${path} must be an object.`);
  return value as UnknownRecord;
}

function string(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") throw new Error(`${path} must be a string.`);
}

function boolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean.`);
}

function finiteNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path} must be a finite number.`);
}

function nullableString(value: unknown, path: string): void {
  if (value !== null) string(value, path);
}

function nullableFiniteNumber(value: unknown, path: string): void {
  if (value !== null) finiteNumber(value, path);
}

function array(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
}

function headerRow(value: unknown, path: string): asserts value is EditableHeaderRow {
  const row = record(value, path);
  string(row.id, `${path}.id`);
  string(row.field, `${path}.field`);
  if (!HEADER_FIELDS.has(row.field)) throw new Error(`${path}.field is not supported.`);
  string(row.text, `${path}.text`);
}

function abilityMap(value: unknown, path: string, factValues: boolean): void {
  const map = record(value, path);
  for (const key of PRODUCT_ABILITY_KEYS) {
    const current = map[key];
    if (current === null) continue;
    if (!factValues) {
      finiteNumber(current, `${path}.${key}`);
      continue;
    }
    const fact = record(current, `${path}.${key}`);
    nullableFiniteNumber(fact.score, `${path}.${key}.score`);
    nullableFiniteNumber(fact.modifier, `${path}.${key}.modifier`);
  }
}

function statblockFacts(value: unknown, path: string): asserts value is StatblockFacts {
  const facts = record(value, path);
  nullableString(facts.name, `${path}.name`);
  nullableFiniteNumber(facts.armorClass, `${path}.armorClass`);
  nullableFiniteNumber(facts.hitPointMaximum, `${path}.hitPointMaximum`);
  if (facts.initiative !== null) {
    const initiative = record(facts.initiative, `${path}.initiative`);
    finiteNumber(initiative.modifier, `${path}.initiative.modifier`);
    if (initiative.provenance !== "printed" && initiative.provenance !== "dex_modifier") {
      throw new Error(`${path}.initiative.provenance is not supported.`);
    }
  }
  abilityMap(facts.abilities, `${path}.abilities`, true);
  abilityMap(facts.savingThrows, `${path}.savingThrows`, false);
  nullableFiniteNumber(facts.proficiencyBonus, `${path}.proficiencyBonus`);
}

export function assertEditableStatblockDocument(
  value: unknown,
  path = "editable statblock",
): asserts value is EditableStatblockDocument {
  const document = record(value, path);
  if (document.formatVersion !== "editable-statblock-v2") throw new Error(`${path} has an unsupported format.`);
  string(document.language, `${path}.language`);
  const header = record(document.header, `${path}.header`);
  if (header.name !== null) headerRow(header.name, `${path}.header.name`);
  if (header.subtitle !== null) headerRow(header.subtitle, `${path}.header.subtitle`);
  array(header.primaryRows, `${path}.header.primaryRows`);
  header.primaryRows.forEach((row, index) => headerRow(row, `${path}.header.primaryRows[${index}]`));
  abilityMap(header.abilities, `${path}.header.abilities`, true);
  abilityMap(header.savingThrows, `${path}.header.savingThrows`, false);
  array(header.secondaryRows, `${path}.header.secondaryRows`);
  header.secondaryRows.forEach((row, index) => headerRow(row, `${path}.header.secondaryRows[${index}]`));
  if (header.evidence !== undefined) {
    array(header.evidence, `${path}.header.evidence`);
    header.evidence.forEach((entry, index) => {
      const evidence = record(entry, `${path}.header.evidence[${index}]`);
      string(evidence.id, `${path}.header.evidence[${index}].id`);
      string(evidence.text, `${path}.header.evidence[${index}].text`);
      array(evidence.fields, `${path}.header.evidence[${index}].fields`);
      evidence.fields.forEach((field, fieldIndex) => {
        string(field, `${path}.header.evidence[${index}].fields[${fieldIndex}]`);
        if (!EVIDENCE_FIELDS.has(field)) throw new Error(`${path}.header.evidence contains an unsupported field.`);
      });
    });
  }
  array(document.body, `${path}.body`);
  document.body.forEach((entry, index) => {
    const node = record(entry, `${path}.body[${index}]`);
    string(node.id, `${path}.body[${index}].id`);
    string(node.text, `${path}.body[${index}].text`);
    if (node.type === "paragraph") return;
    if (node.type !== "heading") throw new Error(`${path}.body[${index}].type is not supported.`);
    if (node.headingKind !== null) {
      string(node.headingKind, `${path}.body[${index}].headingKind`);
      if (!SECTIONS.has(node.headingKind)) throw new Error(`${path}.body[${index}].headingKind is not supported.`);
    }
  });
  statblockFacts(document.facts, `${path}.facts`);
}

export function assertCardConfig(value: unknown, path = "card config"): asserts value is CardConfig {
  const config = record(value, path);
  boolean(config.showName, `${path}.showName`);
  boolean(config.showArmorClass, `${path}.showArmorClass`);
  boolean(config.showSavingThrows, `${path}.showSavingThrows`);
  array(config.customContentIds, `${path}.customContentIds`);
  config.customContentIds.forEach((id, index) => string(id, `${path}.customContentIds[${index}]`));
}

function hpState(value: unknown, path: string): void {
  if (value === null) return;
  const hp = record(value, path);
  finiteNumber(hp.baseMax, `${path}.baseMax`);
  finiteNumber(hp.current, `${path}.current`);
  finiteNumber(hp.temp, `${path}.temp`);
  finiteNumber(hp.maxModifier, `${path}.maxModifier`);
}

function savingThrows(value: unknown, path: string, partial: boolean): void {
  const throws = record(value, path);
  for (const [key, current] of Object.entries(throws)) {
    if (!ABILITY_KEYS.has(key)) throw new Error(`${path}.${key} is not supported.`);
    nullableFiniteNumber(current, `${path}.${key}`);
  }
  if (!partial)
    for (const key of PRODUCT_ABILITY_KEYS) if (!(key in throws)) throw new Error(`${path}.${key} is required.`);
}

export function assertEncounterState(value: unknown): asserts value is EncounterState {
  const encounter = record(value, "encounter");
  if (encounter.formatVersion !== "encounter-v3") throw new Error("Encounter has an unsupported format.");
  array(encounter.combatants, "encounter.combatants");
  encounter.combatants.forEach((entry, index) => {
    const path = `encounter.combatants[${index}]`;
    const combatant = record(entry, path);
    string(combatant.id, `${path}.id`);
    string(combatant.createdAt, `${path}.createdAt`);
    finiteNumber(combatant.initiativeModifier, `${path}.initiativeModifier`);
    nullableFiniteNumber(combatant.initiativeRoll, `${path}.initiativeRoll`);
    hpState(combatant.hp, `${path}.hp`);
    if (combatant.kind === "stub" && combatant.formatVersion === "stub-combatant-v2") {
      string(combatant.displayName, `${path}.displayName`);
      nullableFiniteNumber(combatant.armorClass, `${path}.armorClass`);
      savingThrows(combatant.savingThrows, `${path}.savingThrows`, false);
      return;
    }
    if (combatant.kind !== "statblock" || combatant.formatVersion !== "statblock-combatant-v3") {
      throw new Error(`${path} has an unsupported format.`);
    }
    string(combatant.statblockId, `${path}.statblockId`);
    assertEditableStatblockDocument(combatant.document, `${path}.document`);
    assertCardConfig(combatant.cardConfig, `${path}.cardConfig`);
    nullableString(combatant.nameOverride, `${path}.nameOverride`);
    if (combatant.armorClassOverride !== undefined)
      nullableFiniteNumber(combatant.armorClassOverride, `${path}.armorClassOverride`);
    if (combatant.savingThrowOverrides !== undefined)
      savingThrows(combatant.savingThrowOverrides, `${path}.savingThrowOverrides`, true);
    const uses = record(combatant.limitedUses, `${path}.limitedUses`);
    for (const [key, count] of Object.entries(uses)) {
      if (key.length === 0) throw new Error(`${path}.limitedUses contains an empty key.`);
      finiteNumber(count, `${path}.limitedUses.${key}`);
    }
  });
  boolean(encounter.active, "encounter.active");
  nullableFiniteNumber(encounter.round, "encounter.round");
  nullableString(encounter.currentCombatantId, "encounter.currentCombatantId");
  string(encounter.updatedAt, "encounter.updatedAt");
}

export function assertStoredAppSettings(value: unknown): asserts value is AppSettings {
  const settings = record(value, "settings");
  if (settings.formatVersion !== "app-settings-v1") throw new Error("Settings have an unsupported format.");
  string(settings.backendUrl, "settings.backendUrl");
  nullableString(settings.activeParserModelProfileId, "settings.activeParserModelProfileId");
  if (settings.customParserModel !== undefined && settings.customParserModel !== null) {
    const custom = record(settings.customParserModel, "settings.customParserModel");
    string(custom.baseUrl, "settings.customParserModel.baseUrl");
    string(custom.model, "settings.customParserModel.model");
  }
  if (
    settings.translationProviderType !== undefined &&
    settings.translationProviderType !== "deepl" &&
    settings.translationProviderType !== "libretranslate"
  ) {
    throw new Error("settings.translationProviderType is not supported.");
  }
  if (settings.translationProviderUrl !== undefined)
    string(settings.translationProviderUrl, "settings.translationProviderUrl");
  if (
    settings.defaultStatblockLanguage !== undefined &&
    settings.defaultStatblockLanguage !== "en" &&
    settings.defaultStatblockLanguage !== "uk"
  ) {
    throw new Error("settings.defaultStatblockLanguage is not supported.");
  }
  string(settings.updatedAt, "settings.updatedAt");
}

function parserMode(value: unknown, path: string): void {
  if (value !== "auto" && value !== "multiline" && value !== "singleline" && value !== "generic") {
    throw new Error(`${path} is not supported.`);
  }
}

function parseJobError(value: unknown, path: string): void {
  if (value === null) return;
  const error = record(value, path);
  if (error.stage !== "model" && error.stage !== "parser" && error.stage !== "compile" && error.stage !== "internal") {
    throw new Error(`${path}.stage is not supported.`);
  }
  string(error.message, `${path}.message`);
}

export function assertParseJobRecord(value: unknown): asserts value is ParseJobRecord {
  const job = record(value, "parse job");
  for (const key of ["id", "clientId", "statblockId", "modelProfileId", "displayHint", "createdAt"] as const) {
    string(job[key], `parse job.${key}`);
  }
  if (job.parserMode !== undefined) parserMode(job.parserMode, "parse job.parserMode");
  if (job.replaceExisting !== undefined) boolean(job.replaceExisting, "parse job.replaceExisting");
  if (job.status !== "queued" && job.status !== "processing" && job.status !== "completed" && job.status !== "failed") {
    throw new Error("parse job.status is not supported.");
  }
  nullableString(job.startedAt, "parse job.startedAt");
  nullableString(job.completedAt, "parse job.completedAt");
  parseJobError(job.error, "parse job.error");
  finiteNumber(job.attempt, "parse job.attempt");
  nullableString(job.rawText, "parse job.rawText");
  if (job.result !== null) {
    const result = record(job.result, "parse job.result");
    assertEditableStatblockDocument(result.editableDocument, "parse job.result.editableDocument");
    string(result.parserVersion, "parse job.result.parserVersion");
    string(result.statblockId, "parse job.result.statblockId");
    if (
      result.parserStructure !== undefined &&
      result.parserStructure !== "multiline" &&
      result.parserStructure !== "singleline" &&
      result.parserStructure !== "mixed"
    ) {
      throw new Error("parse job.result.parserStructure is not supported.");
    }
    if (result.parserMode !== undefined) parserMode(result.parserMode, "parse job.result.parserMode");
    if (result.rawSource !== undefined) string(result.rawSource, "parse job.result.rawSource");
  }
}

export function assertParseDiagnosticsReport(value: unknown): asserts value is ParseDiagnosticsReport {
  const report = record(value, "parse diagnostics report");
  if (report.formatVersion !== "parse-diagnostics-v1") throw new Error("Parse diagnostics have an unsupported format.");
  for (const key of [
    "id",
    "jobId",
    "clientId",
    "statblockId",
    "modelProfileId",
    "displayHint",
    "createdAt",
    "completedAt",
  ] as const) {
    string(report[key], `parse diagnostics.${key}`);
  }
  finiteNumber(report.attempt, "parse diagnostics.attempt");
  if (report.status !== "completed" && report.status !== "failed")
    throw new Error("parse diagnostics.status is not supported.");
  nullableString(report.startedAt, "parse diagnostics.startedAt");
  nullableString(report.parserVersion, "parse diagnostics.parserVersion");
  nullableString(report.model, "parse diagnostics.model");
  parseJobError(report.failure, "parse diagnostics.failure");
  const source = record(report.source, "parse diagnostics.source");
  string(source.rawText, "parse diagnostics.source.rawText");
  nullableString(source.sha256, "parse diagnostics.source.sha256");
  record(report.statistics, "parse diagnostics.statistics");
  for (const key of [
    "timing",
    "modelRequest",
    "essentialVerification",
    "bodyStructure",
    "parserRouting",
    "candidateDebug",
    "parserReport",
    "losslessDocument",
  ] as const) {
    if (report[key] !== undefined && report[key] !== null) record(report[key], `parse diagnostics.${key}`);
  }
  nullableString(report.rawModelContent, "parse diagnostics.rawModelContent");
  if (report.deterministicHints !== undefined) array(report.deterministicHints, "parse diagnostics.deterministicHints");
  if (report.editableDocument !== null) {
    assertEditableStatblockDocument(report.editableDocument, "parse diagnostics.editableDocument");
  }
}
