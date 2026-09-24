# Agent Rules — `app/src/modules/training/`

Scope: training routines and exercise engines. Load the "New non-game client tool (Trivia)" pack or `docs/architecture/09-Training/00-Overview.md` from `docs/architecture/00-Context-Map.md` before changing anything here. Global app rules and the validation procedure live in `app/CLAUDE.md`. (2026-09-18)

## Exercise engines

`modules/training/exercises/interfaces.ts`'s `ExerciseEngine<TState>` is a **parallel** contract to `GameEngine`, never built on top of it (D264). Non-game exercises — warm-ups and beyond — have no seats, no `rulesetVersionKey` from the game ruleset union, and take no dart input.

- **An exercise engine owns no clock.** State carries no elapsed-time field; the caller drives transitions with `advance()`.
- Its ruleset key (`ExerciseRulesetVersionKey`, `lib/training/exercises/rulesets/types.ts`) and its server-side validator (`services/exercise-rulesets/registry.ts`) stay out of `services/rulesets/registry.ts`, `RulesetVersionKey` and `RULESET_CAPABILITIES` — `scripts/check-game-wiring.sh` requires every key there to declare a capture/input mode pair, which an exercise has neither of.
- `modules/training/routines/training.module.ts`'s `TrainingEngine` orchestrates ordered steps across whichever `ExerciseEngine` each one resolves to, and likewise holds no clock. A routine's total duration is validated separately by `modules/training/routines/routine-duration.module.ts` (`09-Training/01-Routines.md` §7), since a `CHECK` constraint cannot sum sibling rows. (D264, 2026-09-10)

Exercise engine files here are still `*.engine.module.ts` — `bull-up`, `bullseye-checkout`, `double-pattern`, `score-threshold`, `switching`, `switching-target-scoring`, `target-scoring` and `warm-up` under `exercises/`. The `GameEngine` contract does **not** apply to them.
