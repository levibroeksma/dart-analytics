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
import { rangeSliderData } from "@lib/ui/range-slider.data";
import { slideToStartData } from "@lib/ui/slide-to-start.data";
import { initialsOf, playerCountLabel } from "@lib/ui/initials";

describe("registerUiData", () => {
  it("registers logoutButton as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data, magic: vi.fn() } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("logoutButton", logoutButton);
  });

  it("registers toggle as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data, magic: vi.fn() } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("toggle", toggleData);
  });

  it("registers gameLayout as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data, magic: vi.fn() } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("gameLayout", gameLayoutData);
  });

  it("registers heatmapCanvas as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data, magic: vi.fn() } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("heatmapCanvas", heatmapCanvas);
  });

  it("registers chartData as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data, magic: vi.fn() } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("chartData", chartData);
  });

  it("registers growingCard as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data, magic: vi.fn() } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("growingCard", growingCard);
  });

  it("registers stepper as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data, magic: vi.fn() } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("stepper", stepperData);
  });

  it("registers rangeSlider as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data, magic: vi.fn() } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("rangeSlider", rangeSliderData);
  });

  it("registers slideToStart as an Alpine data factory", () => {
    const data = vi.fn();
    registerUiData({ data, magic: vi.fn() } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("slideToStart", slideToStartData);
  });

  it("registers $initials and $playerCount as Alpine magics", () => {
    const magic = vi.fn();
    registerUiData({ data: vi.fn(), magic } as unknown as Alpine);
    const getters = Object.fromEntries(
      magic.mock.calls.map(([name, getter]) => [name, getter()]),
    );
    expect(getters.initials).toBe(initialsOf);
    expect(getters.playerCount).toBe(playerCountLabel);
  });
});
