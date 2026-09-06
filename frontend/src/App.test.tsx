import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
