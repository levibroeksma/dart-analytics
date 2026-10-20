# #916 PR A — Play-Data Bot Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the private copies of the DartBot seat helpers and pacing constants from nine `*-play.data.ts` files and import one shared set from `lib/game/play-bot-seat.ts`.

**Architecture:** `play-bot-seat.ts` already exports `findBotSeat` and `botDartIndex`; it gains one constant, `BOT_PACING: BotPacing = { preThrowMs: 900, postThrowMs: 250 }`. It replaces the nine `{ preThrowMs: BOT_PRE_THROW_MS, postThrowMs: BOT_POST_THROW_MS }` literals and `play-lifecycle.ts`'s private `QUICK_SCORE_PACING` (same values). Pure deletion plus imports — no behaviour change.

**Tech Stack:** TypeScript, Vitest, Alpine play-data modules, bash gate scripts.

**Spec:** `docs/superpowers/specs/2026-10-20-916-play-engine-dedupe-design.md` §PR A

**Branch:** `refactor/916-play-engine-dedupe` (already holds the spec commit). Work in the main copy; no worktree.

**Deviation from spec:** the spec names two constants (`BOT_PRE_THROW_MS`, `BOT_POST_THROW_MS`). Every use site builds the same `BotPacing` object from them, and `play-lifecycle.ts` holds a third copy as `QUICK_SCORE_PACING`. One `BOT_PACING` object removes all eleven copies; two constants would leave nine object literals behind. Same values, same type.

## Global Constraints

- No behaviour change: pacing stays `preThrowMs: 900`, `postThrowMs: 250` everywhere.
- `DARTS_PER_VISIT` stays local in each file — a game rule, not bot pacing.
- `DartbotSeat` and `BotPacing` are types declared in `app/src/lib/game/types.ts` and imported via `@lib/types`; `play-bot-seat.ts` must not declare an exported type (`scripts/check-type-barrels.sh`, D309).
- No `//` or `/* */` comments inside function bodies (`app/CLAUDE.md` §Comments).
- Every changed runtime `.ts` needs a changed test that imports it (`scripts/check-test-coverage.sh`, D224). No per-file silencer.
- Tests live under `app/tests/`, mirroring `app/src/`.
- No existing test is re-pointed or deleted.
- Never `--no-verify`. A hook failure is fixed at its cause.
- Discovered work becomes a GitHub issue (`capturing-discovered-work` skill), never a fix in this PR.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW
  ```

## Review Focus

1. **Unused imports after deletion.** Removing `findBotSeat`/`botDartIndex`/`DartbotSeat` leaves `SeatFact` (and in `doubles-training`, `TurnFact`) imported but unused in some files. `tsc`/`astro check` (0 hints) must stay clean — drop exactly the now-unused names, nothing else.
- Counts today (`grep -c '\bSeatFact\b'` / `'\bTurnFact\b'`): around-the-clock 3/7, bobs27 3/4, doubles-training 3/2, five-oh-one 4/4, one-twenty-one 3/4, shanghai 3/4, singles-training 3/5. A count of 3 for `SeatFact` means only the import remains after deletion → remove it; five-oh-one keeps it. `doubles-training`'s `TurnFact` drops to 1 → remove it.
2. **QUICK_SCORE bot replay pacing.** `playAnimateBotDarts` defaults to `QUICK_SCORE_PACING`; swapping the default to `BOT_PACING` must keep 250 ms after each land. Pinned by Task 1's lifecycle test.
3. **Shared object mutation.** One `BOT_PACING` object is now handed to every bot visit. Nothing mutates `pacing` today (`grep -rn "pacing\.[a-zA-Z]* *=[^=]" src` is empty); Task 1 freezes it so a future mutation throws in tests rather than leaking across games.
4. **VISUAL_BOARD pacing per game.** Each game's thrower must still return `BOT_PACING`. Pinned per game in Tasks 2–3 by a `setTimeout` spy test.
5. **Circular import.** `play-lifecycle.ts` will import `play-bot-seat.ts`; `play-bot-seat.ts` imports only types. Keep it that way — no value import from `play-lifecycle` into `play-bot-seat`.

---

### Task 1: `BOT_PACING` in `play-bot-seat.ts`, adopted by `play-lifecycle.ts`

**Files:**
- Modify: `app/src/lib/game/play-bot-seat.ts`
- Modify: `app/src/lib/game/play-lifecycle.ts:294` (`QUICK_SCORE_PACING`) and `:441` (default param)
- Test: `app/tests/lib/game/play-bot-seat.test.ts`
- Test: `app/tests/lib/game/play-lifecycle.test.ts` (`describe("playAnimateBotDarts")`, `:2155`)
- Docs: `docs/architecture/00-File-Inventory.md:204` (`play-bot-seat.ts` row)

**Interfaces:**
- Produces: `export const BOT_PACING: BotPacing` from `@lib/game/play-bot-seat`, frozen, `{ preThrowMs: 900, postThrowMs: 250 }`.

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/play-bot-seat.test.ts`, add `BOT_PACING` to the existing import from `@lib/game/play-bot-seat` and append:

```ts
describe("BOT_PACING", () => {
  it("is the shared bot pacing: 900 ms before each dart, 250 ms after it lands", () => {
    expect(BOT_PACING).toEqual({ preThrowMs: 900, postThrowMs: 250 });
  });

  it("is frozen, so no game can change another game's pacing", () => {
    expect(Object.isFrozen(BOT_PACING)).toBe(true);
  });
});
```

In `app/tests/lib/game/play-lifecycle.test.ts`, inside `describe("playAnimateBotDarts", …)`, add (reuses that block's `BotFakeEngine`, `TWO_BOT_SEATS`, `makeBotContext`, `dartAt`, `BOT_REF`):

```ts
  it("defaults to the shared BOT_PACING when no pacing is passed", async () => {
    const engine = new BotFakeEngine(TWO_BOT_SEATS);
    engine.record(dartAt(20));
    const context = makeBotContext(engine, TWO_BOT_SEATS);
    const waits: number[] = [];
    const wait = vi.fn().mockImplementation(async (ms: number) => {
      waits.push(ms);
    });

    await playAnimateBotDarts(context, BOT_REF, [dartAt(19)], wait);

    expect(waits.at(-1)).toBe(BOT_PACING.postThrowMs);
    expect(waits.slice(0, 3).reduce((sum, ms) => sum + ms, 0)).toBe(
      BOT_PACING.preThrowMs,
    );
  });
```

and add `import { BOT_PACING } from "@lib/game/play-bot-seat";` to that file's imports.

- [ ] **Step 2: Run tests to verify they fail**

Run (from `app/`): `npx vitest run tests/lib/game/play-bot-seat.test.ts tests/lib/game/play-lifecycle.test.ts`
Expected: FAIL — `BOT_PACING` is not exported (`undefined`), so `toEqual` and `isFrozen`/`.postThrowMs` fail.

If the aim/fly/hit sum assertion fails for a reason other than `BOT_PACING` being undefined (e.g. `botFlightSchedule` rounds), drop that one assertion and keep the `postThrowMs` one; do not change `botFlightSchedule`.

- [ ] **Step 3: Implement**

`app/src/lib/game/play-bot-seat.ts` — change the type import and add the constant after the imports:

```ts
import type { BotPacing, DartbotSeat, SeatFact } from "@lib/types";
import type { TurnFact } from "@modules/types";

/** The DartBot's per-dart pacing in every game: think, then hold the landed dart (08-DartBot.md). */
export const BOT_PACING: BotPacing = Object.freeze({
  preThrowMs: 900,
  postThrowMs: 250,
});
```

`app/src/lib/game/play-lifecycle.ts`:
- delete line 294 `const QUICK_SCORE_PACING: BotPacing = { preThrowMs: 900, postThrowMs: 250 };`
- in `playAnimateBotDarts`'s signature change `pacing: BotPacing = QUICK_SCORE_PACING,` to `pacing: BotPacing = BOT_PACING,`
- add `import { BOT_PACING } from "@lib/game/play-bot-seat";` with the file's other `@lib/game/*` value imports.

If `BotPacing` is declared with mutable fields and `Object.freeze` returns `Readonly<…>` that `tsc` rejects for the annotation, keep the `BotPacing` annotation — `Readonly<T>` is assignable to `T` for plain object types; only change if `tsc` errors, and then annotate as `Readonly<BotPacing>`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/game/play-bot-seat.test.ts tests/lib/game/play-lifecycle.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Update the File Inventory row**

In `docs/architecture/00-File-Inventory.md:204`, change the row's opening from
`` `findBotSeat`/`botDartIndex`/`botQuickScoreDartIndex` — `` to
`` `findBotSeat`/`botDartIndex`/`botQuickScoreDartIndex`/`BOT_PACING` — `` and append before ` | canonical |`:
`` `BOT_PACING` is the one bot pacing every play-data thrower and `play-lifecycle.ts`'s QUICK_SCORE replay use (#916, 2026-10-20). ``

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/play-bot-seat.ts app/src/lib/game/play-lifecycle.ts \
  app/tests/lib/game/play-bot-seat.test.ts app/tests/lib/game/play-lifecycle.test.ts \
  docs/architecture/00-File-Inventory.md
git commit -m "refactor(game): share BOT_PACING from play-bot-seat

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW"
```

---

### Task 2: VISUAL_BOARD-only games drop their private bot helpers

**Files (each: modify source, modify its mirrored test):**
- `app/src/lib/game/around-the-clock-play.data.ts:212-217,262-266` / `app/tests/lib/game/around-the-clock-play.data.test.ts` (bot block `:910`)
- `app/src/lib/game/bobs27-play.data.ts:116-125,166-170` / `app/tests/lib/game/bobs27-play.data.test.ts` (DARTBOT seats `:990`)
- `app/src/lib/game/doubles-training-play.data.ts:97-106,152-156` / `app/tests/lib/game/doubles-training-play.data.test.ts` (DARTBOT seats: `grep -n DARTBOT`)
- `app/src/lib/game/shanghai-play.data.ts:174-183,224-228` / `app/tests/lib/game/shanghai-play.data.test.ts` (DARTBOT seats: `grep -n DARTBOT`)
- `app/src/lib/game/singles-training-play.data.ts:322-331,376-380` / `app/tests/lib/game/singles-training-play.data.test.ts` (bot block `:1589`)

Line numbers are from `main` at 76a35e93; re-check with `grep -n "BOT_PRE_THROW_MS\|BOT_POST_THROW_MS\|^type DartbotSeat\|^function botDartIndex\|^function findBotSeat" <file>` before editing.

**Interfaces:**
- Consumes: `findBotSeat`, `botDartIndex`, `BOT_PACING` from `@lib/game/play-bot-seat`; `DartbotSeat` from `@lib/types`.

- [ ] **Step 1: Write the failing test (one per file)**

In each of the five test files, inside its existing DartBot `describe` block (or next to its existing bot test), add a test that reuses **that file's own** first bot test's arrange lines (same `makePlay` call, same config with a DARTBOT seat, same human inputs that hand the turn to the bot):

```ts
  it("paces the bot's darts with the shared BOT_PACING", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    // ARRANGE: copy this file's first DartBot test's makePlay(...) + init + the
    // human inputs that end the human visit, verbatim.

    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      BOT_PACING.postThrowMs,
    );
    setTimeoutSpy.mockRestore();
  });
```

Add `import { BOT_PACING } from "@lib/game/play-bot-seat";` to each file. The ARRANGE comment is a placeholder for lines that already exist in the same file — replace it with them; the final test must have no comment left.

If the file's bot test runs under `vi.useFakeTimers()`, keep that and advance with `await vi.runAllTimersAsync()` before the `expect`, as its existing bot test does.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run tests/lib/game/around-the-clock-play.data.test.ts tests/lib/game/bobs27-play.data.test.ts tests/lib/game/doubles-training-play.data.test.ts tests/lib/game/shanghai-play.data.test.ts tests/lib/game/singles-training-play.data.test.ts -t "shared BOT_PACING"`
Expected: PASS is possible here — values are identical, so the spy already sees 250. That is acceptable for a no-behaviour refactor: the test pins the guarantee across the change. Confirm it **fails** by temporarily setting `BOT_PACING.postThrowMs`'s literal to `251` in `play-bot-seat.ts`, rerunning (expect FAIL in all five), then reverting to `250`. Record that in the PR's Verification section.

- [ ] **Step 3: Delete the private copies in each source file**

Remove, in each of the five files:

```ts
const BOT_PRE_THROW_MS = 900;
const BOT_POST_THROW_MS = 250;

type DartbotSeat = Extract<SeatFact, { participantTypeKey: "DARTBOT" }>;

function botDartIndex(turns: readonly TurnFact[], botRef: string): number {
  return turns
    .filter((turn) => turn.participantRef === botRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}
```

and

```ts
function findBotSeat(seats: readonly SeatFact[]): DartbotSeat | undefined {
  return seats.find(
    (seat): seat is DartbotSeat => seat.participantTypeKey === "DARTBOT",
  );
}
```

Replace the thrower's return field

```ts
    pacing: { preThrowMs: BOT_PRE_THROW_MS, postThrowMs: BOT_POST_THROW_MS },
```

with

```ts
    pacing: BOT_PACING,
```

Add at the top of each file:

```ts
import { BOT_PACING, botDartIndex, findBotSeat } from "@lib/game/play-bot-seat";
```

and add `DartbotSeat` to the file's existing `import type { … } from "@lib/types";` (bobs27 and doubles-training already import `RulesetVersionKey, SeatFact` from there; around-the-clock, shanghai, singles-training import `SeatFact` inside a larger `@lib/types` block — add it there).

Then drop now-unused type names (Review Focus 1): remove `SeatFact` from all five files' imports; remove `TurnFact` from `doubles-training-play.data.ts` only. Verify with `grep -c '\bSeatFact\b\|\bTurnFact\b'` per file — any name whose only remaining hit is its import line goes.

- [ ] **Step 4: Run the five suites**

Run: `npx vitest run tests/lib/game/around-the-clock-play.data.test.ts tests/lib/game/bobs27-play.data.test.ts tests/lib/game/doubles-training-play.data.test.ts tests/lib/game/shanghai-play.data.test.ts tests/lib/game/singles-training-play.data.test.ts`
Expected: PASS, all tests (including every pre-existing one, unchanged).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/{around-the-clock,bobs27,doubles-training,shanghai,singles-training}-play.data.ts \
  app/tests/lib/game/{around-the-clock,bobs27,doubles-training,shanghai,singles-training}-play.data.test.ts
git commit -m "refactor(game): visual-board play data uses shared bot helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW"
```

---

### Task 3: QUICK_SCORE-capable games drop their private bot helpers

**Files (each: modify source, modify its mirrored test):**
- `app/src/lib/game/five-oh-one-play.data.ts:124-140` / `app/tests/lib/game/five-oh-one-play.data.test.ts` (VISUAL_BOARD bot test `:1715`)
- `app/src/lib/game/one-twenty-one-play.data.ts:77-92` / `app/tests/lib/game/one-twenty-one-play.data.test.ts` (bot block `:1221`)
- `app/src/lib/game/score-training-play.data.ts:81-82` / `app/tests/lib/game/score-training-play.data.test.ts` (bot block `:2293`)
- `app/src/lib/game/tuod-play.data.ts:87-88` / `app/tests/lib/game/tuod-play.data.test.ts` (bot block `:1909`)

**Interfaces:**
- Consumes: `findBotSeat`, `botDartIndex`, `botQuickScoreDartIndex`, `BOT_PACING` from `@lib/game/play-bot-seat`; `DartbotSeat` from `@lib/types`.

Per-file deltas:

| File | Delete | Import change |
| --- | --- | --- |
| five-oh-one | `BOT_PRE_THROW_MS`, `BOT_POST_THROW_MS`, `type DartbotSeat`, `findBotSeat`, `botDartIndex` | line 1 becomes `import { BOT_PACING, botDartIndex, botQuickScoreDartIndex, findBotSeat } from "@lib/game/play-bot-seat";`; add `DartbotSeat` to its `@lib/types` type import; keep `SeatFact` (still used at `:215`) |
| one-twenty-one | same five | same line-1 change; add `DartbotSeat` to `import type { RulesetVersionKey, SeatFact } from "@lib/types";` then drop `SeatFact` if its count falls to 1 |
| score-training | `BOT_PRE_THROW_MS`, `BOT_POST_THROW_MS` | add `BOT_PACING` to the existing `@lib/game/play-bot-seat` import block |
| tuod | `BOT_PRE_THROW_MS`, `BOT_POST_THROW_MS` | add `BOT_PACING` to the existing `@lib/game/play-bot-seat` import block |

In all four, `pacing: { preThrowMs: BOT_PRE_THROW_MS, postThrowMs: BOT_POST_THROW_MS },` becomes `pacing: BOT_PACING,`. `DARTS_PER_VISIT` stays.

- [ ] **Step 1: Write the failing test (one per file)**

Same test as Task 2 Step 1, placed in each file's existing bot `describe`. The arrange must put the session under `inputModeKey: "VISUAL_BOARD"` (the path that uses the thrower's `pacing`); copy it from that file's existing VISUAL_BOARD bot test. If a file has no VISUAL_BOARD bot test, use its QUICK_SCORE bot test arrange instead — `playAnimateBotDarts` now defaults to `BOT_PACING`, so the spy assertion holds there too. These files use `vi.runAllTimersAsync()`; call it before the `expect`.

- [ ] **Step 2: Verify the tests can fail**

Run: `npx vitest run tests/lib/game/five-oh-one-play.data.test.ts tests/lib/game/one-twenty-one-play.data.test.ts tests/lib/game/score-training-play.data.test.ts tests/lib/game/tuod-play.data.test.ts -t "shared BOT_PACING"`
Then the same `251` probe as Task 2 Step 2: expect FAIL in all four, revert to `250`.

- [ ] **Step 3: Apply the per-file deltas** from the table above.

- [ ] **Step 4: Run the four suites**

Run: `npx vitest run tests/lib/game/five-oh-one-play.data.test.ts tests/lib/game/one-twenty-one-play.data.test.ts tests/lib/game/score-training-play.data.test.ts tests/lib/game/tuod-play.data.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/{five-oh-one,one-twenty-one,score-training,tuod}-play.data.ts \
  app/tests/lib/game/{five-oh-one,one-twenty-one,score-training,tuod}-play.data.test.ts
git commit -m "refactor(game): quick-score play data uses shared bot helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW"
```

---

### Task 4: Gates, dupes check, PR

**Files:** none new.

- [ ] **Step 1: Confirm nothing private is left**

Run (from repo root):
```bash
grep -n "BOT_PRE_THROW_MS\|BOT_POST_THROW_MS\|QUICK_SCORE_PACING\|^type DartbotSeat\|^function findBotSeat\|^function botDartIndex" app/src/lib/game/*.ts
```
Expected: no output.

- [ ] **Step 2: Full suite + type gates**

From `app/`: `npm test`, then `npx astro check --minimumFailingSeverity hint`.
Expected: all tests pass; astro check 0 errors, 0 warnings, 0 hints.

- [ ] **Step 3: Fallow**

From repo root: `bash scripts/fallow-gate.sh`, then `cd app && npx fallow dupes --mode mild | grep -E "play\.data|play-bot-seat"`.
Expected: gate passes; the `botDartIndex`/`findBotSeat`/pacing clone groups (e.g. `bobs27-play.data.ts:121-124`, `play-bot-seat.ts:12-18`) are gone. Larger groups (`throwOneDart`, `undoVisit`) remain — PR B's scope.

- [ ] **Step 4: Structural gates and format**

From repo root: `for s in scripts/check-*.sh; do bash "$s" || echo "FAIL $s"; done`; from `app/`: `npm run format && npm run format:check`.
Expected: no `FAIL` lines; format clean. Commit any formatter diff.

- [ ] **Step 5: Context maintenance**

Run the `context-maintenance` skill. Expected: the File Inventory row from Task 1 is the only doc change; no decision block (pure refactor).

- [ ] **Step 6: Push and open the PR**

Per `finishing-a-dart-branch` (Option 2): `git push -u origin refactor/916-play-engine-dedupe`, then open a PR against `main` using `.github/pull_request_template.md`. Body notes: "Part of the #916 follow-up (spec `docs/superpowers/specs/2026-10-20-916-play-engine-dedupe-design.md`, PR A of A–D)", the `BOT_PACING` deviation, and the `251` probe result. Ends with the session attribution lines.
