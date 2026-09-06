import { describe, expect, it } from "vitest";

import type {
  EncounterRepository,
  EncounterState,
  SavedStatblock,
  StatblockRepository,
} from "statblock-parser-core/product";
import { createEncounterAutosaveCoordinator, createStatblockAutosaveCoordinator } from "./persistenceOrchestration";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("persistence coordination", () => {
  it("serializes a manual statblock save after an older in-flight autosave", async () => {
    const oldWrite = deferred();
    const events: string[] = [];
    const repository = {
      async put(value: SavedStatblock) {
        events.push(`start:${value.updatedAt}`);
        if (value.updatedAt === "old") await oldWrite.promise;
        events.push(`finish:${value.updatedAt}`);
      },
    } as StatblockRepository;
    const coordinator = createStatblockAutosaveCoordinator(repository, 0, (error) => {
      throw error;
    });

    coordinator.schedule({ id: "same", updatedAt: "old" } as SavedStatblock);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const manualSave = coordinator.persistImmediately({ id: "same", updatedAt: "new" } as SavedStatblock);
    await Promise.resolve();
    expect(events).toEqual(["start:old"]);

    oldWrite.resolve();
    await manualSave;
    expect(events).toEqual(["start:old", "finish:old", "start:new", "finish:new"]);
    coordinator.dispose();
  });

  it("serializes immediate encounter persistence after an in-flight autosave", async () => {
    const oldWrite = deferred();
    const events: string[] = [];
    const repository = {
      async put(value: EncounterState) {
        events.push(`start:${value.updatedAt}`);
        if (value.updatedAt === "old") await oldWrite.promise;
        events.push(`finish:${value.updatedAt}`);
      },
    } as EncounterRepository;
    const coordinator = createEncounterAutosaveCoordinator(repository, 0, (error) => {
      throw error;
    });

    coordinator.schedule({ updatedAt: "old" } as EncounterState);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const immediate = coordinator.persistImmediately({ updatedAt: "new" } as EncounterState);
    await Promise.resolve();
    expect(events).toEqual(["start:old"]);

    oldWrite.resolve();
    await immediate;
    expect(events).toEqual(["start:old", "finish:old", "start:new", "finish:new"]);
    coordinator.dispose();
  });
});
