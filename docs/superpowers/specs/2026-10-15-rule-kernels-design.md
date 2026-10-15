# Rule Kernels — Design

Date: 2026-10-15
Status: approved in brainstorming, pending written-spec review
Branch: `docs/rule-kernels-spec`

## 1. Goal

Prepare the 40 unbuilt games and 15 unbuilt exercises in `docs/game-rules/`
for fast implementation by extracting the logic they share into a small set of
pure **rule kernels**, and move the shipped engines onto those kernels without
changing behaviour. This is the umbrella spec: it fixes the layering, the
kernel contract, the families, the migration method and the sequencing. Each
family then gets its own spec (§8).

### Why now

The Neon plan is out of monthly quota until it resets. Anything that merges
to `main` under `app/**` or `database/**` runs `deploy` (its `pending` job
queries production), and any PR under `database/seeds/**` or
`database/migrations/**` runs `db-rehearsal` (cuts a Neon branch). Docs-only
work under `docs/**` and `decisions/**` triggers neither. The freeze is
therefore spent on specs and plans, so implementation starts at the reset with
nothing left to design.

### Decided in brainstorming

| # | Decision |
| --- | --- |
| Q1 | Kernel-first: one umbrella spec, then one spec per family, then plans. Not game-by-game, not one mega-spec. |
| Q2 | Three layers: pure rule kernels → generic engine shells → per-game definitions (§3). |
| Q3 | Kernels are match-level, not per-seat (§4). |
| Q4 | Shipped engines migrate as behaviour-preserving refactors proven by a differential oracle (§6). |
| Q5 | Freeze = specs and plans only; no code until the reset (§7). |
| Q6 | One `exercise_types` row per exercise, not per kernel; seeds batched per family wave (§7). |

## 2. Current state

- **Shipped:** 11 game engines (`app/src/modules/game/*.engine.module.ts`),
  10 exercise engines (`app/src/modules/training/exercises/`).
- **Unbuilt:** 40 rulesets at `Current version: none`, 15 exercises likewise.
- **Shared modules already extracted:** `turn-log`, `seat-state`, `seat-rota`,
  `match-outcome`, `board-progression`, `marks-close`, `checkout-bust`,
  `checkout-darts`, `checkout-reachability`, `checkout-visits`, `seeded-rng`;
  `createPresetSetupController`, `createThreeDartValidator`,
  `quick-score.validator.ts`.
- **What is still duplicated:** every dart engine already has a pure per-seat
  reducer (e.g. `applyAroundTheClockDart(seat, dart, rules)`) and a fold
  (`foldXState`), wrapped in ~100–150 near-identical lines of class shell —
  `deriveState`, `record`, `undo`, `facts`, `create`. Game and exercise engines
  that do the same thing (Singles Training vs Target Scoring, TUOD vs Checkout
  Sequence) each carry their own reducer.
- **Routine steps** already wrap a game engine via `gameAdapter`
  (`lib/training/routines/adapters/step-adapter.registry.ts`), so a game that is
  also a routine step needs no exercise engine of its own.

## 3. Layering

```
L1  Rule kernels (pure)     kernel + policies; everything a ruleset decides
L2  Engine shells (generic) createDartGameEngine / createDartExerciseEngine
L3  Game definition (data)  rulesetVersionKey + Zod config → kernel rules + outcome
```

- **L1** holds ruleset content only. No log mechanics, no seat rota, no keys.
- **L2** composes `turn-log`, `seat-rota`, `seat-state` and `match-outcome`
  once. `GameEngine` and `DartExerciseEngine` stay separate contracts (D264);
  each gets its own shell factory over the same kernel.
- **L3** maps a validated config snapshot to kernel rules and picks the outcome
  category. A new kernel-backed game is a config schema, a rules mapper, seeds
  and UI — not a 300–800-line engine file.
- **Pattern 18 does not change.** Same `GameEngine` contract, same
  `EngineFacts`, same two registries, same `check-game-engines.sh`. Its Rule
  section gains one line when phase 1 lands: *an engine is a kernel bound to a
  shell; a hand-written engine is the opt-out.*
- **Opt-out:** the shell is optional, as `createPresetSetupController` is. A
  game whose rules do not fit a kernel keeps a hand-written engine.

## 4. Kernel contract

Per-seat reducers cannot express rules where one seat's dart changes another
seat (Killer takes lives; Cricket scores onto opponents), where seats share a
target (High-and-Low), or where seats have asymmetric roles (Scram). The
kernel is therefore **match-level**; a per-seat helper lives inside it.

```ts
interface RuleKernel<TRules, TMatch> {
  init(rules: TRules, seatCount: number): TMatch;
  applyDart(m: TMatch, seat: number, dart: DartObservation, rules: TRules): TMatch;
  closeVisit?(m: TMatch, seat: number, darts: readonly DartObservation[], rules: TRules): TMatch;
  seatDone(m: TMatch, seat: number): boolean;
  outcome(m: TMatch): { status: MatchStatus; winningSideKey: string | null };
}
```

- `applyDart` handles mid-visit effects (ATC easy mode, Nine Lives advancing
  on a hit, Cricket marks).
- `closeVisit` handles visit-judged rules (Doubles Lock hit count, Fives,
  High-and-Low beat/miss, ATC 1–3-dart difficulty). Optional.
- `seatDone` feeds `seat-rota`'s existing completion-predicate parameter, so
  an eliminated or finished seat is skipped with no new rota logic.
- `outcome` returns via one of the `match-outcome` categories (§5).
- All functions are pure and total over valid input; `TMatch` is derived on
  every read by folding facts, never stored (Pattern 18, Hard Invariants).
- The shell owns `undo` (pop the log, refold), `wouldComplete` (fold with the
  candidate dart, discard), keys, `completedAt`, `participantRef`, stage
  opening, and rehydration via `create(config, prior)`.

## 5. Policies and families

### Policies (shared across kernels)

| Policy | Options | Covers |
| --- | --- | --- |
| `targetSource` | ordered list, clockwise, seeded random (`seeded-rng`), adjacency map, zone class (any double / any treble), checkout range | Track, Checkout |
| `pressurePolicy` | `NONE` / `PENALTY(fn)` / `SETBACK(steps, locks)` / `RESET` — 1:1 with the `Pressure` tag in `docs/game-rules/TAGS.md` | Track, Checkout, Visit points |
| `livesLedger` | lives per seat, life-lost events, out ⇒ `seatDone` | Nine Lives, Killer, High-and-Low, Overs, Knockout, Prisoner, Steeplechase |
| `outcome` | `elimination`, `race`, `scoreCompare` (existing) + **`lastStanding`** for N seats (new) | all |

### Families

| Kernel | Settings | Shipped (migrate) | Unbuilt (new) |
| --- | --- | --- | --- |
| **Track** | `targetSource`, hit test (ring filter), advance rule (per hit / per visit hit count), dart budget (fixed count / until hit), points fn, `pressurePolicy` | Around the Clock, Shanghai, Bob's 27, Singles Training, Doubles Training, Target Scoring, Switching Target Scoring | Nine Lives, Prisoner, Golf, Dolf, Baseball, Steeplechase, Neighbours, Hare and Hounds, Halve-It, Hit Count, JDC Challenge, Switchblade, A1 Routine, Mikko's Megatrain, Doubles Lock, Doubles Snakes & Ladders, Bullseye 500 |
| **Checkout** | `targetSource` (fixed / ladder / random / pyramid), attempt budget, `checkout-bust`, pass/fail move via `pressurePolicy` | 121, Ten Up One Down, Checkout Sequence (Catch-40), Random Checkout | 420, Hubbe, Finishing Pyramid, Halving Doubles, Frustration, 170 Practice |
| **Visit points** | points fn over visit darts, goal (exact / at least / none), bust rule, void rule, compare mode (shared target / threshold) | Score Training, Score Threshold | Ace, Bull 500, Castle, Fives, Gold Hunt, Gotcha, Indy 500, Nine-Dart Century, Bowling, Football, English Cricket, Brag, High-and-Low, Overs, Knockout |
| **Marks** | category set (numbers / zone classes / bull), marks table, close order (any / ordered), double-dip, closed-number scoring (none / self / opponents), seat roles | Cricket, Tactics | Mickey Mouse, Mulligan, Scram, Shoot-out, Warfare |
| **Elimination** | `livesLedger` + `lastStanding`; built as a policy, specced with the games that need more than lives | — | Killer, Follow the Leader (+ the lives-bearing games above, which use the policy from their own kernel) |

The family lists are the starting assignment; each family spec confirms or
moves each game.

**Hand-written (opt-out):** 501 (sets/legs, match format); Warm-Up (timed,
dartless — an `ExerciseEngine`, not a dart engine); and the simulations —
Battleship, Poker, Blackjack, Snooker, Tennis, Aces, Bowls, Lawn Darts,
Shove Ha'penny, Noughts and Crosses, Bingo. Bull-Up, Bullseye Checkout, Double
Pattern and Switching are re-checked by the family spec that would absorb them.

**Fit rule for family specs:** every game gets a row in a kernel-config table.
A game that needs a new kernel setting adds it in that spec. A game that needs
more than two new settings moves to hand-written.

## 6. Migrating shipped engines

**Refactor, never a rules change.** Each migration keeps the engine's
`rulesetVersionKey`, fact shape and `state()` shape identical. Exported folds
(`foldTuodState`, `foldOneTwentyOneState`, …) keep their signatures — play
controllers, result modals and `statistics.service.ts` call them — and become
thin adapters over the kernel. A shipped game's `V2+` rules-file rows are a
later ruleset version and never ride a refactor PR.

**Proof — differential oracle, per engine:**

1. The old engine class moves under the test tree as `legacy`.
2. A property-based test drives `legacy` and the kernel-backed engine with
   the same seeded random dart sequences, undos interleaved, at 1 and 2 seats
   (and N where the engine supports it), asserting deep-equal `state()` and
   `facts()` after every step, and equal state after `create(config, prior)`
   rehydration.
3. The engine's existing tests pass unchanged.
4. Once green, the same PR records fixed golden fact logs per engine and
   deletes `legacy`. The guarantee is re-pointed at the goldens, never dropped
   (Hard Invariants: a removed test subject's tests point at the same
   guarantee).

**Shell first, kernels per family.** The umbrella plan builds L2 over the
engines' *existing* folds — a shell spec takes `fold`, `refusal`, `intent`,
`isVisitOpen` and `wouldComplete` — plus the oracle harness, and proves both
on Doubles Training, Bob's 27 (games) and Target Scoring (exercise). The
shell's first version covers single-`EXERCISE_BLOCK`, dart-only engines;
multi-stage engines (121, TUOD, 501) and visit-input (`QUICK_SCORE`) engines
extend it in the Checkout and Visit-points plans. Each family plan then
introduces its `RuleKernel` and a `kernel → shell spec` adapter, so kernels
plug into a shell that is already proven.

**Order — one engine per PR, simplest first.** Each kernel lands with its
first migrated engine, so it never exists without a caller (fallow dead-code
gate).

| Kernel | Migration order |
| --- | --- |
| Track | Doubles Training → Bob's 27 → Singles Training → Around the Clock → Shanghai → Target Scoring → Switching Target Scoring |
| Checkout | Ten Up One Down → 121 → Checkout Sequence → Random Checkout |
| Visit points | Score Training → Score Threshold |
| Marks | Tactics → Cricket |

Bob's 27 is the reference exemplar in `07-Frontend/09-Adding-A-Game.md`; that
doc changes in the PR that migrates it.

**Gates per PR:** `check-game-engines.sh`, `check-game-wiring.sh`, fallow
duplication and dead code, `npm test`, `astro check`. Fallow's duplication count
must not rise.

## 7. Sequencing and seeding

| Phase | Work | Touches | Neon | Merge |
| --- | --- | --- | --- | --- |
| 0 (freeze) | This spec; five family specs; rules-file open questions closed via `authoring-game-rules`; decision entries; one plan per spec | `docs/`, `decisions/` | none | freely |
| 1 (reset) | Kernels + migration of shipped engines (§6) | `app/` | `deploy` on merge | after reset |
| 2 (reset) | New games and exercises, one family wave at a time | `app/`, `database/seeds/` | `db-rehearsal` + `deploy` | after reset |

**No code during the freeze.** Code written now cannot merge, the stack cap
allows one branch on another, and long-lived divergence from `main` is a
defect; oracle tests would need rebasing anyway. Plans are written to execute
straight after the reset.

**Exercise types:** one `exercise_types` row per exercise (`LOCK_LADDER`,
`HALVE_IT`, …), not one per kernel. The type is what the player did — what
stats and filters key on; the kernel is a code detail held in the L3
definition.

**Seed batching:** one seed file per family wave, carrying every game type,
ruleset version, template and capability row in that wave (~5 seed runs, not
~55). `check-game-wiring.sh` already forces the full touch list into one
commit; a family spec splits its wave when the UI work is too large for one
PR.

## 8. Deliverables (phase 0)

1. This spec.
2. Family specs, in order: Track → Checkout → Visit points → Marks →
   Elimination, each under `docs/superpowers/specs/` and containing:
   the kernel's `TRules` and `TMatch` shapes; a kernel-config row per game
   (shipped and new); each new game's Capture answers (capture/input mode,
   stage type, `turns`/`darts` mapping — Hard Invariants); the rules-file
   gaps found; and the wave split.
3. An implementation plan per spec via `superpowers:writing-plans`. This
   spec's plan: `docs/superpowers/plans/2026-10-15-engine-shell.md` (shell +
   oracle + three pilot migrations, §6).
4. Canonical docs (Pattern 18, `09-Adding-A-Game.md`, `app/src/modules/game/CLAUDE.md`)
   change only with phase 1 code — specs are non-canonical input.

## 9. Out of scope

- Any rules change to a shipped game.
- Simulation games (hand-written; specced later, one by one).
- Trivia tools and routines (no engine of this kind).
- UI shells — `SeatedPlayScreen` and the setup factory already cover them;
  each family spec only lists per-game UI deltas.
- Schema changes: none expected. A family spec that finds one escalates to a
  numbered migration per `05-Database/03-Migrations.md`.

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| Kernel too generic — config becomes a second programming language | Fit rule (§5): >2 new settings ⇒ hand-written |
| Refactor silently changes a shipped game's facts | Differential oracle + goldens (§6) |
| `state()` shape drift breaks play controllers or stats | Exported fold signatures frozen; `astro check` + existing tests |
| Large post-reset backlog collides on shared registries | One engine per PR in phase 1; one family wave per PR series in phase 2 |
