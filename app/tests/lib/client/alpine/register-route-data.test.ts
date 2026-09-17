import { describe, it, expect, vi } from "vitest";
import type { Alpine } from "alpinejs";
import { registerRouteData } from "@lib/client/alpine/register-route-data";
import { quickSubtractPlay } from "@lib/training/trivia/quick-subtract-play.data";
import { balancedTrainingPlay } from "@lib/training/routines/balanced-training-play.data";
import { routineStart } from "@lib/training/routines/routine-start.data";

describe("registerRouteData", () => {
  it("registers quickSubtractPlay as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("quickSubtractPlay", quickSubtractPlay);
  });

  it("registers balancedTrainingPlay as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith(
      "balancedTrainingPlay",
      balancedTrainingPlay,
    );
  });

  it("registers routineStart as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("routineStart", routineStart);
  });
});
