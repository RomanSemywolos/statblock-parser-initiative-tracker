import type { SavedStatblock } from "./productModel.js";
import { migrateSavedStatblock } from "./productMigration.js";

export type LibraryExportV2 = {
  formatVersion: 2;
  exportedAt: string;
  statblocks: SavedStatblock[];
};

function cloneStatblock(value: SavedStatblock): SavedStatblock {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createLibraryExport(
  statblocks: SavedStatblock[],
  exportedAt = new Date().toISOString(),
): LibraryExportV2 {
  return {
    formatVersion: 2,
    exportedAt,
    statblocks: statblocks.map((value) => cloneStatblock(migrateSavedStatblock(value))),
  };
}

export function serializeLibraryExport(statblocks: SavedStatblock[], exportedAt?: string): string {
  return JSON.stringify(createLibraryExport(statblocks, exportedAt), null, 2);
}

export function parseLibraryExport(text: string): LibraryExportV2 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Library import is not valid JSON.");
  }

  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.statblocks) ||
    (parsed.formatVersion !== 1 && parsed.formatVersion !== 2)
  ) {
    throw new Error("Unsupported or malformed library export.");
  }

  let statblocks: SavedStatblock[];
  try {
    statblocks = parsed.statblocks.map(migrateSavedStatblock);
  } catch (error) {
    throw new Error(
      `Library export contains an invalid statblock entry: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    formatVersion: 2,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : "",
    statblocks: statblocks.map(cloneStatblock),
  };
}
