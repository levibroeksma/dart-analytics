import type { RoutineStepSummary, EngineFacts } from "@modules/types";
import type { StartTrainingStepResponseData } from "@client/api/types";
import type { RoutinePlayContext } from "../types";
import type { StepAdapterKey, StepPanel } from "./types";

/**
 * One step kind's own binding into `routine-play.data.ts`: how it starts,
 * what it uploads, whether it completes its own session, how it summarises
 * itself for the routine summary, and what it tears down when the step
 * ends. `routine-play.data.ts` itself holds no per-kind branching any
 * more — every one of those five questions is answered by whichever
 * adapter `stepAdapterKey()` resolves.
 */
export interface StepAdapter {
  key: StepAdapterKey;
  /** The session header's own step label — replaces the old `STEP_LABELS`. */
  headerLabel: string;
  /** Which of the play page's `x-if` blocks renders this step. */
  panel: StepPanel;
  open(
    ctx: RoutinePlayContext,
    result: StartTrainingStepResponseData,
    durationSeconds: number,
  ): void;
  /**
   * The engine facts to upload when the step ends, or `null` when there is
   * nothing to upload — a GAME step's own game store uploads itself
   * (`completesOwnSession`), so this is always `null` there.
   */
  facts(ctx: RoutinePlayContext): EngineFacts | null;
  /**
   * `true` for a GAME step: its own game store marks the exercise session
   * COMPLETED as part of `uploadAndCompleteSession()`, so
   * `advanceAfterStepCompletion` must not also complete it. `false` for
   * every other kind, whose session the routine completes itself.
   */
  completesOwnSession: boolean;
  summarise(ctx: RoutinePlayContext): RoutineStepSummary | null;
  /** Clears whatever engine/timer/game-store slot this adapter's `open` set. */
  close(ctx: RoutinePlayContext): void;
}
