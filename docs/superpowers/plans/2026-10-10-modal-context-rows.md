# Modal Context Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repo pairings (root `CLAUDE.md`): TDD procedure from `app/CLAUDE.md` §Test-Driven Development; incidental findings → `capturing-discovered-work`; completion → `run-all-gates` + `finishing-a-dart-branch`.

**Goal:** Show a `game · leg · round / remaining` inlay row on the Exit, finish-confirm and Continue-session sheets (#822, last open part).

**Architecture:** One pure module folds the persisted fact log (`$store.game`) into a structured row per game. The game store exposes it as `contextRow()`, so every sheet — including Exit in `GameLayout`'s own scope and Continue on setup pages — reads the same derivation. `InlayRow` gains a dynamic mode that drops empty parts and hides itself when empty. Routine finish confirms compose the routine name and step onto the step game's round and value.

**Tech Stack:** Astro, Alpine.js, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-modal-context-rows-design.md`

## Global Constraints

- No server, API, migration or `SessionActive` change.
- No button copy, sheet layout or chrome change; only the row is added.
- Missing data → part omitted with its dot; no parts and no value → no row. Never a placeholder (`—`, `0`, `Leg ?`).
- Titles exactly: `501`, `121`, `TUOD`, `Score training`.
- Part copy exactly: `Leg n`, `Attempt n`, `Round n`, `Round n of N`, `Step n of N`.
- Values belong to `state.activeParticipantRef`'s seat.
- A row is folded only when the stored log belongs to the session in play; otherwise the fallback title or nothing.
- Exit on a routine shows the step game's line, never the routine line; non-game routine step → no row.
- `.astro` markup is not unit-tested (D101); its proof is `npm run validate:app` (astro check, 0/0/0) plus the style/convention gates.
- No `//` comments inside function bodies (`app/CLAUDE.md` §Comments).

## Review Focus

1. **Stale persisted log** — `$store.game` still holds an earlier session (old standalone 501 during a routine warm-up; a different session on the setup page). Expect no folded row. Pinned in Task 1 (`expectedSessionId` mismatch) and Task 2 (adapter sets/clears `gameSessionId`).
2. **Fresh session, no turns yet** — Exit tapped before the first dart. Expect `Leg 1 · Round 1` and the starting score, not an empty row. Pinned in Task 1.
3. **Open visit mid-turn** — one or two darts thrown in the visit. Round must not advance until the visit closes. Pinned in Task 1 (501 and score training).
4. **Round past the budget** — ROUNDS session on its final visit, or 121/TUOD attempt counter past `durationValue`. Expect `Round N of N`, never `Round 11 of 10`. Pinned in Task 1.
5. **Unmapped game / no config** — Exit on Cricket, Bob's 27, etc., or `configSnapshot` null. Expect no row (Exit) or title-only fallback (Continue). Pinned in Task 1.

---

## File Structure

| File | Responsibility |
|---|---|
| Create `app/src/modules/game/session-context.module.ts` | Pure: fact log + config → `SessionContextRow`; row → display parts |
| Create `app/tests/modules/game/session-context.module.test.ts` | Per-game, guard and edge tests |
| Modify `app/src/stores/game.store.ts` | `contextRow()` method |
| Modify `app/src/stores/training-session.store.ts` | `gameSessionId` field + setter, cleared by `reset()` |
| Modify `app/src/lib/training/routines/adapters/game.adapter.ts` | Set `gameSessionId` on `open`, clear on `close` |
| Modify `app/src/lib/training/routines/routine-play.data.ts` | `stepContextRow()` |
| Modify `app/src/components/ui/InlayRow.astro` | `rowExpr` dynamic mode |
| Modify `ExitModal.astro`, `ContinueSessionModal.astro`, 4 play pages, routine play page | Render the row |
| Modify docs | Style guide, component inventory, `decisions/frontend/style.md` D440, spec status |

---

### Task 1: Session context module

**Files:**
- Create: `app/src/modules/game/session-context.module.ts`
- Test: `app/tests/modules/game/session-context.module.test.ts`

**Interfaces:**
- Consumes: `foldFiveOhOneState`, `foldOneTwentyOneState`, `foldTuodState`, `foldScoreTrainingState` (`@modules/game/*.engine.module`); `EngineFacts` (`@modules/game/types`).
- Produces:
  ```ts
  export type SessionContextRow = {
    title: string | null;
    stage: string | null;
    round: string | null;
    value: string | null;
  };
  export type SessionContextInput = {
    gameTypeKey: string | null;
    sessionId: string | null;
    configSnapshot: unknown;
    facts: EngineFacts;
    timerExpired: boolean;
  };
  export type SessionContextOptions = {
    expectedSessionId?: string | null;
    fallbackTitle?: string | null;
  };
  export function sessionContextRow(
    input: SessionContextInput,
    options?: SessionContextOptions,
  ): SessionContextRow | null;
  export function contextRowParts(row: SessionContextRow | null): string[];
  ```

Per-game mapping (keys are `gameTypeKey`):

| Key | title | stage | round | value |
|---|---|---|---|---|
| `501` | `501` | `Leg ${max(stages.length,1)}` | `Round ${closed turns of active seat in last stage + 1}` | active seat `remainingScore` |
| `ONE_TWENTY_ONE` | `121` | `Attempt ${attemptsCompleted+1}` | `Round ${visitsThisAttempt+1}` | `remainingInAttempt` |
| `TUOD` | `TUOD` | null | `Round ${min(attempts+1,N)} of ${N}` under ROUNDS, else `Round ${attempts+1}` | `currentTarget` |
| `SCORE_TRAINING` | `Score training` | null | `Round ${min(turnCount+1,N)} of ${N}` under ROUNDS, else `Round ${turnCount+1}` | `totalScore` |

Guard: when `options.expectedSessionId !== undefined` and it differs from `input.sessionId` (or is null), skip the fold. Skipped fold, null config or unmapped key → `{ title: fallbackTitle, stage: null, round: null, value: null }` if `fallbackTitle` is non-empty, else `null`. Config is narrowed by the key with a cast, as the play pages do. 121's duration fields are absent under `121_V1`; the module needs neither.

- [ ] **Step 1: Write failing tests.** Build facts by driving each engine's factory with `record(...)` then `engine.facts()`, as the engine tests do; one solo seat (`participant-1`). Tests:
  - `501: fresh session reads Leg 1 · Round 1 and the starting score` → `{ title: "501", stage: "Leg 1", round: "Round 1", value: "501" }`.
  - `501: two closed visits of 60 read Round 3 and 381`.
  - `501: an open visit does not advance the round` (VISUAL_BOARD, one dart recorded after two closed visits → `Round 3`).
  - `501: second leg reads Leg 2 and resets Round` (win leg 1 with `legsToWin: 2`).
  - `121: reads Attempt n · Round n and remaining in attempt` (one visit of 60 on 121 → `Attempt 1`, `Round 2`, `61`).
  - `TUOD: ROUNDS caps Round at N` (`durationValue: 2`, two attempts → `Round 2 of 2`); `TUOD: MINUTES reads Round n with no budget`; value is `currentTarget` as a string.
  - `Score training: reads Round n of N and total scored`; `MINUTES reads Round n`.
  - `skips the fold when expectedSessionId differs` → `null`; with `fallbackTitle: "501"` → title-only row.
  - `expectedSessionId null never folds`.
  - `unmapped game or null config returns null, or the fallback title`.
  - `contextRowParts drops null fields and keeps order` → `["501", "Round 3"]` for `{title:"501",stage:null,round:"Round 3",value:"x"}`; `contextRowParts(null)` → `[]`.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/modules/game/session-context.module.test.ts` — expect FAIL (module not found).
- [ ] **Step 3: Implement** `sessionContextRow` and `contextRowParts` in `app/src/modules/game/session-context.module.ts`; one private mapper per game; JSDoc on exports only.
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** `feat(game): derive modal context rows from the fact log`.

### Task 2: Store wiring and routine game-session guard

**Files:**
- Modify: `app/src/stores/game.store.ts`, `app/src/stores/training-session.store.ts`, `app/src/lib/training/routines/adapters/game.adapter.ts`
- Test: `app/tests/stores/game.store.test.ts`, `app/tests/stores/training-session.store.test.ts`, `app/tests/lib/training/routines/adapters/game.adapter.test.ts`

**Interfaces:**
- Consumes: Task 1 `sessionContextRow`, `SessionContextOptions`, `SessionContextRow`.
- Produces:
  - `$store.game.contextRow(expectedSessionId?: string | null, fallbackTitle?: string | null): SessionContextRow | null` — passes `gameTypeKey`, `sessionId`, `configSnapshot`, `{ stages, turns }`, `timerExpired ?? false`.
  - `$store.trainingSession.gameSessionId: string | null` (not persisted, default `null`), `setGameSession(sessionId: string | null): void`; `reset()` clears it.
  - `gameAdapter(...).open` calls `ctx.$store.trainingSession.setGameSession(result.sessionId)`; `close` calls `setGameSession(null)`.

- [ ] **Step 1: Write failing tests.**
  - game store: `contextRow folds the stored log` (startSession 501 config + `recordFacts` of two 60s → `round: "Round 3"`); `contextRow with a different expected session returns the fallback title only`.
  - training-session store: `setGameSession stores the id and reset clears it`.
  - game adapter: `open records the step session id on trainingSession`; `close clears it` (extend the existing ctx stub with a `trainingSession` store spy).
- [ ] **Step 2: Run** `cd app && npx vitest run tests/stores tests/lib/training/routines/adapters/game.adapter.test.ts` — expect the new tests FAIL.
- [ ] **Step 3: Implement** the three signatures above.
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** `feat(game): expose contextRow on the game store`.

### Task 3: InlayRow dynamic mode and standalone sheets

**Files:**
- Modify: `app/src/components/ui/InlayRow.astro`, `app/src/components/layout/games/ExitModal.astro`, `app/src/components/layout/games/ContinueSessionModal.astro`, `app/src/pages/games/{501,121,tuod,score-training}/play/index.astro`

**Interfaces:**
- Consumes: Task 1 `contextRowParts`, Task 2 `$store.game.contextRow`, `$store.trainingSession.gameSessionId`.
- Produces: `InlayRow` prop `rowExpr?: string` — an Alpine expression of type `SessionContextRow | null`. With `rowExpr`, the row renders `x-for` over its parts (dot before every part but the first), the value from `row.value`, and `x-show` hides the whole row when parts and value are both empty. `parts` becomes optional; `parts`/`valueExpr` mode is unchanged for existing callers.

- [ ] **Step 1: Make parts reachable from markup.** Add store method `contextRowParts(row: SessionContextRow | null): string[]` to `game.store.ts`, delegating to Task 1's `contextRowParts`. Test in `game.store.test.ts`: `contextRowParts delegates and drops nulls`. Run `cd app && npx vitest run tests/stores/game.store.test.ts`: FAIL → implement → PASS.
- [ ] **Step 2: InlayRow.** Add `rowExpr`. Without a wrapper scope, render `x-for="part in $store.game.contextRowParts(<rowExpr>)"`, value `x-text="(<rowExpr>)?.value ?? ''"` shown only when non-empty, and `x-show` on the root hiding it when parts are empty and value is null. Keep tokens and classes identical to the static mode.
- [ ] **Step 3: Exit.** In `ExitModal.astro` pass `<InlayRow slot="context" rowExpr="$store.game.contextRow($store.trainingSession.active ? $store.trainingSession.gameSessionId : undefined)" />` into `ConfirmDialog`.
- [ ] **Step 4: Finish confirms.** In the 501, 121, TUOD and score-training play pages, add `<InlayRow slot="context" rowExpr="$store.game.contextRow()" />` to the finish `ConfirmDialog`.
- [ ] **Step 5: Continue.** In `ContinueSessionModal.astro`, add `<InlayRow rowExpr="$store.game.contextRow(activeSession?.sessionId ?? null, activeSession?.gameTypeName ?? null)" />` in the body, above the error line.
- [ ] **Step 6: Verify** `cd app && npm run validate:app` — expect exit 0, astro check `0 errors, 0 warnings, 0 hints`; and from repo root `bash scripts/check-style-tokens.sh && bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh` — expect pass.
- [ ] **Step 7: Commit** `feat(ui): context rows on exit, finish and continue sheets`.

### Task 4: Routine finish confirms

**Files:**
- Modify: `app/src/lib/training/routines/routine-play.data.ts`, `app/src/pages/training/routines/play/index.astro`
- Test: `app/tests/lib/training/routines/routine-play.data.test.ts`

**Interfaces:**
- Consumes: Task 2 `$store.game.contextRow`, Task 3 `InlayRow` `rowExpr`.
- Produces: `stepContextRow(this: RoutinePlayContext): SessionContextRow | null` — `{ title: routineName || null, stage: "Step ${stepIndex+1} of ${steps.length}", round: gameRow?.round ?? null, value: gameRow?.value ?? null }` where `gameRow = this.$store.game.contextRow(this.$store.trainingSession.gameSessionId)`; `stepIndex` from `this.training.state().stepIndex`.

- [ ] **Step 1: Write failing tests** in `routine-play.data.test.ts`: `stepContextRow composes routine name, step and the game round` (stub `$store.game.contextRow` → `{ title: "TUOD", stage: null, round: "Round 3 of 10", value: "44" }`, routine `"Evening"`, step 2 of 5 → `{ title: "Evening", stage: "Step 2 of 5", round: "Round 3 of 10", value: "44" }`); `stepContextRow keeps name and step when the game row is null`.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/training/routines/routine-play.data.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `stepContextRow`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Wire** `<InlayRow slot="context" rowExpr="stepContextRow()" />` into the three routine finish `ConfirmDialog`s (tuod, score-training, 121 panels).
- [ ] **Step 6: Verify** `cd app && npm run validate:app` — exit 0, 0/0/0.
- [ ] **Step 7: Commit** `feat(routines): context rows on routine finish confirms`.

### Task 5: Docs, context maintenance, finish

**Files:**
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md` (§Dialogs, line ~114), `docs/architecture/07-Frontend/08-Component-Inventory.md` (`InlayRow`, `ConfirmDialog` rows), `decisions/frontend/style.md` (append D440), spec status line.

- [ ] **Step 1:** Style guide: one sentence after the Dialogs paragraph — mid-game sheets carry a context row from `$store.game.contextRow()`; missing parts are dropped, never placeheld (D440).
- [ ] **Step 2:** Component inventory: `InlayRow` props add `rowExpr`; note the dynamic mode.
- [ ] **Step 3:** Append D440 to `decisions/frontend/style.md`: context row derived from the persisted fact log via one module; local-only on Continue; routine Exit shows the game line; `trainingSession.gameSessionId` guard. Cite #822 and the spec.
- [ ] **Step 4:** Spec status → `implemented`.
- [ ] **Step 5:** Run the `context-maintenance` skill, then `run-all-gates`; every listed script passes.
- [ ] **Step 6:** `cd app && npm run format && npm run format:check` — clean; commit `docs: context rows (D440)`.
- [ ] **Step 7:** `finishing-a-dart-branch` — push, open PR referencing #822 (`Closes #822`).
