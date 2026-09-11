import type { EditableHeaderRow, EditableStatblockDocument } from "statblock-parser-core/product";
import { abilityLabels, abilityLabelsUk, abilityOrder, formatBonus } from "../statblockUi";
import { splitKnownHeaderRow } from "./statblockPresentation";

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function escapeInlineHtml(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/gu, "<br>");
}

/** Converts only the editor's supported inline authoring marks to safe HTML. */
export function authoringMarkupToHtml(text: string): string {
  const pattern = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/gu;
  let result = "";
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    result += escapeInlineHtml(text.slice(cursor, start));
    const source = match[0];
    if (source.startsWith("***")) result += `<strong><em>${escapeInlineHtml(source.slice(3, -3))}</em></strong>`;
    else if (source.startsWith("**")) result += `<strong>${escapeInlineHtml(source.slice(2, -2))}</strong>`;
    else result += `<em>${escapeInlineHtml(source.slice(1, -1))}</em>`;
    cursor = start + source.length;
  }
  return result + escapeInlineHtml(text.slice(cursor));
}

function markupToPlainText(text: string): string {
  return text
    .replace(/\*\*\*/gu, "")
    .replace(/\*\*/gu, "")
    .replace(/\*/gu, "");
}

function headerRowHtml(row: EditableHeaderRow): string {
  const split = splitKnownHeaderRow(row);
  if (split.label === null) return `<p>${authoringMarkupToHtml(row.text)}</p>`;
  return `<p><strong>${escapeHtml(split.label)}</strong>${
    split.value.length > 0 ? ` ${authoringMarkupToHtml(split.value)}` : ""
  }</p>`;
}

export function serializeStatblockForClipboard(document: EditableStatblockDocument): {
  html: string;
  plainText: string;
} {
  const labels = document.language === "uk" ? abilityLabelsUk : abilityLabels;
  const name = document.header.name?.text ?? "";
  const subtitle = document.header.subtitle?.text ?? "";
  const rows = [...document.header.primaryRows, ...document.header.secondaryRows];
  const abilityHeadings = abilityOrder
    .map(
      (ability) =>
        `<td style="width:16.666%;padding:4px 6px;text-align:center"><strong>${escapeHtml(labels[ability])}</strong></td>`,
    )
    .join("");
  const abilityValues = abilityOrder
    .map((ability) => {
      const fact = document.header.abilities[ability];
      return `<td style="width:16.666%;padding:4px 6px;text-align:center"><strong>${fact?.score ?? "—"}</strong> (${escapeHtml(formatBonus(fact?.modifier ?? null))})</td>`;
    })
    .join("");
  const savingThrows = abilityOrder
    .filter((ability) => document.header.savingThrows[ability] !== null)
    .map((ability) => `${labels[ability]} ${formatBonus(document.header.savingThrows[ability])}`)
    .join(", ");
  const savingLabel = document.language === "uk" ? "Ряткидки" : "Saving Throws";

  const html = [
    `<article style="font-family:Georgia,serif;max-width:720px;color:#2a211b">`,
    name.length > 0 ? `<h1>${authoringMarkupToHtml(name)}</h1>` : "",
    subtitle.length > 0 ? `<p><em>${authoringMarkupToHtml(subtitle)}</em></p>` : "",
    rows.map(headerRowHtml).join(""),
    `<table style="width:100%;border-collapse:collapse;text-align:center"><tbody><tr>${abilityHeadings}</tr><tr>${abilityValues}</tr></tbody></table>`,
    savingThrows.length > 0 ? `<p><strong>${savingLabel}</strong> ${escapeHtml(savingThrows)}</p>` : "",
    document.body
      .map((node) =>
        node.type === "heading"
          ? `<h2>${authoringMarkupToHtml(node.text)}</h2>`
          : `<p>${authoringMarkupToHtml(node.text)}</p>`,
      )
      .join(""),
    `</article>`,
  ].join("");

  const abilityText = abilityOrder
    .map((ability) => {
      const fact = document.header.abilities[ability];
      return `${labels[ability]} ${fact?.score ?? "—"} (${formatBonus(fact?.modifier ?? null)})`;
    })
    .join(" · ");
  const plainText = [
    markupToPlainText(name),
    subtitle.length > 0 ? markupToPlainText(subtitle) : "",
    ...rows.map((row) => markupToPlainText(row.text)),
    abilityText,
    savingThrows.length > 0 ? `${savingLabel} ${savingThrows}` : "",
    ...document.body.map((node) => markupToPlainText(node.text)),
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  return { html, plainText };
}

export async function copyStatblock(document: EditableStatblockDocument): Promise<void> {
  const { html, plainText } = serializeStatblockForClipboard(document);
  if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function") {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  if (typeof navigator.clipboard?.writeText === "function") {
    await navigator.clipboard.writeText(plainText);
    return;
  }

  const container = window.document.createElement("div");
  container.contentEditable = "true";
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.innerHTML = html;
  window.document.body.append(container);
  const selection = window.getSelection();
  const range = window.document.createRange();
  range.selectNodeContents(container);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const copied = window.document.execCommand("copy");
  selection?.removeAllRanges();
  container.remove();
  if (!copied) throw new Error("Browser rejected clipboard access.");
}
