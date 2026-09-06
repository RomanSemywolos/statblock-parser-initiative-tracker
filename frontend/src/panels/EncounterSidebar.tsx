import type { DragEvent } from "react";
import { useEffect, useRef } from "react";
import type {
  CombatHpState,
  DiceExpression,
  DiceRollResult,
  EncounterState,
  ProductAbilityKey,
} from "statblock-parser-core/product";
import { orderedEncounterCombatants } from "statblock-parser-core/product";
import type { OpenedEntity } from "../openedEntity";
import { EncounterCard } from "../EncounterViews";
import { abilityLabels, abilityOrder } from "../statblockUi";

export function EncounterSidebar({
  encounter,
  opened,
  dragOver,
  showStubForm,
  stubName,
  stubHp,
  stubAc,
  stubInitiative,
  stubSaves,
  rollSequence,
  onDragOver,
  onDragLeave,
  onDrop,
  onFinishCombat,
  onBeginCombat,
  onNextCombatant,
  onToggleStubForm,
  onStubNameChange,
  onStubHpChange,
  onStubAcChange,
  onStubInitiativeChange,
  onStubSaveChange,
  onCreateStub,
  onOpenCombatant,
  onRemoveCombatant,
  onCardEdit,
  onRoll,
  onInitiative,
  onInitiativeChange,
  onHpChange,
  onLimitedUseChange,
  mobileOpen,
}: {
  encounter: EncounterState | null;
  opened: OpenedEntity;
  dragOver: boolean;
  showStubForm: boolean;
  stubName: string;
  stubHp: string;
  stubAc: string;
  stubInitiative: string;
  stubSaves: Record<ProductAbilityKey, string>;
  rollSequence: number;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onFinishCombat: () => void;
  onBeginCombat: () => void;
  onNextCombatant: () => void;
  onToggleStubForm: () => void;
  onStubNameChange: (value: string) => void;
  onStubHpChange: (value: string) => void;
  onStubAcChange: (value: string) => void;
  onStubInitiativeChange: (value: string) => void;
  onStubSaveChange: (ability: ProductAbilityKey, value: string) => void;
  onCreateStub: () => void;
  onOpenCombatant: (combatantId: string) => void;
  onRemoveCombatant: (combatantId: string) => void;
  onCardEdit: (
    combatantId: string,
    patch: {
      name?: string | null;
      hitPointMaximum?: number | null;
      armorClass?: number | null;
      initiativeModifier?: number | null;
      savingThrows?: Partial<Record<ProductAbilityKey, number | null>>;
    },
  ) => void;
  onRoll: (expression: DiceExpression, label: string) => DiceRollResult;
  onInitiative: (combatantId: string) => void;
  onInitiativeChange: (combatantId: string, value: number | null) => void;
  onHpChange: (combatantId: string, hp: CombatHpState) => void;
  onLimitedUseChange: (combatantId: string, key: string, maximum: number, value: number) => void;
  mobileOpen: boolean;
}) {
  const encounterSidebarRef = useRef<HTMLElement | null>(null);
  const encounterControlsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!encounter?.active || encounter.currentCombatantId === null) return;
    const sidebar = encounterSidebarRef.current;
    const controls = encounterControlsRef.current;
    const currentCard = sidebar?.querySelector<HTMLElement>(
      `[data-combatant-id="${CSS.escape(encounter.currentCombatantId)}"]`,
    );
    if (sidebar === null || controls === null || currentCard === null || currentCard === undefined) return;
    const sidebarTop = sidebar.getBoundingClientRect().top;
    const cardTop = currentCard.getBoundingClientRect().top;
    const sidebarPaddingTop = Number.parseFloat(window.getComputedStyle(sidebar).paddingTop) || 0;
    const targetScrollTop = sidebar.scrollTop + cardTop - sidebarTop - controls.offsetHeight - sidebarPaddingTop;
    sidebar.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
  }, [encounter?.active, encounter?.currentCombatantId]);

  return (
    <aside
      ref={encounterSidebarRef}
      className={`sidebar encounter-sidebar ${dragOver ? "drop-active" : ""} ${mobileOpen ? "mobile-open" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="encounter-sidebar-intro">
        <div className="eyebrow">Encounter</div>
        <p className="sidebar-note">Додайте нового учасника або перенесіть істот з бібліотеки.</p>
        <button type="button" className="stub-toggle" onClick={onToggleStubForm}>
          Додати учасника
        </button>
        {showStubForm && (
          <div className="stub-form">
            <input placeholder="Ім’я" value={stubName} onChange={(event) => onStubNameChange(event.target.value)} />
            <div className="stub-form-row">
              <input
                type="number"
                placeholder="HP"
                value={stubHp}
                onChange={(event) => onStubHpChange(event.target.value)}
              />
              <input
                type="number"
                placeholder="AC"
                value={stubAc}
                onChange={(event) => onStubAcChange(event.target.value)}
              />
              <input
                type="number"
                placeholder="Init"
                value={stubInitiative}
                onChange={(event) => onStubInitiativeChange(event.target.value)}
              />
            </div>
            <div className="stub-save-grid">
              {abilityOrder.map((ability) => (
                <input
                  key={ability}
                  type="number"
                  placeholder={`${abilityLabels[ability]} save`}
                  value={stubSaves[ability]}
                  onChange={(event) => onStubSaveChange(ability, event.target.value)}
                />
              ))}
            </div>
            <button type="button" className="primary-button" onClick={onCreateStub}>
              Додати
            </button>
          </div>
        )}
      </div>

      <div ref={encounterControlsRef} className="encounter-pinned-controls">
        <div className="encounter-status-row">
          <h2>{encounter?.active ? `Раунд ${encounter.round ?? 1}` : "Готові до бою"}</h2>
          <span className="combatant-count">{encounter?.combatants.length ?? 0}</span>
        </div>
        <div className="encounter-actions">
          {encounter?.active ? (
            <button type="button" onClick={onFinishCombat}>
              Завершити бій
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={!encounter || encounter.combatants.length === 0}
              onClick={onBeginCombat}
            >
              Почати бій
            </button>
          )}
          {encounter?.active && (
            <button type="button" className="primary-button" onClick={onNextCombatant}>
              Далі →
            </button>
          )}
        </div>
      </div>

      <div className="encounter-list">
        {encounter !== null && encounter.combatants.length === 0 && (
          <div className="encounter-placeholder drop-prompt">
            <strong>Перетягни statblock сюди.</strong>
            <span>Або натисни + біля нього в бібліотеці.</span>
          </div>
        )}
        {encounter !== null &&
          orderedEncounterCombatants(encounter).map((combatant) => (
            <div key={combatant.id} className="encounter-card-scroll-anchor" data-combatant-id={combatant.id}>
              <EncounterCard
                combatant={combatant}
                encounter={encounter}
                selected={opened?.kind === "combatant" && opened.combatantId === combatant.id}
                current={encounter.active && encounter.currentCombatantId === combatant.id}
                onOpen={() => onOpenCombatant(combatant.id)}
                onRemove={() => onRemoveCombatant(combatant.id)}
                onCardEdit={(patch) => onCardEdit(combatant.id, patch)}
                onRoll={onRoll}
                rollSequence={rollSequence}
                onInitiative={() => onInitiative(combatant.id)}
                onInitiativeChange={(value) => onInitiativeChange(combatant.id, value)}
                onHpChange={(hp) => onHpChange(combatant.id, hp)}
                onLimitedUseChange={(key, maximum, value) => onLimitedUseChange(combatant.id, key, maximum, value)}
              />
            </div>
          ))}
      </div>
    </aside>
  );
}
