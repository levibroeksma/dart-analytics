# Baseball and Nine Lives 1v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Baseball Darts and Nine Lives (ATC V3) be played 1v1 against a guest.

**Architecture:** Lift `SEAT_CAPS` in place (`BASEBALL_V1`, `AROUND_THE_CLOCK_V3` → 2). Baseball resolves the match through `scoreCompareOutcome`. Nine Lives resolves it through a new pure `livesOutcome` (first bull wins; else the survivor wins), keyed on the snapshot's `lives` field so ATC V1/V2 1v1 is unchanged. Setup, play data and result modals gain the guest seat and the winner display.

**Tech Stack:** TypeScript, Vitest, Astro + Alpine, the TRACK kernel and dart engine shell.

**Spec:** `docs/superpowers/specs/2026-10-26-baseball-nine-lives-1v1-design.md`. Rules: `docs/game-rules/rulesets/{baseball-darts,nine-lives,around-the-clock}.md`.

## Global Constraints

- No new ruleset version, seed, migration, capability row or config key (spec §1, §5).
- Solo behaviour of both games stays byte-identical (golden folds must not change).
- No `//` or `/* */` comments inside function bodies; JSDoc above declarations only (`app/CLAUDE.md` §Comments).
- Tests live under `app/tests/` mirroring `app/src/`; every changed runtime `.ts` needs a changed covering test.
- `.astro` markup is not unit-tested; keep branching inline in frontmatter.
- Commit trailers on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg`.
- Branch: `docs/baseball-nine-lives-1v1` already holds the rules and spec commits; implement on a branch cut from it named `feat/baseball-nine-lives-1v1`.
- Run from `app/`: `npm test -- <path>`; before the PR `npm run format`, `npm run validate:app`.

## Review Focus

- A finished Nine Lives 1v1 match must refuse a dart from the seat that is still alive (the rota hands it the turn after the other seat completes).
- A Nine Lives seat that advances on dart 1 and misses darts 2–3 keeps its life; a duel must not change this.
- ATC V1/V2 1v1 still ends by fewest darts when both seats complete; only `lives` snapshots take the new outcome.
- Baseball equal runs after inning 9 reports `TIE` with no winner, and the results snapshot says so.
- Undoing the match-ending dart returns the session to `IN_PROGRESS` and the same active seat.

---

### Task 1: Baseball match outcome

**Files:**
- Modify: `app/src/modules/game/types.ts` (`BaseballState.status`)
- Modify: `app/src/modules/game/baseball.engine.module.ts` (`foldBaseballState`)
- Test: `app/tests/modules/game/baseball.engine.module.test.ts`

**Interfaces:**
- Consumes: `scoreCompareOutcome(seats: ScoreCompareSeat[], "HIGHEST" | "LOWEST", soloStatus)` from `./match-outcome.module`.
- Produces: `BaseballState.status: "IN_PROGRESS" | "COMPLETE" | "TIE"`; `foldBaseballState` sets `winningSideKey`.

- [ ] **Step 1: Write the failing tests** — append to the file:

```ts
const duel: Seated<BaseballSnapshot> = {
  seats: [
    ...config.seats,
    {
      participantRef: "participant-2",
      displayName: "Guest",
      sideKey: "B",
      participantTypeKey: "GUEST" as const,
    },
  ],
};

function playInning(
  engine: BaseballEngine,
  darts: [DartObservation, DartObservation, DartObservation],
) {
  for (const observation of darts) engine.record(observation);
}

function playToInning9Seat1(engine: BaseballEngine) {
  for (let inning = 1; inning <= BASEBALL_INNINGS; inning += 1) {
    playInning(engine, [S(inning), MISS, MISS]);
    if (inning < BASEBALL_INNINGS) playInning(engine, [S(inning), MISS, MISS]);
  }
}

describe("baseball engine — 1v1", () => {
  it("the seat with more runs wins after inning 9", () => {
    const engine = new BaseballEngine(duel);
    for (let inning = 1; inning <= BASEBALL_INNINGS; inning += 1) {
      playInning(engine, [T(inning), MISS, MISS]);
      playInning(engine, [S(inning), MISS, MISS]);
    }
    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("A");
    expect(state.seats.map((seat) => seat.runs)).toEqual([27, 9]);
    expect(engine.isComplete()).toBe(true);
  });

  it("equal runs is a TIE with no winner", () => {
    const engine = new BaseballEngine(duel);
    for (let inning = 1; inning <= BASEBALL_INNINGS; inning += 1) {
      playInning(engine, [S(inning), MISS, MISS]);
      playInning(engine, [S(inning), MISS, MISS]);
    }
    expect(engine.state().status).toBe("TIE");
    expect(engine.state().winningSideKey).toBeNull();
    expect(() => engine.record(MISS)).toThrow(/game has ended/);
  });

  it("stays in progress until both seats close inning 9", () => {
    const engine = new BaseballEngine(duel);
    playToInning9Seat1(engine);
    expect(engine.state().status).toBe("IN_PROGRESS");
    expect(engine.state().activeParticipantRef).toBe("participant-2");
  });

  it("wouldComplete is true only on the last seat's inning-9 third dart", () => {
    const engine = new BaseballEngine(duel);
    playToInning9Seat1(engine);
    engine.record(S(9));
    engine.record(MISS);
    expect(engine.wouldComplete(MISS)).toBe(true);
    engine.record(MISS);
    expect(engine.isComplete()).toBe(true);
  });

  it("solo still reports no winner", () => {
    const engine = engineAfter(perfectGame());
    expect(engine.state().status).toBe("COMPLETE");
    expect(engine.state().winningSideKey).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm RED**

Run: `npm test -- tests/modules/game/baseball.engine.module.test.ts`
Expected: FAIL — `winningSideKey` is `null` and the tie case reports `COMPLETE`.

- [ ] **Step 3: Implement.** In `types.ts` change `BaseballState.status` to `"IN_PROGRESS" | "COMPLETE" | "TIE"`. In `baseball.engine.module.ts` add `import { scoreCompareOutcome } from "./match-outcome.module";` and replace the `return` of `foldBaseballState`:

```ts
  const outcome = scoreCompareOutcome(
    seats.map((seat) => ({
      sideKey: seat.sideKey,
      completed: seat.status === "COMPLETE",
      metric: seat.runs,
    })),
    "HIGHEST",
    seats[0].status,
  );
  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status: outcome.status,
    winningSideKey: outcome.winningSideKey,
    seats,
  };
```

Also change the `refusal` in `baseballSpec` to stay `state.status === "IN_PROGRESS" ? null : GAME_ENDED` (already correct for `TIE`).

- [ ] **Step 4: Run, confirm GREEN**

Run: `npm test -- tests/modules/game/baseball.engine.module.test.ts && npx astro check 2>&1 | tail -3`
Expected: PASS; `0 errors, 0 warnings, 0 hints`.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/baseball.engine.module.ts app/tests/modules/game/baseball.engine.module.test.ts
git commit -m "feat(baseball): resolve a 1v1 match by runs"
```

---

### Task 2: Nine Lives match outcome

**Files:**
- Modify: `app/src/modules/game/match-outcome.module.ts` (add `livesOutcome`)
- Modify: `app/src/modules/game/around-the-clock.engine.module.ts` (`foldAroundTheClockState`, `wouldCompleteSession`, `clockSpec.refusal`)
- Test: `app/tests/modules/game/match-outcome.module.test.ts`, `app/tests/modules/game/around-the-clock.engine.module.test.ts`

**Interfaces:**
- Consumes: `raceWinner`, `eliminationWinner` (same module); `MatchOutcome` from `./types`.
- Produces: `livesOutcome(seats: readonly { sideKey: string; finished: boolean; out: boolean }[], soloStatus: "IN_PROGRESS" | "COMPLETE"): MatchOutcome`.

- [ ] **Step 1: Write failing tests.** In `match-outcome.module.test.ts` add `livesOutcome` to the import and append:

```ts
describe("livesOutcome", () => {
  const live = { finished: false, out: false };
  it("a solo seat reports the given status and no winner", () => {
    expect(livesOutcome([{ sideKey: "A", ...live }], "COMPLETE")).toEqual({
      status: "COMPLETE",
      winningSideKey: null,
    });
  });
  it("the seat that finished wins", () => {
    expect(
      livesOutcome(
        [
          { sideKey: "A", ...live, finished: true },
          { sideKey: "B", ...live },
        ],
        "IN_PROGRESS",
      ),
    ).toEqual({ status: "COMPLETE", winningSideKey: "A" });
  });
  it("the survivor wins once the other seat is out", () => {
    expect(
      livesOutcome(
        [
          { sideKey: "A", ...live, out: true },
          { sideKey: "B", ...live },
        ],
        "IN_PROGRESS",
      ),
    ).toEqual({ status: "COMPLETE", winningSideKey: "B" });
  });
  it("is in progress while both seats are alive", () => {
    expect(
      livesOutcome(
        [
          { sideKey: "A", ...live },
          { sideKey: "B", ...live },
        ],
        "IN_PROGRESS",
      ),
    ).toEqual({ status: "IN_PROGRESS", winningSideKey: null });
  });
});
```

In `around-the-clock.engine.module.test.ts` append (reusing `v3`, `visit`, `numberHit`, `bullHit`, `miss`):

```ts
const duelSeats = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
  {
    participantRef: "participant-2",
    displayName: "Guest",
    sideKey: "B",
    participantTypeKey: "GUEST" as const,
  },
];

function v3Duel(): Seated<AroundTheClockV3Snapshot> {
  return { ...v3(), seats: duelSeats } as Seated<AroundTheClockV3Snapshot>;
}

function hitVisit(engine: AroundTheClockEngine, n: number): void {
  visit(engine, [numberHit(n, "SINGLE"), miss(), miss()]);
}

describe("Around the Clock V3 — 1v1 lives", () => {
  it("the first seat to hit the bull wins at once", () => {
    const engine = new AroundTheClockEngine(v3Duel());
    for (let n = 1; n <= 20; n += 1) {
      hitVisit(engine, n);
      hitVisit(engine, n);
    }
    engine.record(bullHit("INNER_BULL"));
    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("A");
    expect(state.seats[1].status).toBe("IN_PROGRESS");
    expect(() => engine.record(miss())).toThrow(/session has ended/);
  });

  it("the survivor wins when the other seat loses its last life", () => {
    const engine = new AroundTheClockEngine(v3Duel());
    visit(engine, [miss(), miss(), miss()]);
    hitVisit(engine, 1);
    visit(engine, [miss(), miss(), miss()]);
    hitVisit(engine, 2);
    visit(engine, [miss(), miss(), miss()]);
    const state = engine.state();
    expect(state.seats[0].status).toBe("OUT");
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("B");
    expect(() => engine.record(miss())).toThrow(/session has ended/);
  });

  it("wouldComplete is true on the dart that costs the last life", () => {
    const engine = new AroundTheClockEngine(v3Duel());
    visit(engine, [miss(), miss(), miss()]);
    hitVisit(engine, 1);
    visit(engine, [miss(), miss(), miss()]);
    hitVisit(engine, 2);
    engine.record(miss());
    engine.record(miss());
    expect(engine.wouldComplete(miss())).toBe(true);
  });

  it("hit then two misses keeps the life in a duel", () => {
    const engine = new AroundTheClockEngine(v3Duel());
    hitVisit(engine, 1);
    expect(engine.state().seats[0].lives).toBe(3);
    expect(engine.state().status).toBe("IN_PROGRESS");
  });

  it("replaying all but the winning dart resumes play for seat A", () => {
    const full = new AroundTheClockEngine(v3Duel());
    for (let n = 1; n <= 20; n += 1) {
      hitVisit(full, n);
      hitVisit(full, n);
    }
    full.record(bullHit("OUTER_BULL"));
    expect(full.isComplete()).toBe(true);
    const turns = full.facts().turns;
    const last = turns[turns.length - 1];
    const trimmed = {
      stages: full.facts().stages,
      turns: [...turns.slice(0, -1), { ...last, darts: last.darts.slice(0, -1) }],
    };
    const resumed = new AroundTheClockEngine(v3Duel(), trimmed);
    expect(resumed.state().status).toBe("IN_PROGRESS");
    expect(resumed.state().activeParticipantRef).toBe("participant-1");
  });

  it("V2 1v1 still resolves by fewest darts", () => {
    const engine = new AroundTheClockEngine({
      ...v2(),
      seats: duelSeats,
    } as never);
    expect(engine.state().status).toBe("IN_PROGRESS");
    expect(engine.state().winningSideKey).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm RED**

Run: `npm test -- tests/modules/game/match-outcome.module.test.ts tests/modules/game/around-the-clock.engine.module.test.ts`
Expected: FAIL — `livesOutcome` is not exported; the duel cases report no winner and accept a dart after the match ends.

- [ ] **Step 3: Implement.** In `match-outcome.module.ts` append:

```ts
/**
 * The whole match's outcome for a lives race (Nine Lives): the seat that
 * finished wins at once; else once a seat is out the survivor wins; else
 * the match is still on. A solo session reports `soloStatus`, never a winner.
 */
export function livesOutcome(
  seats: readonly { sideKey: string; finished: boolean; out: boolean }[],
  soloStatus: "IN_PROGRESS" | "COMPLETE",
): MatchOutcome {
  if (seats.length === 1) return { status: soloStatus, winningSideKey: null };

  const finisher = raceWinner(seats);
  if (finisher !== null) {
    return { status: "COMPLETE", winningSideKey: finisher };
  }
  const survivor = eliminationWinner(
    seats.map((seat) => ({ sideKey: seat.sideKey, failed: seat.out })),
  );
  return survivor === null
    ? { status: "IN_PROGRESS", winningSideKey: null }
    : { status: "COMPLETE", winningSideKey: survivor };
}
```

In `around-the-clock.engine.module.ts` import `livesOutcome` beside `scoreCompareOutcome`, and in `foldAroundTheClockState` replace the `outcome` block with:

```ts
  const soloStatus = seats[0].status === "OUT" ? "COMPLETE" : seats[0].status;
  const outcome =
    rules.lives === undefined
      ? scoreCompareOutcome(
          seats.map((seat) => ({
            sideKey: seat.sideKey,
            completed: seat.status === "COMPLETE",
            metric: dartsThrownBy(seat.participantRef, facts.turns),
          })),
          "LOWEST",
          soloStatus,
        )
      : livesOutcome(
          seats.map((seat) => ({
            sideKey: seat.sideKey,
            finished: seat.status === "COMPLETE",
            out: seat.status === "OUT",
          })),
          soloStatus,
        );
```

In `wouldCompleteSession`, after `const after = ...;` add:

```ts
  if (rules.lives !== undefined) return after.status !== "IN_PROGRESS";
```

Change `clockSpec.refusal` to:

```ts
    refusal: (state) =>
      state.status === "IN_PROGRESS" &&
      activeSeatState(state).status === "IN_PROGRESS"
        ? null
        : SESSION_ENDED,
```

Fix the doc comment above `foldAroundTheClockState` and `clockSpec` so they say a lives snapshot ends at the first bull or when a seat is out.

- [ ] **Step 4: Run, confirm GREEN, and golden/V2 untouched**

Run: `npm test -- tests/modules/game/ && npx astro check 2>&1 | tail -3`
Expected: all PASS including `around-the-clock.golden.test.ts`; `0 errors, 0 warnings, 0 hints`.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/match-outcome.module.ts app/src/modules/game/around-the-clock.engine.module.ts app/tests/modules/game/match-outcome.module.test.ts app/tests/modules/game/around-the-clock.engine.module.test.ts
git commit -m "feat(nine-lives): resolve a 1v1 match by first bull or last standing"
```

---

### Task 3: Seat caps and progress

**Files:**
- Modify: `app/src/services/session-seats.service.ts` (`SEAT_CAPS`)
- Test: `app/tests/services/session-seats.service.test.ts`, `app/tests/modules/game/session-progress.module.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2 engines.
- Produces: `BASEBALL_V1: 2`, `AROUND_THE_CLOCK_V3: 2`.

- [ ] **Step 1: Write failing tests.** In `session-seats.service.test.ts` replace the two `AROUND_THE_CLOCK_V3` cases (lines ~372–380) with:

```ts
  it("accepts one seat", () => {
    expect(rejectSeatRequest([solo], "AROUND_THE_CLOCK_V3")).toBeNull();
  });

  it("accepts a second seat", () => {
    expect(rejectSeatRequest([solo, guest], "AROUND_THE_CLOCK_V3")).toBeNull();
  });

  it("refuses a third seat", () => {
    const third = { ...guest, sideKey: "C" };
    expect(
      rejectSeatRequest([solo, guest, third], "AROUND_THE_CLOCK_V3"),
    ).toContain("supports at most 2 seats");
  });
```

and add a Baseball block beside it:

```ts
describe("rejectSeatRequest — BASEBALL_V1", () => {
  const solo = {
    participantTypeKey: "PLAYER" as const,
    sideKey: "A",
    displayName: "Levi",
  };
  const guest = {
    participantTypeKey: "GUEST" as const,
    sideKey: "B",
    displayName: "Guest",
  };

  it("accepts one or two seats", () => {
    expect(rejectSeatRequest([solo], "BASEBALL_V1")).toBeNull();
    expect(rejectSeatRequest([solo, guest], "BASEBALL_V1")).toBeNull();
  });

  it("refuses a third seat", () => {
    expect(
      rejectSeatRequest(
        [solo, guest, { ...guest, sideKey: "C" }],
        "BASEBALL_V1",
      ),
    ).toContain("supports at most 2 seats");
  });
});
```

(If the describe block's local `solo`/`guest` constants already exist at that scope, reuse them rather than redeclaring.) In `session-progress.module.test.ts` add a case per game that folds a two-seat fact log and asserts the detail reads the **active** seat: Baseball after one closed visit by seat A expects `Inning 1 of 9` for seat B; Nine Lives after A's blank visit expects B's detail to show its own lives (follow the file's existing `BASEBALL_V1` and `AROUND_THE_CLOCK_V3` cases for the call shape).

- [ ] **Step 2: Run, confirm RED**

Run: `npm test -- tests/services/session-seats.service.test.ts tests/modules/game/session-progress.module.test.ts`
Expected: FAIL — V3 still capped at 1, `BASEBALL_V1` has no entry (cap 1).

- [ ] **Step 3: Implement.** In `SEAT_CAPS` set `AROUND_THE_CLOCK_V3: 2,` and add `BASEBALL_V1: 2,` after `SHANGHAI_V3: 2,`.

- [ ] **Step 4: Run, confirm GREEN**

Run: `npm test -- tests/services tests/modules/game/session-progress.module.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/services/session-seats.service.ts app/tests/services/session-seats.service.test.ts app/tests/modules/game/session-progress.module.test.ts
git commit -m "feat(game): allow a second seat in Baseball and Nine Lives"
```

---

### Task 4: Baseball setup, play and results

**Files:**
- Modify: `app/src/lib/game/types.ts` (`BaseballResultsSnapshot`)
- Modify: `app/src/lib/game/baseball-play.data.ts` (`uploadAndCompleteSession`, `resultsTitle`)
- Modify: `app/src/components/layout/games/setup/BaseballSetupForm.astro`
- Modify: `app/src/components/layout/games/result-modals/BaseballResults.astro`
- Test: `app/tests/lib/game/baseball-play.data.test.ts`, `app/tests/lib/game/baseball-setup.data.test.ts`

**Interfaces:**
- Consumes: `BaseballState.status/winningSideKey` (Task 1), `matchWinnerName(seats, sideKey)` from `@lib/game/match-result-text`.
- Produces: `BaseballResultsSnapshot = { status: "COMPLETE" | "TIE"; winningSideKey: string | null; seats: BaseballSeatResult[] }`; a 1v1 `resultsTitle`.

- [ ] **Step 1: Write failing tests.** In `baseball-setup.data.test.ts` add inside the `describe`:

```ts
  it("adds a guest and still creates BASEBALL_V1", async () => {
    const setup = createSetup({ presets: [PRESET] });
    setup.newGuestName = "Friend";
    setup.addGuest();
    expect(setup.guests).toHaveLength(1);
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "new-session-id",
      participants: [
        { ref: "participant-1", displayName: "Player", participantTypeKey: "PLAYER" },
        { ref: "participant-2", displayName: "Friend", participantTypeKey: "GUEST" },
      ],
    } as any);
    vi.stubGlobal("location", { href: "" });
    await setup.start();
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ rulesetVersionKey: "BASEBALL_V1" }),
    );
  });
```

In `baseball-play.data.test.ts` add (mirroring the file's existing result-title and snapshot cases for the context construction): a two-seat context whose final state has `status: "COMPLETE", winningSideKey: "A"` expects the uploaded snapshot to carry `winningSideKey: "A"` and `resultsTitle()` to be `"Levi wins!"`; a `TIE` state expects `status: "TIE"`, `winningSideKey: null` and title `"Tie — same runs!"`; a solo state keeps `winningSideKey: null` and title `"Nine innings played"`.

- [ ] **Step 2: Run, confirm RED**

Run: `npm test -- tests/lib/game/baseball-play.data.test.ts tests/lib/game/baseball-setup.data.test.ts`
Expected: FAIL — snapshot hard-codes `winningSideKey: null` and `status: "COMPLETE"`; title is always "Nine innings played".

- [ ] **Step 3: Implement.** In `lib/game/types.ts`:

```ts
export type BaseballResultsSnapshot = {
  status: "COMPLETE" | "TIE";
  winningSideKey: string | null;
  seats: BaseballSeatResult[];
};
```

In `baseball-play.data.ts` import `matchWinnerName` from `@lib/game/match-result-text` and replace the two methods:

```ts
    uploadAndCompleteSession(this: BaseballPlayContext): Promise<void> {
      const turns = this.$store.game.turns;
      return playUploadAndCompleteSession(this, (finalState) => ({
        status: finalState.status === "TIE" ? "TIE" : "COMPLETE",
        winningSideKey: finalState.winningSideKey,
        seats: finalState.seats.map((seat) => baseballSeatResult(seat, turns)),
      }));
    },

    resultsTitle(this: BaseballPlayContext): string {
      const snapshot = this.resultsSnapshot;
      if (!snapshot || snapshot.seats.length === 1) return "Nine innings played";
      if (snapshot.status === "TIE") return "Tie — same runs!";
      const winner = matchWinnerName(
        this.$store.game.seats,
        snapshot.winningSideKey,
      );
      return winner ? `${winner} wins!` : "Session complete";
    },
```

`BaseballSetupForm.astro`: replace the `UserSection` line with `<UserSection allowGuests />`, and end the `infoSection.description` with `Solo practice or 1v1 against a guest; the most runs wins and equal runs is a tie. Locked rules.` instead of `Solo practice, locked rules.`

`BaseballResults.astro`: import `ComparisonSummary` (`@components/layout/games/ComparisonSummary.astro`), keep the existing `SinglePlayerSummary` block, and add `<ComparisonSummary statRows={STAT_ROWS} />` after it, as `ShanghaiResults.astro` does; change the overline to `Baseball Darts · Summary`.

- [ ] **Step 4: Run, confirm GREEN**

Run: `npm test -- tests/lib/game && npx astro check 2>&1 | tail -3`
Expected: PASS; `0 errors, 0 warnings, 0 hints`.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/baseball-play.data.ts app/src/components/layout/games/setup/BaseballSetupForm.astro app/src/components/layout/games/result-modals/BaseballResults.astro app/tests/lib/game/baseball-play.data.test.ts app/tests/lib/game/baseball-setup.data.test.ts
git commit -m "feat(baseball): 1v1 setup, winner and tie results"
```

---

### Task 5: Nine Lives setup, play and results

**Files:**
- Modify: `app/src/lib/game/around-the-clock-setup.data.ts` (`addGuest`, header comment)
- Modify: `app/src/lib/game/around-the-clock-play.data.ts` (`resultsTitle`)
- Modify: `app/src/components/layout/games/setup/AroundTheClockSetupForm.astro`
- Modify: `app/src/components/layout/games/result-modals/AroundTheClockResults.astro`
- Test: `app/tests/lib/game/around-the-clock-setup.data.test.ts`, `app/tests/lib/game/around-the-clock-play.data.test.ts`

**Interfaces:**
- Consumes: Task 2 outcome (`winningSideKey`, `status`), `matchWinnerName`.
- Produces: guest seating keeps `lives`; 1v1 lives title `"<name> wins!"`.

- [ ] **Step 1: Write failing tests.** In `around-the-clock-setup.data.test.ts` add (reusing the file's `createSetup` helper and preset fixture):

```ts
  it("keeps Nine Lives on and untimed when a guest is added", () => {
    const setup = createSetup();
    setup.lives = true;
    setup.newGuestName = "Friend";
    setup.addGuest();
    expect(setup.guests).toHaveLength(1);
    expect(setup.lives).toBe(true);
    expect(setup.durationType).toBe("UNTIMED");
  });

  it("starts AROUND_THE_CLOCK_V3 with a guest seated", async () => {
    const setup = createSetup({ presets: [PRESET] });
    setup.lives = true;
    setup.newGuestName = "Friend";
    setup.addGuest();
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "new-session-id",
      participants: [
        { ref: "participant-1", displayName: "Player", participantTypeKey: "PLAYER" },
        { ref: "participant-2", displayName: "Friend", participantTypeKey: "GUEST" },
      ],
    } as any);
    vi.stubGlobal("location", { href: "" });
    await setup.start();
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ rulesetVersionKey: "AROUND_THE_CLOCK_V3" }),
    );
  });
```

(Use the file's existing preset constant name and `createSession` mock import; the first existing test that starts V3 solo shows both.) In `around-the-clock-play.data.test.ts` add: a lives 1v1 snapshot (`status: "COMPLETE"`, `winningSideKey: "B"`, two seats, no `out`) yields `resultsTitle()` `"Guest wins!"`; the same with seat A `out: true, targetAtEnd` and `winningSideKey: "B"` also `"Guest wins!"`; a V2 1v1 snapshot still yields `"<name> wins — fewest darts!"`; `soloTitle` behaviour (`Out on …`) unchanged for one seat.

- [ ] **Step 2: Run, confirm RED**

Run: `npm test -- tests/lib/game/around-the-clock-setup.data.test.ts tests/lib/game/around-the-clock-play.data.test.ts`
Expected: FAIL — `addGuest` still resets `lives`; lives 1v1 title reads "wins — fewest darts!".

- [ ] **Step 3: Implement.** In `around-the-clock-setup.data.ts` change `addGuest` to:

```ts
    addGuest(this: AroundTheClockSetupContext) {
      controller.addGuest.call(this);
      if (this.guests.length > 0) {
        this.durationType = "UNTIMED";
        this.durationValue = null;
      }
    },
```

and update the doc comment above `aroundTheClockSetup` so V3 reads "(Nine Lives, solo or 1v1)". In `around-the-clock-play.data.ts` replace the last return of `resultsTitle`:

```ts
      if (!winner) return "Session complete";
      return this.hasLives() ? `${winner} wins!` : `${winner} wins — fewest darts!`;
```

(`hasLives` already exists at ~line 370 and reads the snapshot's `lives`.) In `AroundTheClockSetupForm.astro` change the Nine Lives wrapper `x-show="guests.length === 0"` to `x-show="!bot"` and the hint to `Three lives. A visit with no hit costs one. First to the bull wins, or the last seat with a life.`; in the description string change `Nine Lives (solo only) locks` to `Nine Lives locks`. In `AroundTheClockResults.astro` add `<ComparisonSummary statRows={LIVES_ROWS} />` guarded by `x-if="hasLives()"` beside the existing lives block, keeping the other two comparison renders unchanged (`ComparisonSummary` already renders only with two seats).

- [ ] **Step 4: Run, confirm GREEN**

Run: `npm test -- tests/lib/game && npx astro check 2>&1 | tail -3`
Expected: PASS; `0 errors, 0 warnings, 0 hints`.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/around-the-clock-setup.data.ts app/src/lib/game/around-the-clock-play.data.ts app/src/components/layout/games/setup/AroundTheClockSetupForm.astro app/src/components/layout/games/result-modals/AroundTheClockResults.astro app/tests/lib/game/around-the-clock-setup.data.test.ts app/tests/lib/game/around-the-clock-play.data.test.ts
git commit -m "feat(nine-lives): 1v1 setup, winner results"
```

---

### Task 6: Replay, docs, decision and gates

**Files:**
- Modify: `app/tests/lib/stats/replay-games.ts` and `app/tests/lib/stats/replay-presenters.test.ts` (two-seat Baseball and Nine Lives replays)
- Modify: `decisions/game-engine.md` (new block), `docs/architecture/00-Context-Map-History.md`, `docs/architecture/` seat-cap rows (same files Shanghai V3 touched: `Endpoint-Contracts` seat cap line, `10-Statistics` section note if it names seat counts)
- Modify: `docs/game-rules/rulesets/{baseball-darts,nine-lives,around-the-clock}.md` (`Current version`, Features rows to shipped wording)

**Interfaces:** none new.

- [ ] **Step 1: Failing replay tests.** Add a two-seat Baseball replay and a two-seat Nine Lives replay helper beside the existing `playShanghaiRange` in `replay-games.ts`, and cases in `replay-presenters.test.ts` asserting each turn cell and the session line for both seats, including the winner line for Nine Lives. Run `npm test -- tests/lib/stats/replay-presenters.test.ts`; expected RED if a presenter assumes one seat, otherwise GREEN on first run (record which in the ledger — a green first run is a finding about the test, so also assert a value that only a two-seat fold produces).
- [ ] **Step 2: Statistics check.** Grep `app/src/lib/stats` and `app/src/modules/stats` for Baseball and Around the Clock section code that reads `seats[0]` or assumes one seat; add a test per site that a two-seat session counts the owner's seat only. File any wrong-looking existing behaviour as a `discovered-work` issue instead of fixing it.
- [ ] **Step 3: Docs.** `bash scripts/next-decision-id.sh`, then append the decision block to `decisions/game-engine.md` (cap lifted in place, `livesOutcome`, lives-snapshot-keyed branch; no ruleset version). Edit the three rules files: `Current version:` Baseball `V2 (shipped <date>)`, Nine Lives `V2 (shipped <date>)`, ATC `V4 (shipped <date>)`; reword the Features rows from "Scheduled for" to "Shipped" (targeted edits only). Append the Context-Map-History entry; update the seat-cap doc rows and the File Inventory only if a file was added.
- [ ] **Step 4: Gates.** From `app/`: `npm run format`, then `npm run validate:app`. From the repo root run every gate in the `run-all-gates` skill's "Always run" and "If `app/` changed" lists, and `bash scripts/check-decision-ids.sh`. Expected: all `OK`/`PASS`, `astro check` at 0/0/0.
- [ ] **Step 5: Visual check.** Playwright against the dev server with the API mocked, 390×844: Baseball setup with a guest, Baseball 1v1 result, Nine Lives setup with the switch on and a guest seated, Nine Lives 1v1 play header and result. Record any dev-server limitation in the PR instead of claiming the check.
- [ ] **Step 6: Commit and finish**

```bash
git add -A
git commit -m "docs: ship Baseball and Nine Lives 1v1"
```

Then use `superpowers:finishing-a-development-branch` with the `finishing-a-dart-branch` pairing (push, open the PR, subscribe to its activity).
