import { useEffect, useRef } from "react";
import type { ParserMode, SavedStatblock } from "statblock-parser-core/product";

function parserStructureLabel(structure: SavedStatblock["importedParserStructure"]): string {
  if (structure === "multiline") return "Багаторядковий";
  if (structure === "singleline") return "Однорядковий";
  if (structure === "mixed") return "Змішаний";
  return "Невідомо";
}

function parserModeLabel(mode: ParserMode | null): string {
  if (mode === "multiline") return "Багаторядковий";
  if (mode === "singleline") return "Однорядковий / злиплий";
  if (mode === "generic") return "Універсальний LLM";
  return "Автоматично";
}

export function StatblockCardControls({
  open,
  onToggle,
  language,
  hasUkrainian,
  onLanguageChange,
  onTranslate,
  editing,
  configuringCard,
  canConfigureCard,
  onToggleEditing,
  onToggleConfiguringCard,
  savedStatblock,
  reparseMode,
  onReparseModeChange,
  reparseBusy,
  onReparse,
}: {
  open: boolean;
  onToggle: () => void;
  language: "en" | "uk" | null;
  hasUkrainian: boolean;
  onLanguageChange: (language: "en" | "uk") => void;
  onTranslate: () => void;
  editing: boolean;
  configuringCard: boolean;
  canConfigureCard: boolean;
  onToggleEditing: () => void;
  onToggleConfiguringCard: () => void;
  savedStatblock: SavedStatblock | null;
  reparseMode: ParserMode;
  onReparseModeChange: (mode: ParserMode) => void;
  reparseBusy: boolean;
  onReparse: () => void;
}) {
  const currentMode = savedStatblock?.importedParserMode ?? null;
  const hasRawSource = savedStatblock?.rawSource !== null && savedStatblock?.rawSource !== undefined;
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (anchorRef.current?.contains(event.target as Node)) return;
      onToggle();
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open, onToggle]);

  return (
    <div ref={anchorRef} className="card-controls-anchor">
      <button
        type="button"
        className={`card-controls-toggle ${open ? "active-mode" : ""}`}
        aria-expanded={open}
        title="Керування карткою"
        onClick={onToggle}
      >
        ⋯
      </button>
      {open && (
        <div className="card-controls-panel">
          {language !== null && savedStatblock !== null && (
            <div className="card-controls-language-row">
              <button
                type="button"
                className={language === "en" ? "active-mode" : ""}
                onClick={() => onLanguageChange("en")}
              >
                EN
              </button>
              <button
                type="button"
                disabled={!hasUkrainian}
                className={language === "uk" ? "active-mode" : ""}
                onClick={() => onLanguageChange("uk")}
              >
                UK
              </button>
              <button type="button" onClick={onTranslate}>
                {hasUkrainian ? "↻ UK" : "→ UK"}
              </button>
            </div>
          )}

          <div className="card-controls-edit-row">
            <button type="button" className={editing ? "active-mode" : ""} onClick={onToggleEditing}>
              {editing ? "Закрити редагування" : "Редагувати"}
            </button>
            {canConfigureCard && (
              <button type="button" className={configuringCard ? "active-mode" : ""} onClick={onToggleConfiguringCard}>
                {configuringCard ? "Закрити налаштування" : "Налаштувати картку"}
              </button>
            )}
          </div>

          {savedStatblock !== null && (
            <div className="card-parser-controls">
              <div className="card-parser-status">
                <strong>Розібрано:</strong> {parserStructureLabel(savedStatblock.importedParserStructure)}
                {currentMode !== null && <> · режим: {parserModeLabel(currentMode)}</>}
                {savedStatblock.importedWithParserVersion !== "" && <> · v{savedStatblock.importedWithParserVersion}</>}
              </div>
              <label>
                <span>Режим повторного розбору</span>
                <select value={reparseMode} onChange={(event) => onReparseModeChange(event.target.value as ParserMode)}>
                  <option value="auto">Автоматично</option>
                  <option value="multiline">Багаторядковий</option>
                  <option value="singleline">Однорядковий / злиплий</option>
                  <option value="generic">Змішаний LLM</option>
                </select>
              </label>
              <button
                type="button"
                className="primary-button"
                disabled={!hasRawSource || reparseBusy}
                onClick={onReparse}
              >
                {reparseBusy ? "Розбирається…" : "Розібрати знову"}
              </button>
              {!hasRawSource && (
                <div className="card-parser-note">Для цієї старої картки оригінальний текст ще не збережений.</div>
              )}
              {hasRawSource && (
                <details className="card-source-details">
                  <summary>Оригінальний текст</summary>
                  <pre>{savedStatblock.rawSource}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
