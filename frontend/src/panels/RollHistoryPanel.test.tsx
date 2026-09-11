import { act, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { RollHistoryPanel } from "./RollHistoryPanel";
import { useDiceRoller } from "../hooks/useDiceRoller";

it("opens and closes a separate history dialog containing all supplied rolls", async () => {
  const show = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
  const { container } = render(
    <RollHistoryPanel
      entries={[
        {
          id: "1",
          label: "Attack",
          result: {
            expression: { count: 1, sides: 20, modifier: 4 },
            normalized: "1d20+4",
            rolls: [20],
            modifier: 4,
            total: 24,
          },
        },
      ]}
    />,
  );
  const dialog = container.querySelector("dialog")!;
  dialog.showModal = show;
  dialog.close = close;
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Розгорнути історію кидків" }));
  expect(show).toHaveBeenCalledOnce();
  expect(within(screen.getByRole("dialog")).getByText("24").className).toBe("natural-d20-success");
  await user.click(screen.getByRole("button", { name: "Закрити історію кидків" }));
  expect(close).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("retains the latest hundred session rolls in newest-first order", () => {
  const { result } = renderHook(useDiceRoller);
  act(() => {
    for (let i = 0; i < 105; i++) result.current.performRoll({ count: 1, sides: 20, modifier: 0 }, `Roll ${i}`);
  });
  expect(result.current.rollHistory).toHaveLength(100);
  expect(result.current.rollHistory[0]?.label).toBe("Roll 104");
  expect(result.current.rollHistory[99]?.label).toBe("Roll 5");
});
