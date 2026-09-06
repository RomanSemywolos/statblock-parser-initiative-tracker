import type { HeaderField } from "./domain.js";

export type EnglishHeaderField = Exclude<
  HeaderField,
  | "name"
  | "size_type_alignment"
  | "size"
  | "creature_type"
  | "creature_subtype"
  | "alignment"
  | "ability_scores"
  | "ability_modifiers"
  | "other_header"
>;

export type EnglishHeaderAliasMatch = {
  field: EnglishHeaderField;
  printedLabel: string;
  offset: number;
  aliasIndex: number;
};

export type EnglishHeaderAliasPolicy = (field: EnglishHeaderField, printedLabel: string, aliasIndex: number) => boolean;

/*
 * Language knowledge lives here, not routing/classification policy.
 * The first alias is the preferred/canonical printed form; later aliases are
 * accepted source spellings. Callers remain responsible for deciding which
 * aliases are strong enough evidence for their own layer.
 */
export const ENGLISH_HEADER_ALIASES: Readonly<Record<EnglishHeaderField, readonly string[]>> = {
  armor_class: ["Armor Class", "AC"],
  armor_type: ["Armor Type"],
  initiative: ["Initiative"],
  hit_points: ["Hit Points", "HP"],
  speed: ["Speed"],
  saving_throws: ["Saving Throws", "Saves"],
  skills: ["Skills"],
  damage_vulnerabilities: ["Damage Vulnerabilities", "Vulnerabilities"],
  damage_resistances: ["Damage Resistances", "Resistances"],
  damage_immunities: ["Damage Immunities", "Immunities"],
  condition_immunities: ["Condition Immunities"],
  senses: ["Senses"],
  languages: ["Languages"],
  habitat: ["Habitat"],
  challenge: ["Challenge Rating", "Challenge", "CR"],
  experience_points: ["Experience Points", "XP"],
  proficiency_bonus: ["Proficiency Bonus", "PB"],
};

const FIELD_ORDER = Object.keys(ENGLISH_HEADER_ALIASES) as EnglishHeaderField[];

type AliasEntry = {
  field: EnglishHeaderField;
  label: string;
  aliasIndex: number;
};

const ALIAS_ENTRIES: readonly AliasEntry[] = FIELD_ORDER.flatMap((field) =>
  ENGLISH_HEADER_ALIASES[field].map((label, aliasIndex) => ({ field, label, aliasIndex })),
).sort((a, b) => b.label.length - a.label.length || a.field.localeCompare(b.field));

function isSourceWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}_]/u.test(character);
}

function isRegexWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_]/u.test(character);
}

function aliasMatchesAt(text: string, offset: number, label: string): boolean {
  if (offset < 0 || offset + label.length > text.length) return false;
  if (text.slice(offset, offset + label.length).toLocaleLowerCase() !== label.toLocaleLowerCase()) return false;

  const before = offset > 0 ? text[offset - 1] : undefined;
  const after = text[offset + label.length];
  // Match the previous scan semantics: aliases may not begin inside any
  // Unicode word, while the trailing boundary mirrors JS regex `\b` for the
  // ASCII header vocabulary.
  return !isSourceWordCharacter(before) && !isRegexWordCharacter(after);
}

function permitted(entry: AliasEntry, policy?: EnglishHeaderAliasPolicy): boolean {
  return policy?.(entry.field, entry.label, entry.aliasIndex) ?? true;
}

export function englishHeaderAliases(field: EnglishHeaderField): readonly string[] {
  return ENGLISH_HEADER_ALIASES[field];
}

export function matchEnglishHeaderLabelAtStart(
  text: string,
  expectedField?: HeaderField,
  policy?: EnglishHeaderAliasPolicy,
): EnglishHeaderAliasMatch | null {
  for (const entry of ALIAS_ENTRIES) {
    if (expectedField !== undefined && entry.field !== expectedField) continue;
    if (!permitted(entry, policy)) continue;
    if (!aliasMatchesAt(text, 0, entry.label)) continue;
    return {
      field: entry.field,
      printedLabel: text.slice(0, entry.label.length),
      offset: 0,
      aliasIndex: entry.aliasIndex,
    };
  }
  return null;
}

export function findEnglishHeaderLabelStarts(
  text: string,
  policy?: EnglishHeaderAliasPolicy,
): EnglishHeaderAliasMatch[] {
  const matches: EnglishHeaderAliasMatch[] = [];

  for (let offset = 0; offset < text.length; offset += 1) {
    if (offset > 0 && isSourceWordCharacter(text[offset - 1])) continue;

    for (const entry of ALIAS_ENTRIES) {
      if (!permitted(entry, policy)) continue;
      if (!aliasMatchesAt(text, offset, entry.label)) continue;
      matches.push({
        field: entry.field,
        printedLabel: text.slice(offset, offset + entry.label.length),
        offset,
        aliasIndex: entry.aliasIndex,
      });
      // Mirror regex matchAll's non-overlapping scan semantics. Without this,
      // `Damage Resistances` would also emit the nested alias `Resistances`.
      offset += entry.label.length - 1;
      break;
    }
  }

  return matches;
}
