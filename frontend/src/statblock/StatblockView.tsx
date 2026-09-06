import { useEffect, useState } from "react";
import type {
  DiceExpression,
  DiceRollResult,
  EditableHeaderEvidenceField,
  EditableHeaderRow,
  EditableStatblockDocument,
} from "statblock-parser-core/product";
import { d20WithModifier } from "statblock-parser-core/product";
import { abilityLabels, abilityLabelsUk, abilityOrder, formatBonus } from "../statblockUi";
import {
  BodyParagraphView,
  HeaderRowContent,
  InlineRollResult,
  RichInteractiveText,
  type InlineRollMap,
  type LimitedUseValues,
} from "./RichInteractiveText";

export function HeaderEvidencePanel({
  document,
  open,
  onToggle,
}: {
  document: EditableStatblockDocument;
  open: boolean;
  onToggle: () => void;
}) {
  const evidence = document.header.evidence ?? [];
  const buttonLabel = document.language === "uk" ? "Докази" : "Evidence";
  const evidenceLabels: Record<EditableHeaderEvidenceField, string> =
    document.language === "uk"
      ? {
          armor_class: "Клас обладунку",
          hit_points: "Хіти",
          ability_scores: "Характеристики",
          saving_throws: "Ряткидки",
          challenge: "CR",
          proficiency_bonus: "Бонус майстерності",
        }
      : {
          armor_class: "Armor Class",
          hit_points: "Hit Points",
          ability_scores: "Abilities",
          saving_throws: "Saving Throws",
          challenge: "CR",
          proficiency_bonus: "Proficiency Bonus",
        };

  return (
    <>
      <div className="statblock-evidence-divider" aria-label={buttonLabel}>
        <span className="statblock-evidence-divider-line" />
        {evidence.length > 0 && (
          <button type="button" className="statblock-evidence-toggle" aria-expanded={open} onClick={onToggle}>
            {buttonLabel} {open ? "▴" : "▾"}
          </button>
        )}
      </div>
      {open && evidence.length > 0 && (
        <div className="statblock-evidence-panel">
          {evidence.map((item) => {
            const labels = item.fields.map((field) => evidenceLabels[field]);
            return (
              <div key={item.id} className="statblock-evidence-item">
                <div className="statblock-evidence-label">{labels.join(" · ")}</div>
                <pre className="statblock-evidence-source">{item.text}</pre>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function HeaderRowView({
  row,
  name,
  onRoll,
  results,
  limitedUses,
  onLimitedUseChange,
}: {
  row: EditableHeaderRow;
  name: string;
  onRoll: (key: string, expression: DiceExpression, label: string) => void;
  results: InlineRollMap;
  limitedUses?: LimitedUseValues;
  onLimitedUseChange?: (key: string, maximum: number, value: number) => void;
}) {
  return (
    <div className="statblock-header-row">
      <HeaderRowContent
        row={row}
        name={name}
        onRoll={onRoll}
        results={results}
        limitedUses={limitedUses}
        onLimitedUseChange={onLimitedUseChange}
      />
    </div>
  );
}

export function StatblockView({
  document,
  documentKey,
  onRoll,
  limitedUses,
  onLimitedUseChange,
}: {
  document: EditableStatblockDocument;
  documentKey: string;
  onRoll: (expression: DiceExpression, label: string) => DiceRollResult;
  limitedUses?: LimitedUseValues;
  onLimitedUseChange?: (key: string, maximum: number, value: number) => void;
}) {
  const name = document.facts.name ?? "Statblock";
  const statblockAbilityLabels = document.language === "uk" ? abilityLabelsUk : abilityLabels;
  const savingThrowsLabel = document.language === "uk" ? "Ряткидки" : "Saving Throws";
  const [inlineRolls, setInlineRolls] = useState<InlineRollMap>({});
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  useEffect(() => {
    setInlineRolls({});
    setEvidenceOpen(false);
  }, [documentKey]);

  function rollInline(key: string, expression: DiceExpression, label: string) {
    const result = onRoll(expression, label);
    setInlineRolls({ [key]: result });
  }

  return (
    <article className="statblock-sheet" aria-label={name}>
      <h1 className="statblock-name statblock-name-slot">
        {document.header.name === null || document.header.name.text.length === 0 ? (
          "\u00a0"
        ) : (
          <RichInteractiveText
            text={document.header.name.text}
            keyPrefix={`header:${document.header.name.id}`}
            label={name}
            onRoll={rollInline}
            results={inlineRolls}
            limitedUses={limitedUses}
            onLimitedUseChange={onLimitedUseChange}
          />
        )}
      </h1>
      {document.header.subtitle !== null && (
        <div className="statblock-subtitle">
          <RichInteractiveText
            text={document.header.subtitle.text}
            keyPrefix={`header:${document.header.subtitle.id}`}
            label={name}
            onRoll={rollInline}
            results={inlineRolls}
            limitedUses={limitedUses}
            onLimitedUseChange={onLimitedUseChange}
          />
        </div>
      )}

      <div className="statblock-header-group">
        {document.header.primaryRows.map((row) => (
          <HeaderRowView
            key={row.id}
            row={row}
            name={name}
            onRoll={rollInline}
            results={inlineRolls}
            limitedUses={limitedUses}
            onLimitedUseChange={onLimitedUseChange}
          />
        ))}
      </div>

      <table className="statblock-ability-table" aria-label="Characteristics">
        <thead>
          <tr>
            {abilityOrder.map((ability) => (
              <th key={ability}>{statblockAbilityLabels[ability]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {abilityOrder.map((ability) => {
              const fact = document.header.abilities[ability];
              const modifier = fact?.modifier ?? null;
              const key = `ability:${ability}`;
              return (
                <td key={ability}>
                  <span className="ability-score">{fact?.score ?? "—"}</span>
                  {" ("}
                  {modifier === null ? (
                    "—"
                  ) : (
                    <>
                      <button
                        type="button"
                        className="inline-modifier-button ability-modifier"
                        onClick={() =>
                          rollInline(
                            key,
                            d20WithModifier(modifier),
                            `${name} · ${statblockAbilityLabels[ability]} · перевірка`,
                          )
                        }
                      >
                        {formatBonus(modifier)}
                      </button>
                      <InlineRollResult result={inlineRolls[key]} />
                    </>
                  )}
                  {")"}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>

      <div className="statblock-saving-row">
        <strong>{savingThrowsLabel}</strong>{" "}
        {abilityOrder.map((ability, index) => {
          const modifier = document.header.savingThrows[ability];
          const key = `save:${ability}`;
          return (
            <span key={ability}>
              {index > 0 && ", "}
              {statblockAbilityLabels[ability]}{" "}
              {modifier === null ? (
                "—"
              ) : (
                <>
                  <button
                    type="button"
                    className="inline-modifier-button"
                    onClick={() =>
                      rollInline(
                        key,
                        d20WithModifier(modifier),
                        `${name} · ${statblockAbilityLabels[ability]} · ряткидок`,
                      )
                    }
                  >
                    {formatBonus(modifier)}
                  </button>
                  <InlineRollResult result={inlineRolls[key]} />
                </>
              )}
            </span>
          );
        })}
      </div>

      <div className="statblock-header-group secondary">
        {document.header.secondaryRows.map((row) => (
          <HeaderRowView
            key={row.id}
            row={row}
            name={name}
            onRoll={rollInline}
            results={inlineRolls}
            limitedUses={limitedUses}
            onLimitedUseChange={onLimitedUseChange}
          />
        ))}
      </div>

      <HeaderEvidencePanel
        document={document}
        open={evidenceOpen}
        onToggle={() => setEvidenceOpen((current) => !current)}
      />

      <div className="statblock-body">
        {document.body.map((node) =>
          node.type === "heading" ? (
            <h2 key={node.id} className="statblock-section-heading">
              <RichInteractiveText
                text={node.text}
                keyPrefix={`node:${node.id}`}
                label={name}
                onRoll={rollInline}
                results={inlineRolls}
                limitedUses={limitedUses}
                onLimitedUseChange={onLimitedUseChange}
              />
            </h2>
          ) : (
            <div key={node.id} className="statblock-body-row">
              <BodyParagraphView
                node={node}
                name={name}
                onRoll={rollInline}
                results={inlineRolls}
                limitedUses={limitedUses}
                onLimitedUseChange={onLimitedUseChange}
              />
            </div>
          ),
        )}
      </div>
    </article>
  );
}
