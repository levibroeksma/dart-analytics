import { describe, it, expect, vi } from "vitest";
import type { Alpine } from "alpinejs";
import { registerUiData } from "@lib/client/alpine/register-ui-data";
import { logoutButton } from "@auth/logout.data";
import { toggleData } from "@lib/ui/toggle.data";
import { gameLayoutData } from "@lib/ui/game-layout.data";
import { chartData } from "@lib/ui/chart.data";
import { heatmapCanvas } from "@lib/ui/heatmap-canvas.data";
import { growingCard } from "@lib/ui/growing-card.data";
import { stepperData } from "@lib/ui/stepper.data";

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

  it("registers heatmapCanvas as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("heatmapCanvas", heatmapCanvas);
  });

  it("registers chartData as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("chartData", chartData);
  });

  it("registers growingCard as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("growingCard", growingCard);
  });

  it("registers stepper as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("stepper", stepperData);
  });
});
