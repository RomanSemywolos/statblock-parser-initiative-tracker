import type { CompiledAnnotation, DocumentBlock, LosslessStatblockDocument, ParserReport } from "./domain.js";

import { normalizePresentationText } from "./normalizer.js";

function annotationForBlock(
  block: DocumentBlock,
  annotations: ReadonlyMap<string, CompiledAnnotation>,
): CompiledAnnotation | null {
  if (block.annotationId === null) {
    return null;
  }

  return annotations.get(block.annotationId) ?? null;
}

/*
 * Форматування генерується, а вміст джерела — ні. Кожен непробільний блок виводиться
 * рівно один раз і в початковому порядку.
 */
export function renderNormalizedStatblock(document: LosslessStatblockDocument): string {
  const annotations = new Map(document.annotations.map((annotation) => [annotation.id, annotation] as const));

  const contentBlocks = document.blocks.filter((block) => block.kind !== "separator");

  let output = "";

  let previousAnnotation: CompiledAnnotation | null = null;

  for (const block of contentBlocks) {
    const annotation = annotationForBlock(block, annotations);

    if (output.length > 0) {
      const previousIsHeader =
        previousAnnotation?.role === "header_field" || previousAnnotation?.role === "header_content";

      const currentIsHeader = annotation?.role === "header_field" || annotation?.role === "header_content";

      output += previousIsHeader && currentIsHeader ? "\n" : "\n\n";
    }

    output += normalizePresentationText(block.text);

    previousAnnotation = annotation;
  }

  return output.length === 0 ? "" : `${output}\n`;
}

export function createParserReport(document: LosslessStatblockDocument): ParserReport {
  return {
    formatVersion: "lossless-statblock-report-v1",
    sourceSha256: document.sourceMap.sourceSha256,
    rawLength: document.sourceMap.rawLength,
    sourceUnitCount: document.sourceMap.units.length,
    contentUnitCount: document.sourceMap.units.filter((unit) => unit.kind === "content").length,
    blockCount: document.blocks.length,
    annotatedBlockCount: document.blocks.filter((block) => block.kind === "annotated").length,
    unclassifiedBlockCount: document.blocks.filter((block) => block.kind === "unclassified").length,
    separatorBlockCount: document.blocks.filter((block) => block.kind === "separator").length,
    structuredHeader: document.structuredHeader,
    model: document.model,
    integrity: document.integrity,
    issues: document.issues,
  };
}
