import type { HeaderField } from "./domain.js";
import { findEnglishHeaderLabelStarts, matchEnglishHeaderLabelAtStart } from "./headerLexicon.js";
import type { EnglishHeaderField } from "./headerLexicon.js";

/*
 * Legacy/presentation English label helpers. The canonical parser pipeline must
 * not import these functions for candidate geometry, ownership, field identity,
 * or fact verification. Semantic source labels are assigned by the Header LLM.
 * UI/translation code may still recognize English printed labels after a field
 * already has semantic identity.
 */

const CANONICAL_ABILITY_SEQUENCE =
  /\bSTR\b[\s|,;:/\-–—]*\bDEX\b[\s|,;:/\-–—]*\bCON\b[\s|,;:/\-–—]*\bINT\b[\s|,;:/\-–—]*\bWIS\b[\s|,;:/\-–—]*\bCHA\b/iu;
const ABILITY_SCORE_CELL = /\b\d{1,3}\s*\(\s*[+\-−–—]?\d+\s*\)/gu;
const ABILITY_MODIFIER_PAIR = /\b(?:STR|DEX|CON|INT|WIS|CHA)\b\s*:?[ \t]*[+\-−–—]\d+/giu;

/*
 * Printed English aliases are owned by headerLexicon. This layer owns only
 * field-specific evidence: seeing a known label is not always enough to prove
 * a semantic header field.
 */
function headerValueEvidenceIsSufficient(field: EnglishHeaderField, remainder: string): boolean {
  switch (field) {
    case "armor_class":
    case "hit_points":
    case "speed":
      return /^\s*:?[ \t]*\d+/u.test(remainder);
    case "saving_throws":
      return /^\s*:?[ \t]*(?:(?:STR|DEX|CON|INT|WIS|CHA|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\b|[+\-−–—]\d)/iu.test(
        remainder,
      );
    case "challenge":
      return /^\s*:?[ \t]*\d+(?:\s*\/\s*\d+)?/u.test(remainder);
    case "proficiency_bonus":
      return /^\s*:?[ \t]*[+\-−–—]?\d+/u.test(remainder);
    case "armor_type":
    case "initiative":
    case "skills":
    case "damage_vulnerabilities":
    case "damage_resistances":
    case "damage_immunities":
    case "condition_immunities":
    case "senses":
    case "languages":
    case "habitat":
    case "experience_points":
      return !/^\s*[.!?]/u.test(remainder);
  }
}

export type DeterministicHeaderStart = { offset: number; field: HeaderField };

export function findDeterministicHeaderLabel(text: string, expectedField: HeaderField): string | null {
  const plain = text.replace(/^\s*(?:\*\*)?/u, "");
  const match = matchEnglishHeaderLabelAtStart(plain, expectedField);
  if (match === null) return null;
  return classifyDeterministicHeaderField(plain) === expectedField ? match.printedLabel : null;
}

export function findDeterministicHeaderStarts(text: string): DeterministicHeaderStart[] {
  const starts: DeterministicHeaderStart[] = [];
  for (const match of findEnglishHeaderLabelStarts(text)) {
    const field = classifyDeterministicHeaderField(text.slice(match.offset));
    if (field === null || field === "ability_scores" || field === "ability_modifiers") continue;
    starts.push({ offset: match.offset, field });
  }

  return starts.filter((current, index) => index === 0 || current.offset !== starts[index - 1].offset);
}

export function classifyDeterministicHeaderField(text: string): HeaderField | null {
  const trimmed = text.trimStart();
  if (trimmed.length === 0) return null;

  if (CANONICAL_ABILITY_SEQUENCE.test(trimmed)) {
    const scoreCells = trimmed.match(ABILITY_SCORE_CELL) ?? [];
    if (scoreCells.length >= 6) return "ability_scores";

    const modifierPairs = trimmed.match(ABILITY_MODIFIER_PAIR) ?? [];
    if (modifierPairs.length >= 6) return "ability_modifiers";
  }

  const label = matchEnglishHeaderLabelAtStart(trimmed);
  if (label === null) return null;
  const remainder = trimmed.slice(label.printedLabel.length);
  return headerValueEvidenceIsSufficient(label.field, remainder) ? label.field : null;
}

/*
 * Це не загальний feature parser. Функція потрібна лише як сильна страховка для
 * випадку, коли LLM вже виділила окремий span, але помилково назвала його header.
 * Вимагаємо коротку надруковану назву з явним `.`, `!` або `?` terminator та істотний prose після неї.
 */
export {
  looksLikeStandaloneFeatureName,
  looksLikeNamedFeatureLineStart,
  looksLikeStrongNamedFeature,
} from "./featureShape.js";
