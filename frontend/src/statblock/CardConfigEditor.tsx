import type { CardConfig, EditableHeaderRow, EditableStatblockDocument } from "statblock-parser-core/product";
import { abilityLabels, abilityOrder, formatBonus } from "../statblockUi";
import { BodyParagraphPreview, StaticRichText } from "./RichInteractiveText";
import { splitKnownHeaderRow } from "./statblockPresentation";

export function CardConfigEditor({
  document,
  config,
  onChange,
}: {
  document: EditableStatblockDocument;
  config: CardConfig;
  onChange: (next: CardConfig) => void;
}) {
  function toggleCustomContent(contentId: string, checked: boolean) {
    const current = config.customContentIds;
    const customContentIds = checked ? [...new Set([...current, contentId])] : current.filter((id) => id !== contentId);
    onChange({ ...config, customContentIds });
  }

  return (
    <div className="card-config-editor">
      <div className="card-config-builtins">
        <label>
          <input
            type="checkbox"
            checked={config.showSavingThrows}
            onChange={(event) => onChange({ ...config, showSavingThrows: event.target.checked })}
          />{" "}
          Ряткидки
        </label>
        <span>
          Числа HP, AC та ініціатива завжди залишаються вгорі. Повні вихідні рядки HP та AC можна додати нижче.
        </span>
      </div>
      <article className="statblock-sheet card-config-block-list">
        <label className="card-config-block card-config-name statblock-name">
          <input
            type="checkbox"
            checked={config.showName}
            onChange={(event) => onChange({ ...config, showName: event.target.checked })}
          />
          <span>{document.header.name?.text ?? document.facts.name ?? "Без назви"}</span>
        </label>
        {[
          ...(document.header.subtitle === null
            ? []
            : [
                {
                  id: document.header.subtitle.id,
                  text: document.header.subtitle.text,
                  kind: "subtitle" as const,
                  field: null,
                },
              ]),
          ...document.header.primaryRows
            .filter((row) => row.field !== "initiative")
            .map((row) => ({ id: row.id, text: row.text, kind: "header" as const, field: row.field })),
          { id: "builtin-abilities", text: "", kind: "abilities" as const, field: null },
          ...document.header.secondaryRows.map((row) => ({
            id: row.id,
            text: row.text,
            kind: "header" as const,
            field: row.field,
          })),
          ...document.body.map((node) => ({ id: node.id, text: node.text, kind: node.type, field: null })),
        ].map((entry) => {
          const syntheticRow =
            entry.kind === "header" && entry.field !== null
              ? ({ id: entry.id, field: entry.field, text: entry.text } as EditableHeaderRow)
              : null;
          const split = syntheticRow === null ? null : splitKnownHeaderRow(syntheticRow);

          return (
            <label
              key={entry.id}
              className={[
                "card-config-block",
                entry.kind === "heading" ? "statblock-section-heading" : "",
                entry.kind === "subtitle" ? "statblock-subtitle card-config-subtitle" : "",
                entry.kind === "abilities" ? "card-config-abilities" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="checkbox"
                checked={config.customContentIds.includes(entry.id)}
                onChange={(event) => toggleCustomContent(entry.id, event.target.checked)}
              />
              {entry.kind === "abilities" ? (
                <table className="statblock-ability-table card-config-ability-table" aria-label="Characteristics">
                  <thead>
                    <tr>
                      {abilityOrder.map((ability) => (
                        <th key={ability}>{abilityLabels[ability]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {abilityOrder.map((ability) => {
                        const fact = document.header.abilities[ability];
                        return (
                          <td key={ability}>
                            {fact?.score ?? "—"} ({formatBonus(fact?.modifier ?? null)})
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              ) : entry.kind === "header" && split !== null && split.label !== null ? (
                <span>
                  <strong className="statblock-field-label">{split.label}</strong>
                  {split.value.length > 0 ? ` ${split.value}` : ""}
                </span>
              ) : entry.kind === "paragraph" ? (
                <span className="card-config-body-preview">
                  <BodyParagraphPreview text={entry.text} />
                </span>
              ) : (
                <span>
                  <StaticRichText text={entry.text} />
                </span>
              )}
            </label>
          );
        })}
      </article>
    </div>
  );
}
