import { useEffect, useRef } from "react";
import { appendEditorMarkup, editorElementToMarkup } from "./richEditorMarkup";

type PlainEditorSelection = {
  start: number;
  end: number;
  collapsed: boolean;
};

function editorPlainSelection(element: HTMLElement): PlainEditorSelection {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) {
    const length = element.textContent?.length ?? 0;
    return { start: length, end: length, collapsed: true };
  }

  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) {
    const length = element.textContent?.length ?? 0;
    return { start: length, end: length, collapsed: true };
  }

  const startRange = range.cloneRange();
  startRange.selectNodeContents(element);
  startRange.setEnd(range.startContainer, range.startOffset);

  const endRange = range.cloneRange();
  endRange.selectNodeContents(element);
  endRange.setEnd(range.endContainer, range.endOffset);

  const start = startRange.toString().length;
  const end = endRange.toString().length;
  return { start: Math.min(start, end), end: Math.max(start, end), collapsed: range.collapsed };
}

function hydrateRichEditableText(element: HTMLDivElement, text: string): void {
  element.replaceChildren();
  appendEditorMarkup(element, text);
}

export function RichEditableText({
  id,
  text,
  className,
  onTextChange,
  onFocus,
  onKeyDown,
  onBlurText,
  placeholder,
  register,
}: {
  id: string;
  text: string;
  className: string;
  onTextChange: (text: string) => void;
  onFocus: () => void;
  onKeyDown?: (
    event: React.KeyboardEvent<HTMLDivElement>,
    markup: string,
    selection: PlainEditorSelection,
    element: HTMLDivElement,
  ) => void;
  onBlurText?: (text: string) => void;
  placeholder?: string;
  register: (node: HTMLDivElement | null) => void;
}) {
  const ownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ownRef.current;
    if (element === null || document.activeElement === element) return;
    if (editorElementToMarkup(element) === text) return;
    hydrateRichEditableText(element, text);
  }, [text]);

  function setRef(node: HTMLDivElement | null) {
    ownRef.current = node;
    register(node);
    if (node !== null && node.childNodes.length === 0 && text.length > 0) hydrateRichEditableText(node, text);
  }

  return (
    <div
      ref={setRef}
      data-editor-id={id}
      data-placeholder={placeholder ?? ""}
      className={className}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      spellCheck={false}
      onFocus={onFocus}
      onInput={(event) => onTextChange(editorElementToMarkup(event.currentTarget))}
      onBlur={(event) => onBlurText?.(editorElementToMarkup(event.currentTarget))}
      onKeyDown={(event) => {
        if (onKeyDown === undefined) return;
        onKeyDown(
          event,
          editorElementToMarkup(event.currentTarget),
          editorPlainSelection(event.currentTarget),
          event.currentTarget,
        );
      }}
    />
  );
}
