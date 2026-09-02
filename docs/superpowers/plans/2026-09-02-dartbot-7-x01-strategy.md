# DartBot Phase 7: X01Strategy — 501 Opponent Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seat a `DARTBOT` opponent in 501 (`501_V1`), the first ruleset whose bot needs a real decision — checkout routing — rather than a dictated target, and reach the phase's own gate: alternating-turn play to a decided outcome in one `SHARED` leg, under both `VISUAL_BOARD` and `QUICK_SCORE` capture.

**Architecture:** A new `x01.strategy.module.ts` picks a `ThrowIntent` from a flattened `X01View { remaining, checkoutPath }`, where `checkoutPath` is `checkoutPathFor(remaining)` computed by the page adapter (never by `modules/dartbot/*`, which may not import ruleset math) and re-derived fresh before every dart — so the bot always aims at the first step of whatever route the *current* remaining supports, self-correcting after a miss with no visit-scoped state anywhere. A new `decisionQuality` skill axis (0–100, hand-set per level like every other axis) gates whether the strategy trusts a route at all: below a threshold it always fires at treble 20, exactly as `08-DartBot.md` §Decision degrades too's "low" tier describes. `VISUAL_BOARD` wiring reuses `playRunBotVisualBoardVisit` unchanged (mirrors Bob's 27, phase 6). `QUICK_SCORE` wiring needs one real change: `playFoldBotQuickScoreVisit`'s `throwDart` callback is widened from `() => DartObservation` to `(state: TState) => DartObservation` so the strategy can read the scratch engine's own live remaining between darts — the first QUICK_SCORE consumer whose target genuinely depends on it (Score Training, the only other QUICK_SCORE ruleset, has no bot strategy at all).

**Tech Stack:** TypeScript, Vitest, Astro/Alpine (`app/`), no new dependencies.

## Global Constraints

- Every changed runtime `.ts` file under `app/src/` needs a covering test edit or `scripts/check-test-coverage.sh` fails (D224).
- `modules/dartbot/*` may import only `@lib/game/board/*`, `@modules/game/types`, `@utils` — never `@lib/game/rulesets/*`, `@modules/game/checkout-path.module`, or any engine (`08-DartBot.md` §Import direction). `checkoutPathFor()` is called by the page adapter, never by the strategy module.
- No `//`/`/* */` comments inside function/method bodies in `app/src/**/*.ts`; JSDoc above declarations only.
- `npx fallow` must stay green — keep new functions small and flat (see `FINDINGS.md` F50/F48 for the failure mode: interleaved ternaries trip the complexity gate; prefer early returns).
- `npm run format` clean, zero-hint `astro check`, all 14 structural pre-commit gates green — full bar is `npm run validate:app` (`validate-app` skill).
- This plan does not touch calibration (D-E), pressure/form (phase 9), or "setup shots that leave a preferred double" (the high-tier nuance in §Decision degrades too) — see Task 4's design note for why that specific behavior is deliberately out of scope for this phase's gate.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `app/src/lib/game/rulesets/capabilities.ts` | Flip `RULESET_DARTBOT.501_V1` to `true` (Task 1) |
| `app/src/modules/dartbot/types.ts` | Add `decisionQuality` to `SkillProfile` (Task 2) |
| `app/src/modules/dartbot/skill-profile.module.ts` | Add a `decisionQuality` value to every level's row in `LEVEL_SKILL_TABLE` (Task 2) |
| `app/src/modules/dartbot/interfaces.ts` | Add `X01View` (Task 3) |
| `app/src/modules/dartbot/strategy/x01.strategy.module.ts` | New — `chooseTarget(view, decisionQuality)`: checkout-label parsing + tier gate (Task 3) |
| `app/src/lib/game/play-lifecycle.ts` | Widen `playFoldBotQuickScoreVisit`'s `throwDart` to take the scratch engine's `state()` (Task 4) |
| `app/src/lib/game/types.ts` | Widen `BotQuickScoreFold`'s thrower type; add `botThrowing` to `FiveOhOnePlayContext` (Task 4, Task 5) |
| `app/src/lib/game/five-oh-one-play.data.ts` | Bot seat wiring: `maybeRunBotVisit`, VISUAL_BOARD and QUICK_SCORE throwers, undo-crosses-seat branch (Task 5) |
| `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro` | `allowDartbot={supportsDartbot("501_V1")}` — the existing D-J chooser, no new component (Task 6) |
| `app/tests/**` mirrors of every file above | One test file per changed source file (Tasks 1–6) |
| `app/tests/modules/dartbot/harness/five-oh-one-dartbot-seat.contract.test.ts` | New — end-to-end SHARED-leg 1v1 match under both capture modes (Task 7) |

---

### Task 1: Admit `501_V1` into `RULESET_DARTBOT`

**Files:**
- Modify: `app/src/lib/game/rulesets/capabilities.ts`
- Test: `app/tests/lib/game/rulesets/capabilities.test.ts`

**Interfaces:**
- Produces: `supportsDartbot("501_V1") === true`, unchanged signature.

- [ ] **Step 1: Write the failing tests**

Replace the two capabilities tests that currently assert 501 is excluded:

```ts
// app/tests/lib/game/rulesets/capabilities.test.ts
describe("RULESET_DARTBOT", () => {
  it("admits the four rulesets whose bot strategy exists today", () => {
    expect(
      (Object.keys(RULESET_DARTBOT) as (keyof typeof RULESET_DARTBOT)[])
        .filter((key) => RULESET_DARTBOT[key])
        .sort(),
    ).toEqual([
      "501_V1",
      "AROUND_THE_CLOCK_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
    ]);
  });
});

describe("supportsDartbot", () => {
  // ...unchanged BOBS27_V1 / AROUND_THE_CLOCK_V1 / DOUBLES_TRAINING_V1 cases...

  it("accepts 501, now that X01Strategy exists (phase 7)", () => {
    expect(supportsDartbot("501_V1")).toBe(true);
  });

  it("rejects Shanghai V2 and Singles V2 (F45 — 1v1 seating is already broken there)", () => {
    expect(supportsDartbot("SHANGHAI_V2")).toBe(false);
    expect(supportsDartbot("SINGLES_V2")).toBe(false);
  });

  it("rejects a ruleset absent from the map", () => {
    expect(supportsDartbot("SCORE_TRAINING_V1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: FAIL — `RULESET_DARTBOT` test's array is missing `"501_V1"`; the new `supportsDartbot("501_V1")` test expects `true` but gets `false`.

- [ ] **Step 3: Flip the flag**

```ts
// app/src/lib/game/rulesets/capabilities.ts
export const RULESET_DARTBOT: Readonly<
  Partial<Record<RulesetVersionKey, boolean>>
> = {
  AROUND_THE_CLOCK_V1: true,
  BOBS27_V1: true,
  DOUBLES_TRAINING_V1: true,
  501_V1: true,
};
```

Update the doc comment above it (currently says "Only three are listed here... 501, 121 and Score Training have no bot strategy at all yet — `X01Strategy` lands phase 7") to read "Four are listed here... 121 and Score Training still have no bot strategy" and drop the now-stale "lands phase 7" clause.

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/rulesets/capabilities.ts app/tests/lib/game/rulesets/capabilities.test.ts
git commit -m "feat: admit 501_V1 into RULESET_DARTBOT

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9"
```

---

### Task 2: `decisionQuality` skill axis

**Files:**
- Modify: `app/src/modules/dartbot/types.ts`
- Modify: `app/src/modules/dartbot/skill-profile.module.ts`
- Test: `app/tests/modules/dartbot/skill-profile.module.test.ts`

**Interfaces:**
- Produces: `SkillProfile.decisionQuality: number` (0–100, higher is better), populated for every level 1–15; `skillProfileForLevel(level).decisionQuality` readable by Task 3's strategy.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/modules/dartbot/skill-profile.module.test.ts — add to the existing describe block
it("decisionQuality rises monotonically from level 1 to 15 and stays in 0..100", () => {
  let prior = -1;
  for (let level = 1; level <= 15; level++) {
    const { decisionQuality } = skillProfileForLevel(level);
    expect(decisionQuality).toBeGreaterThan(prior);
    expect(decisionQuality).toBeGreaterThanOrEqual(0);
    expect(decisionQuality).toBeLessThanOrEqual(100);
    prior = decisionQuality;
  }
});

it("level 15 tops out at 100", () => {
  expect(skillProfileForLevel(15).decisionQuality).toBe(100);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/modules/dartbot/skill-profile.module.test.ts`
Expected: FAIL — TypeScript error, `decisionQuality` does not exist on `SkillProfile` / is `undefined`.

- [ ] **Step 3: Add the field and populate the table**

```ts
// app/src/modules/dartbot/types.ts — extend SkillProfile
export type SkillProfile = {
  sigmaAlongMm: number;
  sigmaAcrossMm: number;
  covarianceRotationDegrees: number;
  biasXMm: number;
  biasYMm: number;
  outlierRate: number;
  outlierSigmaMm: number;
  bedOffsetMm: number;
  bounceOutRate: number;
  deflectionRadiusMm: number;
  /**
   * `0..100`, D-D's decision axis (`08-DartBot.md` §Decision degrades too) —
   * how well the bot routes a checkout versus always firing at the biggest
   * number. `x01.strategy.module.ts` is the first consumer; every other
   * strategy today dictates its own target and never reads this field.
   */
  decisionQuality: number;
};
```

Add one `decisionQuality` entry per level to `LEVEL_SKILL_TABLE` in `app/src/modules/dartbot/skill-profile.module.ts` (one line added inside each of the 15 object literals, same hand-set-prior status as every other field there):

```
level  1:  7   level  6: 40   level 11: 73
level  2: 13   level  7: 47   level 12: 80
level  3: 20   level  8: 53   level 13: 87
level  4: 27   level  9: 60   level 14: 93
level  5: 33   level 10: 67   level 15: 100
```

(`decisionQuality: Math.round((level / 15) * 100)`, written as literals to match the table's existing style — every other field there is a literal, not a formula.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/modules/dartbot/skill-profile.module.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/dartbot/types.ts app/src/modules/dartbot/skill-profile.module.ts app/tests/modules/dartbot/skill-profile.module.test.ts
git commit -m "feat: add the decisionQuality skill axis (D-D)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9"
```

---

### Task 3: `X01Strategy` — `chooseTarget`

**Files:**
- Modify: `app/src/modules/dartbot/interfaces.ts`
- Create: `app/src/modules/dartbot/strategy/x01.strategy.module.ts`
- Test: `app/tests/modules/dartbot/strategy/x01.strategy.module.test.ts`

**Interfaces:**
- Consumes: `ThrowIntent` (`{ targetNumber: number | null; zoneKey: DartZoneKey }`, from `@modules/types`), `SkillProfile.decisionQuality` (Task 2).
- Produces: `X01View = { remaining: number; checkoutPath: readonly string[] | null }`; `chooseTarget(view: X01View, decisionQuality: number): ThrowIntent`. `checkoutPath` is the caller's own `checkoutPathFor(remaining)` result (`@modules/game/checkout-path.module`, which `modules/dartbot/*` may not import) — the adapter computes it fresh before every dart and hands it in flattened, exactly as `DictatedView.target` is handed in today.

**Design note — why "setup shots" (the high tier's extra nuance in §Decision degrades too) is out of scope here:** the phase's own gate is "alternating-turn play in one `SHARED` leg," which only needs the bot to (a) score sensibly outside checkout range and (b) actually finish when it is in range. Choosing a scoring shot that deliberately *leaves* a preferred double when not yet in range is a real, separable strategy improvement with no bearing on whether a match completes — it is left for a follow-up rather than folded into this phase un-asked-for (root `CLAUDE.md`: don't design for hypothetical requirements beyond the task). `decisionQuality` is still a continuous 0–100 value (Task 2) so that follow-up has an axis to read; this task only branches it at one threshold.

- [ ] **Step 1: Write the failing tests**

```ts
// app/tests/modules/dartbot/strategy/x01.strategy.module.test.ts
import { describe, expect, it } from "vitest";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { chooseTarget } from "@modules/dartbot/strategy/x01.strategy.module";

const HIGH_DECISION = 80;
const LOW_DECISION = 10;

describe("chooseTarget", () => {
  it("below the decision threshold, always fires at treble 20 regardless of checkout path", () => {
    const intent = chooseTarget(
      { remaining: 40, checkoutPath: ["D20"] },
      LOW_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "TREBLE" });
  });

  it("at or above the threshold, aims at the checkout path's first step", () => {
    const intent = chooseTarget(
      { remaining: 170, checkoutPath: ["T20", "T20", "BULL"] },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "TREBLE" });
  });

  it("parses a double step", () => {
    const intent = chooseTarget(
      { remaining: 40, checkoutPath: ["D20"] },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "DOUBLE" });
    expect(zoneCentroid(intent.targetNumber!, intent.zoneKey)).not.toBeNull();
  });

  it("parses the inner-bull step", () => {
    const intent = chooseTarget(
      { remaining: 50, checkoutPath: ["BULL"] },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 25, zoneKey: "INNER_BULL" });
  });

  it("parses the outer-bull step (worth 25, the '25' route label)", () => {
    const intent = chooseTarget(
      { remaining: 135, checkoutPath: ["25", "T20", "BULL"] },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 25, zoneKey: "OUTER_BULL" });
  });

  it("parses a plain-number single step", () => {
    const intent = chooseTarget(
      { remaining: 120, checkoutPath: ["T20", "20", "D20"] },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "OUTER_SINGLE" });
  });

  it("falls back to treble 20 when no route exists (a bogey number), even above the threshold", () => {
    const intent = chooseTarget(
      { remaining: 169, checkoutPath: null },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "TREBLE" });
  });

  it("falls back to treble 20 above 170, where no route exists either", () => {
    const intent = chooseTarget(
      { remaining: 501, checkoutPath: null },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "TREBLE" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/modules/dartbot/strategy/x01.strategy.module.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Add `X01View` and implement `chooseTarget`**

```ts
// app/src/modules/dartbot/interfaces.ts — append
/**
 * Read-only view a checkout-routing ruleset hands the strategy: the seat's
 * own remaining score, and the checkout route for it — `checkoutPathFor()`,
 * computed by the page adapter every time this is built, since
 * `modules/dartbot/*` may not import ruleset math (`08-DartBot.md` §Import
 * direction). `null` when no route exists (a bogey number, or above 170).
 */
export interface X01View {
  remaining: number;
  checkoutPath: readonly string[] | null;
}
```

```ts
// app/src/modules/dartbot/strategy/x01.strategy.module.ts
import type { X01View } from "@modules/interfaces";
import type { DartZoneKey, ThrowIntent } from "@modules/types";

/** Real darts strategy's default scoring target outside checkout range, and
 * every tier's target when the decision axis is too low to trust a route. */
const SCORING_TARGET: ThrowIntent = { targetNumber: 20, zoneKey: "TREBLE" };

/**
 * The decision axis (`08-DartBot.md` §Decision degrades too) below which the
 * bot never attempts a checkout route — "always the biggest number... takes
 * a double only if one happens to land." At and above it, the bot follows
 * `checkoutPathFor()`'s own route whenever one exists.
 */
const ROUTES_CHECKOUT_ABOVE = 30;

/** `BULL` (50, inner) mirrors `dictated.strategy.module.ts`'s own local
 * literal — `modules/dartbot/*` may not import `board-progression.module`. */
const INNER_BULL_TARGET_NUMBER = 25;

function intentForCheckoutLabel(label: string): ThrowIntent {
  if (label === "BULL") {
    return { targetNumber: INNER_BULL_TARGET_NUMBER, zoneKey: "INNER_BULL" };
  }
  if (label === "25") {
    return { targetNumber: 25, zoneKey: "OUTER_BULL" };
  }
  const treble = /^T(\d+)$/.exec(label);
  if (treble) {
    return { targetNumber: Number(treble[1]), zoneKey: "TREBLE" };
  }
  const double = /^D(\d+)$/.exec(label);
  if (double) {
    return { targetNumber: Number(double[1]), zoneKey: "DOUBLE" };
  }
  return { targetNumber: Number(label), zoneKey: "OUTER_SINGLE" as DartZoneKey };
}

/**
 * Aims at the current checkout route's first step when the decision axis
 * trusts one and one exists, otherwise at treble 20 — the same fallback for
 * "not in range," "no route (a bogey number)," and "decision quality too
 * low to route at all." `view.checkoutPath` is re-derived by the caller
 * before every dart from whatever `remaining` actually is, so a miss that
 * changes the remaining score is picked up on the very next call with no
 * state held here or in the caller across a visit.
 */
export function chooseTarget(view: X01View, decisionQuality: number): ThrowIntent {
  if (decisionQuality < ROUTES_CHECKOUT_ABOVE) return SCORING_TARGET;
  if (!view.checkoutPath || view.checkoutPath.length === 0) return SCORING_TARGET;
  return intentForCheckoutLabel(view.checkoutPath[0]!);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/modules/dartbot/strategy/x01.strategy.module.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/dartbot/interfaces.ts app/src/modules/dartbot/strategy/x01.strategy.module.ts app/tests/modules/dartbot/strategy/x01.strategy.module.test.ts
git commit -m "feat: add X01Strategy — checkout-routing target selection

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9"
```

---

### Task 4: Widen `playFoldBotQuickScoreVisit`'s thrower to read live scratch-engine state

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts`
- Modify: `app/src/lib/game/types.ts`
- Test: `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Produces: `playFoldBotQuickScoreVisit<TConfig, TInput, TState>(factory, config, facts, throwDart: (state: TState) => DartObservation, dartsPerVisit): BotQuickScoreFold` — same name, same return shape (`{ totalScore, dartsThrown }`, matching D252's note that no change to the fold's return type is expected), one parameter widened.
- Consumes (Task 5): the concrete `fiveOhOneEngineFactory` (not the type-erased registry) so `TState` infers as `FiveOhOneState` with no cast at the call site.

Existing zero-arg closures (`() => TREBLE_TWENTY`) already in `play-lifecycle.test.ts` stay assignable to a one-`state`-arg thrower type — TypeScript lets a function with fewer declared parameters satisfy a type expecting more — so no existing test needs editing. This task adds one new test that the scratch engine's state is actually threaded through.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/lib/game/play-lifecycle.test.ts — add inside describe("playFoldBotQuickScoreVisit")
it("passes the scratch engine's own live state to throwDart before every dart", () => {
  const real = scoreTrainingEngineFactory.create(SCORE_TRAINING_CONFIG);
  real.record(20); // human's visit; bot is active next

  const seenScores: number[] = [];
  playFoldBotQuickScoreVisit(
    scoreTrainingEngineFactory,
    SCORE_TRAINING_CONFIG,
    real.facts(),
    (state) => {
      seenScores.push(state.seats.find((s) => s.participantRef === BOT_REF)!.totalScore);
      return TREBLE_TWENTY;
    },
    3,
  );

  // Score Training's own seat total climbs by 60 (treble 20) after each of
  // the first two darts, proving the third call saw the second dart's effect.
  expect(seenScores).toEqual([0, 60, 120]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts -t "passes the scratch engine's own live state"`
Expected: FAIL — TypeScript error (`throwDart` is currently typed `() => DartObservation`, and the loop calls it with no argument).

- [ ] **Step 3: Widen the signature**

```ts
// app/src/lib/game/types.ts — replace BotQuickScoreFold's neighbour
/**
 * What a play page hands `playFoldBotQuickScoreVisit` for each dart: a
 * function from the scratch engine's own live `state()` (after however many
 * darts of this visit have landed so far) to the next simulated dart. The
 * scratch engine's state, never the real one, because the whole point of
 * the fold is that the real engine is never told about darts mid-visit
 * under QUICK_SCORE (`08-DartBot.md` §The Play Loop).
 */
export type BotQuickScoreThrower<TState> = (state: TState) => DartObservation;
```

```ts
// app/src/lib/game/play-lifecycle.ts — playFoldBotQuickScoreVisit
export function playFoldBotQuickScoreVisit<TConfig, TInput, TState>(
  factory: GameEngineFactory<TConfig, TInput, TState>,
  config: TConfig,
  facts: EngineFacts,
  throwDart: BotQuickScoreThrower<TState>,
  dartsPerVisit: number,
): BotQuickScoreFold {
  const scratch = factory.create(config, facts);
  for (let i = 0; i < dartsPerVisit && !scratch.isComplete(); i++) {
    scratch.record(throwDart(scratch.state()) as TInput);
  }
  const visitTurn = scratch.facts().turns.at(-1)!;
  return {
    totalScore: visitTurn.totalScore,
    dartsThrown: visitTurn.darts.length,
  };
}
```

Update its own JSDoc's "`throwDart` always returns a `DartObservation`..." paragraph to note the new parameter: "`throwDart` reads the scratch engine's own state — the only way a QUICK_SCORE strategy can re-target between darts without the adapter or DartBot computing a score itself — and always returns a `DartObservation`...". Add the `BotQuickScoreThrower` import to `play-lifecycle.ts`'s type-only import list from `./types`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts`
Expected: PASS (all `playFoldBotQuickScoreVisit` tests, old and new)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/play-lifecycle.ts app/src/lib/game/types.ts app/tests/lib/game/play-lifecycle.test.ts
git commit -m "feat: thread scratch-engine state into playFoldBotQuickScoreVisit's thrower

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9"
```

---

### Task 5: Seat the bot on 501 — `five-oh-one-play.data.ts`

**Files:**
- Modify: `app/src/lib/game/types.ts` (`FiveOhOnePlayContext`)
- Modify: `app/src/lib/game/five-oh-one-play.data.ts`
- Test: `app/tests/lib/game/five-oh-one-play.data.test.ts`

**Interfaces:**
- Consumes: `chooseTarget` (Task 3), `playRunBotVisualBoardVisit`/`playFoldBotQuickScoreVisit`/`undoToActiveSeat` (`@lib/game/play-lifecycle`), `skillProfileForLevel`/`createDartRng`/`throwDart` (phases 1–2, already imported this way by `bobs27-play.data.ts`), `checkoutPathFor` (`@modules/game/checkout-path.module`), `fiveOhOneEngineFactory` (concrete, for the QUICK_SCORE fold's `TState` inference).
- Produces: `FiveOhOnePlayContext.botThrowing: boolean`; `maybeRunBotVisit()` called from `init`, the tail of the per-dart commit path, and `undoVisit`.

`this.$store.game.captureModeKey` is `"VISUAL_BOARD" | "QUICK_SCORE"` (set by `setSessionModes`, read the same way `statsFor`'s `inputModeKey === "VISUAL_BOARD"` check already reads its sibling `inputModeKey` field) — `maybeRunBotVisit` branches on it.

- [ ] **Step 1: Write the failing tests**

```ts
// app/tests/lib/game/five-oh-one-play.data.test.ts — new describe block, added to the existing file
describe("DartBot opponent", () => {
  const BOT_REF = "bot-1";
  const HUMAN_REF = "human-1";

  function seatsWithBot() {
    return [
      { participantRef: HUMAN_REF, displayName: "Levi", sideKey: "A", participantTypeKey: "PLAYER" as const },
      {
        participantRef: BOT_REF,
        displayName: "DartBot",
        sideKey: "B",
        participantTypeKey: "DARTBOT" as const,
        dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" as const },
      },
    ];
  }

  it("under VISUAL_BOARD, the bot throws its own visit once it becomes active", async () => {
    const context = fiveOhOnePlay();
    // ...init the context against a bot-seated, VISUAL_BOARD session fixture
    // (mirrors this file's existing `makeContext`/`resumeEngine` setup, with
    // `captureModeKey: "VISUAL_BOARD"` and `seatsWithBot()`)...
    await context.init();
    await context.recordDart(HUMAN_MISS_OBSERVATION); // human's visit closes, bot becomes active
    const botTurns = context.$store.game.turns.filter((t) => t.participantRef === BOT_REF);
    expect(botTurns.length).toBeGreaterThan(0);
    expect(context.$store.game.turns.at(-1)!.participantRef).toBe(HUMAN_REF); // control returned
  });

  it("under QUICK_SCORE, the bot's visit uploads as one turn with darts: []", async () => {
    const context = fiveOhOnePlay();
    // ...init against a bot-seated, QUICK_SCORE session fixture...
    await context.init();
    await context.submitVisit(); // human's keypad visit
    const botTurn = context.$store.game.turns.find((t) => t.participantRef === BOT_REF);
    expect(botTurn).toBeDefined();
    expect(botTurn!.darts).toEqual([]);
  });

  it("undoVisit crosses the seat boundary back to the human", async () => {
    const context = fiveOhOnePlay();
    // ...init, let the bot throw one visit under VISUAL_BOARD...
    context.undoVisit();
    expect(context.state()!.activeParticipantRef).toBe(HUMAN_REF);
  });
});
```

(Fixture wiring mirrors this test file's existing patterns for `resumeEngine`/`makeContext` and `bobs27-play.data.test.ts`'s bot-seat fixtures — both already exist in the repo and are the templates to copy from, not written fresh.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts -t "DartBot opponent"`
Expected: FAIL — `botThrowing`/`maybeRunBotVisit` do not exist yet.

- [ ] **Step 3: Wire the bot seat**

Add to `FiveOhOnePlayContext` in `app/src/lib/game/types.ts`:

```ts
botThrowing: boolean;
maybeRunBotVisit(this: FiveOhOnePlayContext): Promise<void>;
```

In `app/src/lib/game/five-oh-one-play.data.ts`, add the imports Bob's 27 already uses for the same purpose, plus this phase's own:

```ts
import {
  // ...existing...
  playRunBotVisualBoardVisit,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { throwDart as botThrowDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/x01.strategy.module";
import type { SeatFact } from "@lib/types";
import type { BotDartThrower, BotPacing } from "./types";

// Value import for fiveOhOneEngineFactory's concrete TState (FiveOhOneState),
// so playFoldBotQuickScoreVisit needs no cast — the type-erased registry
// (getEngineFactory) would infer TState as unknown instead.
import {
  FiveOhOneEngine,
  fiveOhOneEngineFactory,
} from "@modules/game/five-oh-one.engine.module";
```

Add the bot helpers (module scope, mirroring `bobs27-play.data.ts`'s `DartbotSeat`/`botDartIndex`/`findBotSeat` verbatim, plus the two throwers and `X01View` construction this ruleset's decision axis needs):

```ts
const BOT_PRE_THROW_MS = 900;
const BOT_POST_THROW_MS = 250;
const DARTS_PER_VISIT = 3;

type DartbotSeat = Extract<SeatFact, { participantTypeKey: "DARTBOT" }>;

function findBotSeat(seats: readonly SeatFact[]): DartbotSeat | undefined {
  return seats.find(
    (seat): seat is DartbotSeat => seat.participantTypeKey === "DARTBOT",
  );
}

function botDartIndex(turns: readonly TurnFact[], botRef: string): number {
  return turns
    .filter((turn) => turn.participantRef === botRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}

function throwOneDart(
  remaining: number,
  botSeat: DartbotSeat,
  dartIndex: number,
): DartObservation {
  const profile = skillProfileForLevel(botSeat.dartbot.level);
  const rng = createDartRng(botSeat.dartbot.seed, dartIndex);
  const intent = chooseTarget(
    { remaining, checkoutPath: checkoutPathFor(remaining) },
    profile.decisionQuality,
  );
  const thrown = botThrowDart(intent, profile, rng);
  return {
    hitTargetNumber: thrown.hit.targetNumber,
    hitZoneKey: thrown.hit.zoneKey,
    locationX: thrown.landing.x,
    locationY: thrown.landing.y,
  };
}

/** VISUAL_BOARD thrower: reads the real engine's own live `state()`, exactly
 * as `bobs27-play.data.ts`'s `throwBotDart` does — `foldFiveOhOneState`
 * already folds an open visit's running total, so `remainingScoreFor` is
 * live per dart, not just per visit. */
function throwBotDart(
  context: FiveOhOnePlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  const remaining = context.remainingScoreFor(botSeat.participantRef);
  const dartIndex = botDartIndex(context.$store.game.turns, botSeat.participantRef);
  return {
    observation: throwOneDart(remaining, botSeat, dartIndex),
    pacing: { preThrowMs: BOT_PRE_THROW_MS, postThrowMs: BOT_POST_THROW_MS },
  };
}

/**
 * QUICK_SCORE thrower: `state` is the scratch engine's own live state
 * (Task 4's widened `playFoldBotQuickScoreVisit`), never the real engine's —
 * the real engine is never told about darts mid-visit under QUICK_SCORE.
 */
function throwBotQuickScoreDart(
  state: FiveOhOneState,
  botSeat: DartbotSeat,
  dartIndex: number,
): DartObservation {
  const remaining = state.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  )!.remainingScore;
  return throwOneDart(remaining, botSeat, dartIndex);
}
```

Add `maybeRunBotVisit` and wire it in, mirroring `bobs27-play.data.ts`'s `init`/`commitDart`/`undoVisit` calls:

```ts
async maybeRunBotVisit(this: FiveOhOnePlayContext) {
  const botSeat = findBotSeat(this.$store.game.seats);
  if (!botSeat || !this.engine || this.finished) return;
  const state = this.state();
  if (!state || state.activeParticipantRef !== botSeat.participantRef) return;

  if (this.$store.game.captureModeKey === "QUICK_SCORE") {
    const remainingBefore = this.remainingScoreFor(botSeat.participantRef);
    let dartIndex = botDartIndex(this.$store.game.turns, botSeat.participantRef);
    const fold = playFoldBotQuickScoreVisit(
      fiveOhOneEngineFactory,
      this.$store.game.configSnapshot!,
      this.engine.facts(),
      (scratchState) =>
        throwBotQuickScoreDart(scratchState, botSeat, dartIndex++),
      DARTS_PER_VISIT,
    );
    await this.recordVisit(
      fold.totalScore,
      fold.totalScore === remainingBefore,
    );
    return;
  }

  const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
  await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
},
```

`commitDart` calls `await this.maybeRunBotVisit();` after `playCommitDart` (the VISUAL_BOARD human-dart path); `recordVisit`'s own end (the QUICK_SCORE human keypad path) does the same. `init` calls it once after reconciliation, matching Bob's 27 (a resumed session where the bot is already active must throw without waiting for a human action). `undoVisit` branches:

```ts
undoVisit(this: FiveOhOnePlayContext) {
  if (this.finished || this.showDoubleConfirm || this.showMatchFinishConfirm) return;
  if (!this.engine) return;
  const botSeat = findBotSeat(this.$store.game.seats);
  if (botSeat) {
    const humanSeat = this.$store.game.seats.find(
      (seat) => seat.participantTypeKey === "PLAYER",
    )!;
    undoToActiveSeat(this, humanSeat.participantRef);
  } else {
    if (!this.engine.undo()) return;
    clearHiddenTimer(this);
    this.$store.game.recordFacts(this.engine.facts());
  }
  this.scoreInput.clear();
  this.error = "";
  void this.maybeRunBotVisit();
},
```

`botThrowing: false` joins the other boolean fields in the returned object literal.

`finishedOnDouble = fold.totalScore === remainingBefore`: `resolveFiveOhOneVisit`'s bust branch always yields `totalScore: 0` unless `remainingBefore` was itself already 0 (never true mid-match), and its only path to `totalScore === remainingBefore` is `outcome.checkedOut` — a checkout is by construction on a double under this engine's own bust matrix. Recording `{ scoreAttempted: fold.totalScore, finishedOnDouble }` on the real engine therefore reproduces the scratch engine's own resolution exactly, without the fold's return type carrying anything beyond `totalScore`/`dartsThrown` — matching D252's expectation that the fold itself would not need to change.

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite and the complexity gate**

Run: `cd app && npx vitest run && npx fallow`
Expected: full suite green; `fallow` exits 0 (watch `maybeRunBotVisit` specifically — flatten with early returns if it trips the health gate, per F50/F48).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/five-oh-one-play.data.ts app/tests/lib/game/five-oh-one-play.data.test.ts
git commit -m "feat: seat a DartBot opponent on 501 under both capture modes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9"
```

---

### Task 6: Setup-screen chooser

**Files:**
- Modify: `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro`

`.astro` frontmatter branching logic is not unit-tested (`app/CLAUDE.md`) — no test file for this task.

- [ ] **Step 1: Wire the existing D-J chooser**

```astro
---
// Components
import Input from "@components/forms/Input.astro";
import Toggle from "./Toggle.astro";
import Switch from "@components/forms/Switch.astro";
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import SettingSectionShell from "./SettingSectionShell.astro";
import UserSection from "./UserSection.astro";
import { supportsDartbot } from "@lib/game/rulesets/capabilities";
// ...unchanged data...
---

<SetupShell title="501">
  <UserSection
    allowGuests
    allowDartbot={supportsDartbot("501_V1")}
  />
  <!-- ...unchanged... -->
</SetupShell>
```

This is the same two-line change `Bobs27SetupForm.astro` made for phase 4 — `UserSection`/`GuestSection`/`AddGuestButton`/`OpponentChooserModal` are already generic over which ruleset called them.

- [ ] **Step 2: Manual check**

Run: `cd app && astro dev --background`, open `/games/501/setup`, confirm the add-opponent button opens the Guest/DartBot chooser (it will not be able to complete a real session in this sandbox — no Neon Auth backend, same D193 limitation phase 6's plan hit; a human verifies this end to end before merge, see Task 8).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/setup/FiveOhOneSetupForm.astro
git commit -m "feat: offer a DartBot opponent on the 501 setup screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9"
```

---

### Task 7: Contract test — alternating-turn play in one SHARED leg

**Files:**
- Create: `app/tests/modules/dartbot/harness/five-oh-one-dartbot-seat.contract.test.ts`

**Interfaces:**
- Consumes: `fiveOhOneEngineFactory`, `chooseTarget` (Task 3), `skillProfileForLevel`, `createDartRng`, `throwDart` (phase 1–2), `checkoutPathFor`.

This is the phase's own gate, proven at the engine level exactly as `bobs27-dartbot-seat.contract.test.ts` proved phase 4's — human darts fixed, bot darts real, both capture-mode shapes exercised (`FiveOhOneInput` accepts both a `DartObservation` and a `FiveOhOneVisitInput`, so both are driven directly against the real engine here rather than through Alpine page state).

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it } from "vitest";
import { fiveOhOneEngineFactory } from "@modules/game/five-oh-one.engine.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/x01.strategy.module";
import type { DartObservation, FiveOhOneState } from "@modules/types";

const MAX_VISITS = 500;
const HUMAN_REF = "human-1";
const BOT_REF = "bot-1";
const BOT_LEVEL = 8;
const BOT_SEED = 424242;

const seats = [
  { participantRef: HUMAN_REF, displayName: "Levi", sideKey: "A", participantTypeKey: "PLAYER" as const },
  {
    participantRef: BOT_REF,
    displayName: "DartBot",
    sideKey: "B",
    participantTypeKey: "DARTBOT" as const,
    dartbot: { level: BOT_LEVEL, seed: BOT_SEED, levelSource: "MANUAL" as const },
  },
];

const config = {
  startingScore: 501,
  legsToWin: 1,
  maxVisitScore: 180,
  maxDartsPerTurn: 3,
  seats,
};

function botRemaining(state: FiveOhOneState): number {
  return state.seats.find((s) => s.participantRef === BOT_REF)!.remainingScore;
}

function botDart(remaining: number, dartIndex: number): DartObservation {
  const profile = skillProfileForLevel(BOT_LEVEL);
  const intent = chooseTarget(
    { remaining, checkoutPath: checkoutPathFor(remaining) },
    profile.decisionQuality,
  );
  const rng = createDartRng(BOT_SEED, dartIndex);
  const thrown = throwDart(intent, profile, rng);
  return {
    hitTargetNumber: thrown.hit.targetNumber,
    hitZoneKey: thrown.hit.zoneKey,
    locationX: thrown.landing.x,
    locationY: thrown.landing.y,
  };
}

/** Human always records a fixed 26 (a common, deliberately unglamorous
 * quick-score visit) via the keypad shape; the bot always throws real darts
 * via VISUAL_BOARD's per-dart shape — proving both `FiveOhOneInput` variants
 * coexist correctly inside one SHARED leg, which is this phase's own gate. */
function playToCompletion() {
  const engine = fiveOhOneEngineFactory.create(config);
  let dartIndex = 0;
  let state = engine.state();

  while (state.status === "IN_PROGRESS") {
    if (dartIndex >= MAX_VISITS) {
      throw new Error(`Match did not complete within ${MAX_VISITS} darts/visits`);
    }
    if (state.activeParticipantRef === BOT_REF) {
      engine.record(botDart(botRemaining(state), dartIndex));
    } else {
      engine.record({ scoreAttempted: 26, finishedOnDouble: false });
    }
    dartIndex++;
    state = engine.state();
  }

  return engine;
}

describe("DartBot-driven 501 1v1 — SHARED leg alternation", () => {
  it("reaches a decided outcome with the bot throwing its own visits", () => {
    const state = playToCompletion().state();
    expect(state.status).toBe("WON");
    expect(["A", "B"]).toContain(state.winningSideKey);
  });

  it("every bot turn is attributed to the bot's own participantRef", () => {
    const engine = playToCompletion();
    const botTurns = engine.facts().turns.filter((t) => t.participantRef === BOT_REF);
    expect(botTurns.length).toBeGreaterThan(0);
    expect(
      engine.facts().turns.every(
        (t) => t.participantRef === BOT_REF || t.participantRef === HUMAN_REF,
      ),
    ).toBe(true);
  });

  it("the bot eventually finishes a leg on a double when it reaches checkout range", () => {
    // A dedicated low-noise fixture: bot starts already in range (40), so a
    // decision-quality-8 bot (above the routing threshold) should check out
    // within a small, bounded number of visits rather than never.
    const nearFinishConfig = { ...config, startingScore: 40 };
    const engine = fiveOhOneEngineFactory.create(nearFinishConfig);
    let dartIndex = 0;
    let state = engine.state();
    let visits = 0;
    while (state.status === "IN_PROGRESS" && visits < 50) {
      if (state.activeParticipantRef === BOT_REF) {
        engine.record(botDart(botRemaining(state), dartIndex));
      } else {
        engine.record({ scoreAttempted: 0, finishedOnDouble: false }); // human always leaves it to the bot
      }
      dartIndex++;
      if (state.activeParticipantRef !== engine.state().activeParticipantRef) visits++;
      state = engine.state();
    }
    expect(state.status).toBe("WON");
    expect(state.winningSideKey).toBe("B");
  });
});
```

- [ ] **Step 2: Run**

Run: `cd app && npx vitest run tests/modules/dartbot/harness/five-oh-one-dartbot-seat.contract.test.ts`
Expected: PASS. If the third test is flaky (a level-8 bot can bust or run long on some seeds), raise `BOT_LEVEL`/lower `nearFinishConfig.startingScore` or the `visits` ceiling rather than deleting the assertion — the gate this test exists for is exactly "the bot can finish," so a test that can't reliably observe a finish is a defect in the fixture, not evidence the gate is unreachable.

- [ ] **Step 3: Commit**

```bash
git add app/tests/modules/dartbot/harness/five-oh-one-dartbot-seat.contract.test.ts
git commit -m "test: prove DartBot-driven 501 reaches a decided outcome in one SHARED leg

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9"
```

---

### Task 8: Validation and context maintenance

- [ ] **Step 1: Full validation**

Run: `cd app && npm run validate:app` (per the `validate-app` skill's full procedure — includes `db:status`/`db:migrate`/`db:introspect`, which will not run in this sandbox with no `DATABASE_URL`/Neon credentials, the established D193 precedent phase 6's own plan already hit; this phase adds no migration, so that gap is expected, not a new failure to chase).

- [ ] **Step 2: Run the project's own gate dispatcher**

Run the `run-all-gates` skill (dispatches the changed-area `check-*.sh` scripts and the `validate:app` checklist explicitly, per its own description).

- [ ] **Step 3: Context maintenance**

Run the `context-maintenance` skill (mandatory per root `CLAUDE.md` before claiming any task done). Expect it to touch at least: `docs/architecture/08-DartBot.md` (version bump; §Delivery Phases row 7 from "design-only" to shipped; §Strategy Layer and Game Coverage's `501_V1` row's "What the bot emits" column already says both shapes, no change there; the dependency table's play-loop row's "no live consumer yet" clause is now false), `docs/architecture/00-Context-Map-History.md` (new version entry), `docs/architecture/00-File-Inventory.md` (size/row updates for every file this plan touched), and a new `decisions/game-engine.md` entry recording the `playFoldBotQuickScoreVisit` thrower-signature widening (Task 4) as a real design choice — the fold's return type held per D252's expectation, but its parameter did not, and that is worth a citable decision rather than a silent deviation.

- [ ] **Step 4: Note the one thing no agent in this sandbox can verify**

Same limitation phase 6's own plan recorded: no `DATABASE_URL`/Neon Auth in this environment, so a live session cannot be created here. Before merge, a human with a working local/Neon environment must play a real 501 match against a seated `DARTBOT` opponent under both VISUAL_BOARD and QUICK_SCORE capture, confirming: the bot throws automatically with a visible pause; the match-finish confirm dialog never appears for the bot's own dart; undo mid-bot-turn returns control to the human; a QUICK_SCORE bot visit's board never shows bot dart coordinates (none exist to show).

---

## Self-Review

**Spec coverage** — every `08-DartBot.md` phase-7 element has a task: `X01Strategy` (Task 3), the decision axis (Task 2), opponent-mode seating on `501_V1` (Tasks 1, 5, 6), the gate itself — "alternating-turn play in one `SHARED` leg" (Task 7). The QUICK_SCORE re-targeting requirement named in §The Play Loop ("A 501 bot that has just thrown T20 must see the new remaining before choosing dart 2") is Task 4.

**Placeholder scan** — every step carries real code or an exact command; the one deliberately-vague area (Task 5 Step 1's fixture wiring) is explicitly pointed at the two existing files it's copied from, not left as "write appropriate fixtures."

**Type consistency** — `X01View` (Task 3) is consumed identically in Task 5's adapter and Task 7's contract test; `BotQuickScoreThrower<TState>` (Task 4) is the type both Task 5's `throwBotQuickScoreDart` closure and the widened `playFoldBotQuickScoreVisit` share; `chooseTarget(view, decisionQuality)`'s signature is identical across Tasks 3, 5, and 7.
