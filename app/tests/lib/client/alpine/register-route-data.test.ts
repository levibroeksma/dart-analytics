import { describe, it, expect, vi } from "vitest";
import type { Alpine } from "alpinejs";
import { registerRouteData } from "@lib/client/alpine/register-route-data";
import { quickSubtractPlay } from "@lib/trivia/quick-subtract-play.data";

describe("registerRouteData", () => {
  it("registers quickSubtractPlay as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("quickSubtractPlay", quickSubtractPlay);
  });
});
