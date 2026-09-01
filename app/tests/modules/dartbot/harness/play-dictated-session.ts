import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";
import type { BoardTarget, DartObservation } from "@modules/types";
import type { GameEngine } from "@modules/interfaces";

/**
 * The most darts this harness will throw before giving up on a session ever
 * completing. Measured completion counts for all five dictated rulesets at
 * level 1 (the slowest tier) are 15-78 darts (see this plan's Self-Review);
 * 500 leaves roughly 6x headroom over the largest of those so a genuine
 * infinite-loop regression in the strategy or the engine still fails fast
 * rather than hanging the suite.
 */
const MAX_DARTS = 500;

export type DictatedSessionResult<TState> = {
  dartsThrown: number;
  state: TState;
};

/**
 * Drives `engine` to completion by repeatedly reading its next `BoardTarget`
 * via `targetForState`, converting it to a `ThrowIntent` through
 * `chooseTarget`, throwing it through phase 1's deterministic `throwDart`,
 * and recording the resulting `DartObservation` — the same join point a real
 * page uses (`08-DartBot.md` §Position in the System). Nothing here is
 * persisted; `engine.record()` is the real ruleset's own contract, so a
 * `record()` that rejects the emitted observation throws out of this
 * function rather than being swallowed.
 * @throws if the session has not completed after `maxDarts` darts.
 */
export function playDictatedSessionToCompletion<TState>(
  engine: GameEngine<DartObservation, TState>,
  targetForState: (state: TState) => BoardTarget,
  level: number,
  seed: number,
  maxDarts: number = MAX_DARTS,
): DictatedSessionResult<TState> {
  const profile = skillProfileForLevel(level);
  let dartIndex = 0;

  while (!engine.isComplete()) {
    if (dartIndex >= maxDarts) {
      throw new Error(
        `Session did not complete within ${maxDarts} darts (level ${level}, seed ${seed})`,
      );
    }
    const target = targetForState(engine.state());
    const intent = chooseTarget({ target });
    const rng = createDartRng(seed, dartIndex);
    const thrown = throwDart(intent, profile, rng);
    const observation: DartObservation = {
      hitTargetNumber: thrown.hit.targetNumber,
      hitZoneKey: thrown.hit.zoneKey,
      locationX: thrown.landing.x,
      locationY: thrown.landing.y,
    };
    engine.record(observation);
    dartIndex++;
  }

  return { dartsThrown: dartIndex, state: engine.state() };
}
