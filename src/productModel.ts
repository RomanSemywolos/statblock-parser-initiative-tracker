export const PRODUCT_ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type ProductAbilityKey = (typeof PRODUCT_ABILITY_KEYS)[number];

export const PRODUCT_STATBLOCK_SECTIONS = [
  "traits",
  "actions",
  "bonus_actions",
  "reactions",
  "legendary_actions",
  "mythic_actions",
  "lair_actions",
  "regional_effects",
  "description",
] as const;
export type ProductStatblockSection = (typeof PRODUCT_STATBLOCK_SECTIONS)[number];

export const PRODUCT_HEADER_FIELDS = [
  "name",
  "size_type_alignment",
  "size",
  "creature_type",
  "creature_subtype",
  "alignment",
  "armor_class",
  "armor_type",
  "initiative",
  "hit_points",
  "speed",
  "ability_scores",
  "ability_modifiers",
  "saving_throws",
  "skills",
  "damage_vulnerabilities",
  "damage_resistances",
  "damage_immunities",
  "condition_immunities",
  "senses",
  "languages",
  "habitat",
  "challenge",
  "experience_points",
  "proficiency_bonus",
  "other_header",
] as const;
export type ProductHeaderField = (typeof PRODUCT_HEADER_FIELDS)[number];

export type EditableHeaderRow = {
  id: string;
  field: ProductHeaderField;
  text: string;
};

export type EditableHeaderEvidenceField =
  "armor_class" | "hit_points" | "ability_scores" | "saving_throws" | "challenge" | "proficiency_bonus";

export type EditableHeaderEvidence = {
  id: string;
  fields: EditableHeaderEvidenceField[];
  text: string;
};

export type EditableAbilityFact = {
  score: number;
  modifier: number;
};

export type EditableInitiativeFact = {
  modifier: number;
  provenance: "printed" | "dex_modifier";
};

export type EditableStatblockHeader = {
  name: EditableHeaderRow | null;
  subtitle: EditableHeaderRow | null;
  primaryRows: EditableHeaderRow[];
  abilities: Record<ProductAbilityKey, EditableAbilityFact | null>;
  savingThrows: Record<ProductAbilityKey, number | null>;
  secondaryRows: EditableHeaderRow[];
  evidence?: EditableHeaderEvidence[];
};

export type EditableStatblockNode =
  | {
      id: string;
      type: "paragraph";
      text: string;
    }
  | {
      id: string;
      type: "heading";
      headingKind: ProductStatblockSection | null;
      text: string;
    };

export type StatblockFacts = {
  name: string | null;
  armorClass: number | null;
  hitPointMaximum: number | null;
  initiative: EditableInitiativeFact | null;
  abilities: Record<ProductAbilityKey, EditableAbilityFact | null>;
  savingThrows: Record<ProductAbilityKey, number | null>;
  proficiencyBonus: number | null;
};

export type EditableStatblockDocument = {
  formatVersion: "editable-statblock-v2";
  language: string;
  header: EditableStatblockHeader;
  body: EditableStatblockNode[];
  facts: StatblockFacts;
};

export type CardConfig = {
  showName: boolean;
  showArmorClass: boolean;
  showSavingThrows: boolean;
  customContentIds: string[];
};

export type VersionedDocument = {
  working: EditableStatblockDocument;
  saved: EditableStatblockDocument;
  /** Immutable parser/translation baseline. Replaced only by a new parse/translation. */
  backup: EditableStatblockDocument | null;
  workingUpdatedAt: string;
  savedAt: string;
};

export type ImportedParserStructure = "multiline" | "singleline" | "mixed";
export type ImportedParserMode = "auto" | "multiline" | "singleline" | "generic";

export type SavedStatblockLanguageVersions = {
  en: VersionedDocument;
  uk?: VersionedDocument;
};

export type SavedStatblock = {
  formatVersion: "saved-statblock-v2";
  id: string;
  versions: SavedStatblockLanguageVersions;
  cardConfig: CardConfig;
  importedWithParserVersion: string;
  importedParserStructure: ImportedParserStructure | null;
  importedParserMode: ImportedParserMode | null;
  rawSource: string | null;
  createdAt: string;
  updatedAt: string;
};
