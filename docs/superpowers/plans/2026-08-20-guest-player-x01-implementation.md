# Guest Player & Multi-Seat X01 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a 501 session be played by 1–4 seated participants (the owning player plus ephemeral guests) on one device, with every turn attributed to the participant who threw it.

**Architecture:** Seats are an ordered list written into the session's immutable configuration snapshot at create time; the *active* seat is always derived from the fact log, never stored. `TurnFact` gains a `participantRef` that the engine stamps, so one session's log can hold several throwers. A shared `seat-rota` module derives whose throw it is for both stage shapes (`SHARED` — one X01 leg holds every seat's interleaved visits; `PER_SEAT` — one stage per seat per round), and X01 folds leg/match wins per `sideKey` so a future 2v2 needs no state change.

**Tech Stack:** Astro.js, TypeScript, Alpine.js (v3 + `$persist`), Zod, Vitest, PostgreSQL (Neon) via dbmate + Drizzle introspect, Cloudflare Workers.

**Source spec:** `docs/superpowers/specs/2026-08-20-guest-player-x01-design.md`

---

## Global Constraints

- Completed gameplay is immutable; corrections create new records. Never mutate a persisted fact.
- Store facts; statistics live in `v_*` views only — never persisted, never accumulated in engine state.
- Never modify applied migrations `0001`–`0022`. New schema change = new numbered migration (`0023`) + spec update.
- IDs: UUIDv7 for domain entities, generated in the service layer (`generateId()` from `@lib/id`); SMALLINT for seeded lookups. The database never generates ids.
- Runtime tables never FK-reference templates; configuration is copied as a snapshot.
- Reads via `v_*` views; writes to runtime tables in transactions.
- Every `*.engine.module.ts` satisfies Pattern 18 (`docs/architecture/04-Architecture-patterns.md`): owns its `EngineFacts`, mints `clientKey`/`sequence`/`completedAt`, rehydrates via `create(config, prior)`, `undo()` is an exact inverse of `record()` over `facts()` including stages, undo depth unbounded, `wouldComplete()` pure, `state()`/`facts()` return derived copies.
- **No `//` or `/* */` comments inside function or method bodies** in `app/src/**/*.ts`. Detail goes in JSDoc above the declaration. Enforced by `scripts/check-no-inline-comments.sh`. (`app/tests/` is exempt.)
- **Type-barrel rules** (`scripts/check-type-barrels.sh`): `export type` never appears in an implementation file — it lives in that folder's `types.ts`; `export interface` in `interfaces.ts`. Import barrels through the area-root alias (`@lib/types`, `@modules/types`, `@services/types`, `@routes/types`) or `./types` for your own folder — never a deeper path, never a sibling's relative barrel.
- Tests live under `app/tests/`, mirroring `app/src/` — never colocated. Framework is Vitest.
- TDD: write the failing test, watch it fail, implement minimally, watch it pass, commit.
- Minimal diffs. Never regenerate a doc; edit it in place.
- A finding is not a work item: anything you notice that no step below names goes in `FINDINGS.md` and is raised in the completion report — never fixed in this plan.
- Decisions in `decisions/**` are append-only. Never edit or delete an existing block; a reversal is a new block citing `Supersedes:`.
- Work on branch `claude/guest-player-x01-architecture-m8ia8v`. Do not merge to `main`. Do not open a PR unless the user asks.
- Before any PR create/update: `cd app && npm run format`, commit the diff, confirm `npm run format:check` is clean.

## Refinements to the spec

Four places where this plan implements the spec's intent through a different mechanism. Each is deliberate; the reason is stated so a reviewer can reject it on the merits.

1. **Seats are composed into the snapshot *after* ruleset config validation, not inside each ruleset's Zod schema.** The spec says "each ruleset's config schema picks up `seats[]` from one shared Zod block". Every `RULESET_CONFIGS` schema is `.strict()` and `toSnapshot()` parses the wire config through it, so a `seats` key inside those schemas would have to be present in every seeded `configuration_templates.configuration` row — which it cannot be, since seats are minted per session. The spec's real requirement is that seat/participant agreement is validated in *one place*: that is `app/src/services/session-seats.service.ts`, called once from `createSession`.
2. **`MultiSeatState` is generic in its seat type.** The spec writes `FiveOhOneState = MultiSeatState & { …; seats: FiveOhOneSeatState[] }`. A plain intersection produces `seats: readonly SeatState[] & readonly FiveOhOneSeatState[]`, which is awkward to construct and read. `MultiSeatState<TSeat extends SeatState = SeatState>` gives the spec's exact shape with none of that, and `FiveOhOneState` stays assignable to `MultiSeatState`.
3. **The store has no separate persisted `seats` field.** The spec's touch list says "`seats[]` replaces `participantRef`". Seats already live in `configSnapshot`, so a second persisted field would be a second source of truth that can drift. `game.store.ts` exposes `seats` as a **getter** over `configSnapshot?.seats ?? []` — `$store.game.seats` still reads exactly as the spec intends, from one place.
4. **Seat entries inside the stored snapshot stay camelCase**, unlike the snake_case config keys around them. `config-codec.ts`'s `mapKeys` is shallow, so a snake_case `seats` array would pass through `toSnapshot()` unconverted and silently mismatch `SeatFact`. Two additions beyond the spec, both flagged for the same reason — the spec's guard table did not anticipate them:
   - `SeatFact` carries `participantTypeKey`, so the results snapshot can restrict the owner's statistics to the owner's own turns (Task 8).
   - Setup rejects more than one seat for any ruleset other than `501_V1`. The other eight engines are not wired for seats in this plan, so accepting a second seat for them would persist participants nothing can throw for.

---

## File Structure

**New files**

| File | Responsibility |
| --- | --- |
| `app/src/modules/game/seat-rota.module.ts` | Pure seat derivation: `activeSeat`, `startingSeatFor`, `seatOf`. Stores nothing. |
| `app/src/services/session-seats.service.ts` | The single server-side place seat/participant agreement is validated and seat rows composed. |
| `database/migrations/0023_owner_scoped_dart_views.sql` | Restricts `v_dart_analytics` and `v_dart_locations` to the owning player's own participant. |
| `app/tests/modules/game/seat-rota.module.test.ts` | Tests the generic layer once, for every game that will use it. |
| `app/tests/services/session-seats.service.test.ts` | Tests every setup rejection. |

**Modified files**

| File | Change |
| --- | --- |
| `app/src/lib/game/rulesets/types.ts` | `SeatFact`, `SeatSide`, `Seated<T>` type declarations. |
| `app/src/modules/game/types.ts` | `TurnFact.participantRef`; `StageOwnership`; `SeatState`; `MultiSeatState`; reshaped `FiveOhOneState` + `FiveOhOneSeatState` + `FiveOhOneSideState`. |
| `app/src/modules/game/interfaces.ts` | `stageOwnership` on `GameEngine` and `GameEngineFactory`. |
| `app/src/modules/game/*.engine.module.ts` (all 9) | Declare `stageOwnership`; stamp `participantRef` on every minted turn. |
| `app/src/modules/game/five-oh-one.engine.module.ts` | Per-seat score fold, per-side leg wins, shared-leg rotation. |
| `app/src/modules/game/events.payload.module.ts` | Drop the `participantRef` parameter; read `turn.participantRef`. |
| `app/src/pages/api/sessions/types.ts` | `ParticipantInput`; `participants?[]` on `CreateSessionRequest`. |
| `app/src/services/session.service.ts` | Mint N participants; compose seats into the snapshot; call the seat validator. |
| `app/src/repositories/session.repository.ts` | `insertSessionRecords` inserts a participant array. |
| `app/src/stores/game.store.ts` | `configSnapshot` becomes seated; `seats` getter; `participantRef` removed; `STORE_VERSION` → 3. |
| `app/src/stores/types.ts` | `ConfigSnapshot` becomes `Seated<…>`. |
| `app/src/lib/game/session-mode-resolution.ts` | `startSessionInput` composes seats into the snapshot. |
| `app/src/lib/game/play-lifecycle.ts`, `five-oh-one-play.data.ts`, `one-twenty-one-play.data.ts`, `bobs27-play.data.ts`, `tuod-play.data.ts`, `score-training-play.data.ts` | Drop `participantRef` reads; re-seat the snapshot on `playAgain`. |
| `app/src/lib/game/types.ts` | Context types for the store and 501 play page. |

---

### Task 1: Seat vocabulary and the rota module

The generic layer, with no consumers yet. Nothing else in the codebase changes, so this task stands or falls on its own tests.

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts` (append at end of file)
- Modify: `app/src/modules/game/types.ts` (append `StageOwnership`)
- Create: `app/src/modules/game/seat-rota.module.ts`
- Test: `app/tests/modules/game/seat-rota.module.test.ts`

**Interfaces:**
- Consumes: `EngineFacts`, `TurnFact`, `StageFact` from `@modules/types` (already exist).
- Produces:
  - `SeatFact = { participantRef: string; displayName: string; sideKey: string; participantTypeKey: "PLAYER" | "GUEST" }` — exported from `@lib/types`.
  - `Seated<TConfig> = TConfig & { seats: readonly SeatFact[] }` — exported from `@lib/types`.
  - `StageOwnership = "SHARED" | "PER_SEAT"` — exported from `@modules/types`.
  - `startingSeatFor(legIndex: number, seatCount: number): number`
  - `seatOf(turn: TurnFact, seats: readonly SeatFact[]): SeatFact`
  - `activeSeat(facts: EngineFacts, seats: readonly SeatFact[], stageOwnership: StageOwnership): SeatFact`
  - all three exported from `@modules/game/seat-rota.module`.

- [ ] **Step 1: Add the seat types**

Append to the end of `app/src/lib/game/rulesets/types.ts`:

```ts
/**
 * One ordered position in a session's throw rota, as written into the
 * session's configuration snapshot at create time. `sideKey` groups seats:
 * v1 writes exactly one seat per side, and a future 2v2 writes two. Seat
 * order is gameplay-relevant and therefore stored; the ACTIVE seat is derived
 * from the fact log and never stored.
 *
 * `participantTypeKey` is carried so read-time statistics can restrict
 * themselves to the owning player's own turns — a guest's visits land in the
 * same `turns` table.
 */
export type SeatFact = {
  participantRef: string;
  displayName: string;
  sideKey: string;
  participantTypeKey: "PLAYER" | "GUEST";
};

/**
 * A ruleset config snapshot plus the seats playing it. Seats are composed in
 * after the ruleset's own Zod schema has parsed the config, so no ruleset
 * schema needs a `seats` key it could never receive from a seeded template.
 */
export type Seated<TConfig> = TConfig & { seats: readonly SeatFact[] };
```

Append to the end of `app/src/modules/game/types.ts`:

```ts
/**
 * Which stage shape an engine has, so the shared rota can derive the active
 * seat for both. `SHARED`: one stage instance holds every seat's turns,
 * interleaved — an X01 leg, where a checkout ends the stage for all seats at
 * once. `PER_SEAT`: one stage instance per seat per round — seat 2's round 4
 * is not seat 1's round 4.
 */
export type StageOwnership = "SHARED" | "PER_SEAT";
```

- [ ] **Step 2: Write the failing test**

Create `app/tests/modules/game/seat-rota.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  activeSeat,
  seatOf,
  startingSeatFor,
} from "@modules/game/seat-rota.module";
import type { EngineFacts, StageFact, TurnFact } from "@modules/types";
import type { SeatFact } from "@lib/types";

function seats(count: number): SeatFact[] {
  return Array.from({ length: count }, (_unused, index) => ({
    participantRef: `p${index}`,
    displayName: `Player ${index}`,
    sideKey: String.fromCharCode(65 + index),
    participantTypeKey: index === 0 ? ("PLAYER" as const) : ("GUEST" as const),
  }));
}

function leg(sequence: number): StageFact {
  return {
    clientKey: `leg-${sequence}`,
    stageTypeKey: "LEG",
    parentClientKey: null,
    sequence,
  };
}

function turn(
  stageClientKey: string,
  sequence: number,
  participantRef: string,
  completed = true,
): TurnFact {
  return {
    clientKey: `${stageClientKey}-t${sequence}`,
    stageClientKey,
    participantRef,
    sequence,
    completedAt: completed ? "2026-08-20T10:00:00.000Z" : null,
    totalScore: 60,
    darts: [],
  };
}

describe("startingSeatFor", () => {
  it("rotates over seats and wraps at seatCount", () => {
    expect([0, 1, 2, 3].map((leg) => startingSeatFor(leg, 2))).toEqual([
      0, 1, 0, 1,
    ]);
    expect([0, 1, 2, 3].map((leg) => startingSeatFor(leg, 3))).toEqual([
      0, 1, 2, 0,
    ]);
    expect([0, 1, 2, 3, 4].map((leg) => startingSeatFor(leg, 4))).toEqual([
      0, 1, 2, 3, 0,
    ]);
  });

  it("keeps a single-seat session on seat 0 forever", () => {
    expect([0, 1, 2, 9].map((leg) => startingSeatFor(leg, 1))).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

describe("seatOf", () => {
  it("resolves a turn to the seat that threw it", () => {
    const roster = seats(3);
    expect(seatOf(turn("leg-1", 1, "p2"), roster)).toBe(roster[2]);
  });

  it("throws for a ref that is not a seat", () => {
    expect(() => seatOf(turn("leg-1", 1, "ghost"), seats(2))).toThrow(
      /ghost/,
    );
  });
});

describe("activeSeat under SHARED stages", () => {
  it("starts leg 1 on seat 0 and advances one seat per completed visit", () => {
    const roster = seats(2);
    const facts: EngineFacts = { stages: [leg(1)], turns: [] };
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[0]);

    facts.turns.push(turn("leg-1", 1, "p0"));
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[1]);

    facts.turns.push(turn("leg-1", 2, "p1"));
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[0]);
  });

  it("starts leg 2 on seat 1 and leg 3 back on seat 0", () => {
    const roster = seats(2);
    const legTwo: EngineFacts = {
      stages: [leg(1), leg(2)],
      turns: [turn("leg-1", 1, "p0")],
    };
    expect(activeSeat(legTwo, roster, "SHARED")).toBe(roster[1]);

    const legThree: EngineFacts = {
      stages: [leg(1), leg(2), leg(3)],
      turns: [turn("leg-1", 1, "p0")],
    };
    expect(activeSeat(legThree, roster, "SHARED")).toBe(roster[0]);
  });

  it("holds the seat whose visit is still open", () => {
    const roster = seats(3);
    const facts: EngineFacts = {
      stages: [leg(1)],
      turns: [turn("leg-1", 1, "p0"), turn("leg-1", 2, "p1", false)],
    };
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[1]);
  });

  it("counts only the open leg's turns, not the whole match", () => {
    const roster = seats(2);
    const facts: EngineFacts = {
      stages: [leg(1), leg(2)],
      turns: [
        turn("leg-1", 1, "p0"),
        turn("leg-1", 2, "p1"),
        turn("leg-1", 3, "p0"),
        turn("leg-2", 1, "p1"),
      ],
    };
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[0]);
  });
});

describe("activeSeat under PER_SEAT stages", () => {
  it("advances one seat per completed turn across the whole log", () => {
    const roster = seats(2);
    const facts: EngineFacts = {
      stages: [leg(1), leg(2)],
      turns: [turn("leg-1", 1, "p0")],
    };
    expect(activeSeat(facts, roster, "PER_SEAT")).toBe(roster[1]);

    facts.turns.push(turn("leg-2", 1, "p1"));
    expect(activeSeat(facts, roster, "PER_SEAT")).toBe(roster[0]);
  });

  it("holds the seat whose turn is still open", () => {
    const roster = seats(2);
    const facts: EngineFacts = {
      stages: [leg(1)],
      turns: [turn("leg-1", 1, "p0", false)],
    };
    expect(activeSeat(facts, roster, "PER_SEAT")).toBe(roster[0]);
  });
});

describe("activeSeat with one seat", () => {
  it("reproduces solo behaviour under both stage shapes", () => {
    const roster = seats(1);
    const facts: EngineFacts = {
      stages: [leg(1), leg(2)],
      turns: [turn("leg-1", 1, "p0"), turn("leg-2", 1, "p0")],
    };
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[0]);
    expect(activeSeat(facts, roster, "PER_SEAT")).toBe(roster[0]);
  });
});
```

Note: this test constructs `TurnFact` objects with a `participantRef` field that does not exist yet. That is deliberate — Step 4 adds it.

- [ ] **Step 3: Run the test and watch it fail**

Run: `cd app && npx vitest run tests/modules/game/seat-rota.module.test.ts`
Expected: FAIL — `Failed to resolve import "@modules/game/seat-rota.module"`.

- [ ] **Step 4: Add `participantRef` to `TurnFact`**

In `app/src/modules/game/types.ts`, find the `TurnFact` declaration and add the field plus the JSDoc note:

```ts
/**
 * One `turns` row. `participantRef` is the seat that threw the visit — the
 * engine mints it exactly as it mints `clientKey`, `sequence` and
 * `completedAt`, which is what lets one session's log hold several throwers.
 */
export type TurnFact = {
  clientKey: string;
  stageClientKey: string;
  participantRef: string;
  sequence: number;
  completedAt: string | null;
  totalScore: number;
  darts: DartFact[];
};
```

This breaks the typecheck in all nine engines. Task 2 repairs them; do not fix them here.

- [ ] **Step 5: Write the rota module**

Create `app/src/modules/game/seat-rota.module.ts`:

```ts
import type { SeatFact } from "@lib/types";
import type { EngineFacts, StageOwnership, TurnFact } from "./types";

/**
 * Which seat starts leg `legIndex` (0-based). The starting seat rotates over
 * SEATS rather than sides, so a 2v2 match alternates A, B, A, B by seat
 * position exactly as a 1v1 does. Deciding leg 1's starter by a throw at the
 * bull is a separate, deferred capture problem.
 */
export function startingSeatFor(legIndex: number, seatCount: number): number {
  return ((legIndex % seatCount) + seatCount) % seatCount;
}

/**
 * The seat that threw `turn`.
 * @throws when the turn carries a ref that is not one of `seats` — a turn
 *   belonging to nobody is silent attribution loss on upload, so it fails
 *   loudly rather than defaulting to seat 0.
 */
export function seatOf(
  turn: TurnFact,
  seats: readonly SeatFact[],
): SeatFact {
  const seat = seats.find(
    (candidate) => candidate.participantRef === turn.participantRef,
  );
  if (!seat) {
    throw new Error(
      `Turn ${turn.clientKey} names participantRef ${turn.participantRef}, which is not a seat in this session.`,
    );
  }
  return seat;
}

/**
 * Whose throw it is, derived from the fact log and the seat list — never
 * stored, so a page refresh mid-leg restores it with nothing persisted.
 *
 * A visit still open always holds its own seat, whichever stage shape the
 * engine has: the thrower keeps the turn until it resolves. Otherwise a
 * `SHARED` engine counts the visits already thrown in the OPEN stage and
 * offsets them from that stage's own starting seat, so the rotation survives
 * a leg boundary; a `PER_SEAT` engine counts the whole log, because every
 * seat's stages advance in lockstep.
 */
export function activeSeat(
  facts: EngineFacts,
  seats: readonly SeatFact[],
  stageOwnership: StageOwnership,
): SeatFact {
  const lastTurn = facts.turns.at(-1);
  if (lastTurn && lastTurn.completedAt === null) {
    return seatOf(lastTurn, seats);
  }

  if (stageOwnership === "PER_SEAT") {
    return seats[facts.turns.length % seats.length];
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

- [ ] **Step 6: Run the test and watch it pass**

Run: `cd app && npx vitest run tests/modules/game/seat-rota.module.test.ts`
Expected: PASS — 10 tests.

(The rest of the suite is red until Task 2. That is expected and is why these two tasks land back to back.)

- [ ] **Step 7: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/lib/game/rulesets/types.ts app/src/modules/game/types.ts app/src/modules/game/seat-rota.module.ts app/tests/modules/game/seat-rota.module.test.ts
git commit -m "feat(game): seat vocabulary and shared seat rota"
```

---

### Task 2: Every engine stamps a participant, payload builder reads it

`TurnFact.participantRef` is now required, so all nine engines must supply one. This is one task because no smaller unit typechecks. Each engine's config becomes `Seated<…>` and each turn it mints carries `config.seats[0].participantRef`; 501 gets real rotation in Task 7.

**Files:**
- Modify: `app/src/modules/game/interfaces.ts`
- Modify: all nine `app/src/modules/game/*.engine.module.ts`
- Modify: `app/src/modules/game/events.payload.module.ts`
- Modify: `app/src/lib/game/five-oh-one-play.data.ts`, `one-twenty-one-play.data.ts`, `bobs27-play.data.ts`, `tuod-play.data.ts`, `score-training-play.data.ts`, `play-lifecycle.ts`
- Test: `app/tests/modules/game/events.payload.module.test.ts` and every existing `*.engine.module.test.ts`

**Interfaces:**
- Consumes: `SeatFact`, `Seated<T>` from `@lib/types`; `StageOwnership` from `@modules/types` (Task 1).
- Produces:
  - `GameEngine.stageOwnership: StageOwnership` and `GameEngineFactory.stageOwnership: StageOwnership` — readonly, declared statically beside `rulesetVersionKey`.
  - `buildEventsBatch(facts: EngineFacts): EventsBatchRequestInput` — one parameter.
  - Every engine's `create(config, prior)` now takes `Seated<TSnapshot>`.

- [ ] **Step 1: Write the failing test for the payload builder**

Replace the two `buildEventsBatch("participant-1", { … })` call sites in `app/tests/modules/game/events.payload.module.test.ts` with single-argument calls whose turns carry their own refs, and add one new case. The first test becomes:

```ts
  it("nests turns under the stage that owns them and keeps each turn's own participant", () => {
    const batch = buildEventsBatch({
      stages: [
        {
          clientKey: "leg-1",
          stageTypeKey: "LEG",
          parentClientKey: null,
          sequence: 1,
        },
        {
          clientKey: "leg-2",
          stageTypeKey: "LEG",
          parentClientKey: null,
          sequence: 2,
        },
      ],
      turns: [
        {
          clientKey: "t1",
          stageClientKey: "leg-1",
          participantRef: "participant-1",
          sequence: 1,
          completedAt: "2026-07-25T10:00:00.000Z",
          totalScore: 60,
          darts: [],
        },
        {
          clientKey: "t2",
          stageClientKey: "leg-2",
          participantRef: "participant-1",
          sequence: 1,
          completedAt: "2026-07-25T10:01:00.000Z",
          totalScore: 45,
          darts: [],
        },
      ],
    });

    expect(batch.stages).toHaveLength(2);
    expect(batch.stages[0].turns.map((t) => t.clientKey)).toEqual(["t1"]);
    expect(batch.stages[1].turns.map((t) => t.clientKey)).toEqual(["t2"]);
    expect(batch.stages[0].turns[0].participantRef).toBe("participant-1");
  });
```

Add this new test to the same `describe`:

```ts
  it("carries a different participant per turn within one stage", () => {
    const batch = buildEventsBatch({
      stages: [
        {
          clientKey: "leg-1",
          stageTypeKey: "LEG",
          parentClientKey: null,
          sequence: 1,
        },
      ],
      turns: [
        {
          clientKey: "t1",
          stageClientKey: "leg-1",
          participantRef: "seat-a",
          sequence: 1,
          completedAt: "2026-08-20T10:00:00.000Z",
          totalScore: 60,
          darts: [],
        },
        {
          clientKey: "t2",
          stageClientKey: "leg-1",
          participantRef: "seat-b",
          sequence: 2,
          completedAt: "2026-08-20T10:00:30.000Z",
          totalScore: 100,
          darts: [],
        },
      ],
    });

    expect(batch.stages[0].turns.map((t) => t.participantRef)).toEqual([
      "seat-a",
      "seat-b",
    ]);
  });
```

Update the remaining `buildEventsBatch("participant-1", …)` calls in that file the same way: drop the first argument, add `participantRef: "participant-1"` to each turn literal.

- [ ] **Step 2: Run it and watch it fail**

Run: `cd app && npx vitest run tests/modules/game/events.payload.module.test.ts`
Expected: FAIL — `Expected 2 arguments, but got 1` at build time, or `participantRef` undefined at runtime.

- [ ] **Step 3: Make the payload builder read the fact**

In `app/src/modules/game/events.payload.module.ts`, change the signature and the mapped field. The JSDoc gains one sentence; the rest of the function is untouched:

```ts
/**
 * Builds the engine-agnostic events batch payload for
 * `POST /api/sessions/:sessionId/events/batch`. Any engine's `EngineFacts`
 * produces one batch: stages come straight from `facts.stages`, and each
 * stage's turns are its owned subset of `facts.turns`, grouped in a single
 * pass and ordered by `sequence` so replay order is deterministic regardless
 * of the order turns were appended to the fact log.
 *
 * Each turn carries its own `participantRef`, minted by the engine, so refs
 * vary within one batch when several seats played the session. This used to
 * take one ref and stamp it onto every turn, which is why a session's whole
 * log necessarily belonged to one identity.
 *
 * Every turn must belong to a stage present in `facts.stages` — an orphan
 * turn is silent gameplay-data loss on upload, so it throws rather than
 * being dropped.
 */
export function buildEventsBatch(
  facts: EngineFacts,
): EventsBatchRequestInput {
```

and inside the `.map`:

```ts
        .map((turn) => ({
          clientKey: turn.clientKey,
          participantRef: turn.participantRef,
          sequence: turn.sequence,
          totalScore: turn.totalScore,
          completedAt: turn.completedAt,
          darts: turn.darts,
        })),
```

- [ ] **Step 4: Add `stageOwnership` to the contract**

In `app/src/modules/game/interfaces.ts`, import the type and add one readonly member to each interface:

```ts
import type { RulesetVersionKey } from "@lib/types";
import type { EngineFacts, StageOwnership } from "./types";
```

Inside `GameEngine`, directly under `rulesetVersionKey`:

```ts
  /**
   * Which stage shape this engine has, so the shared seat rota can derive the
   * active seat without knowing the ruleset. Static, not derived: a one-seat
   * session behaves identically under either value, so an engine not yet
   * wired for multiple seats declares the shape it WILL have.
   */
  readonly stageOwnership: StageOwnership;
```

Add the same member to `GameEngineFactory`, directly under its own `rulesetVersionKey`.

- [ ] **Step 5: Seat every engine**

For each of the nine `app/src/modules/game/*.engine.module.ts` files, make three edits. `five-oh-one.engine.module.ts` declares `"SHARED"`; the other eight declare `"PER_SEAT"`.

1. Import the seated config type — add `Seated` to the existing `@lib/types` type import, e.g. in `five-oh-one.engine.module.ts`:

```ts
import type { FiveOhOneSnapshot, Seated } from "@lib/types";
```

2. Change the class's config type and add the declaration. In `five-oh-one.engine.module.ts`:

```ts
  readonly rulesetVersionKey = "501_V1";
  readonly stageOwnership = "SHARED" as const;
  private readonly stages: StageFact[];
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<FiveOhOneSnapshot>,
    prior?: EngineFacts,
  ) {
```

and its factory:

```ts
export const fiveOhOneEngineFactory: GameEngineFactory<
  Seated<FiveOhOneSnapshot>,
  FiveOhOneInput,
  FiveOhOneState
> = {
  rulesetVersionKey: "501_V1",
  stageOwnership: "SHARED",
  create(config: Seated<FiveOhOneSnapshot>, prior?: EngineFacts) {
    return new FiveOhOneEngine(config, prior);
  },
};
```

Apply the same pattern to the other eight engines, substituting their own snapshot type, ruleset key and `"PER_SEAT"`.

3. Stamp the ref at every site that pushes a turn. There are 17 such sites in total (4 in `five-oh-one`, 4 in `one-twenty-one`, 2 each in `score-training` and `tuod`, 1 each in the remaining five). Each is an object literal already carrying `stageClientKey`; add one line. In `five-oh-one.engine.module.ts`'s `recordVisitTotal`:

```ts
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: leg.clientKey,
      participantRef: this.config.seats[0].participantRef,
      sequence: this.turnCountIn(leg.clientKey) + 1,
      completedAt: new Date().toISOString(),
      totalScore: outcome.scored,
      darts: [],
    });
```

and in `openNewVisit`:

```ts
    const visit: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: leg.clientKey,
      participantRef: this.config.seats[0].participantRef,
      sequence: this.turnCountIn(leg.clientKey) + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
```

Find every site mechanically:

```bash
grep -n "stageClientKey:" src/modules/game/*.engine.module.ts
```

Every match that is inside an object literal being pushed onto `this.turns` (as opposed to a filter predicate reading `turn.stageClientKey`) needs the new line. Seat 0 is correct for all nine here: 501 gains rotation in Task 7, and the other eight stay single-seat.

- [ ] **Step 6: Update every engine test's config fixture and the payload call sites**

Each `*.engine.module.test.ts` builds a config with a `satisfies XSnapshot` literal. Add seats to each. For `tests/modules/game/five-oh-one.engine.module.test.ts`:

```ts
import type { FiveOhOneSnapshot, Seated } from "@lib/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config = () =>
  ({
    startingScore: 501,
    legsToWin: 1,
    checkIn: "STRAIGHT_IN",
    checkOut: "DOUBLE_OUT",
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
    seats: SEATS,
  }) satisfies Seated<FiveOhOneSnapshot>;
```

Apply the same shape to the other eight engine test fixtures, and drop the first argument from every `buildEventsBatch(...)` call in `five-oh-one.engine.module.test.ts`, `one-twenty-one.engine.module.test.ts` and `tests/services/rulesets/engine-validator-seam.test.ts`.

Several play-controller tests build `TurnFact` literals by hand and now need a ref. In `app/tests/lib/game/five-oh-one-play.data.test.ts`, give the existing `turnFact` helper a defaulted parameter so its call sites stay unchanged:

```ts
function turnFact(
  clientKey: string,
  stageClientKey: string,
  sequence: number,
  totalScore: number,
  participantRef = "p1",
): TurnFact {
  return {
    clientKey,
    stageClientKey,
    participantRef,
    sequence,
    completedAt: "2026-08-01T10:00:00.000Z",
    totalScore,
    darts: [],
  };
}
```

Find every other hand-built turn literal the same way:

```bash
cd /home/user/dart-analytics/app && npm run check 2>&1 | grep -n "participantRef"
```

- [ ] **Step 7: Update the six play controllers**

In each of `five-oh-one-play.data.ts`, `one-twenty-one-play.data.ts`, `bobs27-play.data.ts`, `tuod-play.data.ts`, `score-training-play.data.ts` and `play-lifecycle.ts`, drop the first argument from both `buildEventsBatch` calls. For example in `five-oh-one-play.data.ts`:

```ts
        const batch = buildEventsBatch(currentFacts(this));
```

and:

```ts
          const batch = buildEventsBatch(facts);
```

Leave every `this.$store.game.participantRef = session.participants[0].ref;` line alone — the store field still exists and Task 3 removes it.

- [ ] **Step 8: Run the whole suite**

Run: `cd app && npm test`
Expected: PASS. Every existing engine test passes unmodified apart from its config fixture — the regression net for a one-seat session.

- [ ] **Step 9: Typecheck**

Run: `cd app && npm run check`
Expected: no errors. If a play controller still passes a bare snapshot to `factory.create`, it will surface here; the snapshot becomes seated in Task 3, so for now widen nothing — note the file and fix it in Task 3.

- [ ] **Step 10: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/modules/game app/src/lib/game app/tests
git commit -m "feat(game): every engine stamps the participant that threw the turn"
```

---

### Task 3: Seat the client's config snapshot

The store stops holding one participant ref and starts holding a seated snapshot. Purely mechanical on the client; no server change yet, so a session still has exactly one seat.

**Files:**
- Modify: `app/src/stores/types.ts`
- Modify: `app/src/stores/game.store.ts`
- Modify: `app/src/lib/game/session-mode-resolution.ts`
- Modify: `app/src/lib/game/types.ts`
- Modify: the six play controllers from Task 2 Step 7
- Test: `app/tests/stores/game.store.test.ts`, `app/tests/lib/game/session-mode-resolution.test.ts`

**Interfaces:**
- Consumes: `SeatFact`, `Seated<T>` from `@lib/types` (Task 1).
- Produces:
  - `ConfigSnapshot` (in `@stores/types` via `app/src/stores/types.ts`) becomes `Seated<…>`.
  - `game.store.ts` exposes `get seats(): readonly SeatFact[]` and no longer has `participantRef`.
  - `startSessionInput({ …, configSnapshot, session })` returns `configSnapshot` with `seats` composed in and no `participantRef` key.
  - `seatsFromParticipants(participants: { ref: string; participantTypeKey: string; displayName: string }[]): SeatFact[]` — exported from `@lib/game/session-mode-resolution`.

- [ ] **Step 1: Write the failing test for seat composition**

Add to `app/tests/lib/game/session-mode-resolution.test.ts`:

```ts
import { seatsFromParticipants, startSessionInput } from "@lib/game/session-mode-resolution";

describe("seatsFromParticipants", () => {
  it("gives every participant its own side, in array order", () => {
    expect(
      seatsFromParticipants([
        { ref: "a", participantTypeKey: "PLAYER", displayName: "Levi" },
        { ref: "b", participantTypeKey: "GUEST", displayName: "Dad" },
      ]),
    ).toEqual([
      {
        participantRef: "a",
        displayName: "Levi",
        sideKey: "A",
        participantTypeKey: "PLAYER",
      },
      {
        participantRef: "b",
        displayName: "Dad",
        sideKey: "B",
        participantTypeKey: "GUEST",
      },
    ]);
  });
});

describe("startSessionInput", () => {
  it("composes seats into the config snapshot and carries no participant ref", () => {
    const input = startSessionInput({
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      session: {
        sessionId: "s1",
        participants: [
          { ref: "a", participantTypeKey: "PLAYER", displayName: "Levi" },
        ],
      },
      templateRef: "tpl-1",
      configSnapshot: { startingScore: 501 },
      modePair: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      },
    });

    expect(input.configSnapshot).toEqual({
      startingScore: 501,
      seats: [
        {
          participantRef: "a",
          displayName: "Levi",
          sideKey: "A",
          participantTypeKey: "PLAYER",
        },
      ],
    });
    expect("participantRef" in input).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd app && npx vitest run tests/lib/game/session-mode-resolution.test.ts`
Expected: FAIL — `seatsFromParticipants is not a function`.

- [ ] **Step 3: Compose seats in `session-mode-resolution.ts`**

Replace `startSessionInput` in `app/src/lib/game/session-mode-resolution.ts` and add the helper above it:

```ts
/**
 * Turns the participants the server minted into the session's seat list. The
 * response array's order IS seat order — the setup screen decides who throws
 * first in leg 1 by the order it sends. V1 gives each seat its own side
 * (`A`, `B`, …); a future 2v2 assigns two seats to one side, which every X01
 * win condition already folds for.
 */
export function seatsFromParticipants(
  participants: {
    ref: string;
    participantTypeKey: string;
    displayName: string;
  }[],
): SeatFact[] {
  return participants.map((participant, index) => ({
    participantRef: participant.ref,
    displayName: participant.displayName,
    sideKey: String.fromCharCode(65 + index),
    participantTypeKey:
      participant.participantTypeKey === "GUEST" ? "GUEST" : "PLAYER",
  }));
}

/**
 * The store payload that starts a session, assembled once for both setup
 * pages. They differ only in game type, ruleset and config snapshot; every
 * other field is read off the same two objects, so a new session field is
 * added here rather than in two places that must be kept in step by hand.
 *
 * Seats are composed INTO the snapshot rather than stored beside it: the
 * snapshot is what the engine is constructed from, and a second copy of the
 * seat list is a second thing that can drift from it.
 */
export function startSessionInput<TConfig extends object>(input: {
  gameTypeKey: string;
  rulesetVersionKey: RulesetVersionKey;
  session: {
    sessionId: string;
    participants: {
      ref: string;
      participantTypeKey: string;
      displayName: string;
    }[];
  };
  templateRef: string;
  configSnapshot: TConfig;
  modePair: ModePair;
}) {
  return {
    gameTypeKey: input.gameTypeKey,
    rulesetVersionKey: input.rulesetVersionKey,
    sessionId: input.session.sessionId,
    templateRef: input.templateRef,
    configSnapshot: {
      ...input.configSnapshot,
      seats: seatsFromParticipants(input.session.participants),
    } as Seated<TConfig>,
    captureModeKey: input.modePair.captureModeKey,
    inputModeKey: input.modePair.inputModeKey,
  };
}
```

The generic parameter matters: `Seated<FiveOhOneSnapshot>` is assignable to `ConfigSnapshot` (which is `Seated<union>`), but a non-generic `object` return would not be. Add `SeatFact` and `Seated` to the file's `@lib/types` type import.

- [ ] **Step 4: Run it and watch it pass**

Run: `cd app && npx vitest run tests/lib/game/session-mode-resolution.test.ts`
Expected: PASS.

- [ ] **Step 5: Seat the store**

In `app/src/stores/types.ts`, wrap the union:

```ts
import type {
  Bobs27Snapshot,
  DoublesTrainingSnapshot,
  FiveOhOneSnapshot,
  ScoreTrainingSnapshot,
  Seated,
  SinglesSnapshot,
} from "@lib/types";

/**
 * Any ruleset's camelCase client snapshot, as persisted by `game.store.ts`,
 * plus the seats playing it.
 */
export type ConfigSnapshot = Seated<
  | ScoreTrainingSnapshot
  | Bobs27Snapshot
  | SinglesSnapshot
  | DoublesTrainingSnapshot
  | FiveOhOneSnapshot
>;
```

In `app/src/stores/game.store.ts`: bump the version, delete the `participantRef` field, delete it from `startSession`'s input type and body and from `reset()`, and add the getter. The version constant becomes:

```ts
/**
 * D91: bumped to 2 — the fact-log shape replaced `RecordedTurn`, so v1 state
 * is discarded. Bumped to 3 — turns gained `participantRef` and the snapshot
 * gained `seats`, so a v2 fact log would upload as turns belonging to nobody.
 */
const STORE_VERSION = 3;
```

Add the getter beside `configSnapshot`:

```ts
    /**
     * The session's seats, read from the snapshot rather than persisted
     * separately, so `$store.game.seats` and the config the engine was built
     * from can never disagree.
     */
    get seats(): readonly SeatFact[] {
      return this.configSnapshot?.seats ?? [];
    },
```

Import `SeatFact` from `@lib/types` at the top of the file.

- [ ] **Step 6: Update the store's consumers**

Remove `participantRef` from `PlayStoreContext`/the game-store context type in `app/src/lib/game/types.ts` and add `readonly seats: readonly SeatFact[];`.

In each of the six play controllers, delete the `this.$store.game.participantRef = session.participants[0].ref;` (or `context.$store.game.participantRef = …`) line inside `playAgain`, and re-seat the snapshot on the same path. In `five-oh-one-play.data.ts`'s `playAgain`, replace that line with:

```ts
        this.$store.game.sessionId = session.sessionId;
        this.$store.game.configSnapshot = {
          ...config,
          seats: seatsFromParticipants(session.participants),
        };
```

and pass the re-seated snapshot to the factory further down:

```ts
        const engine = factory.create(this.$store.game.configSnapshot);
```

Import `seatsFromParticipants` from `@lib/game/session-mode-resolution` in each controller that has a `playAgain`. `play-lifecycle.ts` carries the shared version for the four games that use it; make the same edit there once.

- [ ] **Step 7: Run the whole suite and typecheck**

Run: `cd app && npm test && npm run check`
Expected: PASS, no type errors.

Test doubles for `$store.game` that set `participantRef` must be updated. In `app/tests/lib/game/five-oh-one-play.data.test.ts`, `quickPlayConfig()` gains seats and `gameStub()` loses the ref and gains the getter:

```ts
const SOLO_SEATS = [
  {
    participantRef: "p1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

function quickPlayConfig(): Seated<FiveOhOneSnapshot> {
  return {
    startingScore: 501,
    legsToWin: 1,
    checkIn: "STRAIGHT_IN",
    checkOut: "DOUBLE_OUT",
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
    seats: SOLO_SEATS,
  };
}
```

and in `gameStub`, delete `participantRef: "p1",` and add:

```ts
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
```

Find the remaining doubles the same way:

```bash
cd /home/user/dart-analytics/app && grep -rn "participantRef" tests/lib tests/stores
```

- [ ] **Step 8: Commit**

```bash
cd /home/user/dart-analytics
git add app/src app/tests
git commit -m "feat(game): seats live in the client config snapshot"
```

---

### Task 4: Session-create accepts participants

The additive `participants[]` D61 deferred. Server-side only; omitting the field reproduces today's single-`PLAYER` session exactly.

**Files:**
- Modify: `app/src/pages/api/sessions/types.ts`
- Create: `app/src/services/session-seats.service.ts`
- Modify: `app/src/services/types.ts`
- Modify: `app/src/services/session.service.ts`
- Modify: `app/src/repositories/session.repository.ts`
- Modify: `app/src/repositories/types.ts`
- Test: `app/tests/services/session-seats.service.test.ts` (new), `app/tests/services/session.service.test.ts`

**Interfaces:**
- Consumes: `SeatFact` from `@lib/types`.
- Produces:
  - `ParticipantInput` Zod schema and `CreateSessionRequest.participants?: ParticipantInputData[]` in `@routes/types`.
  - `type ParticipantInputData = { participantTypeKey: "PLAYER" | "GUEST"; displayName?: string; sideKey: string }`.
  - `type SeatPlan = { participantId: string; participantTypeId: number; playerId: string | null; displayName: string; sideKey: string }` in `@services/types`.
  - `rejectSeatRequest(participants: ParticipantInputData[] | undefined, rulesetVersionKey: string): string | null` — the reason the request is invalid, or null. Exported from `@services/session-seats.service`.
  - `composeSeatFacts(plan: readonly SeatPlan[]): SeatFact[]` — exported from the same module.
  - `insertSessionRecords` takes `participants: { id, participantTypeId, playerId, displayName }[]` in place of the four single-participant fields.

- [ ] **Step 1: Write the failing test for the setup guards**

Create `app/tests/services/session-seats.service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  composeSeatFacts,
  rejectSeatRequest,
} from "@services/session-seats.service";

const player = { participantTypeKey: "PLAYER" as const, sideKey: "A" };
const guest = {
  participantTypeKey: "GUEST" as const,
  displayName: "Dad",
  sideKey: "B",
};

describe("rejectSeatRequest", () => {
  it("accepts an omitted participants field", () => {
    expect(rejectSeatRequest(undefined, "501_V1")).toBeNull();
  });

  it("accepts one player plus one named guest for 501", () => {
    expect(rejectSeatRequest([player, guest], "501_V1")).toBeNull();
  });

  it("accepts four seats for 501", () => {
    expect(
      rejectSeatRequest(
        [
          player,
          { ...guest, displayName: "B", sideKey: "B" },
          { ...guest, displayName: "C", sideKey: "C" },
          { ...guest, displayName: "D", sideKey: "D" },
        ],
        "501_V1",
      ),
    ).toBeNull();
  });

  it("rejects zero PLAYER entries", () => {
    expect(rejectSeatRequest([guest], "501_V1")).toMatch(/exactly one PLAYER/);
  });

  it("rejects two PLAYER entries", () => {
    expect(
      rejectSeatRequest([player, { ...player, sideKey: "B" }], "501_V1"),
    ).toMatch(/exactly one PLAYER/);
  });

  it("rejects a guest with a blank display name", () => {
    expect(
      rejectSeatRequest([player, { ...guest, displayName: "   " }], "501_V1"),
    ).toMatch(/name/i);
  });

  it("allows two guests with the same display name", () => {
    expect(
      rejectSeatRequest(
        [player, guest, { ...guest, sideKey: "C" }],
        "501_V1",
      ),
    ).toBeNull();
  });

  it("rejects an empty seat list", () => {
    expect(rejectSeatRequest([], "501_V1")).toMatch(/between 1 and 4/);
  });

  it("rejects more than four seats", () => {
    expect(
      rejectSeatRequest(
        [
          player,
          { ...guest, sideKey: "B" },
          { ...guest, sideKey: "C" },
          { ...guest, sideKey: "D" },
          { ...guest, sideKey: "E" },
        ],
        "501_V1",
      ),
    ).toMatch(/between 1 and 4/);
  });

  it("rejects two seats sharing one side, because 2v2 is not implemented", () => {
    expect(
      rejectSeatRequest([player, { ...guest, sideKey: "A" }], "501_V1"),
    ).toMatch(/one seat per side/);
  });

  it("rejects a second seat for a ruleset other than 501_V1", () => {
    expect(rejectSeatRequest([player, guest], "BOBS27_V1")).toMatch(
      /only 501_V1/,
    );
  });

  it("accepts a lone player seat for any ruleset", () => {
    expect(rejectSeatRequest([player], "BOBS27_V1")).toBeNull();
  });
});

describe("composeSeatFacts", () => {
  it("projects the persisted seat plan into snapshot seats, in order", () => {
    expect(
      composeSeatFacts([
        {
          participantId: "id-a",
          participantTypeId: 1,
          playerId: "player-1",
          displayName: "Levi",
          sideKey: "A",
        },
        {
          participantId: "id-b",
          participantTypeId: 2,
          playerId: null,
          displayName: "Dad",
          sideKey: "B",
        },
      ]),
    ).toEqual([
      {
        participantRef: "id-a",
        displayName: "Levi",
        sideKey: "A",
        participantTypeKey: "PLAYER",
      },
      {
        participantRef: "id-b",
        displayName: "Dad",
        sideKey: "B",
        participantTypeKey: "GUEST",
      },
    ]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd app && npx vitest run tests/services/session-seats.service.test.ts`
Expected: FAIL — `Failed to resolve import "@services/session-seats.service"`.

- [ ] **Step 3: Add the request schema**

In `app/src/pages/api/sessions/types.ts`, above `CreateSessionRequest`:

```ts
/**
 * One requested seat. Array order IS seat order, so the setup screen decides
 * who throws first in leg 1 by the order it sends. `displayName` is required
 * for a GUEST and ignored for the PLAYER, whose name is copied server-side
 * from `players.display_name` — migration `0005`'s CHECK requires exactly
 * that, so a client-supplied value is never trusted. Cross-field agreement
 * (one PLAYER, one seat per side, seat count, ruleset support) is asserted
 * once in `session-seats.service.ts` rather than here, because it depends on
 * the ruleset being created.
 */
export const ParticipantInput = z.object({
  participantTypeKey: z.enum(["PLAYER", "GUEST"]),
  displayName: z.string().optional(),
  sideKey: z.string().min(1),
});
export type ParticipantInputData = z.infer<typeof ParticipantInput>;
```

and add one optional field to `CreateSessionRequest`:

```ts
export const CreateSessionRequest = z.object({
  gameTypeKey: z.string(),
  rulesetVersionKey: z.string(),
  captureModeKey: z.string(),
  inputModeKey: z.string(),
  config: ConfigInput,
  participants: z.array(ParticipantInput).optional(),
});
```

The constraint-mirror gate covers only `exercise_stages`/`turns`/`darts`, so no `// MIRRORS:` anchor is required here.

- [ ] **Step 4: Write the seat service**

Add to `app/src/services/types.ts`:

```ts
/**
 * One seat as it will be persisted: the participant row to insert plus the
 * side it plays for. Built before the write so participants and the
 * configuration snapshot are composed from the same ids in one transaction.
 */
export type SeatPlan = {
  participantId: string;
  participantTypeId: number;
  playerId: string | null;
  displayName: string;
  sideKey: string;
};
```

Create `app/src/services/session-seats.service.ts`:

```ts
import type { SeatFact } from "@lib/types";
import type { ParticipantInputData } from "@routes/types";
import type { SeatPlan } from "./types";

const MIN_SEATS = 1;
const MAX_SEATS = 4;
const MULTI_SEAT_RULESET = "501_V1";
const PLAYER_PARTICIPANT_TYPE_ID = 1;

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
 * does not. A second seat for any ruleset but 501 is refused for the same
 * reason — the other eight engines are not wired for seats, so accepting one
 * would persist a participant nothing can throw for.
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

  if (
    participants.length > 1 &&
    rulesetVersionKey !== MULTI_SEAT_RULESET
  ) {
    return `Multiple seats are only supported by ${MULTI_SEAT_RULESET}.`;
  }

  return null;
}

/**
 * Projects the seat plan about to be written into the seat list that goes
 * into the configuration snapshot, so replay needs nothing outside the
 * runtime layer. Seat entries stay camelCase inside the otherwise snake_case
 * configuration document: `config-codec.ts`'s key mapper is shallow, so a
 * snake_case seat array would survive `toSnapshot()` unconverted and silently
 * mismatch the client's `SeatFact`.
 */
export function composeSeatFacts(plan: readonly SeatPlan[]): SeatFact[] {
  return plan.map((seat) => ({
    participantRef: seat.participantId,
    displayName: seat.displayName,
    sideKey: seat.sideKey,
    participantTypeKey:
      seat.participantTypeId === PLAYER_PARTICIPANT_TYPE_ID
        ? "PLAYER"
        : "GUEST",
  }));
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `cd app && npx vitest run tests/services/session-seats.service.test.ts`
Expected: PASS — 14 tests.

- [ ] **Step 6: Write the failing service test**

Add to `app/tests/services/session.service.test.ts`, following that file's existing mock setup for `@repositories/session.repository`:

```ts
  it("mints one PLAYER participant when participants is omitted", async () => {
    const result = await createSession("player-1", baseCreateInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.participants).toHaveLength(1);
    expect(result.data.participants[0].participantTypeKey).toBe("PLAYER");
  });

  it("mints one participant per requested seat and returns them in order", async () => {
    const result = await createSession("player-1", {
      ...baseCreateInput(),
      participants: [
        { participantTypeKey: "PLAYER", sideKey: "A" },
        { participantTypeKey: "GUEST", displayName: "Dad", sideKey: "B" },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data.participants.map((p) => [
        p.participantTypeKey,
        p.displayName,
      ]),
    ).toEqual([
      ["PLAYER", "Levi"],
      ["GUEST", "Dad"],
    ]);
  });

  it("copies the PLAYER display name from the player row, ignoring the request", async () => {
    const result = await createSession("player-1", {
      ...baseCreateInput(),
      participants: [
        { participantTypeKey: "PLAYER", displayName: "Spoofed", sideKey: "A" },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.participants[0].displayName).toBe("Levi");
  });

  it("writes the seats into the configuration snapshot, matching the minted ids", async () => {
    const result = await createSession("player-1", {
      ...baseCreateInput(),
      participants: [
        { participantTypeKey: "PLAYER", sideKey: "A" },
        { participantTypeKey: "GUEST", displayName: "Dad", sideKey: "B" },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const written = vi.mocked(insertSessionRecords).mock.calls[0][0];
    expect(written.configuration.seats).toEqual(
      result.data.participants.map((participant, index) => ({
        participantRef: participant.ref,
        displayName: participant.displayName,
        sideKey: index === 0 ? "A" : "B",
        participantTypeKey: participant.participantTypeKey,
      })),
    );
  });

  it("rejects a seat request the seat rules refuse, without writing anything", async () => {
    const result = await createSession("player-1", {
      ...baseCreateInput(),
      participants: [
        { participantTypeKey: "GUEST", displayName: "Dad", sideKey: "A" },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION_FAILED");
    expect(insertSessionRecords).not.toHaveBeenCalled();
  });
```

Add the helper to that file, above the new tests:

```ts
function baseCreateInput(): CreateSessionRequestInput {
  return {
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    config: { source: "inline", config: { legs_to_win: 1 } },
  };
}
```

and make the existing `findPlayerDisplayName` mock resolve `"Levi"`:

```ts
vi.mocked(findPlayerDisplayName).mockResolvedValue("Levi");
```

`findParticipantTypeId` is now called twice per create — once for `PLAYER`, once for `GUEST` — so its mock must return a distinct id per key rather than a fixed value:

```ts
vi.mocked(findParticipantTypeId).mockImplementation(
  async (_db, key: string) => (key === "PLAYER" ? 1 : 2),
);
```

- [ ] **Step 7: Run it and watch it fail**

Run: `cd app && npx vitest run tests/services/session.service.test.ts`
Expected: FAIL — the multi-seat cases return one participant.

- [ ] **Step 8: Widen the repository**

In `app/src/repositories/types.ts`, replace the four single-participant fields on `CreateSessionRecordsInput` with:

```ts
  participants: {
    id: string;
    participantTypeId: number;
    playerId: string | null;
    displayName: string;
  }[];
```

(that is: remove `participantId`, `playerParticipantTypeId` and the participant-specific `displayName`; `playerId` stays for the activity and session rows).

In `app/src/repositories/session.repository.ts`, replace the single-row participant insert inside `insertSessionRecords` and its return:

```ts
    await tx.insert(participants).values(
      input.participants.map((participant) => ({
        id: participant.id,
        exerciseSessionId: input.sessionId,
        participantTypeId: participant.participantTypeId,
        playerId: participant.playerId,
        displayName: participant.displayName,
        createdAt: now,
      })),
    );
    return { sessionId: input.sessionId };
```

and change the function's return type to `Promise<{ sessionId: string }>`.

- [ ] **Step 9: Build the seat plan in the service**

In `app/src/services/session.service.ts`:

1. Extend `loadCreateSessionLookups` to also resolve the guest participant type, returning `guestParticipantTypeId` alongside the existing fields:

```ts
  const [
    captureModeId,
    inputModeId,
    activeStatusId,
    playerParticipantTypeId,
    guestParticipantTypeId,
    displayName,
  ] = await Promise.all([
    findCaptureModeId(db, input.captureModeKey),
    findInputModeId(db, input.inputModeKey),
    findGameStatusId(db, "ACTIVE"),
    findParticipantTypeId(db, "PLAYER"),
    findParticipantTypeId(db, "GUEST"),
    findPlayerDisplayName(db, playerId),
  ]);
```

and add `guestParticipantTypeId` to the `!activeStatusId || …` reference-data guard and to the returned object and its type.

2. Add a plan builder above `createSession`:

```ts
/**
 * The participant rows this session will own, in seat order. An omitted
 * `participants` field produces exactly one PLAYER seat — today's behaviour,
 * which is what keeps D61's "additive participants[]" promise literal and
 * leaves every un-wired engine working untouched.
 *
 * The PLAYER seat's display name is always the player's own row, never the
 * request's: migration `0005`'s CHECK requires a PLAYER participant to carry
 * `players.display_name`.
 */
function buildSeatPlan(
  input: CreateSessionRequestInput,
  playerId: string,
  lookups: {
    playerParticipantTypeId: number;
    guestParticipantTypeId: number;
    displayName: string;
  },
): SeatPlan[] {
  const requested = input.participants ?? [
    { participantTypeKey: "PLAYER" as const, sideKey: "A" },
  ];

  return requested.map((participant, index) => {
    const isPlayer = participant.participantTypeKey === "PLAYER";
    return {
      participantId: generateId(),
      participantTypeId: isPlayer
        ? lookups.playerParticipantTypeId
        : lookups.guestParticipantTypeId,
      playerId: isPlayer ? playerId : null,
      displayName: isPlayer
        ? lookups.displayName
        : (participant.displayName ?? "").trim(),
      sideKey: participant.sideKey || String.fromCharCode(65 + index),
    };
  });
}
```

3. In `createSession`, reject the seat request before any write — put it directly after the `supportsMode` guard:

```ts
  const seatRejection = rejectSeatRequest(
    input.participants,
    input.rulesetVersionKey,
  );
  if (seatRejection) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: seatRejection },
    };
  }
```

4. Replace the `const participantId = generateId();` line and the insert/return block:

```ts
  const sessionId = generateId();
  const seatPlan = buildSeatPlan(input, playerId, {
    playerParticipantTypeId,
    guestParticipantTypeId,
    displayName,
  });
  const seats = composeSeatFacts(seatPlan);

  const inserted = await insertSessionWithActiveGuard(db, {
    sessionId,
    participants: seatPlan.map((seat) => ({
      id: seat.participantId,
      participantTypeId: seat.participantTypeId,
      playerId: seat.playerId,
      displayName: seat.displayName,
    })),
    playerId,
    gameTypeId: gameTypeRuleset.gameTypeId,
    rulesetVersionId: gameTypeRuleset.rulesetVersionId,
    captureModeId,
    inputModeId,
    activeStatusId,
    configuration: { ...configuration.data.config, seats },
  });
  if (!inserted.ok) return inserted;

  return {
    ok: true,
    data: {
      sessionId: inserted.data.sessionId,
      participants: seats.map((seat) => ({
        ref: seat.participantRef,
        participantTypeKey: seat.participantTypeKey,
        displayName: seat.displayName,
      })),
    },
  };
```

Update `insertSessionWithActiveGuard`'s params type to match (drop `participantId`, `playerParticipantTypeId` and `displayName`; add `participants`), and have it return `{ sessionId: params.sessionId }`.

5. Import the two new functions and the type:

```ts
import {
  composeSeatFacts,
  rejectSeatRequest,
} from "./session-seats.service";
import type { SeatPlan } from "./types";
```

- [ ] **Step 10: Run the suite and typecheck**

Run: `cd app && npm test && npm run check`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
cd /home/user/dart-analytics
git add app/src app/tests
git commit -m "feat(api): session create accepts an ordered participants list"
```

---

### Task 5: 501 state splits into seat, side and session scopes

`FiveOhOneState` currently mixes three scopes in one flat object: `remainingScore` is per player, `legsWon` is per side, `status` is per session. Multiplayer forces them apart, which is a correctness fix as much as a feature. This task does the reshape with **one** seat, so the whole existing 501 suite keeps proving the same behaviour; Task 6 adds the second seat.

**Files:**
- Modify: `app/src/modules/game/types.ts`
- Modify: `app/src/modules/game/five-oh-one.engine.module.ts`
- Modify: `app/src/lib/game/five-oh-one-play.data.ts`
- Modify: `app/src/lib/game/types.ts`
- Test: `app/tests/modules/game/five-oh-one.engine.module.test.ts`, `app/tests/lib/game/five-oh-one-play.data.test.ts`

**Interfaces:**
- Consumes: `SeatFact`, `Seated<T>`, `activeSeat`, `seatOf`, `startingSeatFor`, `StageOwnership`.
- Produces:
  - `SeatState = { participantRef: string; sideKey: string }`
  - `MultiSeatState<TSeat extends SeatState = SeatState> = { activeParticipantRef: string; seats: readonly TSeat[] }`
  - `FiveOhOneSeatState = SeatState & { remainingScore: number }`
  - `FiveOhOneSideState = { sideKey: string; legsWon: number }`
  - `FiveOhOneState = MultiSeatState<FiveOhOneSeatState> & { status: "IN_PROGRESS" | "WON"; winningSideKey: string | null; sides: readonly FiveOhOneSideState[] }`
  - `foldFiveOhOneState(facts: EngineFacts, config: Seated<FiveOhOneSnapshot>): FiveOhOneState` — exported from `@modules/game/five-oh-one.engine.module`, replacing the exported `applyFiveOhOneVisit`.
  - `initialFiveOhOneState(config: Seated<FiveOhOneSnapshot>): FiveOhOneState` — kept, reshaped.

- [ ] **Step 1: Declare the new state types**

In `app/src/modules/game/types.ts`, replace the `FiveOhOneState` block with:

```ts
/** The minimum any seat-aware game state says about one seat. */
export type SeatState = {
  participantRef: string;
  sideKey: string;
};

/**
 * The base every seat-aware `TState` extends, so one generic scoreboard can
 * render any game without knowing its ruleset. Generic in the seat type so a
 * ruleset can add its own per-seat fields without an intersection of two
 * array types.
 */
export type MultiSeatState<TSeat extends SeatState = SeatState> = {
  activeParticipantRef: string;
  seats: readonly TSeat[];
};

/** One seat's score in the leg being played. */
export type FiveOhOneSeatState = SeatState & {
  remainingScore: number;
};

/** One side's completed legs. What wins a leg and the match is the SIDE. */
export type FiveOhOneSideState = {
  sideKey: string;
  legsWon: number;
};

/**
 * 501 session state, split into the three scopes it actually has: a
 * `remainingScore` per SEAT, `legsWon` per SIDE, and `status` per SESSION.
 * Every field is a fold over the fact log, never an accumulated value — a
 * bust turn stores `totalScore: 0`, so replaying the log reproduces every
 * leg exactly. A solo session is one seat and one side, with no branch
 * anywhere in the engine.
 */
export type FiveOhOneState = MultiSeatState<FiveOhOneSeatState> & {
  status: "IN_PROGRESS" | "WON";
  winningSideKey: string | null;
  sides: readonly FiveOhOneSideState[];
};
```

- [ ] **Step 2: Write the failing test**

In `app/tests/modules/game/five-oh-one.engine.module.test.ts`, replace the `initialFiveOhOneState` and `applyFiveOhOneVisit` describes. `applyFiveOhOneVisit` is being removed, so its guarantees — the bust matrix, the leg reset, the match win — move to `foldFiveOhOneState` rather than being re-pointed at a different input:

```ts
import {
  FiveOhOneEngine,
  fiveOhOneEngineFactory,
  foldFiveOhOneState,
  initialFiveOhOneState,
} from "@modules/game/five-oh-one.engine.module";
import type {
  DartZoneKey,
  EngineFacts,
  FiveOhOneState,
  FiveOhOneVisitInput,
  MultiSeatState,
} from "@modules/types";

function factsOf(scores: number[]): EngineFacts {
  return {
    stages: [
      {
        clientKey: "leg-1",
        stageTypeKey: "LEG",
        parentClientKey: null,
        sequence: 1,
      },
    ],
    turns: scores.map((totalScore, index) => ({
      clientKey: `t${index + 1}`,
      stageClientKey: "leg-1",
      participantRef: "participant-1",
      sequence: index + 1,
      completedAt: "2026-08-20T10:00:00.000Z",
      totalScore,
      darts: [],
    })),
  };
}

describe("initialFiveOhOneState", () => {
  it("starts every seat at the configured starting score with no legs won", () => {
    expect(initialFiveOhOneState(config())).toEqual({
      activeParticipantRef: "participant-1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      sides: [{ sideKey: "A", legsWon: 0 }],
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          remainingScore: 501,
        },
      ],
    });
  });
});

describe("foldFiveOhOneState", () => {
  it("subtracts each counted visit from the seat that threw it", () => {
    const state = foldFiveOhOneState(factsOf([180, 60]), config());
    expect(state.seats[0].remainingScore).toBe(261);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("treats a scoreless turn as the bust it was recorded as", () => {
    const state = foldFiveOhOneState(factsOf([180, 0]), config());
    expect(state.seats[0].remainingScore).toBe(321);
  });

  it("wins the match for the seat's side when the last leg checks out", () => {
    const state = foldFiveOhOneState(factsOf([180, 180, 101, 40]), config());
    expect(state.status).toBe("WON");
    expect(state.winningSideKey).toBe("A");
    expect(state.sides[0].legsWon).toBe(1);
  });

  it("conforms to MultiSeatState so a generic scoreboard can read it", () => {
    const state: MultiSeatState = foldFiveOhOneState(factsOf([60]), config());
    expect(state.activeParticipantRef).toBe("participant-1");
    expect(state.seats[0].sideKey).toBe("A");
  });
});
```

Then update every remaining assertion in the file that reads the old flat shape. `expect(state.remainingScore).toBe(n)` becomes `expect(state.seats[0].remainingScore).toBe(n)`; `expect(state.legsWon).toBe(n)` becomes `expect(state.sides[0].legsWon).toBe(n)`. `status` is unchanged.

- [ ] **Step 3: Run it and watch it fail**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts`
Expected: FAIL — `foldFiveOhOneState is not exported`.

- [ ] **Step 4: Rewrite the engine's fold**

In `app/src/modules/game/five-oh-one.engine.module.ts`, delete `applyFiveOhOneVisit` and `checkoutDartsRejectionFor`'s dependence on a flat state, keep `resolveFiveOhOneVisit` and `isPlayableVisitScore` unchanged, and add:

Add `SeatFact` to the file's existing `@lib/types` type import (which Task 2 already extended with `Seated`), and add the rota import:

```ts
import { activeSeat, seatOf } from "./seat-rota.module";

/**
 * The zero-turn state: every seat at `startingScore`, every side on no legs,
 * and the first seat to throw.
 */
export function initialFiveOhOneState(
  config: Seated<FiveOhOneSnapshot>,
): FiveOhOneState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    sides: sidesOf(config.seats).map((sideKey) => ({ sideKey, legsWon: 0 })),
    seats: config.seats.map((seat) => ({
      participantRef: seat.participantRef,
      sideKey: seat.sideKey,
      remainingScore: config.startingScore,
    })),
  };
}

/** Every distinct side in the session, in first-seat order. */
function sidesOf(seats: readonly SeatFact[]): string[] {
  return [...new Set(seats.map((seat) => seat.sideKey))];
}

/**
 * Folds the whole fact log into the session's state. A turn's `totalScore` is
 * what actually counted, so a bust replays as a scoreless visit and only a
 * genuine checkout can take a seat to zero — which is why a zeroing visit is
 * safe to treat as a checkout on replay.
 *
 * A leg is SHARED: one stage holds every seat's interleaved visits, and the
 * checkout that ends it resets every seat, because each seat's remaining
 * score is folded from that leg's own turns and a fresh leg has none. The
 * session reaches `WON` only when a SIDE reaches `legsToWin`.
 */
export function foldFiveOhOneState(
  facts: EngineFacts,
  config: Seated<FiveOhOneSnapshot>,
): FiveOhOneState {
  const legsWon = new Map(sidesOf(config.seats).map((side) => [side, 0]));
  const remaining = new Map(
    config.seats.map((seat) => [seat.participantRef, config.startingScore]),
  );
  let winningSideKey: string | null = null;

  for (const stage of facts.stages) {
    if (winningSideKey !== null) break;
    for (const seat of config.seats) {
      remaining.set(seat.participantRef, config.startingScore);
    }

    const visits = facts.turns
      .filter((turn) => turn.stageClientKey === stage.clientKey)
      .slice()
      .sort((a, b) => a.sequence - b.sequence);

    for (const visit of visits) {
      const seat = seatOf(visit, config.seats);
      const before = remaining.get(seat.participantRef) ?? config.startingScore;
      const after = before - visit.totalScore;
      remaining.set(seat.participantRef, after);
      if (after !== 0) continue;

      const won = (legsWon.get(seat.sideKey) ?? 0) + 1;
      legsWon.set(seat.sideKey, won);
      if (won >= config.legsToWin) {
        winningSideKey = seat.sideKey;
      }
      break;
    }
  }

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "SHARED")
      .participantRef,
    status: winningSideKey === null ? "IN_PROGRESS" : "WON",
    winningSideKey,
    sides: [...legsWon].map(([sideKey, won]) => ({
      sideKey,
      legsWon: won,
    })),
    seats: config.seats.map((seat) => ({
      participantRef: seat.participantRef,
      sideKey: seat.sideKey,
      remainingScore:
        winningSideKey !== null && seat.sideKey === winningSideKey
          ? 0
          : (remaining.get(seat.participantRef) ?? config.startingScore),
    })),
  };
}
```

Replace the class's `deriveState()` body with a call to the shared fold, so the engine and the play page share one implementation:

```ts
  private deriveState(): FiveOhOneState {
    return foldFiveOhOneState(
      { stages: this.stages, turns: this.turns },
      this.config,
    );
  }
```

Rewrite the three helpers that read the old flat shape:

```ts
  /**
   * The remaining score of the seat about to throw — what a keypad total or
   * the next dart is resolved against.
   */
  private activeRemaining(state: FiveOhOneState): number {
    const seat = state.seats.find(
      (candidate) => candidate.participantRef === state.activeParticipantRef,
    );
    return seat?.remainingScore ?? this.config.startingScore;
  }
```

`checkoutDartsRejectionFor` takes `this.activeRemaining(state)` in place of `state.remainingScore`. `dartChecksOutFinalLeg` computes `remainingAfter` from `this.activeRemaining(before)`, and its final clause becomes a side check:

```ts
  private dartChecksOutFinalLeg(
    observation: DartObservation,
    before: FiveOhOneState,
  ): boolean {
    const resolved = this.resolveObservation(observation);
    const remainingAfter =
      this.activeRemaining(before) - resolved.score;
    const checksOut = remainingAfter === 0 && resolved.zoneKey === "DOUBLE";
    if (!checksOut) return false;

    const seat = before.seats.find(
      (candidate) => candidate.participantRef === before.activeParticipantRef,
    );
    const side = before.sides.find(
      (candidate) => candidate.sideKey === seat?.sideKey,
    );
    return (side?.legsWon ?? 0) + 1 >= this.config.legsToWin;
  }
```

`remainingBeforeVisit(visit)` must now count only the visit's own seat:

```ts
  /**
   * The leg's starting score minus the counted total of every earlier turn
   * THAT SEAT threw in the same leg — the score `visit` opened against,
   * before any of its own darts. Other seats' visits in the same shared leg
   * never move this seat's score.
   */
  private remainingBeforeVisit(visit: TurnFact): number {
    const scoredBefore = this.turns
      .filter(
        (turn) =>
          turn.stageClientKey === visit.stageClientKey &&
          turn.participantRef === visit.participantRef &&
          turn.sequence < visit.sequence,
      )
      .reduce((sum, turn) => sum + turn.totalScore, 0);
    return this.config.startingScore - scoredBefore;
  }
```

`recordVisitTotal` no longer calls `applyFiveOhOneVisit`. It validates, resolves against the active seat's remaining, pushes the turn, and re-derives:

```ts
  private recordVisitTotal(input: FiveOhOneVisitInput): FiveOhOneState {
    if (this.openVisit() !== null) {
      throw new Error(
        "Finish the open visit on the board before entering a keypad total.",
      );
    }
    if (!isPlayableVisitScore(input.scoreAttempted, this.config.maxVisitScore)) {
      throw new Error(
        `Enter a score between 0 and ${this.config.maxVisitScore}.`,
      );
    }

    const before = this.deriveState();
    const dartsRejection = checkoutDartsRejectionFor(
      this.activeRemaining(before),
      input,
      this.config,
    );
    if (dartsRejection) throw new Error(dartsRejection);
    if (before.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a visit once the session is complete; undo first to correct it.",
      );
    }

    const outcome = resolveFiveOhOneVisit(
      this.activeRemaining(before),
      input,
    );
    const leg = this.openLeg();
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: leg.clientKey,
      participantRef: before.activeParticipantRef,
      sequence: this.turnCountIn(leg.clientKey) + 1,
      completedAt: new Date().toISOString(),
      totalScore: outcome.scored,
      darts: [],
    });

    const after = this.deriveState();
    if (outcome.wonLeg && after.status === "IN_PROGRESS") {
      this.stages.push(legStage(this.stages.length + 1));
    }

    return after;
  }
```

`checkoutDartsRejectionFor` now takes a number rather than a state:

```ts
function checkoutDartsRejectionFor(
  remainingScore: number,
  input: FiveOhOneVisitInput,
  config: FiveOhOneSnapshot,
): string | null {
  if (input.finishedOnDouble !== true) return null;
  return checkoutDartsRejection(
    remainingScore,
    input.dartsUsed,
    input.dartsAtDouble,
    config.maxDartsPerTurn,
  );
}
```

`wouldComplete` follows the same substitution: replace `applyFiveOhOneVisit(before, input, this.config).status === "WON"` with a check that the visit zeroes the active seat and takes its side to `legsToWin`:

```ts
  wouldComplete(input: FiveOhOneInput): boolean {
    if (isDartObservation(input)) {
      return this.wouldCompleteDart(input);
    }
    if (this.openVisit() !== null) return false;
    if (!isPlayableVisitScore(input.scoreAttempted, this.config.maxVisitScore)) {
      return false;
    }

    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

    const remaining = this.activeRemaining(before);
    if (checkoutDartsRejectionFor(remaining, input, this.config) !== null) {
      return false;
    }

    const outcome = resolveFiveOhOneVisit(remaining, input);
    if (!outcome.wonLeg) return false;

    const seat = before.seats.find(
      (candidate) => candidate.participantRef === before.activeParticipantRef,
    );
    const side = before.sides.find(
      (candidate) => candidate.sideKey === seat?.sideKey,
    );
    return (side?.legsWon ?? 0) + 1 >= this.config.legsToWin;
  }
```

`openNewVisit` stamps `this.deriveState().activeParticipantRef` in place of `this.config.seats[0].participantRef`. `recordDart`, `settleVisit`, `undo`, `undoDart`, `undoVisitTotal`, `popStageOpenedBy`, `isComplete`, `state` and `facts` are unchanged.

- [ ] **Step 5: Run the engine test and watch it pass**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Point the play controller at the shared fold**

In `app/src/lib/game/five-oh-one-play.data.ts`, delete `foldLegState` and the `applyFiveOhOneVisit`/`initialFiveOhOneState` imports, and import `foldFiveOhOneState` instead. `remainingScore` reads the active seat off the same fold, over the reactive store fields rather than `engine.state()`:

```ts
    /**
     * Folds the store's own fact log — never `engine.state()` — so every
     * Alpine display expression that calls this re-renders when
     * `recordFacts` writes a new turn. The engine is a plain class instance;
     * its internal mutations carry no Alpine reactivity.
     */
    state(this: FiveOhOnePlayContext): FiveOhOneState | null {
      const config = this.$store.game.configSnapshot;
      if (!config || !("startingScore" in config)) return null;
      return foldFiveOhOneState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    remainingScore(this: FiveOhOnePlayContext): number {
      const state = this.state();
      if (!state) return 0;
      const seat = state.seats.find(
        (candidate) => candidate.participantRef === state.activeParticipantRef,
      );
      return seat?.remainingScore ?? 0;
    },
```

`turnsInCurrentLeg` is unchanged. `computeStats`'s `legsWon` argument is unchanged (it is `config.legsToWin` on the completion path, by definition).

Add `state` and the reshaped `remainingScore` to `FiveOhOnePlayContext` in `app/src/lib/game/types.ts`.

- [ ] **Step 7: Run the whole suite and typecheck**

Run: `cd app && npm test && npm run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd /home/user/dart-analytics
git add app/src app/tests
git commit -m "refactor(501): split state into seat, side and session scopes"
```

---

### Task 6: 501 plays a rotating multi-seat match

The engine already folds per seat and per side; this task proves it with more than one seat and adds the leg-boundary rotation.

**Files:**
- Modify: `app/src/modules/game/five-oh-one.engine.module.ts` (only if a test below fails)
- Test: `app/tests/modules/game/five-oh-one.engine.module.test.ts`

**Interfaces:**
- Consumes: everything produced by Tasks 1 and 5. No new exports.

- [ ] **Step 1: Write the failing multi-seat tests**

Add to `app/tests/modules/game/five-oh-one.engine.module.test.ts`:

```ts
const TWO_SEATS = [
  {
    participantRef: "seat-a",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
  {
    participantRef: "seat-b",
    displayName: "Dad",
    sideKey: "B",
    participantTypeKey: "GUEST" as const,
  },
];

const duo = (legsToWin = 1) =>
  ({
    startingScore: 501,
    legsToWin,
    checkIn: "STRAIGHT_IN",
    checkOut: "DOUBLE_OUT",
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
    seats: TWO_SEATS,
  }) satisfies Seated<FiveOhOneSnapshot>;

/** Plays one whole leg for seat A while seat B scores 60 between every visit. */
function seatAWinsALeg(engine: FiveOhOneEngine): FiveOhOneState {
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 60 });
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 60 });
  engine.record({ scoreAttempted: 101 });
  engine.record({ scoreAttempted: 60 });
  return engine.record({ scoreAttempted: 40, finishedOnDouble: true });
}

describe("FiveOhOneEngine with two seats", () => {
  it("alternates seats visit by visit within one shared leg", () => {
    const engine = new FiveOhOneEngine(duo());
    expect(engine.state().activeParticipantRef).toBe("seat-a");

    engine.record({ scoreAttempted: 60 });
    expect(engine.state().activeParticipantRef).toBe("seat-b");

    engine.record({ scoreAttempted: 100 });
    expect(engine.state().activeParticipantRef).toBe("seat-a");
  });

  it("leaves the other seat's score untouched", () => {
    const engine = new FiveOhOneEngine(duo());
    engine.record({ scoreAttempted: 180 });
    const state = engine.record({ scoreAttempted: 60 });

    expect(state.seats[0].remainingScore).toBe(321);
    expect(state.seats[1].remainingScore).toBe(441);
  });

  it("leaves the other seat's score untouched on a bust", () => {
    const engine = new FiveOhOneEngine(duo());
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    const state = engine.record({ scoreAttempted: 180 });

    expect(state.seats[0].remainingScore).toBe(141);
    expect(state.seats[1].remainingScore).toBe(141);
  });

  it("resets every seat and opens exactly one shared next leg", () => {
    const engine = new FiveOhOneEngine(duo(2));
    const state = seatAWinsALeg(engine);

    expect(state.status).toBe("IN_PROGRESS");
    expect(state.seats.map((seat) => seat.remainingScore)).toEqual([501, 501]);
    expect(engine.facts().stages).toHaveLength(2);
  });

  it("folds legs won per side, not per seat", () => {
    const engine = new FiveOhOneEngine(duo(2));
    seatAWinsALeg(engine);
    const state = engine.state();

    expect(state.sides).toEqual([
      { sideKey: "A", legsWon: 1 },
      { sideKey: "B", legsWon: 0 },
    ]);
  });

  it("starts leg 2 with seat B and leg 3 with seat A", () => {
    const engine = new FiveOhOneEngine(duo(3));
    seatAWinsALeg(engine);
    expect(engine.state().activeParticipantRef).toBe("seat-b");

    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 101 });
    engine.record({ scoreAttempted: 101 });
    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(engine.state().activeParticipantRef).toBe("seat-a");
  });

  it("gives every turn a participantRef that is one of the seats", () => {
    const engine = new FiveOhOneEngine(duo(2));
    seatAWinsALeg(engine);

    const refs = new Set(TWO_SEATS.map((seat) => seat.participantRef));
    for (const turn of engine.facts().turns) {
      expect(refs.has(turn.participantRef)).toBe(true);
    }
  });

  it("numbers interleaved turns 1..N within the leg, not per seat", () => {
    const engine = new FiveOhOneEngine(duo());
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 60 });

    expect(engine.facts().turns.map((turn) => turn.sequence)).toEqual([
      1, 2, 3,
    ]);
  });

  it("wouldComplete is true only for the visit that takes a side to legsToWin", () => {
    const engine = new FiveOhOneEngine(duo(2));
    seatAWinsALeg(engine);
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 101 });
    engine.record({ scoreAttempted: 101 });

    expect(
      engine.wouldComplete({ scoreAttempted: 40, finishedOnDouble: true }),
    ).toBe(false);

    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 101 });
    expect(
      engine.wouldComplete({ scoreAttempted: 40, finishedOnDouble: true }),
    ).toBe(true);
  });

  it("undo across the seat boundary hands the turn back and restores facts exactly", () => {
    const engine = new FiveOhOneEngine(duo());
    engine.record({ scoreAttempted: 60 });
    const before = engine.facts();
    engine.record({ scoreAttempted: 100 });

    expect(engine.state().activeParticipantRef).toBe("seat-a");
    expect(engine.undo()).toBe(true);
    expect(engine.state().activeParticipantRef).toBe("seat-b");
    expect(engine.facts()).toEqual(before);
  });

  it("rehydrates a mid-leg three-seat log onto the same active seat", () => {
    const trio = {
      ...duo(),
      seats: [
        ...TWO_SEATS,
        {
          participantRef: "seat-c",
          displayName: "Jan",
          sideKey: "C",
          participantTypeKey: "GUEST" as const,
        },
      ],
    } satisfies Seated<FiveOhOneSnapshot>;

    const engine = new FiveOhOneEngine(trio);
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 60 });
    const expected = engine.state().activeParticipantRef;

    const resumed = new FiveOhOneEngine(trio, engine.facts());
    expect(resumed.state().activeParticipantRef).toBe(expected);
    expect(resumed.state()).toEqual(engine.state());
  });
});
```

- [ ] **Step 2: Run them and see which fail**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts`
Expected: most pass from Task 5's fold alone. The rotation cases ("starts leg 2 with seat B", "resets every seat") depend on `activeSeat` offsetting by the open stage's sequence, which Task 1 already implements — so a failure here means a real gap. Two known candidates:
- `openNewVisit`/`recordVisitTotal` stamping the wrong ref, if `deriveState()` is called after the turn is pushed rather than before.
- The `break` in `foldFiveOhOneState`'s inner loop discarding turns recorded after a leg was won inside the same stage — which cannot happen, because `record()` opens a new stage on a leg win.

- [ ] **Step 3: Fix whatever failed, minimally**

Change only `five-oh-one.engine.module.ts`, and only what a failing assertion names. Do not widen the diff.

- [ ] **Step 4: Run the whole suite and typecheck**

Run: `cd app && npm test && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics
git add app/src app/tests
git commit -m "feat(501): rotating multi-seat legs with per-side wins"
```

---

### Task 7: Owner-scoped dart views

Guest turns land in `turns` under a `GUEST` participant. `v_dart_analytics` and `v_dart_locations` both join `darts → turns → exercise_stages → exercise_sessions` and project `es.player_id` with no participant filter, so an opponent's darts would enter the owning player's accuracy statistics. Multiplayer is what makes that omission wrong, which is why it is in this plan rather than in `FINDINGS.md`.

`v_game_replay` deliberately keeps every participant — it projects `p.display_name` and exists to replay the session as it was played. Do not filter it.

**Files:**
- Create: `database/migrations/0023_owner_scoped_dart_views.sql`
- Modify: `docs/architecture/05-Database/06-Database-Specification.md` (view section)

**Interfaces:**
- Consumes: nothing from earlier tasks — this is independent of the app layer and can be reviewed on its own.
- Produces: no app-visible change. Both views keep every existing column and lose only rows belonging to a non-owning participant.

- [ ] **Step 1: Write the migration**

Create `database/migrations/0023_owner_scoped_dart_views.sql`, following the header convention of `0014` and `0018`:

```sql
-- ============================================================
-- Restrict v_dart_analytics and v_dart_locations to the
-- session owner's OWN participant.
--
-- Guest participants (participant_types GUEST) throw into the
-- same turns/darts tables as the owning player. Both views
-- project es.player_id, so before this migration a guest's
-- darts were counted as the owner's in every accuracy read.
--
-- Behaviour-preserving for every existing single-participant
-- session: those sessions have exactly one participant, and it
-- is the PLAYER whose player_id equals es.player_id.
--
-- v_game_replay is deliberately NOT filtered: it exists to
-- replay a session as it was played, participants included.
--
-- Never edits 0009/0013/0014/0018.
-- ============================================================

-- migrate:up
DROP VIEW IF EXISTS v_dart_analytics;
CREATE VIEW v_dart_analytics AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score,
    CASE
        WHEN d.intended_target_number = d.hit_target_number
        AND d.intended_zone_id = d.hit_zone_id THEN TRUE
        ELSE FALSE
    END AS exact_hit
FROM darts d
    JOIN turns t             ON t.id = d.turn_id
    JOIN participants p      ON p.id = t.participant_id
    JOIN exercise_stages st  ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt       ON gt.id = es.game_type_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
    LEFT JOIN dart_zones hit_zone      ON hit_zone.id = d.hit_zone_id
WHERE d.intended_target_number IS NOT NULL
    AND d.intended_zone_id IS NOT NULL
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_dart_analytics IS 'Dataset for dart accuracy analytics (session-scoped, owning player only).';

DROP VIEW IF EXISTS v_dart_locations;
CREATE VIEW v_dart_locations AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    im.implementation_key AS input_mode_key,
    st.id AS stage_id,
    t.sequence_number AS turn_sequence,
    t.total_score AS turn_total_score,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.score,
    d.location_x,
    d.location_y,
    SQRT(
        POWER(d.location_x, 2) + POWER(d.location_y, 2)
    ) AS radius_mm,
    MOD(
        DEGREES(
            ATAN2(d.location_x, - d.location_y)
        )::NUMERIC + 360,
        360
    ) AS angle_degrees
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
WHERE d.location_x IS NOT NULL
    AND d.location_y IS NOT NULL
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_dart_locations IS 'Per-dart landing coordinates for board heatmaps (owning player only).';

-- migrate:down
DROP VIEW IF EXISTS v_dart_analytics;
CREATE VIEW v_dart_analytics AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score,
    CASE
        WHEN d.intended_target_number = d.hit_target_number
        AND d.intended_zone_id = d.hit_zone_id THEN TRUE
        ELSE FALSE
    END AS exact_hit
FROM darts d
    JOIN turns t             ON t.id = d.turn_id
    JOIN exercise_stages st  ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt       ON gt.id = es.game_type_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
    LEFT JOIN dart_zones hit_zone      ON hit_zone.id = d.hit_zone_id
WHERE d.intended_target_number IS NOT NULL
    AND d.intended_zone_id IS NOT NULL;
COMMENT ON VIEW v_dart_analytics IS 'Dataset for dart accuracy analytics (session-scoped).';

DROP VIEW IF EXISTS v_dart_locations;
-- Restored verbatim from 0018's migrate:up region.
```

Finish the down region by pasting `0018_dart_location_read_model.sql`'s own `CREATE VIEW v_dart_locations` statement and its `COMMENT ON VIEW` line exactly as that file's `migrate:up` has them:

```bash
cd /home/user/dart-analytics && sed -n '/^-- migrate:up/,/^-- migrate:down/p' database/migrations/0018_dart_location_read_model.sql
```

Copy that output's `CREATE VIEW`/`COMMENT` statements into the down region, and use the same output to confirm the `migrate:up` block above matches `0018`'s real column list and `WHERE` clause — the two must differ only by the `participants` join and the `p.player_id = es.player_id` predicate. If `0018`'s filter differs from the one written above, `0018` wins.

- [ ] **Step 2: Apply and verify**

Run:

```bash
cd /home/user/dart-analytics/app && npm run db:migrate && npm run db:status
```

Expected: `0023_owner_scoped_dart_views` applied, no pending migrations.

Run:

```bash
cd /home/user/dart-analytics/app && npm run db:introspect
```

Expected: Drizzle metadata regenerated; commit whatever it changes.

- [ ] **Step 3: Verify the filter with a query**

Run:

```bash
cd /home/user/dart-analytics/app && npm run db:verify
```

Expected: PASS. If `scripts/verify-db.ts` enumerates views, add `v_dart_analytics`/`v_dart_locations` only if it already checks the others — do not extend its scope otherwise.

- [ ] **Step 4: Update the database spec**

In `docs/architecture/05-Database/06-Database-Specification.md` (and its `06-Spec/` read-model chapter if the view list lives there), amend the two views' descriptions to say they are scoped to the session's owning player, and state that `v_game_replay` is not. Minimal, targeted edit — do not regenerate the doc.

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics
git add database/migrations/0023_owner_scoped_dart_views.sql docs app/src/db
git commit -m "feat(db): scope dart accuracy views to the session owner"
```

---

### Task 8: Owner-scoped results, docs and context maintenance

The last behavioural gap plus everything the context system needs to stop being stale.

**Files:**
- Modify: `app/src/lib/game/five-oh-one-play.data.ts`
- Modify: `docs/architecture/04-Architecture-patterns.md`
- Modify: `docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md`
- Modify: `docs/architecture/06-API/04-Endpoint-Contracts.md`
- Modify: `docs/game-rules/rulesets/501.md`
- Modify: `decisions/game-engine.md`, `decisions/api.md`
- Test: `app/tests/lib/game/five-oh-one-play.data.test.ts`

**Interfaces:**
- Consumes: `SeatFact`, `$store.game.seats`, `FiveOhOneState`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test for owner-scoped results**

`computeStats` currently sums every turn in the log. With a guest in the session that is the wrong average and the wrong total: it mixes two throwers. Add to the `describe("uploadAndCompleteSession")` block in `app/tests/lib/game/five-oh-one-play.data.test.ts`, reusing the `makePlay` / `turnFact` / `quickPlayConfig` helpers that file already has (Task 3 gave `turnFact` a `participantRef` parameter and `quickPlayConfig` a `seats` array):

```ts
  it("summarises only the owning player's own visits", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 3, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      configSnapshot: {
        ...quickPlayConfig(),
        seats: [
          {
            participantRef: "seat-a",
            displayName: "Levi",
            sideKey: "A",
            participantTypeKey: "PLAYER",
          },
          {
            participantRef: "seat-b",
            displayName: "Dad",
            sideKey: "B",
            participantTypeKey: "GUEST",
          },
        ],
      },
      turns: [
        turnFact("t1", "leg-1", 1, 100, "seat-a"),
        turnFact("t2", "leg-1", 2, 40, "seat-b"),
        turnFact("t3", "leg-1", 3, 60, "seat-a"),
      ],
    });

    await play.uploadAndCompleteSession.call(play);

    expect(play.resultsSnapshot).toEqual({ total: 160, legs: 1, average: 80 });
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts`
Expected: FAIL — `total` is 200, `average` is ~66.7.

- [ ] **Step 3: Scope the results snapshot to the owner**

In `app/src/lib/game/five-oh-one-play.data.ts`, add a helper and use it in `uploadAndCompleteSession`:

```ts
/**
 * The seat the session belongs to — the one PLAYER participant. Guest visits
 * land in the same fact log, so a results summary that sums every turn mixes
 * two throwers into one average.
 */
function ownerRef(seats: readonly SeatFact[]): string | null {
  return (
    seats.find((seat) => seat.participantTypeKey === "PLAYER")
      ?.participantRef ?? null
  );
}
```

and in `uploadAndCompleteSession`, replace the `computeStats` call:

```ts
      const owner = ownerRef(this.$store.game.seats);
      this.resultsSnapshot = computeStats(
        owner === null
          ? this.$store.game.turns
          : this.$store.game.turns.filter(
              (turn) => turn.participantRef === owner,
            ),
        this.$store.game.configSnapshot!.legsToWin,
      );
```

The play-time stat row (`average()`, `previousScore()`, `dartsThrownThisLeg()`) is a different question and is deliberately left alone: on a pass-and-play device that row belongs to whoever is throwing, and deciding how it is presented for several seats is the drawing spec's job, not this plan's.

- [ ] **Step 4: Run the suite and typecheck**

Run: `cd app && npm test && npm run check`
Expected: PASS.

- [ ] **Step 5: Update Pattern 18**

In `docs/architecture/04-Architecture-patterns.md`, amend Pattern 18 — Game Engine Contract — with three targeted additions:
- the engine mints `participantRef` on every turn, exactly as it mints `clientKey`/`sequence`/`completedAt`;
- every engine declares `stageOwnership: "SHARED" | "PER_SEAT"` statically, and the shared `seat-rota.module.ts` derives the active seat from the fact log for both shapes;
- `record()` takes no seat: it applies to the derived active seat, so a caller cannot disagree with the engine, and `undo()` crosses the seat boundary with no seat logic of its own.

- [ ] **Step 6: Update the runtime-layer spec**

In `docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md`, record that a session's seats — participant ref, display name, side key, participant type — are written into `exercise_configurations.configuration` under `seats`, in seat order, in the same transaction as the participant rows; that seat order is stored while the active seat is always derived; and that seat entries are camelCase inside the otherwise snake_case configuration document, with the reason.

- [ ] **Step 7: Update the endpoint contract**

In `docs/architecture/06-API/04-Endpoint-Contracts.md`, document `participants?: { participantTypeKey, displayName?, sideKey }[]` on `POST /api/sessions`: array order is seat order; omitting it yields today's single-`PLAYER` session; the PLAYER's display name is server-copied; and list the `VALIDATION_FAILED` reasons from `rejectSeatRequest`. Note that the events batch endpoint is unchanged — refs simply now vary within one batch, which `validateBatchReferences` already allowed.

- [ ] **Step 8: Update the 501 ruleset doc**

In `docs/game-rules/rulesets/501.md`, replace the Multiplayer "TBD" row: 1–4 seats, one seat per side in v1, fixed seat order from setup, starting seat rotating over seats each leg, legs and match folded per side. Note bull-up as deferred.

- [ ] **Step 9: Append the decisions**

Append a new block to `decisions/game-engine.md` recording the seat layer: seats in the configuration snapshot rather than a new table; the active seat derived, never stored; `stageOwnership` as the reason composition (N single-seat sub-engines) was rejected; `sideKey` folding so 2v2 needs no state change.

Append a new block to `decisions/api.md` for the create contract, citing `Supersedes:` against D61 — "v1 session is single-participant; guest/DartBot deferred as additive `participants[]`" is now delivered exactly as that decision anticipated. Append, never edit D61 itself.

Check the next free decision id and the required front matter before writing:

```bash
cd /home/user/dart-analytics && cat DECISIONS.md | head -60 && bash scripts/check-decision-ids.sh
```

- [ ] **Step 10: Run context maintenance**

Invoke the `context-maintenance` skill and follow it in full: `docs/architecture/00-Context-Map.md` context packs and `00-File-Inventory.md` must list the new files (`seat-rota.module.ts`, `session-seats.service.ts`, migration `0023`, the two new test files), and every CLAUDE.md whose rules changed must be updated.

- [ ] **Step 11: Run every gate**

```bash
cd /home/user/dart-analytics
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
bash scripts/check-context-budget.sh
bash scripts/check-file-locations.sh
bash scripts/check-findings-log.sh
bash scripts/check-decision-ids.sh
bash scripts/check-game-engines.sh
bash scripts/check-game-wiring.sh
bash scripts/check-type-barrels.sh
bash scripts/check-alias-sync.sh
bash scripts/check-no-inline-comments.sh
bash scripts/check-constraint-mirror.sh
bash scripts/check-refinement-coverage.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-style-tokens.sh
```

Expected: every one prints OK. Fix anything that does not before committing.

- [ ] **Step 12: Format and validate**

```bash
cd /home/user/dart-analytics/app && npm run format && npm run format:check && npm run validate:app
```

Expected: format clean; `validate:app` green. Follow the `validate-app` skill if a step needs a database that is not reachable.

- [ ] **Step 13: Commit and push**

```bash
cd /home/user/dart-analytics
git add -A
git commit -m "docs: record the seat layer across specs, decisions and context map"
git push -u origin claude/guest-player-x01-architecture-m8ia8v
```

---

## Out of scope

Named so a later task does not rediscover them, and so a reviewer can tell a gap from a decision:

- **Setup, play and results drawing specs** — the frontend screens that let a player actually add a guest. This plan makes `participants[]` acceptable and multi-seat play correct; no UI sends more than one seat yet, so every session created by the existing screens is still solo. That is the next task, as sequenced.
- **2v2 pairing** — `sideKey` and per-side folding exist; the setup UI and the removal of the one-seat-per-side guard do not.
- **Bull-up** — deciding leg 1's starter by a throw at the bull. Darts thrown at a target belonging to no leg is a different capture problem.
- **Per-participant capture depth** — one side at analytics depth, the rest at visit-total depth. Requires moving `capture_mode_id` off the session, so it is a schema change and its own spec.
- **Reusable guest rosters** — named guests persisting across sessions. Additive: a new table plus a setup picker.
- **DartBot** — the seat layer accommodates it; nothing plays it, and setup rejects it.
- **Wiring the other eight engines for 1v1** — each already declares `PER_SEAT` and stamps seat 0. Each needs a `seats` array in its own `TState` and the removal of the ruleset guard in `rejectSeatRequest`. Mechanical once this lands.
