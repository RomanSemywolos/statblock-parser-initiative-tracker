import {
  PRODUCT_STATBLOCK_SECTIONS,
  type CardConfig,
  type EditableHeaderRow,
  type EditableStatblockDocument,
  type EditableStatblockHeader,
  type EditableStatblockNode,
  type ProductHeaderField,
  type ProductStatblockSection,
  type SavedStatblock,
  type ImportedParserMode,
  type ImportedParserStructure,
  type StatblockFacts,
  type VersionedDocument,
} from "./productModel.js";
import { assertCardConfig, assertEditableStatblockDocument } from "./runtimeValidation.js";

type LegacyEditableBlock = {
  id: string;
  role: string;
  section: ProductStatblockSection | null;
  field: ProductHeaderField | null;
  text: string;
};

type LegacyEditableDocument = {
  formatVersion: "editable-statblock-v1";
  language: string;
  blocks: LegacyEditableBlock[];
  facts: StatblockFacts;
};

const PRIMARY_FIELDS = new Set<ProductHeaderField>(["armor_class", "initiative", "hit_points", "speed"]);

const STRUCTURED_FIELDS = new Set<ProductHeaderField>([
  "name",
  "size_type_alignment",
  "ability_scores",
  "ability_modifiers",
  "saving_throws",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSection(value: unknown): value is ProductStatblockSection {
  return typeof value === "string" && (PRODUCT_STATBLOCK_SECTIONS as readonly string[]).includes(value);
}

function importedParserStructure(value: unknown): ImportedParserStructure | null {
  return value === "multiline" || value === "singleline" || value === "mixed" ? value : null;
}

function importedParserMode(value: unknown): ImportedParserMode | null {
  return value === "auto" || value === "multiline" || value === "singleline" || value === "generic" ? value : null;
}

function cloneFacts(value: StatblockFacts): StatblockFacts {
  return structuredClone(value);
}

function legacyHeader(blocks: readonly LegacyEditableBlock[], facts: StatblockFacts): EditableStatblockHeader {
  const nameBlock = blocks.find((block) => block.field === "name" || block.role === "name");
  const subtitleBlock = blocks.find(
    (block) => block.field === "size_type_alignment" || block.role === "size_type_alignment",
  );

  const seen = new Set<string>();
  const rows: EditableHeaderRow[] = [];
  for (const block of blocks) {
    if (block.field === null || STRUCTURED_FIELDS.has(block.field)) continue;
    if (block.role !== "header_field" && block.role !== "header_content") continue;
    if (seen.has(block.id)) continue;
    seen.add(block.id);
    rows.push({ id: block.id, field: block.field, text: block.text });
  }

  const looseRows = blocks
    .filter(
      (block) =>
        block.field === null &&
        (block.role === "header_field" || block.role === "header_content") &&
        block.text.trim().length > 0,
    )
    .map((block): EditableHeaderRow => ({ id: block.id, field: "other_header", text: block.text }));
  if (!rows.some((row) => row.field === "proficiency_bonus") && facts.proficiencyBonus !== null) {
    rows.push({
      id: "header-proficiency-bonus-derived",
      field: "proficiency_bonus",
      text: `Proficiency Bonus ${facts.proficiencyBonus >= 0 ? "+" : ""}${facts.proficiencyBonus}`,
    });
  }

  return {
    name:
      nameBlock === undefined
        ? { id: "header-name", field: "name", text: "" }
        : { id: nameBlock.id, field: "name", text: nameBlock.text },
    subtitle:
      subtitleBlock === undefined
        ? null
        : { id: subtitleBlock.id, field: "size_type_alignment", text: subtitleBlock.text },
    primaryRows: rows.filter((row) => PRIMARY_FIELDS.has(row.field)),
    abilities: structuredClone(facts.abilities),
    savingThrows: structuredClone(facts.savingThrows),
    secondaryRows: [...rows.filter((row) => !PRIMARY_FIELDS.has(row.field)), ...looseRows],
    evidence: [],
  };
}

function legacyBody(blocks: readonly LegacyEditableBlock[]): EditableStatblockNode[] {
  const nodes: EditableStatblockNode[] = [];
  for (const block of blocks) {
    const isHeader =
      block.field !== null ||
      block.role === "name" ||
      block.role === "size_type_alignment" ||
      block.role === "header_field" ||
      block.role === "header_content";
    if (isHeader) continue;
    if (block.text.trim().length === 0) continue;
    if (block.role === "section_heading") {
      nodes.push({
        id: block.id,
        type: "heading",
        headingKind: isSection(block.section) ? block.section : null,
        text: block.text,
      });
    } else {
      nodes.push({ id: block.id, type: "paragraph", text: block.text });
    }
  }
  return nodes;
}

export function migrateEditableStatblockDocument(value: unknown): EditableStatblockDocument {
  if (isRecord(value) && value.formatVersion === "editable-statblock-v2") {
    assertEditableStatblockDocument(value);
    const migrated = structuredClone(value) as EditableStatblockDocument;
    if (migrated.header.name === null) {
      migrated.header.name = { id: "header-name", field: "name", text: "" };
    }
    if (!Array.isArray(migrated.header.evidence)) migrated.header.evidence = [];
    if (migrated.header.subtitle !== null && migrated.header.subtitle.text.trim().length === 0) {
      migrated.header.subtitle = null;
    }
    // Older editable-v2 documents could carry card facts without the explicit
    // editor row that now owns them. Materialize those rows once during load so
    // subsequent manual edits never need to fall back to DEX/old fact snapshots.
    const allRows = [...migrated.header.primaryRows, ...migrated.header.secondaryRows];
    if (!allRows.some((row) => row.field === "initiative") && migrated.facts.initiative !== null) {
      const modifier = migrated.facts.initiative.modifier;
      const armorIndex = migrated.header.primaryRows.findIndex((row) => row.field === "armor_class");
      migrated.header.primaryRows.splice(armorIndex >= 0 ? armorIndex + 1 : 0, 0, {
        id:
          migrated.facts.initiative.provenance === "dex_modifier"
            ? "header-initiative-derived"
            : "header-initiative-migrated",
        field: "initiative",
        text: `Initiative ${modifier >= 0 ? "+" : ""}${modifier}`,
      });
    }
    if (!allRows.some((row) => row.field === "proficiency_bonus") && migrated.facts.proficiencyBonus !== null) {
      const bonus = migrated.facts.proficiencyBonus;
      migrated.header.secondaryRows.push({
        id: "header-proficiency-bonus-derived",
        field: "proficiency_bonus",
        text: `Proficiency Bonus ${bonus >= 0 ? "+" : ""}${bonus}`,
      });
    }
    return migrated;
  }
  if (
    !isRecord(value) ||
    value.formatVersion !== "editable-statblock-v1" ||
    !Array.isArray(value.blocks) ||
    !isRecord(value.facts)
  ) {
    throw new Error("Unsupported editable statblock document.");
  }

  const legacy = value as unknown as LegacyEditableDocument;
  return {
    formatVersion: "editable-statblock-v2",
    language: typeof legacy.language === "string" ? legacy.language : "en",
    header: legacyHeader(legacy.blocks, legacy.facts),
    body: legacyBody(legacy.blocks),
    facts: cloneFacts(legacy.facts),
  };
}

function migrateVersion(value: unknown, strictModern: boolean): VersionedDocument {
  if (!isRecord(value)) throw new Error("Invalid versioned statblock document.");
  if (strictModern && (typeof value.workingUpdatedAt !== "string" || typeof value.savedAt !== "string")) {
    throw new Error("Malformed versioned statblock timestamps.");
  }
  // Older records used `backup` as a rotating manual checkpoint and initially
  // stored null. The original parser result cannot always be reconstructed for
  // an already-edited legacy record, so retain its oldest available snapshot;
  // for untouched records `saved` is the exact parser/translation baseline.
  const baseline = value.backup === null || value.backup === undefined ? value.saved : value.backup;
  return {
    working: migrateEditableStatblockDocument(value.working),
    saved: migrateEditableStatblockDocument(value.saved),
    backup: migrateEditableStatblockDocument(baseline),
    workingUpdatedAt: typeof value.workingUpdatedAt === "string" ? value.workingUpdatedAt : "",
    savedAt: typeof value.savedAt === "string" ? value.savedAt : "",
  };
}

function migrateCardConfig(value: unknown, legacyWorking: unknown): CardConfig {
  if (!isRecord(value)) {
    return { showName: true, showArmorClass: true, showSavingThrows: true, customContentIds: [] };
  }
  const modern = Array.isArray(value.customContentIds)
    ? value.customContentIds.filter((entry): entry is string => typeof entry === "string")
    : null;
  let legacy = Array.isArray(value.customBlockIds)
    ? value.customBlockIds.filter((entry): entry is string => typeof entry === "string")
    : [];

  if (modern === null && isRecord(legacyWorking) && Array.isArray(legacyWorking.blocks)) {
    const blocks = legacyWorking.blocks as LegacyEditableBlock[];
    legacy = legacy.map((id) => {
      const block = blocks.find((entry) => entry.id === id);
      return block?.field === "ability_scores" || block?.field === "ability_modifiers" ? "builtin-abilities" : id;
    });
  }

  return {
    showName: value.showName !== false,
    // AC is a mandatory numeric combat-card field. The full source row remains
    // independently selectable through customContentIds.
    showArmorClass: true,
    showSavingThrows: value.showSavingThrows !== false,
    customContentIds: [...new Set(modern ?? legacy)],
  };
}

export function migrateSavedStatblock(value: unknown): SavedStatblock {
  if (!isRecord(value)) throw new Error("Invalid saved statblock.");
  if (value.formatVersion !== "saved-statblock-v1" && value.formatVersion !== "saved-statblock-v2") {
    throw new Error("Unsupported saved statblock version.");
  }
  if (typeof value.id !== "string" || !isRecord(value.versions)) {
    throw new Error("Malformed saved statblock.");
  }

  const strictModern = value.formatVersion === "saved-statblock-v2";
  if (strictModern) {
    if (isRecord(value.cardConfig) && Array.isArray(value.cardConfig.customContentIds)) {
      assertCardConfig(value.cardConfig);
    }
    if (
      typeof value.importedWithParserVersion !== "string" ||
      (value.rawSource !== undefined && value.rawSource !== null && typeof value.rawSource !== "string") ||
      typeof value.createdAt !== "string" ||
      typeof value.updatedAt !== "string"
    ) {
      throw new Error("Malformed modern saved statblock metadata.");
    }
  }

  return {
    formatVersion: "saved-statblock-v2",
    id: value.id,
    versions: {
      en: migrateVersion(value.versions.en, strictModern),
      ...(value.versions.uk === undefined ? {} : { uk: migrateVersion(value.versions.uk, strictModern) }),
    },
    cardConfig: migrateCardConfig(
      value.cardConfig,
      isRecord(value.versions.en) ? value.versions.en.working : undefined,
    ),
    importedWithParserVersion:
      typeof value.importedWithParserVersion === "string" ? value.importedWithParserVersion : "",
    importedParserStructure: importedParserStructure(value.importedParserStructure),
    importedParserMode: importedParserMode(value.importedParserMode),
    rawSource: typeof value.rawSource === "string" ? value.rawSource : null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

export function isLegacySavedStatblock(value: unknown): boolean {
  return isRecord(value) && value.formatVersion === "saved-statblock-v1";
}
