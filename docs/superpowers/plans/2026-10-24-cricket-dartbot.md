# Cricket DartBot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Cricket V2 seat can be a DartBot, driven by an opponent-aware block → score → close ladder.

**Architecture:** A pure `chooseTarget(view: MarksView)` strategy in `modules/dartbot`; a thin app adapter flattens `CricketState` into the view; `cricket-play.data.ts` gets the same bot loop wiring as `bobs27-play.data.ts`, through one new shared throw helper so the per-dart throw block is not cloned a third time. Admission is `RULESET_DARTBOT.CRICKET_V2` plus a setup key that treats a bot as an opponent.

**Tech Stack:** TypeScript, Alpine.js, Astro, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-cricket-dartbot-design.md`

## Global Constraints

- Commands run from `app/`: `npm test -- <path>` for a file, `npm test` for the suite.
- TDD per `app/CLAUDE.md`: write the test, run it, see it fail for the right reason, then implement.
- No `//` or `/* */` inside function bodies; doc comments describe the declaration, never decision history (`app/CLAUDE.md` §Comments).
- `modules/dartbot/*` imports no engine, engine state or ruleset snapshot type; the only game import it may take is `@modules/game/types` (08-DartBot.md §Import direction).
- Minimal diffs. Existing bot callers (`five-oh-one-play.data.ts`, `bobs27-play.data.ts`, others) are not refactored; a clone found there is a `discovered-work` issue.
- Commit trailers on every commit, verbatim:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg`.
- Never `--no-verify`. Run `cd app && npm run format` before the PR and commit any diff.
- Branch: `feat/cricket-dartbot` (already holds the spec commit). Do not merge to `main`.

## Review Focus

- Block outranks score outranks close, and the fixed order 20…15, bull holds inside a tier (Task 1 table test).
- The bot's winning dart ends the game: no further bot dart, no hand-over (Task 3 test).
- The bot in seat 1 with the human first: the bot visit starts only on the bot's turn, and a human visit never triggers a second concurrent loop (Task 3 tests).
- Undo of a bot visit returns to the human; resume mid-game re-throws identically from the seed (Task 3 tests).
- A bot setup creates `CRICKET_V2`, not `CRICKET_V1` (Task 4 test).

## File Structure

| File | Change |
| --- | --- |
| `app/src/modules/dartbot/interfaces.ts` | add `MarksView` |
| `app/src/modules/dartbot/strategy/marks.strategy.module.ts` | create: `chooseTarget` |
| `app/src/lib/game/play-bot-seat.ts` | add `botThrowObservation` |
| `app/src/lib/game/cricket-play.data.ts` | add `cricketMarksView`, bot loop wiring |
| `app/src/lib/game/types.ts` | `CricketPlayContext` gains bot members |
| `app/src/lib/game/rulesets/capabilities.ts` | `RULESET_DARTBOT.CRICKET_V2`, doc comment |
| `app/src/lib/game/cricket-setup.data.ts` | key treats a bot as an opponent |
| `app/src/components/layout/games/setup/CricketSetupForm.astro` | `allowDartbot`, copy |
| `app/tests/**` | mirror each source file; see tasks |
| `docs/architecture/08-DartBot.md`, `docs/game-rules/rulesets/cricket.md`, `decisions/**`, `docs/architecture/00-Context-Map-History.md` | Task 6 |

---

### Task 1: MarksView and the marks strategy

**Files:**
- Modify: `app/src/modules/dartbot/interfaces.ts`
- Create: `app/src/modules/dartbot/strategy/marks.strategy.module.ts`
- Create: `app/tests/modules/dartbot/strategy/marks.strategy.module.test.ts`

**Interfaces:**
- Produces: `MarksView = { objectives: readonly MarksObjectiveView[] }`, `MarksObjectiveView = { targetNumber: number; own: number; opponent: number }`; `chooseTarget(view: MarksView): ThrowIntent`.

- [ ] **Step 0: Record the dupes baseline**

Run (repo root): `cd app && npx fallow dupes --mode semantic --min-tokens 30 > ../.superpowers-dupes-before.txt 2>&1; tail -5 ../.superpowers-dupes-before.txt`
Expected: a clone-group summary. Keep the file out of git (`git status` must not list it; delete it at the end of Task 5).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { chooseTarget } from "@modules/dartbot/strategy/marks.strategy.module";
import type { MarksView } from "@modules/interfaces";

const ORDER = [20, 19, 18, 17, 16, 15, 25];

function view(marks: Record<number, [number, number]> = {}): MarksView {
  return {
    objectives: ORDER.map((targetNumber) => {
      const [own, opponent] = marks[targetNumber] ?? [0, 0];
      return { targetNumber, own, opponent };
    }),
  };
}

describe("marks chooseTarget", () => {
  it("closes 20 first when nothing is marked", () => {
    expect(chooseTarget(view())).toEqual({
      targetNumber: 20,
      zoneKey: "TREBLE",
    });
  });

  it("closes the next open number once 20 is closed by both", () => {
    expect(chooseTarget(view({ 20: [3, 3] }))).toEqual({
      targetNumber: 19,
      zoneKey: "TREBLE",
    });
  });

  it("scores on a number it owns that the opponent has open", () => {
    expect(chooseTarget(view({ 20: [3, 1], 19: [3, 3] }))).toEqual({
      targetNumber: 20,
      zoneKey: "TREBLE",
    });
  });

  it("scores before closing a new number", () => {
    expect(chooseTarget(view({ 18: [3, 0] }))).toEqual({
      targetNumber: 18,
      zoneKey: "TREBLE",
    });
  });

  it("blocks a number the opponent closed and it has not", () => {
    expect(chooseTarget(view({ 17: [1, 3] }))).toEqual({
      targetNumber: 17,
      zoneKey: "TREBLE",
    });
  });

  it("blocks before scoring", () => {
    expect(chooseTarget(view({ 20: [3, 0], 15: [0, 3] }))).toEqual({
      targetNumber: 15,
      zoneKey: "TREBLE",
    });
  });

  it("blocks the first of several in fixed order", () => {
    expect(chooseTarget(view({ 17: [0, 3], 16: [0, 3] }))).toEqual({
      targetNumber: 17,
      zoneKey: "TREBLE",
    });
  });

  it("aims the inner bull for the bull", () => {
    const intent = chooseTarget(
      view({ 20: [3, 3], 19: [3, 3], 18: [3, 3], 17: [3, 3], 16: [3, 3], 15: [3, 3] }),
    );
    expect(intent).toEqual({ targetNumber: 25, zoneKey: "INNER_BULL" });
    expect(zoneCentroid(25, "INNER_BULL")).toEqual({ x: 0, y: 0 });
  });

  it("falls back to treble 20 when every objective is dead", () => {
    const dead = Object.fromEntries(ORDER.map((n) => [n, [3, 3]])) as Record<
      number,
      [number, number]
    >;
    expect(chooseTarget(view(dead))).toEqual({
      targetNumber: 20,
      zoneKey: "TREBLE",
    });
  });

  it("returns an aimable treble for every number", () => {
    for (const n of ORDER.slice(0, 6)) {
      const intent = chooseTarget(
        view(Object.fromEntries(ORDER.filter((m) => m > n).map((m) => [m, [3, 3]]))),
      );
      expect(zoneCentroid(intent.targetNumber, intent.zoneKey)).not.toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd app && npm test -- tests/modules/dartbot/strategy/marks.strategy.module.test.ts`
Expected: FAIL, cannot resolve `@modules/dartbot/strategy/marks.strategy.module` (and `MarksView` missing).

- [ ] **Step 3: Implement**

Append to `app/src/modules/dartbot/interfaces.ts`:

```ts
/**
 * One objective in a marks game, as the strategy sees it: the board number
 * (the bull is 25) and each seat's marks on it, capped at three. The app
 * adapter flattens engine state into this.
 */
export interface MarksObjectiveView {
  targetNumber: number;
  own: number;
  opponent: number;
}

/**
 * Read-only view a marks ruleset hands the strategy: every objective in the
 * order the bot prefers to attack it, with the bot's own and its opponent's
 * marks. Carries no points, because the ladder never reads them.
 */
export interface MarksView {
  objectives: readonly MarksObjectiveView[];
}
```

Create `app/src/modules/dartbot/strategy/marks.strategy.module.ts`:

```ts
import type { MarksView } from "@modules/interfaces";
import type { ThrowIntent } from "@modules/types";

/** Marks that close an objective; mirrors `MARKS_TO_CLOSE` in `@modules/game/marks-close.module`, which `modules/dartbot/*` may not import. */
const MARKS_TO_CLOSE = 3;

/** The bull's board number; mirrors `BULL_TARGET_NUMBER` for the same reason. */
const BULL_TARGET_NUMBER = 25;

const FALLBACK_TARGET: ThrowIntent = { targetNumber: 20, zoneKey: "TREBLE" };

function intentFor(targetNumber: number): ThrowIntent {
  return targetNumber === BULL_TARGET_NUMBER
    ? { targetNumber, zoneKey: "INNER_BULL" }
    : { targetNumber, zoneKey: "TREBLE" };
}

/**
 * Picks the next dart's target: block an objective the opponent has closed
 * and the bot has not, else score on one the bot has closed and the opponent
 * has not, else close the first objective the bot has open. Each tier takes
 * the first match in the view's order. Re-derived from the view before every
 * dart, so a miss corrects itself with nothing held across a visit. The
 * fallback is reachable only when every objective is dead, which ends the
 * game before another dart.
 */
export function chooseTarget(view: MarksView): ThrowIntent {
  const { objectives } = view;
  const pick =
    objectives.find(
      (o) => o.opponent >= MARKS_TO_CLOSE && o.own < MARKS_TO_CLOSE,
    ) ??
    objectives.find(
      (o) => o.own >= MARKS_TO_CLOSE && o.opponent < MARKS_TO_CLOSE,
    ) ??
    objectives.find((o) => o.own < MARKS_TO_CLOSE);
  return pick ? intentFor(pick.targetNumber) : FALLBACK_TARGET;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd app && npm test -- tests/modules/dartbot/strategy/marks.strategy.module.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/dartbot app/tests/modules/dartbot/strategy
git commit -m "feat(dartbot): marks strategy ladder" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg"
```
If the pre-commit `check-doc-sync` is not part of the hook (it is not), the commit passes. If a gate fails, fix its cause and re-stage.

---

### Task 2: Shared bot throw helper

**Files:**
- Modify: `app/src/lib/game/play-bot-seat.ts`
- Modify: `app/tests/lib/game/play-bot-seat.test.ts`

**Interfaces:**
- Consumes: `ThrowIntent` from `@modules/types`; `botDartIndex`, `BOT_PACING` (same file).
- Produces: `botThrowObservation(botSeat: DartbotSeat, turns: readonly TurnFact[], intent: ThrowIntent): { observation: DartObservation; pacing: BotPacing }`.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/lib/game/play-bot-seat.test.ts` (add `botThrowObservation` to the existing import from `@lib/game/play-bot-seat`; add `BOT_PACING` if absent):

```ts
describe("botThrowObservation", () => {
  const botSeat = {
    participantRef: "bot-1",
    displayName: "DartBot",
    sideKey: "B",
    participantTypeKey: "DARTBOT" as const,
    dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" as const },
  };
  const intent = { targetNumber: 20, zoneKey: "TREBLE" as const };

  it("is deterministic for the same seed and fact log", () => {
    const a = botThrowObservation(botSeat, [], intent);
    const b = botThrowObservation(botSeat, [], intent);
    expect(a).toEqual(b);
  });

  it("returns the shared bot pacing and a board observation", () => {
    const { observation, pacing } = botThrowObservation(botSeat, [], intent);
    expect(pacing).toBe(BOT_PACING);
    expect(observation).toHaveProperty("hitZoneKey");
    expect(typeof observation.locationX).toBe("number");
  });

  it("draws the next dart index from the bot's own darts in the log", () => {
    const turns = [
      {
        clientKey: "t1",
        stageClientKey: "block-1",
        sequence: 1,
        participantRef: "bot-1",
        darts: [
          { hitTargetNumber: 1, hitZoneKey: "MISS", locationX: null, locationY: null },
        ],
      },
    ] as never;
    expect(botThrowObservation(botSeat, turns, intent)).not.toEqual(
      botThrowObservation(botSeat, [], intent),
    );
  });
});
```
If the existing test file's `TurnFact` literal shape differs, copy the shape its `botDartIndex` tests already use.

- [ ] **Step 2: Run it to see it fail**

Run: `cd app && npm test -- tests/lib/game/play-bot-seat.test.ts`
Expected: FAIL, `botThrowObservation` is not exported.

- [ ] **Step 3: Implement**

In `app/src/lib/game/play-bot-seat.ts` add imports and the function:

```ts
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import type { DartObservation, ThrowIntent, TurnFact } from "@modules/types";
```
(merge `DartObservation`, `ThrowIntent` into the existing `@modules/types` import; keep `BotPacing, DartbotSeat, SeatFact` from `@lib/types`.)

```ts
/**
 * Throws one dart for a DartBot seat at `intent`: the level's skill profile,
 * a generator seeded at the bot's next dart index (re-derived from the fact
 * log, so an undone or resumed visit re-throws identically), and the shared
 * pacing. The game supplies the intent.
 */
export function botThrowObservation(
  botSeat: DartbotSeat,
  turns: readonly TurnFact[],
  intent: ThrowIntent,
): { observation: DartObservation; pacing: BotPacing } {
  const profile = skillProfileForLevel(botSeat.dartbot.level);
  const rng = createDartRng(
    botSeat.dartbot.seed,
    botDartIndex(turns, botSeat.participantRef),
  );
  const thrown = throwDart(intent, profile, rng);
  return {
    observation: {
      hitTargetNumber: thrown.hit.targetNumber,
      hitZoneKey: thrown.hit.zoneKey,
      locationX: thrown.landing.x,
      locationY: thrown.landing.y,
    },
    pacing: BOT_PACING,
  };
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd app && npm test -- tests/lib/game/play-bot-seat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/play-bot-seat.ts app/tests/lib/game/play-bot-seat.test.ts
git commit -m "feat(game): shared bot throw helper" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg"
```

---

### Task 3: Cricket adapter and bot loop

**Files:**
- Modify: `app/src/lib/game/cricket-play.data.ts`
- Modify: `app/src/lib/game/types.ts` (`CricketPlayContext`)
- Modify: `app/tests/lib/game/cricket-play.data.test.ts`

**Interfaces:**
- Consumes: `chooseTarget` (Task 1), `botThrowObservation`, `findBotSeat` (Task 2 / existing), `playRunBotVisualBoardVisit`, `undoToActiveSeat` from `@lib/game/play-lifecycle`.
- Produces: `cricketMarksView(state: CricketState, botRef: string): MarksView` (exported); `cricketPlay()` gains `botThrowing`, `botFlight`, `maybeRunBotVisit()`; `init`, `commitDart` and `undoVisit` run the bot.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/lib/game/cricket-play.data.test.ts` (extend the `@lib/game/cricket-play.data` import with `cricketMarksView`; add `import { BOT_PACING } from "@lib/game/play-bot-seat";`, `import type { CricketState } from "@modules/types";` if absent). Place after the existing `describe("cricketPlay", ...)` blocks:

```ts
const BOT_SEATS = [
  ...SEATS,
  {
    participantRef: "bot-1",
    displayName: "DartBot",
    sideKey: "B",
    participantTypeKey: "DARTBOT" as const,
    dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" as const },
  },
];

function botGame(overrides: Partial<GameStub> = {}): Partial<GameStub> {
  return {
    rulesetVersionKey: "CRICKET_V2",
    configSnapshot: { seats: BOT_SEATS } as Seated<CricketSnapshot>,
    ...overrides,
  };
}

function miss(): DartObservation {
  return {
    hitTargetNumber: null,
    hitZoneKey: "MISS",
    locationX: null,
    locationY: null,
  };
}

describe("cricketMarksView", () => {
  function stateWith(
    own: number[],
    opponent: number[],
  ): CricketState {
    const base = initialCricketState({ seats: BOT_SEATS } as never);
    return {
      ...base,
      seats: [
        { ...base.seats[0], marks: opponent },
        { ...base.seats[1], marks: own },
      ],
    };
  }

  it("lists objectives 20…15 then the bull as 25, bot marks as own", () => {
    const view = cricketMarksView(
      stateWith([3, 0, 0, 0, 0, 0, 1], [0, 2, 0, 0, 0, 0, 0]),
      "bot-1",
    );
    expect(view.objectives.map((o) => o.targetNumber)).toEqual([
      20, 19, 18, 17, 16, 15, 25,
    ]);
    expect(view.objectives[0]).toEqual({ targetNumber: 20, own: 3, opponent: 0 });
    expect(view.objectives[1]).toEqual({ targetNumber: 19, own: 0, opponent: 2 });
    expect(view.objectives[6]).toEqual({ targetNumber: 25, own: 1, opponent: 0 });
  });

  it("reads the same view when the bot sits in seat 0", () => {
    const base = initialCricketState({ seats: BOT_SEATS } as never);
    const state: CricketState = {
      ...base,
      seats: [
        { ...base.seats[0], marks: [3, 0, 0, 0, 0, 0, 0] },
        { ...base.seats[1], marks: [0, 0, 0, 0, 0, 0, 0] },
      ],
    };
    expect(cricketMarksView(state, "participant-1").objectives[0]).toEqual({
      targetNumber: 20,
      own: 3,
      opponent: 0,
    });
  });

  it("throws when the bot has no opponent seat", () => {
    const base = initialCricketState({ seats: SEATS } as never);
    expect(() => cricketMarksView(base, "participant-1")).toThrow(
      /opponent/,
    );
  });
});

describe("cricketPlay — DartBot opponent", () => {
  it("throws on its own once the human's visit ends, with no UI action", async () => {
    const play = await started(botGame());
    await play.recordMiss();
    await play.recordMiss();
    await play.recordMiss();
    const botTurns = play
      .engine!.facts()
      .turns.filter((turn) => turn.participantRef === "bot-1");
    expect(botTurns.length).toBeGreaterThan(0);
    expect(play.botThrowing).toBe(false);
    expect(play.engine!.state().activeParticipantRef).toBe("participant-1");
  });

  it("does not throw while it is the human's turn", async () => {
    const play = await started(botGame());
    await play.recordMiss();
    expect(
      play.engine!.facts().turns.some((t) => t.participantRef === "bot-1"),
    ).toBe(false);
  });

  it("paces its darts with the shared BOT_PACING", async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, "setTimeout");
    const play = await started(botGame());
    await play.recordMiss();
    await play.recordMiss();
    const handOver = play.recordMiss();
    await vi.runAllTimersAsync();
    await handOver;
    expect(spy).toHaveBeenCalledWith(expect.any(Function), BOT_PACING.postThrowMs);
    spy.mockRestore();
    vi.useRealTimers();
  });

  it("undoVisit returns control to the human across the bot's visit", async () => {
    const play = await started(botGame());
    await play.recordMiss();
    await play.recordMiss();
    await play.recordMiss();
    await play.undoVisit();
    expect(play.engine!.state().activeParticipantRef).toBe("participant-1");
    expect(
      play.engine!.facts().turns.some((t) => t.participantRef === "bot-1"),
    ).toBe(false);
  });

  it("re-throws identically after an undo (determinism)", async () => {
    const play = await started(botGame());
    await play.recordMiss();
    await play.recordMiss();
    await play.recordMiss();
    const before = play
      .engine!.facts()
      .turns.filter((t) => t.participantRef === "bot-1")
      .flatMap((t) => t.darts);
    await play.undoVisit();
    await play.recordMiss();
    await play.recordMiss();
    await play.recordMiss();
    const after = play
      .engine!.facts()
      .turns.filter((t) => t.participantRef === "bot-1")
      .flatMap((t) => t.darts);
    expect(after).toEqual(before);
  });

  it("resumes with the bot to throw and plays its visit on init", async () => {
    const first = await started(botGame());
    await first.recordMiss();
    await first.recordMiss();
    const humanTurns = first.$store.game.turns;
    const resumed = await started(botGame({ turns: humanTurns }));
    await resumed.recordMiss();
    expect(
      resumed.engine!.facts().turns.some((t) => t.participantRef === "bot-1"),
    ).toBe(true);
  });

  it("ends the game on the bot's winning dart with no further bot dart", async () => {
    const play = await started(botGame({ turns: botClosedSixTurns() }));
    for (let guard = 0; !play.finished && guard < 30; guard += 1) {
      if (play.engine!.state().activeParticipantRef === "participant-1") {
        for (let i = 0; i < 3 && !play.finished; i += 1) {
          await play.recordMiss();
        }
      } else {
        await play.maybeRunBotVisit();
      }
    }
    expect(play.finished).toBe(true);
    const turns = play.engine!.facts().turns;
    expect(turns[turns.length - 1].participantRef).toBe("bot-1");
    const dartCount = turns.flatMap((t) => t.darts).length;
    await play.maybeRunBotVisit();
    expect(play.engine!.facts().turns.flatMap((t) => t.darts).length).toBe(
      dartCount,
    );
    expect(play.engine!.state().winnerParticipantRef).toBe("bot-1");
  });
});
```

The fixture is built with the engine, so it stays valid if the turn shape changes. It plays six rounds in which the human throws three misses and the bot closes one number with a treble, then two misses, leaving the bot with 20–15 closed, the bull open, and the human with nothing. The human then throws three more misses, so the bot is on the throw; the test loop drives the rest. Add it beside `miss()`:

```ts
function botClosedSixTurns(): TurnFact[] {
  const engine = cricketV2EngineFactory.create({
    seats: BOT_SEATS,
  } as Seated<CricketSnapshot>) as CricketEngine;
  const treble = (n: number): DartObservation => ({
    hitTargetNumber: n,
    hitZoneKey: "TREBLE",
    locationX: null,
    locationY: null,
  });
  for (const n of [20, 19, 18, 17, 16, 15]) {
    engine.record(miss());
    engine.record(miss());
    engine.record(miss());
    engine.record(treble(n));
    engine.record(miss());
    engine.record(miss());
  }
  engine.record(miss());
  engine.record(miss());
  engine.record(miss());
  return [...engine.facts().turns];
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd app && npm test -- tests/lib/game/cricket-play.data.test.ts`
Expected: FAIL, `cricketMarksView` not exported and `maybeRunBotVisit`/`botThrowing` undefined. Confirm the failures are those, not a fixture error.

- [ ] **Step 3: Implement**

`app/src/lib/game/types.ts`: in `CricketPlayContext` add (beside the existing members; import `BotFlight` if not already in scope in this file, it is used by `Bobs27PlayContext`):

```ts
  botThrowing: boolean;
  botFlight: BotFlight | null;
  maybeRunBotVisit(this: CricketPlayContext): Promise<void>;
```

`app/src/lib/game/cricket-play.data.ts`:

Imports to add/merge:
```ts
import { botThrowObservation, findBotSeat } from "@lib/game/play-bot-seat";
import { chooseTarget } from "@modules/dartbot/strategy/marks.strategy.module";
```
Merge into the existing `play-lifecycle` import: `playRunBotVisualBoardVisit`, `undoToActiveSeat`. Import types `DartbotSeat` from `@lib/types`, `MarksView` from `@modules/interfaces`, `BotDartThrower` from `./types`.

Add above `cricketPlay`:

```ts
/**
 * Flattens the engine's two-seat state into the strategy's view: the bot's
 * own marks and its opponent's, per objective, in `CRICKET_OBJECTIVES` order.
 * @throws when the bot or its opponent has no seat in the state.
 */
export function cricketMarksView(
  state: CricketState,
  botRef: string,
): MarksView {
  const own = state.seats.find((seat) => seat.participantRef === botRef);
  const opponent = state.seats.find((seat) => seat.participantRef !== botRef);
  if (!own || !opponent) {
    throw new Error("DartBot has no opponent in this session's engine state");
  }
  return {
    objectives: CRICKET_OBJECTIVES.map((targetNumber, index) => ({
      targetNumber,
      own: own.marks[index],
      opponent: opponent.marks[index],
    })),
  };
}

function throwBotDart(context: CricketPlayContext, botSeat: DartbotSeat) {
  const state = context.state();
  if (!state) throw new Error("DartBot has no session state to read");
  const intent = chooseTarget(cricketMarksView(state, botSeat.participantRef));
  return botThrowObservation(botSeat, context.$store.game.turns, intent);
}
```

In the `cricketPlay()` object add `botThrowing: false, botFlight: null,` after `ring`, and change:

```ts
    async init(this: CricketPlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, resumeEngine);
      await this.maybeRunBotVisit();
    },
```
```ts
    async commitDart(this: CricketPlayContext, observation: DartObservation) {
      await playCommitDart(this, observation);
      await this.maybeRunBotVisit();
    },

    async maybeRunBotVisit(this: CricketPlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (!botSeat) return;
      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
    },

    async undoVisit(this: CricketPlayContext) {
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
`playRunBotVisualBoardVisit` is called without `wouldComplete`: the engine's own `isComplete()` decides, as in the human path.

- [ ] **Step 4: Run them to see them pass**

Run: `cd app && npm test -- tests/lib/game/cricket-play.data.test.ts`
Expected: PASS, including all pre-existing tests. If `ends the game on the bot's winning dart` fails on the fixture, fix the fixture per the note in Step 1, never the assertions.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game app/tests/lib/game/cricket-play.data.test.ts
git commit -m "feat(game): Cricket DartBot play loop" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg"
```

---

### Task 4: Admission and setup

**Files:**
- Modify: `app/src/lib/game/rulesets/capabilities.ts`
- Modify: `app/src/lib/game/cricket-setup.data.ts`
- Modify: `app/src/components/layout/games/setup/CricketSetupForm.astro`
- Modify: `app/tests/lib/game/rulesets/capabilities.test.ts`
- Modify: `app/tests/lib/game/cricket-setup.data.test.ts`

**Interfaces:**
- Consumes: `PresetSetupContext.bot: { level: number } | null`.
- Produces: `supportsDartbot("CRICKET_V2") === true`; setup creates `CRICKET_V2` when `guests.length > 0 || bot !== null`.

- [ ] **Step 1: Write the failing tests**

`capabilities.test.ts`: in the `RULESET_DARTBOT` test rename "thirteen" to "fourteen" and insert `"CRICKET_V2",` after `"BOBS27_V2",` in the expected list. Replace the `has no dartbot` test:

```ts
  it("admits a dartbot", () => {
    expect(supportsDartbot("CRICKET_V2")).toBe(true);
  });

  it("keeps solo Cricket without a dartbot", () => {
    expect(supportsDartbot("CRICKET_V1")).toBe(false);
  });
```

`cricket-setup.data.test.ts`, after the guest test:

```ts
    it("selects CRICKET_V2 when a DartBot is added and sends no overrides", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        bot: { level: 8 },
      });
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
          {
            ref: "participant-2",
            displayName: "DartBot",
            participantTypeKey: "DARTBOT",
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesetVersionKey: "CRICKET_V2",
          config: { source: "template", templateRef: "tmpl-standard" },
        }),
      );
    });
```
If `createSetup` rejects `bot` in `overrides` for typing, it is already `Partial<CricketSetupContext>` and `bot` is part of `SetupSessionContext`; no cast needed.

- [ ] **Step 2: Run them to see them fail**

Run: `cd app && npm test -- tests/lib/game/rulesets/capabilities.test.ts tests/lib/game/cricket-setup.data.test.ts`
Expected: FAIL, the capability lists differ and the bot setup creates `CRICKET_V1`.

- [ ] **Step 3: Implement**

`capabilities.ts`: add `CRICKET_V2: true,` after `BOBS27_V2: true,` in `RULESET_DARTBOT`. In the doc comment above it, append one sentence after the `SCORE_TRAINING_V1` sentence: `` `CRICKET_V2` is on `MarksStrategy` (`marks.strategy.module.ts`), the first strategy that chooses its own target. ``

`cricket-setup.data.ts`:

```ts
    rulesetVersionKey: (ctx) =>
      ctx.guests.length > 0 || ctx.bot !== null ? "CRICKET_V2" : "CRICKET_V1",
```

`CricketSetupForm.astro`: add `import { supportsDartbot } from "@lib/game/rulesets/capabilities";` with the other frontmatter imports (match the import placement in `Bobs27SetupForm.astro`), replace the user section with
```astro
  <UserSection
    allowGuests
    allowDartbot={supportsDartbot("CRICKET_V2")}
  />
```
and change the info description's last sentence start from "Add a guest for 1v1:" to "Add a guest or a DartBot for 1v1:".

- [ ] **Step 4: Run them to see them pass, then the wider suite**

Run: `cd app && npm test -- tests/lib/game/rulesets/capabilities.test.ts tests/lib/game/cricket-setup.data.test.ts`
Expected: PASS.
Run: `cd app && npm test`
Expected: PASS. Any other test that asserted `CRICKET_V2` has no bot (search `supportsDartbot\|RULESET_DARTBOT` in `tests/` if one fails) is rewritten to the new fact, not deleted.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game app/src/components app/tests
git commit -m "feat(game): admit a DartBot seat on Cricket V2" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg"
```

---

### Task 5: Bot-vs-bot contract and skill ordering

**Files:**
- Create: `app/tests/modules/dartbot/harness/cricket-dartbot-seat.contract.test.ts`

**Interfaces:**
- Consumes: `cricketV2EngineFactory`, `CricketEngine` (`@modules/game/cricket.engine.module`), `chooseTarget` (Task 1), `botThrowObservation` (Task 2), `cricketMarksView` (Task 3).

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it } from "vitest";
import {
  CricketEngine,
  cricketV2EngineFactory,
} from "@modules/game/cricket.engine.module";
import { botThrowObservation } from "@lib/game/play-bot-seat";
import { cricketMarksView } from "@lib/game/cricket-play.data";
import { chooseTarget } from "@modules/dartbot/strategy/marks.strategy.module";
import type { DartbotSeat, Seated, CricketSnapshot } from "@lib/types";

const MAX_DARTS = 2000;
const GAMES_PER_SIDE = 40;

function seat(
  ref: string,
  sideKey: string,
  level: number,
  seed: number,
): DartbotSeat {
  return {
    participantRef: ref,
    displayName: ref,
    sideKey,
    participantTypeKey: "DARTBOT",
    dartbot: { level, seed, levelSource: "MANUAL" },
  };
}

function playGame(seats: readonly [DartbotSeat, DartbotSeat]): string {
  const engine = cricketV2EngineFactory.create({
    seats,
  } as Seated<CricketSnapshot>) as CricketEngine;
  for (let darts = 0; darts < MAX_DARTS; darts += 1) {
    const state = engine.state();
    const active = seats.find(
      (s) => s.participantRef === state.activeParticipantRef,
    )!;
    const intent = chooseTarget(cricketMarksView(state, active.participantRef));
    const { observation } = botThrowObservation(
      active,
      engine.facts().turns,
      intent,
    );
    engine.record(observation);
    if (engine.isComplete()) {
      return engine.state().winnerParticipantRef!;
    }
  }
  throw new Error("game did not terminate");
}

describe("Cricket DartBot seat contract", () => {
  it("terminates every game with a winner", () => {
    const winner = playGame([seat("a", "A", 8, 1), seat("b", "B", 8, 2)]);
    expect(["a", "b"]).toContain(winner);
  });

  it("is deterministic for the same seeds", () => {
    const run = () => playGame([seat("a", "A", 8, 7), seat("b", "B", 8, 9)]);
    expect(run()).toBe(run());
  });

  it("a level-12 bot beats a level-4 bot in a clear majority of games", () => {
    let strongWins = 0;
    let games = 0;
    for (let i = 0; i < GAMES_PER_SIDE; i += 1) {
      const strongFirst = playGame([
        seat("strong", "A", 12, 100 + i),
        seat("weak", "B", 4, 500 + i),
      ]);
      const weakFirst = playGame([
        seat("weak", "A", 4, 900 + i),
        seat("strong", "B", 12, 1300 + i),
      ]);
      strongWins += Number(strongFirst === "strong");
      strongWins += Number(weakFirst === "strong");
      games += 2;
    }
    expect(strongWins / games).toBeGreaterThan(0.6);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd app && npm test -- tests/modules/dartbot/harness/cricket-dartbot-seat.contract.test.ts`
Expected: PASS in under two seconds. This is a contract over code that exists (Tasks 1–3), so it is expected to pass first run; if it fails, that is a real finding: apply `superpowers:systematic-debugging`, do not loosen the threshold. If the ordering assertion is flaky across seeds, it is not (seeds are fixed); a failure means the strategy or throw pipeline is wrong. If the run exceeds two seconds, lower `GAMES_PER_SIDE`, keeping the threshold.

- [ ] **Step 3: Remove the dupes scratch file and compare**

Run: `cd app && npx fallow dupes --mode semantic --min-tokens 30 > ../.superpowers-dupes-after.txt 2>&1; diff ../.superpowers-dupes-before.txt ../.superpowers-dupes-after.txt; rm ../.superpowers-dupes-*.txt`
Expected: no new clone group in `cricket-play.data.ts`, `play-bot-seat.ts` or the new strategy. A new group blocks the task: extract or fix, then re-run.
Run: `cd app && npx fallow health 2>&1 | tail -15`
Expected: CRAP ≤ 30 and cyclomatic ≤ 20 for the changed files. If the CLI differs, use the invocation `validate-app` names.

- [ ] **Step 4: Commit**

```bash
git add app/tests/modules/dartbot/harness/cricket-dartbot-seat.contract.test.ts
git commit -m "test(dartbot): Cricket bot-vs-bot contract" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg"
```

---

### Task 6: Docs, decision, gates

**Files:**
- Modify: `docs/architecture/08-DartBot.md`
- Modify: `docs/game-rules/rulesets/cricket.md` (via the `authoring-game-rules` amend path)
- Modify: `decisions/<domain file per DECISIONS.md routing>`
- Modify: `docs/architecture/00-Context-Map-History.md`

- [ ] **Step 1: 08-DartBot.md**

Add a coverage-table row after `TUOD_V1`:
```
| `CRICKET_V2`          | DETAILED_DARTS · VISUAL_BOARD      | `PER_SEAT`       | Marks          | `DartObservation` per dart                                                 |
```
After the "X01 ladder … Score Training" paragraph add one paragraph: Cricket V2 uses `marks.strategy.module.ts`, the first strategy that chooses its own target; it ranks block, then score, then close in fixed order 20…15, bull, aims treble (inner bull for the bull), reads no points, and applies no decision-quality degrading. Under §GameView contracts add the `MarksView` snippet beside `X01View`. `grep -n "Marks\|marks\|no engine work stands" docs/architecture/08-DartBot.md` and correct any sentence that now reads stale (for example one claiming every ruleset's strategy is Dictated, Score Training or X01). Add an ISO date `2026-10-24` to each changed row.

- [ ] **Step 2: cricket.md**

Invoke the `authoring-game-rules` skill and follow `references/amending.md`: move the "Vs DartBot" Features row and its Later-versions entry from `V2+` to `V3`, record that the marks strategy unblocked it, keep the Glossary term verbatim inside the Features row name, and bring `Current version:` in line only as that reference directs. Run `bash scripts/check-game-rules.sh` and `bash scripts/test-check-game-rules.sh`.

- [ ] **Step 3: Decision**

Read `DECISIONS.md` "How to add a decision". Derive the id with `bash scripts/next-decision-id.sh`. Append one block to the routed domain file (DartBot or game-engine per the routing table) stating: the first strategy that chooses its own target; the ladder and fixed objective order; no decision-degrading in V1; the bot is a seat type on `CRICKET_V2`, not a new ruleset key; `Supersedes:` none. Never edit an existing block. Run `bash scripts/check-decision-ids.sh`.

- [ ] **Step 4: Context map history and gates**

Append the version entry to `docs/architecture/00-Context-Map-History.md` (not to `00-Context-Map.md`). Stage the docs edits so `check-doc-sync` sees them. Run the `context-maintenance` skill checklist and the `run-all-gates` skill: the always-run list plus the `app/` list (`npm run validate:app`; the `db:*` steps need `DATABASE_URL` and are reported as not run if absent, never as passed). Run `cd app && npm run format && npm run format:check`.
Expected: every applicable script `OK`.

- [ ] **Step 5: Commit**

```bash
git add docs decisions
git commit -m "docs(dartbot): Cricket marks strategy" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg"
```

---

### Task 7: Visual check and discovered work

- [ ] **Step 1: Visual check**

Use the `run` skill. Playwright, mocked API, 390×844: open Cricket setup, pick DartBot, start, watch one bot visit animate (flight reticle, visit strip), undo back to the human, finish a game. Save screenshots in the scratchpad; do not commit them. State in the completion report exactly what was and was not exercised.

- [ ] **Step 2: Discovered work**

File one `discovered-work` issue per the `capturing-discovered-work` skill: the per-dart throw block in `five-oh-one-play.data.ts` and `bobs27-play.data.ts` duplicates `botThrowObservation`; migrate them onto it. Also file one if the Play Again starter step (`playAgainStarterData`) is absent for Cricket bot sessions and a player would expect it; check Bob's 27's bot Play Again behaviour first and file only a confirmed gap. Name both (number and one line) in the completion report.

- [ ] **Step 3: Finish**

Use `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch`: push, open the PR (Option 2), `subscribe_pr_activity`. PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and the session link.
