import { useEffect, useRef } from "react";
import type { EditableStatblockNode } from "statblock-parser-core/product";
import { serializeBodyEditor } from "./bodyEditorSerialization";
import { sectionHeadingLabel } from "./statblockPresentation";
import { appendEditorMarkup } from "./richEditorMarkup";

function hydrateBodyEditor(element: HTMLDivElement, body: EditableStatblockNode[]): void {
  element.replaceChildren();

  const nodes = body.length > 0 ? body : [{ id: crypto.randomUUID(), type: "paragraph" as const, text: "" }];

  for (const node of nodes) {
    const block = document.createElement(node.type === "heading" ? "h2" : "div");
    block.dataset.nodeId = node.id;
    block.dataset.nodeType = node.type;
    if (node.type === "heading") {
      block.dataset.headingKind = node.headingKind ?? "";
      block.dataset.headingLabel = sectionHeadingLabel(node);
      block.className = "statblock-section-heading body-editor-heading";
      appendEditorMarkup(block, node.text);
    } else {
      block.className = "body-editor-paragraph";
      appendEditorMarkup(block, node.text);
    }
    if (block.childNodes.length === 0) block.appendChild(document.createElement("br"));
    element.appendChild(block);
  }
}

export function BodyRichEditor({
  body,
  onChange,
  onFocus,
  register,
}: {
  body: EditableStatblockNode[];
  onChange: (body: EditableStatblockNode[]) => void;
  onFocus: () => void;
  register: (node: HTMLDivElement | null) => void;
}) {
  const ownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ownRef.current;
    if (element === null || element.contains(document.activeElement)) return;
    hydrateBodyEditor(element, body);
  }, [body]);

  function setRef(node: HTMLDivElement | null) {
    ownRef.current = node;
    register(node);
    if (node !== null && node.childNodes.length === 0) hydrateBodyEditor(node, body);
  }

  return (
    <div
      ref={setRef}
      className="body-rich-editor"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-multiline="true"
      onFocus={onFocus}
      onInput={(event) => onChange(serializeBodyEditor(event.currentTarget))}
    />
  );
}
