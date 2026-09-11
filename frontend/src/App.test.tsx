import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { IndexedDbStatblockRepository } from "statblock-parser-core/product";
import { fixtureSavedStatblock } from "./testFixtures";

import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/parse-jobs")) return Response.json({ jobs: [] });
        if (url.endsWith("/api/model-profiles")) return Response.json({ profiles: [] });
        if (url.endsWith("/api/model-profiles/health")) return Response.json({ profiles: [] });
        if (url.endsWith("/api/translation/health"))
          return Response.json({ health: { ok: false, detail: "not configured" } });
        if (url.endsWith("/health")) return Response.json({ ok: true, model: "test", activeProfileId: "default" });
        return Response.json({ error: "not found" }, { status: 404 });
      }),
    );
  });

  it("renders and hydrates the main library and encounter application shell", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Бібліотека" })).not.toBeNull();
    expect(screen.getByText("Encounter")).not.toBeNull();
    expect(await screen.findByText("Бібліотека порожня. Імпортуй statblock.")).not.toBeNull();
  });

  it("places edit actions and formatting in the card header and restores copy in view mode", async () => {
    await new IndexedDbStatblockRepository().put(fixtureSavedStatblock());
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Aboleth/ }));
    expect(
      screen.getByRole("button", { name: "Копіювати статблок" }).closest(".statblock-sticky-header"),
    ).not.toBeNull();
    await user.click(screen.getByTitle("Керування карткою"));
    await user.click(screen.getByRole("button", { name: "Редагувати" }));
    expect(screen.queryByRole("button", { name: "Копіювати статблок" })).toBeNull();
    for (const name of ["Зберегти", "Завантажити збережену", "Завантажити резервну", "Автостиль"]) {
      expect(screen.getByRole("button", { name }).closest(".statblock-sticky-header")).not.toBeNull();
    }
    expect(document.querySelector(".editor-toolbar")).toBeNull();
    expect(document.querySelector(".toolbar-note")).toBeNull();
    await user.hover(screen.getByRole("button", { name: "Зберегти" }));
    expect(screen.getByRole("tooltip").textContent).toContain("автозберігаються");
    await user.unhover(screen.getByRole("button", { name: "Зберегти" }));
    await user.click(screen.getByTitle("Керування карткою"));
    await user.click(screen.getByRole("button", { name: "Закрити редагування" }));
    expect(screen.getByRole("button", { name: "Копіювати статблок" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Завантажити збережену" })).toBeNull();
  });
});
