import type {
  EditableHeaderRow,
  EditableStatblockDocument,
  EditableStatblockNode,
  ProductHeaderField,
  ProductStatblockSection,
} from "./productModel.js";
import { refreshEditableStatblockFacts } from "./editableDocument.js";
import { prepareEnglishForUkrainianTranslation } from "./translationPipeline.js";
import {
  protectTranslationMechanics,
  restoreTranslationMechanics,
  validateTranslationMechanics,
} from "./translationMechanics.js";
import type { TranslationProvider } from "./translationProvider.js";
import { TRANSLATION_GLOSSARY } from "./translationGlossaryData.js";
import type { MechanicsValidationIssue } from "./translationMechanics.js";
import type { HeaderField } from "./domain.js";
import { findDeterministicHeaderLabel } from "./headerClassifier.js";

export type DeterministicDocumentTranslation = {
  document: EditableStatblockDocument;
  issues: MechanicsValidationIssue[];
  appliedRuleCount: number;
  translatedFragmentCount: number;
};

function glossaryUiLabel(english: string, fallback: string): string {
  return (
    TRANSLATION_GLOSSARY.find(
      (entry) =>
        entry.level === "UI_EXACT" && entry.english.toLocaleLowerCase("en") === english.toLocaleLowerCase("en"),
    )?.uk ?? fallback
  );
}

const HEADER_LABEL_UK: Partial<Record<ProductHeaderField, string>> = {
  armor_class: glossaryUiLabel("Armor Class", "Клас броні"),
  initiative: glossaryUiLabel("Initiative", "Ініціатива"),
  hit_points: glossaryUiLabel("Hit Points", "Хіти"),
  speed: glossaryUiLabel("Speed", "Швидкість"),
  saving_throws: glossaryUiLabel("Saving Throws", "Ряткидки"),
  skills: glossaryUiLabel("Skills", "Навички"),
  damage_vulnerabilities: glossaryUiLabel("Damage Vulnerabilities", "Вразливості"),
  damage_resistances: glossaryUiLabel("Damage Resistances", "Опори до шкоди"),
  damage_immunities: glossaryUiLabel("Damage Immunities", "Імунітети до шкоди"),
  condition_immunities: glossaryUiLabel("Condition Immunities", "Імунітети до станів"),
  senses: glossaryUiLabel("Senses", "Чуття"),
  languages: glossaryUiLabel("Languages", "Мови"),
  habitat: "Середовище",
  challenge: glossaryUiLabel("Challenge Rating", "Небезпека"),
  proficiency_bonus: glossaryUiLabel("Proficiency Bonus", "Бонус майстерності"),
};

function localizeKnownHeaderLabel(row: EditableHeaderRow, translatedText: string): string {
  const label = HEADER_LABEL_UK[row.field];
  if (label === undefined) return translatedText;

  const leadingBold = /^\*\*([^*\r\n]{1,80})\*\*(?=\s|$)/u.exec(row.text.trimStart());
  if (leadingBold !== null) {
    const printed = findDeterministicHeaderLabel(
      row.text.trimStart().replace(/^\*\*([^*\r\n]{1,80})\*\*/u, "$1"),
      row.field as HeaderField,
    );
    if (printed !== null && leadingBold[1]?.trim() === printed) {
      return translatedText.replace(/^\*\*[^*\r\n]{1,80}\*\*(?=\s|$)/u, `**${label}**`);
    }
  }

  // Compatibility fallback for older, unstyled saved documents. The semantic
  // header classifier remains the sole owner of English printed aliases.
  const printed = findDeterministicHeaderLabel(row.text, row.field as HeaderField);
  if (printed === null) return translatedText;
  const escaped = printed.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return translatedText.replace(new RegExp(`^${escaped}(?=\\s|$)`, "iu"), label);
}

const ABILITY_ABBREVIATION_UK: Record<string, string> = {
  STR: "СИЛ",
  DEX: "СПР",
  CON: "СТА",
  INT: "ІНТ",
  WIS: "МДР",
  CHA: "ХАР",
};

function glossaryMap(level: string): Map<string, string> {
  return new Map(
    TRANSLATION_GLOSSARY.filter((entry) => entry.level === level).map((entry) => [
      entry.english.toLocaleLowerCase("en"),
      entry.uk,
    ]),
  );
}

const SKILL_UK = glossaryMap("SKILL_LABEL");
const DAMAGE_UK = glossaryMap("DAMAGE_ATOM");
const CONDITION_UK = glossaryMap("CONDITION_ATOM");

const TRAIT_NAME_UK = glossaryMap("TRAIT_NAME");
const STRUCT_LABEL_UK = glossaryMap("STRUCT_LABEL");
const ALIGNMENT_UK = glossaryMap("ALIGNMENT_ATOM");
const MORPH_LEMMA_UK = glossaryMap("MORPH_LEMMA");
const TERM_LEMMA_UK = glossaryMap("TERM_LEMMA");
const SENSE_UK = new Map<string, string>([
  ["blindsight", TERM_LEMMA_UK.get("blindsight") ?? "сліпе чуття"],
  ["darkvision", TERM_LEMMA_UK.get("darkvision") ?? "темнозір"],
  ["tremorsense", TERM_LEMMA_UK.get("tremorsense") ?? "відчуття вібрації"],
  ["truesight", TERM_LEMMA_UK.get("truesight") ?? "істинний зір"],
  ["passive perception", TERM_LEMMA_UK.get("passive perception") ?? "пасивне Сприйняття"],
]);

const CREATURE_SUBTYPE_UK = new Map<string, string>([
  ["chromatic", "хроматичний"],
  ["devil", "диявол"],
  ["demon", "демон"],
  ["shapechanger", "перевертень"],
]);

const LANGUAGE_UK = new Map<string, string>([
  ["abyssal", "Безодня"],
  ["aquan", "Акван"],
  ["auran", "Ауран"],
  ["celestial", "Небесна"],
  ["common", "Загальна"],
  ["common sign language", "Загальна жестова мова"],
  ["deep speech", "Глибинна мова"],
  ["draconic", "Драконяча"],
  ["druidic", "Друїдська"],
  ["dwarvish", "Дворфська"],
  ["elvish", "Ельфійська"],
  ["giant", "Велетенська"],
  ["gnomish", "Гномська"],
  ["goblin", "Гоблінська"],
  ["halfling", "Галфлінська"],
  ["ignan", "Ігнан"],
  ["infernal", "Інфернальна"],
  ["orc", "Ороча"],
  ["primordial", "Первісна"],
  ["sylvan", "Сильванська"],
  ["terran", "Терран"],
  ["thieves' cant", "Злодійський жаргон"],
  ["thieves’ cant", "Злодійський жаргон"],
  ["undercommon", "Підземна загальна"],
  ["all", "Усі"],
  ["none", "Немає"],
]);

const HABITAT_UK = new Map<string, string>([
  ["any", "Будь-яке"],
  ["arctic", "Арктика"],
  ["coastal", "Узбережжя"],
  ["desert", "Пустеля"],
  ["forest", "Ліс"],
  ["grassland", "Степ"],
  ["hill", "Пагорби"],
  ["mountain", "Гори"],
  ["swamp", "Болото"],
  ["underdark", "Підзем'я"],
  ["underwater", "Під водою"],
  ["urban", "Місто"],
]);

const ARMOR_UK = new Map<string, string>([
  ["natural armor", "Природний обладунок"],
  ["padded armor", "Стьобаний обладунок"],
  ["leather armor", "Шкіряний обладунок"],
  ["studded leather armor", "Клепаний шкіряний обладунок"],
  ["studded leather", "Клепаний шкіряний обладунок"],
  ["hide armor", "Обладунок зі шкур"],
  ["chain shirt", "Кольчужна сорочка"],
  ["scale mail", "Лускатий обладунок"],
  ["breastplate", "Нагрудник"],
  ["half plate armor", "Напівлати"],
  ["half plate", "Напівлати"],
  ["ring mail", "Кільчастий обладунок"],
  ["chain mail", "Кольчуга"],
  ["splint armor", "Шинний обладунок"],
  ["splint", "Шинний обладунок"],
  ["plate armor", "Лати"],
  ["plate", "Лати"],
  ["shield", "Щит"],
]);

const CREATURE_TYPE_GENDER: Record<string, "m" | "f"> = {
  aberration: "f",
  fey: "f",
  fiend: "f",
  plant: "f",
};

const SIZE_FORMS_UK: Record<string, { m: string; f: string }> = {
  tiny: { m: "Крихітний", f: "Крихітна" },
  small: { m: "Малий", f: "Мала" },
  medium: { m: "Середній", f: "Середня" },
  large: { m: "Великий", f: "Велика" },
  huge: { m: "Величезний", f: "Величезна" },
  gargantuan: { m: "Колосальний", f: "Колосальна" },
};

const ALIGNMENT_FORMS_UK: Record<string, { m: string; f: string }> = {
  "lawful good": { m: "законно-добрий", f: "законно-добра" },
  "neutral good": { m: "нейтрально-добрий", f: "нейтрально-добра" },
  "chaotic good": { m: "хаотично-добрий", f: "хаотично-добра" },
  "lawful neutral": { m: "законно-нейтральний", f: "законно-нейтральна" },
  neutral: { m: "нейтральний", f: "нейтральна" },
  "chaotic neutral": { m: "хаотично-нейтральний", f: "хаотично-нейтральна" },
  "lawful evil": { m: "законно-злий", f: "законно-зла" },
  "neutral evil": { m: "нейтрально-злий", f: "нейтрально-зла" },
  "chaotic evil": { m: "хаотично-злий", f: "хаотично-зла" },
};

const SPECIAL_ALIGNMENT_UK: Record<string, string> = {
  unaligned: "без світогляду",
  "any alignment": "будь-який світогляд",
  "any non-good alignment": "будь-який недобрий світогляд",
  "any non-evil alignment": "будь-який незлий світогляд",
  "any chaotic alignment": "будь-який хаотичний світогляд",
  "any lawful alignment": "будь-який законний світогляд",
  "any good alignment": "будь-який добрий світогляд",
  "any evil alignment": "будь-який злий світогляд",
  "any neutral alignment": "будь-який нейтральний світогляд",
};

function translateAlignment(value: string, gender: "m" | "f"): string {
  const normalized = value.trim().toLocaleLowerCase("en");
  const prefixed = /^(typically|usually)\s+(.+)$/iu.exec(normalized);
  if (prefixed !== null) return `зазвичай ${translateAlignment(prefixed[2]!, gender)}`;
  const special = SPECIAL_ALIGNMENT_UK[normalized];
  if (special !== undefined) return special;
  const inflected = ALIGNMENT_FORMS_UK[normalized];
  if (inflected !== undefined) return inflected[gender];
  return ALIGNMENT_UK.get(normalized) ?? value.trim();
}

function translateTypeLine(text: string): string {
  const trimmed = text.trim();
  const marker = trimmed.startsWith("*") && trimmed.endsWith("*") ? "*" : "";
  const inner = marker === "" ? trimmed : trimmed.slice(1, -1);
  const match = /^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+([A-Za-z]+)(\s*\(([^)]+)\))?\s*,\s*(.+)$/iu.exec(inner);
  if (match === null) return text;

  const sizeKey = match[1]!.toLocaleLowerCase("en");
  const typeKey = match[2]!.toLocaleLowerCase("en");
  const gender = CREATURE_TYPE_GENDER[typeKey] ?? "m";
  const size = SIZE_FORMS_UK[sizeKey]?.[gender];
  const creatureType = MORPH_LEMMA_UK.get(typeKey);
  if (size === undefined || creatureType === undefined) return text;

  const rawSubtype = match[4]?.trim();
  const subtype =
    rawSubtype === undefined
      ? ""
      : ` (${rawSubtype
          .split(/\s*,\s*/u)
          .map((part) => {
            const key = part.toLocaleLowerCase("en");
            const translatedPart = CREATURE_SUBTYPE_UK.get(key) ?? MORPH_LEMMA_UK.get(key);
            return translatedPart === undefined ? part : translatedPart.toLocaleLowerCase("uk");
          })
          .join(", ")})`;
  const alignment = translateAlignment(match[5]!, gender);
  const translated = `${size} ${creatureType.toLocaleLowerCase("uk")}${subtype}, ${alignment}`;
  return marker === "" ? translated : `${marker}${translated}${marker}`;
}

function translateTitleMetadata(value: string): string {
  return value
    .replace(/Recharges after a Short or Long Rest/giu, "Відновлюється після короткого або тривалого відпочинку")
    .replace(/Costs\s+(\d+)\s+Actions?/giu, (_all, count) => `Коштує ${count} дії`)
    .replace(/(\d+)\/day/giu, "$1/день")
    .replace(/\bor\s+(\d+)\/день\s+in\s+Lair\b/giu, "або $1/день у лігві")
    .replace(/\bin\s+Lair\b/giu, "у лігві");
}

function translateKnownLeadTitle(text: string): string {
  const expression = /^(\*{2,3})([^*\n]+?)([.!?])(\*{2,3})/u;
  return text.replace(expression, (all, open, rawTitle, terminator, close) => {
    const title = String(rawTitle).trim();
    const parenthetical = /^(.*?)(\s+\(([^)]*)\))$/u.exec(title);
    const base = (parenthetical?.[1] ?? title).trim();
    const rawMetadata = parenthetical?.[3];
    const translated =
      TRAIT_NAME_UK.get(base.toLocaleLowerCase("en")) ?? STRUCT_LABEL_UK.get(base.toLocaleLowerCase("en"));
    const translatedBase = translated ?? base;
    const suffix = rawMetadata === undefined ? "" : ` (${translateTitleMetadata(rawMetadata)})`;
    if (translated === undefined && suffix === (parenthetical?.[2] ?? "")) return all;
    return `${open}${translatedBase}${suffix}${terminator}${close}`;
  });
}
function translateFeetAndMovement(text: string): string {
  return text
    .replace(/\bBurrow\b/giu, "риття")
    .replace(/\bClimb\b/giu, "лазіння")
    .replace(/\bFly\b/giu, "політ")
    .replace(/\bSwim\b/giu, "плавання")
    .replace(/\bWalk\b/giu, "ходьба")
    .replace(/\bhover\b/giu, TERM_LEMMA_UK.get("hover") ?? "зависання")
    .replace(/(\d+(?:[.,]\d+)?)\s*ft\.?/giu, "$1 футів");
}

function translateOtherHeaderFallback(text: string): string {
  const cases: readonly [RegExp, string, ReadonlyMap<string, string> | null][] = [
    [/^(\*\*)?Condition Immunities(\*\*)?/iu, "Імунітети до станів", CONDITION_UK],
    [/^(\*\*)?Damage Immunities(\*\*)?/iu, "Імунітети до шкоди", DAMAGE_UK],
    [/^(\*\*)?Damage Resistances(\*\*)?/iu, glossaryUiLabel("Damage Resistances", "Опори до шкоди"), DAMAGE_UK],
    [/^(\*\*)?Damage Vulnerabilities(\*\*)?/iu, glossaryUiLabel("Damage Vulnerabilities", "Вразливості"), DAMAGE_UK],
    [/^(\*\*)?Skills(\*\*)?/iu, "Навички", SKILL_UK],
  ];
  for (const [expression, label, atoms] of cases) {
    if (!expression.test(text)) continue;
    expression.lastIndex = 0;
    let result = text.replace(expression, (_all, open = "", close = "") => `${open}${label}${close}`);
    if (atoms !== null) result = replaceCanonicalAtoms(result, atoms);
    return result.replace(/,\s*and\s+/giu, ", та ");
  }
  return text;
}

function replaceCanonicalAtoms(text: string, values: ReadonlyMap<string, string>): string {
  const terms = [...values.keys()].sort((a, b) => b.length - a.length);
  let result = text;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const expression = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "giu");
    result = result.replace(expression, values.get(term)!);
  }
  return result;
}

function translatePhysicalDamageQualifier(text: string): string {
  return text
    .replace(/from\s+Nonmagical\s+Attacks\s+that\s+aren['’]t\s+Silvered/giu, "від немагічних атак непосрібленою зброєю")
    .replace(/from\s+Nonmagical\s+Attacks/giu, "від немагічних атак")
    .replace(/from\s+Magic\s+Weapons/giu, "від магічної зброї")
    .replace(/from\s+Magical\s+Weapons/giu, "від магічної зброї")
    .replace(/from\s+Magical\s+Attacks/giu, "від магічних атак")
    .replace(/from\s+немагічні\s+атаки\s+не\s+посрібленою\s+зброєю/giu, "від немагічних атак непосрібленою зброєю")
    .replace(
      /from\s+nonmagical\s+attacks\s+not\s+made\s+with\s+silvered\s+weapons/giu,
      "від немагічних атак непосрібленою зброєю",
    );
}
function translateStructuredHeaderPayload(row: EditableHeaderRow, text: string): string {
  switch (row.field) {
    case "size_type_alignment":
      return translateTypeLine(text);
    case "saving_throws":
      return text.replace(/\b(STR|DEX|CON|INT|WIS|CHA)\b/gu, (value) => ABILITY_ABBREVIATION_UK[value] ?? value);
    case "skills":
      return replaceCanonicalAtoms(text, SKILL_UK);
    case "damage_vulnerabilities":
    case "damage_resistances":
      return replaceCanonicalAtoms(translatePhysicalDamageQualifier(text), DAMAGE_UK).replace(/,\s*and\s+/giu, ", та ");
    case "damage_immunities":
      // 2024 compact "Immunities" rows can contain both damage types and conditions.
      return replaceCanonicalAtoms(replaceCanonicalAtoms(text, DAMAGE_UK), CONDITION_UK).replace(
        /,\s*and\s+/giu,
        ", та ",
      );
    case "condition_immunities":
      return replaceCanonicalAtoms(text, CONDITION_UK).replace(/,\s*and\s+/giu, ", та ");
    case "speed":
      return translateFeetAndMovement(text);
    case "senses":
      return translateFeetAndMovement(replaceCanonicalAtoms(text, SENSE_UK));
    case "languages":
      return translateFeetAndMovement(
        replaceCanonicalAtoms(text.replace(/\bTelepathy\b/giu, "Телепатія"), LANGUAGE_UK),
      );
    case "habitat":
      return replaceCanonicalAtoms(text, HABITAT_UK).replace(/,\s*and\s+/giu, ", та ");
    case "challenge":
      return text.replace(/\bor\b/giu, "або").replace(/\bin (?:its |the )?lair\b/giu, "у лігві");
    case "armor_class":
    case "armor_type":
      return replaceCanonicalAtoms(text, ARMOR_UK);
    case "other_header":
      return translateOtherHeaderFallback(text);
    default:
      return text;
  }
}

const SECTION_UK: Record<ProductStatblockSection, string> = {
  traits: glossaryUiLabel("Traits", "Особливості"),
  actions: glossaryUiLabel("Actions", "Дії"),
  bonus_actions: glossaryUiLabel("Bonus Actions", "Бонусні дії"),
  reactions: glossaryUiLabel("Reactions", "Реакції"),
  legendary_actions: glossaryUiLabel("Legendary Actions", "Легендарні дії"),
  mythic_actions: glossaryUiLabel("Mythic Actions", "Міфічні дії"),
  lair_actions: glossaryUiLabel("Lair Actions", "Дії лігва"),
  regional_effects: glossaryUiLabel("Regional Effects", "Регіональні ефекти"),
  description: glossaryUiLabel("Description", "Опис"),
};

function translateText(text: string): { text: string; issues: MechanicsValidationIssue[]; appliedRuleCount: number } {
  const result = prepareEnglishForUkrainianTranslation(text);
  return { text: result.restoredText, issues: result.validation.issues, appliedRuleCount: result.appliedRuleCount };
}

/**
 * Deterministic document adapter. It deliberately produces a partial Ukrainian
 * document: deterministic terminology/mechanics are translated and unresolved
 * prose remains English. The async provider layer may translate those remaining
 * fragments later; this deterministic function itself never calls a provider.
 */
export function translateEditableStatblockDeterministic(
  english: EditableStatblockDocument,
): DeterministicDocumentTranslation {
  const source = structuredClone(english);
  const issues: MechanicsValidationIssue[] = [];
  let appliedRuleCount = 0;
  let translatedFragmentCount = 0;

  const mapText = (text: string): string => {
    const translated = translateText(text);
    issues.push(...translated.issues);
    appliedRuleCount += translated.appliedRuleCount;
    if (translated.text !== text) translatedFragmentCount += 1;
    return translated.text;
  };

  const mapRow = (row: EditableHeaderRow | null): EditableHeaderRow | null =>
    row === null
      ? null
      : { ...row, text: localizeKnownHeaderLabel(row, translateStructuredHeaderPayload(row, mapText(row.text))) };
  const body: EditableStatblockNode[] = source.body.map((node) => {
    if (node.type === "heading" && node.headingKind !== null) {
      // headingKind is semantic product data, so renderer localization is safer
      // than asking the prose translator to rediscover a standard label.
      return { ...node, text: SECTION_UK[node.headingKind] };
    }
    return { ...node, text: translateKnownLeadTitle(mapText(node.text)) };
  });

  const translated: EditableStatblockDocument = {
    ...source,
    language: "uk",
    header: {
      ...source.header,
      name: mapRow(source.header.name),
      subtitle: mapRow(source.header.subtitle),
      primaryRows: source.header.primaryRows.map((row) => mapRow(row)!),
      secondaryRows: source.header.secondaryRows.map((row) => mapRow(row)!),
    },
    body,
  };

  return {
    document: refreshEditableStatblockFacts(translated),
    issues,
    appliedRuleCount,
    translatedFragmentCount,
  };
}

export type MachineDocumentTranslation = DeterministicDocumentTranslation & {
  machineTranslatedFragmentCount: number;
  machineFallbackFragmentCount: number;
  providerElapsedMs: number;
  providerId: string;
  providerError?: string;
};

type PreservedText = { text: string; values: Array<{ token: string; value: string }> };

function alphaToken(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

/**
 * Deterministically translated Ukrainian islands are authoritative. MT receives
 * only the still-English context around opaque KEEP tokens and may not rewrite
 * those islands.
 */
function protectDeterministicUkrainian(text: string): PreservedText {
  const values: Array<{ token: string; value: string }> = [];
  const protectedText = text.replace(/[\p{Script=Cyrillic}][\p{Script=Cyrillic}\p{L}\p{M}'’ʼ-]*/gu, (value) => {
    const token = `⟦KEEP_${alphaToken(values.length)}⟧`;
    values.push({ token, value });
    return token;
  });
  return { text: protectedText, values };
}

function restoreDeterministicUkrainian(text: string, preserved: PreservedText): string | null {
  const expectedTokens = preserved.values.map((entry) => entry.token);
  const observedTokens = text.match(/⟦KEEP_[A-Z]+⟧/gu) ?? [];
  if (observedTokens.length !== expectedTokens.length) return null;
  for (let index = 0; index < expectedTokens.length; index += 1) {
    if (observedTokens[index] !== expectedTokens[index]) return null;
  }

  let restored = text;
  for (const entry of preserved.values) restored = restored.replace(entry.token, entry.value);
  if (/⟦KEEP_[A-Z]+⟧/gu.test(restored)) return null;
  return restored;
}

function containsEnglishProse(text: string): boolean {
  return /[A-Za-z]{2,}/u.test(text);
}

type MtCandidate = {
  bodyIndex: number;
  source: string;
  deterministic: string;
  mechanics: ReturnType<typeof protectTranslationMechanics>;
  preserved: PreservedText;
};

/**
 * M14 MT document adapter. Deterministic localization remains authoritative;
 * LibreTranslate/another provider is invoked only for body fragments that still
 * contain English prose. Any provider error, corrupted KEEP token, or mechanics
 * validation failure falls back to the deterministic fragment.
 */
export async function translateEditableStatblockWithProvider(
  english: EditableStatblockDocument,
  provider: TranslationProvider,
): Promise<MachineDocumentTranslation> {
  const deterministic = translateEditableStatblockDeterministic(english);
  const document = structuredClone(deterministic.document);
  const issues = [...deterministic.issues];
  const candidates: MtCandidate[] = [];

  for (let index = 0; index < document.body.length; index += 1) {
    const targetNode = document.body[index];
    const sourceNode = english.body[index];
    if (sourceNode === undefined) continue;
    if (targetNode.type === "heading" && targetNode.headingKind !== null) continue;
    if (!containsEnglishProse(targetNode.text)) continue;

    // Protect already-restored mechanics again before MT, then protect all
    // deterministic Ukrainian words. The provider only gets unresolved prose.
    const mechanics = protectTranslationMechanics(targetNode.text);
    const preserved = protectDeterministicUkrainian(mechanics.protectedText);
    candidates.push({
      bodyIndex: index,
      source: sourceNode.text,
      deterministic: targetNode.text,
      mechanics,
      preserved,
    });
  }

  if (candidates.length === 0) {
    return {
      ...deterministic,
      document,
      machineTranslatedFragmentCount: 0,
      machineFallbackFragmentCount: 0,
      providerElapsedMs: 0,
      providerId: provider.id,
    };
  }

  let providerElapsedMs = 0;
  let machineTranslatedFragmentCount = 0;
  let machineFallbackFragmentCount = 0;
  let providerError: string | undefined;

  try {
    const response = await provider.translate({
      sourceLanguage: "en",
      targetLanguage: "uk",
      texts: candidates.map((candidate) => candidate.preserved.text),
    });
    providerElapsedMs = response.elapsedMs;
    if (response.texts.length !== candidates.length) {
      throw new Error(
        `Translation provider returned ${response.texts.length} fragments for ${candidates.length} requests.`,
      );
    }

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const kept = restoreDeterministicUkrainian(response.texts[index] ?? "", candidate.preserved);
      if (kept === null) {
        machineFallbackFragmentCount += 1;
        continue;
      }
      const restored = restoreTranslationMechanics(kept, candidate.mechanics);
      const validation = validateTranslationMechanics(candidate.source, restored);
      if (!validation.ok) {
        issues.push(...validation.issues);
        machineFallbackFragmentCount += 1;
        continue;
      }
      document.body[candidate.bodyIndex] = {
        ...document.body[candidate.bodyIndex],
        text: restored,
      } as EditableStatblockNode;
      if (restored !== candidate.deterministic) machineTranslatedFragmentCount += 1;
    }
  } catch (caught) {
    providerError = caught instanceof Error ? caught.message : String(caught);
    machineFallbackFragmentCount = candidates.length;
  }

  return {
    document: refreshEditableStatblockFacts(document),
    issues,
    appliedRuleCount: deterministic.appliedRuleCount,
    translatedFragmentCount: deterministic.translatedFragmentCount,
    machineTranslatedFragmentCount,
    machineFallbackFragmentCount,
    providerElapsedMs,
    providerId: provider.id,
    ...(providerError === undefined ? {} : { providerError }),
  };
}
