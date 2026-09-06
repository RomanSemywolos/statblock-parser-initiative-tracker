import { createHash } from "node:crypto";

import type { LosslessSourceMap, SourceUnit, SourceUnitKind } from "./domain.js";

const SOURCE_MAP_VERSION = "lossless-source-v1" as const;

const SOURCE_ENCODING = "utf8" as const;

function sourceHash(rawSource: string): string {
  return createHash("sha256").update(rawSource, SOURCE_ENCODING).digest("hex");
}

function expectedUnitId(index: number): string {
  return `unit-${index}`;
}

function classifyUnit(text: string): SourceUnitKind {
  return /^\s+$/u.test(text) ? "separator" : "content";
}

/*
 * Пробільні та непробільні фрагменти виділяються суто механічно.
 * Токенізатор навмисно не залежить від жодного можливого синтаксису статблоку.
 */
export function createLosslessSourceMap(rawSource: string): LosslessSourceMap {
  const units: SourceUnit[] = [];

  let unitIndex = 0;

  for (const match of rawSource.matchAll(/\s+|[^\s]+/gu)) {
    const text = match[0];

    const start = match.index;

    units.push({
      id: expectedUnitId(unitIndex),
      start,
      end: start + text.length,
      text,
      kind: classifyUnit(text),
    });

    unitIndex += 1;
  }

  const sourceMap: LosslessSourceMap = {
    version: SOURCE_MAP_VERSION,
    encoding: SOURCE_ENCODING,
    rawLength: rawSource.length,
    sourceSha256: sourceHash(rawSource),
    units,
  };

  if (!validateLosslessSourceMap(rawSource, sourceMap)) {
    throw new Error("Application-created source map failed its own integrity validation.");
  }

  return sourceMap;
}

export function reconstructLosslessSource(sourceMap: LosslessSourceMap): string {
  return sourceMap.units.map((unit) => unit.text).join("");
}

export function validateLosslessSourceMap(rawSource: string, sourceMap: LosslessSourceMap): boolean {
  if (
    sourceMap.version !== SOURCE_MAP_VERSION ||
    sourceMap.encoding !== SOURCE_ENCODING ||
    sourceMap.rawLength !== rawSource.length ||
    sourceMap.sourceSha256 !== sourceHash(rawSource)
  ) {
    return false;
  }

  if (rawSource.length === 0) {
    return sourceMap.units.length === 0 && reconstructLosslessSource(sourceMap) === rawSource;
  }

  if (sourceMap.units.length === 0) {
    return false;
  }

  let cursor = 0;

  for (let index = 0; index < sourceMap.units.length; index += 1) {
    const unit = sourceMap.units[index];

    if (
      unit.id !== expectedUnitId(index) ||
      !Number.isSafeInteger(unit.start) ||
      !Number.isSafeInteger(unit.end) ||
      unit.start !== cursor ||
      unit.end <= unit.start ||
      unit.end > rawSource.length ||
      rawSource.slice(unit.start, unit.end) !== unit.text ||
      classifyUnit(unit.text) !== unit.kind
    ) {
      return false;
    }

    cursor = unit.end;
  }

  return cursor === rawSource.length && reconstructLosslessSource(sourceMap) === rawSource;
}
