# Marks Kernel — Design

Date: 2026-10-28
Status: implemented 2026-10-29 (D506); plan `docs/superpowers/plans/2026-10-28-marks-kernel.md`. Status note: §4 ran as one sequence — kernel + Tactics, then Cricket, then one legacy deletion — and Cricket's registry row flipped with Tactics' because its fold imported the kernel first.
Parent: `2026-10-15-rule-kernels-design.md` (umbrella, §5 Marks row, §6, §8 item 2)
Siblings: Track, Checkout, Visit points, Elimination specs (method reused)
Branch: `feat/marks-kernel`

## 1. Goal

Define the Marks rule kernel ("darts add marks to objectives; spare marks
score while the opponent is open; close out to win") and move Cricket and
Tactics onto it and onto the game shell with no change in behaviour. The
aim is tidying: one fewer engine base class, every kernel family on the
same shell.

### Decided

| # | Decision |
| --- | --- |
| M1 | Scope: kernel + the two shipped engines (Tactics, Cricket). The five unbuilt Marks games (umbrella §5) get their own wave spec later. |
| M2 | Bind on the game shell (`dartGameEngineClass`), not on `MarksEngine`; `MarksEngine` (`marks-engine.module.ts`) is deleted (owner's choice, 2026-10-28). |
| M3 | D488's compile-time key guard (`marksEngineFactory`'s `NoInfer`, `TKey`-generic classes) is replaced by the shell's runtime served-key check (`dartGameEngineFactory` throws for a key the spec does not serve). New decision, `Supersedes: D488`. |
| M4 | The kernel carries only what these two engines use. Close order, double-dip, cut-throat scoring and seat roles land with the first new game that needs them. |
| M5 | Quirks are preserved and filed as `discovered-work`, never fixed here. |
| M6 | One PR, Tactics then Cricket (umbrella §6 order) — my call: both sit on one base class, and it can only be deleted once both have moved. |

## 2. Current state

Both registry rows read `MARKS | PENDING`.

| Module | Lines | Role |
| --- | --- | --- |
| `marks-close.module.ts` | 168 | primitives: ring→marks tables, `initialMarksSeat`, `tallyMarksDart`, `applyMarksDart`, `recordMarksDart`, `effectiveMarks`, `marksPerRound` |
| `marks-duel.module.ts` | 118 | `foldMarksDuel` (log-order walk, cross-seat points, win on closed-out with points ≥ opponent's), `foldMarksSeats` (solo vs 1v1 dispatch) |
| `marks-engine.module.ts` | 106 | `MarksEngine` base class + `marksEngineFactory` |
| `tactics.engine.module.ts` | 190 | objectives (20–15, bull, Doubles, Triples), `tacticsMarksOf`, fold, class, V1/V2 factories |
| `cricket.engine.module.ts` | 149 | objectives (20–15, bull), `cricketMarksOf`, fold, class, V1/V2 factories |

Seat cap 2 (D487). `MarksEngine` behaviour the shell must match:

| `MarksEngine` | On the shell |
| --- | --- |
| refuses a dart once `status === "COMPLETE"`: "game has ended" | `refusal(state)`, same message |
| no intent on darts | `intent: () => NO_INTENT` |
| reuses the last turn while `completedAt === null && darts < 3`; stamps `completedAt` on the 3rd dart or the game-ending dart | `isVisitOpen(turn, state) = turn.completedAt === null && turn.darts.length < 3 && state.status !== "COMPLETE"` (same shape as Killer) |
| `undo` = `undoLastDart` | shell default |
| `wouldComplete` = record on a fork, false on throw | `wouldComplete(state, observation, config)` answered from the folded state through a kernel helper (below), false when the game has ended |
| `isComplete` = `status !== "IN_PROGRESS"` | shell default |
| `totalScore` = darts' board-score sum (`appendObservedDart`) | shell default |
| one class serves V1 and V2 | `rulesetVersionKeys: [V2]` on one spec; two `dartGameEngineFactory` calls |

Outside callers keep working: `cricket-play.data.ts`, `tactics-play.data.ts`
(`instanceof CricketEngine` / `TacticsEngine`, `resumeMarksEngine`),
`lib/game/types.ts`. Exported folds, `*MarksOf`, objective lists,
`isTacticsTarget`, initial states and factory names keep their names and
signatures. `CricketEngine` / `TacticsEngine` stay exported classes but lose
their `TKey` parameter (M3).

## 3. Kernel contract

File: `app/src/modules/game/marks-kernel.module.ts`. It absorbs
`marks-duel.module.ts` (deleted; its tests move with it). `marks-close.module.ts`
stays as the primitive layer (the dartbot mirror and `tactics-play.data.ts`
cite it). Types stay in `types.ts`. Sketch; the plan settles names:

```ts
// MarksDuelSpec renamed in place as the kernel's rules
type MarksRules<TSeat> = {
  initialSeat(seat: SeatFact): TSeat;
  hitOf(seat: TSeat, opponent: TSeat | null, observation): MarksHit; // null opponent = solo
  valueOf(objectiveIndex: number): number | null;
};

foldMarks(facts, seats, rules): MarksGameState<TSeat>   // today's foldMarksSeats
marksWouldComplete(state, observation, rules): boolean  // one trial dart on the active seat
```

- `foldMarks` is `foldMarksSeats` unchanged in behaviour. The separate
  `applyDart` argument goes: solo applies `applyMarksDart(seat,
  rules.hitOf(seat, null, obs))`, which is what both engines pass today.
- `marksWouldComplete`: solo, the active seat's trial dart completes it
  and every other seat is complete; 1v1, the duel dart leaves the
  thrower closed out with points ≥ opponent's. The oracle checks it against a
  trial `record` on a copy.
- `recordMarksDart` and its `isEnded` parameter go once no caller remains
  (fallow dead-code gate).

## 4. Moves (one PR)

1. **Kernel + Tactics.** Legacy copy + oracle; then `marks-kernel.module.ts`
   lands, Tactics becomes `tacticsSpec` on `dartGameEngineClass`, registry
   row → `KERNEL_BOUND`; goldens, delete legacy.
2. **Cricket.** Same three steps; registry row → `KERNEL_BOUND`;
   `marks-engine.module.ts`, `marksEngineFactory`, `recordMarksDart` deleted.
   `marks-engine.module.test.ts` guarantees are re-pointed: the
   wrong-key guard becomes a test that `dartGameEngineFactory(spec, Engine,
   "TACTICS_V1")` from Cricket's spec throws; the other cases move to the
   engine tests. The two `@ts-expect-error` D488 tests are deleted with the
   guard they pinned (M3).

Oracle (`support/engine-oracle.ts`): seeded darts across all rings and
misses, undos interleaved, rehydration every N steps, at 1 and 2 seats,
V1 and V2 keys; compares state, facts (minus `clientKey`/`completedAt`
values), `wouldComplete`, `isComplete`, and refusal messages.

## 5. Docs and context

| Item | Change |
| --- | --- |
| `scripts/engine-kernels.txt` | both rows → `KERNEL_BOUND` |
| `decisions/game-engine.md` | one entry: kernel contract, M2, M3; `Supersedes: D488` |
| Pattern 18 §Rule-kernel families `MARKS` row | → bound; version bump |
| `app/src/modules/game/CLAUDE.md` | Marks line |
| File Inventory | drop `marks-engine`/`marks-duel`, add `marks-kernel` |
| `context-maintenance` skill | yes |

## 6. Non-goals

- New Marks games, more than two seats, cut-throat, DartBot marks aiming.
- Any change to `MarksPlayScreen.astro`, `marks-play.data.ts` beyond types.
- Fixing quirks (M5).

## 7. Risks

| Risk | Guard |
| --- | --- |
| Game-ending dart mid-visit not stamped, or next dart lands in the wrong turn | oracle facts comparison; `isVisitOpen` reads the after-state |
| `wouldComplete` from state drifts from the trial record | oracle compares it on every step |
| Dropping `TKey` breaks a caller's type | `npm run check` 0 hints |

## 8. Left to the builder

- Exact kernel names; whether `MarksDuelSpec` is renamed or aliased.
- Whether `wouldComplete` goes through state or a trial fold, as long as the oracle passes.
