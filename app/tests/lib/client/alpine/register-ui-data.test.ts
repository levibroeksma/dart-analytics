import { describe, it, expect, vi } from "vitest";
import type { Alpine } from "alpinejs";
import { registerUiData } from "@lib/client/alpine/register-ui-data";
import { logoutButton } from "@auth/logout.data";
import { toggleData } from "@lib/ui/toggle.data";
import { gameLayoutData } from "@lib/ui/game-layout.data";

describe("registerUiData", () => {
  it("registers logoutButton as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("logoutButton", logoutButton);
  });

  it("registers toggle as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("toggle", toggleData);
  });

  it("registers gameLayout as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("gameLayout", gameLayoutData);
  });
});
