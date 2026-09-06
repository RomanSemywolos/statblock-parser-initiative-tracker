import { useEffect, useState } from "react";
import {
  damageCombatHp,
  d20WithModifier,
  effectiveCombatHpMaximum,
  grantTemporaryCombatHp,
  healCombatHp,
  modifyCombatHpMaximum,
  resetCombatHp,
  updateStubCombatant,
  type CombatHpState,
  type Combatant,
  type DiceExpression,
  type DiceRollResult,
  type EncounterState,
  type ProductAbilityKey,
  type StubCombatant,
} from "statblock-parser-core/product";
import { combatantDisplayName } from "./openedEntity";
import { abilityLabels, abilityOrder, formatBonus } from "./statblockUi";
import { RichInteractiveText } from "./StatblockViews";

export function CombatHpControls({
  hp,
  onChange,
  compact = false,
}: {
  hp: CombatHpState;
  onChange: (hp: CombatHpState) => void;
  compact?: boolean;
}) {
  const [amount, setAmount] = useState("0");
  const numericAmount = Number(amount);
  const valid = Number.isFinite(numericAmount);
  const effectiveMax = effectiveCombatHpMaximum(hp);

  function apply(operation: (state: CombatHpState, amount: number) => CombatHpState) {
    if (!valid) return;
    onChange(operation(hp, numericAmount));
  }

  return (
    <div className={`hp-controls ${compact ? "compact" : ""}`}>
      <div className="hp-status">
        <strong>
          HP {hp.current} / {effectiveMax}
        </strong>
        {hp.temp > 0 && <span>Temp {hp.temp}</span>}
        {hp.maxModifier !== 0 && (
          <span>
            Max {hp.maxModifier > 0 ? "+" : ""}
            {hp.maxModifier}
          </span>
        )}
      </div>
      <div className="hp-action-row">
        <input
          type="number"
          step="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-label="HP amount"
        />
        <button type="button" disabled={!valid} onClick={() => apply(damageCombatHp)}>
          Шкода
        </button>
        <button type="button" disabled={!valid} onClick={() => apply(healCombatHp)}>
          Зцілення
        </button>
        <button type="button" disabled={!valid} onClick={() => apply(grantTemporaryCombatHp)}>
          Temp HP
        </button>
        <button type="button" disabled={!valid} onClick={() => apply(modifyCombatHpMaximum)}>
          Макс. ±
        </button>
        <button type="button" onClick={() => onChange(resetCombatHp(hp))}>
          Скинути
        </button>
      </div>
    </div>
  );
}

export function EncounterCard({
  combatant,
  encounter,
  selected,
  current,
  onOpen,
  onRemove,
  onCardEdit,
  onRoll,
  rollSequence,
  onInitiative,
  onInitiativeChange,
  onHpChange,
  onLimitedUseChange,
}: {
  combatant: Combatant;
  encounter: EncounterState;
  selected: boolean;
  current: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onCardEdit: (patch: {
    name?: string | null;
    hitPointMaximum?: number | null;
    armorClass?: number | null;
    initiativeModifier?: number | null;
    savingThrows?: Partial<Record<ProductAbilityKey, number | null>>;
  }) => void;
  onRoll: (expression: DiceExpression, label: string) => DiceRollResult;
  rollSequence: number;
  onInitiative: () => void;
  onInitiativeChange: (value: number | null) => void;
  onHpChange: (hp: CombatHpState) => void;
  onLimitedUseChange: (key: string, maximum: number, value: number) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [hpValue, setHpValue] = useState("");
  const [acValue, setAcValue] = useState("");
  const [initiativeModifierValue, setInitiativeModifierValue] = useState("");
  const [saveValues, setSaveValues] = useState<Record<ProductAbilityKey, string>>({
    str: "",
    dex: "",
    con: "",
    int: "",
    wis: "",
    cha: "",
  });
  const [saveResult, setSaveResult] = useState<{ ability: ProductAbilityKey; total: number; sequence: number } | null>(
    null,
  );
  const [inlineRolls, setInlineRolls] = useState<Record<string, DiceRollResult>>({});
  const [expandedCustomContentIds, setExpandedCustomContentIds] = useState<Set<string>>(() => new Set());

  // Encounter cards are intentionally snapshot-backed. Library edits must not
  // change an existing combatant card; the full center view resolves the live
  // library statblock separately and only falls back to this snapshot.
  const document = combatant.kind === "statblock" ? combatant.document : null;
  const armorClass =
    combatant.kind === "stub"
      ? combatant.armorClass
      : combatant.armorClassOverride !== undefined
        ? combatant.armorClassOverride
        : (document?.facts.armorClass ?? null);
  const inheritedSaves = combatant.kind === "stub" ? combatant.savingThrows : document?.facts.savingThrows;
  const savingThrows =
    combatant.kind === "statblock" ? { ...inheritedSaves, ...(combatant.savingThrowOverrides ?? {}) } : inheritedSaves;
  const displayName = combatantDisplayName(combatant, encounter, document);
  const effectiveCardConfig = combatant.kind === "statblock" ? combatant.cardConfig : null;
  const showName = combatant.kind === "stub" || effectiveCardConfig?.showName !== false;
  const showSavingThrows = combatant.kind === "stub" || effectiveCardConfig?.showSavingThrows !== false;
  const customContent =
    combatant.kind === "statblock" && document !== null && effectiveCardConfig !== null
      ? effectiveCardConfig.customContentIds
          .map((id) => {
            if (id === "builtin-abilities") {
              const text = abilityOrder
                .map((ability) => {
                  const fact = document.header.abilities[ability];
                  return `${abilityLabels[ability]} ${fact?.score ?? "—"} (${formatBonus(fact?.modifier ?? null)})`;
                })
                .join(" · ");
              return { id, text, keyPrefix: `builtin:${id}` };
            }
            const node = document.body.find((entry) => entry.id === id);
            if (node !== undefined) return { id: node.id, text: node.text, keyPrefix: `node:${node.id}` };
            if (document.header.subtitle?.id === id)
              return { id, text: document.header.subtitle.text, keyPrefix: `header:${id}` };
            const row = [...document.header.primaryRows, ...document.header.secondaryRows].find(
              (entry) => entry.id === id,
            );
            return row === undefined ? null : { id: row.id, text: row.text, keyPrefix: `header:${row.id}` };
          })
          .filter((entry): entry is { id: string; text: string; keyPrefix: string } => entry !== null)
      : [];

  function rollInline(key: string, expression: DiceExpression, label: string) {
    const result = onRoll(expression, label);
    setInlineRolls({ [key]: result });
  }

  function startRename() {
    setRenameValue(displayName);
    setHpValue(combatant.hp === null ? "" : String(combatant.hp.baseMax));
    setAcValue(armorClass === null ? "" : String(armorClass));
    setInitiativeModifierValue(String(combatant.initiativeModifier));
    setSaveValues(
      Object.fromEntries(
        abilityOrder.map((ability) => [
          ability,
          savingThrows?.[ability] === null || savingThrows?.[ability] === undefined
            ? ""
            : String(savingThrows[ability]),
        ]),
      ) as Record<ProductAbilityKey, string>,
    );
    setRenaming(true);
  }

  function parseOptional(value: string): number | null {
    return value.trim() === "" ? null : Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : null;
  }

  function commitRename() {
    const value = renameValue.trim();
    onCardEdit({
      name: value === "" ? null : value,
      hitPointMaximum: parseOptional(hpValue),
      armorClass: parseOptional(acValue),
      initiativeModifier: parseOptional(initiativeModifierValue),
      savingThrows: Object.fromEntries(
        abilityOrder.map((ability) => [ability, parseOptional(saveValues[ability])]),
      ) as Record<ProductAbilityKey, number | null>,
    });
    setRenaming(false);
  }

  return (
    <article className={`encounter-card ${selected ? "selected" : ""} ${current ? "current-turn" : ""}`}>
      <div className="encounter-card-topline">
        {renaming ? (
          <input
            className="combatant-name-input"
            value={renameValue}
            placeholder={displayName}
            autoFocus
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <button type="button" className="encounter-open" onClick={onOpen}>
            {showName ? displayName : "Combatant"}
          </button>
        )}
        <div className="encounter-card-name-actions">
          {!renaming && (
            <button
              type="button"
              className="icon-button rename-combatant"
              title="Редагувати цю картку"
              onClick={(event) => {
                event.stopPropagation();
                startRename();
              }}
            >
              ✎
            </button>
          )}
          <button type="button" className="icon-button close-button" title="Прибрати з бою" onClick={onRemove}>
            ×
          </button>
        </div>
      </div>

      {renaming && (
        <div className="combatant-card-editor" onClick={(event) => event.stopPropagation()}>
          <label>
            HP <input type="number" value={hpValue} onChange={(event) => setHpValue(event.target.value)} />
          </label>
          <label>
            AC <input type="number" value={acValue} onChange={(event) => setAcValue(event.target.value)} />
          </label>
          <label>
            Init +{" "}
            <input
              type="number"
              value={initiativeModifierValue}
              onChange={(event) => setInitiativeModifierValue(event.target.value)}
            />
          </label>
          <div className="combatant-card-save-editor">
            {abilityOrder.map((ability) => (
              <label key={ability}>
                {abilityLabels[ability]}{" "}
                <input
                  type="number"
                  value={saveValues[ability]}
                  onChange={(event) => setSaveValues((current) => ({ ...current, [ability]: event.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="combatant-card-editor-actions">
            <button type="button" className="primary-button" onClick={commitRename}>
              Зберегти
            </button>
            <button type="button" onClick={() => setRenaming(false)}>
              Скасувати
            </button>
          </div>
        </div>
      )}

      <div className="encounter-card-body">
        <div className="encounter-summary-open">
          <span>
            <b>HP</b>{" "}
            {combatant.hp === null
              ? "—"
              : `${combatant.hp.current}/${effectiveCombatHpMaximum(combatant.hp)}${combatant.hp.temp > 0 ? ` +${combatant.hp.temp}` : ""}`}
          </span>
          <span>
            <b>AC</b> {armorClass ?? "—"}
          </span>
          <span className="initiative-line">
            <b>Init</b>
            <input
              className="initiative-slot"
              type="number"
              value={combatant.initiativeRoll ?? ""}
              placeholder="—"
              aria-label={`Ініціатива ${displayName}`}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                const raw = event.target.value;
                onInitiativeChange(raw === "" ? null : Number(raw));
              }}
            />
            <button
              type="button"
              className="initiative-modifier-button"
              onClick={(event) => {
                event.stopPropagation();
                onInitiative();
              }}
              title={`Кинути ініціативу: 1к20${formatBonus(combatant.initiativeModifier)}`}
            >
              {formatBonus(combatant.initiativeModifier)}
            </button>
          </span>
        </div>
        {combatant.hp !== null && <CombatHpControls hp={combatant.hp} onChange={onHpChange} compact />}
        {showSavingThrows && (
          <div className="save-grid" aria-label="Saving throws">
            {abilityOrder.map((ability) => {
              const modifier = savingThrows?.[ability] ?? null;
              return (
                <button
                  type="button"
                  key={ability}
                  disabled={modifier === null}
                  title={`Кинути ${abilityLabels[ability]} save`}
                  onClick={() => {
                    if (modifier === null) return;
                    const expectedSequence = rollSequence + 1;
                    const result = onRoll(
                      d20WithModifier(modifier),
                      `${displayName} · ${abilityLabels[ability]} · ряткидок`,
                    );
                    setSaveResult({ ability, total: result.total, sequence: expectedSequence });
                  }}
                >
                  <b>{abilityLabels[ability]}</b> {formatBonus(modifier)}
                  <span className="save-card-result">
                    {saveResult?.ability === ability && saveResult.sequence === rollSequence ? saveResult.total : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {customContent.length > 0 && (
          <div className="custom-card-blocks">
            {customContent.map((entry) => {
              const expanded = expandedCustomContentIds.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className={`custom-card-block ${expanded ? "expanded" : "collapsed"}`}
                  title={entry.text}
                >
                  <div className="custom-card-content">
                    <RichInteractiveText
                      text={entry.text}
                      keyPrefix={entry.keyPrefix}
                      label={displayName}
                      onRoll={rollInline}
                      results={inlineRolls}
                      limitedUses={combatant.kind === "statblock" ? combatant.limitedUses : undefined}
                      onLimitedUseChange={combatant.kind === "statblock" ? onLimitedUseChange : undefined}
                    />
                  </div>
                  <button
                    type="button"
                    className="custom-card-expand-toggle"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Згорнути рядок" : "Розгорнути рядок"}
                    title={expanded ? "Згорнути до одного рядка" : "Показати весь текст"}
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedCustomContentIds((current) => {
                        const next = new Set(current);
                        if (expanded) next.delete(entry.id);
                        else next.add(entry.id);
                        return next;
                      });
                    }}
                  >
                    {expanded ? "⌃" : "⌄"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

export function StubCombatantView({
  combatant,
  onHpChange,
  onRoll,
}: {
  combatant: StubCombatant;
  onHpChange: (hp: CombatHpState) => void;
  onRoll: (expression: DiceExpression, label: string) => void;
}) {
  return (
    <article className="statblock-sheet stub-statblock-sheet">
      <h1 className="statblock-name">{combatant.displayName}</h1>
      <div className="statblock-header-group">
        <div className="statblock-header-row">
          <strong className="statblock-field-label">Armor Class</strong> {combatant.armorClass ?? "—"}
        </div>
        <div className="statblock-header-row">
          <strong className="statblock-field-label">Hit Points</strong>{" "}
          {combatant.hp === null ? "—" : `${combatant.hp.current} / ${effectiveCombatHpMaximum(combatant.hp)}`}
        </div>
        <div className="statblock-header-row">
          <strong className="statblock-field-label">Initiative</strong> {formatBonus(combatant.initiativeModifier)}
        </div>
      </div>

      {combatant.hp !== null && <CombatHpControls hp={combatant.hp} onChange={onHpChange} />}

      <div className="statblock-saving-row stub-full-saves">
        <strong>Saving Throws</strong>{" "}
        {abilityOrder.map((ability, index) => {
          const modifier = combatant.savingThrows[ability];
          return (
            <span key={ability}>
              {index > 0 && ", "}
              {abilityLabels[ability]}{" "}
              {modifier === null ? (
                "—"
              ) : (
                <button
                  type="button"
                  className="inline-modifier-button"
                  onClick={() =>
                    onRoll(d20WithModifier(modifier), `${combatant.displayName} · ${abilityLabels[ability]} · ряткидок`)
                  }
                >
                  {formatBonus(modifier)}
                </button>
              )}
            </span>
          );
        })}
      </div>
    </article>
  );
}

export function StubCombatantEditor({
  combatant,
  onChange,
}: {
  combatant: StubCombatant;
  onChange: (patch: Parameters<typeof updateStubCombatant>[2]) => void;
}) {
  const [nameDraft, setNameDraft] = useState(combatant.displayName);

  useEffect(() => {
    setNameDraft(combatant.displayName);
  }, [combatant.id, combatant.displayName]);

  function commitName() {
    onChange({ displayName: nameDraft });
  }

  return (
    <article className="statblock-sheet stub-statblock-sheet stub-statblock-editor">
      <input
        className="stub-title-input statblock-name"
        value={nameDraft}
        onChange={(event) => setNameDraft(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />

      <div className="stub-edit-row">
        <strong className="statblock-field-label">Armor Class</strong>
        <input
          type="number"
          value={combatant.armorClass ?? ""}
          onChange={(event) => onChange({ armorClass: event.target.value === "" ? null : Number(event.target.value) })}
        />
      </div>

      <div className="stub-edit-row">
        <strong className="statblock-field-label">Hit Points</strong>
        <input
          type="number"
          value={combatant.hp?.baseMax ?? ""}
          onChange={(event) =>
            onChange({ hitPointMaximum: event.target.value === "" ? null : Number(event.target.value) })
          }
        />
      </div>

      <div className="stub-edit-row">
        <strong className="statblock-field-label">Initiative</strong>
        <input
          type="number"
          value={combatant.initiativeModifier}
          onChange={(event) => onChange({ initiativeModifier: Number(event.target.value) })}
        />
      </div>

      <div className="stub-edit-saves">
        <strong>Saving Throws</strong>
        {abilityOrder.map((ability) => (
          <label key={ability}>
            <span>{abilityLabels[ability]}</span>
            <input
              type="number"
              value={combatant.savingThrows[ability] ?? ""}
              onChange={(event) =>
                onChange({
                  savingThrows: {
                    [ability]: event.target.value === "" ? null : Number(event.target.value),
                  },
                })
              }
            />
          </label>
        ))}
      </div>
    </article>
  );
}
