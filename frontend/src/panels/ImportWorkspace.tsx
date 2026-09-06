import type { ParserMode } from "statblock-parser-core/product";
import { PARSER_CONNECTION_ERROR } from "../userMessages";

export function ImportWorkspace({
  text,
  parserMode,
  backendStatus,
  parseJobError,
  onTextChange,
  onParserModeChange,
  onClose,
  onOpenBackendSettings,
  onSubmit,
}: {
  text: string;
  parserMode: ParserMode;
  backendStatus: "unknown" | "online" | "offline";
  parseJobError: string | null;
  onTextChange: (value: string) => void;
  onParserModeChange: (value: ParserMode) => void;
  onClose: () => void;
  onOpenBackendSettings: () => void;
  onSubmit: () => void;
}) {
  return (
    <section className="import-workspace" aria-label="Новий імпорт statblock">
      <div className="import-workspace-card">
        <div className="import-workspace-heading">
          <div>
            <div className="eyebrow">Новий статблок</div>
            <h3>Вставте текст статблоку</h3>
          </div>
          <button type="button" className="close-button" onClick={onClose}>
            Закрити
          </button>
        </div>
        <div className="import-parser-controls">
          <label>
            <span>Режим парсера</span>
            <select value={parserMode} onChange={(event) => onParserModeChange(event.target.value as ParserMode)}>
              <option value="auto">Автоматично</option>
              <option value="multiline">Багаторядковий</option>
              <option value="singleline">Однорядковий / злиплий</option>
              <option value="generic">Універсальний LLM</option>
            </select>
          </label>
        </div>
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Встав сюди повний сирий текст statblock-а…"
          autoFocus
          spellCheck={false}
        />
        <div className="import-workspace-footer">
          <div className={`backend-indicator ${backendStatus}`}>
            {backendStatus === "online" && <>Система розбору підключена</>}
            {backendStatus === "offline" && <>Система розбору недоступна</>}
            {backendStatus === "unknown" && <>Система розбору: перевірка з’єднання</>}
          </div>
          <div className="settings-actions">
            <button type="button" onClick={onOpenBackendSettings}>
              Налаштування моделей
            </button>
            <button type="button" className="primary-button" disabled={text.trim().length === 0} onClick={onSubmit}>
              Розібрати й додати в бібліотеку
            </button>
          </div>
        </div>
        {backendStatus === "offline" && <p className="import-help">{PARSER_CONNECTION_ERROR}</p>}
        {parseJobError !== null && <div className="error-box">{parseJobError}</div>}
      </div>
    </section>
  );
}
