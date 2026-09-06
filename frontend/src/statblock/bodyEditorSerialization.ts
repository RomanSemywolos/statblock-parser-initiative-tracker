import {
  PRODUCT_STATBLOCK_SECTIONS,
  type EditableStatblockNode,
  type ProductStatblockSection,
} from "statblock-parser-core/product";
import { editorElementToMarkup, looseBodyNodeIds } from "./richEditorMarkup";
import { sectionHeadingLabel } from "./statblockPresentation";

export function serializeBodyEditor(element: HTMLDivElement): EditableStatblockNode[] {
  const result: EditableStatblockNode[] = [];
  const seenIds = new Set<string>();

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text.length === 0) continue;
      let id = looseBodyNodeIds.get(child);
      if (id === undefined) {
        id = crypto.randomUUID();
        looseBodyNodeIds.set(child, id);
      }
      result.push({ id, type: "paragraph", text });
      continue;
    }

    if (!(child instanceof HTMLElement)) continue;

    let id = child.dataset.nodeId;
    if (id === undefined || id.length === 0 || seenIds.has(id)) {
      id = crypto.randomUUID();
      child.dataset.nodeId = id;
    }
    seenIds.add(id);

    const tag = child.tagName.toLocaleLowerCase();
    const heading = child.dataset.nodeType === "heading" || /^h[1-6]$/u.test(tag);
    const text = editorElementToMarkup(child);

    if (heading) {
      const storedKind = child.dataset.headingKind ?? "";
      const headingKind = PRODUCT_STATBLOCK_SECTIONS.includes(storedKind as ProductStatblockSection)
        ? (storedKind as ProductStatblockSection)
        : null;
      child.dataset.nodeType = "heading";
      child.dataset.headingKind = headingKind ?? "";
      child.dataset.headingLabel = sectionHeadingLabel({
        id,
        type: "heading",
        headingKind,
        text,
      });
      child.classList.add("statblock-section-heading", "body-editor-heading");
      result.push({ id, type: "heading", headingKind, text });
    } else {
      child.dataset.nodeType = "paragraph";
      child.classList.remove("statblock-section-heading", "body-editor-heading");
      child.classList.add("body-editor-paragraph");
      result.push({ id, type: "paragraph", text });
    }
  }

  return result;
}
