import { useEffect, useRef, useState } from "react";
import {
  addEditableHeaderRow,
  applyEditableAutoStyle,
  editEditableAbility,
  editEditableHeaderText,
  editEditableSavingThrow,
  ensureEditableHeaderSubtitle,
  removeEditableHeaderRow,
  replaceEditableBody,
  setEditableHeaderName,
  setEditableHeaderSubtitle,
  type EditableHeaderRow,
  type EditableStatblockDocument,
} from "statblock-parser-core/product";
import { abilityLabels, abilityLabelsUk, abilityOrder } from "../statblockUi";
import { BodyRichEditor } from "./BodyRichEditor";
import { serializeBodyEditor } from "./bodyEditorSerialization";
import { RichEditableText } from "./RichEditableText";
import { BODY_EDITOR_ID, editorElementToMarkup } from "./richEditorMarkup";
import { HeaderEvidencePanel } from "./StatblockView";

export function StatblockEditor({
  document: editableDocument,
  onChange,
}: {
  document: EditableStatblockDocument;
  onChange: (document: EditableStatblockDocument) => void;
}) {
  const doc = editableDocument;
  const statblockAbilityLabels = doc.language === "uk" ? abilityLabelsUk : abilityLabels;
  const savingThrowsLabel = doc.language === "uk" ? "Ряткидки" : "Saving Throws";
  const editorRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingHeaderFocus = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  useEffect(() => {
    const id = pendingHeaderFocus.current;
    if (id === null) return;
    requestAnimationFrame(() => {
      const target = editorRefs.current.get(id);
      if (target === undefined) return;
      target.focus();
      pendingHeaderFocus.current = null;
    });
  }, [doc]);

  function register(id: string, node: HTMLDivElement | null) {
    if (node === null) editorRefs.current.delete(id);
    else editorRefs.current.set(id, node);
  }

  function activeEditor(): HTMLDivElement | null {
    return activeId === null ? null : (editorRefs.current.get(activeId) ?? null);
  }

  function activeDocumentSnapshot(): EditableStatblockDocument {
    const editor = activeEditor();
    if (editor === null || activeId === null) return doc;

    if (activeId === BODY_EDITOR_ID) {
      return replaceEditableBody(doc, serializeBodyEditor(editor));
    }

    const markup = editorElementToMarkup(editor);
    if (activeId === "editor-name") return setEditableHeaderName(doc, markup);
    if (activeId === "editor-subtitle") return setEditableHeaderSubtitle(doc, markup);
    return editEditableHeaderText(doc, activeId, markup);
  }

  function syncActiveEditor() {
    onChange(activeDocumentSnapshot());
  }

  function applyInlineFormat(command: "bold" | "italic") {
    const editor = activeEditor();
    if (editor === null) return;
    editor.focus();
    window.document.execCommand(command, false);
    syncActiveEditor();
  }

  function toggleHeading() {
    if (activeId !== BODY_EDITOR_ID) return;
    const editor = activeEditor();
    if (editor === null) return;
    editor.focus();

    const selection = window.getSelection();
    const anchor = selection?.anchorNode ?? null;
    const block =
      anchor === null
        ? null
        : ((anchor instanceof HTMLElement ? anchor : anchor.parentElement)?.closest(
            "[data-node-id]",
          ) as HTMLElement | null);
    const isHeading = block?.dataset.nodeType === "heading" || (block !== null && /^H[1-6]$/u.test(block.tagName));

    window.document.execCommand("formatBlock", false, isHeading ? "div" : "h2");
    onChange(replaceEditableBody(doc, serializeBodyEditor(editor)));
  }

  function allHeaderRows(): EditableHeaderRow[] {
    return [...doc.header.primaryRows, ...doc.header.secondaryRows];
  }

  function removeHeaderRow(rowId: string) {
    onChange(removeEditableHeaderRow(doc, rowId));
  }

  function changeHeaderRow(row: EditableHeaderRow, text: string) {
    onChange(editEditableHeaderText(doc, row.id, text));
  }

  function handleHeaderRowKey(row: EditableHeaderRow, event: React.KeyboardEvent<HTMLDivElement>, markup: string) {
    if (event.nativeEvent?.isComposing) return;

    if (event.key === "Enter") {
      event.preventDefault();

      if (markup.length === 0) {
        const withoutRow = removeEditableHeaderRow(doc, row.id);
        onChange(withoutRow);
        requestAnimationFrame(() => editorRefs.current.get(BODY_EDITOR_ID)?.focus());
        return;
      }

      const synced = editEditableHeaderText(doc, row.id, markup);
      const rows = [...synced.header.primaryRows, ...synced.header.secondaryRows];
      const index = rows.findIndex((entry) => entry.id === row.id);
      const next = rows[index + 1];

      onChange(synced);
      if (next !== undefined) {
        pendingHeaderFocus.current = next.id;
      } else {
        requestAnimationFrame(() => editorRefs.current.get(BODY_EDITOR_ID)?.focus());
      }
      return;
    }

    if ((event.key === "Backspace" || event.key === "Delete") && markup.length === 0) {
      event.preventDefault();
      removeHeaderRow(row.id);
    }
  }

  function addHeaderRow() {
    const newId = crypto.randomUUID();
    const rows = allHeaderRows();
    const activeRow = rows.find((row) => row.id === activeId) ?? null;
    pendingHeaderFocus.current = newId;
    onChange(addEditableHeaderRow(doc, "other_header", "", () => newId, activeRow?.id ?? null));
  }

  function addSubtitleRow() {
    if (doc.header.subtitle !== null) return;
    const newId = crypto.randomUUID();
    pendingHeaderFocus.current = "editor-subtitle";
    onChange(ensureEditableHeaderSubtitle(doc, () => newId));
  }

  function applyAutoStyle() {
    // Flush the currently focused contentEditable before applying the explicit
    // one-shot style transform. After this call, no automatic formatter runs.
    onChange(applyEditableAutoStyle(activeDocumentSnapshot()));
  }

  const nameText = doc.header.name?.text ?? "";
  const subtitleText = doc.header.subtitle?.text ?? "";

  return (
    <article
      className="statblock-sheet statblock-editor seamless-editor"
      aria-label={`Редагування ${doc.facts.name ?? "statblock"}`}
    >
      <div className="text-format-toolbar" aria-label="Форматування">
        <button
          type="button"
          className="format-button bold-button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyInlineFormat("bold")}
          title="Жирний"
        >
          B
        </button>
        <button
          type="button"
          className="format-button italic-button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyInlineFormat("italic")}
          title="Курсив"
        >
          I
        </button>
        <button
          type="button"
          className="format-button heading-button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleHeading}
          disabled={activeId !== BODY_EDITOR_ID}
          title="Заголовок"
        >
          H
        </button>
        <button
          type="button"
          className="format-button auto-style-button"
          onClick={applyAutoStyle}
          title="Одноразово застосувати стандартне форматування"
        >
          Автостиль
        </button>
        <span>
          Автостиль застосовується лише за кнопкою. Після цього форматування повністю належить ручному редагуванню.
        </span>
      </div>

      <RichEditableText
        id="editor-name"
        text={nameText}
        placeholder="Назва істоти"
        className="seamless-editable statblock-name editable-missing-capable"
        onFocus={() => setActiveId("editor-name")}
        register={(node) => register("editor-name", node)}
        onTextChange={(text) => onChange(setEditableHeaderName(doc, text))}
        onKeyDown={(event) => {
          if (event.nativeEvent?.isComposing || event.key !== "Enter") return;
          event.preventDefault();
          if (doc.header.subtitle !== null) {
            requestAnimationFrame(() => editorRefs.current.get("editor-subtitle")?.focus());
            return;
          }
          const firstRow = allHeaderRows()[0];
          requestAnimationFrame(() =>
            (firstRow === undefined
              ? editorRefs.current.get(BODY_EDITOR_ID)
              : editorRefs.current.get(firstRow.id)
            )?.focus(),
          );
        }}
      />

      {doc.header.subtitle !== null && (
        <RichEditableText
          id="editor-subtitle"
          text={subtitleText}
          placeholder="Розмір, тип, світогляд"
          className="seamless-editable statblock-subtitle editable-missing-capable"
          onFocus={() => setActiveId("editor-subtitle")}
          register={(node) => register("editor-subtitle", node)}
          onTextChange={(text) => onChange(setEditableHeaderSubtitle(doc, text))}
          onBlurText={(text) => {
            if (text.length === 0) onChange(setEditableHeaderSubtitle(doc, ""));
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent?.isComposing || event.key !== "Enter") return;
            event.preventDefault();
            const firstRow = allHeaderRows()[0];
            requestAnimationFrame(() =>
              (firstRow === undefined
                ? editorRefs.current.get(BODY_EDITOR_ID)
                : editorRefs.current.get(firstRow.id)
              )?.focus(),
            );
          }}
        />
      )}

      <div className="editor-header-add-actions">
        {doc.header.subtitle === null && (
          <button type="button" onClick={addSubtitleRow}>
            + Тип / світогляд
          </button>
        )}
        <button type="button" onClick={addHeaderRow}>
          + Рядок хедера
        </button>
      </div>

      {doc.header.primaryRows.map((row) => (
        <RichEditableText
          key={row.id}
          id={row.id}
          text={row.text}
          className="seamless-editable statblock-header-row editable-header-full"
          onFocus={() => setActiveId(row.id)}
          register={(node) => register(row.id, node)}
          onTextChange={(text) => changeHeaderRow(row, text)}
          onBlurText={(text) => {
            if (text.length === 0) removeHeaderRow(row.id);
          }}
          onKeyDown={(event, markup) => handleHeaderRowKey(row, event, markup)}
        />
      ))}

      <table className="statblock-ability-table editable-ability-table">
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
              const fact = doc.header.abilities[ability];
              return (
                <td key={ability}>
                  <input
                    className="ability-number-input"
                    type="number"
                    value={fact?.score ?? ""}
                    placeholder="—"
                    onChange={(event) => {
                      const score = event.target.value === "" ? null : Number(event.target.value);
                      const current = doc.header.abilities[ability];
                      onChange(
                        editEditableAbility(
                          doc,
                          ability,
                          score === null
                            ? null
                            : { score, modifier: current?.modifier ?? Math.floor((score - 10) / 2) },
                        ),
                      );
                    }}
                  />
                  <span>(</span>
                  <input
                    className="ability-number-input modifier"
                    type="number"
                    value={fact?.modifier ?? ""}
                    placeholder="—"
                    onChange={(event) => {
                      const modifier = event.target.value === "" ? null : Number(event.target.value);
                      const current = doc.header.abilities[ability];
                      onChange(
                        editEditableAbility(
                          doc,
                          ability,
                          modifier === null ? null : { score: current?.score ?? 10, modifier },
                        ),
                      );
                    }}
                  />
                  <span>)</span>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>

      <div className="editable-saving-row statblock-saving-row">
        <strong>{savingThrowsLabel}</strong>
        {abilityOrder.map((ability) => (
          <label key={ability}>
            {statblockAbilityLabels[ability]}{" "}
            <input
              className="save-number-input"
              type="number"
              value={doc.header.savingThrows[ability] ?? ""}
              placeholder="—"
              onChange={(event) =>
                onChange(
                  editEditableSavingThrow(doc, ability, event.target.value === "" ? null : Number(event.target.value)),
                )
              }
            />
          </label>
        ))}
      </div>

      {doc.header.secondaryRows.map((row) => (
        <RichEditableText
          key={row.id}
          id={row.id}
          text={row.text}
          className="seamless-editable statblock-header-row editable-header-full"
          onFocus={() => setActiveId(row.id)}
          register={(node) => register(row.id, node)}
          onTextChange={(text) => changeHeaderRow(row, text)}
          onBlurText={(text) => {
            if (text.length === 0) removeHeaderRow(row.id);
          }}
          onKeyDown={(event, markup) => handleHeaderRowKey(row, event, markup)}
        />
      ))}

      <HeaderEvidencePanel document={doc} open={evidenceOpen} onToggle={() => setEvidenceOpen((current) => !current)} />

      <BodyRichEditor
        body={doc.body}
        onFocus={() => setActiveId(BODY_EDITOR_ID)}
        register={(node) => register(BODY_EDITOR_ID, node)}
        onChange={(body) => onChange(replaceEditableBody(doc, body))}
      />
    </article>
  );
}
