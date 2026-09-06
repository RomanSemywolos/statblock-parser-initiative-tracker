import { TRANSLATION_GLOSSARY } from "./translationGlossaryData.js";

export type RuleTranslation = { text: string; appliedRuleCount: number };

type Rule = { expression: RegExp; replace: string | ((substring: string, ...args: string[]) => string) };

const ABILITY: Record<string, string> = {
  strength: "Сили",
  dexterity: "Спритності",
  constitution: "Статури",
  intelligence: "Інтелекту",
  wisdom: "Мудрості",
  charisma: "Харизми",
};

const DAMAGE_PHRASE_UK: Record<string, string> = {
  acid: "шкоди кислотою",
  bludgeoning: "дробильної шкоди",
  cold: "шкоди холодом",
  fire: "шкоди вогнем",
  force: "силової шкоди",
  lightning: "шкоди блискавкою",
  necrotic: "некротичної шкоди",
  piercing: "колючої шкоди",
  poison: "шкоди отрутою",
  psychic: "психічної шкоди",
  radiant: "сяючої шкоди",
  slashing: "рубальної шкоди",
  thunder: "громової шкоди",
};

const PARAMETRIC_RULES: readonly Rule[] = [
  {
    expression:
      /DC\s+⟦MECH_([A-Z]+)⟧\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/giu,
    replace: (_all, token, ability) => `ряткидок ${ABILITY[ability.toLocaleLowerCase("en")]} СК ⟦MECH_${token}⟧`,
  },
  { expression: /Melee or Ranged Weapon Attack:/giu, replace: "Рукопашна або далекобійна атака зброєю:" },
  { expression: /Melee or Ranged Spell Attack:/giu, replace: "Рукопашна або далекобійна атака закляттям:" },
  { expression: /Melee Weapon Attack:/giu, replace: "Рукопашна атака зброєю:" },
  { expression: /Ranged Weapon Attack:/giu, replace: "Далекобійна атака зброєю:" },
  { expression: /Melee Spell Attack:/giu, replace: "Рукопашна атака закляттям:" },
  { expression: /Ranged Spell Attack:/giu, replace: "Далекобійна атака закляттям:" },
  { expression: /Hit:/giu, replace: "Влучання:" },
  { expression: /Miss:/giu, replace: "Промах:" },
  { expression: /Failure\s+or\s+Success:/giu, replace: "Провал або успіх:" },
  { expression: /Success:\s*Half damage\.?/giu, replace: "Успіх: Половина шкоди." },
  { expression: /Failure:/giu, replace: "Провал:" },
  { expression: /Success:/giu, replace: "Успіх:" },
  {
    expression:
      /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+Saving Throw:\s*DC\s+⟦MECH_([A-Z]+)⟧/giu,
    replace: (_all, ability, token) => `Ряткидок ${ABILITY[ability.toLocaleLowerCase("en")]}: СК ⟦MECH_${token}⟧`,
  },
  { expression: /Melee Attack Roll:/giu, replace: "Кидок рукопашної атаки:" },
  { expression: /Ranged Attack Roll:/giu, replace: "Кидок далекобійної атаки:" },
  { expression: /\bto hit with spell attacks\b/giu, replace: "для влучання атаками закляттями" },
  { expression: /\bto hit\b/giu, replace: "до влучання" },
  { expression: /\bone target\b/giu, replace: "одна ціль" },
  { expression: /\bone creature\b/giu, replace: "одна істота" },
  { expression: /escape\s+DC\s+(⟦MECH_[A-Z]+⟧)/giu, replace: "СК $1 для втечі" },
  { expression: /Cantrips\s*\(at will\):/giu, replace: "Заговори (без обмежень):" },
  {
    expression: /(⟦MECH_[A-Z]+⟧)(?:st|nd|rd|th) level\s*\((⟦MECH_[A-Z]+⟧) slots?\):/giu,
    replace: (_all, level, slots) => `${level} рівень (${slots} комірок):`,
  },
  { expression: /At will:/giu, replace: "Без обмежень:" },
  { expression: /(⟦MECH_[A-Z]+⟧)\s*\/\s*day\s+each:/giu, replace: "$1/день кожне:" },
  { expression: /Legendary Action Uses:/giu, replace: "Використання легендарних дій:" },
  { expression: /\bplus\b(?=\s+⟦MECH_[A-Z]+⟧)/giu, replace: "плюс" },
  {
    expression:
      /\b(Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder)\s+damage\b/giu,
    replace: (_all, kind) => DAMAGE_PHRASE_UK[kind.toLocaleLowerCase("en")] ?? _all,
  },
  { expression: /,\s*or(?=\s+⟦MECH_[A-Z]+⟧)/giu, replace: ", або" },
  { expression: /within\s+(⟦MECH_[A-Z]+⟧)\s+feet/giu, replace: "у межах $1 футів" },
  { expression: /\bor(?=\s+range\s+⟦MECH_[A-Z]+⟧)/giu, replace: "або" },
  { expression: /range\s+(⟦MECH_[A-Z]+⟧)\s*\/\s*(⟦MECH_[A-Z]+⟧)\s*ft\.?/giu, replace: "дальність $1/$2 футів" },
  { expression: /range\s+(⟦MECH_[A-Z]+⟧)\s*ft\.?/giu, replace: "дальність $1 футів" },
  { expression: /(⟦MECH_[A-Z]+⟧)-foot-radius\s+sphere/giu, replace: "сфера радіусом $1 футів" },
  { expression: /(⟦MECH_[A-Z]+⟧)-foot\s+cone/giu, replace: "$1-футовий конус" },
  { expression: /(⟦MECH_[A-Z]+⟧)-foot\s+line/giu, replace: "$1-футова лінія" },
  { expression: /(⟦MECH_[A-Z]+⟧)-foot\s+cube/giu, replace: "$1-футовий куб" },
  { expression: /(⟦MECH_[A-Z]+⟧)-foot\s+sphere/giu, replace: "$1-футова сфера" },
  { expression: /(⟦MECH_[A-Z]+⟧)-foot\s+cylinder/giu, replace: "$1-футовий циліндр" },
  { expression: /(⟦MECH_[A-Z]+⟧)-foot\s+Emanation/giu, replace: "$1-футова еманація" },
  { expression: /(⟦MECH_[A-Z]+⟧)-foot-radius\b/giu, replace: "$1-футового радіуса" },
  { expression: /(⟦MECH_[A-Z]+⟧)-foot\b/giu, replace: "$1-футовий" },
  { expression: /that is\s+(⟦MECH_[A-Z]+⟧)\s+feet\s+wide/giu, replace: "завширшки $1 футів" },
  { expression: /(⟦MECH_[A-Z]+⟧)\s+feet\b/giu, replace: "$1 футів" },
  { expression: /reach\s+(⟦MECH_[A-Z]+⟧)\s*ft\.?/giu, replace: "досяжність $1 футів" },
  { expression: /Recharge\s+(⟦MECH_[A-Z]+⟧\s*[-–—]\s*⟦MECH_[A-Z]+⟧)/giu, replace: "Перезарядка $1" },
  { expression: /Recharge\s+(⟦MECH_[A-Z]+⟧)/giu, replace: "Перезарядка $1" },
  { expression: /(⟦MECH_[A-Z]+⟧)\s*\/\s*day/giu, replace: "$1/день" },
  { expression: /(⟦MECH_[A-Z]+⟧)\s*\/\s*week/giu, replace: "$1/тиждень" },
];

function exactRuleEntries(): Rule[] {
  return TRANSLATION_GLOSSARY.filter(
    (entry) => entry.processing === "rule-based phrase" && entry.english.trim().split(/\s+/u).length >= 3,
  )
    .sort((a, b) => b.english.length - a.english.length)
    .map((entry) => ({
      expression: new RegExp(
        `(?<![\\p{L}\\p{N}_])${entry.english.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?![\\p{L}\\p{N}_])`,
        "giu",
      ),
      replace: entry.uk,
    }));
}

const EXACT_RULES = exactRuleEntries();

export function applyDndTranslationRules(source: string): RuleTranslation {
  let text = source;
  let appliedRuleCount = 0;
  for (const rule of [...PARAMETRIC_RULES, ...EXACT_RULES]) {
    rule.expression.lastIndex = 0;
    const matches = [...text.matchAll(rule.expression)].length;
    if (matches === 0) continue;
    text = text.replace(rule.expression, rule.replace as never);
    appliedRuleCount += matches;
  }
  return { text, appliedRuleCount };
}
