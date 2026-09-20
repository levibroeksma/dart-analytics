// @vitest-environment jsdom
/**
 * The wrapper's own contract, over a double: that `gameStep` advances the
 * routine only on a succeeded upload, and that leaving mid-step routes back
 * to `/training`. Mocking `tuodPlay` keeps these three cases independent of
 * TUOD's rules, but it also means the seam between the store and the routine
 * — `recordDart` -> `showFinishConfirm` -> `confirmFinish` -> the advance —
 * runs in no test here. `finishing-step-seam.test.ts` covers that path
 * against the real store (issue #370).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@lib/game/tuod-play.data", () => ({
  tuodPlay: vi.fn(),
}));
vi.mock("@lib/game/play-lifecycle", () => ({
  playAbandonAndExit: vi.fn(),
}));

import { gameStep } from "@lib/training/routines/game-step.data";
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

describe("gameStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("advances the routine once the game's own upload succeeded", async () => {
    vi.mocked(tuodPlay).mockReturnValue(baseDouble("succeeded") as never);
    const onStepComplete = vi.fn().mockResolvedValue(undefined);
    const store = gameStep(tuodPlay, onStepComplete, vi.fn());

    await (store as unknown as TuodPlayContext).uploadAndCompleteSession();

    expect(onStepComplete).toHaveBeenCalledOnce();
  });

  it("leaves the routine on the step when the upload failed, so the darts can still be retried", async () => {
    vi.mocked(tuodPlay).mockReturnValue(baseDouble("failed") as never);
    const onStepComplete = vi.fn().mockResolvedValue(undefined);
    const store = gameStep(tuodPlay, onStepComplete, vi.fn());

    await (store as unknown as TuodPlayContext).uploadAndCompleteSession();

    expect(onStepComplete).not.toHaveBeenCalled();
  });

  it("abandonAndExit() stops the timer and routes back to the training page", async () => {
    vi.mocked(tuodPlay).mockReturnValue(baseDouble("succeeded") as never);
    const onAbandon = vi.fn();
    const store = gameStep(tuodPlay, vi.fn(), onAbandon);

    await (store as unknown as TuodPlayContext).abandonAndExit();

    expect(playAbandonAndExit).toHaveBeenCalledWith(
      expect.anything(),
      onAbandon,
      "/training",
    );
  });
});
