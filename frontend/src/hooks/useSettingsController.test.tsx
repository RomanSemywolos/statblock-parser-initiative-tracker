import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemorySettingsRepository } from "statblock-parser-core/product";

import { useSettingsController } from "./useSettingsController";

describe("useSettingsController", () => {
  it("saves an existing selected model when the catalog is unconfirmed but the provider connection is usable", async () => {
    const repository = new MemorySettingsRepository();
    const selectedId = "groq-gpt-oss-20b";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/model-profiles/health")) {
          return Response.json({
            profiles: [
              {
                id: "default",
                displayName: "qwen3:8b (local Ollama)",
                providerType: "ollama",
                model: "qwen3:8b",
                health: { ok: true },
              },
              {
                id: selectedId,
                displayName: "GPT-OSS 20B (Groq)",
                providerType: "groq",
                model: "openai/gpt-oss-20b",
                health: { ok: true, code: "catalog_unconfirmed", detail: "catalog probe was inconclusive" },
              },
            ],
          });
        }
        if (url.endsWith("/health")) {
          return Response.json({ ok: true, model: "qwen3:8b", activeProfileId: "default" });
        }
        return Response.json({ error: "not found" }, { status: 404 });
      }),
    );

    const { result } = renderHook(() => useSettingsController(repository, () => {}));
    await waitFor(() => expect(result.current.settings.backendUrl).not.toBe(""));
    act(() => result.current.selectModelProfile(selectedId));
    await waitFor(() => expect(result.current.settingsModelProfileId).toBe(selectedId));

    let savePromise: Promise<boolean> | undefined;
    act(() => {
      savePromise = result.current.saveSettings();
    });
    const saved = await savePromise!;

    expect(saved).toBe(true);
    expect((await repository.get())?.activeParserModelProfileId).toBe(selectedId);
  });

  it("does not save a selected model whose health check genuinely failed", async () => {
    const repository = new MemorySettingsRepository();
    const selectedId = "groq-gpt-oss-20b";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/model-profiles/health")) {
          return Response.json({
            profiles: [
              {
                id: "default",
                displayName: "qwen3:8b (local Ollama)",
                providerType: "ollama",
                model: "qwen3:8b",
                health: { ok: true },
              },
              {
                id: selectedId,
                displayName: "GPT-OSS 20B (Groq)",
                providerType: "groq",
                model: "openai/gpt-oss-20b",
                health: { ok: false, code: "unauthorized", detail: "credential rejected" },
              },
            ],
          });
        }
        if (url.endsWith("/health")) {
          return Response.json({ ok: true, model: "qwen3:8b", activeProfileId: "default" });
        }
        return Response.json({ error: "not found" }, { status: 404 });
      }),
    );

    const { result } = renderHook(() => useSettingsController(repository, () => {}));
    await waitFor(() => expect(result.current.settings.backendUrl).not.toBe(""));
    act(() => result.current.selectModelProfile(selectedId));
    await waitFor(() => expect(result.current.settingsModelProfileId).toBe(selectedId));

    let savePromise: Promise<boolean> | undefined;
    act(() => {
      savePromise = result.current.saveSettings();
    });
    const saved = await savePromise!;

    expect(saved).toBe(false);
    expect((await repository.get())?.activeParserModelProfileId).not.toBe(selectedId);
  });
});
