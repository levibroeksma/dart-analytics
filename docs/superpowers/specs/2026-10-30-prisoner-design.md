# Prisoner — Design

Date: 2026-10-30
Status: design, awaiting approval
Parent: `2026-10-27-elimination-kernel-design.md` (Prisoner gets its own spec)
Rules input: `docs/game-rules/rulesets/prisoner.md` (V1 rows only)

## 1. Goal

Build **Prisoner V1** on the Elimination kernel, through to playable:
engine, validator, seeds, setup, play, results, card. Third kernel game after
Killer and Follow the Leader. Two seats, visual board only.

### Decisions

| # | Decision | By |
| --- | --- | --- |
| P1 | A valid hit is the **outer single** only. A double or treble is a plain miss: no advance, no capture, dart kept, no penalty. | user |
| P2 | Prison is the **target number's inner single**, or either bull. An inner single on any other number is a plain miss. | user |
| P3 | A valid hit on the thrower's own target that also holds a prisoner **advances and captures**. | user |
| P4 | A seat whose darts are all sitting out **skips the visit** and stays in. | user |
| P5 | V1 seats **exactly 2**; the engine and tests cover any count. | user |
| P6 | **Visual board only** (`ANALYTICS + VISUAL_BOARD`). The game is hidden from a player whose app mode is Recreational. | user (board only); consequence Claude's note |
| P7 | No round limit: V1 ends only on a win. | user |
| P8 | `lives` is **darts held**. Prison is `livesDelta −1`, capture `+1`, out at 0. The kernel needs no new life model. | Claude's call |
| P9 | Only a **bounce-out or off-board dart** (`MISS`) sits out the next visit. Plain misses (P1, P2) do not. | Claude's call, from the rules file |
| P10 | No new table or column; no migration. | Claude's call |
| P11 | No DartBot seat, no career stats page (as Killer E8, E9). `STATS_TAGS` gets `["board"]`. | Claude's call |

## 2. Current state

- Kernel `foldElimination` folds per dart through `onDart(thrower, seats,
  dart)`. `onVisitClose(visit, seats, shared)` and `activeOverride(seats,
  shared)` exist (Follow the Leader). `shared` changes only at a visit's close.
- Win is `eliminationWinner`: the last seat not out.
- Shell `isVisitOpen(turn, state, config)` sees folded state, open turn
  included. Three-dart validator caps a turn at 3 darts.
- `SEAT_CAPS` defaults to 1; floors in `SEAT_FLOORS`. `RULESET_CAPABILITIES`
  lists mode pairs per ruleset; each lists `DETAILED_DARTS` or `QUICK_SCORE`
  beside `VISUAL_BOARD`, so none is board-only yet.
- Dart zones `INNER_SINGLE` and `OUTER_SINGLE` exist; keypad capture writes
  the unbanded `SINGLE`.

## 3. Rules the engine must express

From the rules file, V1 rows. A **seat** has a **target** (1–20) and **darts
held** (starts 3).

1. Visit: the seat throws **budget** darts, fixed when the visit starts:
   darts held, less those sitting out. Play passes to the next seat still in.
2. Per dart, in order, against the thrower's current target:
   - Outer single of any number holding a prisoner: **capture** one prisoner
     (held +1, number's count −1). If that number is the target: **also
     advance** (P3).
   - Outer single of the target, no prisoner: advance. Target 20 completed
     wins at once, even partway through the visit.
   - Inner single of the target: **prison**: held −1, number's count +1.
   - Outer or inner bull: held −1, the dart is gone for good (counted, not
     lodged).
   - `MISS` (off the board or bounced out): kept, sits out the next visit.
   - Anything else (double, treble, off-target inner single, non-target outer
     single with no prisoner): plain miss.
   A dart captured or lost mid-visit does not change that visit's budget.
3. Advance moves the target on; remaining darts of the visit go at the new
   target.
4. Out at 0 held; skipped by the rota. Last seat in wins at once.
5. A seat whose budget is 0 is skipped; its sitting darts return for its next
   visit (P4).
6. Result: winner, how (completed 20 or last seat in), each seat's final
   target and darts held, out order, prisoners captured and imprisoned per
   seat.

### 3a. Calls from the design (Claude's calls)

- **A seat's held count changes only on its own visits.** A capture adds to the
  capturer; the loser never regains the dart. So a seat's budget stays stable
  between its visits, and the skip rule is a loop over seats (§4).
- **Budget at close.** When seat S's visit closes: `sitting := missed this
  visit`, `budget := held − sitting` (held already includes this visit's
  captures); `missed := 0`.
- **Skip loop.** After S closes, walk the seats after S in order (S last). A
  seat out is passed. A seat with budget 0 is skipped: its `sitting` clears,
  `budget := held`. The first seat with budget > 0 becomes the active seat.
  Two seats both fully sitting out resolve by the same walk.
- **A visit can exceed 3 darts.** Held can reach 6 with two seats. The turn
  dart cap rises to 6 for this ruleset (§6).
- **Bull prisoners are not tracked on the board**, only counted per seat for
  the result.
- **Closure is stored, never inferred**, as Follow the Leader: `completedAt`
  stamped on the budget-th dart, a winning dart, or the seat going out.
- **Replay dart labels:** `Advance`, `Capture`, `Advance and capture`,
  `Prison`, `Miss`. A plain miss and a bounce-out are both `Miss`; capture
  cannot tell them apart (both write `MISS` or a double/treble dart).

## 4. Kernel extension (additive)

Killer and Follow the Leader must not change (differential proof, as before).
Two optional additions to `EliminationRules`:

- **Per-dart shared state.** A prison and a capture in one visit depend on
  each other's order, so the number counts must update per dart. A ruleset
  may provide `reduceDart(thrower, seats, shared, dart)` returning
  `{ changes, shared }`, used instead of `onDart`.
- **Ruleset winner.** `decidedWinner?(seats, shared): string | null`
  (a side key), consulted before the last-seat-standing rule. Status goes
  `COMPLETE` when it returns a key.

Builder's choice, recorded in the plan: whether these are two hooks or one
`reduceDart` result field.

Prisoner uses: seat `ext` `{ target, missed, sitting, budget, captured,
imprisoned }`; `shared` `{ lodged: Record<number, number>, next }`;
`startingLives` 3; `onVisitClose` for the budget and skip loop;
`activeOverride` returns `shared.next`.

## 5. Prisoner binding

`app/src/modules/game/prisoner.engine.module.ts` — `DartGameSpec`, key
`PRISONER_V1`, game key `PRISONER`, `stageOwnership: "SHARED"`, policy in
`prisoner-policy.ts`. Config: `{ darts: 3 }` locked.

State projection adds: per seat target, held, sitting, budget, captured,
imprisoned; `lodged` per number; the open visit's darts left. Derived from
`turns`/`darts`.

`isVisitOpen`: open while the turn has fewer darts than the thrower's budget,
the game is not decided, and the seat is not out. Refusal after `COMPLETE`
and for a keypad `SINGLE` dart.

## 6. Capture (Hard Invariants)

- **Capture / input mode:** `ANALYTICS + VISUAL_BOARD` only. A keypad cannot
  tell the inner from the outer single.
- **Stage type:** one `EXERCISE_BLOCK`, `SHARED` ownership.
- **`turns`/`darts`:** one `turns` row per visit (the thrower's
  `participantRef`); one `darts` row per dart, intended null, hit = number +
  zone (`INNER_SINGLE`, `OUTER_SINGLE`, `DOUBLE`, `TREBLE`, `OUTER_BULL`,
  `INNER_BULL`, `MISS`), `score` = board score. A skipped visit writes
  nothing: it is derived.
- **Validator:** composes the three-dart validator with a 6-dart cap and a
  refusal of the unbanded `SINGLE` zone. The plan checks no database
  constraint caps darts per turn; if one does, a migration is owed and
  P10 is revisited.
- **Derived, never stored:** target, held, sitting, budget, lodged,
  captured/imprisoned, out, winner.
- **Known limitation:** a bounce-out and an off-board dart are both `MISS`.

## 7. App wiring

Full touch list of `07-Frontend/09-Adding-A-Game.md`, one commit (wiring
gate), as Follow the Leader. Slug `prisoner`.

| Area | Prisoner |
| --- | --- |
| Seeds | game type, `PRISONER_V1`, template `darts: 3`, capability row `ANALYTICS + VISUAL_BOARD` only, tags (rules-file Tags table) |
| Seat cap | floor and cap 2 |
| Capabilities | `RULESET_CAPABILITIES` lists the `VISUAL_BOARD` pair only; the card is hidden in Recreational mode (P6) |
| Setup | preset, no options; Start disabled until a guest is seated; seat 1 throws first |
| Play | `SeatedPlayScreen` with the visual board: target banner, darts held and darts left per seat, sitting-out count, prisoners lodged per number |
| Results | winner, how, final target and darts held, out order, captured and imprisoned |
| Card | `games-visibility.ts`, CLASSICS group |

## 8. Proof

TDD per `app/CLAUDE.md`, no oracle.

- Kernel: the new hooks; a Killer and a Follow the Leader fold byte-identical
  before and after.
- Engine: one test per V1 row; the cases below.
- Golden trace of a full 2-seat game with a prison, a capture, a skipped
  visit and a win by 20.
- Validator, setup, play data, results tests.

Review focus:

1. Inner single of the target, then an outer single of it in one visit:
   prison (held −1), then advance and capture (held +1).
2. Hit on outer 20 at target 20 mid-visit ends the game; no further darts.
3. Last held dart prisoned: seat out at once; a capture earlier in the visit
   keeps it in.
4. Both seats fully sitting out: the walk skips and returns darts, no stall.
5. Bull dart: held −1, nothing lodged, nothing capturable.
6. Double, treble, off-target inner single, non-target outer single with no
   prisoner: no change, no sit-out.
7. One valid hit on a number with several prisoners takes one.
8. Capture on a non-target number: no advance.
9. Visit of 4 or more darts after captures; validator accepts it.
10. Undo across a capture, a skip and the winning dart; rehydration equals
    live state.
11. Keypad `SINGLE` dart refused.

Gates: `npm test`, `npm run check`, fallow, all `check-*.sh` (including
`check-engine-kernels.sh`, `check-game-wiring.sh`, `check-test-coverage.sh`),
`validate:app`.

## 9. Sequencing

| PR | Brings |
| --- | --- |
| 1 | kernel hooks, Prisoner engine-only (registry, validator, capabilities, `STATS_TAGS`, kernel-check row), seeds, rules-file updates, decision entries |
| 2 | seat cap, setup, play, results, card |

## 10. Out of scope

- 3–4 seats (P5), Doubles Only, round limit, bull throw for first thrower,
  teams (rules file).
- Statistics views over captures.
