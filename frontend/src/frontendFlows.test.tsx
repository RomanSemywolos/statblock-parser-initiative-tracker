import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  IndexedDbSettingsRepository,
  IndexedDbStatblockRepository,
  createAppSettings,
  serializeLibraryExport,
} from "statblock-parser-core/product";

import { LibrarySidebar } from "./AppPanels";
import { CardConfigEditor, RichInteractiveText } from "./StatblockViews";
import { downloadLibraryExport, readLibraryImport } from "./fileTransfers";
import { fixtureSavedStatblock } from "./testFixtures";

describe("critical frontend flows", () => {
  it("keeps a reparsing statblock deletion control disabled", () => {
    const saved = fixtureSavedStatblock();
    render(
      <LibrarySidebar
        library={[saved]}
        parseJobs={[]}
        opened={null}
        editing={false}
        error={null}
        loading={false}
        documentsEqual={() => true}
        deletionLockedStatblockIds={new Set([saved.id])}
        onStartImport={() => {}}
        onRetryParseJob={() => {}}
        onDismissParseJob={() => {}}
        onOpen={() => {}}
        onAddToEncounter={() => {}}
        onRemove={() => {}}
        onDragStart={() => {}}
        mobileOpen={false}
      />,
    );

    const remove = screen.getByTitle("Видалення заблоковане до завершення повторного розбору") as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
  });

  it("renders authoring markup and preserves limited-use interactivity", async () => {
    const onChange = vi.fn();
    render(
      <RichInteractiveText
        text="***Probing Telepathy.*** (3/Day) Text."
        keyPrefix="trait"
        label="Trait"
        onRoll={() => {}}
        results={{}}
        limitedUses={{}}
        onLimitedUseChange={onChange}
      />,
    );

    expect(screen.getByText("Probing Telepathy.").closest("strong")?.querySelector("em")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Зменшити (3/Day)" }));
    expect(onChange).toHaveBeenCalledWith(expect.any(String), 3, 2);
  });

  it("persists isolated records through the real IndexedDB repository", async () => {
    const repository = new IndexedDbStatblockRepository({
      indexedDBFactory: indexedDB,
      databaseName: `frontend-test-${crypto.randomUUID()}`,
    });
    const saved = fixtureSavedStatblock();
    await repository.put(saved);
    const read = await repository.get(saved.id);
    expect(read?.versions.en.working.facts.name).toBe("Aboleth");
    read!.versions.en.working.facts.name = "mutated copy";
    expect((await repository.get(saved.id))?.versions.en.working.facts.name).toBe("Aboleth");
  });

  it("persists frontend settings through IndexedDB", async () => {
    const repository = new IndexedDbSettingsRepository({
      indexedDBFactory: indexedDB,
      databaseName: `settings-test-${crypto.randomUUID()}`,
    });
    const settings = createAppSettings({ backendUrl: "http://127.0.0.1:3030", now: "2026-09-06T00:00:00.000Z" });
    await repository.put(settings);
    expect((await repository.get())?.formatVersion).toBe(settings.formatVersion);
    await repository.clear();
    expect(await repository.get()).toBeUndefined();
  });

  it("offers HP and AC source rows as normal pinned-card choices", async () => {
    const saved = fixtureSavedStatblock();
    const onChange = vi.fn();
    render(<CardConfigEditor document={saved.versions.en.working} config={saved.cardConfig} onChange={onChange} />);
    const ac = screen.getByText("Armor Class").closest("label")?.querySelector("input") as HTMLInputElement;
    const hp = screen.getByText("Hit Points").closest("label")?.querySelector("input") as HTMLInputElement;
    expect(ac.checked).toBe(false);
    expect(hp.checked).toBe(false);
    await userEvent.click(hp);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ customContentIds: ["hp"] }));
  });

  it("imports a library file and exports with a stable GitHub-friendly filename", async () => {
    const saved = fixtureSavedStatblock();
    const serialized = serializeLibraryExport([saved]);
    const file = { name: "library.json", text: async () => serialized } as File;
    expect((await readLibraryImport(file)).statblocks.map((entry) => entry.id)).toEqual([saved.id]);

    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const downloads: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    downloadLibraryExport([saved], new Date("2026-09-06T00:00:00.000Z"));
    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(downloads).toEqual(["statblock-library-2026-09-06.json"]);
  });
});
