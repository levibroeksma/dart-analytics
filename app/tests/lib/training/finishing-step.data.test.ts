// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@lib/game/tuod-play.data", () => ({
  tuodPlay: vi.fn(),
}));
vi.mock("@lib/game/play-lifecycle", () => ({
  playAbandonAndExit: vi.fn(),
}));

import { finishingStep } from "@lib/training/finishing-step.data";
import { tuodPlay } from "@lib/game/tuod-play.data";
import { playAbandonAndExit } from "@lib/game/play-lifecycle";
import type { TuodPlayContext } from "@lib/types";

function baseDouble(uploadOutcome: "succeeded" | "failed") {
  return {
    completionStatus: "pending" as string,
    timer: { stop: vi.fn() },
    async uploadAndCompleteSession(this: { completionStatus: string }) {
      this.completionStatus = uploadOutcome;
    },
    async abandonAndExit() {},
  };
}

describe("finishingStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("advances the routine once TUOD's own upload succeeded", async () => {
    vi.mocked(tuodPlay).mockReturnValue(baseDouble("succeeded") as never);
    const onStepComplete = vi.fn().mockResolvedValue(undefined);
    const store = finishingStep(onStepComplete, vi.fn());

    await (store as unknown as TuodPlayContext).uploadAndCompleteSession();

    expect(onStepComplete).toHaveBeenCalledOnce();
  });

  it("leaves the routine on the Finishing step when the upload failed, so the darts can still be retried", async () => {
    vi.mocked(tuodPlay).mockReturnValue(baseDouble("failed") as never);
    const onStepComplete = vi.fn().mockResolvedValue(undefined);
    const store = finishingStep(onStepComplete, vi.fn());

    await (store as unknown as TuodPlayContext).uploadAndCompleteSession();

    expect(onStepComplete).not.toHaveBeenCalled();
  });

  it("abandonAndExit() stops the timer and routes back to the training page", async () => {
    vi.mocked(tuodPlay).mockReturnValue(baseDouble("succeeded") as never);
    const onAbandon = vi.fn();
    const store = finishingStep(vi.fn(), onAbandon);

    await (store as unknown as TuodPlayContext).abandonAndExit();

    expect(playAbandonAndExit).toHaveBeenCalledWith(
      expect.anything(),
      onAbandon,
      "/training",
    );
  });
});
