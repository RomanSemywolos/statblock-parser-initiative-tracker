function appendEditorPlainText(parent: HTMLElement, text: string): void {
  const pattern =
    /\b\d+[ \t]*\([ \t]*(?:\d+[ \t]*)?[dDкК][ \t]*\d+(?:[ \t]*[+-][ \t]*\d+)?[ \t]*\)|\b(?:DC|СК)[ \t]+\d+\b/giu;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) parent.appendChild(document.createTextNode(text.slice(cursor, start)));
    const span = document.createElement("span");
    span.className = "mechanic-nowrap";
    span.dataset.autoFormat = "true";
    span.textContent = match[0].replace(/[ \t]+/gu, "\u00a0");
    parent.appendChild(span);
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parent.appendChild(document.createTextNode(text.slice(cursor)));
}

export function appendEditorMarkup(parent: HTMLElement, text: string): void {
  const pattern = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/gu;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) appendEditorPlainText(parent, text.slice(cursor, start));

    const source = match[0];
    const boldItalic = source.startsWith("***");
    const bold = !boldItalic && source.startsWith("**");
    const inner = boldItalic ? source.slice(3, -3) : bold ? source.slice(2, -2) : source.slice(1, -1);

    if (boldItalic) {
      const strong = document.createElement("strong");
      const em = document.createElement("em");
      appendEditorPlainText(em, inner);
      strong.appendChild(em);
      parent.appendChild(strong);
    } else {
      const element = document.createElement(bold ? "strong" : "em");
      appendEditorPlainText(element, inner);
      parent.appendChild(element);
    }

    cursor = start + source.length;
  }
  if (cursor < text.length) appendEditorPlainText(parent, text.slice(cursor));
}

function editorNodeToMarkup(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    return Array.from(node.childNodes).map(editorNodeToMarkup).join("");
  }
  if (!(node instanceof HTMLElement)) return "";
  const content = Array.from(node.childNodes).map(editorNodeToMarkup).join("");
  const tag = node.tagName.toLocaleLowerCase();
  if (node.dataset.autoFormat === "true") return content.replace(/\u00a0/gu, " ");
  if (tag === "strong" || tag === "b") return `**${content}**`;
  if (tag === "em" || tag === "i") return `*${content}*`;
  if (tag === "br") return "\n";
  if (tag === "div" || tag === "p") return `${content}\n`;
  return content;
}

export function editorElementToMarkup(element: HTMLElement): string {
  return Array.from(element.childNodes).map(editorNodeToMarkup).join("").replace(/\n+$/u, "");
}

export const BODY_EDITOR_ID = "__body-editor__";
export const looseBodyNodeIds = new WeakMap<Node, string>();
