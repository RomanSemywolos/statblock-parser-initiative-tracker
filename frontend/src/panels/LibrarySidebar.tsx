import type { DragEvent } from "react";
import type { ParseJobSummary, SavedStatblock } from "statblock-parser-core/product";
import type { OpenedEntity } from "../openedEntity";
import { userFacingParserError } from "../userMessages";

export function LibrarySidebar({
  library,
  parseJobs,
  opened,
  editing,
  error,
  loading,
  documentsEqual,
  deletionLockedStatblockIds,
  onStartImport,
  onRetryParseJob,
  onDismissParseJob,
  onOpen,
  onAddToEncounter,
  onRemove,
  onDragStart,
  mobileOpen,
}: {
  library: SavedStatblock[];
  parseJobs: ParseJobSummary[];
  opened: OpenedEntity;
  editing: boolean;
  error: string | null;
  loading: boolean;
  documentsEqual: (
    left: SavedStatblock["versions"]["en"]["working"],
    right: SavedStatblock["versions"]["en"]["working"],
  ) => boolean;
  deletionLockedStatblockIds: ReadonlySet<string>;
  onStartImport: () => void;
  onRetryParseJob: (jobId: string) => void;
  onDismissParseJob: (jobId: string) => void;
  onOpen: (statblockId: string) => void;
  onAddToEncounter: (statblockId: string) => void;
  onRemove: (statblockId: string) => void;
  onDragStart: (event: DragEvent, statblockId: string) => void;
  mobileOpen: boolean;
}) {
  return (
    <aside className={`sidebar library-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="library-sidebar-intro">
        <div className="sidebar-header">
          <h1>Бібліотека</h1>
        </div>
        <p className="sidebar-note">Клік — відкрити. Перетягни або натисни +, щоб створити бойову копію справа.</p>
      </div>
      <div className="library-pinned-controls">
        <button type="button" className="library-import-button primary-button" onClick={onStartImport}>
          + Додати statblock
        </button>
      </div>
      {error !== null && <div className="error-box">{error}</div>}
      {loading && <div className="empty-state">Завантаження…</div>}
      {!loading && library.length === 0 && parseJobs.length === 0 && (
        <div className="empty-state">Бібліотека порожня. Імпортуй statblock.</div>
      )}
      {parseJobs.length > 0 && (
        <div className="parse-job-list" aria-label="Черга імпорту">
          {parseJobs.map((job) => {
            const elapsed =
              job.startedAt === null ? null : Math.max(0, Math.floor((Date.now() - Date.parse(job.startedAt)) / 1000));
            return (
              <div key={job.id} className={`parse-job-row ${job.status}`}>
                <div className="parse-job-main">
                  <strong title={job.displayHint}>{job.displayHint}</strong>
                  <span>
                    {job.status === "queued" && "У черзі"}
                    {job.status === "processing" && `Розбирається${elapsed === null ? "" : ` · ${elapsed} с`}`}
                    {job.status === "failed" && `Помилка · ${userFacingParserError(job.error?.message ?? "")}`}
                    {job.status === "completed" && "Завершення імпорту…"}
                  </span>
                </div>
                {(job.status === "failed" || job.status === "queued") && (
                  <div className="parse-job-actions">
                    {job.status === "failed" && (
                      <button type="button" onClick={() => onRetryParseJob(job.id)}>
                        Повторити
                      </button>
                    )}
                    <button
                      type="button"
                      className="close-button"
                      title={job.status === "queued" ? "Скасувати" : "Прибрати"}
                      onClick={() => onDismissParseJob(job.id)}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="library-list">
        {library.map((entry) => {
          const facts = entry.versions.en.working.facts;
          const selected = opened?.kind === "library" && opened.statblockId === entry.id;
          const dirty =
            !documentsEqual(entry.versions.en.working, entry.versions.en.saved) ||
            (entry.versions.uk !== undefined && !documentsEqual(entry.versions.uk.working, entry.versions.uk.saved));
          const deletionLocked = deletionLockedStatblockIds.has(entry.id);
          return (
            <div
              key={entry.id}
              className={`library-row ${selected ? "selected" : ""}`}
              draggable={!editing}
              onDragStart={(event) => onDragStart(event, entry.id)}
              title="Перетягни праворуч, щоб додати до бою"
            >
              <button type="button" className="library-open" onClick={() => onOpen(entry.id)}>
                <strong className="library-name">{facts.name ?? "Без назви"}</strong>
                {(entry.versions.uk !== undefined || dirty) && (
                  <span className="library-meta">
                    {entry.versions.uk !== undefined && <b>UK</b>}
                    {dirty && <b title="Є незбережені зміни">*</b>}
                  </span>
                )}
              </button>
              <div className="library-row-actions">
                <button
                  type="button"
                  className="icon-button add-button"
                  title="Додати до бою"
                  onClick={() => onAddToEncounter(entry.id)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="icon-button close-button"
                  disabled={deletionLocked}
                  title={
                    deletionLocked ? "Видалення заблоковане до завершення повторного розбору" : "Видалити з бібліотеки"
                  }
                  onClick={() => onRemove(entry.id)}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
