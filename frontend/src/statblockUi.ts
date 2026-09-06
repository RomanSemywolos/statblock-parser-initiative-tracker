import type { ProductAbilityKey } from "statblock-parser-core/product";

export const abilityOrder: ProductAbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export const abilityLabels: Record<ProductAbilityKey, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

export const abilityLabelsUk: Record<ProductAbilityKey, string> = {
  str: "СИЛ",
  dex: "СПР",
  con: "СТА",
  int: "ІНТ",
  wis: "МДР",
  cha: "ХАР",
};

export function formatBonus(value: number | null): string {
  if (value === null) return "—";
  return value >= 0 ? `+${value}` : String(value);
}
