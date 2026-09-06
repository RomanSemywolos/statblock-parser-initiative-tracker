import type { EditableHeaderRow, EditableStatblockNode } from "statblock-parser-core/product";

export function sectionHeadingLabel(node: EditableStatblockNode): string {
  if (node.type !== "heading") return "";
  const labels: Record<string, string> = {
    traits: "Риси",
    actions: "Дії",
    bonus_actions: "Бонусні дії",
    reactions: "Реакції",
    legendary_actions: "Легендарні дії",
    mythic_actions: "Міфічні дії",
    lair_actions: "Дії лігва",
    regional_effects: "Регіональні ефекти",
    description: "Опис",
  };
  return node.headingKind === null ? "Заголовок" : (labels[node.headingKind] ?? "Заголовок");
}

const HEADER_FIELD_LABELS: Partial<Record<EditableHeaderRow["field"], string>> = {
  armor_class: "Armor Class",
  initiative: "Initiative",
  hit_points: "Hit Points",
  speed: "Speed",
  skills: "Skills",
  damage_vulnerabilities: "Damage Vulnerabilities",
  damage_resistances: "Damage Resistances",
  damage_immunities: "Damage Immunities",
  condition_immunities: "Condition Immunities",
  senses: "Senses",
  languages: "Languages",
  habitat: "Habitat",
  challenge: "Challenge",
  experience_points: "Experience Points",
  proficiency_bonus: "Proficiency Bonus",
};

export function splitKnownHeaderRow(row: EditableHeaderRow): { label: string | null; value: string } {
  // Parser-created rows are auto-styled with the exact source label. Treat the
  // authoring markup itself as the presentation boundary, without rediscovering
  // field vocabulary in the renderer.
  const groundedMarkup = /^\*\*([^*\r\n]+?)\*\*\s*:?[ \t]*/u.exec(row.text);
  if (groundedMarkup !== null) {
    return {
      label: groundedMarkup[1].trim(),
      value: row.text.slice(groundedMarkup[0].length),
    };
  }

  // Compatibility only: older saved documents may predate grounded Auto Style
  // and contain a plain canonical label. New imports do not depend on this map.
  const label = HEADER_FIELD_LABELS[row.field] ?? null;
  if (label === null) return { label: null, value: row.text };
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`^${escaped}\\s*:?[ \t]*`, "iu").exec(row.text);
  if (match === null) return { label: null, value: row.text };
  return { label: row.text.slice(0, label.length), value: row.text.slice(match[0].length) };
}
