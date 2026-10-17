# Agent Rules — `app/src/modules/training/`

Scope: training routines and exercise engines. Load the "New non-game client tool (Trivia)" pack or `docs/architecture/09-Training/00-Overview.md` from `docs/architecture/00-Context-Map.md` before changing anything here. Global app rules and the validation procedure live in `app/CLAUDE.md`. (2026-09-18)

## Exercise engines

`modules/training/exercises/interfaces.ts`'s `ExerciseEngine<TState>` is a **parallel** contract to `GameEngine`, never built on top of it (D264). Non-game exercises — warm-ups and beyond — have no seats, no `rulesetVersionKey` from the game ruleset union, and take no dart input.

- **An exercise engine owns no clock.** State carries no elapsed-time field; the caller drives transitions with `advance()`.
- Its ruleset key (`ExerciseRulesetVersionKey`, `lib/training/exercises/rulesets/types.ts`) and its server-side validator (`services/exercise-rulesets/registry.ts`) stay out of `services/rulesets/registry.ts`, `RulesetVersionKey` and `RULESET_CAPABILITIES` — `scripts/check-game-wiring.sh` requires every key there to declare a capture/input mode pair, which an exercise has neither of.
- `modules/training/routines/training.module.ts`'s `TrainingEngine` orchestrates ordered steps across whichever `ExerciseEngine` each one resolves to, and likewise holds no clock. A routine's total duration is validated separately by `modules/training/routines/routine-duration.module.ts` (`09-Training/01-Routines.md` §7), since a `CHECK` constraint cannot sum sibling rows. (D264, 2026-09-10)
- A clockless timed dart exercise is a `DartExerciseSpec` bound to `exercises/dart-exercise-shell.module.ts`; Target Scoring is the reference shape. (2026-10-16, D462) A Track-family exercise folds its log through the kernel's `foldTrackDarts` with a `TrackRules` record, as Target Scoring and Switching Target Scoring do. There is no `trackExerciseSpec` adapter: the two specs differ only in key, `parse` and `fold`, and share `targetScoringIntent` (Track spec §3). (2026-10-17, D468)
- Every `*.engine.module.ts` has a row in `scripts/engine-kernels.txt` (its rule-kernel family and status); `scripts/check-engine-kernels.sh` fails a new engine without one. See `docs/architecture/04-Architecture-patterns.md` Pattern 18 §Rule-kernel families. (2026-10-17, D467)

Exercise engine files here are still `*.engine.module.ts` — `bull-up`, `bullseye-checkout`, `checkout-sequence`, `double-pattern`, `random-checkout`, `score-threshold`, `switching`, `switching-target-scoring`, `target-scoring` and `warm-up` under `exercises/`. The `GameEngine` contract does **not** apply to them.
