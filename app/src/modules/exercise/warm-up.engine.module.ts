import { WarmUpEngineInputSchema } from "@lib/exercise/rulesets/types";
import type { WarmUpEngineInput } from "@lib/types";
import { newClientKey } from "@modules/game/client-key.module";
import type { EngineFacts, StageFact } from "@modules/types";
import { registerExerciseEngineFactory } from "./engine.registry";
import type { ExerciseEngine, ExerciseEngineFactory } from "./interfaces";
import type { WarmUpState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "WARM_UP_V1" as const;

function newSectionStage(sequence: number): StageFact {
  return {
    clientKey: newClientKey(),
    stageTypeKey: "EXERCISE_SECTION",
    parentClientKey: null,
    sequence,
  };
}

function cloneStages(stages: readonly StageFact[]): StageFact[] {
  return stages.map((stage) => ({ ...stage }));
}

/**
 * Warm-Up: ordered timed sections, no dart input, no score
 * (09-training-routines.md §16). One `EXERCISE_SECTION` stage is appended per
 * section entered, flat under the exercise session — the session already
 * represents the exercise, so no grouping stage is created.
 *
 * The engine owns no clock. A caller drives section transitions with
 * `advance()`; elapsed time belongs to the controller, which keeps this engine
 * deterministic with respect to its configuration alone (§9).
 *
 * Each phase's own duration is resolved from `config.stepDurationSeconds`
 * (the routine step's total duration) split proportionally to
 * `phase.weight` — not a fixed per-phase value — so the same template
 * config serves routines of different lengths (design spec 2026-09-11
 * §5.1). Rounding is per-phase (`Math.round`), so the sum of all
 * `phaseDurationSeconds` across a routine's steps can differ from
 * `stepDurationSeconds` by at most a handful of seconds — acceptable for a
 * UI-facing duration display, not a value anything sums back up.
 */
class WarmUpEngine implements ExerciseEngine<WarmUpState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: WarmUpEngineInput;
  private stages: StageFact[];
  private complete = false;

  constructor(config: WarmUpEngineInput, prior?: EngineFacts) {
    this.config = WarmUpEngineInputSchema.parse(config);
    this.stages =
      prior && prior.stages.length > 0
        ? cloneStages(prior.stages)
        : [newSectionStage(1)];
  }

  private deriveState(): WarmUpState {
    const phaseIndex = this.stages.length - 1;
    const phase = this.config.phases[phaseIndex];
    const totalWeight = this.config.phases.reduce(
      (sum, p) => sum + p.weight,
      0,
    );
    const phaseDurationSeconds = Math.round(
      (this.config.stepDurationSeconds * phase.weight) / totalWeight,
    );
    return {
      phaseIndex,
      phaseName: phase.name,
      targets: [...phase.targets],
      phaseDurationSeconds,
      phaseCount: this.config.phases.length,
      status: this.complete ? "COMPLETE" : "IN_PROGRESS",
    };
  }

  advance(): WarmUpState {
    if (this.complete) return this.deriveState();
    if (this.stages.length < this.config.phases.length) {
      this.stages.push(newSectionStage(this.stages.length + 1));
    } else {
      this.complete = true;
    }
    return this.deriveState();
  }

  undo(): boolean {
    if (this.complete) {
      this.complete = false;
      return true;
    }
    if (this.stages.length <= 1) return false;
    this.stages.pop();
    return true;
  }

  isComplete(): boolean {
    return this.complete;
  }

  state(): WarmUpState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: cloneStages(this.stages), turns: [] };
  }
}

export const warmUpEngineFactory: ExerciseEngineFactory<
  WarmUpEngineInput,
  WarmUpState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: WarmUpEngineInput, prior?: EngineFacts) {
    return new WarmUpEngine(config, prior);
  },
};

registerExerciseEngineFactory(warmUpEngineFactory);
