# Follow the Leader — Design

Date: 2026-10-29
Status: PR 1 (engine) built; PR 2 (app wiring) pending. Rulings recorded in D507.
Status note (2026-10-30, final review of PR 1): the §1/§9 seeds (`0055`
reference rows, capability triples, catalog tags) shipped in PR 1, not PR 2.
§4's hook shipped as `onVisitClose(visit, seats, shared)`. §6's "`v_*` views
untouched" no longer holds: migration `0053` adds `kept` to `v_game_replay`
so a replay rebuilds a keep, and `0052` corrects `0051`'s column comment
(a kept turn is the leader's dartless keep). Recorded in D508.
Parent: `2026-10-27-elimination-kernel-design.md` (E1: Follow the Leader gets its own spec)
Rules input: `docs/game-rules/rulesets/follow-the-leader.md` (V1 rows only)

## 1. Goal

Build **Follow the Leader V1** on the Elimination kernel, through to
playable: engine, validator, seeds, setup, play, results, card. Killer
proved the kernel and the `SHARED`-stage shell path; this is its second game.

### Decisions

| # | Decision | By |
| --- | --- | --- |
| F1 | A leader's **keep** is offered by an auto-prompt at the leader's turn, only when a keep is legal ("Everyone failed. Keep or set?"). Keep skips the dart pad; Set opens it. | user |
| F2 | A keep is **stored as a fact**: a new `turns.kept` flag on a closed, dartless turn. | user (F1 storage = a stored marker) |
| F3 | Column shape: `turns.kept BOOLEAN NOT NULL DEFAULT false`, migration `0051`. The validator, not a CHECK, enforces kept ⇒ no darts, `total_score` 0. | Claude's call |
| F4 | V1 seats **exactly 2**, as Killer (E3): setup and the play screen seat two. Kernel and tests cover 3–4 seats. | Claude's call — **needs confirmation** |
| F5 | Stopping after a match is a stored fact too: the visit closes with fewer than 3 darts. No new column — a closed turn with fewer darts is the fact. | Claude's call |
| F6 | No DartBot seat, no career stats page (as E8, E9). `STATS_TAGS` gets `["board"]`. | Claude's call |
| F7 | Rules-file open questions stay as V1 reads them (single = one ring, spare dart in the target's own bed makes the matcher leader). | Claude's call |

## 2. Current state

- Kernel: `foldElimination(turns, seats, rules)` folds per **dart**; `onDart`
  sees the thrower, all seats and the dart. It has no hook for a visit
  closing and no state outside per-seat `ext`.
- Shell: `dartGameEngineClass`. `isVisitOpen` stamps `completedAt`. `visitInput`
  writes one closed **dartless** turn (a keypad total) and undoes whole
  turns.
- `three-dart.validator.ts` refuses a turn with no darts; a dartless turn
  elsewhere means a keypad entry.
- Last migration: `0050`. `SEAT_CAPS` unlisted key defaults to 1.

## 3. Rules the engine must express

From the rules file, V1 rows. **Target** = exact bed (number + ring; bulls
distinct; both singles one ring). **Leader** = seat whose dart set the target.

1. Opening: seat 0 throws until a dart lands on the board; that bed is the
   first target, seat 0 the leader. Off-board darts are stored (`MISS`).
2. Matcher visit (seat ≠ leader, not out): up to 3 darts.
   - No dart matched after 3 darts: life −1; target and leader unchanged.
   - A dart matched: no loss. The seat may stop (visit closes) or throw its
     remaining darts as **spare darts**; the last dart it threw is the
     setting dart: on the board ⇒ new target, matcher is leader.
   - Last dart off the board (3rd, or the stop point) ⇒ life −1, target and
     leader unchanged — whatever the earlier darts did.
   - A match on the 3rd dart leaves no spare; that dart is the last dart.
3. Leader visit: one on-board dart sets the new target (leader unchanged); an
   off-board dart is stored and thrown again.
   **Keep** (F1/F2): if every other seat in the game failed since the
   leader's setting dart or last keep, the leader may keep. Any other seat
   matching since then forbids it.
4. Out at 0 lives; skipped by the rota; leader never loses a life. Last seat
   standing wins at once.
5. Result: winner, out order, lives left per seat.

## 3a. Calls from the builder check (Claude's calls)

- **Stop before any match is refused** (`canStop` needs ≥1 match); the
  engine enforces it, not the validator: a validator sees only finished
  turns and cannot tell a stop from a visit left unfinished. No voluntary
  life loss.
- **Closure is stored, never inferred.** The fold treats a turn as closed
  only when `completedAt` is set. The shell stamps it on: the 3rd dart; a
  Stop; a leader or opening dart that lands on the board; an off-board
  dart of a leader or opening turn (see next). Rehydration and undo replay
  this one rule.
- **Opening and leader turns hold one dart.** An off-board dart is stored,
  closes its turn, and the same seat gets a new turn; the rota does not move.
  Every turn keeps the three-dart cap.
- **"Failed" means no dart of the visit matched.** A matcher that matched and
  then lost a life to an off-board last dart did not fail: it blocks a keep.
  Rules-file open question, V1 reading as stated.
- **Replay result labels** are five: `Keep`, `Fail` (a life lost), `Retry`
  (a setting dart off the board, no life lost), `Set`, `Match`.
- **A leader owed a re-throw cannot keep**: `keepAllowed` also requires no
  pending re-throw.
- **With two seats the others-failed set is one flag.** Kernel stays N-seat.
- **`kept`**: plan checks `06-API/00-Overview.md` and shared DTOs; a defaulted
  column is additive and safe to deploy ahead of use.

## 4. Kernel extension (additive)

Killer must not change. Two additions to `EliminationRules`, both optional:

- `onVisitClose?(seat, seats, visit): readonly SeatChange<TExt>[]` — called by
  the fold when a turn closes (`completedAt` set), with the visit's darts.
  Fail and last-dart-off-board resolve here, not per dart.
- Game state beyond seats (target, leader, others-failed set) rides a
  `shared: TShared` slot on `EliminationMatch`, folded alongside `seats`
  through `onDart`/`onVisitClose`. Killer's `TShared` is `undefined`.

A kept turn (F2) is a closed turn with `kept` and no darts: the fold calls
`onVisitClose` with an empty dart list and the `kept` flag.

Builder's choice, recorded in the plan: whether `shared` is a new generic
parameter or folded into a wrapper ext.

## 5. Follow the Leader binding

`app/src/modules/game/follow-the-leader.engine.module.ts` — `DartGameSpec`,
key `FOLLOW_THE_LEADER_V1`, `stageOwnership: "SHARED"`, policy in
`elimination-policies.ts` (or a sibling if that file outgrows fallow's limits).

Config: `{ lives: 3 }` locked, snake_case like Killer. No per-seat config.

State projection adds: `target {number, zone} | null`, `leaderRef`,
`phase` (`OPENING | MATCH | LEAD`), `matched` (open visit), `canStop`
(matcher, open visit, ≥1 match), `keepAllowed`, per-seat lives/out, `outOrder`.
Everything is derived from `turns`/`darts`.

Shell needs, verified in the plan (additive if missing):

- **Stop** — closing an open darted turn early. `visitInput` writes a *dartless*
  turn today, so Stop is new: a visit input that sets `completedAt` on the
  current turn.
- **Keep** — a `visitInput` writing a closed dartless turn with `kept = true`.
- `isVisitOpen` for the leader's visit: open until one dart is on the board.

Refusal: after `COMPLETE`; a keep when `keepAllowed` is false; a stop when
`canStop` is false.

## 6. Capture (Hard Invariants)

- **Capture / input mode:** `RECREATIONAL + DETAILED_DARTS`,
  `ANALYTICS + VISUAL_BOARD`. No QUICK_SCORE.
- **Stage type:** one `EXERCISE_BLOCK`, `SHARED` ownership.
- **`turns`/`darts`:** one `turns` row per visit (thrower's `participantRef`);
  one `darts` row per dart, intended null, hit = number + zone (`MISS` off
  board), `score` = board score. A keep: one closed turn, zero darts,
  `kept = true`, `total_score` 0.
- **Migration `0051`:** `ALTER TABLE turns ADD COLUMN kept BOOLEAN NOT NULL
  DEFAULT false`; spec `05-Database` updated; the upload batch and its
  validator carry `kept`; `v_*` views untouched (nothing derives from it
  yet).
- **Derived, never stored:** target, leader, lives, out, winner, `keepAllowed`.

## 7. App wiring

Full touch list of `07-Frontend/09-Adding-A-Game.md`, one commit (wiring
gate), as Killer. Slug `follow-the-leader`.

| Area | Follow the Leader |
| --- | --- |
| Seeds | game type, `FOLLOW_THE_LEADER_V1`, template `lives: 3`, capability rows, tag rows (rules-file Tags table) |
| Seat cap | floor and cap 2 (F4) |
| Validator | three-dart validator composed with: kept turns allowed only dartless, Stop closes ≤3-dart turns; seat count 2 |
| Setup | preset setup, no per-seat options; Start disabled until a guest is seated; first thrower = seat order (no bull throw, per rules) |
| Play | `SeatedPlayScreen`: target banner (exact bed), leader badge, lives, out. Pad: reuse the number + ring keypad. After a match the pad shows **Stop** beside the remaining darts. At a leader's turn with `keepAllowed`, the **Keep / Set** prompt (F1). |
| Results | Winner, out order, lives left per seat |
| Card | `games-visibility.ts`, CLASSICS group |

## 8. Proof

TDD per `app/CLAUDE.md`, no oracle.

- Kernel: `onVisitClose` fires once per closed turn; a Killer fold is
  byte-identical before and after; kept turn handling.
- Engine: one test per V1 row; cases below.
- Golden trace of a full 2-seat game including one keep.
- Validator, setup, play data, migration (`db:status`, drift) tests.

Review focus (cases the spec implies but a happy path misses):

1. Matcher matches on dart 1, throws a spare off the board ⇒ loses a life.
2. Matcher matches on dart 3 ⇒ no spare dart: no loss, target and leader unchanged.
3. Spare dart in the target's own bed ⇒ matcher becomes leader, same target.
4. Opening and leader darts off the board ⇒ stored, re-thrown, no rota move.
5. Undo across a keep, a stop and an elimination.
6. Rehydration (`create(config, prior)`) equals live state.
7. Keep refused after a matcher matched; allowed again after the next full
   pass of failures.

Gates: `npm test`, `npm run check`, fallow, all `check-*.sh` (including
`check-engine-kernels.sh`, `check-game-wiring.sh`, `check-test-coverage.sh`),
`validate:app`.

## 9. Sequencing

| PR | Brings |
| --- | --- |
| 1 | kernel extension, migration `0051`, FtL engine-only (registry, validator, capabilities, `STATS_TAGS`, kernel-check row), rules-file updates, D-entry |
| 2 | seeds, seat cap, setup, play (Stop, Keep/Set), results, card |

## 10. Out of scope

- 3–4 seats (F4), HORSE, Loop, Big 6, Number-Only Matching, Five Lives,
  Off-Hand Throughout, bull throw for first thrower, teams (rules file).
- Statistics views over `kept`.
