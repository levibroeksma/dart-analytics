import { abandonTraining } from "@client/api/training-sessions";
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import {
  summariseTuod,
  summariseScoreTraining,
  summariseOneTwentyOne,
  summariseAroundTheClock,
} from "@modules/training/routines/routine-summary.module";
import { gameStep } from "../game-step.data";
import type { StepAdapter } from "./interfaces";
import type { StepPanel } from "./types";
import type { RoutineStepSummary } from "@modules/types";
import type {
  RoutinePlayContext,
  GameStepPlayContext,
  TuodSeatResult,
  ScoreTrainingSeatResult,
  OneTwentyOneSeatResult,
  AroundTheClockSeatResult,
  RulesetVersionKey,
} from "@lib/types";

/**
 * Reads a finished game step's own results snapshot. `ctx.game` is typed
 * as the narrow `GameStepPlayContext` `gameStep()` returns, which carries
 * no `resultsSnapshot` — every concrete game store actually has one, so
 * each `summarise*Step` wrapper below casts to its own seat's shape.
 */
function finishedSeat(ctx: RoutinePlayContext): unknown {
  return (ctx.game as { resultsSnapshot?: { seats: unknown[] } } | null)
    ?.resultsSnapshot?.seats[0];
}

export function summariseTuodStep(
  ctx: RoutinePlayContext,
): RoutineStepSummary | null {
  const seat = finishedSeat(ctx) as TuodSeatResult | undefined;
  return seat ? summariseTuod(seat) : null;
}

export function summariseScoreTrainingStep(
  ctx: RoutinePlayContext,
): RoutineStepSummary | null {
  const seat = finishedSeat(ctx) as ScoreTrainingSeatResult | undefined;
  return seat ? summariseScoreTraining(seat) : null;
}

export function summariseOneTwentyOneStep(
  ctx: RoutinePlayContext,
): RoutineStepSummary | null {
  const seat = finishedSeat(ctx) as OneTwentyOneSeatResult | undefined;
  return seat ? summariseOneTwentyOne(seat) : null;
}

export function summariseAroundTheClockStep(
  ctx: RoutinePlayContext,
): RoutineStepSummary | null {
  const seat = finishedSeat(ctx) as AroundTheClockSeatResult | undefined;
  return seat ? summariseAroundTheClock(seat) : null;
}

/**
 * Builds the `StepAdapter` for one routine-eligible game ruleset. `open` is
 * the old `startFinishingStep`, generalised over any of the three: it seats
 * the server's start-step response into `$store.game`, starts the routine's
 * own session clock, and wraps `playFactory` in `gameStep` so the game's own
 * completion advances the routine.
 */
export function gameAdapter(input: {
  rulesetVersionKey: RulesetVersionKey;
  headerLabel: string;
  panel: StepPanel;
  playFactory: () => GameStepPlayContext;
  summarise: (ctx: RoutinePlayContext) => RoutineStepSummary | null;
}): StepAdapter {
  return {
    key: `GAME:${input.rulesetVersionKey}`,
    headerLabel: input.headerLabel,
    panel: input.panel,
    open(ctx, result) {
      ctx.$store.game.reset();
      ctx.$store.game.startSession({
        gameTypeKey: result.gameTypeKey,
        rulesetVersionKey: result.rulesetVersionKey,
        sessionId: result.sessionId,
        templateRef: null,
        configSnapshot: {
          ...toSnapshot(input.rulesetVersionKey, result.configuration),
          seats: [
            {
              participantRef: result.participant.ref,
              displayName: result.participant.displayName,
              sideKey: "A",
              participantTypeKey: "PLAYER",
            },
          ],
        },
        captureModeKey: result.captureModeKey,
        inputModeKey: result.inputModeKey,
      });
      ctx.startSessionClock();
      ctx.game = gameStep(
        input.playFactory,
        () => ctx.completeCurrentStep(),
        async () => {
          if (ctx.activityId) await abandonTraining(ctx.activityId);
        },
      );
    },
    facts() {
      return null;
    },
    completesOwnSession: true,
    summarise: input.summarise,
    close(ctx) {
      ctx.game = null;
    },
  };
}
