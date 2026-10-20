# #916 PR B — Lifecycle Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four copy-pasted `undoVisit` bodies (five-oh-one, one-twenty-one, score-training, tuod) with two shared helpers in `lib/game/play-lifecycle.ts`.

**Architecture:** `play-lifecycle.ts` gains `isInputBlocked(context, ...confirmFlags)`, the guard, and `undoBotAwareVisit(context)`, everything after the guard. one-twenty-one, score-training and tuod use both. five-oh-one keeps its inline guard, because it has no timer pause (`timerPaused` appears nowhere in `five-oh-one-play.data.ts`), and adopts only `undoBotAwareVisit`. Pure move, no behaviour change.

**Tech Stack:** TypeScript, Vitest, Alpine play-data modules, bash gate scripts.

**Spec:** `docs/superpowers/specs/2026-10-20-916-play-engine-dedupe-design.md` §PR B

**Branch:** `refactor/916-lifecycle-guards`, cut from `origin/main` at `456b6e7e` (PR A merged). Work in the main copy; no worktree.

**Spec choice resolved:** the spec leaves five-oh-one's guard to the plan: either `isInputBlocked` takes `{ timerPaused: false }`, or five-oh-one keeps its inline guard. This plan keeps the inline guard. That is the smaller diff: no options parameter on a helper that three of four callers would never pass.

## Global Constraints

- No behaviour change. Every guard keeps its exact flags:
  - five-oh-one: `finished`, `showDoubleConfirm`, `showMatchFinishConfirm`, with no `timerPaused`.
  - one-twenty-one: `finished`, `showDoubleConfirm`, `showSessionFinishConfirm`, `timerPaused`.
  - score-training: `finished`, `showFinishConfirm`, `timerPaused`.
  - tuod: `finished`, `showDoubleConfirm`, `showFinishConfirm`, `timerPaused`.
- `throwOneDart` (x4) is not extracted (spec §PR B).
- No new exported type. The helpers' context parameters use inline intersections, the same way `playRunBotVisualBoardVisit` does. `scripts/check-type-barrels.sh` (D309) forbids exported types outside `lib/game/types.ts`.
- No `//` or `/* */` comments inside function bodies (`app/CLAUDE.md` §Comments). Each helper gets a JSDoc block above it.
- Every changed runtime `.ts` needs a changed test that imports it (`scripts/check-test-coverage.sh`, D224).
- Tests live under `app/tests/`, mirroring `app/src/`. No existing test is re-pointed or deleted.
- Never `--no-verify`. Pre-commit takes more than 2 minutes, so run `git commit` with a 600000 ms timeout.
- Discovered work becomes a GitHub issue (`capturing-discovered-work` skill), never a fix in this PR.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW
  ```

## Review Focus

1. **Five-oh-one must not gain a pause guard.** If someone later "tidies" 501 onto `isInputBlocked`, undo would start depending on `timerPaused`, a flag 501 never sets. Task 3 keeps 501's guard inline, and its test pins `showMatchFinishConfirm`.
2. **Unused imports.** After the move, `clearHiddenTimer` and `undoToActiveSeat` each appear once in all four files (in the import only), so drop both from each import. `findBotSeat` is still used elsewhere in all four (count 3 today), so keep it. `tsc` and `astro check` (0 hints) must stay clean.
3. **`this` binding of `maybeRunBotVisit`.** The helper calls `context.maybeRunBotVisit()` as a method call on the same object, so `this` is still the page context. Never destructure it. The bot-crossing tests in each game suite ("undoVisit crosses the seat boundary back to the human") cover this end to end.
4. **Failed `engine.undo()` with no bot.** The helper must return before clearing `scoreInput` or `error`, exactly as today. Pinned in Task 1.
5. **Optional `timerPaused`.** `PlayStoreContext.game.timerPaused` is `boolean | undefined`. `isInputBlocked` must return a real `boolean` and treat `undefined` as not paused. Pinned in Task 1.

---

### Task 1: `isInputBlocked` and `undoBotAwareVisit` in `play-lifecycle.ts`

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts`: add `findBotSeat` to the `@lib/game/play-bot-seat` import at `:17`; add both helpers directly after `undoToActiveSeat` (ends `:294`).
- Test: `app/tests/lib/game/play-lifecycle.test.ts`: add both to the `@lib/game/play-lifecycle` import (`:39-58`); add new describes after `describe("undoToActiveSeat")` (ends `:1004`).
- Docs: `docs/architecture/00-File-Inventory.md:197` (`play-lifecycle.ts` row).

**Interfaces:**
- Produces:
  ```ts
  export function isInputBlocked<TConfig, TEngine extends GameEngine<DartObservation, unknown>, TResults>(
    context: PlayLifecycleContext<TConfig, TEngine, TResults>,
    ...confirmFlags: boolean[]
  ): boolean;

  export function undoBotAwareVisit<TConfig, TEngine extends GameEngine<DartObservation, MultiSeatState>, TResults>(
    context: PlayLifecycleContext<TConfig, TEngine, TResults> & {
      scoreInput: { clear(): void };
      maybeRunBotVisit(): Promise<void>;
    },
  ): void;
  ```

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/play-lifecycle.test.ts`, add `isInputBlocked` and `undoBotAwareVisit` to the `@lib/game/play-lifecycle` import. After `describe("undoToActiveSeat", …)`, append:

```ts
describe("isInputBlocked", () => {
  it("is false when nothing blocks input", () => {
    const context = makeBotContext(new BotFakeEngine([HUMAN_SEAT]), [
      HUMAN_SEAT,
    ]);
    expect(isInputBlocked(context, false, false)).toBe(false);
  });

  it("is true once finished", () => {
    const context = makeBotContext(new BotFakeEngine([HUMAN_SEAT]), [
      HUMAN_SEAT,
    ]);
    context.finished = true;
    expect(isInputBlocked(context)).toBe(true);
  });

  it("is true while the timer is paused", () => {
    const context = makeBotContext(new BotFakeEngine([HUMAN_SEAT]), [
      HUMAN_SEAT,
    ]);
    context.$store.game.timerPaused = true;
    expect(isInputBlocked(context)).toBe(true);
  });

  it("is true when any confirm flag is set", () => {
    const context = makeBotContext(new BotFakeEngine([HUMAN_SEAT]), [
      HUMAN_SEAT,
    ]);
    expect(isInputBlocked(context, false, true)).toBe(true);
    expect(isInputBlocked(context, true, false)).toBe(true);
  });
});

type UndoCtx = BotCtx & {
  scoreInput: { clear: ReturnType<typeof vi.fn> };
  maybeRunBotVisit: ReturnType<typeof vi.fn>;
};

function makeUndoContext(
  engine: BotFakeEngine,
  seats: readonly SeatFact[],
): UndoCtx {
  return {
    ...makeBotContext(engine, seats),
    scoreInput: { clear: vi.fn() },
    maybeRunBotVisit: vi.fn(async () => {}),
  };
}

describe("undoBotAwareVisit", () => {
  it("in a bot session, rewinds to the human's seat across the bot's turn", () => {
    const engine = new BotFakeEngine(TWO_BOT_SEATS);
    engine.record(dartAt(20));
    engine.record(dartAt(19));
    const context = makeUndoContext(engine, TWO_BOT_SEATS);

    undoBotAwareVisit(context);

    expect(engine.facts().turns).toHaveLength(0);
    expect(engine.state().activeParticipantRef).toBe(HUMAN_REF);
  });

  it("with no bot, pops one visit and mirrors facts into the store", () => {
    const engine = new BotFakeEngine([HUMAN_SEAT]);
    engine.record(dartAt(20));
    engine.record(dartAt(19));
    const context = makeUndoContext(engine, [HUMAN_SEAT]);
    context.hiddenTurnKey = "t2";

    undoBotAwareVisit(context);

    expect(engine.facts().turns).toHaveLength(1);
    expect(context.hiddenTurnKey).toBeNull();
    expect(context.$store.game.recordFacts).toHaveBeenCalledWith(
      engine.facts(),
    );
  });

  it("clears score input and error, then hands back to the bot loop", () => {
    const engine = new BotFakeEngine([HUMAN_SEAT]);
    engine.record(dartAt(20));
    const context = makeUndoContext(engine, [HUMAN_SEAT]);
    context.error = "stale";

    undoBotAwareVisit(context);

    expect(context.scoreInput.clear).toHaveBeenCalledOnce();
    expect(context.error).toBe("");
    expect(context.maybeRunBotVisit).toHaveBeenCalledOnce();
  });

  it("with no bot, stops on a failed engine.undo() without touching input, error or the bot loop", () => {
    const engine = new BotFakeEngine([HUMAN_SEAT]);
    const context = makeUndoContext(engine, [HUMAN_SEAT]);
    context.error = "stale";

    undoBotAwareVisit(context);

    expect(context.$store.game.recordFacts).not.toHaveBeenCalled();
    expect(context.scoreInput.clear).not.toHaveBeenCalled();
    expect(context.error).toBe("stale");
    expect(context.maybeRunBotVisit).not.toHaveBeenCalled();
  });

  it("does nothing without an engine", () => {
    const context = makeUndoContext(new BotFakeEngine([HUMAN_SEAT]), [
      HUMAN_SEAT,
    ]);
    context.engine = null;

    undoBotAwareVisit(context);

    expect(context.scoreInput.clear).not.toHaveBeenCalled();
    expect(context.maybeRunBotVisit).not.toHaveBeenCalled();
  });
});
```

If `context.$store.game.timerPaused = true` fails to typecheck because `BotCtx`'s store object literal lacks the optional key, the assignment is still valid: `timerPaused?: boolean` is declared on `PlayStoreContext` (`types.ts:281`/`:323`). Do not change `makeBotContext`.

- [ ] **Step 2: Run the tests and watch them fail**

Run (from `app/`): `npx vitest run tests/lib/game/play-lifecycle.test.ts -t "isInputBlocked|undoBotAwareVisit"`
Expected: FAIL. `isInputBlocked` and `undoBotAwareVisit` are not exported (`is not a function`).

- [ ] **Step 3: Implement**

In `app/src/lib/game/play-lifecycle.ts`, change `:17` to:

```ts
import { BOT_PACING, findBotSeat } from "@lib/game/play-bot-seat";
```

Directly after `undoToActiveSeat`'s closing brace, add:

```ts
/**
 * The play-page input guard: true once the session is finished, while the
 * segment timer is paused, or while any of the caller's own confirm dialogs
 * is open. Each page passes its own confirm flags.
 */
export function isInputBlocked<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  ...confirmFlags: boolean[]
): boolean {
  return (
    context.finished ||
    context.$store.game.timerPaused === true ||
    confirmFlags.some(Boolean)
  );
}

/**
 * Undoes one visit on a page that may seat a DartBot. With a bot seat it
 * rewinds to the human's seat (`undoToActiveSeat`); without one it pops a
 * single visit and stops if there is nothing to pop. Then it clears the
 * score input and error and re-enters the bot loop. The caller owns its
 * input guard (`isInputBlocked`, or five-oh-one's own).
 */
export function undoBotAwareVisit<
  TConfig,
  TEngine extends GameEngine<DartObservation, MultiSeatState>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults> & {
    scoreInput: { clear(): void };
    maybeRunBotVisit(): Promise<void>;
  },
): void {
  if (!context.engine) return;
  const seats = context.$store.game.seats;
  if (findBotSeat(seats)) {
    const humanSeat = seats.find(
      (seat) => seat.participantTypeKey === "PLAYER",
    )!;
    undoToActiveSeat(context, humanSeat.participantRef);
  } else {
    if (!context.engine.undo()) return;
    clearHiddenTimer(context);
    context.$store.game.recordFacts(context.engine.facts());
  }
  context.scoreInput.clear();
  context.error = "";
  void context.maybeRunBotVisit();
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run tests/lib/game/play-lifecycle.test.ts`
Expected: PASS, the whole file.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors.

- [ ] **Step 6: File Inventory**

In `docs/architecture/00-File-Inventory.md:197`, change the row's opening `` `/`runPlayAgain` — the record → mirror → complete lifecycle `` to `` `/`runPlayAgain`/`isInputBlocked`/`undoBotAwareVisit` — the record → mirror → complete lifecycle ``, and append `` `isInputBlocked`/`undoBotAwareVisit` hold the play-page undo guard and the bot-aware undo body shared by five-oh-one/one-twenty-one/score-training/tuod (2026-10-20). `` as the row's last sentence, before the closing ` |`.

- [ ] **Step 7: Commit** (include the plan doc)

```bash
git add docs/superpowers/plans/2026-10-20-916-pr-b-lifecycle-guards.md \
  app/src/lib/game/play-lifecycle.ts app/tests/lib/game/play-lifecycle.test.ts \
  docs/architecture/00-File-Inventory.md
git commit -m "refactor(game): add shared undo guard and bot-aware undo helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW"
```

---

### Task 2: one-twenty-one, score-training and tuod adopt both helpers

**Files (each: modify source, modify its mirrored test):**
- `app/src/lib/game/one-twenty-one-play.data.ts:796-819` / `app/tests/lib/game/one-twenty-one-play.data.test.ts` (`describe("undoVisit")` `:253`)
- `app/src/lib/game/score-training-play.data.ts:543-565` / `app/tests/lib/game/score-training-play.data.test.ts` (`describe("undoVisit")` `:1922`)
- `app/src/lib/game/tuod-play.data.ts:698-721` / `app/tests/lib/game/tuod-play.data.test.ts` (`describe("undoVisit")` `:758`)

**Interfaces:**
- Consumes: `isInputBlocked`, `undoBotAwareVisit` from `@lib/game/play-lifecycle` (Task 1).

These are characterization tests. Each pins a guard flag that no existing test in that file covers, so it passes before the refactor. Its RED is shown by a mutation probe in Step 2.

- [ ] **Step 1: Write the characterization tests**

`one-twenty-one-play.data.test.ts`, inside `describe("undoVisit")` (`:253`), after the existing `it`:

```ts
    it("is a no-op while the session-finish confirm is open", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      play.scoreInput.setValue("60");
      await play.submitVisit();
      play.showSessionFinishConfirm = true;

      play.undoVisit();

      expect(store.game.turns).toHaveLength(1);
    });
```

`score-training-play.data.test.ts`, inside `describe("undoVisit")` (`:1922`), after the first `it`:

```ts
    it("is a no-op once finished", async () => {
      const store = gameStub({ configSnapshot: rounds(20) });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("45");
      await component.init.call(component);
      await component.submitVisit.call(component);
      component.finished = true;

      component.undoVisit();

      expect(store.turns).toHaveLength(1);
    });
```

`tuod-play.data.test.ts`, inside `describe("undoVisit")` (`:758`), after the first `it`:

```ts
    it("is a no-op while the finish confirm is open", async () => {
      const store = gameStub({ configSnapshot: rounds(20) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      await component.recordAttempt.call(component, CHECKOUT);
      component.showFinishConfirm = true;

      component.undoVisit();

      expect(store.turns).toHaveLength(1);
    });
```

- [ ] **Step 2: Prove each test can fail (mutation probe)**

Run (from `app/`): `npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts tests/lib/game/score-training-play.data.test.ts tests/lib/game/tuod-play.data.test.ts -t "undoVisit"`
Expected: PASS (characterization).

Then, one at a time, delete the pinned flag from that file's current `undoVisit` guard: `this.showSessionFinishConfirm ||` in one-twenty-one, `this.finished ||` in score-training, `this.showFinishConfirm ||` in tuod. Re-run the same command.
Expected: the new test FAILs (turns length 0) in that file. Restore the line with `git checkout -- <file>` before the next probe.

- [ ] **Step 3: Replace the three `undoVisit` bodies**

one-twenty-one:

```ts
    undoVisit(this: OneTwentyOnePlayContext) {
      if (
        isInputBlocked(
          this,
          this.showDoubleConfirm,
          this.showSessionFinishConfirm,
        )
      )
        return;
      undoBotAwareVisit(this);
    },
```

score-training:

```ts
    undoVisit(this: ScoreTrainingPlayContext) {
      if (isInputBlocked(this, this.showFinishConfirm)) return;
      undoBotAwareVisit(this);
    },
```

tuod:

```ts
    undoVisit(this: TuodPlayContext) {
      if (
        isInputBlocked(this, this.showDoubleConfirm, this.showFinishConfirm)
      )
        return;
      undoBotAwareVisit(this);
    },
```

Let prettier settle the line breaks; the code above is the content, not the final wrapping.

In each file's `@lib/game/play-lifecycle` import block, add `isInputBlocked` and `undoBotAwareVisit`, and remove `clearHiddenTimer` and `undoToActiveSeat`. Each now appears only in the import. Before removing a name, check with `grep -c '\bclearHiddenTimer\b\|\bundoToActiveSeat\b' <file>`: it must return 2, meaning the import line plus no other use. Keep `findBotSeat`.

- [ ] **Step 4: Run the three suites**

Run: `npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts tests/lib/game/score-training-play.data.test.ts tests/lib/game/tuod-play.data.test.ts`
Expected: PASS, all tests, including every existing `undoVisit` test (paused, finish confirm, bot crossing, hide timer).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors. A `this`-type error on `maybeRunBotVisit` means the helper's `maybeRunBotVisit(): Promise<void>` member does not accept the page's `this:`-typed method. In that case, record a ruling and change the helper's member to `maybeRunBotVisit(this: never): Promise<void>` rather than casting at call sites.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/{one-twenty-one,score-training,tuod}-play.data.ts \
  app/tests/lib/game/{one-twenty-one,score-training,tuod}-play.data.test.ts
git commit -m "refactor(game): 121, score training and tuod share the undo guard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW"
```

---

### Task 3: five-oh-one adopts `undoBotAwareVisit`, keeps its own guard

**Files:**
- Modify: `app/src/lib/game/five-oh-one-play.data.ts:819-841`
- Test: `app/tests/lib/game/five-oh-one-play.data.test.ts` (`describe("undoVisit")` `:505`)

**Interfaces:**
- Consumes: `undoBotAwareVisit` from `@lib/game/play-lifecycle` (Task 1). Not `isInputBlocked`; see Review Focus 1.

- [ ] **Step 1: Write the characterization test**

Inside `describe("undoVisit")` (`:505`), after the existing double-confirm `it`:

```ts
  it("is a no-op while the match-finish confirm is open", async () => {
    const play = makePlay();
    await play.init.call(play);
    play.scoreInput.setValue("100");
    await play.submitVisit.call(play);
    play.showMatchFinishConfirm = true;

    play.undoVisit.call(play);

    expect(play.$store.game.turns).toHaveLength(1);
  });
```

- [ ] **Step 2: Prove it can fail (mutation probe)**

Run (from `app/`): `npx vitest run tests/lib/game/five-oh-one-play.data.test.ts -t "undoVisit"`
Expected: PASS.

Delete `this.showMatchFinishConfirm` from the guard, leaving `this.finished || this.showDoubleConfirm`, and re-run.
Expected: the new test FAILs (turns length 0). Restore with `git checkout -- app/src/lib/game/five-oh-one-play.data.ts`.

- [ ] **Step 3: Replace the body after the guard**

```ts
    undoVisit(this: FiveOhOnePlayContext) {
      if (
        this.finished ||
        this.showDoubleConfirm ||
        this.showMatchFinishConfirm
      )
        return;
      undoBotAwareVisit(this);
    },
```

In the `@lib/game/play-lifecycle` import block, add `undoBotAwareVisit` and remove `clearHiddenTimer` and `undoToActiveSeat`, after confirming with the same `grep -c` check as Task 2 (must return 2). Keep `findBotSeat`.

- [ ] **Step 4: Run the suite**

Run: `npx vitest run tests/lib/game/five-oh-one-play.data.test.ts`
Expected: PASS, all tests, including "undoVisit crosses the seat boundary back to the human" and "undoVisit cancels a pending hide timer".

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/five-oh-one-play.data.ts app/tests/lib/game/five-oh-one-play.data.test.ts
git commit -m "refactor(game): 501 shares the bot-aware undo body

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW"
```

---

### Task 4: Gates, dupes check, PR

**Files:** none new.

- [ ] **Step 1: Confirm no copy is left**

Run (from repo root):
```bash
grep -n "undoToActiveSeat(this\|clearHiddenTimer(this)" app/src/lib/game/{five-oh-one,one-twenty-one,score-training,tuod}-play.data.ts
```
Expected: no output.

- [ ] **Step 2: Full suite + type gates**

From `app/`: `npm test > <workspace>/test.log 2>&1; tail -20 <workspace>/test.log`, then `npx astro check --minimumFailingSeverity hint`.
Expected: all tests pass; astro check 0 errors, 0 warnings, 0 hints.

- [ ] **Step 3: Fallow**

From repo root: `bash scripts/fallow-gate.sh`, then `cd app && npx fallow dupes --mode mild | grep -E "five-oh-one|one-twenty-one|score-training|tuod"`.
Expected: the gate passes. The `undoVisit` clone groups (`five-oh-one:830-863`, `one-twenty-one:809-834`, `score-training:545-576`, `tuod:700-724`) are gone. `throwOneDart` groups remain, and they are out of scope per the spec.

- [ ] **Step 4: Structural gates and format**

From repo root: `for s in scripts/check-*.sh; do bash "$s" || echo "FAIL $s"; done`. From `app/`: `npm run format && npm run format:check`.
Expected: no `FAIL` lines, and format is clean for `app/`. Commit any formatter diff.

- [ ] **Step 5: Context maintenance**

Run the `context-maintenance` skill.
Expected: the File Inventory row from Task 1 is the only doc change. No decision block (pure refactor). `08-DartBot.md` §The Play Loop still names `undoToActiveSeat()`, which stays true, since `undoBotAwareVisit` calls it. No edit.

- [ ] **Step 6: Push and open the PR**

Per `finishing-a-dart-branch` (Option 2), run `git push -u origin refactor/916-lifecycle-guards`, then open a PR against `main` using `.github/pull_request_template.md`.

The body notes:
- "Part of the #916 follow-up (spec `docs/superpowers/specs/2026-10-20-916-play-engine-dedupe-design.md`, PR B of A–D)".
- The five-oh-one inline-guard choice.
- The mutation-probe results.

It ends with the session attribution lines.
