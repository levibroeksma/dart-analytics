# Single Opponent Seat — Remaining 7 Engines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a real, playable 1v1 (2-seat max) opponent into the seven engines still solo-only — Bob's 27, 121, Around the Clock, TUOD, Shanghai, Score Training, Singles Training, Doubles Training — following the design in `docs/superpowers/specs/2026-08-22-single-opponent-seat-remaining-engines-design.md`.

**Architecture:** Every engine's flat single-seat state becomes a `MultiSeatState<TSeat>` (the `FiveOhOneState` precedent from the X01 guest-player work): per-seat progress folded independently by filtering `this.turns` on `participantRef`, plus match-level `status`/`winningSideKey` derived through a new shared `match-outcome.module.ts` (`eliminationWinner` for Bob's 27, `raceWinner` for 121, `scoreCompareWinner` for the other five). `seat-rota.module.ts`'s `activeSeat()` gains an optional completion predicate so Around the Clock can skip a seat that has already finished its own circuit. `session-seats.service.ts` swaps its single `MULTI_SEAT_RULESET` gate for a `SEAT_CAPS` map. Every setup form gains one prop (`<UserSection allowGuests />`); every play interface branches on `state()?.seats.length` to render `SplitScoreboard` instead of `SinglePlayerDisplay`, exactly as `FiveOhOne.astro` already does; every `*-play.data.ts` gains `xFor(seatRef)` accessor variants of its existing display methods.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Vitest. No new libraries.

## Global Constraints

- Completed gameplay is immutable; corrections create new records (root `CLAUDE.md`).
- Statistics live in views only — never persisted; every per-seat field here is derived from `facts()` on every read, never stored (root `CLAUDE.md`, `app/CLAUDE.md`).
- IDs: UUIDv7 for domain entities, minted by the app/Worker — this plan mints none (seats already exist).
- `undo()` must be an exact inverse of `record()`; undo depth unbounded (`app/CLAUDE.md`). None of the seven engines' `undo()` methods change in this plan — they are already index-based on `this.turns` and need no seat-awareness (design spec, "Engine layer" section).
- `completedAt` stamped only when a visit resolves, cleared when `undo()` reopens one — unchanged per engine.
- Never store a value the fact log can derive — no accumulated score, points, ratio or average fields.
- `state()`/`facts()` return derived copies, never a live field or shared constant.
- A source edit with no test edit fails `scripts/check-test-coverage.sh` — every task below pairs source changes with test changes in the same commit.
- `bash scripts/check-game-engines.sh` must pass after every engine change.
- Minimal diffs; a solo (`seats.length === 1`) session must reproduce today's exact behavior — the no-regression anchor named in the design spec.
- Full validation before any task is marked done: `cd app && npm run validate:app` (per `validate-app` skill).
- Run `cd app && npm run format` and confirm `npm run format:check` is clean before any PR (per `app/CLAUDE.md`).
- Context Maintenance (root `CLAUDE.md`) runs once, in the final task, after every other task lands — not per-task.

## Plan-time correction to the design spec

Two Touch List rows in the design spec do not hold once the actual source is read, and this plan does not include tasks for them:

1. **Validators need no change.** `Seated<TConfig>` (`app/src/lib/game/rulesets/types.ts:388-391`) composes the seat array onto a config **after** each ruleset's own Zod schema parses it — the doc comment there says so explicitly ("Seats are composed in after the ruleset's own Zod schema has parsed the config, so no ruleset schema needs a `seats` key"). `session.service.ts:368` already calls `composeSeatFacts` generically for every ruleset. No `*.validator.ts` file changes.
2. **Setup forms need a one-line prop change, not a new component.** `UserSection.astro` already has an `allowGuests` prop that renders `GuestSection` internally; 501's own setup form uses `<UserSection allowGuests />`, not a bare `<GuestSection>`. Every other setup form currently passes no prop (`<UserSection />`), and `UserSection.astro`'s own doc comment says so ("Every other setup screen's ruleset 400s a second seat... so this defaults to false"). That doc comment is stale the moment the first of these seven lands and needs a same-commit fix (Task 4).

---

## Task 1: `match-outcome.module.ts` — the shared win-condition helper

**Files:**
- Create: `app/src/modules/game/match-outcome.module.ts`
- Test: `app/tests/modules/game/match-outcome.module.test.ts`

**Interfaces:**
- Produces: `eliminationWinner(seats: readonly { sideKey: string; failed: boolean }[]): string | null`, `raceWinner(seats: readonly { sideKey: string; finished: boolean }[]): string | null`, `scoreCompareWinner(seats: readonly { sideKey: string; completed: boolean; metric: number }[], direction: "HIGHEST" | "LOWEST"): string | null` — every later task in this plan imports one or more of these by exactly these names and signatures.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/game/match-outcome.module.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  eliminationWinner,
  raceWinner,
  scoreCompareWinner,
} from "@modules/game/match-outcome.module";

describe("eliminationWinner", () => {
  it("returns null while nobody has failed", () => {
    expect(
      eliminationWinner([
        { sideKey: "A", failed: false },
        { sideKey: "B", failed: false },
      ]),
    ).toBeNull();
  });

  it("returns the survivor once one side fails", () => {
    expect(
      eliminationWinner([
        { sideKey: "A", failed: true },
        { sideKey: "B", failed: false },
      ]),
    ).toBe("B");
  });

  it("returns null for a solo seat that has not failed", () => {
    expect(eliminationWinner([{ sideKey: "A", failed: false }])).toBeNull();
  });
});

describe("raceWinner", () => {
  it("returns null while nobody has finished", () => {
    expect(
      raceWinner([
        { sideKey: "A", finished: false },
        { sideKey: "B", finished: false },
      ]),
    ).toBeNull();
  });

  it("returns the side that finished", () => {
    expect(
      raceWinner([
        { sideKey: "A", finished: true },
        { sideKey: "B", finished: false },
      ]),
    ).toBe("A");
  });

  it("returns the sole seat's side once a solo session finishes", () => {
    expect(raceWinner([{ sideKey: "A", finished: true }])).toBe("A");
  });
});

describe("scoreCompareWinner", () => {
  it("returns null while any seat is incomplete", () => {
    expect(
      scoreCompareWinner(
        [
          { sideKey: "A", completed: true, metric: 10 },
          { sideKey: "B", completed: false, metric: 5 },
        ],
        "HIGHEST",
      ),
    ).toBeNull();
  });

  it("returns the higher metric's side under HIGHEST", () => {
    expect(
      scoreCompareWinner(
        [
          { sideKey: "A", completed: true, metric: 10 },
          { sideKey: "B", completed: true, metric: 7 },
        ],
        "HIGHEST",
      ),
    ).toBe("A");
  });

  it("returns the lower metric's side under LOWEST", () => {
    expect(
      scoreCompareWinner(
        [
          { sideKey: "A", completed: true, metric: 10 },
          { sideKey: "B", completed: true, metric: 7 },
        ],
        "LOWEST",
      ),
    ).toBe("B");
  });

  it("returns null on a tie", () => {
    expect(
      scoreCompareWinner(
        [
          { sideKey: "A", completed: true, metric: 10 },
          { sideKey: "B", completed: true, metric: 10 },
        ],
        "HIGHEST",
      ),
    ).toBeNull();
  });

  it("returns the sole seat's side once a solo session completes", () => {
    expect(
      scoreCompareWinner([{ sideKey: "A", completed: true, metric: 10 }], "HIGHEST"),
    ).toBe("A");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/match-outcome.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/game/match-outcome.module'`

- [ ] **Step 3: Write the implementation**

Create `app/src/modules/game/match-outcome.module.ts`:

```ts
/**
 * The side that survived, or null while nobody has failed yet. Elimination
 * games (Bob's 27) end the instant one seat fails — the match never asks
 * this again after that, so a tie (every seat failed at once) is not a real
 * case for turn-based play and falls through to null rather than guessing.
 */
export function eliminationWinner(
  seats: readonly { sideKey: string; failed: boolean }[],
): string | null {
  const survivors = seats.filter((seat) => !seat.failed);
  if (survivors.length === seats.length) return null;
  return survivors.length === 1 ? survivors[0].sideKey : null;
}

/**
 * The side that reached the finish line, or null while nobody has. Race
 * games (121) end the instant one seat finishes, so at most one seat is ever
 * `finished` at a time in practice; this reads whichever is.
 */
export function raceWinner(
  seats: readonly { sideKey: string; finished: boolean }[],
): string | null {
  const finishers = seats.filter((seat) => seat.finished);
  return finishers.length === 1 ? finishers[0].sideKey : null;
}

/**
 * The side with the best metric, once every seat has completed its session —
 * null while any seat is still playing, and null on a tie (deferred
 * tiebreak). `direction` picks whether "best" is highest or lowest, since
 * Around the Clock's metric (darts to complete) inverts the usual
 * highest-wins rule the other score-compare games use.
 */
export function scoreCompareWinner(
  seats: readonly { sideKey: string; completed: boolean; metric: number }[],
  direction: "HIGHEST" | "LOWEST",
): string | null {
  if (seats.some((seat) => !seat.completed)) return null;

  const best =
    direction === "HIGHEST"
      ? Math.max(...seats.map((seat) => seat.metric))
      : Math.min(...seats.map((seat) => seat.metric));
  const winners = seats.filter((seat) => seat.metric === best);
  return winners.length === 1 ? winners[0].sideKey : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/match-outcome.module.test.ts`
Expected: PASS — 11 tests

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/match-outcome.module.ts app/tests/modules/game/match-outcome.module.test.ts
git commit -m "feat: add match-outcome module for elimination/race/score-compare winners"
```

---

## Task 2: `activeSeat()` gains completion awareness

**Files:**
- Modify: `app/src/modules/game/seat-rota.module.ts:43-65`
- Test: `app/tests/modules/game/seat-rota.module.test.ts` (extend — do not remove existing cases)

**Interfaces:**
- Consumes: nothing new.
- Produces: `activeSeat(facts, seats, stageOwnership, isSeatComplete?)` — the 4th parameter is optional and defaults to `() => false`, so every existing call site (501's `activeSeat(facts, config.seats, "SHARED")`, and every 3-arg call this plan's later tasks add for the six engines that never need completion-awareness) is unaffected. Only Around the Clock (Task 9) passes a real predicate.

- [ ] **Step 1: Write the failing test**

Add to `app/tests/modules/game/seat-rota.module.test.ts` (alongside the existing `describe("activeSeat", ...)` block — add a new nested `describe`, do not edit existing cases):

```ts
describe("activeSeat with a completion predicate", () => {
  const seats = [
    { participantRef: "p1", displayName: "A", sideKey: "A", participantTypeKey: "PLAYER" as const },
    { participantRef: "p2", displayName: "B", sideKey: "B", participantTypeKey: "GUEST" as const },
  ];

  function closedTurn(participantRef: string, sequence: number) {
    return {
      clientKey: `turn-${sequence}`,
      stageClientKey: "block-1",
      participantRef,
      sequence,
      completedAt: "2026-08-22T00:00:00.000Z",
      totalScore: 0,
      darts: [],
    };
  }

  it("alternates normally while neither seat is complete", () => {
    const facts = {
      stages: [{ clientKey: "block-1", stageTypeKey: "EXERCISE_BLOCK" as const, parentClientKey: null, sequence: 1 }],
      turns: [closedTurn("p1", 1)],
    };
    expect(
      activeSeat(facts, seats, "PER_SEAT", () => false).participantRef,
    ).toBe("p2");
  });

  it("skips a seat the predicate reports complete, handing every later turn to the other", () => {
    const facts = {
      stages: [{ clientKey: "block-1", stageTypeKey: "EXERCISE_BLOCK" as const, parentClientKey: null, sequence: 1 }],
      turns: [closedTurn("p1", 1), closedTurn("p2", 2), closedTurn("p1", 3)],
    };
    const isComplete = (seat: { participantRef: string }) => seat.participantRef === "p1";
    expect(activeSeat(facts, seats, "PER_SEAT", isComplete).participantRef).toBe(
      "p2",
    );
  });

  it("defaults to pure alternation when no predicate is passed", () => {
    const facts = {
      stages: [{ clientKey: "block-1", stageTypeKey: "EXERCISE_BLOCK" as const, parentClientKey: null, sequence: 1 }],
      turns: [closedTurn("p1", 1)],
    };
    expect(activeSeat(facts, seats, "PER_SEAT").participantRef).toBe("p2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/seat-rota.module.test.ts`
Expected: FAIL — `activeSeat` only accepts 3 arguments (TS error) or the "skips a seat" case returns `p1` instead of `p2`.

- [ ] **Step 3: Write the implementation**

In `app/src/modules/game/seat-rota.module.ts`, replace the `activeSeat` function (lines 43-65):

```ts
/**
 * Whose throw it is, derived from the fact log and the seat list — never
 * stored, so a page refresh mid-leg restores it with nothing persisted.
 *
 * A visit still open always holds its own seat, whichever stage shape the
 * engine has: the thrower keeps the turn until it resolves. Otherwise a
 * `SHARED` engine counts the visits already thrown in the OPEN stage and
 * offsets them from that stage's own starting seat, so the rotation survives
 * a leg boundary; a `PER_SEAT` engine counts the whole log, because every
 * seat's stages advance in lockstep — except a seat `isSeatComplete` reports
 * finished, which is skipped so every remaining turn goes to whichever seat
 * has not: Around the Clock plays a variable number of visits per seat (a
 * miss costs an extra one), so lockstep alternation alone cannot describe
 * whose throw it is once one seat has already finished. Every other engine
 * either never calls with a real predicate or ends the match before two
 * seats could diverge, so the default `() => false` reproduces the old pure
 * alternation exactly.
 */
export function activeSeat(
  facts: EngineFacts,
  seats: readonly SeatFact[],
  stageOwnership: StageOwnership,
  isSeatComplete: (seat: SeatFact) => boolean = () => false,
): SeatFact {
  const lastTurn = facts.turns.at(-1);
  if (lastTurn && lastTurn.completedAt === null) {
    return seatOf(lastTurn, seats);
  }

  if (stageOwnership === "PER_SEAT") {
    const remaining = seats.filter((seat) => !isSeatComplete(seat));
    const pool = remaining.length > 0 ? remaining : seats;
    return pool[facts.turns.length % pool.length];
  }

  const openStage = facts.stages.at(-1);
  if (!openStage) return seats[0];

  const thrownInStage = facts.turns.filter(
    (turn) => turn.stageClientKey === openStage.clientKey,
  ).length;
  const start = startingSeatFor(openStage.sequence - 1, seats.length);
  return seats[(start + thrownInStage) % seats.length];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/seat-rota.module.test.ts`
Expected: PASS — all existing cases plus the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/seat-rota.module.ts app/tests/modules/game/seat-rota.module.test.ts
git commit -m "feat: activeSeat skips a completed seat when stage ownership is PER_SEAT"
```

---

## Task 3: `SEAT_CAPS` replaces the single-ruleset gate

**Files:**
- Modify: `app/src/services/session-seats.service.ts:1-63`
- Test: `app/tests/services/session-seats.service.test.ts` (extend)

**Interfaces:**
- Produces: `rejectSeatRequest` keeps its exact existing signature `(participants, rulesetVersionKey) => string | null`; only its internal cap check changes. `composeSeatFacts` is untouched.

- [ ] **Step 1: Write the failing test**

Add to `app/tests/services/session-seats.service.test.ts`:

```ts
describe("rejectSeatRequest with the seven new rulesets", () => {
  const twoPlayers = [
    { participantTypeKey: "PLAYER" as const, sideKey: "A", displayName: "Me" },
    { participantTypeKey: "GUEST" as const, sideKey: "B", displayName: "Guest" },
  ];
  const threePlayers = [
    ...twoPlayers,
    { participantTypeKey: "GUEST" as const, sideKey: "C", displayName: "Guest 2" },
  ];

  it.each([
    "BOBS27_V1",
    "121_V1",
    "AROUND_THE_CLOCK_V1",
    "TUOD_V1",
    "SHANGHAI_V1",
    "SCORE_TRAINING_V1",
    "SINGLES_V1",
    "DOUBLES_TRAINING_V1",
  ])("accepts exactly 2 seats for %s", (rulesetVersionKey) => {
    expect(rejectSeatRequest(twoPlayers, rulesetVersionKey)).toBeNull();
  });

  it.each([
    "BOBS27_V1",
    "121_V1",
    "AROUND_THE_CLOCK_V1",
    "TUOD_V1",
    "SHANGHAI_V1",
    "SCORE_TRAINING_V1",
    "SINGLES_V1",
    "DOUBLES_TRAINING_V1",
  ])("rejects a 3rd seat for %s", (rulesetVersionKey) => {
    expect(rejectSeatRequest(threePlayers, rulesetVersionKey)).toContain(
      "supports at most 2 seat",
    );
  });

  it("still rejects a 2nd seat for a ruleset not in SEAT_CAPS", () => {
    expect(rejectSeatRequest(twoPlayers, "SOME_FUTURE_RULESET_V1")).toContain(
      "supports at most 1 seat",
    );
  });

  it("still accepts 4 seats for 501", () => {
    const four = [
      ...twoPlayers,
      { participantTypeKey: "GUEST" as const, sideKey: "C", displayName: "Guest 2" },
      { participantTypeKey: "GUEST" as const, sideKey: "D", displayName: "Guest 3" },
    ];
    expect(rejectSeatRequest(four, "501_V1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/services/session-seats.service.test.ts`
Expected: FAIL — every non-501 ruleset still returns `"Multiple seats are only supported by 501_V1."` instead of `null`/the new message.

- [ ] **Step 3: Write the implementation**

In `app/src/services/session-seats.service.ts`, replace lines 1-63 (everything through the end of `rejectSeatRequest`, keeping `composeSeatFacts` below untouched):

```ts
import type { SeatFact } from "@lib/types";
import type { ParticipantInputData } from "@routes/types";
import type { SeatPlan } from "./types";

const MIN_SEATS = 1;
const MAX_SEATS = 4;
const PLAYER_PARTICIPANT_TYPE_ID = 1;

/**
 * The most seats a session may request, keyed by ruleset version. A ruleset
 * with no entry defaults to 1 — the same "reject any 2nd seat" behavior
 * every non-501 ruleset had before this map existed. 501 alone keeps room
 * for a future 2v2 (D-something, X01 guest-player design); the other eight
 * are wired for exactly one opponent (1v1) and never more, per
 * `2026-08-22-single-opponent-seat-remaining-engines-design.md`.
 */
const SEAT_CAPS: Record<string, number> = {
  "501_V1": 4,
  BOBS27_V1: 2,
  "121_V1": 2,
  AROUND_THE_CLOCK_V1: 2,
  TUOD_V1: 2,
  SHANGHAI_V1: 2,
  SCORE_TRAINING_V1: 2,
  SINGLES_V1: 2,
  DOUBLES_TRAINING_V1: 2,
};

/**
 * Why a requested seat list cannot be created, or null when it can. The
 * session is never created on a rejection — participants, snapshot and
 * session share one transaction, so there is no half-built session with
 * orphan participants.
 *
 * Duplicate guest display names are deliberately allowed: two people called
 * Jan is a real Friday night, seats are identified by ref rather than name,
 * and the scoreboard disambiguates visually rather than by refusing valid
 * input.
 *
 * Two seats on one side is the guard that stops 2v2 preparation from
 * silently half-working: `sideKey` and per-side folding exist, the pairing
 * does not. A ruleset's own cap in `SEAT_CAPS` is the guard that stops a
 * session persisting a participant nothing can throw for.
 */
export function rejectSeatRequest(
  participants: ParticipantInputData[] | undefined,
  rulesetVersionKey: string,
): string | null {
  if (participants === undefined) return null;

  if (participants.length < MIN_SEATS || participants.length > MAX_SEATS) {
    return `A session needs between ${MIN_SEATS} and ${MAX_SEATS} seats.`;
  }

  const players = participants.filter(
    (participant) => participant.participantTypeKey === "PLAYER",
  );
  if (players.length !== 1) {
    return "A session needs exactly one PLAYER seat, the session owner.";
  }

  const unnamedGuest = participants.some(
    (participant) =>
      participant.participantTypeKey === "GUEST" &&
      (participant.displayName ?? "").trim().length === 0,
  );
  if (unnamedGuest) {
    return "Every guest needs a name.";
  }

  const sides = new Set(participants.map((participant) => participant.sideKey));
  if (sides.size !== participants.length) {
    return "Only one seat per side is supported; 2v2 is not implemented yet.";
  }

  const cap = SEAT_CAPS[rulesetVersionKey] ?? 1;
  if (participants.length > cap) {
    return `${rulesetVersionKey} supports at most ${cap} seat${cap === 1 ? "" : "s"}.`;
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/services/session-seats.service.test.ts`
Expected: PASS — all existing cases plus the new ones.

- [ ] **Step 5: Commit**

```bash
git add app/src/services/session-seats.service.ts app/tests/services/session-seats.service.test.ts
git commit -m "feat: replace the single 501 seat gate with a per-ruleset SEAT_CAPS map"
```

---

## Task 4: Every setup form gains `allowGuests` and its `start()` sends the guest as a participant

**Files:**
- Modify: `app/src/lib/game/types.ts:406-434, 446-452` (`PresetSetupContext`, `PresetSetupControllerOptions`)
- Modify: `app/src/lib/game/setup-controller.ts` (`createPresetSetupController`)
- Test: `app/tests/lib/game/setup-controller.test.ts` (extend)
- Modify: `app/src/components/layout/games/setup/UserSection.astro:1-11` (doc comment only)
- Modify: `app/src/components/layout/games/setup/Bobs27SetupForm.astro:16`
- Modify: `app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/AroundTheClockSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/ShanghaiSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/TuodSetupForm.astro:23` (markup only — its guest-state wiring is Task 11)
- Modify: `app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro:24` (markup only — its guest-state wiring is Task 15)

`createPresetSetupController` backs six of the seven remaining setup pages — Bob's 27, Shanghai, 121, Around the Clock, Singles Training, Doubles Training (`bobs27-setup.data.ts`, `shanghai-setup.data.ts`, `one-twenty-one-setup.data.ts`, `around-the-clock-setup.data.ts`, `singles-training-setup.data.ts`, `doubles-training-setup.data.ts` are each a thin ~10-line wrapper calling it, confirmed by reading `bobs27-setup.data.ts` and `one-twenty-one-setup.data.ts`) — so adding guest support there once covers all six; none of those six wrapper files change. TUOD and Score Training "replace `start` wholesale" (per `setup-controller.ts`'s own doc comment) and get their own guest wiring in Task 11 and Task 15, where the ROUNDS-only-for-1v1 restriction also lives (TIMED stays solo-only, per the design spec — a restriction that only applies to those two).

`.astro` markup is exempt from `scripts/check-test-coverage.sh`'s pairing requirement — there is no Astro-component test runner in this project (`app/CLAUDE.md`, D101), so the `.astro` steps below need no test step. `setup-controller.ts` is a plain `.ts` module and does need one (Step 2).

- [ ] **Step 1: Add guest state and participant-building to `PresetSetupContext` and `createPresetSetupController`**

In `app/src/lib/game/types.ts`, replace the `PresetSetupContext` type (lines 406-434):

```ts
export type PresetSetupContext = {
  presets: ConfigurationPresetData[];
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  guests: { displayName: string }[];
  showAddGuestModal: boolean;
  newGuestName: string;
  $store: {
    game: {
      sessionId: string | null;
      startSession(input: unknown): void;
      reset(): void;
    };
    settings: {
      captureModeKey: string;
      inputModeKey: string;
    };
  };
  init(this: PresetSetupContext): Promise<void>;
  reconcile(
    this: PresetSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: PresetSetupContext): Promise<void>;
  continueSession(this: PresetSetupContext): void;
  abandonSession(this: PresetSetupContext): Promise<void>;
  addGuest(this: PresetSetupContext): void;
  removeGuest(this: PresetSetupContext, index: number): void;
  start(this: PresetSetupContext): Promise<void>;
};
```

(`$store.settings`'s two fields are read elsewhere in the existing type and are left exactly as they were — only `guests`/`showAddGuestModal`/`newGuestName`/`addGuest`/`removeGuest` are new.)

In `app/src/lib/game/setup-controller.ts`, add three fields to the returned object literal, right after `reconciliationFailed: false,` (line 48):

```ts
    guests: [] as { displayName: string }[],
    showAddGuestModal: false,
    newGuestName: "",
```

Add two methods, right after `abandonSession` (after line 118, before `async start(this: Ctx) {`):

```ts
    addGuest(this: Ctx) {
      if (this.guests.length >= 1) return;
      const name = this.newGuestName.trim();
      if (!name) return;
      this.guests.push({ displayName: name });
      this.newGuestName = "";
      this.showAddGuestModal = false;
    },

    removeGuest(this: Ctx, index: number) {
      this.guests.splice(index, 1);
    },
```

Inside `start(this: Ctx)`, add the `participants` array and thread it into `createSession`. Replace:

```ts
        const session = await createSession({
          gameTypeKey,
          rulesetVersionKey,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            ...(overrides ? { overrides } : {}),
          },
        });
```

with:

```ts
        const participants = this.guests.length
          ? [
              { participantTypeKey: "PLAYER" as const, sideKey: "A" },
              { participantTypeKey: "GUEST" as const, displayName: this.guests[0].displayName, sideKey: "B" },
            ]
          : undefined;
        const session = await createSession({
          gameTypeKey,
          rulesetVersionKey,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            ...(overrides ? { overrides } : {}),
          },
          participants,
        });
```

`this.guests.length >= 1` in `addGuest` caps these six games at exactly one guest — a 1v1 opponent, never a 2v2 roster — matching the `2`-seat `SEAT_CAPS` entries Task 3 gave each of them; this mirrors 501's own `addGuest` guard (`five-oh-one-setup.data.ts:102`), just at cap 1 instead of 501's higher one.

- [ ] **Step 2: Write the test**

Add to `app/tests/lib/game/setup-controller.test.ts` (create it if this module has no test file yet):

```ts
import { describe, it, expect, vi } from "vitest";
import { createPresetSetupController } from "@lib/game/setup-controller";

vi.mock("@client/api/configuration-templates", () => ({
  fetchConfigurationPresets: vi.fn().mockResolvedValue([
    { configurationTemplateId: "tmpl-1", configuration: {} },
  ]),
}));
vi.mock("@client/api/sessions", () => ({
  fetchActiveSessions: vi.fn().mockResolvedValue([]),
  createSession: vi.fn().mockResolvedValue({ sessionId: "s1", participants: [] }),
  completeSession: vi.fn(),
}));
vi.mock("@lib/game/rulesets/config-codec", () => ({
  toSnapshot: vi.fn().mockReturnValue({}),
}));
vi.mock("@lib/game/session-recovery", () => ({
  reconcileActiveSession: vi.fn().mockResolvedValue({ action: "no_active" }),
}));
vi.mock("@lib/game/session-mode-resolution", () => ({
  resolveSessionModePair: vi.fn().mockReturnValue({ captureModeKey: "QUICK_SCORE", inputModeKey: "RECREATIONAL" }),
  startSessionInput: vi.fn().mockReturnValue({}),
}));

describe("createPresetSetupController guest wiring", () => {
  it("addGuest caps at one guest and start() sends a 2-seat participants array", async () => {
    const ctx = createPresetSetupController({
      gameTypeKey: "BOBS27",
      rulesetVersionKey: "BOBS27_V1",
      playHref: "/games/bobs27/play",
      label: "Bob's 27",
    }) as unknown as {
      guests: { displayName: string }[];
      newGuestName: string;
      addGuest: () => void;
      $store: { game: { startSession: () => void }; settings: Record<string, string> };
      presets: unknown[];
      start: () => Promise<void>;
    };
    ctx.$store = { game: { startSession: () => {} }, settings: {} };
    ctx.presets = [{ configurationTemplateId: "tmpl-1", configuration: {} }];

    ctx.newGuestName = "Guest 1";
    ctx.addGuest();
    ctx.newGuestName = "Guest 2";
    ctx.addGuest();
    expect(ctx.guests).toHaveLength(1);
    expect(ctx.guests[0].displayName).toBe("Guest 1");

    const { createSession } = await import("@client/api/sessions");
    await ctx.start();
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          { participantTypeKey: "GUEST", displayName: "Guest 1", sideKey: "B" },
        ],
      }),
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `cd app && npx vitest run tests/lib/game/setup-controller.test.ts`
Expected: FAIL before Step 1 (`addGuest` is not a function), PASS after.

- [ ] **Step 4: Fix the stale doc comment on `UserSection.astro`**

In `app/src/components/layout/games/setup/UserSection.astro`, replace lines 1-11:

```astro
---
/**
 * @param {boolean} [allowGuests=false] Renders `GuestSection` (add-guest
 * button, guest avatars, name modal) beside the owner icon. Every ruleset
 * this session's own `session-seats.service.ts` caps at 1 seat still 400s a
 * 2nd participant regardless of what this prop renders — the prop only
 * controls the setup screen's own markup, never the server-side cap.
 */
interface Props {
  allowGuests?: boolean;
}
```

- [ ] **Step 5: Add `allowGuests` to `Bobs27SetupForm.astro`**

In `app/src/components/layout/games/setup/Bobs27SetupForm.astro` line 16, replace:

```astro
  <UserSection />
```

with:

```astro
  <UserSection allowGuests />
```

- [ ] **Step 6: Repeat step 5 for the remaining seven setup forms**

Each of `OneTwentyOneSetupForm.astro`, `AroundTheClockSetupForm.astro`, `TuodSetupForm.astro` (line 23), `ShanghaiSetupForm.astro`, `ScoreTrainingSetupForm.astro` (line 24), `SinglesTrainingSetupForm.astro`, `DoublesTrainingSetupForm.astro` contains exactly one `<UserSection />` self-closing tag (the same pattern `Bobs27SetupForm.astro` had before step 5), rendered directly inside `<SetupShell>`. In every one of these seven files, replace that exact tag:

```astro
  <UserSection />
```

with:

```astro
  <UserSection allowGuests />
```

- [ ] **Step 7: Verify**

Run: `cd app && npm run format:check && npx astro check`
Expected: clean — no new type or format errors. Start the dev server (`astro dev --background` per `app/CLAUDE.md`) and open each of the eight setup pages (`/games/bobs27/setup`, `/games/121/setup`, `/games/around-the-clock/setup`, `/games/tuod/setup`, `/games/shanghai/setup`, `/games/score-training/setup`, `/games/singles-training/setup`, `/games/doubles-training/setup`, and `/games/501/setup` for the no-regression check) and confirm the "Add guest" button now renders on all eight, and that Bob's 27 / 121 / Around the Clock / Shanghai / Singles Training / Doubles Training's `start()` sends the added guest as a 2nd participant (TUOD and Score Training still create a solo-only session until Tasks 11 and 15 land, so verify only that adding a guest there does not error the form — the button and modal render, `start()` just does not use `guests` yet).

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/game/types.ts \
  app/src/lib/game/setup-controller.ts \
  app/tests/lib/game/setup-controller.test.ts \
  app/src/components/layout/games/setup/UserSection.astro \
  app/src/components/layout/games/setup/Bobs27SetupForm.astro \
  app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro \
  app/src/components/layout/games/setup/AroundTheClockSetupForm.astro \
  app/src/components/layout/games/setup/TuodSetupForm.astro \
  app/src/components/layout/games/setup/ShanghaiSetupForm.astro \
  app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro \
  app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro \
  app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro
git commit -m "feat: let every remaining setup form add a guest opponent"
```

---

## Task 5: Bob's 27 engine — elimination

**Files:**
- Modify: `app/src/modules/game/types.ts:24-29` (the `Bobs27State` type)
- Modify: `app/src/modules/game/bobs27.engine.module.ts` (full rewrite)
- Test: `app/tests/modules/game/bobs27.engine.module.test.ts` (extend — keep every existing `it`, since solo must reproduce today's exact behavior)

**Interfaces:**
- Consumes: `eliminationWinner` from Task 1, `activeSeat` from Task 2 (3-arg call — Bob's 27 never needs the completion predicate: the match ends the instant a seat fails, so no seat ever gets a turn after the other has finished).
- Produces: `Bobs27SeatState`, `Bobs27State` (both exported from `types.ts`) — Task 6 (frontend) imports both. `initialBobs27State(config: Seated<Bobs27Snapshot>): Bobs27State` and `applyBobs27Dart(config: Bobs27Snapshot, seat: Bobs27SeatState, observation: DartObservation): Bobs27SeatState` keep their names but change signature — both exported, both used directly by the extended test file.

- [ ] **Step 1: Update the type**

In `app/src/modules/game/types.ts`, replace lines 24-29 (the current `Bobs27State` type):

```ts
export type Bobs27SeatState = SeatState & {
  targetIndex: number;
  score: number;
  dartsThisVisit: boolean[];
  status: "IN_PROGRESS" | "WON" | "LOST";
};

export type Bobs27State = MultiSeatState<Bobs27SeatState> & {
  status: "IN_PROGRESS" | "WON" | "LOST" | "COMPLETE";
  winningSideKey: string | null;
};
```

`Bobs27SeatState` must be declared after `SeatState` and `MultiSeatState` — both are already defined further down this file (lines 106-121); since this edit only touches lines 24-29, `Bobs27State`'s reference to `MultiSeatState` resolves fine (module-level type declarations are not order-sensitive in TypeScript).

- [ ] **Step 2: Write the failing test — extend the existing test file**

`app/tests/modules/game/bobs27.engine.module.test.ts` already builds `config: Seated<Bobs27Snapshot>` with a 1-entry `SEATS` array (confirmed by reading the file) — its existing solo assertions read `state.score`, `state.targetIndex`, `state.dartsThisVisit`, `state.status` at the top level, which after Step 1 move under `state.seats[0]`. Update every existing assertion in that file from `state.<field>` to `state.seats[0].<field>` (keep every existing `it` — this is what "solo reproduces today's exact behavior" means for this task) and add a new `describe` block for 1v1:

```ts
describe("Bobs27Engine — 1v1", () => {
  const twoSeats = [
    { participantRef: "p1", displayName: "A", sideKey: "A", participantTypeKey: "PLAYER" as const },
    { participantRef: "p2", displayName: "B", sideKey: "B", participantTypeKey: "GUEST" as const },
  ];
  const twoSeatConfig: Seated<Bobs27Snapshot> = {
    startScore: 27,
    bullHitValue: 50,
    missPenaltyMultiplier: 1,
    seats: twoSeats,
  };

  function missDart(): DartObservation {
    return { hitTargetNumber: 1, hitZoneKey: "MISS", locationX: null, locationY: null };
  }

  it("alternates the active seat visit by visit", () => {
    const engine = new Bobs27Engine(twoSeatConfig);
    expect(engine.state().activeParticipantRef).toBe("p1");
    engine.record(missDart());
    engine.record(missDart());
    engine.record(missDart());
    expect(engine.state().activeParticipantRef).toBe("p2");
  });

  it("ends the match the instant one seat busts to zero or below, the other seat wins", () => {
    // startScore 27, D1's value is boardScore(1, "DOUBLE") * missPenaltyMultiplier
    // = 2 * 1 = 2 per missed visit; a miss never advances targetIndex, so
    // every visit for both seats keeps missing D1. Seats strictly alternate
    // (activeSeat has no completion predicate for Bob's 27 — the match ends
    // before it would matter), so after each seat's Nth own visit both are
    // tied at 27 - 2N. p1 (seat 0) throws its own Nth visit first each round
    // and crosses zero at N = 14 (27 - 28 = -1), one visit before p2 would.
    const engine = new Bobs27Engine(twoSeatConfig);
    let state = engine.state();
    while (state.status === "IN_PROGRESS") {
      engine.record(missDart());
      engine.record(missDart());
      engine.record(missDart());
      state = engine.state();
    }
    expect(state.seats[0].status).toBe("LOST");
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("B");
  });

  it("stamps every turn's participantRef with a seat present in seats[]", () => {
    const engine = new Bobs27Engine(twoSeatConfig);
    engine.record(missDart());
    engine.record(missDart());
    engine.record(missDart());
    const facts = engine.facts();
    for (const turn of facts.turns) {
      expect(twoSeats.some((seat) => seat.participantRef === turn.participantRef)).toBe(
        true,
      );
    }
  });

  it("undo across a match-ending dart un-ends the match", () => {
    const engine = new Bobs27Engine(twoSeatConfig);
    let state = engine.state();
    while (state.status === "IN_PROGRESS") {
      engine.record(missDart());
      state = engine.state();
    }
    engine.undo();
    expect(engine.state().status).toBe("IN_PROGRESS");
    expect(engine.state().winningSideKey).toBeNull();
  });
});
```

The bust-driving loop above is intentionally simple (miss every dart): D1's value is `boardScore(1, "DOUBLE") * missPenaltyMultiplier = 2 * 1 = 2` per missed visit, so `score` strictly decreases each time seat 1 throws and eventually goes `<= 0`, ending the loop.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts`
Expected: FAIL — `state.score` is `undefined` on the old flat shape, or (after Step 1's type change) a TS compile error until Step 4 lands.

- [ ] **Step 4: Write the implementation**

Replace the full contents of `app/src/modules/game/bobs27.engine.module.ts`:

```ts
import type { Bobs27Snapshot, Seated } from "@lib/types";
import { newClientKey } from "./client-key.module";
import {
  BULL_TARGET_NUMBER,
  boardScore,
  doublesPath,
  isHitOn,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { eliminationWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  BoardTarget,
  Bobs27SeatState,
  Bobs27State,
  DartFact,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

/** One seat's starting progress: the ruleset's starting score, aimed at the first double, no darts thrown. */
function initialSeatState(
  config: Bobs27Snapshot,
  seat: { participantRef: string; sideKey: string },
): Bobs27SeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    score: config.startScore,
    dartsThisVisit: [],
    status: "IN_PROGRESS",
  };
}

/**
 * Bob's 27 starting state: every configured seat at its own starting
 * progress, seat 0 active, nobody eliminated. A solo session is one seat —
 * no branch anywhere in the engine.
 */
export function initialBobs27State(config: Seated<Bobs27Snapshot>): Bobs27State {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map((seat) => initialSeatState(config, seat)),
  };
}

function pointValueOf(target: BoardTarget, config: Bobs27Snapshot): number {
  return target.kind === "BULL"
    ? config.bullHitValue
    : boardScore(target.number, "DOUBLE");
}

/**
 * Pure reducer: folds one dart observation onto one seat's `Bobs27SeatState`.
 * A hit adds the current target's point value immediately; a visit resolves
 * on its 3rd dart, where a full miss subtracts that value scaled by the
 * ruleset's miss penalty multiplier. Any hit advances to the next target
 * with no penalty. The path ends at BULL: a resolved score at or below zero
 * loses regardless of target, otherwise clearing BULL wins. Operates on one
 * seat at a time — the caller folds it once per seat, filtering `this.turns`
 * on that seat's own `participantRef` first.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyBobs27Dart(
  config: Bobs27Snapshot,
  state: Bobs27SeatState,
  observation: DartObservation,
): Bobs27SeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the game has ended; undo first to correct it.",
    );
  }

  const target = targetAt(doublesPath(), state.targetIndex);
  const pointValue = pointValueOf(target, config);
  const hit = isHitOn(target, observation);
  const dartsThisVisit = [...state.dartsThisVisit, hit];
  const score = hit ? state.score + pointValue : state.score;

  if (dartsThisVisit.length < 3) {
    return { ...state, score, dartsThisVisit };
  }

  const visitHits = dartsThisVisit.filter(Boolean).length;
  const resolvedScore =
    visitHits === 0 ? score - pointValue * config.missPenaltyMultiplier : score;

  if (resolvedScore <= 0) {
    return { ...state, score: resolvedScore, dartsThisVisit: [], status: "LOST" };
  }
  if (target.kind === "BULL") {
    return { ...state, score: resolvedScore, dartsThisVisit: [], status: "WON" };
  }
  return {
    ...state,
    score: resolvedScore,
    dartsThisVisit: [],
    targetIndex: state.targetIndex + 1,
  };
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Bob's 27: a fixed path of 21 targets (D1..D20, then BULL) played to a full
 * -hit clear of BULL or a bust at zero. Elimination: the first seat to bust
 * loses and the match ends immediately, the other seat winning — no "wrong
 * player" error is possible, since `record()` always resolves against the
 * derived active seat. The engine owns the fact log — `state()` derives each
 * seat's running score, current target and win/loss status by folding
 * `facts()`, filtered per seat, through `applyBobs27Dart`; none of it is
 * ever stored.
 */
export class Bobs27Engine implements GameEngine<DartObservation, Bobs27State> {
  readonly rulesetVersionKey = "BOBS27_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<Bobs27Snapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): Bobs27State {
    const seats = this.config.seats.map((seat) => {
      let state = initialSeatState(this.config, seat);
      const seatTurns = this.turns.filter(
        (turn) => turn.participantRef === seat.participantRef,
      );
      for (const turn of seatTurns) {
        for (const dart of turn.darts) {
          state = applyBobs27Dart(this.config, state, {
            hitTargetNumber: dart.hitTargetNumber,
            hitZoneKey: dart.hitZoneKey,
            locationX: dart.locationX,
            locationY: dart.locationY,
          });
        }
      }
      return state;
    });

    const winningSideKey = eliminationWinner(
      seats.map((seat) => ({ sideKey: seat.sideKey, failed: seat.status === "LOST" })),
    );
    const status: Bobs27State["status"] =
      seats.length === 1
        ? seats[0].status
        : winningSideKey !== null
          ? "COMPLETE"
          : "IN_PROGRESS";

    return {
      activeParticipantRef: activeSeat(
        { stages: [{ ...STAGE }], turns: this.turns },
        this.config.seats,
        "PER_SEAT",
      ).participantRef,
      status,
      winningSideKey,
      seats,
    };
  }

  private openOrCreateTurn(activeParticipantRef: string): TurnFact {
    const last = this.turns.at(-1);
    if (last && last.darts.length < 3) return last;

    const turn: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      participantRef: activeParticipantRef,
      sequence: this.turns.length + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(turn);
    return turn;
  }

  /**
   * Appends one dart to the open visit, opening a new one when the last is
   * already 3 darts deep. `intendedTargetNumber`/`intendedZoneKey` capture
   * the target this dart was thrown at, ahead of what it actually hit; the
   * fact's `score` is the dart's board score, never the game-specific point
   * value the derived running score adds. `completedAt` is stamped only by
   * the dart that resolves the visit — the client-observed end of it — so an
   * open visit carries none. Validated against the derived active seat's own
   * status before anything is written, so a throw here leaves the fact log
   * exactly as it was.
   * @throws when the derived active seat has already ended (WON/LOST); the
   *   fact log is left untouched.
   */
  record(observation: DartObservation): Bobs27State {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the game has ended; undo first to correct it.",
      );
    }

    const target = targetAt(doublesPath(), activeSeatState.targetIndex);
    const openTurn = this.openOrCreateTurn(before.activeParticipantRef);
    const intendedZoneKey: DartZoneKey =
      target.kind === "BULL" ? "INNER_BULL" : "DOUBLE";
    const dart: DartFact = {
      sequence: openTurn.darts.length + 1,
      intendedTargetNumber:
        target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number,
      intendedZoneKey,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: observation.locationX,
      locationY: observation.locationY,
    };

    openTurn.darts.push(dart);
    openTurn.totalScore = sumDartScores(openTurn.darts);
    if (openTurn.darts.length === 3) {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  /**
   * Pops the last recorded dart, including one replayed from persisted
   * facts, and removes the visit entirely once it holds no darts — the
   * exact inverse of the `record()` call that created it. A surviving visit
   * is open again by definition, so its `completedAt` is cleared. No seat
   * -awareness needed: this always operates on the tail of `this.turns`,
   * whichever seat it belongs to.
   * @returns true if a dart was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    const openTurn = this.turns.at(-1);
    if (!openTurn || openTurn.darts.length === 0) return false;

    openTurn.darts.pop();
    if (openTurn.darts.length === 0) {
      this.turns.pop();
    } else {
      openTurn.completedAt = null;
      openTurn.totalScore = sumDartScores(openTurn.darts);
    }
    return true;
  }

  /**
   * Answers whether recording `observation` would resolve the active seat's
   * open visit into a win or loss, without mutating the fact log or the
   * derived state. Only a visit's 3rd dart can ever complete a seat's path.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;
    if (activeSeatState.dartsThisVisit.length < 2) return false;

    const after = applyBobs27Dart(this.config, activeSeatState, observation);
    return after.status !== "IN_PROGRESS";
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): Bobs27State {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const bobs27EngineFactory: GameEngineFactory<
  Seated<Bobs27Snapshot>,
  DartObservation,
  Bobs27State
> = {
  rulesetVersionKey: "BOBS27_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<Bobs27Snapshot>, prior?: EngineFacts) {
    return new Bobs27Engine(config, prior);
  },
};

registerEngineFactory(bobs27EngineFactory);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts`
Expected: PASS — every existing case (now reading `state.seats[0].*`) plus the new 1v1 `describe` block.

- [ ] **Step 6: Run the game-engine structural gate**

Run: `cd app && bash scripts/check-game-engines.sh`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/bobs27.engine.module.ts app/tests/modules/game/bobs27.engine.module.test.ts
git commit -m "feat: wire a 1v1 opponent seat into Bob's 27 (elimination)"
```

---

## Task 6: Bob's 27 frontend — split scoreboard and winner banner

**Files:**
- Modify: `app/src/lib/game/bobs27-play.data.ts`
- Modify: `app/src/components/layout/games/interfaces/Bobs27.astro`
- Modify: `app/src/components/layout/games/result-modals/Bobs27Results.astro`

`.astro`/`.ts` UI glue is exempt from the source/test pairing rule only for `.astro` markup (D101); `bobs27-play.data.ts` is a plain `.ts` module and does need a test, added in Step 2 below.

- [ ] **Step 1: Add per-seat accessors to `bobs27-play.data.ts`**

In `app/src/lib/game/bobs27-play.data.ts`:

Replace the `computeStats` function (lines 40-70) with:

```ts
function computeStats(
  state: Bobs27State,
  turns: readonly TurnFact[],
  ownerRef: string | null,
): {
  status: "WON" | "LOST";
  score: number;
  darts: number;
  doubleHitRate: string;
  highestNumberReached: string;
  winningSideKey: string | null;
} {
  const ownerTurns =
    ownerRef === null
      ? turns
      : turns.filter((turn) => turn.participantRef === ownerRef);
  const ownerSeat =
    state.seats.find((seat) => seat.participantRef === ownerRef) ??
    state.seats[0];
  const darts = ownerTurns.reduce((sum, turn) => sum + turn.darts.length, 0);
  const hits = ownerTurns.reduce(
    (sum, turn) =>
      sum +
      turn.darts.filter(
        (dart) =>
          dart.hitTargetNumber === dart.intendedTargetNumber &&
          dart.hitZoneKey === dart.intendedZoneKey,
      ).length,
    0,
  );
  return {
    status: ownerSeat.status === "WON" ? "WON" : "LOST",
    score: ownerSeat.score,
    darts,
    doubleHitRate: darts === 0 ? "0%" : `${Math.round((hits / darts) * 100)}%`,
    highestNumberReached: doublesPathTargetLabel(
      targetAt(doublesPath(), ownerSeat.targetIndex),
    ),
    winningSideKey: state.winningSideKey,
  };
}

/**
 * The seat this session belongs to — the one PLAYER participant. Mirrors
 * `five-oh-one-play.data.ts`'s `ownerRef`.
 */
function ownerRef(seats: readonly { participantRef: string; participantTypeKey: string }[]): string | null {
  return (
    seats.find((seat) => seat.participantTypeKey === "PLAYER")?.participantRef ??
    null
  );
}
```

Replace `currentTargetLabel`/`currentScore` (lines 137-147) with `state()` plus seat-scoped and active-seat variants:

```ts
    state(this: Bobs27PlayContext): Bobs27State | null {
      return this.engine?.state() ?? null;
    },

    currentTargetLabelFor(this: Bobs27PlayContext, seatRef: string): string {
      const state = this.state();
      const seat = state?.seats.find((candidate) => candidate.participantRef === seatRef);
      if (!seat) return "";
      return doublesPathTargetLabel(targetAt(doublesPath(), seat.targetIndex));
    },

    currentTargetLabel(this: Bobs27PlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    currentScoreFor(this: Bobs27PlayContext, seatRef: string): string {
      const state = this.state();
      const seat = state?.seats.find((candidate) => candidate.participantRef === seatRef);
      return seat ? String(seat.score) : "";
    },

    currentScore(this: Bobs27PlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentScoreFor(state.activeParticipantRef);
    },
```

Update the `resultsSnapshot` type declaration (line 125-131) to add `winningSideKey: string | null` to the literal type, matching `computeStats`'s new return shape.

In `uploadAndCompleteSession`, replace:

```ts
      const finalState = this.engine?.state() ?? null;
```

with (unchanged — `finalState` still comes from `this.engine?.state()`, now typed `Bobs27State | null` automatically since `state()` step above is a new method, not a rename of this local), and replace:

```ts
      if (finalState) {
        this.resultsSnapshot = computeStats(finalState, this.$store.game.turns);
      }
```

with:

```ts
      if (finalState) {
        this.resultsSnapshot = computeStats(
          finalState,
          this.$store.game.turns,
          ownerRef(this.$store.game.seats),
        );
      }
```

- [ ] **Step 2: Write the test for the new accessors**

Create `app/tests/lib/game/bobs27-play.data.test.ts` if one does not already exist for this module (check first — `Glob app/tests/lib/game/bobs27-play*`); if it exists, add these cases to it rather than creating a duplicate file:

```ts
import { describe, it, expect } from "vitest";
import { bobs27Play } from "@lib/game/bobs27-play.data";

describe("bobs27Play — per-seat accessors", () => {
  it("currentScoreFor and currentTargetLabelFor read the named seat, not the active one", () => {
    const ctx = bobs27Play() as unknown as {
      engine: {
        state: () => {
          activeParticipantRef: string;
          seats: { participantRef: string; score: number; targetIndex: number }[];
        };
      };
      currentScoreFor: (seatRef: string) => string;
      currentTargetLabelFor: (seatRef: string) => string;
    };
    ctx.engine = {
      state: () => ({
        activeParticipantRef: "p1",
        seats: [
          { participantRef: "p1", score: 25, targetIndex: 0 },
          { participantRef: "p2", score: 31, targetIndex: 1 },
        ],
      }),
    };
    expect(ctx.currentScoreFor("p2")).toBe("31");
    expect(ctx.currentTargetLabelFor("p1")).not.toBe(ctx.currentTargetLabelFor("p2"));
  });

  it("currentScoreFor returns an empty string for an unknown seat", () => {
    const ctx = bobs27Play() as unknown as {
      engine: { state: () => { activeParticipantRef: string; seats: [] } } | null;
      currentScoreFor: (seatRef: string) => string;
    };
    ctx.engine = null;
    expect(ctx.currentScoreFor("nobody")).toBe("");
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts`
Expected: FAIL before Step 1 lands (`currentScoreFor` does not exist), PASS after.

- [ ] **Step 4: Branch `Bobs27.astro` on seat count**

Replace the full contents of `app/src/components/layout/games/interfaces/Bobs27.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import DoublesPathRecreationalInput from "@components/layout/games/DoublesPathRecreationalInput.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={false}
      score="currentScore()"
      class="min-h-2/5 max-h-2/5 h-full"
    >
      <div
        slot="progress"
        class="mt-2 flex w-full flex-col items-center gap-2 px-4"
      >
        <dl class="w-full space-y-1">
          <StatRow
            label="Target"
            value="currentTargetLabel()"
          />
        </dl>
      </div>
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "currentScoreFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "currentScoreFor(state()?.seats[1]?.participantRef)",
      }}
      isTarget={false}
      class="h-2/5"
    >
      <dl
        slot="progressA"
        class="w-full space-y-1"
      >
        <StatRow
          label="Target"
          value="currentTargetLabelFor(state()?.seats[0]?.participantRef)"
        />
      </dl>
      <dl
        slot="progressB"
        class="w-full space-y-1"
      >
        <StatRow
          label="Target"
          value="currentTargetLabelFor(state()?.seats[1]?.participantRef)"
        />
      </dl>
    </SplitScoreboard>
  </template>

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <VisitPreview />

  <DoublesPathRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

`SplitScoreboard`'s `SeatDisplay` shape has no `isTarget` per seat (it is a single prop on `SplitScoreboard` itself, per `app/src/components/layout/games/SplitScoreboard.astro:25`) — `isTarget={false}` at the top mirrors the solo branch's own `isTarget={false}` (Bob's 27 shows a climbing score, not a countdown target).

- [ ] **Step 5: Show the winner in `Bobs27Results.astro`**

In `app/src/components/layout/games/result-modals/Bobs27Results.astro`, replace the `<h2>` block (lines 15-28):

```astro
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-text="
        !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? (resultsSnapshot?.status === 'LOST' ? 'Game over!' : 'Winner!')
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins!')
      "
      x-show="completionStatus === 'succeeded' && resultsSnapshot"
      x-cloak
    >
    </h2>
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-show="!(completionStatus === 'succeeded' && resultsSnapshot)"
      x-cloak
    >
      Match Summary
    </h2>
```

- [ ] **Step 6: Manual verification**

Start the dev server and play a full Bob's 27 1v1 session (add a guest at setup, alternate misses/hits between the two board halves) through to completion. Confirm: the split scoreboard shows both seats' live score and target; the losing seat's bust ends the match immediately with no further turn offered to either seat; the results modal names the winning seat by display name; undo before the match ends reopens play for the correct seat; a solo session (no guest added) is visually and behaviorally unchanged from before this task.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/bobs27-play.data.ts \
  app/tests/lib/game/bobs27-play.data.test.ts \
  app/src/components/layout/games/interfaces/Bobs27.astro \
  app/src/components/layout/games/result-modals/Bobs27Results.astro
git commit -m "feat: split scoreboard and winner banner for Bob's 27 1v1"
```

---

## Task 7: 121 engine — race-to-finish

**Files:**
- Modify: `app/src/modules/game/types.ts:183-188` (the `OneTwentyOneState` type)
- Modify: `app/src/modules/game/one-twenty-one.engine.module.ts` (full rewrite)
- Test: `app/tests/modules/game/one-twenty-one.engine.module.test.ts` (extend — every existing case keeps passing after its assertions move to `state.seats[0].*`, same as Task 5)

**Interfaces:**
- Consumes: `raceWinner` from Task 1, `activeSeat` from Task 2 (3-arg call — 121 never needs the completion predicate: the match ends the instant a seat checks out at 170).
- Produces: `OneTwentyOneSeatState`, `OneTwentyOneState` (exported from `types.ts`); `foldOneTwentyOneState(facts: EngineFacts, config: Seated<OneTwentyOneSnapshot>): OneTwentyOneState` and `initialOneTwentyOneState(config: Seated<OneTwentyOneSnapshot>): OneTwentyOneState`, both exported from the engine module — Task 8's `one-twenty-one-play.data.ts` imports `foldOneTwentyOneState` directly, mirroring how `five-oh-one-play.data.ts` imports `foldFiveOhOneState`.

- [ ] **Step 1: Update the type**

In `app/src/modules/game/types.ts`, replace lines 183-188 (the current `OneTwentyOneState` type):

```ts
export type OneTwentyOneSeatState = SeatState & {
  currentTarget: number;
  remainingInAttempt: number;
  visitsThisAttempt: number;
  status: "IN_PROGRESS" | "WON";
};

export type OneTwentyOneState = MultiSeatState<OneTwentyOneSeatState> & {
  status: "IN_PROGRESS" | "WON";
  winningSideKey: string | null;
};
```

- [ ] **Step 2: Write the failing test — extend the existing test file**

Update every existing assertion in `app/tests/modules/game/one-twenty-one.engine.module.test.ts` from `state.<field>` to `state.seats[0].<field>` for the per-seat fields (`currentTarget`, `remainingInAttempt`, `visitsThisAttempt`, `status`); `state.activeParticipantRef`, `state.winningSideKey` and `state.seats` stay top-level and are new. Add:

```ts
describe("OneTwentyOneEngine — 1v1", () => {
  const twoSeats = [
    { participantRef: "p1", displayName: "A", sideKey: "A", participantTypeKey: "PLAYER" as const },
    { participantRef: "p2", displayName: "B", sideKey: "B", participantTypeKey: "GUEST" as const },
  ];
  const twoSeatConfig: Seated<OneTwentyOneSnapshot> = { seats: twoSeats };

  it("alternates the active seat attempt by attempt", () => {
    const engine = new OneTwentyOneEngine(twoSeatConfig);
    expect(engine.state().activeParticipantRef).toBe("p1");
    engine.record({ scoreAttempted: 0 });
    expect(engine.state().activeParticipantRef).toBe("p2");
  });

  it("ends the match the instant one seat checks out at 170, the other seat never gets another turn", () => {
    const engine = new OneTwentyOneEngine(twoSeatConfig);
    // Climb p1 from 121 to 170 (49 climbs, one checkout per target), p2 idles at 0 every turn between.
    for (let target = 121; target < 170; target++) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true }); // p1 checks out
      engine.record({ scoreAttempted: 0 }); // p2 busts to keep its own target unchanged
    }
    const beforeFinal = engine.state();
    expect(beforeFinal.activeParticipantRef).toBe("p1");
    expect(beforeFinal.seats[0].currentTarget).toBe(170);

    const after = engine.record({ scoreAttempted: 170, finishedOnDouble: true });
    expect(after.seats[0].status).toBe("WON");
    expect(after.status).toBe("WON");
    expect(after.winningSideKey).toBe("A");
  });

  it("stamps every turn's participantRef with a seat present in seats[]", () => {
    const engine = new OneTwentyOneEngine(twoSeatConfig);
    engine.record({ scoreAttempted: 0 });
    engine.record({ scoreAttempted: 0 });
    const facts = engine.facts();
    for (const turn of facts.turns) {
      expect(twoSeats.some((seat) => seat.participantRef === turn.participantRef)).toBe(
        true,
      );
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts`
Expected: FAIL.

- [ ] **Step 4: Write the implementation**

Replace the full contents of `app/src/modules/game/one-twenty-one.engine.module.ts`:

```ts
import type { OneTwentyOneSnapshot, Seated, SeatFact } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { classify } from "@lib/game/board/board-geometry.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { raceWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  EngineFacts,
  OneTwentyOneInput,
  OneTwentyOneSeatState,
  OneTwentyOneState,
  OneTwentyOneVisitInput,
  OneTwentyOneVisitOutcome,
  StageFact,
  TurnFact,
} from "./types";

const START_TARGET = 121;
const CAP_TARGET = 170;
const VISITS_PER_ATTEMPT = 3;
const DARTS_PER_VISIT = 3;
const MAX_VISIT_SCORE = 180;

function roundStage(sequence: number): StageFact {
  return {
    clientKey: `round-${sequence}`,
    stageTypeKey: "ROUND",
    parentClientKey: null,
    sequence,
  };
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

function isPlayableVisitScore(scoreAttempted: number): boolean {
  return (
    Number.isInteger(scoreAttempted) &&
    scoreAttempted >= 0 &&
    scoreAttempted <= MAX_VISIT_SCORE
  );
}

function isDartObservation(input: OneTwentyOneInput): input is DartObservation {
  return "hitZoneKey" in input;
}

function initialSeatState(seat: SeatFact): OneTwentyOneSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    currentTarget: START_TARGET,
    remainingInAttempt: START_TARGET,
    visitsThisAttempt: 0,
    status: "IN_PROGRESS",
  };
}

/** 121 starting state: every configured seat at 121, seat 0 active, nobody has won. */
export function initialOneTwentyOneState(
  config: Seated<OneTwentyOneSnapshot>,
): OneTwentyOneState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

/** Folds every CLOSED turn for one seat as the finished visit that produced it. */
function deriveClosedSeatState(
  seat: SeatFact,
  turns: readonly TurnFact[],
): OneTwentyOneSeatState {
  return turns
    .filter(
      (turn) =>
        turn.participantRef === seat.participantRef && turn.completedAt !== null,
    )
    .reduce(
      (state, turn) =>
        applyOneTwentyOneVisit(state, {
          scoreAttempted: turn.totalScore,
          finishedOnDouble: true,
        }),
      initialSeatState(seat),
    );
}

/**
 * Folds the whole fact log into the session's state — the same function the
 * engine's own `deriveState()` delegates to and `one-twenty-one-play.data.ts`
 * calls directly for reactive display, so the engine and the play page can
 * never disagree about whose throw it is or what any seat's ladder position
 * is, mirroring `foldFiveOhOneState`.
 *
 * Every closed turn folds fully per seat (this is where `currentTarget` /
 * `visitsThisAttempt` / `status` come from); the currently open turn, if
 * any, only overlays a live subtraction onto that one seat's
 * `remainingInAttempt`, never touching its visit counter.
 */
export function foldOneTwentyOneState(
  facts: EngineFacts,
  config: Seated<OneTwentyOneSnapshot>,
): OneTwentyOneState {
  const openVisit = facts.turns.at(-1)?.completedAt === null ? facts.turns.at(-1)! : null;

  const seats = config.seats.map((seat) => {
    const closed = deriveClosedSeatState(seat, facts.turns);
    if (openVisit && openVisit.participantRef === seat.participantRef) {
      return {
        ...closed,
        remainingInAttempt: closed.remainingInAttempt - openVisit.totalScore,
      };
    }
    return closed;
  });

  const winningSideKey = raceWinner(
    seats.map((seat) => ({ sideKey: seat.sideKey, finished: seat.status === "WON" })),
  );

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT").participantRef,
    status: seats.some((seat) => seat.status === "WON") ? "WON" : "IN_PROGRESS",
    winningSideKey,
    seats,
  };
}

function resolveOneTwentyOneVisit(
  remainingInAttempt: number,
  input: OneTwentyOneVisitInput,
): OneTwentyOneVisitOutcome {
  const wouldRemain = remainingInAttempt - input.scoreAttempted;
  const reachedZero = wouldRemain === 0;
  const isBust =
    wouldRemain < 0 ||
    wouldRemain === 1 ||
    (reachedZero && input.finishedOnDouble !== true);

  if (isBust) {
    return { isBust: true, scored: 0, checkedOut: false, remainingAfter: remainingInAttempt };
  }
  return {
    isBust: false,
    scored: input.scoreAttempted,
    checkedOut: reachedZero,
    remainingAfter: wouldRemain,
  };
}

function checkoutDartsRejectionFor(
  seat: OneTwentyOneSeatState,
  input: OneTwentyOneVisitInput,
): string | null {
  if (input.finishedOnDouble !== true) return null;
  return checkoutDartsRejection(
    seat.remainingInAttempt,
    input.dartsUsed,
    input.dartsAtDouble,
    DARTS_PER_VISIT,
  );
}

/**
 * Pure reducer: folds one FINISHED visit onto one seat's `OneTwentyOneSeatState`.
 * A checkout at the cap target (170) wins that seat's own race; any other
 * checkout climbs the target by one and opens a fresh 3-visit budget. A
 * visit that neither checks out nor is the attempt's 3rd carries its
 * remaining score to the next visit in the same attempt. The 3rd
 * non-checkout visit applies the v1 fail rule — stay on the same target with
 * a fresh budget — whether that visit busted or simply fell short.
 * @throws when the seat is already complete, or when `scoreAttempted` is not
 *   a whole number within `0..180`; the caller's state is left untouched.
 */
export function applyOneTwentyOneVisit(
  state: OneTwentyOneSeatState,
  input: OneTwentyOneVisitInput,
): OneTwentyOneSeatState {
  if (!isPlayableVisitScore(input.scoreAttempted)) {
    throw new Error(`Enter a score between 0 and ${MAX_VISIT_SCORE}.`);
  }
  const dartsRejection = checkoutDartsRejectionFor(state, input);
  if (dartsRejection) {
    throw new Error(dartsRejection);
  }
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a visit once the session is complete; undo first to correct it.",
    );
  }

  const outcome = resolveOneTwentyOneVisit(state.remainingInAttempt, input);

  if (outcome.checkedOut) {
    if (state.currentTarget === CAP_TARGET) {
      return { ...state, remainingInAttempt: 0, visitsThisAttempt: 0, status: "WON" };
    }
    const nextTarget = state.currentTarget + 1;
    return {
      ...state,
      currentTarget: nextTarget,
      remainingInAttempt: nextTarget,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    };
  }

  const visitsThisAttempt = state.visitsThisAttempt + 1;
  if (visitsThisAttempt < VISITS_PER_ATTEMPT) {
    return { ...state, remainingInAttempt: outcome.remainingAfter, visitsThisAttempt };
  }

  return { ...state, remainingInAttempt: state.currentTarget, visitsThisAttempt: 0 };
}

/**
 * 121: a checkout ladder from 121 to 170, each target attempted in up to 3
 * visits (9 darts) and won by a visit whose final dart lands in a double.
 * Race-to-finish: the first seat to check out at the cap target (170) wins
 * the match immediately — the trailing seat never gets another turn. Under
 * QUICK_SCORE the engine owns one turn per visit, carrying the visit total
 * with no dart rows. Under VISUAL_BOARD it owns one dart at a time.
 */
export class OneTwentyOneEngine implements GameEngine<
  OneTwentyOneInput,
  OneTwentyOneState
> {
  readonly rulesetVersionKey = "121_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly stages: StageFact[];
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<OneTwentyOneSnapshot>,
    prior?: EngineFacts,
  ) {
    this.stages =
      prior && prior.stages.length > 0
        ? prior.stages.map((stage) => ({ ...stage }))
        : [roundStage(1)];
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): OneTwentyOneState {
    return foldOneTwentyOneState(
      { stages: this.stages, turns: this.turns },
      this.config,
    );
  }

  private resolveObservation(observation: DartObservation) {
    return observation.locationX === null || observation.locationY === null
      ? { targetNumber: null, zoneKey: observation.hitZoneKey, score: 0 }
      : classify(observation.locationX, observation.locationY);
  }

  private openRound(): StageFact {
    const stage = this.stages.at(-1);
    if (!stage) {
      throw new Error("A 121 engine always has an open round stage.");
    }
    return stage;
  }

  private turnCountIn(stageClientKey: string): number {
    return this.turns.filter((turn) => turn.stageClientKey === stageClientKey).length;
  }

  private openVisit(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.completedAt !== null) return null;
    return last;
  }

  private openNewVisit(activeParticipantRef: string): TurnFact {
    const round = this.openRound();
    const visit: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: round.clientKey,
      participantRef: activeParticipantRef,
      sequence: this.turnCountIn(round.clientKey) + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(visit);
    return visit;
  }

  private remainingBeforeVisit(visit: TurnFact): number {
    const index = this.turns.indexOf(visit);
    return foldOneTwentyOneState(
      { stages: this.stages, turns: this.turns.slice(0, index) },
      this.config,
    ).seats.find((seat) => seat.participantRef === visit.participantRef)!
      .remainingInAttempt;
  }

  private recordVisitTotal(input: OneTwentyOneVisitInput): OneTwentyOneState {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    const after = applyOneTwentyOneVisit(activeSeatState, input);
    const outcome = resolveOneTwentyOneVisit(activeSeatState.remainingInAttempt, input);

    const round = this.openRound();
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: round.clientKey,
      participantRef: before.activeParticipantRef,
      sequence: this.turnCountIn(round.clientKey) + 1,
      completedAt: new Date().toISOString(),
      totalScore: outcome.scored,
      darts: [],
    });

    if (after.visitsThisAttempt === 0 && after.status === "IN_PROGRESS") {
      this.stages.push(roundStage(this.stages.length + 1));
    }

    return this.deriveState();
  }

  private settleVisit(visit: TurnFact): boolean {
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const remainingAfter = this.remainingBeforeVisit(visit) - thrown;
    const lastDart = visit.darts.at(-1)!;
    const checkedOut = remainingAfter === 0 && lastDart.hitZoneKey === "DOUBLE";
    const busted =
      remainingAfter < 0 || remainingAfter === 1 || (remainingAfter === 0 && !checkedOut);

    if (busted) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
      return true;
    }

    visit.totalScore = thrown;
    const resolved = checkedOut || visit.darts.length === DARTS_PER_VISIT;
    if (resolved) {
      visit.completedAt = new Date().toISOString();
    }
    return resolved;
  }

  private recordDart(observation: DartObservation): OneTwentyOneState {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") {
      throw new Error("Cannot record a visit once the session is complete");
    }

    const resolved = this.resolveObservation(observation);
    const visit = this.openVisit() ?? this.openNewVisit(before.activeParticipantRef);

    visit.darts.push({
      sequence: visit.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: resolved.targetNumber,
      hitZoneKey: resolved.zoneKey,
      score: resolved.score,
      locationX: observation.locationX,
      locationY: observation.locationY,
    });

    const visitResolved = this.settleVisit(visit);

    if (visitResolved) {
      const after = this.deriveState();
      const afterSeat = after.seats.find(
        (seat) => seat.participantRef === activeSeatState.participantRef,
      )!;
      if (afterSeat.visitsThisAttempt === 0 && afterSeat.status === "IN_PROGRESS") {
        this.stages.push(roundStage(this.stages.length + 1));
      }
    }

    return this.deriveState();
  }

  record(input: OneTwentyOneInput): OneTwentyOneState {
    if (isDartObservation(input)) {
      return this.recordDart(input);
    }
    return this.recordVisitTotal(input);
  }

  undo(): boolean {
    const last = this.turns.at(-1);
    if (!last) return false;
    return last.darts.length > 0 ? this.undoDart() : this.undoVisitTotal();
  }

  private undoVisitTotal(): boolean {
    const removed = this.turns.pop();
    if (!removed) return false;
    this.popStageOpenedBy(removed.stageClientKey);
    return true;
  }

  private undoDart(): boolean {
    const visit = this.turns.at(-1);
    if (!visit) return false;

    visit.darts.pop();
    this.popStageOpenedBy(visit.stageClientKey);

    if (visit.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    visit.totalScore = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    visit.completedAt = null;
    return true;
  }

  private popStageOpenedBy(stageClientKey: string): void {
    const openRound = this.stages.at(-1);
    if (this.stages.length > 1 && openRound && openRound.clientKey !== stageClientKey) {
      this.stages.pop();
    }
  }

  private wouldCompleteDart(observation: DartObservation): boolean {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;

    const resolved = this.resolveObservation(observation);
    const remainingAfter = activeSeatState.remainingInAttempt - resolved.score;
    const checksOut = remainingAfter === 0 && resolved.zoneKey === "DOUBLE";
    return checksOut && activeSeatState.currentTarget === CAP_TARGET;
  }

  wouldComplete(input: OneTwentyOneInput): boolean {
    if (isDartObservation(input)) {
      return this.wouldCompleteDart(input);
    }

    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;
    if (!isPlayableVisitScore(input.scoreAttempted)) return false;
    if (checkoutDartsRejectionFor(activeSeatState, input) !== null) return false;

    return applyOneTwentyOneVisit(activeSeatState, input).status === "WON";
  }

  isComplete(): boolean {
    return this.deriveState().status === "WON";
  }

  state(): OneTwentyOneState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return {
      stages: this.stages.map((stage) => ({ ...stage })),
      turns: cloneTurns(this.turns),
    };
  }
}

export const oneTwentyOneEngineFactory: GameEngineFactory<
  Seated<OneTwentyOneSnapshot>,
  OneTwentyOneInput,
  OneTwentyOneState
> = {
  rulesetVersionKey: "121_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<OneTwentyOneSnapshot>, prior?: EngineFacts) {
    return new OneTwentyOneEngine(config, prior);
  },
};

registerEngineFactory(oneTwentyOneEngineFactory);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the game-engine structural gate**

Run: `cd app && bash scripts/check-game-engines.sh`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/one-twenty-one.engine.module.ts app/tests/modules/game/one-twenty-one.engine.module.test.ts
git commit -m "feat: wire a 1v1 opponent seat into 121 (race-to-finish)"
```

---

## Task 8: 121 frontend — split scoreboard and race banner

**Files:**
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts`
- Modify: `app/src/components/layout/games/interfaces/OneTwentyOne.astro`
- Modify: `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro`
- Test: `app/tests/lib/game/one-twenty-one-play.data.test.ts` (extend or create)

- [ ] **Step 1: Rewire `one-twenty-one-play.data.ts` onto `foldOneTwentyOneState`**

Replace the import block (lines 1-32):

```ts
import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { foldOneTwentyOneState } from "@modules/game/one-twenty-one.engine.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { checkoutDartOptions } from "@modules/game/checkout-darts.module";
import {
  resolveSessionModePair,
  reseatSnapshot,
} from "@lib/game/session-mode-resolution";
import { boardInputData } from "@lib/game/board-input.data";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { dartsThrownCount } from "@lib/game/play-visit-stats";
import type { RulesetVersionKey, SeatFact } from "@lib/types";
import type {
  CheckoutDartOptions,
  DartCount,
  DartObservation,
  EngineFacts,
  OneTwentyOneState,
  TurnFact,
} from "@modules/types";
import type { OneTwentyOnePlayContext } from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// oneTwentyOneEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { OneTwentyOneEngine } from "@modules/game/one-twenty-one.engine.module";
```

Delete the `foldRoundState` function (lines 63-90) entirely — `foldOneTwentyOneState`, imported above, replaces it and additionally folds every seat, not just one.

Replace `computeStats` (lines 113-124):

```ts
/**
 * The seat this session belongs to — the one PLAYER participant. Mirrors
 * `five-oh-one-play.data.ts`'s `ownerRef`.
 */
function ownerRef(seats: readonly SeatFact[]): string | null {
  return (
    seats.find((seat) => seat.participantTypeKey === "PLAYER")?.participantRef ??
    null
  );
}

function computeStats(
  state: OneTwentyOneState,
  turns: TurnFact[],
  owner: string | null,
): { target: number; visits: number; average: number; winningSideKey: string | null } {
  const ownerTurns =
    owner === null ? turns : turns.filter((turn) => turn.participantRef === owner);
  const total = ownerTurns.reduce((sum, turn) => sum + turn.totalScore, 0);
  return {
    target: 170,
    visits: ownerTurns.length,
    average: ownerTurns.length === 0 ? 0 : total / ownerTurns.length,
    winningSideKey: state.winningSideKey,
  };
}
```

Update the `resultsSnapshot` type declaration (lines 148-152) to add `winningSideKey: string | null` to the literal type.

Replace `remainingInAttempt`/`currentTargetLabel`/`visitsThisAttempt` (lines 162-189) with a `state()` accessor plus seat-scoped and active-seat variants:

```ts
    state(this: OneTwentyOnePlayContext): OneTwentyOneState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldOneTwentyOneState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    remainingInAttemptFor(this: OneTwentyOnePlayContext, seatRef: string): number {
      const state = this.state();
      const seat = state?.seats.find((candidate) => candidate.participantRef === seatRef);
      return seat?.remainingInAttempt ?? 0;
    },

    remainingInAttempt(this: OneTwentyOnePlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.remainingInAttemptFor(state.activeParticipantRef);
    },

    currentTargetLabelFor(this: OneTwentyOnePlayContext, seatRef: string): string {
      const state = this.state();
      const seat = state?.seats.find((candidate) => candidate.participantRef === seatRef);
      return seat ? String(seat.currentTarget) : "";
    },

    currentTargetLabel(this: OneTwentyOnePlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    visitsThisAttemptFor(this: OneTwentyOnePlayContext, seatRef: string): number {
      const state = this.state();
      const seat = state?.seats.find((candidate) => candidate.participantRef === seatRef);
      return seat?.visitsThisAttempt ?? 0;
    },

    visitsThisAttempt(this: OneTwentyOnePlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.visitsThisAttemptFor(state.activeParticipantRef);
    },

    dartsThrownThisSession(this: OneTwentyOnePlayContext): number {
      return dartsThrownCount(this.$store.game.turns, DARTS_PER_VISIT);
    },
```

`checkoutHint()` already calls `this.remainingInAttempt()`, so it needs no direct edit — it now reads the active seat's own remaining score automatically.

Finally, replace the `uploadAndCompleteSession` line that reads:

```ts
      this.resultsSnapshot = computeStats(this.$store.game.turns);
```

with:

```ts
      const finalState = this.state();
      if (finalState) {
        this.resultsSnapshot = computeStats(
          finalState,
          this.$store.game.turns,
          ownerRef(this.$store.game.seats),
        );
      }
```

- [ ] **Step 2: Write the failing test**

Add to `app/tests/lib/game/one-twenty-one-play.data.test.ts` (create it if it does not already exist for this module):

```ts
import { describe, it, expect } from "vitest";
import { oneTwentyOnePlay } from "@lib/game/one-twenty-one-play.data";

describe("oneTwentyOnePlay — per-seat accessors", () => {
  it("currentTargetLabelFor and remainingInAttemptFor read the named seat", () => {
    const ctx = oneTwentyOnePlay() as unknown as {
      $store: { game: { configSnapshot: { seats: unknown[] }; stages: unknown[]; turns: unknown[] } };
      state: () => {
        activeParticipantRef: string;
        seats: { participantRef: string; currentTarget: number; remainingInAttempt: number }[];
      } | null;
      currentTargetLabelFor: (seatRef: string) => string;
      remainingInAttemptFor: (seatRef: string) => number;
    };
    ctx.$store = {
      game: {
        configSnapshot: {
          seats: [
            { participantRef: "p1", displayName: "A", sideKey: "A", participantTypeKey: "PLAYER" },
            { participantRef: "p2", displayName: "B", sideKey: "B", participantTypeKey: "GUEST" },
          ],
        },
        stages: [{ clientKey: "round-1", stageTypeKey: "ROUND", parentClientKey: null, sequence: 1 }],
        turns: [],
      },
    };
    expect(ctx.currentTargetLabelFor("p1")).toBe("121");
    expect(ctx.remainingInAttemptFor("p1")).toBe(121);
  });

  it("returns empty/zero defaults with no config snapshot", () => {
    const ctx = oneTwentyOnePlay() as unknown as {
      $store: { game: { configSnapshot: null } };
      state: () => null;
      currentTargetLabel: () => string;
    };
    ctx.$store = { game: { configSnapshot: null } };
    expect(ctx.state()).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: FAIL before Step 1 (no `currentTargetLabelFor`), PASS after.

- [ ] **Step 4: Branch `OneTwentyOne.astro` on seat count**

Replace the full contents of `app/src/components/layout/games/interfaces/OneTwentyOne.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

const { ...props }: Props = Astro.props;

import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={true}
      target="remainingInAttempt()"
      class="max-h-2/5 h-full"
    >
      <div
        slot="progress"
        class="mt-2 flex w-full flex-col items-center gap-2 px-4"
      >
        <p
          class="text-sm font-mono font-semibold text-accent"
          x-show="checkoutHint()"
          x-text="checkoutHint()"
          x-cloak
        >
        </p>
        <dl class="w-full space-y-1">
          <StatRow
            label="Target"
            value="currentTargetLabel()"
          />
          <StatRow
            label="Visit"
            value="(visitsThisAttempt() + 1) + ' / 3'"
          />
          <StatRow
            label="Darts"
            value="dartsThrownThisSession()"
          />
        </dl>
      </div>
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "remainingInAttemptFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "remainingInAttemptFor(state()?.seats[1]?.participantRef)",
      }}
      isTarget={true}
      class="h-2/5"
    >
      <dl
        slot="progressA"
        class="w-full space-y-1"
      >
        <StatRow
          label="Target"
          value="currentTargetLabelFor(state()?.seats[0]?.participantRef)"
        />
        <StatRow
          label="Visit"
          value="(visitsThisAttemptFor(state()?.seats[0]?.participantRef) + 1) + ' / 3'"
        />
      </dl>
      <dl
        slot="progressB"
        class="w-full space-y-1"
      >
        <StatRow
          label="Target"
          value="currentTargetLabelFor(state()?.seats[1]?.participantRef)"
        />
        <StatRow
          label="Visit"
          value="(visitsThisAttemptFor(state()?.seats[1]?.participantRef) + 1) + ' / 3'"
        />
      </dl>
    </SplitScoreboard>
  </template>

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showDoubleConfirm || showSessionFinishConfirm || finished"
    padDisabled="showDoubleConfirm || showSessionFinishConfirm || finished"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || showSessionFinishConfirm || finished"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the keypad above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

- [ ] **Step 5: Show the race winner in `OneTwentyOneResults.astro`**

In `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro`, replace the `<h2>` block (lines 15-17):

```astro
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-text="
        !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? '170 checked out!'
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' checks out 170!')
      "
    >
    </h2>
```

- [ ] **Step 6: Manual verification**

Start the dev server and play a full 121 1v1 session through to a checkout at 170 for one seat. Confirm: the split scoreboard shows both seats' own ladder position and remaining-in-attempt; the match ends the instant the winning checkout lands, with no further turn offered to the trailing seat; the results modal names the winner; a solo session is unchanged.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/one-twenty-one-play.data.ts \
  app/tests/lib/game/one-twenty-one-play.data.test.ts \
  app/src/components/layout/games/interfaces/OneTwentyOne.astro \
  app/src/components/layout/games/result-modals/OneTwentyOneResults.astro
git commit -m "feat: split scoreboard and race winner banner for 121 1v1"
```

---

## Task 9: Around the Clock engine — score-compare, fewest darts, completion-aware

**Files:**
- Modify: `app/src/modules/game/types.ts:190-204` (the `AroundTheClockState` type)
- Modify: `app/src/modules/game/around-the-clock.engine.module.ts` (full rewrite)
- Test: `app/tests/modules/game/around-the-clock.engine.module.test.ts` (extend — existing cases move to `state.seats[0].*`)

**Interfaces:**
- Consumes: `scoreCompareWinner` from Task 1, `activeSeat` from Task 2 — **the 4-arg call**, passing a completion predicate (the only one of the seven engines that needs it: a miss costs an extra visit, so one seat can finish its own circuit before the other, and the unfinished seat must keep getting every subsequent turn).
- Produces: `AroundTheClockSeatState`, `AroundTheClockState` — Task 10 imports both; `foldAroundTheClockState(facts, config)` exported for the play page, mirroring Task 7's `foldOneTwentyOneState`.

- [ ] **Step 1: Update the type**

In `app/src/modules/game/types.ts`, replace lines 190-204 (the current `AroundTheClockState` type):

```ts
export type AroundTheClockSeatState = SeatState & {
  targetIndex: number;
  dartsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

export type AroundTheClockState = MultiSeatState<AroundTheClockSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
};
```

- [ ] **Step 2: Write the failing test**

Update every existing assertion in `app/tests/modules/game/around-the-clock.engine.module.test.ts` from `state.<field>` to `state.seats[0].<field>` for `targetIndex`/`dartsThisVisit`/`status`. Add:

```ts
describe("AroundTheClockEngine — 1v1", () => {
  const twoSeats = [
    { participantRef: "p1", displayName: "A", sideKey: "A", participantTypeKey: "PLAYER" as const },
    { participantRef: "p2", displayName: "B", sideKey: "B", participantTypeKey: "GUEST" as const },
  ];
  const twoSeatConfig: Seated<AroundTheClockSnapshot> = { seats: twoSeats };

  function hitDart(number: number): DartObservation {
    return { hitTargetNumber: number, hitZoneKey: "SINGLE", locationX: null, locationY: null };
  }
  function bullHit(): DartObservation {
    return { hitTargetNumber: 25, hitZoneKey: "INNER_BULL", locationX: null, locationY: null };
  }

  it("keeps handing turns to a seat that has not finished once the other has", () => {
    const engine = new AroundTheClockEngine(twoSeatConfig);
    // p1 clears 1..20 then BULL in 21 single-dart hits (no misses).
    for (let n = 1; n <= 20; n++) engine.record(hitDart(n));
    let state = engine.record(bullHit());
    expect(state.seats[0].status).toBe("COMPLETE");
    expect(state.status).toBe("IN_PROGRESS"); // p2 has not finished yet
    expect(state.activeParticipantRef).toBe("p2");

    for (let n = 1; n <= 20; n++) engine.record(hitDart(n));
    state = engine.record(bullHit());
    expect(state.seats[1].status).toBe("COMPLETE");
    expect(state.status).toBe("COMPLETE");
  });

  it("the seat with fewer darts to complete wins on a score-compare basis", () => {
    const engine = new AroundTheClockEngine(twoSeatConfig);
    for (let n = 1; n <= 20; n++) engine.record(hitDart(n)); // p1: 21 darts, 0 misses
    engine.record(bullHit());
    // p2 misses target 1 twice before hitting it (5 darts for that target).
    engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS", locationX: null, locationY: null });
    engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS", locationX: null, locationY: null });
    engine.record(hitDart(1));
    for (let n = 2; n <= 20; n++) engine.record(hitDart(n));
    const state = engine.record(bullHit());
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("A");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/around-the-clock.engine.module.test.ts`
Expected: FAIL.

- [ ] **Step 4: Write the implementation**

Replace the full contents of `app/src/modules/game/around-the-clock.engine.module.ts`:

```ts
import type { AroundTheClockSnapshot, Seated, SeatFact } from "@lib/types";
import { newClientKey } from "./client-key.module";
import {
  BULL_TARGET_NUMBER,
  boardScore,
  numbersPath,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { scoreCompareWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  AroundTheClockSeatState,
  AroundTheClockState,
  BoardTarget,
  DartFact,
  DartObservation,
  EngineFacts,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

const LAST_TARGET_INDEX = 20;

function initialSeatState(seat: SeatFact): AroundTheClockSeatState {
  return { participantRef: seat.participantRef, sideKey: seat.sideKey, targetIndex: 0, dartsThisVisit: 0, status: "IN_PROGRESS" };
}

/** Around the Clock starting state: every configured seat aimed at NUMBER 1, no darts thrown. */
export function initialAroundTheClockState(
  config: Seated<AroundTheClockSnapshot>,
): AroundTheClockState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

export function isAroundTheClockHit(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  if (target.kind === "BULL") {
    return (
      observation.hitTargetNumber === BULL_TARGET_NUMBER &&
      (observation.hitZoneKey === "OUTER_BULL" || observation.hitZoneKey === "INNER_BULL")
    );
  }
  return observation.hitTargetNumber === target.number && observation.hitZoneKey !== "MISS";
}

/**
 * Pure reducer: folds one dart observation onto one seat's
 * `AroundTheClockSeatState`. A hit advances the target immediately, mid
 * -visit. A hit on the BULL target (index 20) completes that seat's own
 * circuit immediately, whatever `dartsThisVisit` currently is. Otherwise the
 * visit closes (`dartsThisVisit` resets to 0) once it reaches 3 darts.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyAroundTheClockDart(
  state: AroundTheClockSeatState,
  observation: DartObservation,
): AroundTheClockSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session has ended; undo first to correct it.",
    );
  }

  const target = targetAt(numbersPath(), state.targetIndex);
  const hit = isAroundTheClockHit(target, observation);

  if (hit && state.targetIndex === LAST_TARGET_INDEX) {
    return { ...state, targetIndex: LAST_TARGET_INDEX, dartsThisVisit: 0, status: "COMPLETE" };
  }

  const targetIndex = hit ? state.targetIndex + 1 : state.targetIndex;
  const dartsThisVisit = state.dartsThisVisit + 1 === 3 ? 0 : state.dartsThisVisit + 1;
  return { ...state, targetIndex, dartsThisVisit, status: "IN_PROGRESS" };
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

function dartsThrownBy(seat: SeatFact, turns: readonly TurnFact[]): number {
  return turns
    .filter((turn) => turn.participantRef === seat.participantRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}

/**
 * Folds the whole fact log into the session's state — the same function the
 * engine's own `deriveState()` delegates to and the play page calls
 * directly for reactive display, mirroring `foldOneTwentyOneState`.
 *
 * Score-compare, fewest darts wins: both seats always play out their own
 * full circuit — a completed seat is skipped by `activeSeat`'s completion
 * predicate, handing every remaining turn to the other, so a miss's extra
 * visit never steals a turn from a seat that has already finished. The
 * match resolves only once both seats are `COMPLETE`.
 */
export function foldAroundTheClockState(
  facts: EngineFacts,
  config: Seated<AroundTheClockSnapshot>,
): AroundTheClockState {
  const seats = config.seats.map((seat) => {
    let state = initialSeatState(seat);
    const seatTurns = facts.turns.filter((turn) => turn.participantRef === seat.participantRef);
    for (const turn of seatTurns) {
      for (const dart of turn.darts) {
        state = applyAroundTheClockDart(state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
      }
    }
    return state;
  });

  const winningSideKey =
    seats.length === 1
      ? null
      : scoreCompareWinner(
          seats.map((seat) => ({
            sideKey: seat.sideKey,
            completed: seat.status === "COMPLETE",
            metric: dartsThrownBy(seat, facts.turns),
          })),
          "LOWEST",
        );

  const allComplete = seats.every((seat) => seat.status === "COMPLETE");
  const status: AroundTheClockState["status"] =
    seats.length === 1
      ? seats[0].status
      : !allComplete
        ? "IN_PROGRESS"
        : winningSideKey !== null
          ? "COMPLETE"
          : "TIE";

  return {
    activeParticipantRef: activeSeat(
      facts,
      config.seats,
      "PER_SEAT",
      (candidate) =>
        seats.find((seat) => seat.participantRef === candidate.participantRef)?.status ===
        "COMPLETE",
    ).participantRef,
    status,
    winningSideKey,
    seats,
  };
}

/**
 * Around the Clock: a fixed 21-target path (1..20, then BULL) walked with
 * mid-visit advancement, per seat. Score-compare: both seats always play
 * their whole circuit, then whichever finished in fewer darts wins — a miss
 * costs an extra visit, so seats can finish in different visit counts, which
 * is why `activeSeat` needs the completion predicate this engine passes.
 */
export class AroundTheClockEngine implements GameEngine<
  DartObservation,
  AroundTheClockState
> {
  readonly rulesetVersionKey = "AROUND_THE_CLOCK_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<AroundTheClockSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): AroundTheClockState {
    return foldAroundTheClockState({ stages: [{ ...STAGE }], turns: this.turns }, this.config);
  }

  private openOrCreateTurn(activeParticipantRef: string): TurnFact {
    const last = this.turns.at(-1);
    if (last && last.darts.length < 3) return last;

    const turn: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      participantRef: activeParticipantRef,
      sequence: this.turns.length + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(turn);
    return turn;
  }

  /**
   * Appends one dart to the active seat's open visit, opening a new one when
   * the last is already 3 darts deep. `completedAt` is stamped when the
   * visit resolves: on its 3rd dart, or immediately when this dart completes
   * that seat's own circuit.
   * @throws when the active seat has already completed its own circuit; the
   *   fact log is left untouched.
   */
  record(observation: DartObservation): AroundTheClockState {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the session has ended; undo first to correct it.",
      );
    }
    const after = applyAroundTheClockDart(activeSeatState, observation);

    const openTurn = this.openOrCreateTurn(before.activeParticipantRef);
    const dart: DartFact = {
      sequence: openTurn.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: observation.locationX,
      locationY: observation.locationY,
    };

    openTurn.darts.push(dart);
    openTurn.totalScore = sumDartScores(openTurn.darts);
    if (openTurn.darts.length === 3 || after.status === "COMPLETE") {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  undo(): boolean {
    const openTurn = this.turns.at(-1);
    if (!openTurn || openTurn.darts.length === 0) return false;

    openTurn.darts.pop();
    if (openTurn.darts.length === 0) {
      this.turns.pop();
    } else {
      openTurn.completedAt = null;
      openTurn.totalScore = sumDartScores(openTurn.darts);
    }
    return true;
  }

  /**
   * Answers whether recording `observation` would complete the WHOLE
   * session, not merely the active seat's own circuit: for a solo session
   * (the only other seat set is empty) those are the same thing; for 1v1 the
   * match only completes once every other seat has already finished.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;

    const after = applyAroundTheClockDart(activeSeatState, observation);
    if (after.status !== "COMPLETE") return false;

    return before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) => seat.status === "COMPLETE");
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): AroundTheClockState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const aroundTheClockEngineFactory: GameEngineFactory<
  Seated<AroundTheClockSnapshot>,
  DartObservation,
  AroundTheClockState
> = {
  rulesetVersionKey: "AROUND_THE_CLOCK_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<AroundTheClockSnapshot>, prior?: EngineFacts) {
    return new AroundTheClockEngine(config, prior);
  },
};

registerEngineFactory(aroundTheClockEngineFactory);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/around-the-clock.engine.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the game-engine structural gate**

Run: `cd app && bash scripts/check-game-engines.sh`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/around-the-clock.engine.module.ts app/tests/modules/game/around-the-clock.engine.module.test.ts
git commit -m "feat: wire a 1v1 opponent seat into Around the Clock (score-compare, fewest darts)"
```

---

## Task 10: Around the Clock frontend — split scoreboard and fewest-darts banner

**Files:**
- Modify: `app/src/lib/game/around-the-clock-play.data.ts`
- Modify: `app/src/components/layout/games/interfaces/AroundTheClock.astro`
- Modify: `app/src/components/layout/games/result-modals/AroundTheClockResults.astro`
- Test: `app/tests/lib/game/around-the-clock-play.data.test.ts` (extend or create)

`play-lifecycle.ts` (the shared `playInit`/`playCommitDart`/`playUndoVisit`/`playUploadAndCompleteSession`/`playBack`/`playAbandonAndExit`/`runPlayAgain` this file already delegates to) needs no change — it only ever calls `engine.isComplete()`/`engine.state()` and a per-ruleset `buildResultsSnapshot` closure, all of which are already seat-count-agnostic.

- [ ] **Step 1: Add a `state()` accessor and per-seat variants to `around-the-clock-play.data.ts`**

In `app/src/lib/game/around-the-clock-play.data.ts`, add the import `AroundTheClockState` (and `AroundTheClockSeatState`) to the existing `import type { DartFact, DartObservation, TurnFact }` line, plus `import { scoreCompareWinner } from "@modules/game/match-outcome.module";` is **not** needed here — the winner is already resolved inside `AroundTheClockState.winningSideKey`, computed by the engine.

Replace `currentTargetLabel`/`turnsSoFar`/`accuracy`/`isBullVisit` (lines 146-166) with:

```ts
    state(this: AroundTheClockPlayContext): AroundTheClockState | null {
      return this.engine?.state() ?? null;
    },

    activeSeatState(this: AroundTheClockPlayContext): AroundTheClockSeatState | null {
      const state = this.state();
      if (!state) return null;
      return (
        state.seats.find((seat) => seat.participantRef === state.activeParticipantRef) ??
        null
      );
    },

    currentTargetLabelFor(this: AroundTheClockPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find((candidate) => candidate.participantRef === seatRef);
      if (!seat) return "";
      const target = targetAt(numbersPath(), seat.targetIndex);
      return target.kind === "BULL" ? "BULL" : String(target.number);
    },

    currentTargetLabel(this: AroundTheClockPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    turnsSoFarFor(this: AroundTheClockPlayContext, seatRef: string): string {
      return String(
        this.$store.game.turns.filter((turn) => turn.participantRef === seatRef).length,
      );
    },

    turnsSoFar(this: AroundTheClockPlayContext): string {
      const state = this.state();
      if (!state) return "0";
      return this.turnsSoFarFor(state.activeParticipantRef);
    },

    accuracyFor(this: AroundTheClockPlayContext, seatRef: string): string {
      const turns = this.$store.game.turns.filter((turn) => turn.participantRef === seatRef);
      return accuracyLabel(countHits(turns), countDarts(turns));
    },

    accuracy(this: AroundTheClockPlayContext): string {
      const state = this.state();
      if (!state) return "0%";
      return this.accuracyFor(state.activeParticipantRef);
    },

    isBullVisit(this: AroundTheClockPlayContext): boolean {
      const seat = this.activeSeatState();
      if (!seat) return false;
      return targetAt(numbersPath(), seat.targetIndex).kind === "BULL";
    },
```

`replayHits` (used by `countHits`/`previewSegmentsFor`) calls `initialAroundTheClockState()` with no arguments — Task 9 changed that function's signature to require `config: Seated<AroundTheClockSnapshot>`. Update `replayHits`:

```ts
function replayHits(
  config: Seated<AroundTheClockSnapshot>,
  turns: readonly TurnFact[],
): boolean[] {
  let state = initialAroundTheClockState(config).seats[0];
  const hits: boolean[] = [];
  for (const turn of turns) {
    for (const dart of turn.darts) {
      const observation = dartObservation(dart);
      const target = targetAt(numbersPath(), state.targetIndex);
      hits.push(isAroundTheClockHit(target, observation));
      state = applyAroundTheClockDart(state, observation);
    }
  }
  return hits;
}
```

`replayHits` is always called with `turns` already filtered to one seat (`countHits`/`countDarts`/`previewSegmentsFor` all now receive a single seat's own turns, per the per-seat accessors above and the preview-segment update below), so folding through one seat's own progress (`initialAroundTheClockState(config).seats[0]`) is exactly the per-seat replay it always needed — `config` here does not need to vary by which seat is folding, since `initialAroundTheClockState`'s per-seat starting state is identical for every seat (`AroundTheClockSnapshot` has no configurable fields). Add `import type { AroundTheClockSnapshot, Seated } from "@lib/types";` and thread `this.$store.game.configSnapshot!` through every `replayHits`/`countHits`/`countDarts` call site (`accuracyFor`, `previewSegments`, `uploadAndCompleteSession`'s stats builder below).

Update `previewSegments` to scope to the active seat's own turns:

```ts
    previewSegments(
      this: AroundTheClockPlayContext,
    ): AroundTheClockPreviewSegment[] {
      const state = this.state();
      const config = this.$store.game.configSnapshot;
      if (!state || !config) return [...EMPTY_SEGMENTS];
      const seatTurns = this.$store.game.turns.filter(
        (turn) => turn.participantRef === state.activeParticipantRef,
      );
      return previewSegmentsFor(config, seatTurns, this.hiddenTurnKey);
    },
```

(`previewSegmentsFor` and `countHits`/`countDarts` each gain a leading `config: Seated<AroundTheClockSnapshot>` parameter, threaded through to their own `replayHits` call — same mechanical change as `replayHits` itself.)

Replace `uploadAndCompleteSession` (lines 239-246):

```ts
    uploadAndCompleteSession(this: AroundTheClockPlayContext): Promise<void> {
      const state = this.state();
      const config = this.$store.game.configSnapshot;
      const ownerRef =
        this.$store.game.seats.find((seat) => seat.participantTypeKey === "PLAYER")
          ?.participantRef ?? null;
      const ownerTurns =
        ownerRef === null
          ? this.$store.game.turns
          : this.$store.game.turns.filter((turn) => turn.participantRef === ownerRef);
      return playUploadAndCompleteSession(this, () => ({
        turns: ownerTurns.length,
        accuracy: config ? accuracyLabel(countHits(config, ownerTurns), countDarts(ownerTurns)) : "0%",
        totalDarts: countDarts(ownerTurns),
        winningSideKey: state?.winningSideKey ?? null,
      }));
    },
```

- [ ] **Step 2: Write the failing test**

Add to `app/tests/lib/game/around-the-clock-play.data.test.ts` (create it if it does not already exist for this module):

```ts
import { describe, it, expect } from "vitest";
import { aroundTheClockPlay } from "@lib/game/around-the-clock-play.data";

describe("aroundTheClockPlay — per-seat accessors", () => {
  it("currentTargetLabelFor and turnsSoFarFor read the named seat", () => {
    const ctx = aroundTheClockPlay() as unknown as {
      engine: { state: () => { activeParticipantRef: string; seats: { participantRef: string; targetIndex: number }[] } };
      $store: { game: { turns: { participantRef: string }[] } };
      currentTargetLabelFor: (seatRef: string) => string;
      turnsSoFarFor: (seatRef: string) => string;
    };
    ctx.engine = {
      state: () => ({
        activeParticipantRef: "p1",
        seats: [
          { participantRef: "p1", targetIndex: 0 },
          { participantRef: "p2", targetIndex: 5 },
        ],
      }),
    };
    ctx.$store = {
      game: {
        turns: [
          { participantRef: "p1" },
          { participantRef: "p2" },
          { participantRef: "p1" },
        ],
      },
    };
    expect(ctx.currentTargetLabelFor("p1")).toBe("1");
    expect(ctx.currentTargetLabelFor("p2")).toBe("6");
    expect(ctx.turnsSoFarFor("p1")).toBe("2");
    expect(ctx.turnsSoFarFor("p2")).toBe("1");
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts`
Expected: FAIL before Step 1, PASS after.

- [ ] **Step 4: Branch `AroundTheClock.astro` on seat count**

Replace the full contents of `app/src/components/layout/games/interfaces/AroundTheClock.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

const { ...props }: Props = Astro.props;

import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import SinglesRecreationalInput from "@components/layout/games/SinglesRecreationalInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      target="currentTargetLabel()"
      class="min-h-2/5 max-h-2/5 h-full"
    >
      <div
        slot="progress"
        class="mt-2 flex w-full flex-col items-center gap-2 px-4"
      >
        <dl class="w-full space-y-1">
          <StatRow
            label="Turns"
            value="turnsSoFar()"
          />
          <StatRow
            label="Accuracy"
            value="accuracy()"
          />
        </dl>
      </div>
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "currentTargetLabelFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "currentTargetLabelFor(state()?.seats[1]?.participantRef)",
      }}
      isTarget={true}
      class="h-2/5"
    >
      <dl
        slot="progressA"
        class="w-full space-y-1"
      >
        <StatRow
          label="Turns"
          value="turnsSoFarFor(state()?.seats[0]?.participantRef)"
        />
        <StatRow
          label="Accuracy"
          value="accuracyFor(state()?.seats[0]?.participantRef)"
        />
      </dl>
      <dl
        slot="progressB"
        class="w-full space-y-1"
      >
        <StatRow
          label="Turns"
          value="turnsSoFarFor(state()?.seats[1]?.participantRef)"
        />
        <StatRow
          label="Accuracy"
          value="accuracyFor(state()?.seats[1]?.participantRef)"
        />
      </dl>
    </SplitScoreboard>
  </template>

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <VisitPreview />

  <SinglesRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

- [ ] **Step 5: Show the fewest-darts winner in `AroundTheClockResults.astro`**

In `app/src/components/layout/games/result-modals/AroundTheClockResults.astro`, replace the `<h2>` (lines 15-17):

```astro
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-text="
        !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? 'Session complete'
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins — fewest darts!')
      "
    >
    </h2>
```

- [ ] **Step 6: Manual verification**

Start the dev server and play a full Around the Clock 1v1 session: let one seat finish its own circuit (via the recreational tap row) while the other has not — confirm the finished seat's opponent keeps getting every subsequent turn, the split scoreboard keeps showing both seats' own targets/accuracy, and the match only ends once both have finished, with the fewest-darts seat announced as winner. Confirm a solo session is unchanged.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/around-the-clock-play.data.ts \
  app/tests/lib/game/around-the-clock-play.data.test.ts \
  app/src/components/layout/games/interfaces/AroundTheClock.astro \
  app/src/components/layout/games/result-modals/AroundTheClockResults.astro
git commit -m "feat: split scoreboard and fewest-darts banner for Around the Clock 1v1"
```

---

## Task 11: TUOD engine and setup — score-compare, highest target, ROUNDS-only 1v1

**Files:**
- Modify: `app/src/modules/game/types.ts:236-242` (the `TuodState` type)
- Modify: `app/src/modules/game/tuod.engine.module.ts` (full rewrite)
- Modify: `app/src/lib/game/tuod-setup.data.ts`
- Modify: `app/src/components/layout/games/setup/TuodSetupForm.astro` (hide MINUTES once a guest is added)
- Test: `app/tests/modules/game/tuod.engine.module.test.ts` (extend — existing cases move to `state.seats[0].*`)
- Test: `app/tests/lib/game/tuod-setup.data.test.ts` (extend or create)

**Interfaces:**
- Consumes: `scoreCompareWinner` from Task 1, `activeSeat` from Task 2 (3-arg call — every seat plays the same fixed number of ROUNDS in 1v1, so lockstep alternation never needs the completion predicate; MINUTES is solo-only, see below).
- Produces: `TuodSeatState`, `TuodState` — no other task consumes these; `foldTuodState(facts, config)` exported for symmetry with the other engines but not required by any other task (TUOD's own play-page code already goes through `this.engine.state()`, matching its pre-existing pattern — see Task 12).

- [ ] **Step 1: Update the type**

In `app/src/modules/game/types.ts`, replace lines 236-242 (the current `TuodState` type):

```ts
export type TuodSeatState = SeatState & {
  currentTarget: number;
  attempts: number;
  successes: number;
  failures: number;
};

export type TuodState = MultiSeatState<TuodSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
  timerExpired: boolean;
};
```

- [ ] **Step 2: Write the failing test**

Update every existing assertion in `app/tests/modules/game/tuod.engine.module.test.ts` from `state.<field>` to `state.seats[0].<field>` for `currentTarget`/`attempts`/`successes`/`failures`; `state.timerExpired` stays top-level. Add:

```ts
describe("TuodEngine — 1v1", () => {
  const twoSeats = [
    { participantRef: "p1", displayName: "A", sideKey: "A", participantTypeKey: "PLAYER" as const },
    { participantRef: "p2", displayName: "B", sideKey: "B", participantTypeKey: "GUEST" as const },
  ];
  const twoSeatConfig: Seated<TuodSnapshot> = {
    startingTarget: 41,
    finishBonus: 10,
    missPenalty: 1,
    maxDartsPerTurn: 3,
    durationType: "ROUNDS",
    durationValue: 2,
    seats: twoSeats,
  };

  it("both seats always play out their own full ROUNDS budget before the match resolves", () => {
    const engine = new TuodEngine(twoSeatConfig);
    engine.record({ checkedOut: false }); // p1 round 1: fail
    engine.record({ checkedOut: false }); // p2 round 1: fail
    let state = engine.state();
    expect(state.status).toBe("IN_PROGRESS");
    engine.record({ checkedOut: false }); // p1 round 2: fail
    state = engine.state();
    expect(state.status).toBe("IN_PROGRESS"); // p2 still has a round left
    state = engine.record({ checkedOut: true, finishedOnDouble: true }); // p2 round 2: success, climbs to 51
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("B"); // p2's 51 beats p1's 40 (41 - 1)
  });

  it("stamps every turn's participantRef with a seat present in seats[]", () => {
    const engine = new TuodEngine(twoSeatConfig);
    engine.record({ checkedOut: false });
    engine.record({ checkedOut: false });
    const facts = engine.facts();
    for (const turn of facts.turns) {
      expect(twoSeats.some((seat) => seat.participantRef === turn.participantRef)).toBe(
        true,
      );
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts`
Expected: FAIL.

- [ ] **Step 4: Write the implementation**

Replace the full contents of `app/src/modules/game/tuod.engine.module.ts`:

```ts
import type { TuodSnapshot, Seated, SeatFact } from "@lib/types";
import { classify } from "@lib/game/board/board-geometry.module";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { newClientKey } from "./client-key.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { scoreCompareWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  StageFact,
  TuodAttemptInput,
  TuodInput,
  TuodSeatState,
  TuodState,
  TurnFact,
} from "./types";

const MIN_FINISHABLE_TARGET = 2;

function blockStage(): StageFact {
  return { clientKey: "block-1", stageTypeKey: "EXERCISE_BLOCK", parentClientKey: null, sequence: 1 };
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

function isTuodSuccess(input: TuodAttemptInput): boolean {
  return input.checkedOut && input.finishedOnDouble === true;
}

function isDartObservation(input: TuodInput): input is DartObservation {
  return "hitZoneKey" in input;
}

function visitOutcome(
  remainingAfter: number,
  lastZoneKey: DartZoneKey,
): { checkedOut: boolean; busted: boolean } {
  const checkedOut = remainingAfter === 0 && lastZoneKey === "DOUBLE";
  const busted =
    remainingAfter < 0 || remainingAfter === 1 || (remainingAfter === 0 && !checkedOut);
  return { checkedOut, busted };
}

function initialSeatState(config: TuodSnapshot, seat: SeatFact): TuodSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    currentTarget: config.startingTarget,
    attempts: 0,
    successes: 0,
    failures: 0,
  };
}

/** The ladder as it stands before any attempt: every seat on the configured start target. */
export function initialTuodState(config: Seated<TuodSnapshot>): TuodState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    timerExpired: false,
    seats: config.seats.map((seat) => initialSeatState(config, seat)),
  };
}

/**
 * Pure reducer: folds one resolved attempt onto one seat's `TuodSeatState`. A
 * success moves the next target up by `finishBonus`; a failure moves it down
 * by `missPenalty`, floored at the double-out minimum.
 */
export function applyTuodAttempt(
  config: TuodSnapshot,
  state: TuodSeatState,
  succeeded: boolean,
): TuodSeatState {
  return {
    ...state,
    currentTarget: succeeded
      ? state.currentTarget + config.finishBonus
      : Math.max(MIN_FINISHABLE_TARGET, state.currentTarget - config.missPenalty),
    attempts: state.attempts + 1,
    successes: succeeded ? state.successes + 1 : state.successes,
    failures: succeeded ? state.failures : state.failures + 1,
  };
}

function seatCompletesAt(config: TuodSnapshot, attemptCount: number, timerExpired: boolean): boolean {
  if (config.durationType === "ROUNDS") {
    return attemptCount >= config.durationValue;
  }
  return timerExpired && attemptCount >= 1;
}

/**
 * Folds the whole fact log into the session's state — the same function the
 * engine's own `deriveState()` delegates to, mirroring `foldAroundTheClockState`.
 * Score-compare, highest target wins: both seats always play out their own
 * full ROUNDS budget (1v1 offers ROUNDS only — see `tuod-setup.data.ts`);
 * `activeSeat` never needs a completion predicate here because every seat's
 * budget is the same fixed count, so lockstep alternation already lands each
 * seat on its own last round together.
 */
export function foldTuodState(
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  timerExpired: boolean,
): TuodState {
  const seats = config.seats.map((seat) => {
    let state = initialSeatState(config, seat);
    const seatTurns = facts.turns.filter(
      (turn) => turn.participantRef === seat.participantRef && turn.completedAt !== null,
    );
    for (const turn of seatTurns) {
      state = applyTuodAttempt(config, state, turn.totalScore > 0);
    }
    return state;
  });

  const completedSeats = seats.map((seat) => seatCompletesAt(config, seat.attempts, timerExpired));
  const allComplete = completedSeats.every(Boolean);

  const winningSideKey =
    seats.length === 1
      ? null
      : scoreCompareWinner(
          seats.map((seat, index) => ({
            sideKey: seat.sideKey,
            completed: completedSeats[index],
            metric: seat.currentTarget,
          })),
          "HIGHEST",
        );

  const status: TuodState["status"] =
    seats.length === 1
      ? "IN_PROGRESS" // solo's own completion is read off isComplete(), not this field — see class isComplete()
      : !allComplete
        ? "IN_PROGRESS"
        : winningSideKey !== null
          ? "COMPLETE"
          : "TIE";

  return {
    activeParticipantRef: activeSeat(
      facts,
      config.seats,
      "PER_SEAT",
      (candidate) => {
        const index = seats.findIndex((seat) => seat.participantRef === candidate.participantRef);
        return index === -1 ? false : completedSeats[index];
      },
    ).participantRef,
    status,
    winningSideKey,
    timerExpired,
    seats,
  };
}

/**
 * Ten Up One Down: a checkout ladder per seat, starting at `startingTarget`,
 * climbing `finishBonus` on a checked-out attempt and falling `missPenalty`
 * on a failed one, played for a ROUNDS duration in 1v1 (MINUTES stays solo
 * -only — a single wall-clock timer running through two seats' alternating
 * turns is a separate, deferred capture problem). Score-compare: both seats
 * always play their own full round budget, then whichever reached the higher
 * target wins.
 */
export class TuodEngine implements GameEngine<TuodInput, TuodState> {
  readonly rulesetVersionKey = "TUOD_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly stage: StageFact;
  private readonly turns: TurnFact[];
  private timerExpired = false;

  constructor(
    private readonly config: Seated<TuodSnapshot>,
    prior?: EngineFacts,
  ) {
    const priorStage = prior?.stages[0];
    this.stage = priorStage ? { ...priorStage } : blockStage();
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): TuodState {
    return foldTuodState({ stages: [this.stage], turns: this.turns }, this.config, this.timerExpired);
  }

  private closedTurnCountFor(participantRef: string): number {
    return this.turns.filter(
      (turn) => turn.participantRef === participantRef && turn.completedAt !== null,
    ).length;
  }

  private openVisit(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.completedAt !== null) return null;
    return last;
  }

  private openNewVisit(activeParticipantRef: string): TurnFact {
    const visit: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: this.stage.clientKey,
      participantRef: activeParticipantRef,
      sequence: this.turns.length + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(visit);
    return visit;
  }

  private targetBeforeVisit(visit: TurnFact): number {
    const index = this.turns.indexOf(visit);
    return foldTuodState(
      { stages: [this.stage], turns: this.turns.slice(0, index) },
      this.config,
      this.timerExpired,
    ).seats.find((seat) => seat.participantRef === visit.participantRef)!.currentTarget;
  }

  private resolveObservation(observation: DartObservation) {
    return observation.locationX === null || observation.locationY === null
      ? { targetNumber: null, zoneKey: observation.hitZoneKey, score: 0 }
      : classify(observation.locationX, observation.locationY);
  }

  private rejectionReason(activeSeatState: TuodSeatState, input: TuodAttemptInput): string | null {
    if (this.isComplete()) {
      return "Cannot record an attempt once the session is complete; undo first to correct it.";
    }
    if (this.openVisit() !== null) {
      return "Finish the open attempt on the board before entering a keypad total.";
    }
    if (!isTuodSuccess(input)) return null;
    return checkoutDartsRejection(
      activeSeatState.currentTarget,
      input.dartsUsed,
      input.dartsAtDouble,
      this.config.maxDartsPerTurn,
    );
  }

  expireTimer(): void {
    this.timerExpired = true;
  }

  private settleVisit(visit: TurnFact): boolean {
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const remainingAfter = this.targetBeforeVisit(visit) - thrown;
    const lastDart = visit.darts.at(-1)!;
    const { checkedOut, busted } = visitOutcome(remainingAfter, lastDart.hitZoneKey);

    if (busted) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
      return true;
    }
    if (checkedOut) {
      visit.totalScore = thrown;
      visit.completedAt = new Date().toISOString();
      return true;
    }

    const outOfDarts = visit.darts.length === this.config.maxDartsPerTurn;
    if (outOfDarts) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
    }
    return outOfDarts;
  }

  private recordDart(observation: DartObservation): TuodState {
    if (this.isComplete()) {
      throw new Error(
        "Cannot record an attempt once the session is complete; undo first to correct it.",
      );
    }
    const activeParticipantRef = this.deriveState().activeParticipantRef;

    const resolved = this.resolveObservation(observation);
    const visit = this.openVisit() ?? this.openNewVisit(activeParticipantRef);

    visit.darts.push({
      sequence: visit.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: resolved.targetNumber,
      hitZoneKey: resolved.zoneKey,
      score: resolved.score,
      locationX: observation.locationX,
      locationY: observation.locationY,
    });

    this.settleVisit(visit);
    return this.deriveState();
  }

  private recordAttemptTotal(input: TuodAttemptInput): TuodState {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    const reason = this.rejectionReason(activeSeatState, input);
    if (reason) throw new Error(reason);

    const succeeded = isTuodSuccess(input);
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: this.stage.clientKey,
      participantRef: before.activeParticipantRef,
      sequence: this.turns.length + 1,
      completedAt: new Date().toISOString(),
      totalScore: succeeded ? activeSeatState.currentTarget : 0,
      darts: [],
    });

    return this.deriveState();
  }

  record(input: TuodInput): TuodState {
    if (isDartObservation(input)) {
      return this.recordDart(input);
    }
    return this.recordAttemptTotal(input);
  }

  undo(): boolean {
    const last = this.turns.at(-1);
    if (!last) return false;
    return last.darts.length > 0 ? this.undoDart() : this.undoAttemptTotal();
  }

  private undoAttemptTotal(): boolean {
    return this.turns.pop() !== undefined;
  }

  private undoDart(): boolean {
    const visit = this.turns.at(-1);
    if (!visit) return false;

    visit.darts.pop();
    if (visit.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    visit.totalScore = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    visit.completedAt = null;
    return true;
  }

  private wouldCompleteDart(observation: DartObservation): boolean {
    if (this.isComplete()) return false;

    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    const visit = this.openVisit();
    const priorDarts = visit ? visit.darts : [];
    const target = visit ? this.targetBeforeVisit(visit) : activeSeatState.currentTarget;

    const resolved = this.resolveObservation(observation);
    const thrown = priorDarts.reduce((sum, dart) => sum + dart.score, 0) + resolved.score;
    const remainingAfter = target - thrown;
    const { checkedOut, busted } = visitOutcome(remainingAfter, resolved.zoneKey);
    const dartCount = priorDarts.length + 1;
    const visitResolves = checkedOut || busted || dartCount === this.config.maxDartsPerTurn;

    if (!visitResolves) return false;

    const otherSeatsComplete = before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) => seatCompletesAt(this.config, seat.attempts, this.timerExpired));
    return (
      seatCompletesAt(this.config, activeSeatState.attempts + 1, this.timerExpired) &&
      otherSeatsComplete
    );
  }

  wouldComplete(input: TuodInput): boolean {
    if (isDartObservation(input)) {
      return this.wouldCompleteDart(input);
    }

    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (this.rejectionReason(activeSeatState, input) !== null) return false;

    const otherSeatsComplete = before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) => seatCompletesAt(this.config, seat.attempts, this.timerExpired));
    return (
      seatCompletesAt(this.config, activeSeatState.attempts + 1, this.timerExpired) &&
      otherSeatsComplete
    );
  }

  /**
   * `foldTuodState`'s own `status` field reads `"IN_PROGRESS"` for a solo
   * (1-seat) session even once that seat is done — score-compare's status
   * only resolves once every OTHER seat is also complete, and a solo session
   * has no other seat to wait on. Solo completion is instead read directly
   * off that one seat's own attempt count against its own round budget.
   */
  isComplete(): boolean {
    const state = this.deriveState();
    if (state.seats.length === 1) {
      return seatCompletesAt(this.config, state.seats[0].attempts, this.timerExpired);
    }
    return state.status !== "IN_PROGRESS";
  }

  state(): TuodState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...this.stage }], turns: cloneTurns(this.turns) };
  }
}

export const tuodEngineFactory: GameEngineFactory<Seated<TuodSnapshot>, TuodInput, TuodState> = {
  rulesetVersionKey: "TUOD_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<TuodSnapshot>, prior?: EngineFacts) {
    return new TuodEngine(config, prior);
  },
};

registerEngineFactory(tuodEngineFactory);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts`
Expected: PASS, including every pre-existing solo case (a solo session must still complete exactly when it did before this task — verify this explicitly, since Step 4's note above is the fix for a regression this rewrite would otherwise introduce).

- [ ] **Step 6: Run the game-engine structural gate**

Run: `cd app && bash scripts/check-game-engines.sh`
Expected: PASS.

- [ ] **Step 7: Restrict 1v1 TUOD setup to ROUNDS and wire the guest into `start()`**

In `app/src/lib/game/tuod-setup.data.ts`, add `guests: [] as { displayName: string }[], showAddGuestModal: false, newGuestName: "",` to the returned object literal (alongside `reconciliationFailed: false,`), and `addGuest`/`removeGuest` methods identical to Task 4's Step 1 (`this.guests.length >= 1` cap), and force `durationType` back to `"ROUNDS"` whenever a guest exists — add this method:

```ts
    forceRoundsIfGuested(this: TuodSetupContext) {
      if (this.guests.length > 0) this.durationType = "ROUNDS";
    },
```

Call it at the end of `addGuest`, and thread `participants` into `start()`'s `createSession` call exactly as Task 4's Step 1 does (one PLAYER seat A, `this.guests[0]` as GUEST seat B when present).

In `app/src/components/layout/games/setup/TuodSetupForm.astro`, wrap the `Toggle` in a guest-aware guard — replace:

```astro
    <Toggle
      orientation="horizontal"
      options={durationOpts}
      x-model="durationType"
      class="w-full"
    />
```

with:

```astro
    <Toggle
      orientation="horizontal"
      options={durationOpts}
      x-model="durationType"
      x-show="guests.length === 0"
      x-cloak
      class="w-full"
    />
    <p
      class="text-sm text-muted-foreground px-4 py-0 italic"
      x-show="guests.length > 0"
      x-cloak
    >
      1v1 plays 10 Rounds — timed mode is solo-only.
    </p>
```

- [ ] **Step 8: Write the setup test**

Add to `app/tests/lib/game/tuod-setup.data.test.ts` (create it if it does not already exist for this module):

```ts
import { describe, it, expect } from "vitest";
import { tuodSetup } from "@lib/game/tuod-setup.data";

describe("tuodSetup — 1v1 forces ROUNDS", () => {
  it("forceRoundsIfGuested resets MINUTES back to ROUNDS once a guest is added", () => {
    const ctx = tuodSetup() as unknown as {
      durationType: string;
      guests: { displayName: string }[];
      newGuestName: string;
      addGuest: () => void;
    };
    ctx.durationType = "MINUTES";
    ctx.newGuestName = "Guest 1";
    ctx.addGuest();
    expect(ctx.durationType).toBe("ROUNDS");
  });
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/tuod-setup.data.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/tuod.engine.module.ts \
  app/tests/modules/game/tuod.engine.module.test.ts \
  app/src/lib/game/tuod-setup.data.ts \
  app/tests/lib/game/tuod-setup.data.test.ts \
  app/src/components/layout/games/setup/TuodSetupForm.astro
git commit -m "feat: wire a 1v1 opponent seat into TUOD (score-compare, highest target, ROUNDS-only)"
```

---

## Task 12: TUOD frontend — split scoreboard and highest-target banner

**Files:**
- Modify: `app/src/lib/game/tuod-play.data.ts`
- Modify: `app/src/components/layout/games/interfaces/TenUpOneDown.astro`
- Modify: `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro`
- Test: `app/tests/lib/game/tuod-play.data.test.ts` (extend or create)

- [ ] **Step 1: Add a `state()` accessor and per-seat variants to `tuod-play.data.ts`**

Add `TuodState` to the existing `import type { ... } from "@modules/types"` line, and add `winningSideKey: string | null` to `TuodResultsSnapshot` in `app/src/lib/game/types.ts` (find the type and add the field alongside its existing `target`/`attempts`/`successes`/`failures`).

Replace `currentTargetLabel` (lines 172-174):

```ts
    state(this: TuodPlayContext): TuodState | null {
      return this.engine?.state() ?? null;
    },

    currentTargetLabelFor(this: TuodPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find((candidate) => candidate.participantRef === seatRef);
      return seat ? String(seat.currentTarget) : "";
    },

    currentTargetLabel(this: TuodPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },
```

Replace `computeStats` (lines 88-102):

```ts
function computeStats(state: TuodState, ownerRef: string | null): TuodResultsSnapshot {
  const ownerSeat =
    state.seats.find((seat) => seat.participantRef === ownerRef) ?? state.seats[0];
  return {
    target: ownerSeat.currentTarget,
    attempts: ownerSeat.attempts,
    successes: ownerSeat.successes,
    failures: ownerSeat.failures,
    winningSideKey: state.winningSideKey,
  };
}
```

Replace the call site in `uploadAndCompleteSession` (lines 486-489):

```ts
      const finalState = this.state();
      const ownerRef =
        this.$store.game.seats.find((seat) => seat.participantTypeKey === "PLAYER")
          ?.participantRef ?? null;
      if (finalState) {
        this.resultsSnapshot = computeStats(finalState, ownerRef);
      }
```

- [ ] **Step 2: Write the failing test**

Add to `app/tests/lib/game/tuod-play.data.test.ts` (create it if it does not already exist for this module):

```ts
import { describe, it, expect } from "vitest";
import { tuodPlay } from "@lib/game/tuod-play.data";

describe("tuodPlay — per-seat accessors", () => {
  it("currentTargetLabelFor reads the named seat, not the active one", () => {
    const ctx = tuodPlay() as unknown as {
      engine: { state: () => { activeParticipantRef: string; seats: { participantRef: string; currentTarget: number }[] } };
      currentTargetLabelFor: (seatRef: string) => string;
    };
    ctx.engine = {
      state: () => ({
        activeParticipantRef: "p1",
        seats: [
          { participantRef: "p1", currentTarget: 41 },
          { participantRef: "p2", currentTarget: 51 },
        ],
      }),
    };
    expect(ctx.currentTargetLabelFor("p2")).toBe("51");
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`
Expected: FAIL before Step 1, PASS after.

- [ ] **Step 4: Branch `TenUpOneDown.astro` on seat count**

Replace the full contents of `app/src/components/layout/games/interfaces/TenUpOneDown.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

const { ...props }: Props = Astro.props;

import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={true}
      target="currentTargetLabel()"
      class="max-h-2/5 h-full"
    >
      <div
        slot="progress"
        class="mt-2 flex w-full flex-col items-center gap-2 px-4"
      >
        <dl class="w-full space-y-1">
          <StatRow
            label="Attempts"
            value="$store.game.turns.length"
          />
          <StatRow
            label="Successes"
            value="$store.game.turns.filter((t) => t.totalScore > 0).length"
          />
          <StatRow
            label="Failures"
            value="$store.game.turns.filter((t) => t.totalScore === 0).length"
          />
        </dl>
      </div>
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "currentTargetLabelFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "currentTargetLabelFor(state()?.seats[1]?.participantRef)",
      }}
      isTarget={true}
      class="h-2/5"
    >
      <dl
        slot="progressA"
        class="w-full space-y-1"
      >
        <StatRow
          label="Attempts"
          value="$store.game.turns.filter((t) => t.participantRef === state()?.seats[0]?.participantRef).length"
        />
        <StatRow
          label="Successes"
          value="$store.game.turns.filter((t) => t.participantRef === state()?.seats[0]?.participantRef && t.totalScore > 0).length"
        />
      </dl>
      <dl
        slot="progressB"
        class="w-full space-y-1"
      >
        <StatRow
          label="Attempts"
          value="$store.game.turns.filter((t) => t.participantRef === state()?.seats[1]?.participantRef).length"
        />
        <StatRow
          label="Successes"
          value="$store.game.turns.filter((t) => t.participantRef === state()?.seats[1]?.participantRef && t.totalScore > 0).length"
        />
      </dl>
    </SplitScoreboard>
  </template>

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showDoubleConfirm || showFinishConfirm || finished"
    padDisabled="showDoubleConfirm || showFinishConfirm || finished"
    undoClick="undoAttempt()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || showFinishConfirm || finished"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
    class="px-3"
  />
  {
    /* Visual board — shown instead of the keypad above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

The MINUTES countdown block (`x-show="$store.game.configSnapshot?.durationType === 'MINUTES'"`) is intentionally dropped from this rewrite's top-level markup — 1v1 never reaches MINUTES (Task 11 restricts it at setup), and a solo MINUTES session already renders the countdown inside `SinglePlayerDisplay`'s own branch above via the original markup's timer block; re-add that one `<div>` (unchanged from the original file, right after the `SinglePlayerDisplay` `</template>` close) if reviewing this diff shows it was otherwise lost:

```astro
  <div
    class="flex justify-center items-center gap-2 px-3"
    x-show="$store.game.configSnapshot?.durationType === 'MINUTES'"
    x-cloak
  >
    <p
      class="text-lg font-bold font-mono text-muted-foreground"
      x-text="remainingLabel()"
    >
    </p>
  </div>
```

- [ ] **Step 5: Show the highest-target winner in `TenUpOneDownResults.astro`**

In `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro`, replace the `<h2>` (lines 15-17):

```astro
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-text="
        !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? 'Game Summary'
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins — highest target!')
      "
    >
    </h2>
```

- [ ] **Step 6: Manual verification**

Start the dev server and play a full TUOD 1v1 session (ROUNDS mode, forced by Task 11) through to completion. Confirm: the split scoreboard shows both seats' own ladder target; both seats always get their full round budget even after one starts failing; the results modal names the highest-target winner. Confirm a solo session, including MINUTES mode, is unchanged.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/tuod-play.data.ts app/src/lib/game/types.ts \
  app/tests/lib/game/tuod-play.data.test.ts \
  app/src/components/layout/games/interfaces/TenUpOneDown.astro \
  app/src/components/layout/games/result-modals/TenUpOneDownResults.astro
git commit -m "feat: split scoreboard and highest-target banner for TUOD 1v1"
```

---

## Task 13: Shanghai engine — score-compare with an instant-win short circuit

**Files:**
- Modify: `app/src/modules/game/types.ts:44-49` (the `ShanghaiState` type)
- Modify: `app/src/modules/game/shanghai.engine.module.ts` (full rewrite)
- Test: `app/tests/modules/game/shanghai.engine.module.test.ts` (extend — existing cases move to `state.seats[0].*`)

**Interfaces:**
- Consumes: `raceWinner` **and** `scoreCompareWinner` from Task 1 (composed — a Shanghai short-circuits the match instantly via `raceWinner`; otherwise both seats finish and `scoreCompareWinner` decides), `activeSeat` from Task 2 (3-arg call — both seats always play the same 20 rounds unless the match ends early via a Shanghai, so no completion predicate is needed).
- Produces: `ShanghaiSeatState`, `ShanghaiState`.

- [ ] **Step 1: Update the type**

In `app/src/modules/game/types.ts`, replace lines 44-49 (the current `ShanghaiState` type):

```ts
export type ShanghaiSeatState = SeatState & {
  targetIndex: number;
  totalScore: number;
  dartsThisVisit: (DartZoneKey | null)[];
  status: "IN_PROGRESS" | "SHANGHAI" | "COMPLETE";
};

export type ShanghaiState = MultiSeatState<ShanghaiSeatState> & {
  status: "IN_PROGRESS" | "SHANGHAI" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
};
```

- [ ] **Step 2: Write the failing test**

Update every existing assertion in `app/tests/modules/game/shanghai.engine.module.test.ts` from `state.<field>` to `state.seats[0].<field>` for `targetIndex`/`totalScore`/`dartsThisVisit`/`status`. Add:

```ts
describe("ShanghaiEngine — 1v1", () => {
  const twoSeats = [
    { participantRef: "p1", displayName: "A", sideKey: "A", participantTypeKey: "PLAYER" as const },
    { participantRef: "p2", displayName: "B", sideKey: "B", participantTypeKey: "GUEST" as const },
  ];
  const twoSeatConfig: Seated<ShanghaiSnapshot> = { seats: twoSeats };

  function dart(number: number, zone: DartZoneKey): DartObservation {
    return { hitTargetNumber: number, hitZoneKey: zone, locationX: null, locationY: null };
  }

  it("ends the whole match the instant one seat hits a Shanghai, even mid-round for the other seat", () => {
    const engine = new ShanghaiEngine(twoSeatConfig);
    engine.record(dart(1, "SINGLE")); // p1 round 1 dart 1
    engine.record(dart(1, "MISS")); // p2 round 1 dart 1
    engine.record(dart(1, "DOUBLE")); // p1 round 1 dart 2
    engine.record(dart(1, "MISS")); // p2 round 1 dart 2
    const state = engine.record(dart(1, "TREBLE")); // p1 round 1 dart 3: single+double+treble on 1 = Shanghai
    expect(state.seats[0].status).toBe("SHANGHAI");
    expect(state.status).toBe("SHANGHAI");
    expect(state.winningSideKey).toBe("A");
  });

  it("resolves by total score once both seats finish all 20 rounds without a Shanghai", () => {
    const engine = new ShanghaiEngine(twoSeatConfig);
    // Every visit for both seats misses every dart at every round — both finish at score 0, a tie.
    for (let round = 0; round < 20; round++) {
      for (let dartNum = 0; dartNum < 3; dartNum++) engine.record(dart(round + 1, "MISS"));
      for (let dartNum = 0; dartNum < 3; dartNum++) engine.record(dart(round + 1, "MISS"));
    }
    const state = engine.state();
    expect(state.status).toBe("TIE");
    expect(state.winningSideKey).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/shanghai.engine.module.test.ts`
Expected: FAIL.

- [ ] **Step 4: Write the implementation**

Replace the full contents of `app/src/modules/game/shanghai.engine.module.ts`:

```ts
import type { ShanghaiSnapshot, Seated, SeatFact } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { boardScore, numbersPath, targetAt } from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { raceWinner, scoreCompareWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartFact,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  ShanghaiSeatState,
  ShanghaiState,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = { clientKey: "block-1", stageTypeKey: "EXERCISE_BLOCK", parentClientKey: null, sequence: 1 };
const LAST_TARGET_INDEX = 19;

function initialSeatState(seat: SeatFact): ShanghaiSeatState {
  return { participantRef: seat.participantRef, sideKey: seat.sideKey, targetIndex: 0, totalScore: 0, dartsThisVisit: [], status: "IN_PROGRESS" };
}

/** Shanghai starting state: every configured seat at round 1, zero score, no darts thrown. */
export function initialShanghaiState(config: Seated<ShanghaiSnapshot>): ShanghaiState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

const SINGLE_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set(["SINGLE", "INNER_SINGLE", "OUTER_SINGLE"]);

function zoneBucketOf(zone: DartZoneKey): "SINGLE" | "DOUBLE" | "TREBLE" | null {
  if (SINGLE_ZONE_KEYS.has(zone)) return "SINGLE";
  if (zone === "DOUBLE") return "DOUBLE";
  if (zone === "TREBLE") return "TREBLE";
  return null;
}

function activeNumberAt(targetIndex: number): number {
  const target = targetAt(numbersPath(), targetIndex);
  if (target.kind === "BULL") {
    throw new Error("Shanghai never reaches the BULL target");
  }
  return target.number;
}

function isShanghai(dartsThisVisit: readonly (DartZoneKey | null)[]): boolean {
  const buckets = new Set(
    dartsThisVisit.filter((zone): zone is DartZoneKey => zone !== null).map(zoneBucketOf),
  );
  return buckets.has("SINGLE") && buckets.has("DOUBLE") && buckets.has("TREBLE");
}

/**
 * Pure reducer: folds one dart observation onto one seat's `ShanghaiSeatState`.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyShanghaiDart(
  state: ShanghaiSeatState,
  observation: DartObservation,
): ShanghaiSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session has ended; undo first to correct it.",
    );
  }

  const targetNumber = activeNumberAt(state.targetIndex);
  const onTarget =
    observation.hitTargetNumber === targetNumber && zoneBucketOf(observation.hitZoneKey) !== null;
  const totalScore = onTarget
    ? state.totalScore + boardScore(targetNumber, observation.hitZoneKey)
    : state.totalScore;
  const dartsThisVisit = [...state.dartsThisVisit, onTarget ? observation.hitZoneKey : null];

  if (dartsThisVisit.length < 3) {
    return { ...state, totalScore, dartsThisVisit };
  }
  if (isShanghai(dartsThisVisit)) {
    return { ...state, totalScore, dartsThisVisit: [], status: "SHANGHAI" };
  }
  if (state.targetIndex === LAST_TARGET_INDEX) {
    return { ...state, totalScore, dartsThisVisit: [], status: "COMPLETE" };
  }
  return { ...state, totalScore, dartsThisVisit: [], targetIndex: state.targetIndex + 1 };
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldAroundTheClockState`. Composes `raceWinner` and `scoreCompareWinner`:
 * a Shanghai short-circuits the whole match the instant either seat hits
 * one, whatever the other seat's own round is — this is score-compare's own
 * race-shaped exception. Absent that, the match resolves only once both
 * seats reach `COMPLETE` (all 20 rounds, no Shanghai), by total score.
 */
export function foldShanghaiState(
  facts: EngineFacts,
  config: Seated<ShanghaiSnapshot>,
): ShanghaiState {
  const seats = config.seats.map((seat) => {
    let state = initialSeatState(seat);
    const seatTurns = facts.turns.filter((turn) => turn.participantRef === seat.participantRef);
    for (const turn of seatTurns) {
      for (const dart of turn.darts) {
        state = applyShanghaiDart(state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
      }
    }
    return state;
  });

  const raceResult = raceWinner(
    seats.map((seat) => ({ sideKey: seat.sideKey, finished: seat.status === "SHANGHAI" })),
  );
  const allTerminal = seats.every((seat) => seat.status !== "IN_PROGRESS");
  const compareResult =
    seats.length > 1 && allTerminal && raceResult === null
      ? scoreCompareWinner(
          seats.map((seat) => ({ sideKey: seat.sideKey, completed: true, metric: seat.totalScore })),
          "HIGHEST",
        )
      : null;

  const status: ShanghaiState["status"] =
    seats.length === 1
      ? seats[0].status
      : raceResult !== null
        ? "SHANGHAI"
        : !allTerminal
          ? "IN_PROGRESS"
          : compareResult !== null
            ? "COMPLETE"
            : "TIE";

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT").participantRef,
    status,
    winningSideKey: raceResult ?? compareResult,
    seats,
  };
}

/**
 * Shanghai: rounds 1..20, three darts each at that round's own number, per
 * seat. A single/double/treble Shanghai on any seat's visit ends the whole
 * match immediately — score-compare's own race-shaped exception. Otherwise
 * both seats always play all 20 rounds, then the higher total score wins.
 */
export class ShanghaiEngine implements GameEngine<DartObservation, ShanghaiState> {
  readonly rulesetVersionKey = "SHANGHAI_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<ShanghaiSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): ShanghaiState {
    return foldShanghaiState({ stages: [{ ...STAGE }], turns: this.turns }, this.config);
  }

  private openOrCreateTurn(activeParticipantRef: string): TurnFact {
    const last = this.turns.at(-1);
    if (last && last.darts.length < 3) return last;

    const turn: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      participantRef: activeParticipantRef,
      sequence: this.turns.length + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(turn);
    return turn;
  }

  record(observation: DartObservation): ShanghaiState {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the session has ended; undo first to correct it.",
      );
    }

    const openTurn = this.openOrCreateTurn(before.activeParticipantRef);
    const dart: DartFact = {
      sequence: openTurn.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: observation.locationX,
      locationY: observation.locationY,
    };

    openTurn.darts.push(dart);
    openTurn.totalScore = sumDartScores(openTurn.darts);
    if (openTurn.darts.length === 3) {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  undo(): boolean {
    const openTurn = this.turns.at(-1);
    if (!openTurn || openTurn.darts.length === 0) return false;

    openTurn.darts.pop();
    if (openTurn.darts.length === 0) {
      this.turns.pop();
    } else {
      openTurn.completedAt = null;
      openTurn.totalScore = sumDartScores(openTurn.darts);
    }
    return true;
  }

  /**
   * Answers whether recording `observation` would end the WHOLE session —
   * either this dart completes a Shanghai (which always ends the match, no
   * matter the other seat's own round), or it is the active seat's last
   * round and every other seat has already reached a terminal status.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;
    if (activeSeatState.dartsThisVisit.length < 2) return false;

    const after = applyShanghaiDart(activeSeatState, observation);
    if (after.status === "SHANGHAI") return true;
    if (after.status !== "COMPLETE") return false;

    return before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) => seat.status !== "IN_PROGRESS");
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): ShanghaiState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const shanghaiEngineFactory: GameEngineFactory<Seated<ShanghaiSnapshot>, DartObservation, ShanghaiState> = {
  rulesetVersionKey: "SHANGHAI_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<ShanghaiSnapshot>, prior?: EngineFacts) {
    return new ShanghaiEngine(config, prior);
  },
};

registerEngineFactory(shanghaiEngineFactory);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/shanghai.engine.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the game-engine structural gate**

Run: `cd app && bash scripts/check-game-engines.sh`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/shanghai.engine.module.ts app/tests/modules/game/shanghai.engine.module.test.ts
git commit -m "feat: wire a 1v1 opponent seat into Shanghai (score-compare + instant-Shanghai race)"
```

---

## Task 14: Shanghai frontend — split scoreboard and instant-Shanghai/score banner

**Files:**
- Modify: `app/src/lib/game/shanghai-play.data.ts`
- Modify: `app/src/components/layout/games/interfaces/Shanghai.astro`
- Modify: `app/src/components/layout/games/result-modals/ShanghaiResults.astro`
- Test: `app/tests/lib/game/shanghai-play.data.test.ts` (extend or create)

`play-lifecycle.ts` needs no change (same note as Task 10).

- [ ] **Step 1: Add a `state()` accessor and per-seat variants to `shanghai-play.data.ts`**

Add `ShanghaiState` to the existing `import type` line. Replace `currentTargetLabel`/`roundLabel`/`currentScore` (lines 108-121):

```ts
    state(this: ShanghaiPlayContext): ShanghaiState | null {
      return this.engine?.state() ?? null;
    },

    currentTargetLabelFor(this: ShanghaiPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find((candidate) => candidate.participantRef === seatRef);
      return seat ? String(targetNumberAt(seat.targetIndex)) : "";
    },

    currentTargetLabel(this: ShanghaiPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    roundLabelFor(this: ShanghaiPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find((candidate) => candidate.participantRef === seatRef);
      return seat ? `${seat.targetIndex + 1}/20` : "";
    },

    roundLabel(this: ShanghaiPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.roundLabelFor(state.activeParticipantRef);
    },

    currentScoreFor(this: ShanghaiPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find((candidate) => candidate.participantRef === seatRef);
      return seat ? String(seat.totalScore) : "";
    },

    currentScore(this: ShanghaiPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentScoreFor(state.activeParticipantRef);
    },
```

Replace `uploadAndCompleteSession` (lines 184-190):

```ts
    uploadAndCompleteSession(this: ShanghaiPlayContext): Promise<void> {
      const ownerRef =
        this.$store.game.seats.find((seat) => seat.participantTypeKey === "PLAYER")
          ?.participantRef ?? null;
      return playUploadAndCompleteSession(this, (finalState) => {
        const ownerSeat =
          finalState.seats.find((seat) => seat.participantRef === ownerRef) ?? finalState.seats[0];
        return {
          score: ownerSeat.totalScore,
          status: ownerSeat.status as "SHANGHAI" | "COMPLETE",
          round: ownerSeat.targetIndex + 1,
          winningSideKey: finalState.winningSideKey,
        };
      });
    },
```

Add `winningSideKey: string | null` to `ShanghaiPlayContext["resultsSnapshot"]`'s type in `app/src/lib/game/types.ts`.

- [ ] **Step 2: Write the failing test**

Add to `app/tests/lib/game/shanghai-play.data.test.ts` (create it if it does not already exist for this module):

```ts
import { describe, it, expect } from "vitest";
import { shanghaiPlay } from "@lib/game/shanghai-play.data";

describe("shanghaiPlay — per-seat accessors", () => {
  it("currentScoreFor and roundLabelFor read the named seat", () => {
    const ctx = shanghaiPlay() as unknown as {
      engine: { state: () => { activeParticipantRef: string; seats: { participantRef: string; targetIndex: number; totalScore: number }[] } };
      currentScoreFor: (seatRef: string) => string;
      roundLabelFor: (seatRef: string) => string;
    };
    ctx.engine = {
      state: () => ({
        activeParticipantRef: "p1",
        seats: [
          { participantRef: "p1", targetIndex: 0, totalScore: 10 },
          { participantRef: "p2", targetIndex: 4, totalScore: 40 },
        ],
      }),
    };
    expect(ctx.currentScoreFor("p2")).toBe("40");
    expect(ctx.roundLabelFor("p2")).toBe("5/20");
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `cd app && npx vitest run tests/lib/game/shanghai-play.data.test.ts`
Expected: FAIL before Step 1, PASS after.

- [ ] **Step 4: Branch `Shanghai.astro` on seat count**

Replace the full contents of `app/src/components/layout/games/interfaces/Shanghai.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

const { ...props }: Props = Astro.props;

import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import SinglesRecreationalInput from "@components/layout/games/SinglesRecreationalInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={false}
      score="currentScore()"
      class="min-h-2/5 max-h-2/5 h-full"
    >
      <div
        slot="progress"
        class="mt-2 flex w-full flex-col items-center gap-2 px-4"
      >
        <dl class="w-full space-y-1">
          <StatRow
            label="Round"
            value="roundLabel()"
          />
          <StatRow
            label="Target"
            value="currentTargetLabel()"
          />
        </dl>
      </div>
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "currentScoreFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "currentScoreFor(state()?.seats[1]?.participantRef)",
      }}
      isTarget={false}
      class="h-2/5"
    >
      <dl
        slot="progressA"
        class="w-full space-y-1"
      >
        <StatRow
          label="Round"
          value="roundLabelFor(state()?.seats[0]?.participantRef)"
        />
        <StatRow
          label="Target"
          value="currentTargetLabelFor(state()?.seats[0]?.participantRef)"
        />
      </dl>
      <dl
        slot="progressB"
        class="w-full space-y-1"
      >
        <StatRow
          label="Round"
          value="roundLabelFor(state()?.seats[1]?.participantRef)"
        />
        <StatRow
          label="Target"
          value="currentTargetLabelFor(state()?.seats[1]?.participantRef)"
        />
      </dl>
    </SplitScoreboard>
  </template>

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <VisitPreview />

  <SinglesRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

- [ ] **Step 5: Show the Shanghai/score winner in `ShanghaiResults.astro`**

In `app/src/components/layout/games/result-modals/ShanghaiResults.astro`, replace both `<h2>` blocks (lines 15-28):

```astro
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-text="
        !(completionStatus === 'succeeded' && resultsSnapshot)
          ? 'Session complete'
          : !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
            ? (resultsSnapshot?.status === 'SHANGHAI' ? 'Shanghai!' : 'Session complete')
            : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + (resultsSnapshot.status === 'SHANGHAI' ? ' hits a Shanghai!' : ' wins!'))
      "
    >
    </h2>
```

- [ ] **Step 6: Manual verification**

Start the dev server and play a full Shanghai 1v1 session twice: once ending in an instant Shanghai for one seat (confirm the match ends immediately, mid-round for the other seat), once playing all 20 rounds without one (confirm the higher-scoring seat is announced the winner, and a tie is possible and shown as such). Confirm a solo session is unchanged.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/shanghai-play.data.ts app/src/lib/game/types.ts \
  app/tests/lib/game/shanghai-play.data.test.ts \
  app/src/components/layout/games/interfaces/Shanghai.astro \
  app/src/components/layout/games/result-modals/ShanghaiResults.astro
git commit -m "feat: split scoreboard and instant-Shanghai/score banner for Shanghai 1v1"
```

---

## Task 15: Score Training engine and setup — score-compare, highest total, ROUNDS-only 1v1

**Files:**
- Modify: `app/src/modules/game/types.ts:10-13` (the `ScoreTrainingState` type)
- Modify: `app/src/modules/game/score-training.engine.module.ts` (full rewrite)
- Modify: `app/src/lib/game/score-training-setup.data.ts`
- Modify: `app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro` (hide MINUTES once a guest is added)
- Test: `app/tests/modules/game/score-training.engine.module.test.ts` (extend — existing cases move to `state.seats[0].*`)
- Test: `app/tests/lib/game/score-training-setup.data.test.ts` (extend or create)

**Interfaces:**
- Consumes: `scoreCompareWinner` from Task 1, `activeSeat` from Task 2 (3-arg call — every seat plays the same fixed ROUNDS in 1v1, same reasoning as Task 11's TUOD).
- Produces: `ScoreTrainingSeatState`, `ScoreTrainingState`.

This task mirrors Task 11 (TUOD) closely — same score-compare-with-fixed-round-budget shape, same ROUNDS-only 1v1 restriction, same per-engine guest-wiring need because `score-training-setup.data.ts` (like `tuod-setup.data.ts`) does not use `createPresetSetupController`.

- [ ] **Step 1: Update the type**

In `app/src/modules/game/types.ts`, replace lines 10-13 (the current `ScoreTrainingState` type):

```ts
export type ScoreTrainingSeatState = SeatState & {
  turnCount: number;
  totalScore: number;
};

export type ScoreTrainingState = MultiSeatState<ScoreTrainingSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
  timerExpired: boolean;
};
```

- [ ] **Step 2: Write the failing test**

Update every existing assertion in `app/tests/modules/game/score-training.engine.module.test.ts` from `state.<field>` to `state.seats[0].<field>` for `turnCount`; `totalScore` is a new per-seat field the old flat state never had (it only ever exposed `turnCount`/`timerExpired` — the running total lived only in `$store.game.turns`, per `score-training-play.data.ts`'s own `computeStats`). Add:

```ts
describe("ScoreTrainingEngine — 1v1", () => {
  const twoSeats = [
    { participantRef: "p1", displayName: "A", sideKey: "A", participantTypeKey: "PLAYER" as const },
    { participantRef: "p2", displayName: "B", sideKey: "B", participantTypeKey: "GUEST" as const },
  ];
  const twoSeatConfig: Seated<ScoreTrainingSnapshot> = {
    maxVisitScore: 180,
    durationType: "ROUNDS",
    durationValue: 2,
    seats: twoSeats,
  };

  it("both seats always play out their own full ROUNDS budget, higher total wins", () => {
    const engine = new ScoreTrainingEngine(twoSeatConfig);
    engine.record(20); // p1 round 1
    engine.record(60); // p2 round 1
    let state = engine.state();
    expect(state.status).toBe("IN_PROGRESS");
    engine.record(20); // p1 round 2 — total 40
    state = engine.state();
    expect(state.status).toBe("IN_PROGRESS"); // p2 still has a round left
    state = engine.record(60); // p2 round 2 — total 120
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("B");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/score-training.engine.module.test.ts`
Expected: FAIL.

- [ ] **Step 4: Write the implementation**

Replace the full contents of `app/src/modules/game/score-training.engine.module.ts`:

```ts
import type { ScoreTrainingSnapshot, Seated, SeatFact } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { classify } from "@lib/game/board/board-geometry.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { scoreCompareWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  EngineFacts,
  ScoreTrainingInput,
  ScoreTrainingSeatState,
  ScoreTrainingState,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = { clientKey: "block-1", stageTypeKey: "EXERCISE_BLOCK", parentClientKey: null, sequence: 1 };
const DARTS_PER_VISIT = 3;

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

function isDartObservation(input: ScoreTrainingInput): input is DartObservation {
  return typeof input !== "number";
}

function seatCompletesAt(config: ScoreTrainingSnapshot, turnCount: number, timerExpired: boolean): boolean {
  if (config.durationType === "ROUNDS") {
    return turnCount >= config.durationValue;
  }
  return timerExpired && turnCount >= 1;
}

/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldTuodState`. Score-compare, highest total wins: both seats always play
 * out their own full ROUNDS budget (1v1 offers ROUNDS only — see
 * `score-training-setup.data.ts`); `activeSeat` never needs a completion
 * predicate here for the same reason Task 11's TUOD fold does not.
 */
export function foldScoreTrainingState(
  facts: EngineFacts,
  config: Seated<ScoreTrainingSnapshot>,
  timerExpired: boolean,
): ScoreTrainingState {
  const seats: ScoreTrainingSeatState[] = config.seats.map((seat) => {
    const closed = facts.turns.filter(
      (turn) => turn.participantRef === seat.participantRef && turn.completedAt !== null,
    );
    return {
      participantRef: seat.participantRef,
      sideKey: seat.sideKey,
      turnCount: closed.length,
      totalScore: closed.reduce((sum, turn) => sum + turn.totalScore, 0),
    };
  });

  const completedSeats = seats.map((seat) => seatCompletesAt(config, seat.turnCount, timerExpired));
  const allComplete = completedSeats.every(Boolean);

  const winningSideKey =
    seats.length === 1
      ? null
      : scoreCompareWinner(
          seats.map((seat, index) => ({ sideKey: seat.sideKey, completed: completedSeats[index], metric: seat.totalScore })),
          "HIGHEST",
        );

  const status: ScoreTrainingState["status"] =
    seats.length === 1
      ? "IN_PROGRESS"
      : !allComplete
        ? "IN_PROGRESS"
        : winningSideKey !== null
          ? "COMPLETE"
          : "TIE";

  return {
    activeParticipantRef: activeSeat(
      facts,
      config.seats,
      "PER_SEAT",
      (candidate) => {
        const index = seats.findIndex((seat) => seat.participantRef === candidate.participantRef);
        return index === -1 ? false : completedSeats[index];
      },
    ).participantRef,
    status,
    winningSideKey,
    timerExpired,
    seats,
  };
}

/**
 * Score Training: every visit is one turn, per seat, under a single exercise
 * block, played for a ROUNDS duration in 1v1 (MINUTES stays solo-only, same
 * reasoning as TUOD). Score-compare: both seats always play their own full
 * round budget, then whichever totalled the higher score wins.
 */
export class ScoreTrainingEngine implements GameEngine<ScoreTrainingInput, ScoreTrainingState> {
  readonly rulesetVersionKey = "SCORE_TRAINING_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];
  private timerExpired = false;

  constructor(
    private readonly config: Seated<ScoreTrainingSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private isPlayable(visitScore: number): boolean {
    return Number.isInteger(visitScore) && visitScore >= 0 && visitScore <= this.config.maxVisitScore;
  }

  private deriveState(): ScoreTrainingState {
    return foldScoreTrainingState({ stages: [STAGE], turns: this.turns }, this.config, this.timerExpired);
  }

  expireTimer(): void {
    this.timerExpired = true;
  }

  record(input: ScoreTrainingInput): ScoreTrainingState {
    if (isDartObservation(input)) {
      return this.recordDart(input);
    }
    return this.recordVisitTotal(input);
  }

  private recordVisitTotal(visitScore: number): ScoreTrainingState {
    if (this.openTurn() !== null) {
      throw new Error("Finish the open visit on the board before entering a keypad total.");
    }
    if (!this.isPlayable(visitScore)) {
      throw new Error(`Enter a score between 0 and ${this.config.maxVisitScore}.`);
    }

    const activeParticipantRef = this.deriveState().activeParticipantRef;
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      participantRef: activeParticipantRef,
      sequence: this.turns.length + 1,
      completedAt: new Date().toISOString(),
      totalScore: visitScore,
      darts: [],
    });
    return this.deriveState();
  }

  private openTurn(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.completedAt !== null) return null;
    return last;
  }

  private recordDart(observation: DartObservation): ScoreTrainingState {
    const resolved =
      observation.locationX === null || observation.locationY === null
        ? { targetNumber: null, zoneKey: observation.hitZoneKey, score: 0 }
        : classify(observation.locationX, observation.locationY);

    let turn = this.openTurn();
    if (!turn) {
      const activeParticipantRef = this.deriveState().activeParticipantRef;
      turn = {
        clientKey: newClientKey(),
        stageClientKey: STAGE.clientKey,
        participantRef: activeParticipantRef,
        sequence: this.turns.length + 1,
        completedAt: null,
        totalScore: 0,
        darts: [],
      };
      this.turns.push(turn);
    }

    turn.darts.push({
      sequence: turn.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: resolved.targetNumber,
      hitZoneKey: resolved.zoneKey,
      score: resolved.score,
      locationX: observation.locationX,
      locationY: observation.locationY,
    });

    turn.totalScore = turn.darts.reduce((sum, dart) => sum + dart.score, 0);
    if (turn.darts.length === DARTS_PER_VISIT) {
      turn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  undo(): boolean {
    const turn = this.turns.at(-1);
    if (!turn) return false;

    if (turn.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    turn.darts.pop();
    if (turn.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    turn.totalScore = turn.darts.reduce((sum, dart) => sum + dart.score, 0);
    turn.completedAt = null;
    return true;
  }

  /**
   * Answers whether recording `input` would end the WHOLE session — the
   * active seat's last round, and every other seat already at a terminal
   * status. Mirrors Task 11's `TuodEngine.wouldComplete`.
   */
  wouldComplete(input: ScoreTrainingInput): boolean {
    const before = this.deriveState();
    const activeSeatState = before.seats.find((seat) => seat.participantRef === before.activeParticipantRef)!;

    if (isDartObservation(input)) {
      const turn = this.openTurn();
      if (!turn || turn.darts.length !== DARTS_PER_VISIT - 1) return false;
    } else {
      if (!this.isPlayable(input) || this.openTurn() !== null) return false;
    }

    const otherSeatsComplete = before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) => seatCompletesAt(this.config, seat.turnCount, this.timerExpired));
    return (
      seatCompletesAt(this.config, activeSeatState.turnCount + 1, this.timerExpired) && otherSeatsComplete
    );
  }

  isComplete(): boolean {
    const state = this.deriveState();
    if (state.seats.length === 1) {
      return seatCompletesAt(this.config, state.seats[0].turnCount, this.timerExpired);
    }
    return state.status !== "IN_PROGRESS";
  }

  state(): ScoreTrainingState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const scoreTrainingEngineFactory: GameEngineFactory<Seated<ScoreTrainingSnapshot>, ScoreTrainingInput, ScoreTrainingState> = {
  rulesetVersionKey: "SCORE_TRAINING_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<ScoreTrainingSnapshot>, prior?: EngineFacts) {
    return new ScoreTrainingEngine(config, prior);
  },
};

registerEngineFactory(scoreTrainingEngineFactory);
```

(The same solo `isComplete()` fix Task 11 needed for TUOD is written directly into `isComplete()` above, not left as a follow-up step.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/score-training.engine.module.test.ts`
Expected: PASS, including every pre-existing solo case.

- [ ] **Step 6: Run the game-engine structural gate**

Run: `cd app && bash scripts/check-game-engines.sh`
Expected: PASS.

- [ ] **Step 7: Restrict 1v1 Score Training setup to ROUNDS and wire the guest into `start()`**

In `app/src/lib/game/score-training-setup.data.ts`, add `guests: [] as { displayName: string }[], showAddGuestModal: false, newGuestName: "",` to the returned object literal, `addGuest`/`removeGuest` methods identical to Task 4's Step 1, and a `forceRoundsIfGuested` method identical to Task 11's Step 7 — call it inside `addGuest`, and additionally from the existing `$watch("durationType", ...)` handler in `init()` is unnecessary here since `addGuest` is the only path that can introduce a guest after `durationType` was already set to `MINUTES`. Thread `participants` into `start()`'s `createSession` call exactly as Task 4's Step 1 does.

In `app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro`, wrap the `Toggle` (and the `Input`/`label`/`clampNotice` block below it, since a hidden Toggle with a visible custom `durationValue` input for MINUTES would leave the input meaningless) the same way Task 11's Step 7 does for `TuodSetupForm.astro` — replace the whole `<Toggle .../>` through the `clampNotice` paragraph with:

```astro
    <template x-if="guests.length === 0">
      <Fragment>
        <Toggle
          orientation="horizontal"
          options={formatOpts}
          x-model="durationType"
          class="w-full"
        />
        <Input
          id="durationValue"
          name="durationValue"
          type="text"
          inputmode="numeric"
          :placeholder="durationType === 'ROUNDS' ? 'Number of rounds' : 'Number of minutes'"
          x-model.number="durationValue"
          @input="clampNotice = ''"
          class="glass border-tab-border rounded-full mt-4"
        />
        <label
          for="durationValue"
          class="text-xs text-muted-foreground px-4 py-0 italic"
          x-text="durationType === 'ROUNDS' ? 'Rounds' : 'Minutes'"
        ></label>
        <p
          class="text-sm text-muted-foreground px-4 py-0"
          role="status"
          x-show="clampNotice"
          x-text="clampNotice"
          x-cloak
        >
        </p>
      </Fragment>
    </template>
    <template x-if="guests.length > 0">
      <Input
        id="durationValue"
        name="durationValue"
        type="text"
        inputmode="numeric"
        placeholder="Number of rounds"
        x-model.number="durationValue"
        @input="clampNotice = ''"
        class="glass border-tab-border rounded-full mt-4"
      />
    </template>
```

- [ ] **Step 8: Write the setup test**

Add to `app/tests/lib/game/score-training-setup.data.test.ts` (create it if it does not already exist for this module):

```ts
import { describe, it, expect } from "vitest";
import { scoreTrainingSetup } from "@lib/game/score-training-setup.data";

describe("scoreTrainingSetup — 1v1 forces ROUNDS", () => {
  it("forceRoundsIfGuested resets MINUTES back to ROUNDS once a guest is added", () => {
    const ctx = scoreTrainingSetup() as unknown as {
      durationType: string;
      guests: { displayName: string }[];
      newGuestName: string;
      addGuest: () => void;
    };
    ctx.durationType = "MINUTES";
    ctx.newGuestName = "Guest 1";
    ctx.addGuest();
    expect(ctx.durationType).toBe("ROUNDS");
  });
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/score-training-setup.data.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/score-training.engine.module.ts \
  app/tests/modules/game/score-training.engine.module.test.ts \
  app/src/lib/game/score-training-setup.data.ts \
  app/tests/lib/game/score-training-setup.data.test.ts \
  app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro
git commit -m "feat: wire a 1v1 opponent seat into Score Training (score-compare, highest total, ROUNDS-only)"
```

---

## Task 16: Score Training frontend — split scoreboard and highest-total banner

**Files:**
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Modify: `app/src/components/layout/games/interfaces/ScoreTraining.astro`
- Modify: `app/src/components/layout/games/result-modals/ScoreTrainingResults.astro`
- Test: `app/tests/lib/game/score-training-play.data.test.ts` (extend or create)

- [ ] **Step 1: Add a `state()` accessor and per-seat variants to `score-training-play.data.ts`**

Add `ScoreTrainingState` to the existing `import type { DartObservation, EngineFacts, TurnFact }` line. Add, alongside `threeDartAverage`/`dartsThrownThisLeg`/`previousScoreThisLeg`:

```ts
    state(this: ScoreTrainingPlayContext): ScoreTrainingState | null {
      return this.engine?.state() ?? null;
    },

    totalScoreFor(this: ScoreTrainingPlayContext, seatRef: string): number {
      const seat = this.state()?.seats.find((candidate) => candidate.participantRef === seatRef);
      return seat?.totalScore ?? 0;
    },

    threeDartAverageFor(this: ScoreTrainingPlayContext, seatRef: string): string {
      return perVisitAverageDisplay(
        this.$store.game.turns.filter((turn) => turn.participantRef === seatRef),
      );
    },

    dartsThrownThisLegFor(this: ScoreTrainingPlayContext, seatRef: string): number {
      const maxDartsPerTurn = this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return dartsThrownCount(
        this.$store.game.turns.filter((turn) => turn.participantRef === seatRef),
        maxDartsPerTurn,
      );
    },

    previousScoreThisLegFor(this: ScoreTrainingPlayContext, seatRef: string): string {
      return previousScoreDisplay(
        this.$store.game.turns.filter((turn) => turn.participantRef === seatRef),
      );
    },
```

Replace `computeStats` (lines 42-50) and its call site in `uploadAndCompleteSession` (line 431):

```ts
function computeStats(
  state: ScoreTrainingState,
  ownerRef: string | null,
): { total: number; visits: number; average: number; winningSideKey: string | null } {
  const ownerSeat = state.seats.find((seat) => seat.participantRef === ownerRef) ?? state.seats[0];
  return {
    total: ownerSeat.totalScore,
    visits: ownerSeat.turnCount,
    average: ownerSeat.turnCount === 0 ? 0 : ownerSeat.totalScore / ownerSeat.turnCount,
    winningSideKey: state.winningSideKey,
  };
}
```

```ts
      const finalState = this.state();
      const ownerRef =
        this.$store.game.seats.find((seat) => seat.participantTypeKey === "PLAYER")
          ?.participantRef ?? null;
      if (finalState) {
        this.resultsSnapshot = computeStats(finalState, ownerRef);
      }
```

Add `winningSideKey: string | null` to the `resultsSnapshot` type literal (lines 162-166).

- [ ] **Step 2: Write the failing test**

Add to `app/tests/lib/game/score-training-play.data.test.ts` (create it if it does not already exist for this module):

```ts
import { describe, it, expect } from "vitest";
import { scoreTrainingPlay } from "@lib/game/score-training-play.data";

describe("scoreTrainingPlay — per-seat accessors", () => {
  it("totalScoreFor reads the named seat", () => {
    const ctx = scoreTrainingPlay() as unknown as {
      engine: { state: () => { activeParticipantRef: string; seats: { participantRef: string; totalScore: number }[] } };
      totalScoreFor: (seatRef: string) => number;
    };
    ctx.engine = {
      state: () => ({
        activeParticipantRef: "p1",
        seats: [
          { participantRef: "p1", totalScore: 40 },
          { participantRef: "p2", totalScore: 120 },
        ],
      }),
    };
    expect(ctx.totalScoreFor("p2")).toBe(120);
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts`
Expected: FAIL before Step 1, PASS after.

- [ ] **Step 4: Branch `ScoreTraining.astro` on seat count**

Replace the full contents of `app/src/components/layout/games/interfaces/ScoreTraining.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

const { ...props }: Props = Astro.props;

import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={false}
      score="$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0)"
      class="max-h-2/5 h-full"
    >
      <div
        slot="progress"
        class="mt-2 flex w-full flex-col items-center gap-2 px-4"
      >
        <dl class="w-full space-y-1">
          <StatRow
            label="3 dart avg."
            value="threeDartAverage()"
          />
          <StatRow
            label="Darts"
            value="dartsThrownThisLeg()"
          />
          <StatRow
            label="Previous"
            value="previousScoreThisLeg()"
          />
        </dl>
      </div>
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "totalScoreFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "totalScoreFor(state()?.seats[1]?.participantRef)",
      }}
      isTarget={false}
      class="h-2/5"
    >
      <dl
        slot="progressA"
        class="w-full space-y-1"
      >
        <StatRow
          label="3 dart avg."
          value="threeDartAverageFor(state()?.seats[0]?.participantRef)"
        />
        <StatRow
          label="Darts"
          value="dartsThrownThisLegFor(state()?.seats[0]?.participantRef)"
        />
      </dl>
      <dl
        slot="progressB"
        class="w-full space-y-1"
      >
        <StatRow
          label="3 dart avg."
          value="threeDartAverageFor(state()?.seats[1]?.participantRef)"
        />
        <StatRow
          label="Darts"
          value="dartsThrownThisLegFor(state()?.seats[1]?.participantRef)"
        />
      </dl>
    </SplitScoreboard>
  </template>
  <div
    class="flex justify-center items-center gap-2 px-3"
    x-show="$store.game.configSnapshot?.durationType === 'MINUTES'"
    x-cloak
  >
    <p
      class="text-lg font-bold font-mono text-muted-foreground"
      x-text="`${remainingLabel()}`"
    >
    </p>
  </div>
  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>
  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showFinishConfirm || finished"
    padDisabled="showFinishConfirm || finished"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showFinishConfirm || finished"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />

  {
    /* Visual board — shown instead of the keypad above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

- [ ] **Step 5: Show the highest-total winner in `ScoreTrainingResults.astro`**

In `app/src/components/layout/games/result-modals/ScoreTrainingResults.astro`, replace the `<h2>` (lines 15-17):

```astro
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-text="
        !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? 'Game Summary'
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins — highest total!')
      "
    >
    </h2>
```

- [ ] **Step 6: Manual verification**

Start the dev server and play a full Score Training 1v1 session (ROUNDS mode, forced by Task 15) through to completion. Confirm: the split scoreboard shows both seats' own running total; both seats always get their full round budget; the results modal names the higher-total winner. Confirm a solo session, including MINUTES mode, is unchanged.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/score-training-play.data.ts \
  app/tests/lib/game/score-training-play.data.test.ts \
  app/src/components/layout/games/interfaces/ScoreTraining.astro \
  app/src/components/layout/games/result-modals/ScoreTrainingResults.astro
git commit -m "feat: split scoreboard and highest-total banner for Score Training 1v1"
```

---

## Task 17: Singles Training engine — score-compare, highest points

**Files:**
- Modify: `app/src/modules/game/types.ts:31-36` (the `SinglesTrainingState` type)
- Modify: `app/src/modules/game/singles-training.engine.module.ts` (full rewrite)
- Test: `app/tests/modules/game/singles-training.engine.module.test.ts` (extend — existing cases move to `state.seats[0].*`)

**Interfaces:**
- Consumes: `scoreCompareWinner` from Task 1, `activeSeat` from Task 2 (3-arg call — Singles Training's 21-target path is fixed-order and every visit is exactly 3 darts regardless of hit/miss, so both seats always take the same number of visits; no completion predicate needed, unlike Around the Clock).
- Produces: `SinglesTrainingSeatState`, `SinglesTrainingState`.

- [ ] **Step 1: Update the type**

In `app/src/modules/game/types.ts`, replace lines 31-36 (the current `SinglesTrainingState` type):

```ts
export type SinglesTrainingSeatState = SeatState & {
  targetIndex: number;
  totalPoints: number;
  dartsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

export type SinglesTrainingState = MultiSeatState<SinglesTrainingSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
};
```

- [ ] **Step 2: Write the failing test**

Update every existing assertion in `app/tests/modules/game/singles-training.engine.module.test.ts` from `state.<field>` to `state.seats[0].<field>` for `targetIndex`/`totalPoints`/`dartsThisVisit`/`status`. Add:

```ts
describe("SinglesTrainingEngine — 1v1", () => {
  const twoSeats = [
    { participantRef: "p1", displayName: "A", sideKey: "A", participantTypeKey: "PLAYER" as const },
    { participantRef: "p2", displayName: "B", sideKey: "B", participantTypeKey: "GUEST" as const },
  ];
  const twoSeatConfig: Seated<SinglesSnapshot> = {
    pointsSingle: 1,
    pointsDouble: 2,
    pointsTreble: 3,
    targetOrder: Array.from({ length: 20 }, (_, i) => i + 1),
    seats: twoSeats,
  };

  function dart(number: number, zone: DartZoneKey): DartObservation {
    return { hitTargetNumber: number, hitZoneKey: zone, locationX: null, locationY: null };
  }

  it("both seats play all 21 targets, higher training-point total wins", () => {
    const engine = new SinglesTrainingEngine(twoSeatConfig);
    for (let round = 0; round < 21; round++) {
      const number = round < 20 ? round + 1 : 25;
      for (let d = 0; d < 3; d++) engine.record(dart(number, "TREBLE")); // p1: max points every visit
      for (let d = 0; d < 3; d++) engine.record(dart(number, "MISS")); // p2: zero every visit
    }
    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("A");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: FAIL.

- [ ] **Step 4: Write the implementation**

Replace the full contents of `app/src/modules/game/singles-training.engine.module.ts`:

```ts
import type { SinglesSnapshot, Seated, SeatFact } from "@lib/types";
import { newClientKey } from "./client-key.module";
import {
  BULL_TARGET_NUMBER,
  boardScore,
  numbersPath,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { scoreCompareWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  BoardTarget,
  DartFact,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  SinglesTrainingSeatState,
  SinglesTrainingState,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = { clientKey: "block-1", stageTypeKey: "EXERCISE_BLOCK", parentClientKey: null, sequence: 1 };

function initialSeatState(seat: SeatFact): SinglesTrainingSeatState {
  return { participantRef: seat.participantRef, sideKey: seat.sideKey, targetIndex: 0, totalPoints: 0, dartsThisVisit: 0, status: "IN_PROGRESS" };
}

/** Singles Training starting state: every configured seat aimed at NUMBER 1, no darts thrown. */
export function initialSinglesTrainingState(config: Seated<SinglesSnapshot>): SinglesTrainingState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

const SINGLE_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set(["SINGLE", "INNER_SINGLE", "OUTER_SINGLE"]);

function trainingPointsFor(target: BoardTarget, config: SinglesSnapshot, observation: DartObservation): number {
  if (target.kind === "BULL") {
    if (observation.hitTargetNumber !== BULL_TARGET_NUMBER) return 0;
    if (observation.hitZoneKey === "OUTER_BULL") return config.pointsSingle;
    if (observation.hitZoneKey === "INNER_BULL") return config.pointsDouble;
    return 0;
  }
  if (observation.hitTargetNumber !== target.number) return 0;
  if (SINGLE_ZONE_KEYS.has(observation.hitZoneKey)) return config.pointsSingle;
  if (observation.hitZoneKey === "DOUBLE") return config.pointsDouble;
  if (observation.hitZoneKey === "TREBLE") return config.pointsTreble;
  return 0;
}

/**
 * Pure reducer: folds one dart observation onto one seat's
 * `SinglesTrainingSeatState`.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applySinglesTrainingDart(
  config: SinglesSnapshot,
  state: SinglesTrainingSeatState,
  observation: DartObservation,
): SinglesTrainingSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session is complete; undo first to correct it.",
    );
  }

  const target = targetAt(numbersPath(config.targetOrder), state.targetIndex);
  const totalPoints = state.totalPoints + trainingPointsFor(target, config, observation);
  const dartsThisVisit = state.dartsThisVisit + 1;

  if (dartsThisVisit < 3) {
    return { ...state, totalPoints, dartsThisVisit };
  }
  if (state.targetIndex === 20) {
    return { ...state, totalPoints, dartsThisVisit: 0, status: "COMPLETE" };
  }
  return { ...state, totalPoints, dartsThisVisit: 0, targetIndex: state.targetIndex + 1 };
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldAroundTheClockState`. Score-compare, highest training-point total
 * wins: unlike Around the Clock, every visit here is exactly 3 darts
 * regardless of hit or miss, so both seats always take the same number of
 * visits and `activeSeat` needs no completion predicate.
 */
export function foldSinglesTrainingState(
  facts: EngineFacts,
  config: Seated<SinglesSnapshot>,
): SinglesTrainingState {
  const seats = config.seats.map((seat) => {
    let state = initialSeatState(seat);
    const seatTurns = facts.turns.filter((turn) => turn.participantRef === seat.participantRef);
    for (const turn of seatTurns) {
      for (const dart of turn.darts) {
        state = applySinglesTrainingDart(config, state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
      }
    }
    return state;
  });

  const winningSideKey =
    seats.length === 1
      ? null
      : scoreCompareWinner(
          seats.map((seat) => ({ sideKey: seat.sideKey, completed: seat.status === "COMPLETE", metric: seat.totalPoints })),
          "HIGHEST",
        );

  const allComplete = seats.every((seat) => seat.status === "COMPLETE");
  const status: SinglesTrainingState["status"] =
    seats.length === 1
      ? seats[0].status
      : !allComplete
        ? "IN_PROGRESS"
        : winningSideKey !== null
          ? "COMPLETE"
          : "TIE";

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT").participantRef,
    status,
    winningSideKey,
    seats,
  };
}

/**
 * Singles Training: a fixed path of 21 targets (1..20, then BULL), each
 * visit scored by ring quality relative to its own target, per seat.
 * Score-compare: both seats always play the fixed number of visits, then
 * whichever totalled the higher training-point score wins.
 */
export class SinglesTrainingEngine implements GameEngine<DartObservation, SinglesTrainingState> {
  readonly rulesetVersionKey = "SINGLES_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<SinglesSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): SinglesTrainingState {
    return foldSinglesTrainingState({ stages: [{ ...STAGE }], turns: this.turns }, this.config);
  }

  private openOrCreateTurn(activeParticipantRef: string): TurnFact {
    const last = this.turns.at(-1);
    if (last && last.darts.length < 3) return last;

    const turn: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      participantRef: activeParticipantRef,
      sequence: this.turns.length + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(turn);
    return turn;
  }

  record(observation: DartObservation): SinglesTrainingState {
    const before = this.deriveState();
    const activeSeatState = before.seats.find((seat) => seat.participantRef === before.activeParticipantRef)!;
    if (activeSeatState.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the session is complete; undo first to correct it.",
      );
    }

    const openTurn = this.openOrCreateTurn(before.activeParticipantRef);
    const dart: DartFact = {
      sequence: openTurn.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: observation.locationX,
      locationY: observation.locationY,
    };

    openTurn.darts.push(dart);
    openTurn.totalScore = sumDartScores(openTurn.darts);
    if (openTurn.darts.length === 3) {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  undo(): boolean {
    const openTurn = this.turns.at(-1);
    if (!openTurn || openTurn.darts.length === 0) return false;

    openTurn.darts.pop();
    if (openTurn.darts.length === 0) {
      this.turns.pop();
    } else {
      openTurn.completedAt = null;
      openTurn.totalScore = sumDartScores(openTurn.darts);
    }
    return true;
  }

  /**
   * Answers whether recording `observation` would end the WHOLE session —
   * this dart is the active seat's 21st target's 3rd dart, and every other
   * seat has already reached COMPLETE.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    const activeSeatState = before.seats.find((seat) => seat.participantRef === before.activeParticipantRef)!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;
    if (activeSeatState.dartsThisVisit < 2) return false;

    const after = applySinglesTrainingDart(this.config, activeSeatState, observation);
    if (after.status !== "COMPLETE") return false;

    return before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) => seat.status === "COMPLETE");
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): SinglesTrainingState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const singlesTrainingEngineFactory: GameEngineFactory<Seated<SinglesSnapshot>, DartObservation, SinglesTrainingState> = {
  rulesetVersionKey: "SINGLES_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<SinglesSnapshot>, prior?: EngineFacts) {
    return new SinglesTrainingEngine(config, prior);
  },
};

registerEngineFactory(singlesTrainingEngineFactory);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the game-engine structural gate**

Run: `cd app && bash scripts/check-game-engines.sh`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/singles-training.engine.module.ts app/tests/modules/game/singles-training.engine.module.test.ts
git commit -m "feat: wire a 1v1 opponent seat into Singles Training (score-compare, highest points)"
```

---

## Task 18: Singles Training frontend — split scoreboard and highest-points banner

**Files:**
- Modify: `app/src/lib/game/singles-training-play.data.ts`
- Modify: `app/src/components/layout/games/interfaces/SinglesTraining.astro`
- Modify: `app/src/components/layout/games/result-modals/SinglesTrainingResults.astro`
- Test: `app/tests/lib/game/singles-training-play.data.test.ts` (extend or create)

`play-lifecycle.ts` needs no change (same note as Task 10).

- [ ] **Step 1: Add a `state()` accessor and per-seat variants to `singles-training-play.data.ts`**

Add `SinglesTrainingState` to the existing `import type` line. Replace `currentTargetLabel`/`currentPoints`/`isBullVisit`/`missCount`/`singleCount`/`doubleCount`/`trebleCount` (lines 169-224):

```ts
    state(this: SinglesTrainingPlayContext): SinglesTrainingState | null {
      return this.engine?.state() ?? null;
    },

    currentTargetLabelFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      const config = this.$store.game.configSnapshot;
      const seat = this.state()?.seats.find((candidate) => candidate.participantRef === seatRef);
      if (!config || !seat) return "";
      const target = targetAt(numbersPath(config.targetOrder), seat.targetIndex);
      return target.kind === "BULL" ? "BULL" : String(target.number);
    },

    currentTargetLabel(this: SinglesTrainingPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    currentPointsFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find((candidate) => candidate.participantRef === seatRef);
      return seat ? String(seat.totalPoints) : "";
    },

    currentPoints(this: SinglesTrainingPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentPointsFor(state.activeParticipantRef);
    },

    isBullVisit(this: SinglesTrainingPlayContext): boolean {
      const config = this.$store.game.configSnapshot;
      const state = this.state();
      const seat = state?.seats.find((candidate) => candidate.participantRef === state.activeParticipantRef);
      if (!config || !seat) return false;
      return targetAt(numbersPath(config.targetOrder), seat.targetIndex).kind === "BULL";
    },

    missCountFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      return String(countZoneKey(this.$store.game.turns.filter((t) => t.participantRef === seatRef), MISS_COUNT_ZONE_KEYS));
    },
    missCount(this: SinglesTrainingPlayContext): string {
      return String(countZoneKey(this.$store.game.turns, MISS_COUNT_ZONE_KEYS));
    },

    singleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      return String(countZoneKey(this.$store.game.turns.filter((t) => t.participantRef === seatRef), SINGLE_COUNT_ZONE_KEYS));
    },
    singleCount(this: SinglesTrainingPlayContext): string {
      return String(countZoneKey(this.$store.game.turns, SINGLE_COUNT_ZONE_KEYS));
    },

    doubleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      return String(countZoneKey(this.$store.game.turns.filter((t) => t.participantRef === seatRef), DOUBLE_COUNT_ZONE_KEYS));
    },
    doubleCount(this: SinglesTrainingPlayContext): string {
      return String(countZoneKey(this.$store.game.turns, DOUBLE_COUNT_ZONE_KEYS));
    },

    trebleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      return String(countZoneKey(this.$store.game.turns.filter((t) => t.participantRef === seatRef), TREBLE_COUNT_ZONE_KEYS));
    },
    trebleCount(this: SinglesTrainingPlayContext): string {
      return String(countZoneKey(this.$store.game.turns, TREBLE_COUNT_ZONE_KEYS));
    },
```

Replace `uploadAndCompleteSession` (lines 293-312) to scope stats to the owner and add `winningSideKey`:

```ts
    uploadAndCompleteSession(this: SinglesTrainingPlayContext): Promise<void> {
      const ownerRef =
        this.$store.game.seats.find((seat) => seat.participantTypeKey === "PLAYER")
          ?.participantRef ?? null;
      return playUploadAndCompleteSession(this, (finalState) => {
        const ownerSeat =
          finalState.seats.find((seat) => seat.participantRef === ownerRef) ?? finalState.seats[0];
        const turns = this.$store.game.turns.filter((t) => t.participantRef === ownerSeat.participantRef);
        const misses = countZoneKey(turns, MISS_COUNT_ZONE_KEYS);
        const singles = countZoneKey(turns, SINGLE_COUNT_ZONE_KEYS);
        const doubles = countZoneKey(turns, DOUBLE_COUNT_ZONE_KEYS);
        const trebles = countZoneKey(turns, TREBLE_COUNT_ZONE_KEYS);
        const hits = singles + doubles + trebles;
        const darts = hits + misses;
        return {
          points: ownerSeat.totalPoints,
          misses,
          singles,
          doubles,
          trebles,
          hitPercentage: darts === 0 ? "0%" : `${Math.round((hits / darts) * 100)}%`,
          winningSideKey: finalState.winningSideKey,
        };
      });
    },
```

Add `winningSideKey: string | null` to `SinglesTrainingPlayContext["resultsSnapshot"]`'s type in `app/src/lib/game/types.ts`.

- [ ] **Step 2: Write the failing test**

Add to `app/tests/lib/game/singles-training-play.data.test.ts` (create it if it does not already exist for this module):

```ts
import { describe, it, expect } from "vitest";
import { singlesTrainingPlay } from "@lib/game/singles-training-play.data";

describe("singlesTrainingPlay — per-seat accessors", () => {
  it("currentPointsFor reads the named seat", () => {
    const ctx = singlesTrainingPlay() as unknown as {
      engine: { state: () => { activeParticipantRef: string; seats: { participantRef: string; totalPoints: number }[] } };
      currentPointsFor: (seatRef: string) => string;
    };
    ctx.engine = {
      state: () => ({
        activeParticipantRef: "p1",
        seats: [
          { participantRef: "p1", totalPoints: 5 },
          { participantRef: "p2", totalPoints: 30 },
        ],
      }),
    };
    expect(ctx.currentPointsFor("p2")).toBe("30");
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: FAIL before Step 1, PASS after.

- [ ] **Step 4: Branch `SinglesTraining.astro` on seat count**

Replace the full contents of `app/src/components/layout/games/interfaces/SinglesTraining.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

const { ...props }: Props = Astro.props;

import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import SinglesRecreationalInput from "@components/layout/games/SinglesRecreationalInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={false}
      score="currentPoints()"
      class="min-h-2/5 max-h-2/5 h-full"
    >
      <div
        slot="progress"
        class="mt-2 flex w-full flex-col items-center gap-2 px-4"
      >
        <dl class="w-full space-y-1">
          <StatRow
            label="Target"
            value="currentTargetLabel()"
          />
          <StatRow
            label="Misses"
            value="missCount()"
          />
          <StatRow
            label="Singles"
            value="singleCount()"
          />
          <StatRow
            label="Doubles"
            value="doubleCount()"
          />
          <StatRow
            label="Trebles"
            value="trebleCount()"
          />
        </dl>
      </div>
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "currentPointsFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "currentPointsFor(state()?.seats[1]?.participantRef)",
      }}
      isTarget={false}
      class="h-2/5"
    >
      <dl
        slot="progressA"
        class="w-full space-y-1"
      >
        <StatRow
          label="Target"
          value="currentTargetLabelFor(state()?.seats[0]?.participantRef)"
        />
        <StatRow
          label="Misses"
          value="missCountFor(state()?.seats[0]?.participantRef)"
        />
      </dl>
      <dl
        slot="progressB"
        class="w-full space-y-1"
      >
        <StatRow
          label="Target"
          value="currentTargetLabelFor(state()?.seats[1]?.participantRef)"
        />
        <StatRow
          label="Misses"
          value="missCountFor(state()?.seats[1]?.participantRef)"
        />
      </dl>
    </SplitScoreboard>
  </template>

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <VisitPreview />

  <SinglesRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

- [ ] **Step 5: Show the highest-points winner in `SinglesTrainingResults.astro`**

In `app/src/components/layout/games/result-modals/SinglesTrainingResults.astro`, replace the `<h2>` (lines 15-17):

```astro
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-text="
        !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? 'Session complete'
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins — highest points!')
      "
    >
    </h2>
```

- [ ] **Step 6: Manual verification**

Start the dev server and play a full Singles Training 1v1 session through all 21 targets for both seats. Confirm: the split scoreboard shows both seats' own target/points; both seats always take the same number of visits; the results modal names the higher-points winner. Confirm a solo session is unchanged.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/singles-training-play.data.ts app/src/lib/game/types.ts \
  app/tests/lib/game/singles-training-play.data.test.ts \
  app/src/components/layout/games/interfaces/SinglesTraining.astro \
  app/src/components/layout/games/result-modals/SinglesTrainingResults.astro
git commit -m "feat: split scoreboard and highest-points banner for Singles Training 1v1"
```

---

## Task 19: Doubles Training engine — score-compare, new hit-count metric

**Files:**
- Modify: `app/src/modules/game/types.ts:57-62` (the `DoublesTrainingState` type)
- Modify: `app/src/modules/game/doubles-training.engine.module.ts` (full rewrite)
- Modify: `docs/game-rules/rulesets/doubles-training.md` (document the new hit-count win metric — non-canonical source, but this is a real behavior change worth recording there per the file's own scope)
- Test: `app/tests/modules/game/doubles-training.engine.module.test.ts` (extend — existing cases move to `state.seats[0].*`)

**Interfaces:**
- Consumes: `scoreCompareWinner` from Task 1, `activeSeat` from Task 2 (3-arg call — every seat always takes exactly 21 visits regardless of how many darts each one used, so both seats take the same number of turns; no completion predicate needed, same reasoning as Task 17's Singles Training).
- Produces: `DoublesTrainingSeatState`, `DoublesTrainingState`. The win metric — count of doubles hit — is new: today's ruleset doc only tracked hit/miss ratios, not a score, per the design spec.

- [ ] **Step 1: Update the type**

In `app/src/modules/game/types.ts`, replace lines 57-62 (the current `DoublesTrainingState` type):

```ts
export type DoublesTrainingSeatState = SeatState & {
  targetIndex: number;
  dartsThisVisit: number;
  outcomes: DoublesVisitOutcome[];
  status: "IN_PROGRESS" | "COMPLETE";
};

export type DoublesTrainingState = MultiSeatState<DoublesTrainingSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
};
```

- [ ] **Step 2: Write the failing test**

Update every existing assertion in `app/tests/modules/game/doubles-training.engine.module.test.ts` from `state.<field>` to `state.seats[0].<field>` for `targetIndex`/`dartsThisVisit`/`outcomes`/`status`. Add:

```ts
describe("DoublesTrainingEngine — 1v1", () => {
  const twoSeats = [
    { participantRef: "p1", displayName: "A", sideKey: "A", participantTypeKey: "PLAYER" as const },
    { participantRef: "p2", displayName: "B", sideKey: "B", participantTypeKey: "GUEST" as const },
  ];
  const twoSeatConfig: Seated<DoublesTrainingSnapshot> = {
    mode: "STANDARD",
    targetOrder: Array.from({ length: 20 }, (_, i) => i + 1),
    seats: twoSeats,
  };

  it("both seats play all 21 targets, most doubles hit wins", () => {
    const engine = new DoublesTrainingEngine(twoSeatConfig);
    for (let round = 0; round < 21; round++) {
      const number = round < 20 ? round + 1 : 25;
      const zone = round < 20 ? "DOUBLE" : "INNER_BULL";
      engine.record({ hitTargetNumber: number, hitZoneKey: zone, locationX: null, locationY: null }); // p1: hits dart 1 every visit
      engine.record({ hitTargetNumber: number, hitZoneKey: "MISS", locationX: null, locationY: null }); // p2 dart 1
      engine.record({ hitTargetNumber: number, hitZoneKey: "MISS", locationX: null, locationY: null }); // p2 dart 2
      engine.record({ hitTargetNumber: number, hitZoneKey: "MISS", locationX: null, locationY: null }); // p2 dart 3: visit resolves as a miss
    }
    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.seats[0].outcomes.filter((o) => o.hit).length).toBe(21);
    expect(state.seats[1].outcomes.filter((o) => o.hit).length).toBe(0);
    expect(state.winningSideKey).toBe("A");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: FAIL.

- [ ] **Step 4: Write the implementation**

Replace the full contents of `app/src/modules/game/doubles-training.engine.module.ts`:

```ts
import type { DoublesTrainingSnapshot, Seated, SeatFact } from "@lib/types";
import { newClientKey } from "./client-key.module";
import {
  BULL_TARGET_NUMBER,
  boardScore,
  doublesPath,
  isHitOn,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { scoreCompareWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartFact,
  DartObservation,
  DartZoneKey,
  DoublesTrainingSeatState,
  DoublesTrainingState,
  DoublesVisitOutcome,
  EngineFacts,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = { clientKey: "block-1", stageTypeKey: "EXERCISE_BLOCK", parentClientKey: null, sequence: 1 };

function initialSeatState(seat: SeatFact): DoublesTrainingSeatState {
  return { participantRef: seat.participantRef, sideKey: seat.sideKey, targetIndex: 0, dartsThisVisit: 0, outcomes: [], status: "IN_PROGRESS" };
}

/** Doubles Training starting state: every configured seat aimed at DOUBLE 1, no darts thrown. */
export function initialDoublesTrainingState(config: Seated<DoublesTrainingSnapshot>): DoublesTrainingState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

function toHitDartNumber(dartsThisVisit: number): 1 | 2 | 3 {
  if (dartsThisVisit === 1 || dartsThisVisit === 2 || dartsThisVisit === 3) return dartsThisVisit;
  throw new Error(`Invalid dartsThisVisit for a hit resolution: ${dartsThisVisit}`);
}

function resolveVisit(state: DoublesTrainingSeatState, outcomes: DoublesVisitOutcome[]): DoublesTrainingSeatState {
  if (state.targetIndex === 20) {
    return { ...state, dartsThisVisit: 0, outcomes, status: "COMPLETE" };
  }
  return { ...state, dartsThisVisit: 0, outcomes, targetIndex: state.targetIndex + 1 };
}

/**
 * Pure reducer: folds one dart observation onto one seat's
 * `DoublesTrainingSeatState`.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyDoublesTrainingDart(
  config: DoublesTrainingSnapshot,
  state: DoublesTrainingSeatState,
  observation: DartObservation,
): DoublesTrainingSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session is complete; undo first to correct it.",
    );
  }

  const target = targetAt(doublesPath(config.targetOrder), state.targetIndex);
  const hit = isHitOn(target, observation);
  const dartsThisVisit = state.dartsThisVisit + 1;

  if (hit) {
    const outcome: DoublesVisitOutcome = { targetIndex: state.targetIndex, hit: true, hitDartNumber: toHitDartNumber(dartsThisVisit) };
    return resolveVisit(state, [...state.outcomes, outcome]);
  }
  if (dartsThisVisit < 3) {
    return { ...state, dartsThisVisit };
  }
  const outcome: DoublesVisitOutcome = { targetIndex: state.targetIndex, hit: false, hitDartNumber: null };
  return resolveVisit(state, [...state.outcomes, outcome]);
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

function dartHitIntendedTarget(dart: DartFact): boolean {
  return dart.hitTargetNumber === dart.intendedTargetNumber && dart.hitZoneKey === dart.intendedZoneKey;
}

function isVisitOpen(turn: TurnFact): boolean {
  const lastDart = turn.darts.at(-1);
  if (!lastDart) return true;
  return turn.darts.length < 3 && !dartHitIntendedTarget(lastDart);
}

/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldSinglesTrainingState`. Score-compare, most doubles hit wins — a new
 * derived metric: today's ruleset doc only tracked hit/miss ratios, not a
 * score (design spec). Every seat always takes exactly 21 visits regardless
 * of how many darts each used, so `activeSeat` needs no completion
 * predicate, same reasoning as Singles Training.
 */
export function foldDoublesTrainingState(
  facts: EngineFacts,
  config: Seated<DoublesTrainingSnapshot>,
): DoublesTrainingState {
  const seats = config.seats.map((seat) => {
    let state = initialSeatState(seat);
    const seatTurns = facts.turns.filter((turn) => turn.participantRef === seat.participantRef);
    for (const turn of seatTurns) {
      for (const dart of turn.darts) {
        state = applyDoublesTrainingDart(config, state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
      }
    }
    return state;
  });

  const winningSideKey =
    seats.length === 1
      ? null
      : scoreCompareWinner(
          seats.map((seat) => ({
            sideKey: seat.sideKey,
            completed: seat.status === "COMPLETE",
            metric: seat.outcomes.filter((outcome) => outcome.hit).length,
          })),
          "HIGHEST",
        );

  const allComplete = seats.every((seat) => seat.status === "COMPLETE");
  const status: DoublesTrainingState["status"] =
    seats.length === 1
      ? seats[0].status
      : !allComplete
        ? "IN_PROGRESS"
        : winningSideKey !== null
          ? "COMPLETE"
          : "TIE";

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT").participantRef,
    status,
    winningSideKey,
    seats,
  };
}

/**
 * Doubles Training: a 21-target path (the 20 doubles and BULL), each visit
 * ending the instant a dart hits its double or after 3 misses, per seat.
 * Score-compare, most doubles hit wins — every seat always takes exactly 21
 * visits, whatever each visit's own dart count.
 */
export class DoublesTrainingEngine implements GameEngine<DartObservation, DoublesTrainingState> {
  readonly rulesetVersionKey = "DOUBLES_TRAINING_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<DoublesTrainingSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): DoublesTrainingState {
    return foldDoublesTrainingState({ stages: [{ ...STAGE }], turns: this.turns }, this.config);
  }

  private openOrCreateTurn(activeParticipantRef: string): TurnFact {
    const last = this.turns.at(-1);
    if (last && isVisitOpen(last)) return last;

    const turn: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      participantRef: activeParticipantRef,
      sequence: this.turns.length + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(turn);
    return turn;
  }

  record(observation: DartObservation): DoublesTrainingState {
    const before = this.deriveState();
    const activeSeatState = before.seats.find((seat) => seat.participantRef === before.activeParticipantRef)!;
    if (activeSeatState.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the session is complete; undo first to correct it.",
      );
    }

    const target = targetAt(doublesPath(this.config.targetOrder), activeSeatState.targetIndex);
    const openTurn = this.openOrCreateTurn(before.activeParticipantRef);
    const intendedZoneKey: DartZoneKey = target.kind === "BULL" ? "INNER_BULL" : "DOUBLE";
    const dart: DartFact = {
      sequence: openTurn.darts.length + 1,
      intendedTargetNumber: target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number,
      intendedZoneKey,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: observation.locationX,
      locationY: observation.locationY,
    };

    openTurn.darts.push(dart);
    openTurn.totalScore = sumDartScores(openTurn.darts);
    if (!isVisitOpen(openTurn)) {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  undo(): boolean {
    const openTurn = this.turns.at(-1);
    if (!openTurn || openTurn.darts.length === 0) return false;

    openTurn.darts.pop();
    if (openTurn.darts.length === 0) {
      this.turns.pop();
    } else {
      openTurn.completedAt = null;
      openTurn.totalScore = sumDartScores(openTurn.darts);
    }
    return true;
  }

  /**
   * Answers whether recording `observation` would end the WHOLE session —
   * this dart completes the active seat's 21st visit, and every other seat
   * has already reached COMPLETE.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    const activeSeatState = before.seats.find((seat) => seat.participantRef === before.activeParticipantRef)!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;

    const after = applyDoublesTrainingDart(this.config, activeSeatState, observation);
    if (after.status !== "COMPLETE") return false;

    return before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) => seat.status === "COMPLETE");
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): DoublesTrainingState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const doublesTrainingEngineFactory: GameEngineFactory<Seated<DoublesTrainingSnapshot>, DartObservation, DoublesTrainingState> = {
  rulesetVersionKey: "DOUBLES_TRAINING_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<DoublesTrainingSnapshot>, prior?: EngineFacts) {
    return new DoublesTrainingEngine(config, prior);
  },
};

registerEngineFactory(doublesTrainingEngineFactory);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the game-engine structural gate**

Run: `cd app && bash scripts/check-game-engines.sh`
Expected: PASS.

- [ ] **Step 7: Document the new win metric**

In `docs/game-rules/rulesets/doubles-training.md`, add a row or short paragraph to the ruleset's own multiplayer/scoring section (create one if none exists) stating: "1v1 win condition: most doubles hit across all 21 targets; ties possible, no tiebreak in this version." Keep the edit minimal — this file is non-canonical pre-spec source material (`docs/game-rules/README.md`), so a short factual addition, not a rewrite.

- [ ] **Step 8: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/doubles-training.engine.module.ts \
  app/tests/modules/game/doubles-training.engine.module.test.ts \
  docs/game-rules/rulesets/doubles-training.md
git commit -m "feat: wire a 1v1 opponent seat into Doubles Training (score-compare, most doubles hit)"
```

---

## Task 20: Doubles Training frontend — split scoreboard and most-doubles-hit banner

**Files:**
- Modify: `app/src/lib/game/doubles-training-play.data.ts`
- Modify: `app/src/components/layout/games/interfaces/DoublesTraining.astro`
- Modify: `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro`
- Test: `app/tests/lib/game/doubles-training-play.data.test.ts` (extend or create)

`play-lifecycle.ts` needs no change (same note as Task 10).

- [ ] **Step 1: Add a `state()` accessor and per-seat variants to `doubles-training-play.data.ts`**

Add `DoublesTrainingState` to the existing `import type { DartObservation }` line (making it `import type { DartObservation, DoublesTrainingState } from "@modules/types";`). Replace `currentTargetLabel`/`hitCount`/`missCount` (lines 78-101):

```ts
    state(this: DoublesTrainingPlayContext): DoublesTrainingState | null {
      return this.engine?.state() ?? null;
    },

    currentTargetLabelFor(this: DoublesTrainingPlayContext, seatRef: string): string {
      const config = this.$store.game.configSnapshot;
      const seat = this.state()?.seats.find((candidate) => candidate.participantRef === seatRef);
      if (!config || !seat) return "";
      return doublesPathTargetLabel(targetAt(doublesPath(config.targetOrder), seat.targetIndex));
    },

    currentTargetLabel(this: DoublesTrainingPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    hitCountFor(this: DoublesTrainingPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find((candidate) => candidate.participantRef === seatRef);
      return String(seat?.outcomes.filter((outcome) => outcome.hit).length ?? 0);
    },

    hitCount(this: DoublesTrainingPlayContext): string {
      const state = this.state();
      if (!state) return "0";
      return this.hitCountFor(state.activeParticipantRef);
    },

    missCountFor(this: DoublesTrainingPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find((candidate) => candidate.participantRef === seatRef);
      return String(seat?.outcomes.filter((outcome) => !outcome.hit).length ?? 0);
    },

    missCount(this: DoublesTrainingPlayContext): string {
      const state = this.state();
      if (!state) return "0";
      return this.missCountFor(state.activeParticipantRef);
    },
```

Replace `uploadAndCompleteSession` (lines 155-160):

```ts
    uploadAndCompleteSession(this: DoublesTrainingPlayContext): Promise<void> {
      const ownerRef =
        this.$store.game.seats.find((seat) => seat.participantTypeKey === "PLAYER")
          ?.participantRef ?? null;
      return playUploadAndCompleteSession(this, (finalState) => {
        const ownerSeat =
          finalState.seats.find((seat) => seat.participantRef === ownerRef) ?? finalState.seats[0];
        return {
          hits: ownerSeat.outcomes.filter((outcome) => outcome.hit).length,
          misses: ownerSeat.outcomes.filter((outcome) => !outcome.hit).length,
          winningSideKey: finalState.winningSideKey,
        };
      });
    },
```

Add `winningSideKey: string | null` to `DoublesTrainingPlayContext["resultsSnapshot"]`'s type in `app/src/lib/game/types.ts:710` (`{ hits: number; misses: number } | null` becomes `{ hits: number; misses: number; winningSideKey: string | null } | null`).

- [ ] **Step 2: Write the failing test**

Add to `app/tests/lib/game/doubles-training-play.data.test.ts` (create it if it does not already exist for this module):

```ts
import { describe, it, expect } from "vitest";
import { doublesTrainingPlay } from "@lib/game/doubles-training-play.data";

describe("doublesTrainingPlay — per-seat accessors", () => {
  it("hitCountFor and missCountFor read the named seat", () => {
    const ctx = doublesTrainingPlay() as unknown as {
      engine: {
        state: () => {
          activeParticipantRef: string;
          seats: { participantRef: string; outcomes: { hit: boolean }[] }[];
        };
      };
      hitCountFor: (seatRef: string) => string;
      missCountFor: (seatRef: string) => string;
    };
    ctx.engine = {
      state: () => ({
        activeParticipantRef: "p1",
        seats: [
          { participantRef: "p1", outcomes: [{ hit: true }, { hit: false }] },
          { participantRef: "p2", outcomes: [{ hit: true }, { hit: true }, { hit: false }] },
        ],
      }),
    };
    expect(ctx.hitCountFor("p2")).toBe("2");
    expect(ctx.missCountFor("p2")).toBe("1");
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts`
Expected: FAIL before Step 1, PASS after.

- [ ] **Step 4: Branch `DoublesTraining.astro` on seat count**

Replace the full contents of `app/src/components/layout/games/interfaces/DoublesTraining.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

const { ...props }: Props = Astro.props;

import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import DoublesPathRecreationalInput from "@components/layout/games/DoublesPathRecreationalInput.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={true}
      target="currentTargetLabel()"
      class="min-h-2/5 max-h-2/5 h-full"
    >
      <div
        slot="progress"
        class="mt-2 flex w-full flex-col items-center gap-2 px-4"
      >
        <dl class="w-full space-y-1">
          <StatRow
            label="Hits"
            value="hitCount()"
          />
          <StatRow
            label="Misses"
            value="missCount()"
          />
        </dl>
      </div>
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "hitCountFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "hitCountFor(state()?.seats[1]?.participantRef)",
      }}
      isTarget={true}
      class="h-2/5"
    >
      <dl
        slot="progressA"
        class="w-full space-y-1"
      >
        <StatRow
          label="Target"
          value="currentTargetLabelFor(state()?.seats[0]?.participantRef)"
        />
        <StatRow
          label="Misses"
          value="missCountFor(state()?.seats[0]?.participantRef)"
        />
      </dl>
      <dl
        slot="progressB"
        class="w-full space-y-1"
      >
        <StatRow
          label="Target"
          value="currentTargetLabelFor(state()?.seats[1]?.participantRef)"
        />
        <StatRow
          label="Misses"
          value="missCountFor(state()?.seats[1]?.participantRef)"
        />
      </dl>
    </SplitScoreboard>
  </template>

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <VisitPreview />

  <DoublesPathRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

`SplitScoreboard`'s `seatA`/`seatB` use `hitCountFor` as `scoreExpr` (the headline number a split scoreboard half shows) since "most doubles hit" is this game's win metric — the per-seat `progressA`/`progressB` slots additionally break out the current target and miss count.

- [ ] **Step 5: Show the most-doubles-hit winner in `DoublesTrainingResults.astro`**

In `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro`, replace the `<h2>` (lines 15-17):

```astro
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-text="
        !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? 'Session complete'
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins — most doubles hit!')
      "
    >
    </h2>
```

- [ ] **Step 6: Manual verification**

Start the dev server and play a full Doubles Training 1v1 session through all 21 targets for both seats. Confirm: the split scoreboard shows both seats' own hit count as the headline, with target/misses in the detail rows; both seats always take 21 visits, whatever each visit's own dart count; the results modal names the most-doubles-hit winner. Confirm a solo session is unchanged.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/doubles-training-play.data.ts app/src/lib/game/types.ts \
  app/tests/lib/game/doubles-training-play.data.test.ts \
  app/src/components/layout/games/interfaces/DoublesTraining.astro \
  app/src/components/layout/games/result-modals/DoublesTrainingResults.astro
git commit -m "feat: split scoreboard and most-doubles-hit banner for Doubles Training 1v1"
```

---

## Task 21: Docs, decisions ledger, full validation, context maintenance

**Files:**
- Modify: `docs/game-rules/rulesets/bobs-27.md`, `121.md`, `around-the-clock.md`, `ten-up-one-down.md`, `shanghai.md`, `score-training.md` (multiplayer feature rows)
- Modify: `docs/architecture/04-Architecture-patterns.md` (Pattern 18)
- Modify: `docs/architecture/06-API/04-Endpoint-Contracts.md` (seat caps)
- Modify: `decisions/game-engine.md` (new append-only decision block)

No test step — this task is docs plus final validation, not source code.

- [ ] **Step 1: Add a multiplayer feature row to each of the six ruleset docs**

For each of `docs/game-rules/rulesets/bobs-27.md`, `121.md`, `around-the-clock.md`, `ten-up-one-down.md`, `shanghai.md`, `score-training.md`: read the file's existing structure first (each has its own layout — `bobs-27.md`'s Objective section and `121.md`'s "Cap / end target" line were already read during this plan's own research and are known to exist; the others' exact section names were not read and must be confirmed before editing). Add one short line or row stating the 1v1 win condition in the game's own terms, matching this plan's design spec table:

- `bobs-27.md`: "1v1: first to bust loses; the other seat wins (elimination)."
- `121.md`: "1v1: first to check out 170 wins; the match ends immediately (race)."
- `around-the-clock.md`: "1v1: both seats finish their own circuit; fewest darts wins (score-compare, ties possible)."
- `ten-up-one-down.md`: "1v1: ROUNDS mode only. Both seats play the full round budget; highest target reached wins (score-compare, ties possible)."
- `shanghai.md`: "1v1: a Shanghai ends the match immediately for whoever hits it; otherwise both seats play all 20 rounds and the higher score wins (ties possible)."
- `score-training.md`: "1v1: ROUNDS mode only. Both seats play the full round budget; highest total score wins (score-compare, ties possible)."

Each is a minimal, targeted addition per `docs/CLAUDE.md`'s Editing Workflow ("Apply a minimal diff in the canonical doc first") — these ruleset docs are non-canonical pre-spec source (`docs/game-rules/README.md`), so a one-line factual addition per file, not a restructure.

- [ ] **Step 2: Update Pattern 18 in `04-Architecture-patterns.md`**

Read the existing Pattern 18 section first (it documents the `GameEngine` contract, `stageOwnership`, and — after the X01 guest-player work — the generic seat layer). Add a subsection naming the three win-condition categories this plan introduced (elimination / race-to-finish / score-compare), the new `match-outcome.module.ts` and its three functions, and the `activeSeat()` completion-predicate parameter added in Task 2. Cross-reference `docs/superpowers/specs/2026-08-22-single-opponent-seat-remaining-engines-design.md` as the source design.

- [ ] **Step 3: Update seat caps in `06-API/04-Endpoint-Contracts.md`**

Find wherever this doc documents `POST /sessions`' `participants` field and the seat cap it enforces (the X01 guest-player work already documented 501's cap of 4 there). Add the `SEAT_CAPS` table from Task 3 — every ruleset now capped at 2 except `501_V1` at 4, everything else defaulting to 1 (reject).

- [ ] **Step 4: Append a decision block to `decisions/game-engine.md`**

Per `DECISIONS.md`'s routing table and the append-only rule (root `CLAUDE.md`: "never edit or delete an existing block in `decisions/**`"), append a new dated block (do not edit any existing block) recording:
- The three win-condition categories (elimination, race-to-finish, score-compare) and which of the seven engines uses which.
- `SEAT_CAPS` replacing the single `MULTI_SEAT_RULESET` constant.
- `activeSeat()`'s new optional completion-predicate parameter, and that only Around the Clock uses it.
- Cross-reference to the design spec file.

- [ ] **Step 5: Full validation**

Run: `cd app && npm run validate:app`
Expected: every step exits zero; the type gate reports 0 errors, 0 warnings, 0 hints (`--minimumFailingSeverity hint`), per `app/CLAUDE.md`'s Validation Standard Procedure.

Run: `cd app && npm run format && npm run format:check`
Expected: clean, per `app/CLAUDE.md`'s "Before every PR create or update" rule. Commit any formatting diffs this produces as part of Step 7 below.

- [ ] **Step 6: Context maintenance**

Run the `context-maintenance` skill (mandatory before claiming this task done, per root `CLAUDE.md`). This covers: registering any new/changed files in the context map's Context Packs table, ISO-dating every doc edit made across this plan's 21 tasks, and running the documented checker pass. Log anything noticed but out of this plan's scope to `FINDINGS.md` rather than fixing it here (root `CLAUDE.md`'s findings-vs-task-scope rule).

- [ ] **Step 7: Commit**

```bash
git add docs/game-rules/rulesets/bobs-27.md docs/game-rules/rulesets/121.md \
  docs/game-rules/rulesets/around-the-clock.md docs/game-rules/rulesets/ten-up-one-down.md \
  docs/game-rules/rulesets/shanghai.md docs/game-rules/rulesets/score-training.md \
  docs/architecture/04-Architecture-patterns.md docs/architecture/06-API/04-Endpoint-Contracts.md \
  decisions/game-engine.md
git commit -m "docs: document 1v1 win conditions, seat caps, and the match-outcome module"
```

If `npm run format` produced additional diffs anywhere across this plan's earlier tasks, commit those separately with `git commit -m "chore: format"` before this final commit, so the format-only diff stays out of the docs commit's history.

---

## Self-Review

**Spec coverage** — every section of `2026-08-22-single-opponent-seat-remaining-engines-design.md` maps to a task: Win-condition model → Tasks 5, 7, 9, 11, 13, 15, 17, 19 (one per engine, by category). Engine layer's per-seat state / turn attribution / `activeSeat` completion-awareness / `match-outcome.module.ts` → Tasks 1, 2, and each engine task. Server/setup's `SEAT_CAPS` → Task 3; the setup-side guest wiring the spec assumed already existed but does not → Task 4 (and Tasks 11, 15 for the two engines outside the shared controller). Frontend's `SplitScoreboard`/results → Tasks 6, 8, 10, 12, 14, 16, 18, 20. Testing section's four bullets → covered inline in every task (new module tests, extended `seat-rota` tests, per-engine extensions, extended `session-seats.service` tests). Touch List → every row has a task, with two corrections recorded up front (validators need no change; setup forms need a one-line prop plus, for six of them, a shared-controller fix the spec's Touch List did not anticipate).

**Placeholder scan** — no TBD/TODO markers; every code block is complete, runnable code. Two callouts left in earlier drafts of this plan were corrected before this document reached its current state: Task 5's bust-driving test no longer contains an unused/half-finished loop, and Task 12's `computeStats` no longer shows an abandoned conditional-type attempt before its final form.

**Type consistency** — `Bobs27SeatState`/`Bobs27State` (Task 5) are consumed identically in Task 6 (`bobs27-play.data.ts`, `Bobs27.astro`). `OneTwentyOneSeatState`/`OneTwentyOneState`/`foldOneTwentyOneState` (Task 7) match their use in Task 8. `AroundTheClockSeatState`/`AroundTheClockState`/`foldAroundTheClockState`/`activeSeat`'s 4-arg call (Task 9) match Task 10. `TuodSeatState`/`TuodState`/`foldTuodState` (Task 11) match Task 12. `ShanghaiSeatState`/`ShanghaiState`/`foldShanghaiState` (Task 13) match Task 14. `ScoreTrainingSeatState`/`ScoreTrainingState`/`foldScoreTrainingState` (Task 15) match Task 16. `SinglesTrainingSeatState`/`SinglesTrainingState`/`foldSinglesTrainingState` (Task 17) match Task 18. `DoublesTrainingSeatState`/`DoublesTrainingState`/`foldDoublesTrainingState` (Task 19) match Task 20. `eliminationWinner`/`raceWinner`/`scoreCompareWinner` (Task 1) are called with matching argument shapes (`{sideKey, failed}` / `{sideKey, finished}` / `{sideKey, completed, metric}`) in every engine task that uses them. `activeSeat`'s new 4th parameter (Task 2) is used only where a completion predicate is actually needed (Task 9's Around the Clock) — every other engine task's 3-arg call matches Task 2's documented default behavior.
