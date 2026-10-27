# Elimination Kernel PR 1 — Kernel + Killer Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Elimination rule kernel and the Killer V1 engine (engine-only: no seeds, setup, play page or card).

**Architecture:** `elimination-kernel.module.ts` folds every dart of a `SHARED` log into per-seat lives + game-owned `ext`, an out order, a winner and the active seat. `elimination-policies.ts` holds `killerHit`, Killer's only rule. `killer.engine.module.ts` is a `DartGameSpec` bound to `dart-engine-shell.module.ts`. Proof is TDD against `killer.md` plus one golden trace — no oracle (nothing shipped moves).

**Tech Stack:** TypeScript, Vitest, Zod; repo gates (`check-*.sh`, `validate:app`, fallow).

**Spec:** `docs/superpowers/specs/2026-10-27-elimination-kernel-design.md`

## Global Constraints

- Killer V1: 2 seats (E3); kernel stays N-seat and is tested at 3–4.
- Effects apply per dart (E4); own double toggles Killer every time, twice in a visit included (E5); seat numbers player-chosen, 1–20, distinct (E6).
- `SHARED` stage via the existing shell; no hand-written class (E7). No DartBot (E8): `RULESET_DARTBOT` omits `KILLER_V1`. No stats page (E9): `STATS_TAGS.KILLER_V1 = ["board"]`.
- Engine status is `"IN_PROGRESS" | "COMPLETE"` (as `MatchOutcome`), never `"COMPLETED"`.
- Persistence: one `EXERCISE_BLOCK` stage; one `turns` row per visit (≤3 darts); one `darts` row per dart, intent `NO_INTENT`; `totalScore` = board-score sum (no `closedVisitTotal`). No migration.
- Kernel has no Killer terms. Fold cognitive complexity ≤ 15; branching lives in policies.
- No `//` comments inside function bodies in `app/src/**`; JSDoc above declarations, no decision history (`app/CLAUDE.md` §Comments).
- Exported types live in `types.ts`/`interfaces.ts` (`check-type-barrels.sh`).
- TDD per `app/CLAUDE.md`: failing test first, watched fail, then code.
- Never `--no-verify`. Pre-commit runs the structural gates; `check-game-engines.sh` needs engine + validator registry + `RULESET_CAPABILITIES` in the same commit.
- Branch: `claude/charming-hawking-bu1cg6` (already carries the spec commit).

## Rulings made while planning

Recorded in the spec in Task 5.

- `onDart` takes a `DartObservation` (a `DartFact` satisfies it), so `wouldComplete` can run the same policy on an un-recorded dart.
- A visit is open in the kernel iff its turn has `completedAt === null`; the shell stamps `completedAt` when the spec's `isVisitOpen` reads false. So `dartsPerVisit` leaves `EliminationRules`: the 3-dart limit lives in the spec's `isVisitOpen`.
- Adding `KILLER_V1` makes the total records demand a `GameTypeKey` `"KILLER"`: `GAME_TYPE_BY_RULESET`, `RESULT_DIRECTION` (`null`), `REPLAY_PRESENTERS` (a minimal Killer presenter). These land in PR 1, not PR 2.
- `validateConfig` sees no seats, so it checks `seat_numbers.length === 2` (V1's fixed seat count) and distinctness. The participant-count floor of 2 lands in PR 2 with `SEAT_CAPS`.
- `killer.md` keeps `Current version: none` until PR 2 seeds the ruleset (the tag-seed generator reads it).

## Review Focus

1. A Killer takes the second-to-last seat's last life on dart 1 or 2 → match `COMPLETE`, the turn's `completedAt` stamped, next `record` throws. Pinned in Task 3 Step 1 ("mid-visit win closes the visit").
2. Undo of the eliminating dart → `IN_PROGRESS`, lives restored, `outOrder` empty, same thrower, visit open. Pinned in Task 3 Step 1 ("undo reopens an elimination").
3. Rehydration with an open visit: `create(config, prior)` yields the same `state()` and the same thrower. Pinned in Task 3 Step 1 ("rehydrates mid-visit").
4. A double on a number no seat owns, the outer bull, the inner bull → no change beyond `dartsThrown`. Pinned in Task 2 Step 1.
5. 3–4 seats: the rota skips an out seat; a change aimed at an out seat is ignored. Pinned in Task 1 Step 1.

---

### Task 1: Elimination kernel

**Files:**
- Modify: `app/src/modules/game/types.ts` (append kernel types)
- Modify: `app/src/modules/game/interfaces.ts` (append `EliminationRules`, beside `CheckoutRules`)
- Create: `app/src/modules/game/elimination-kernel.module.ts`
- Test: `app/tests/modules/game/elimination-kernel.module.test.ts`

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type EliminationSeat<TExt> = {
    participantRef: string; sideKey: string;
    lives: number; out: boolean; ext: TExt;
  };
  export type SeatChange<TExt> = {
    participantRef: string; livesDelta?: number; ext?: TExt;
  };
  export type EliminationMatch<TExt> = {
    seats: EliminationSeat<TExt>[];
    outOrder: string[];
    status: "IN_PROGRESS" | "COMPLETE";
    winningSideKey: string | null;
    activeParticipantRef: string;
  };
  ```
- Produces (interfaces.ts):
  ```ts
  export interface EliminationRules<TExt> {
    readonly startingLives: number;
    initExt(seat: SeatFact, index: number): TExt;
    onDart(
      thrower: EliminationSeat<TExt>,
      seats: readonly EliminationSeat<TExt>[],
      dart: DartObservation,
    ): readonly SeatChange<TExt>[];
  }
  ```
- Produces (kernel):
  - `applyEliminationDart<TExt>(seats: readonly EliminationSeat<TExt>[], throwerRef: string, dart: DartObservation, rules: EliminationRules<TExt>): EliminationSeat<TExt>[]` — applies changes in order; `lives = max(0, lives + livesDelta)`; `out = lives === 0`; changes to a seat already `out` before the dart are ignored.
  - `foldElimination<TExt>(turns: readonly TurnFact[], seats: readonly SeatFact[], rules: EliminationRules<TExt>): EliminationMatch<TExt>`.

- [ ] **Step 1: Write the failing tests**

Test rules (in the test file): `startingLives: 2`, `initExt: () => ({})`, `onDart` = "a `DOUBLE` on number N takes one life from seat index N−1". Helpers: `turn(ref, darts, closed)` builds a `TurnFact` with `completedAt` set iff `closed`; `d(n)` = `{ hitTargetNumber: n, hitZoneKey: "DOUBLE", locationX: null, locationY: null }`; `miss` = `{ hitTargetNumber: null, hitZoneKey: "MISS", … }`.

```ts
it("starts every seat at startingLives, seat 0 active", () => {
  const m = foldElimination([], seats3, rules);
  expect(m.seats.map((s) => s.lives)).toEqual([2, 2, 2]);
  expect(m.activeParticipantRef).toBe("p1");
  expect(m.status).toBe("IN_PROGRESS");
});
it("an open visit keeps its thrower", () => {
  expect(foldElimination([turn("p1", [miss], false)], seats3, rules).activeParticipantRef).toBe("p1");
});
it("a closed visit passes to the next seat", () => {
  expect(foldElimination([turn("p1", [miss, miss, miss], true)], seats3, rules).activeParticipantRef).toBe("p2");
});
it("lives clamp at zero and a seat at zero is out, in order", () => {
  const m = foldElimination([turn("p1", [d(2), d(2), d(2)], true)], seats3, rules);
  expect(m.seats[1]).toMatchObject({ lives: 0, out: true });
  expect(m.outOrder).toEqual(["p2"]);
});
it("the rota skips an out seat (3 seats)", () => {
  const m = foldElimination([turn("p1", [d(2), d(2), miss], true)], seats3, rules);
  expect(m.activeParticipantRef).toBe("p3");
});
it("the rota wraps past out seats (4 seats)", () => {
  const m = foldElimination(
    [turn("p1", [d(2), d(2), d(4)], true), turn("p3", [d(4), miss, miss], true)],
    seats4, rules);
  expect(m.activeParticipantRef).toBe("p1");
});
it("a change to an out seat is ignored", () => {
  const m = foldElimination(
    [turn("p1", [d(2), d(2), miss], true), turn("p3", [d(2), miss, miss], true)], seats3, rules);
  expect(m.seats[1].lives).toBe(0);
  expect(m.outOrder).toEqual(["p2"]);
});
it("last seat standing completes the match", () => {
  const m = foldElimination([turn("p1", [d(2), d(2)], true)], seats2, rules);
  expect(m).toMatchObject({ status: "COMPLETE", winningSideKey: "A" });
});
it("applyEliminationDart applies the policy's changes to a seat list", () => {
  const after = applyEliminationDart(foldElimination([], seats2, rules).seats, "p1", d(2), rules);
  expect(after[1].lives).toBe(1);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd app && npx vitest run tests/modules/game/elimination-kernel.module.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement types, `EliminationRules`, `applyEliminationDart`, `foldElimination`**

Fold: init seats from `rules`; walk every dart of every turn in order through `applyEliminationDart` (thrower = turn's `participantRef`), appending newly-out refs to `outOrder`; status/winner via `eliminationWinner(seats.map((s) => ({ sideKey: s.sideKey, failed: s.out })))` (`match-outcome.module.ts`). Active seat: no turns → `seats[0]`; last turn `completedAt === null` → its thrower; else the next seat after it in seat order (wrapping) with `out === false`. Keep the fold ≤ 15 cognitive complexity (extract `nextSeatIn`).

- [ ] **Step 4: Run to verify pass**

Run: `cd app && npx vitest run tests/modules/game/elimination-kernel.module.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/interfaces.ts app/src/modules/game/elimination-kernel.module.ts app/tests/modules/game/elimination-kernel.module.test.ts
git commit -m "feat(game): elimination kernel"
```

---

### Task 2: `killerHit` policy

**Files:**
- Modify: `app/src/modules/game/types.ts` (append `KillerExt`)
- Create: `app/src/modules/game/elimination-policies.ts`
- Test: `app/tests/modules/game/elimination-policies.test.ts`

**Interfaces:**
- Consumes: `EliminationSeat`, `SeatChange` (Task 1).
- Produces: `export type KillerExt = { number: number; killer: boolean; livesTaken: number; dartsToKiller: number | null; dartsThrown: number };` and `killerHit(thrower: EliminationSeat<KillerExt>, seats: readonly EliminationSeat<KillerExt>[], dart: DartObservation): SeatChange<KillerExt>[]`.

Rules (spec §4): every dart → thrower `dartsThrown + 1`. Only `hitZoneKey === "DOUBLE"` with `hitTargetNumber` 1–20 does more. Own number → toggle `killer`; first time on, `dartsToKiller = dartsThrown` (after the increment). Another seat's number and thrower `killer` → that seat `livesDelta: -1`, thrower `livesTaken + 1`. Thrower's change is one `SeatChange` carrying the full new `ext`.

- [ ] **Step 1: Write the failing tests**

Seats: A owns 5, B owns 12, both `lives: 3`, ext `{ killer: false, livesTaken: 0, dartsToKiller: null, dartsThrown: 0 }`.

```ts
it("own double makes a Killer and records darts to Killer", ...)
  // A throws D5 with dartsThrown 1 → thrower ext { killer: true, dartsToKiller: 2, dartsThrown: 2 }
it("own double again loses Killer status, dartsToKiller kept", ...)
it("a Killer's hit on another seat's double takes one life", ...)
  // A killer, D12 → [{ B, livesDelta: -1 }, thrower livesTaken 1]
it("a non-Killer's hit on another seat's double does nothing", ...)
  // → only the thrower's dartsThrown change; no livesDelta anywhere
it.each([
  ["single", { hitTargetNumber: 12, hitZoneKey: "OUTER_SINGLE" }],
  ["treble", { hitTargetNumber: 12, hitZoneKey: "TREBLE" }],
  ["unowned double", { hitTargetNumber: 7, hitZoneKey: "DOUBLE" }],
  ["outer bull", { hitTargetNumber: 25, hitZoneKey: "OUTER_BULL" }],
  ["inner bull", { hitTargetNumber: 25, hitZoneKey: "INNER_BULL" }],
  ["miss", { hitTargetNumber: null, hitZoneKey: "MISS" }],
])("a Killer's %s changes only dartsThrown", ...)
```

- [ ] **Step 2: Run to verify fail**

Run: `cd app && npx vitest run tests/modules/game/elimination-policies.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `killerHit`**

- [ ] **Step 4: Run to verify pass** — same command, PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/elimination-policies.ts app/tests/modules/game/elimination-policies.test.ts
git commit -m "feat(game): killerHit elimination policy"
```

---

### Task 3: Killer engine + ruleset wiring (one commit — gates)

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts` — `KillerConfig`, `KillerConfigData`, `KillerSnapshot`; `"KILLER_V1"` in `RulesetVersionKey`; `"KILLER"` in `GameTypeKey`; `RULESET_CONFIGS.KILLER_V1`.
- Modify: `app/src/lib/game/rulesets/capabilities.ts` — `RULESET_CAPABILITIES.KILLER_V1 = [DETAILED_DARTS, VISUAL_BOARD]`, `STATS_TAGS.KILLER_V1 = ["board"]`, `GAME_TYPE_BY_RULESET.KILLER_V1 = "KILLER"`.
- Modify: `app/src/lib/stats/section-registry.ts` — `RESULT_DIRECTION.KILLER = null`.
- Modify: `app/src/lib/stats/replay-presenters.ts` — `KILLER` presenter; `REPLAY_PRESENTERS.KILLER`.
- Modify: `app/src/modules/game/types.ts` — `KillerSeatState`, `KillerState`.
- Create: `app/src/modules/game/killer.engine.module.ts`
- Create: `app/src/services/rulesets/killer/killer.validator.ts`
- Modify: `app/src/services/rulesets/registry.ts` — `KILLER_V1: killerValidator`.
- Modify: `scripts/engine-kernels.txt` — `app/src/modules/game/killer.engine.module.ts | ELIMINATION | KERNEL_BOUND | docs/game-rules/rulesets/killer.md |`
- Test: `app/tests/modules/game/killer.engine.module.test.ts` (+ `__snapshots__`), `app/tests/services/rulesets/killer/killer.validator.test.ts`, `app/tests/lib/game/rulesets/capabilities.test.ts`, `app/tests/lib/stats/replay-presenters.test.ts` (extend existing files where they exist).

**Interfaces:**
- Consumes: `foldElimination`, `applyEliminationDart` (Task 1); `killerHit`, `KillerExt` (Task 2).
- Produces:
  ```ts
  KillerConfig = z.object({
    lives: z.literal(3).default(3),
    seat_numbers: z.array(z.number().int().min(1).max(20)).default([]),
  }).strict();
  export type KillerSnapshot = { lives: KillerConfigData["lives"]; seatNumbers: KillerConfigData["seat_numbers"] };
  export type KillerSeatState = {
    participantRef: string; sideKey: string; number: number; lives: number;
    killer: boolean; out: boolean; livesTaken: number;
    dartsToKiller: number | null; dartsThrown: number;
  };
  export type KillerState = {
    activeParticipantRef: string; status: "IN_PROGRESS" | "COMPLETE";
    winningSideKey: string | null; outOrder: string[]; seats: KillerSeatState[];
  };
  ```
  Engine module exports: `foldKillerState(facts: EngineFacts, config: Seated<KillerSnapshot>): KillerState`, `KillerEngine`, `killerEngineFactory` (registered). `killerValidator: RulesetValidator`.

Spec (`DartGameSpec<Seated<KillerSnapshot>, KillerState>`): `rulesetVersionKey: "KILLER_V1"`, `stageOwnership: "SHARED"`; `fold` = `foldElimination` with rules `{ startingLives: config.lives, initExt: (_, i) => ({ number: config.seatNumbers[i], killer: false, livesTaken: 0, dartsToKiller: null, dartsThrown: 0 }), onDart: killerHit }`, projected to `KillerState`; `refusal` = `endedRefusal("game has ended")` when `status !== "IN_PROGRESS"`; `intent` = `NO_INTENT`; `isVisitOpen(turn, state)` = `turn.darts.length < 3 && state.status === "IN_PROGRESS"`; `wouldComplete` = `eliminationWinner` over `applyEliminationDart(seats-from-state, state.activeParticipantRef, observation, rules)` is non-null.

Validator: `createThreeDartValidator({ label: "Killer", configSchema: KillerConfig, dartlessIssue })`, its `validateConfig` wrapped to add: `seat_numbers` must have length 2 (`"Killer needs one number per seat (2)"`) and be distinct (`"Seat numbers must differ"`).

Replay presenter `KILLER`: turn cells `Lives` (thrower's lives after) and `Taken` (lives taken this visit = `after.livesTaken − before.livesTaken`); session = `finalLine` on `lives`. Copy `BASEBALL`'s shape.

- [ ] **Step 1: Write the failing engine tests**

Config: `{ lives: 3, seatNumbers: [5, 12], seats: [A (p1, side A), B (p2, side B)] }`. Helpers `d(n)`, `s(n)`, `miss`.

```ts
it("registers KILLER_V1 as a SHARED engine", ...)          // getEngineFactory("KILLER_V1").stageOwnership === "SHARED"
it("seat 0 opens; 3 darts pass the turn", ...)
it("becoming a Killer on dart 1 lets darts 2–3 take lives (E4)", ...)
  // p1: D5, D12, D12 → B.lives 1, A.livesTaken 2, A.dartsToKiller 1
it("two own-double hits in one visit end not-Killer (E5)", ...)
  // p1: D5, D5, miss → A.killer false, A.dartsToKiller 1
it("mid-visit win closes the visit", ...)
  // B at 1 life (built by earlier visits); A Killer throws D12 as dart 1
  // → status COMPLETE, winningSideKey "A", outOrder ["p2"],
  //   facts().turns.at(-1).completedAt !== null, darts.length 1,
  //   record(miss) throws /game has ended/
it("undo reopens an elimination", ...)
  // from the previous state: undo() → IN_PROGRESS, B.lives 1, outOrder [], active p1, last turn completedAt null
it("rehydrates mid-visit", ...)
  // record 2 darts, then factory.create(config, engine.facts()).state() deep-equals engine.state()
it("wouldComplete is true only for the eliminating dart", ...)
it("writes NO_INTENT and the board score", ...)
  // facts().turns[0].darts[0]: intendedTargetNumber null, intendedZoneKey null, score 24 for D12
it("golden: one full 2-seat game", ...)
  // fixed dart list to a win; expect one line per dart `${ref} ${label} → A:${lives}${killer?"K":""} B:…` toMatchSnapshot()
```

Validator tests: accepts `{ lives: 3, seat_numbers: [5, 12] }` under both mode pairs; rejects `[5]`, `[5, 5]`, `[0, 12]`, `[5, 21]`, `lives: 5`; rejects a dartless turn.

Capabilities/presenter tests: `RULESET_CAPABILITIES.KILLER_V1` is the two pairs; `supportsDartbot("KILLER_V1") === false`; `GAME_TYPE_BY_RULESET.KILLER_V1 === "KILLER"`; `REPLAY_PRESENTERS.KILLER.turn` returns `Lives`/`Taken` cells for a hit visit.

- [ ] **Step 2: Run to verify fail**

Run: `cd app && npx vitest run tests/modules/game/killer.engine.module.test.ts tests/services/rulesets/killer tests/lib/game/rulesets/capabilities.test.ts tests/lib/stats/replay-presenters.test.ts`
Expected: FAIL — killer modules not found.

- [ ] **Step 3: Implement every file in the list above**

- [ ] **Step 4: Run to verify pass, then the full suite and types**

Run: `cd app && npx vitest run tests/modules/game/killer.engine.module.test.ts tests/services/rulesets/killer tests/lib && npm test && npm run check`
Expected: PASS; `astro check` 0 errors, 0 warnings, 0 hints. Inspect the golden snapshot by hand against `killer.md` before accepting it.

- [ ] **Step 5: Gates, then commit**

Run: `bash scripts/check-game-engines.sh && bash scripts/check-engine-kernels.sh && bash scripts/check-game-wiring.sh && bash scripts/check-type-barrels.sh && bash scripts/check-test-coverage.sh`
Expected: each prints PASS. (`check-game-wiring.sh`: `KILLER_V1` has no card, so no data files or pages may exist.)

```bash
git add -A app/src app/tests scripts/engine-kernels.txt
git commit -m "feat(game): Killer V1 engine on the elimination kernel"
```

---

### Task 4: Rules file

**Files:**
- Modify: `docs/game-rules/rulesets/killer.md`

Use the `authoring-game-rules` skill. Changes (spec §7): Features row `Multiplayer (2–4 seats)` → `Multiplayer (2 seats)` V1; new row `More than two seats | Deferred | 2+ | Blocked on: setup seats one guest or bot (app/src/lib/game/guest-list.ts:19) and the play screen draws two (SplitScoreboard)`; Config row Players → `2 seats`, `Shown, locked`; Becoming a Killer gains "Status changes take effect on the next dart: a seat that becomes a Killer mid-visit may take lives with the visit's remaining darts; a second own-double hit in the same visit loses the status again" (user decision 2026-10-27); seat numbers "chosen on the config screen" stays; remove the three answered Open questions. `Current version` stays `none`.

- [ ] **Step 1: Edit; run `bash scripts/check-game-rules.sh && bash scripts/check-tag-seeds.sh`** — both PASS.
- [ ] **Step 2: Commit** — `git commit -m "docs(rules): Killer V1 rulings and two-seat cut"`.

---

### Task 5: Canonical docs, decision, gates

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md` — Elimination row → `built — Killer bound (D<id>, 2026-10-27)`; module path `modules/game/elimination-kernel.module.ts` (policies: `elimination-policies.ts`); note the first `SHARED` shell engine.
- Modify: `app/src/modules/game/CLAUDE.md` — one Elimination bullet.
- Modify: `decisions/game-engine.md` — one D-entry (`bash scripts/next-decision-id.sh`): kernel form (dart-by-dart, `SHARED`, `completedAt` = visit closed), E3, E7–E9, and the planning rulings above.
- Modify: `docs/architecture/00-File-Inventory.md`, `docs/architecture/00-Context-Map-History.md`.
- Modify: `docs/superpowers/specs/2026-10-27-elimination-kernel-design.md` — §3 "Refined by the PR 1 plan" bullet (status-only note; spec is non-canonical).

- [ ] **Step 1: Edit the docs**
- [ ] **Step 2: Run the `context-maintenance` and `run-all-gates` skills; then `cd app && npm run format && npm run validate:app`** — every step exits 0, fallow included.
- [ ] **Step 3: Commit** — `git commit -m "docs: elimination kernel built — Killer bound"`.
- [ ] **Step 4: Finish** — `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch`: push, open the PR.
