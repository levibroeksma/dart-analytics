# Follow the Leader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Follow the Leader V1 playable end to end on the Elimination kernel: two seats, exact-bed chase, stored Stop and Keep.

**Architecture:** PR 1 adds three additive pieces under existing code (kernel visit-close hook and `shared` slot; `turns.kept` fact through the stack; shell "visit actions" for Stop and Keep), then a pure resolution policy and the `FOLLOW_THE_LEADER_V1` engine. PR 2 is app wiring on the shapes Killer proved (D501, D505). A game's whole outcome resolves when a visit **closes**, so the engine needs no per-dart effect.

**Tech Stack:** Astro, Alpine.js, TypeScript, Zod, Drizzle (schema mirror only), dbmate SQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-follow-the-leader-design.md`. Rules: `docs/game-rules/rulesets/follow-the-leader.md`. Exemplars: Killer PR 1 (`docs/superpowers/plans/2026-10-27-elimination-kernel-pr1.md`) and PR 2 (`…-pr2.md`); read them for the touch lists.

## Global Constraints

- Keys: game type `FOLLOW_THE_LEADER`, ruleset `FOLLOW_THE_LEADER_V1`, route and code slug `follow-the-leader`.
- Two seats exactly (F4): one PLAYER plus one guest. No DartBot (`RULESET_DARTBOT` omits it). Lives fixed at 3 (`z.literal(3)`).
- `stageOwnership: "SHARED"`, one `EXERCISE_BLOCK` stage. Capture: `DETAILED_DARTS` and `VISUAL_BOARD` only.
- A turn is closed only when `completedAt` is set; closure is never inferred from dart count in the fold.
- Opening and leader turns hold one dart; every turn keeps the three-dart cap.
- `turns.kept BOOLEAN NOT NULL DEFAULT false`, migration `0051`. Never edit applied migrations.
- Killer's folds, snapshots and tests must stay byte-identical (all kernel/shell changes additive).
- No `//` or `/* */` inside function bodies in `app/src`; JSDoc states the contract, not history. Exported types only in `types.ts`/`interfaces.ts`; import types from `@lib/types`, not `@lib/game/types`.
- Wiring touch list lands in **one commit** per PR (`check-game-wiring.sh`, pre-commit takes ~8 min). Never `--no-verify`. Discovered work → GitHub issue, not fixed here.
- Decision id: `bash scripts/next-decision-id.sh` at write time (main moves).

## Rulings made while planning (Claude's calls; recorded in the D-entry)

| Question | Call |
| --- | --- |
| A match on the **3rd dart** | Match then no spare: the leader does not change. The spec's Review Focus 2 said otherwise; the rules file wins (setting happens only when a dart was thrown **after** the first match). Spec line fixed in the same commit as this plan. |
| Where effects resolve | Only at visit close (`onVisitClose`). `onDart` returns `[]`. |
| `failed` set | `shared.failed`: refs whose last closed matcher visit had no matching dart. Cleared by any new setting or keep; a seat that later matches is removed. `keepAllowed` = every other seat still in is in the set. |
| Retry after an off-board opening/leader dart | `shared.retryRef` = that seat; an `activeOverride` rule keeps the rota on it. |
| Shell action names | `{ kind: "STOP" } \| { kind: "KEEP" }` (`FollowTheLeaderAction`). |
| Bed identity | Number + ring where both single zone keys fold to `SINGLE`; `OUTER_BULL`/`INNER_BULL` distinct; `MISS` is off the board. The implementer confirms the exact zone-key strings in `modules/game/types.ts`. |

## Review Focus

1. Matcher matches on dart 1, spare dart lands off the board → life lost, target/leader unchanged, seat not in `failed`. Task 4.
2. Match on dart 3 → leader unchanged, no life lost. Task 4.
3. Spare dart in the target's own bed → matcher becomes leader of the same target. Task 4.
4. Off-board opening/leader dart → stored, same seat throws again, rota does not move. Tasks 4, 5.
5. Undo across a Keep, a Stop, and an elimination (visit-closing fail). Tasks 3, 5.
6. Rehydration (`create(config, prior)`) equals live state at every dart of a golden game. Task 5.
7. Keep refused after a matcher matched; offered again after a full pass of failures; refused when `kept` would carry darts (validator). Tasks 4, 5, 2.

---

## PR 1 — kernel extension, `kept`, shell actions, engine

### Task 1: Kernel visit-close hook, shared slot, rota override

**Files:**
- Modify: `app/src/modules/game/interfaces.ts` (`EliminationRules`), `app/src/modules/game/types.ts` (`EliminationMatch`, new `ClosedVisit`, `VisitOutcome`), `app/src/modules/game/elimination-kernel.module.ts`
- Test: `app/tests/modules/game/elimination-kernel.module.test.ts`

**Interfaces:**
- Produces (all optional; defaults leave Killer unchanged):
  ```ts
  type ClosedVisit = { participantRef: string; darts: readonly DartObservation[]; kept: boolean };
  type VisitOutcome<TExt, TShared> = { changes: readonly SeatChange<TExt>[]; shared: TShared };
  interface EliminationRules<TExt, TShared = undefined> {
    /* existing */
    initShared?(seats: readonly SeatFact[]): TShared;
    onVisitClose?(visit: ClosedVisit, seats: readonly EliminationSeat<TExt>[], shared: TShared): VisitOutcome<TExt, TShared>;
    activeOverride?(seats: readonly EliminationSeat<TExt>[], shared: TShared): string | null;
  }
  EliminationMatch<TExt, TShared = undefined> gains `shared: TShared`
  foldElimination<TExt, TShared = undefined>(turns, seats, rules): EliminationMatch<TExt, TShared>
  ```
- Consumes: `TurnFact.kept?` (Task 2). To keep tasks independent, add `kept?: boolean` to `TurnFact` here and have Task 2 persist it.

- [ ] **Step 1: Failing tests** (toy `TShared = { closes: number }` rules, 2–3 seats):
  - `onVisitClose` runs once per turn with `completedAt !== null`, never for the open turn; `visit.kept` mirrors `TurnFact.kept`; `visit.darts` are that turn's darts.
  - Its `changes` apply through the existing clamp/out rules; `outOrder` and winner are decided after them (a visit-close elimination ends the match).
  - `shared` threads turn to turn and is returned on the match; with no hooks it is `undefined`.
  - `activeOverride` returning a ref beats the rota when the last turn is closed; `null` falls back; an open turn still wins over both.
  - A Killer fold over a fixture log deep-equals its pre-change result (reuse an existing Killer fixture).
- [ ] **Step 2: Run** `cd app && npx vitest run tests/modules/game/elimination-kernel.module.test.ts` — new cases FAIL, rest pass.
- [ ] **Step 3: Implement** in `foldElimination`: after a turn's darts, if `turn.completedAt !== null` and `rules.onVisitClose`, apply its `changes` the same way a dart's are (reuse `applyChange` + out-order bookkeeping; extract a small helper rather than growing fold complexity past 15) and take `shared`. `activeSeat` consults `rules.activeOverride` only when the last turn is closed.
- [ ] **Step 4: Run** the file, then `npx vitest run tests/modules/game` — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(elimination): visit-close hook, shared slot, rota override"`.

### Task 2: `turns.kept` through the stack

**Files:**
- Create: `database/migrations/0051_turns_kept.sql` (dbmate up/down: `ALTER TABLE turns ADD COLUMN kept BOOLEAN NOT NULL DEFAULT false;` / drop it)
- Modify: `app/src/db/schema.ts` (hand-edit `turns`: `kept: boolean().default(false).notNull()`), `app/src/pages/api/sessions/types.ts` (`TurnFact`: `kept: z.boolean().default(false)`), `app/src/repositories/interfaces.ts` (`BatchInsertTurn.kept: boolean`), `app/src/repositories/session.repository.ts` (insert `kept`), the service that builds `BatchInsertTurn` from the parsed batch (`app/src/services/session.service.ts`; find with `Grep totalScore`), the client upload mapper (`Grep completedAt` in `app/src/lib/client/api/sessions.ts` and `lib/game/play-lifecycle.ts`), `docs/architecture/05-Database/06-Spec/` turns chapter + `06-Database-Specification.md`, `docs/architecture/06-API/00-Overview.md` batch contract.
- Test: `app/tests/pages/api/sessions/` (schema defaults), `app/tests/repositories/session.repository.test.ts` (existing batch-insert test gains `kept`), `app/tests/services/session.service.test.ts`, client mapper test.

**Interfaces:**
- Produces: `TurnFact.kept?: boolean` on the engine type (Task 1), `kept: boolean` end to end; an old client omitting it uploads `false`.

- [ ] **Step 1: Failing tests**: Zod `TurnFact` accepts a turn without `kept` (parsed `false`) and with `kept: true`; the repository insert passes `kept` through (assert the values object); the client mapper emits `kept: turn.kept ?? false`; service maps parsed `kept` to `BatchInsertTurn`.
- [ ] **Step 2: Run** the touched test files — FAIL.
- [ ] **Step 3: Implement** each layer above; `kept` default `false` everywhere it is optional.
- [ ] **Step 4: Prove the migration**: `cd app && npm run db:status` then `npm run db:migrate && npm run db:drift` when `DATABASE_URL` is set; with none (cloud session), run the migration chain against a scratch Postgres 16 as in the Killer seed fix, and state which proof was used. Pin the carve-out: `0051` is new, so it is editable only until merged.
- [ ] **Step 5: Gates** `npm test && npm run check && bash ../scripts/check-constraint-mirror.sh` (no new CHECK, so no `// MIRRORS` anchor).
- [ ] **Step 6: Commit** `git commit -m "feat(db): turns.kept fact (0051) through batch upload"`.

### Task 3: Shell visit actions (Stop, Keep, undo)

**Files:**
- Modify: `app/src/modules/game/interfaces.ts` (`DartGameVisitActions`, `DartGameSpec.visitActions?`), `app/src/modules/game/dart-engine-shell.module.ts` (`record`, `undo`, `wouldComplete`), `app/src/modules/game/turn-log.module.ts` (helper `appendKeptTurn`)
- Test: `app/tests/modules/game/dart-engine-shell.module.test.ts` (toy spec)

**Interfaces:**
- Produces:
  ```ts
  interface DartGameVisitActions<TConfig, TState extends ShellState, TAction> {
    isAction(input: DartObservation | TAction): input is TAction;
    refusal(state: TState, action: TAction, config: TConfig, open: TurnFact | null): string | null;
    effect(action: TAction): "CLOSE_VISIT" | "KEEP_TURN";
    /** True when `turn` was closed by an action, not by its own darts; `before` is the state folded from the turns preceding it. */
    closedByAction(turn: TurnFact, before: TState, config: TConfig): boolean;
  }
  ```
  `DartGameSpec.visitActions?: DartGameVisitActions<TConfig, TState, TVisit>`. `CLOSE_VISIT` stamps `completedAt` on the open turn; `KEEP_TURN` appends a closed, dartless turn with `kept: true`, `totalScore` 0, for `before.activeParticipantRef`. Both then `syncStage()`. `undo()`: last turn `kept` → pop it; else closed and `closedByAction(...)` → set `completedAt = null`; else `undoLastDart` (unchanged). Specs without `visitActions` behave exactly as today.

- [ ] **Step 1: Failing tests** with a toy spec: STOP closes an open 1-dart turn (state sees it closed); KEEP appends `{ darts: [], kept: true, completedAt: set }`; `refusal` text is thrown; undo reopens a stopped turn and keeps its dart; undo pops a kept turn; undo of a dart-closed turn still pops the dart; rehydration from `facts()` after STOP equals live state; a spec without `visitActions` unchanged (run existing suite).
- [ ] **Step 2: Run** the shell test file — FAIL.
- [ ] **Step 3: Implement** per the interface; `record` checks `visitActions.isAction` before the dart path, after `visitInput`.
- [ ] **Step 4: Run** `npx vitest run tests/modules/game` — PASS (all engines).
- [ ] **Step 5: Commit** `git commit -m "feat(game-shell): visit actions — close an open visit, keep a turn, undo both"`.

### Task 4: Follow the Leader resolution policy (pure)

**Files:**
- Create: `app/src/modules/game/follow-the-leader-policy.ts`
- Modify: `app/src/modules/game/types.ts` (`BedFact`, `FollowTheLeaderExt`, `FollowTheLeaderShared`)
- Test: `app/tests/modules/game/follow-the-leader-policy.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type BedFact = { number: number | null; ring: "SINGLE" | "DOUBLE" | "TREBLE" | "OUTER_BULL" | "INNER_BULL" };
  type FollowTheLeaderShared = { target: BedFact | null; leaderRef: string | null; failed: string[]; retryRef: string | null };
  type FollowTheLeaderExt = Record<string, never>;
  bedOf(dart: DartObservation): BedFact | null          // null = off the board
  sameBed(a: BedFact, b: BedFact): boolean
  resolveVisit(visit: ClosedVisit, seats: readonly EliminationSeat<FollowTheLeaderExt>[], shared: FollowTheLeaderShared): VisitOutcome<FollowTheLeaderExt, FollowTheLeaderShared>
  keepAllowed(seats, shared, activeRef: string): boolean
  ```
- Consumes: `ClosedVisit`, `VisitOutcome` (Task 1).

`resolveVisit` rules (one decision per branch, from the rules file):
- `kept` → `shared.failed = []`, no changes.
- `target === null` (opening) or visit thrower is `leaderRef` (leader turn): the one dart `bedOf` null → `retryRef = thrower`, no change; else `target = bed`, `failed = []`, `retryRef = null`, `leaderRef` = thrower.
- Matcher: `matchIdx` = first dart `sameBed` to target. `lastOff` = last dart off board. `spare` = darts exist after `matchIdx`.
  - `lastOff` → `livesDelta −1`; `failed` gains the thrower only if `matchIdx < 0`, else loses it; target and leader unchanged.
  - no match, last on board (3 darts) → `livesDelta −1`; `failed` gains thrower.
  - match and `spare` and last on board → `target = bed(last)`, `leaderRef` = thrower, `failed = []`.
  - match and no spare → no change; `failed` drops the thrower.

- [ ] **Step 1: Failing tests**, table-driven, one row per branch above with the exact expected `changes`/`shared`; plus: `sameBed` (single inner = single outer; T18 ≠ S18; outer bull ≠ inner bull; number mismatch); `keepAllowed` true only when active is the leader, target set, and every other seat not out is in `failed`; false after one matcher matched; Review Focus 1–3 as named rows.
- [ ] **Step 2: Run** — FAIL (module missing).
- [ ] **Step 3: Implement** the four functions; keep each branch a small helper so cognitive complexity stays ≤ 15.
- [ ] **Step 4: Run** — PASS; `npm run check` clean.
- [ ] **Step 5: Commit** `git commit -m "feat(game): Follow the Leader visit resolution policy"`.

### Task 5: Follow the Leader engine + ruleset wiring (one commit — gates)

**Files:** mirror Killer's PR 1 Task 3 list, with these keys.
- Modify: `app/src/lib/game/rulesets/types.ts` (`FollowTheLeaderConfig = z.object({ lives: z.literal(3).default(3) }).strict()`, `FollowTheLeaderSnapshot = { lives }`; `"FOLLOW_THE_LEADER_V1"` in `RulesetVersionKey`; `"FOLLOW_THE_LEADER"` in `GameTypeKey`; `RULESET_CONFIGS`), `capabilities.ts` (`[DETAILED_DARTS, VISUAL_BOARD]`, `STATS_TAGS ["board"]`, `GAME_TYPE_BY_RULESET`), `lib/stats/section-registry.ts` (`RESULT_DIRECTION.FOLLOW_THE_LEADER = null`), `lib/stats/replay-presenters.ts` (presenter: cells `Lives`, `Result` = `Match`/`Fail`/`Set`/`Keep`), `modules/game/types.ts` (`FollowTheLeaderSeatState`, `FollowTheLeaderState`, `FollowTheLeaderAction`), `services/rulesets/registry.ts`, `scripts/engine-kernels.txt` (`… | ELIMINATION | KERNEL_BOUND | docs/game-rules/rulesets/follow-the-leader.md |`).
- Create: `app/src/modules/game/follow-the-leader.engine.module.ts`, `app/src/services/rulesets/follow-the-leader/follow-the-leader.validator.ts`, seed `database/seeds/00NN_follow_the_leader_game_engine_reference.sql` + `0007` capability rows + verification-script rows (copy Killer's PR 1 commit: `git log --oneline -- database/seeds/*killer*`), tag-seed regeneration (`app/scripts/generate-tag-seed.ts`; Killer's `a644a54` null-guard already exists).
- Test: `app/tests/modules/game/follow-the-leader.engine.module.test.ts` (+ snapshot), `app/tests/services/rulesets/follow-the-leader/…validator.test.ts`, capabilities/presenter/registry tests.

**Interfaces:**
- Produces:
  ```ts
  type FollowTheLeaderSeatState = { participantRef: string; sideKey: string; lives: number; out: boolean };
  type FollowTheLeaderState = ShellState & {
    status: "IN_PROGRESS" | "COMPLETE"; winningSideKey: string | null; outOrder: string[];
    seats: FollowTheLeaderSeatState[]; target: BedFact | null; leaderRef: string | null;
    phase: "OPENING" | "MATCH" | "LEAD"; matched: boolean; canStop: boolean; keepAllowed: boolean;
  };
  type FollowTheLeaderAction = { kind: "STOP" } | { kind: "KEEP" };
  foldFollowTheLeaderState(facts: EngineFacts, config: Seated<FollowTheLeaderSnapshot>): FollowTheLeaderState
  class FollowTheLeaderEngine; const followTheLeaderEngineFactory   // registered
  followTheLeaderValidator: RulesetValidator
  ```
- Consumes: Tasks 1–4.

Spec (`DartGameSpec<Seated<FollowTheLeaderSnapshot>, FollowTheLeaderState, FollowTheLeaderAction>`): `rulesetVersionKey "FOLLOW_THE_LEADER_V1"`, `stageOwnership "SHARED"`; rules `{ startingLives: config.lives, initExt: () => ({}), onDart: () => [], initShared: () => ({ target: null, leaderRef: null, failed: [], retryRef: null }), onVisitClose: resolveVisit, activeOverride: (_, s) => s.retryRef }`; state derivations: `phase` OPENING when `target === null`, LEAD when the active seat is `leaderRef`, else MATCH; `matched` = the open turn has a dart `sameBed` to target; `canStop` = MATCH, open turn, `matched`; `keepAllowed` from Task 4 and no open turn; `refusal` = `endedRefusal("game has ended")` when COMPLETE; `intent: NO_INTENT`; `isVisitOpen(turn, state)` = `turn.completedAt === null` and darts `< 3` for MATCH, `< 1` for OPENING/LEAD, and `IN_PROGRESS`; `visitActions`: `isAction` by `kind`; `refusal` — STOP: `!state.canStop` → `"Stop needs a match first"`; KEEP: `!state.keepAllowed` → `"Keep not allowed"`; `effect` STOP→`CLOSE_VISIT`, KEEP→`KEEP_TURN`; `closedByAction(turn, before)` = `before.phase === "MATCH"` and `turn.darts.length < 3`; `wouldComplete`: fold a copy of the log with the dart (or action) appended and the visit closed if its closing condition is met, true if status becomes COMPLETE.
Validator: `createThreeDartValidator` composed so a dartless turn is valid only when `kept` is true, and `kept` ⇒ no darts and `totalScore 0`; `validateConfig` rejects `lives ≠ 3` and a seat count ≠ 2 if the base validator exposes it (otherwise `SEAT_FLOORS` in PR 2 owns it).

- [ ] **Step 1: Failing engine tests** (seats A p1, B p2; `d(n)` double, `t(n)` treble, `s(n)` single, `miss`):
  - registers as `SHARED`; seat 0 opens; opening `miss` → stored, `activeParticipantRef` still p1, `phase` OPENING; then `t18` → target T18, leader A, active p2.
  - B (MATCH): `s18, s18, s18` → B −1, target and leader unchanged, active p1 (LEAD), `keepAllowed` true.
  - A `KEEP` → closed dartless turn with `kept`, active p2; undo pops it and restores `keepAllowed`.
  - B `t18` then `STOP` → no loss, leader still A; `keepAllowed` false; undo reopens B's turn with its dart (Review Focus 5).
  - B `t18, s5, miss` → loses a life (spare off board), target unchanged, `keepAllowed` false.
  - B `t18, s5, d20` → B leader, target D20, A is matcher.
  - B `s1, s2, t18` → matched on dart 3, leader A unchanged, no loss.
  - Three lost matcher visits end the game: COMPLETE, `winningSideKey "A"`, `outOrder ["p2"]`, last turn closed, `record(miss)` throws `/game has ended/`; `wouldComplete` true exactly on the closing dart; undo reopens (B back to 1 life, turn open).
  - Rehydration deep-equals live at every step of the golden game; `STOP`/`KEEP` refusals throw their messages.
  - Golden: one full 2-seat game as text lines `${ref} ${label} → target:${bed} lead:${ref} A:${lives} B:${lives}` `toMatchSnapshot()`; inspect by hand against the rules file before accepting.
  - Validator: accepts a kept dartless turn; rejects a dartless non-kept turn, `kept` with darts, `lives: 5`; capabilities/registry/presenter/engine-kernels checks.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/modules/game/follow-the-leader.engine.module.test.ts tests/services/rulesets/follow-the-leader tests/lib` — FAIL.
- [ ] **Step 3: Implement** every file in the list (verify zone-key strings against `types.ts` first).
- [ ] **Step 4: Run** the same, then `npm test && npm run check` — PASS, 0 hints.
- [ ] **Step 5: Gates** `bash scripts/check-game-engines.sh && bash scripts/check-engine-kernels.sh && bash scripts/check-game-wiring.sh && bash scripts/check-type-barrels.sh && bash scripts/check-test-coverage.sh && bash scripts/check-tag-seeds.sh` — PASS (no card yet, so no data files or pages).
- [ ] **Step 6: Commit** `git commit -m "feat(game): Follow the Leader V1 engine on the elimination kernel"`.

### Task 6: Rules file, docs, decision, PR 1 gates

**Files:** `docs/game-rules/rulesets/follow-the-leader.md`, `docs/architecture/04-Architecture-patterns.md` (Pattern 18: note the `onVisitClose`/`shared`/visit-actions extension), `app/src/modules/game/CLAUDE.md`, `decisions/game-engine.md`, `docs/architecture/00-File-Inventory.md`, `00-Context-Map-History.md`, `docs/superpowers/specs/2026-10-29-follow-the-leader-design.md` (status note).

- [ ] **Step 1: Rules file** via `authoring-game-rules`: Multiplayer row → 2 seats V1, new Deferred row "3–4 seats — Blocked on: setup seats one guest or bot (`lib/game/guest-list.ts:19`) and the play screen draws two"; Config Players → 2 locked; Capture "keep" bullet states `turns.kept` (migration `0051`); answered open questions (3rd-dart match, failed = no match dart) recorded; `bash scripts/check-game-rules.sh && bash scripts/check-tag-seeds.sh` PASS.
- [ ] **Step 2: Docs + one D-entry** (kernel extension, `kept`, shell actions, resolve-at-close, the rulings table). Run `context-maintenance` and `run-all-gates`; `cd app && npm run format && npm run validate:app` (DB steps need `DATABASE_URL`; say which ran).
- [ ] **Step 3: Commit, then `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch`**: push, open PR 1.

---

## PR 2 — app wiring (branch from `main` after PR 1 merges)

### Task 7: Seat floor/cap and active-session card

**Files:** `app/src/services/session-seats.service.ts` (`SEAT_FLOORS.FOLLOW_THE_LEADER_V1 = 2`, `SEAT_CAPS` entry 2), `app/src/modules/game/session-progress.module.ts` (summarizer: detail `1v1 · Follow the Leader`, big = active seat's lives, label `LIVES`), `app/src/lib/stats/constants.ts` (`HEATMAP_ONLY_LAYOUTS`); tests beside each.

- [ ] **Step 1: Failing tests**: a one-seat or omitted seat list is refused with `` `FOLLOW_THE_LEADER_V1 needs at least 2 seats.` ``; three seats refused by the cap; summarizer output for an in-progress fixture.
- [ ] **Step 2–4:** run (FAIL), implement, run (PASS) as in Killer PR 2 Task 2/4.
- [ ] **Step 5: Commit** `feat(follow-the-leader): two-seat floor and progress summary`.

### Task 8: Setup controller and form

**Files:** Create `app/src/lib/game/follow-the-leader-setup.data.ts` (`followTheLeaderSetup()`, `canStart()`), `app/src/components/layout/games/setup/FollowTheLeaderSetupForm.astro`; tests under `app/tests/lib/game/`.

- [ ] **Step 1: Failing tests**: `start()` builds config `{ lives: 3 }` with two seats; Start blocked (`startBlockedExpr`) until a guest is seated; starter step reorders seats with no per-person data to carry; Play Again defers to `variantsPlayAgain("FOLLOW_THE_LEADER_V1")` and honours `playAgainStarter`.
- [ ] **Step 2–4:** run (FAIL), implement on `createPresetSetupController` (no `configOverrides`), run (PASS). Form shows locked rows: 3 lives, exact bed, opening dart off hand (instruction text only).
- [ ] **Step 5: Commit** (no wiring yet; pages come in Task 11).

### Task 9: Play controller, interface, keypad (Stop, Keep/Set)

**Files:** Create `app/src/lib/game/follow-the-leader-play.data.ts` (`followTheLeaderPlay()`), `app/src/components/layout/games/interfaces/FollowTheLeader.astro`, `app/src/components/layout/games/FollowTheLeaderRecreationalInput.astro`; reuse Killer's keypad shape (`KillerRecreationalInput.astro`); tests under `app/tests/lib/game/`.

**Interfaces:** play data exposes `target`, `leaderRef`, `phase`, `canStop`, `keepAllowed`, `stop()` (records `{ kind: "STOP" }`), `keep()` (records `{ kind: "KEEP" }`), plus the usual dart entry, `undoVisit`, abandon. The pad shows a target banner (exact bed text, e.g. `Treble 18`), leader badge, lives. `canStop` → **Stop** beside the dart keys. `keepAllowed` at a leader's turn → prompt "Everyone failed. Keep or set?": **Keep** calls `keep()`, **Set** reveals the dart pad. `phase` OPENING shows the off-hand instruction.

- [ ] **Step 1: Failing tests**: banner text for each ring and bull; `stop()`/`keep()` call `engine.record` with the action and refuse otherwise; the prompt shows only when `keepAllowed`; Set hides the prompt without recording; resume after reload mid-visit gives the same phase/active seat; undo of a Keep restores the prompt; undo of the game-ending visit reopens and hides the results modal.
- [ ] **Step 2–4:** run (FAIL), implement, run (PASS). `.astro` files get no extraction tests (D101); keep logic in the `.data.ts`.
- [ ] **Step 5: Commit** (no wiring yet).

### Task 10: Results modal

**Files:** Create `app/src/components/layout/games/result-modals/FollowTheLeaderResults.astro` and a seat-results helper in `app/src/lib/game/follow-the-leader-results.ts` + test: winner, out order, lives left per seat (winner included); an abandoned session shows no winner (existing abandon flow).

- [ ] **Step 1–4:** failing helper test (win and abandoned fixtures), implement, PASS. **Step 5: Commit.**

### Task 11: Card, pages, registration, docs — one commit

**Files:** `lib/game/games-visibility.ts` (CLASSICS, title `Follow the Leader`, caption `Hit the bed they set, or lose a life.`, href `/games/follow-the-leader/setup`), both data files' registrations in `lib/game/register-route-data.ts`, `pages/games/follow-the-leader/setup/index.astro` and `…/play/index.astro`, Alpine registrations, `07-Frontend/09-Adding-A-Game.md`, `04-Endpoint-Contracts.md` (`kept` on the batch turn), File Inventory, Context-Map History, spec status note, `follow-the-leader.md` `Current version` per the `authoring-game-rules` skill's shipped convention (Killer's header is the model).

- [ ] **Step 1: Failing tests**: card present and ordered; `register-route-data` test lists the new routes.
- [ ] **Step 2–3:** run (FAIL), implement all of the above in one change set.
- [ ] **Step 4: Run** `npm test && npm run check` then `bash scripts/check-game-wiring.sh`.
- [ ] **Step 5: Commit once** (`feat(follow-the-leader): playable — setup, play, results, card`); pre-commit takes ~8 minutes, let it finish.

### Task 12: Gates, smoke, PR

- [ ] **Step 1:** `cd app && npm run format && npm run validate:app` (note which DB steps ran).
- [ ] **Step 2: Smoke** in the browser (`astro dev --background`, Playwright): start a 2-seat game, play one opening dart off the board then on, one fail, one keep, one stop, to a win; confirm results modal. Say plainly if the batch upload to a real database was not exercised.
- [ ] **Step 3:** `context-maintenance`, `run-all-gates`, then `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch`: push, open PR 2.

## Self-review notes

- Spec coverage: §3 rules → Task 4/5; §3a calls → Tasks 3–5; §4 kernel → Task 1; §5 binding/shell needs → Tasks 3, 5; §6 capture/migration → Task 2; §7 wiring → Tasks 7–11; §8 proof/review focus → Review Focus above; §9 sequencing → PR 1/PR 2; §10 out of scope untouched.
- Spec correction: Review Focus 2 and §3a "3rd-dart match sets" conflict with the rules file; the plan follows the rules file and Task 6 fixes the spec.
