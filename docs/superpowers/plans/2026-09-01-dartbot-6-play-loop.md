# DartBot Phase 6: The Play Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Provenance note (added 2026-09-02, `FINDINGS.md` F52):** this file was reconstructed after the fact from phase 6's own shipped commits (`593efc3`, `1325309`, `41d853d`, `853a417` on `main`) and the narrative `decisions/game-engine.md` D252 and `docs/architecture/00-Context-Map-History.md`'s 1.34.0 entry already recorded. Both of those cite this exact path; the file itself was never committed when phase 6 shipped, only its result. Task/step content below matches what was actually built, verified against the real diffs — it is not a hypothetical retrofit.

**Goal:** Build the generic mechanism `08-DartBot.md` §The Play Loop specifies — the trigger, the `botThrowing`/post-delay re-entrancy guards, `undoToActiveSeat()`, and the QUICK_SCORE scratch-engine fold — once in `play-lifecycle.ts`, then wire it onto Bob's 27 as the first live consumer, so a seated `DARTBOT` opponent actually throws.

**Architecture:** Four contracts that are one mechanism seen from four angles (per the design doc, since undo must pop more than one turn *because* the trigger re-throws immediately, the trigger needs a post-delay re-check *because* undo can land inside the pacing window, and the visit fold needs a second engine *because* the strategy re-targets between darts): `undoToActiveSeat` crosses the seat boundary on undo; `playRunBotVisualBoardVisit` drives one real dart at a time under VISUAL_BOARD behind two re-entrancy guards; `playFoldBotQuickScoreVisit` folds a QUICK_SCORE bot visit through a throwaway scratch engine so the real engine is never told about darts mid-visit; Bob's 27's own play data wires phases 1–3's shipped throw pipeline into all three. No `DartBot` class is needed — phases 1–3's functions compose directly, the same way `play-dictated-session.ts`'s test harness already showed for a solo bot.

**Tech Stack:** TypeScript, Vitest, Alpine.js (`app/`), no new dependencies.

## Global Constraints

- Every changed runtime `.ts` file under `app/src/` needs a covering test edit or `scripts/check-test-coverage.sh` fails (D224).
- No `//`/`/* */` comments inside function/method bodies in `app/src/**/*.ts`; JSDoc above declarations only.
- A type used by more than one file is declared once in a `types.ts` barrel, never inline — `scripts/check-type-barrels.sh` rejects an inline `export type` inside a `.ts` file that isn't one.
- `npm run format` clean, zero-hint `astro check`, all 14 structural pre-commit gates green — full bar is `npm run validate:app`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `app/src/lib/game/play-lifecycle.ts` | `undoToActiveSeat`, `playRunBotVisualBoardVisit`, `playFoldBotQuickScoreVisit` — the three generic mechanisms (Tasks 1–3) |
| `app/src/lib/game/types.ts` | `BotPacing`, `BotDartThrower`, `BotQuickScoreFold`; `Bobs27PlayContext.botThrowing`/`maybeRunBotVisit` (Tasks 2, 3, 4) |
| `app/src/lib/game/bobs27-play.data.ts` | Wires the real phase 1–3 throw pipeline into the loop; `maybeRunBotVisit`, undo branch, `init`/`commitDart` hooks (Task 4) |
| `app/tests/lib/game/play-lifecycle.test.ts` | Coverage for all three `play-lifecycle.ts` exports (Tasks 1–3) |
| `app/tests/lib/game/bobs27-play.data.test.ts` | Coverage for the Bob's 27 wiring (Task 4) |

---

### Task 1: `undoToActiveSeat`

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts`
- Test: `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Produces: `undoToActiveSeat<TConfig, TEngine extends GameEngine<DartObservation, MultiSeatState>, TResults>(context, participantRef: string): void`.

- [x] **Step 1: Write the failing tests**

`describe("undoToActiveSeat", ...)` — six cases: pops exactly one turn in a solo session (matching `playUndoVisit` exactly, the regression anchor); pops until the human's own seat is active again, skipping the bot's turn; pops through consecutive bot turns to reach the human's seat; undoing into an empty log leaves the seat the fact log implies, even when that is the human's; does nothing once the session is finished; clears the hidden-turn timer and mirrors facts into the store, like `playUndoVisit`.

- [x] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts -t "undoToActiveSeat"`
Expected: FAIL — export does not exist.

- [x] **Step 3: Implement**

```ts
// app/src/lib/game/play-lifecycle.ts
/**
 * Pops visits until `participantRef`'s own seat is active again, or the fact
 * log is empty. Always pops at least once, even when that seat is already
 * active — a solo session's only seat never stops being active, so a loop
 * that pops only *while* it is not would pop nothing at all, and the undo
 * button would go dead in every solo session in the app. Existing single-pop
 * callers (`playUndoVisit`, every non-bot page) are unaffected: this is a new
 * export, not a change to that one.
 */
export function undoToActiveSeat<
  TConfig,
  TEngine extends GameEngine<DartObservation, MultiSeatState>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  participantRef: string,
): void {
  if (context.finished) return;
  const engine = context.engine;
  if (!engine) return;
  if (!engine.undo()) return;
  while (
    engine.facts().turns.length > 0 &&
    engine.state().activeParticipantRef !== participantRef
  ) {
    if (!engine.undo()) break;
  }
  clearHiddenTimer(context);
  context.$store.game.recordFacts(engine.facts());
  context.error = "";
}
```

Add `MultiSeatState` to the `@modules/types` import list.

- [x] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts -t "undoToActiveSeat"`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git commit -m "feat: add undoToActiveSeat so undo crosses the seat boundary to the human"
```

---

### Task 2: `playRunBotVisualBoardVisit`

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts`
- Modify: `app/src/lib/game/types.ts`
- Test: `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Consumes: `BotDartThrower = () => { observation: DartObservation; pacing: BotPacing }` (new, `types.ts`).
- Produces: `playRunBotVisualBoardVisit<TConfig, TEngine extends GameEngine<DartObservation, MultiSeatState>, TResults>(context: PlayLifecycleContext<...> & { botThrowing: boolean }, botParticipantRef: string, throwDart: BotDartThrower, wait?: (ms: number) => Promise<void>): Promise<void>`.

- [x] **Step 1: Write the failing tests**

`describe("playRunBotVisualBoardVisit", ...)`: throws darts for the bot until the active seat is no longer the bot's; waits `preThrowMs` then `postThrowMs` around the recorded dart, in order; does nothing when it is not the bot's turn; re-entrancy guard 1 — a second concurrent call is a no-op while one is already running; re-entrancy guard 2 — aborts without recording if the active seat changed during the pre-throw delay; two trigger fires for one turn append exactly one turn (guard 1 makes the second a no-op).

- [x] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts -t "playRunBotVisualBoardVisit"`
Expected: FAIL — export and its supporting types do not exist.

- [x] **Step 3: Implement**

```ts
// app/src/lib/game/types.ts — new
/**
 * Timing hints for one bot dart, derived from the same situation state the
 * pressure model will eventually read (`08-DartBot.md` §Pacing). The page
 * honours or ignores these; `play-lifecycle.ts` owns no timer and reads no
 * clock itself.
 */
export type BotPacing = {
  preThrowMs: number;
  postThrowMs: number;
};

/**
 * What a play page hands `playRunBotVisualBoardVisit` for each dart: the
 * next simulated dart plus how long to wait around it. Kept independent of
 * `modules/dartbot/*` so `play-lifecycle.ts` never imports it — the page is
 * what wires a real thrower to this shape (this phase's last task), and a
 * test can satisfy it with a plain stub, as this file's own tests do.
 */
export type BotDartThrower = () => {
  observation: DartObservation;
  pacing: BotPacing;
};
```

```ts
// app/src/lib/game/play-lifecycle.ts
function defaultBotWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drives the bot's whole visit under `VISUAL_BOARD`: one real `playCommitDart`
 * call per dart, for as long as the engine's own active seat stays the bot's.
 * The loop condition is what makes "the bot can hold consecutive turns"
 * (score-compare, one seat finished) and "the bot may have opened the leg"
 * both fall out for free — neither is special-cased here.
 *
 * Two re-entrancy guards, both required (`08-DartBot.md` §Re-entrancy):
 * `context.botThrowing` makes a second concurrent call for the same trigger
 * a no-op, and the active-seat re-check right after `wait(pacing.preThrowMs)`
 * — before recording — abandons the throw if a user action (most likely
 * `undoToActiveSeat`) moved the active seat away from the bot during the
 * delay. Guard 2 is load-bearing on its own; guard 1 only prevents two
 * *overlapping* loops from both reaching guard 2's window at once.
 */
export async function playRunBotVisualBoardVisit<
  TConfig,
  TEngine extends GameEngine<DartObservation, MultiSeatState>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults> & {
    botThrowing: boolean;
  },
  botParticipantRef: string,
  throwDart: BotDartThrower,
  wait: (ms: number) => Promise<void> = defaultBotWait,
): Promise<void> {
  if (context.botThrowing || !context.engine) return;
  if (context.engine.state().activeParticipantRef !== botParticipantRef) return;

  context.botThrowing = true;
  try {
    while (
      !context.finished &&
      context.engine.state().activeParticipantRef === botParticipantRef
    ) {
      const { observation, pacing } = throwDart();
      await wait(pacing.preThrowMs);
      if (
        context.finished ||
        context.engine.state().activeParticipantRef !== botParticipantRef
      ) {
        return;
      }
      await playCommitDart(context, observation);
      await wait(pacing.postThrowMs);
    }
  } finally {
    context.botThrowing = false;
  }
}
```

- [x] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts -t "playRunBotVisualBoardVisit"`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git commit -m "feat: add playRunBotVisualBoardVisit with the botThrowing and pacing-delay re-entrancy guards"
```

---

### Task 3: `playFoldBotQuickScoreVisit`

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts`
- Modify: `app/src/lib/game/types.ts`
- Test: `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Produces: `BotQuickScoreFold = { totalScore: number; dartsThrown: number }` (new, `types.ts`); `playFoldBotQuickScoreVisit<TConfig, TInput, TState>(factory: GameEngineFactory<TConfig, TInput, TState>, config: TConfig, facts: EngineFacts, throwDart: () => DartObservation, dartsPerVisit: number): BotQuickScoreFold`.

- [x] **Step 1: Write the failing tests**

`describe("playFoldBotQuickScoreVisit", ...)`, against `scoreTrainingEngineFactory` (proven at the engine level — no live QUICK_SCORE page consumer exists yet, `501_V1` phase 7's to wire): folds three simulated darts into one visit total without touching the real engine; recording the folded total on the real engine writes one turn with `darts: []`; stops early once the scratch engine reports the visit complete.

- [x] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts -t "playFoldBotQuickScoreVisit"`
Expected: FAIL — export does not exist.

- [x] **Step 3: Implement**

```ts
// app/src/lib/game/types.ts — new
/**
 * The result of folding a QUICK_SCORE bot visit through a scratch engine
 * (`playFoldBotQuickScoreVisit`) — just enough for the real caller's own
 * `record()` input, never the scratch engine's per-dart facts.
 */
export type BotQuickScoreFold = {
  totalScore: number;
  dartsThrown: number;
};
```

```ts
// app/src/lib/game/play-lifecycle.ts
/**
 * Feeds `throwDart`'s darts into a throwaway instance of the same ruleset,
 * built from `facts` exactly as a page's own `resumeEngine` rehydrates one —
 * `08-DartBot.md` §The Play Loop's "a scratch engine, never arithmetic in
 * the adapter". The scratch engine is discarded when this returns; only its
 * final visit's `totalScore`/`darts.length` survive, so a QUICK_SCORE bot
 * visit's coordinates never reach any caller.
 *
 * `throwDart` always returns a `DartObservation` — the bot throws three real
 * darts internally under every capture mode (§Strategy Layer and Game
 * Coverage) — so the cast below asserts only that every ruleset's own input
 * union already includes `DartObservation` as one of its variants, which
 * `isDartObservationInput` (`turn-log.module.ts`, D241) exists to prove true
 * for every registered engine.
 */
export function playFoldBotQuickScoreVisit<TConfig, TInput, TState>(
  factory: GameEngineFactory<TConfig, TInput, TState>,
  config: TConfig,
  facts: EngineFacts,
  throwDart: () => DartObservation,
  dartsPerVisit: number,
): BotQuickScoreFold {
  const scratch = factory.create(config, facts);
  for (let i = 0; i < dartsPerVisit && !scratch.isComplete(); i++) {
    scratch.record(throwDart() as TInput);
  }
  const visitTurn = scratch.facts().turns.at(-1)!;
  return {
    totalScore: visitTurn.totalScore,
    dartsThrown: visitTurn.darts.length,
  };
}
```

Add `GameEngineFactory` to the `@modules/interfaces` import and `BotQuickScoreFold` to the `./types` import.

- [x] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts -t "playFoldBotQuickScoreVisit"`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git commit -m "feat: add playFoldBotQuickScoreVisit, the QUICK_SCORE scratch-engine visit fold"
```

---

### Task 4: Wire the play loop onto Bob's 27

**Files:**
- Modify: `app/src/lib/game/bobs27-play.data.ts`
- Modify: `app/src/lib/game/types.ts` (`Bobs27PlayContext`)
- Test: `app/tests/lib/game/bobs27-play.data.test.ts`

**Interfaces:**
- Consumes: `playRunBotVisualBoardVisit`/`undoToActiveSeat` (Tasks 1–2); `skillProfileForLevel` (`@modules/dartbot/skill-profile.module`), `createDartRng` (`@modules/dartbot/rng.module`), `throwDart` (`@modules/dartbot/throw-engine.module`), `chooseTarget` (`@modules/dartbot/strategy/dictated.strategy.module`) — the shipped phase 1–3 pipeline.
- Produces: `Bobs27PlayContext.botThrowing: boolean`; `maybeRunBotVisit(this: Bobs27PlayContext): Promise<void>`.

- [x] **Step 1: Write the failing tests**

`describe("bobs27Play — DartBot opponent", ...)`: throws automatically once it becomes the bot's turn, without any UI action; `undoVisit` returns control to the human across the bot's own turn.

- [x] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts -t "DartBot opponent"`
Expected: FAIL — `maybeRunBotVisit`/`botThrowing` do not exist yet.

- [x] **Step 3: Implement**

Add to `Bobs27PlayContext` (`types.ts`): `botThrowing: boolean;` and `maybeRunBotVisit(this: Bobs27PlayContext): Promise<void>;`; widen `undoVisit(this: Bobs27PlayContext): void` to `Promise<void>`.

```ts
// app/src/lib/game/bobs27-play.data.ts — new imports
import {
  // ...existing...
  playRunBotVisualBoardVisit,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { throwDart as botThrowDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";
import type { RulesetVersionKey, SeatFact } from "@lib/types";
import type { BoardMarker, BotDartThrower, BotPacing } from "./types";
```

```ts
const BOT_PRE_THROW_MS = 900;
const BOT_POST_THROW_MS = 250;

type DartbotSeat = Extract<SeatFact, { participantTypeKey: "DARTBOT" }>;

function botDartIndex(turns: readonly TurnFact[], botRef: string): number {
  return turns
    .filter((turn) => turn.participantRef === botRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}

/**
 * The real per-dart thrower: phases 1–3's shipped pipeline (skill curve,
 * seeded RNG, dictated strategy, throw engine), combined the same way
 * `play-dictated-session.ts`'s test harness already does for a solo bot.
 * `dartIndex` is re-derived from the fact log on every call — never held on
 * this closure — so an undone bot visit re-throws identically from the same
 * seed (`08-DartBot.md` §Determinism and Replay).
 */
function throwBotDart(
  context: Bobs27PlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  const state = context.state();
  const seatState = state?.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  );
  if (!state || !seatState) {
    throw new Error("DartBot has no seat in this session's engine state");
  }
  const profile = skillProfileForLevel(botSeat.dartbot.level);
  const dartIndex = botDartIndex(
    context.$store.game.turns,
    botSeat.participantRef,
  );
  const rng = createDartRng(botSeat.dartbot.seed, dartIndex);
  const target = targetAt(doublesPath(), seatState.targetIndex);
  const intent = chooseTarget({ target });
  const thrown = botThrowDart(intent, profile, rng);
  return {
    observation: {
      hitTargetNumber: thrown.hit.targetNumber,
      hitZoneKey: thrown.hit.zoneKey,
      locationX: thrown.landing.x,
      locationY: thrown.landing.y,
    },
    pacing: { preThrowMs: BOT_PRE_THROW_MS, postThrowMs: BOT_POST_THROW_MS },
  };
}

function findBotSeat(seats: readonly SeatFact[]): DartbotSeat | undefined {
  return seats.find(
    (seat): seat is DartbotSeat => seat.participantTypeKey === "DARTBOT",
  );
}
```

In the returned factory object: add `botThrowing: false` beside the other booleans; `init` becomes `async` and calls `await this.maybeRunBotVisit()` after `playInit`; `commitDart` becomes `async` and calls `await this.maybeRunBotVisit()` after `playCommitDart`; add:

```ts
async maybeRunBotVisit(this: Bobs27PlayContext) {
  const botSeat = findBotSeat(this.$store.game.seats);
  if (!botSeat) return;
  const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
  await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
},

async undoVisit(this: Bobs27PlayContext) {
  const botSeat = findBotSeat(this.$store.game.seats);
  if (botSeat) {
    const humanSeat = this.$store.game.seats.find(
      (seat) => seat.participantTypeKey === "PLAYER",
    )!;
    undoToActiveSeat(this, humanSeat.participantRef);
  } else {
    playUndoVisit(this);
  }
  await this.maybeRunBotVisit();
},
```

- [x] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts`
Expected: PASS

- [x] **Step 5: Full suite, fallow, and gates**

Run: `cd app && npx vitest run && npx fallow`
Expected: 3247/3247 across 157 files; `fallow` exits 0 (maintainability 92.0, 0 above threshold).

- [x] **Step 6: Commit**

```bash
git commit -m "feat: wire the DartBot play loop onto Bob's 27 — a seated bot now actually throws"
```

---

### Task 5: Validation and context maintenance

- [x] **Step 1: Full validation**

`astro check --minimumFailingSeverity hint`: 0 errors/0 warnings/0 hints. `check-context-map.sh`/`check-doc-links.sh`/`check-context-budget.sh`/`check-agent-mirrors.sh`/`check-file-locations.sh`/`check-findings-log.sh`/`check-test-coverage.sh`/`check-decision-ids.sh` and all ten `app/`-scoped structural gates plus `check-constraint-mirror.sh`: pass. `db:status`/`db:migrate`/`db:introspect` could not run (no `DATABASE_URL`/Neon credentials in the sandboxed session that shipped this phase — the established D193 precedent; this phase added no migration).

- [x] **Step 2: Record the decision**

Append D252 to `decisions/game-engine.md`: the two reusability choices — an injected `BotDartThrower` rather than a `DartBot`-class or `modules/dartbot/*` dependency in `play-lifecycle.ts`, and the fold's ruleset-agnostic `{ totalScore, dartsThrown }` return shape.

- [x] **Step 3: Context maintenance**

Append the 1.34.0 entry to `docs/architecture/00-Context-Map-History.md`; update `00-File-Inventory.md` rows for `08-DartBot.md`, `decisions/game-engine.md`, `bobs27-play.data.ts`, `play-lifecycle.ts`; close the delivery gap in `08-DartBot.md` itself (§The Play Loop, the dependency table's play-loop row, the version-history preamble).

- [x] **Step 4: Manual verification note**

Manual in-browser verification (seating a bot on Bob's 27, confirming the automatic throw and undo-crosses-the-bot behavior) could not be exercised in this sandbox: the dev server serves pages at 200, but every session-creating API call returns `401 UNAUTHORIZED` with no Neon Auth backend configured — the same D193 root cause extended to auth, exactly as phase 4's own manual-verification note already established for the setup-screen chooser. A human with a working local/Neon environment must run through Bob's 27 with a seated `DARTBOT` opponent before merge and confirm: the bot throws automatically with a visible pause; undo mid-"thinking" does not record the pending dart; one undo press after the bot's visit returns control to the human.
