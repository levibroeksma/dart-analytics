import { describe, it, expect, vi } from "vitest";

vi.mock("@lib/game/tuod-play.data", () => ({
  tuodPlay: vi.fn(() => ({
    finished: false,
    async uploadAndCompleteSession() {
      this.finished = true;
    },
  })),
}));

import { finishingStep } from "@lib/training/finishing-step.data";

describe("finishingStep", () => {
  it("calls onStepComplete after tuodPlay()'s own upload finishes", async () => {
    const onStepComplete = vi.fn();
    const wrapped = finishingStep(onStepComplete);
    await wrapped.uploadAndCompleteSession.call(wrapped as never);
    expect(wrapped.finished).toBe(true);
    expect(onStepComplete).toHaveBeenCalledOnce();
  });
});
