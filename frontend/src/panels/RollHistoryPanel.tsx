import { useRef } from "react";
import { formatRollDetails, naturalD20Class, type RollLogEntry } from "../hooks/useDiceRoller";
import { Tooltip } from "../Tooltip";

export function RollHistoryPanel({ entries }: { entries: RollLogEntry[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  function history() {
    return entries.length === 0 ? (
      <span className="roll-history-empty">Кидків ще немає.</span>
    ) : (
      entries.map((entry) => (
        <div key={entry.id} className="roll-history-entry">
          <span className="roll-history-label">{entry.label}</span>
          <strong>
            {entry.result.normalized} → <span className={naturalD20Class(entry.result)}>{entry.result.total}</span>
          </strong>
          <span>{formatRollDetails(entry.result)}</span>
        </div>
      ))
    );
  }
  return (
    <div className="header-roll-zone" aria-label="Журнал кидків">
      <div className="roll-history compact-roll-history" aria-live="polite">
        {history()}
      </div>
      <Tooltip text="Розгорнути історію: останні 100 кидків поточної сесії.">
        <button
          type="button"
          className="roll-history-toggle"
          aria-label="Розгорнути історію кидків"
          aria-haspopup="dialog"
          onClick={() => dialog.current?.showModal()}
        >
          ▾
        </button>
      </Tooltip>
      <dialog
        ref={dialog}
        className="roll-history-dialog"
        aria-labelledby="roll-history-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="roll-history-dialog-content">
          <header>
            <h2 id="roll-history-title">Історія кидків</h2>
            <button type="button" aria-label="Закрити історію кидків" onClick={() => dialog.current?.close()}>
              ×
            </button>
          </header>
          <div className="roll-history expanded-roll-history">{history()}</div>
        </div>
      </dialog>
    </div>
  );
}
