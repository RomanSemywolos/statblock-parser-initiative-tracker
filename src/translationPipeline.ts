import { applyExactGlossary } from "./translationGlossary.js";
import {
  protectTranslationMechanics,
  restoreTranslationMechanics,
  validateTranslationMechanics,
  type MechanicsValidationResult,
} from "./translationMechanics.js";
import { applyDndTranslationRules } from "./translationRules.js";

export type DeterministicTranslationPreparation = {
  source: string;
  protectedSource: string;
  deterministicText: string;
  restoredText: string;
  appliedRuleCount: number;
  validation: MechanicsValidationResult;
};

/** M14 deterministic localization stage. Machine translation is deliberately disabled; unresolved prose remains English for manual editing. */
export function prepareEnglishForUkrainianTranslation(source: string): DeterministicTranslationPreparation {
  const protectedValue = protectTranslationMechanics(source);
  const ruled = applyDndTranslationRules(protectedValue.protectedText);
  const deterministicText = applyExactGlossary(ruled.text, { safeOnly: true });
  const restored = restoreTranslationMechanics(deterministicText, protectedValue);
  // Numeric agreement is safe only after opaque mechanic tokens are restored.
  let restoredText = restored.replace(/\((\d+) комірок\)/gu, (_all, raw) => {
    const value = Number(raw);
    const mod10 = value % 10;
    const mod100 = value % 100;
    const noun =
      mod10 === 1 && mod100 !== 11
        ? "комірка"
        : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)
          ? "комірки"
          : "комірок";
    return `(${raw} ${noun})`;
  });
  // Cost metadata contains protected numbers during the rule pass. Translate it
  // after restoration so Ukrainian number agreement is deterministic.
  restoredText = restoredText.replace(/\(Costs\s+(\d+)\s+Actions?\)/giu, (_all, raw) => {
    const value = Number(raw);
    const mod10 = value % 10;
    const mod100 = value % 100;
    const noun =
      mod10 === 1 && mod100 !== 11
        ? "дію"
        : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)
          ? "дії"
          : "дій";
    return `(Коштує ${raw} ${noun})`;
  });
  return {
    source,
    protectedSource: protectedValue.protectedText,
    deterministicText,
    restoredText,
    appliedRuleCount: ruled.appliedRuleCount,
    validation: validateTranslationMechanics(source, restoredText),
  };
}
