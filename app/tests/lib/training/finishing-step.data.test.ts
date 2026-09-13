import { describe, it, expect, vi } from "vitest";

vi.mock("@lib/game/tuod-play.data", () => ({
  tuodPlay: vi.fn(() => ({
    finished: false,
    timer: null,
    async uploadAndCompleteSession() {
      this.finished = true;
    },
  })),
}));
vi.mock("@lib/game/play-lifecycle", () => ({
  playAbandonAndExit: vi.fn(),
}));

import { finishingStep } from "@lib/training/finishing-step.data";
import { playAbandonAndExit } from "@lib/game/play-lifecycle";

describe("finishingStep", () => {
  it("calls onStepComplete after tuodPlay()'s own upload finishes", async () => {
    const onStepComplete = vi.fn();
    const wrapped = finishingStep(onStepComplete, vi.fn());
    await wrapped.uploadAndCompleteSession.call(wrapped as never);
    expect(wrapped.finished).toBe(true);
    expect(onStepComplete).toHaveBeenCalledOnce();
  });

  it("abandonAndExit stops the timer and delegates to playAbandonAndExit, redirecting to /training", async () => {
    const onAbandon = vi.fn();
    const wrapped = finishingStep(vi.fn(), onAbandon);
    wrapped.timer = { stop: vi.fn() } as never;

    await wrapped.abandonAndExit.call(wrapped as never);

    expect(
      (wrapped.timer as unknown as { stop: () => void }).stop,
    ).toHaveBeenCalledOnce();
    expect(playAbandonAndExit).toHaveBeenCalledWith(
      wrapped,
      onAbandon,
      "/training",
    );
  });
});
