import { parseLibraryExport, serializeLibraryExport, type SavedStatblock } from "statblock-parser-core/product";

function downloadText(text: string, filename: string, contentType: string): void {
  const blob = new Blob([text], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadLibraryExport(library: readonly SavedStatblock[], now = new Date()): void {
  const date = now.toISOString().slice(0, 10);
  downloadText(serializeLibraryExport([...library]), `statblock-library-${date}.json`, "application/json");
}

export function downloadParserDiagnostics(bundle: unknown, now = new Date()): void {
  const date = now.toISOString().replace(/[:.]/gu, "-");
  downloadText(`${JSON.stringify(bundle, null, 2)}\n`, `statblock-parse-reports-${date}.json`, "application/json");
}

export async function readLibraryImport(file: File) {
  return parseLibraryExport(await file.text());
}
