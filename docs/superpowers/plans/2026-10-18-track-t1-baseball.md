# Track T1.4 — Baseball Darts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Baseball Darts V1 as a playable standalone solo game on the Track kernel, end to end (engine, validator, capabilities, stats, play UI, seed, docs).

**Architecture:** A `DartGameSpec` bound to the game shell (`dart-engine-shell.module.ts`). Its `TrackRules`:

- path: the first nine `numbersPath()` targets (inning n aims at n);
- hit: `anyRingEitherBull` (the path has no bull, so the bull never hits);
- points: `pointsTable` (single 1, double 2, treble 3, else 0);
- onDart: `tallyRoundPoints(1)`, so `ext.roundTotals` is runs per inning;
- visitOpen: `closeAfter(3)`;
- onVisitClose: `advanceToEnd(8)`.

Kernel `score` is the run total, and `closedVisitTotal` persists each inning's runs as the turn's `totalScore`. The UI reuses Shanghai's pieces: `SeatedPlayScreen`, `SinglesRecreationalInput`, `VisitPreview` and `SinglePlayerSummary`, plus `TargetGrid`, which gains an optional `title` prop. Wiring follows Tactics (the last solo, empty-config game) file by file.

**Tech Stack:** TypeScript, Zod, Vitest, Astro + Alpine, PostgreSQL seeds, bash gates.

**Spec:** `docs/superpowers/specs/2026-10-17-track-wave-t1-design.md` (T1.4). Rules: `docs/game-rules/rulesets/baseball-darts.md`. Wiring reference: `docs/architecture/07-Frontend/09-Adding-A-Game.md`.

## Global Constraints

- **Branch:** `feat/track-t1-baseball` (from `origin/main`). Never merge to `main`; never use `--no-verify`.
- **TDD** per `app/CLAUDE.md` §TDD: write the failing test first and watch it fail, then write the code. Run commands from `app/` with `npm test -- <path>`.
- **Comments:** no `//` or `/* */` comments inside function bodies. JSDoc goes above declarations only and carries no decision history.
- **Quality gates:**
  - fallow complexity ≤ 15 and CRAP ≤ 30; no unused exports.
  - `npm run validate:app` exits 0 with the type gate at 0/0/0.
  - `validate:app`'s `db:drift` needs `app/.env`. Create it temporarily with `DATABASE_URL=postgres://postgres@localhost:5433/integration?sslmode=disable`, then delete it.
- **Type check:** run `npm run check` at the end of Tasks 2, 3 and 4. Task 1 adds `GameTypeKey` `BASEBALL`, so every `Record<GameTypeKey, …>` fails `check` until Task 2 fills it. Task 1 runs vitest only.
- **Imports:** a type import from outside `modules/game/` uses the `@modules/types` / `@lib/types` barrels, never a deep path (type-barrel gate).
- **Existing tests and snapshots are append-only.** An assertion that lists every key may gain `BASEBALL` / `BASEBALL_V1` by a ledgered ruling, and only when it keeps the same guarantee.
- **Wiring gate:** `check-game-wiring.sh` runs at pre-commit.
  - Task 1 leaves Baseball engine-only: registry key and validator, but no card, data files or pages.
  - Task 3 lands the card, both data files, both pages and both Alpine registrations in **one** commit.
- **Engine and validator** land in the same commit (`check-game-engines.sh`).
- **Migrations:** never modify `0001`–`0046`. This PR has no schema change.
- **Seed:** number `0041` (the highest on `main` is `0040`). Seed ids, none in use on `main`:
  - game type `0198f000-0000-7000-8000-00000000000c` (`BASEBALL`);
  - ruleset version `0198f100-0000-7000-8000-000000000018` (`BASEBALL_V1`);
  - configuration template `0198f300-0000-7000-8000-00000000001a` ("Baseball Darts — Nine Innings").
- **Capability rows** are appended to `seeds/0007` and to both lists in `verification/0007`, in Task 1 together with `capabilities.ts`, because `capability-seed-parity.test.ts` compares them.
- **Commits:** each ends with the trailer below. No model identifiers anywhere.

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```

  The hook can run past 120 s; give commits a 400000 ms timeout.
- **Decision id:** none planned. Re-run `bash scripts/next-decision-id.sh` before the PR anyway.
- **Discovered work** goes to a GitHub issue labelled `discovered-work`; never fix it in the same pass.

## Spec refinements (fold into the spec on approval)

1. **Stage.** The game shell builds one `EXERCISE_BLOCK` per seat (`stageOwnership: "PER_SEAT"`), as Shanghai and the rules file's Capture do. §5's "one `LEG` stage" is replaced by this.
2. **Visit close.** onVisitClose is `advanceToEnd(8)` alone. It already finishes the seat (`DONE`) on inning 9's close, so `doneOnWrap(8)` would never fire.
3. **Runs per inning.** ext is `{ roundTotals: number[9] }`, filled by the existing `tallyRoundPoints(1)` (one target per "round"). No new policy is needed. The readout `runsPerInning` is that array.
4. **Outcome.** V1 has one seat, so nothing is compared. The state reads `COMPLETE` after inning 9 with `winningSideKey: null`, as Tactics does. `scoreCompareWinner` arrives with Multiplayer (V2+).
5. **Keys.** The game and ruleset keys:
   - game type `BASEBALL`; ruleset `BASEBALL_V1`;
   - route slug and code slug `baseball`;
   - config: the empty strict object `{}` (every rule is locked);
   - preset: "Baseball Darts — Nine Innings".
6. **Modes and capabilities:**
   - mode pairs: `RECREATIONAL` + `DETAILED_DARTS` and `ANALYTICS` + `VISUAL_BOARD` (the rules file's Capture);
   - stats tags: `["board"]`;
   - no Dartbot (`RULESET_DARTBOT` has no entry);
   - no `SEAT_CAPS` entry, so the default cap of 1 seat applies.
7. **Intent.** None is stored (`NO_INTENT`), per the rules file. The validator is a plain `createThreeDartValidator`, as for Shanghai.
8. **Stats:**
   - `HEATMAP_ONLY_LAYOUTS` gains `BASEBALL_V1`;
   - `RESULT_DIRECTION.BASEBALL` is `"higher"`, since `counted_score` is the run total;
   - a replay presenter shows Inning, Runs and Total;
   - the session-progress card reads `Inning n of 9` with a RUNS headline;
   - the stats-world fixture gains a Baseball session.
9. **Card.** Group `CLASSICS`, after Around the Clock; title "Baseball Darts"; caption "Nine innings, runs by the ring."
10. **Results.** The modal shows Runs (hero), Accuracy and Best inning, then a "Runs per inning" `TargetGrid`. `TargetGrid` gains an optional `title` prop, defaulting to "Darts to close".

## Review Focus

1. **Off-number or bull darts.** A dart on another number, or on the bull, scores 0 runs and shows as a miss in the visit preview (Task 1 engine test; Task 3 preview test).
2. **Undo across an inning boundary.** Undoing the first dart of inning 2 restores inning 1's open visit, its runs and `runsPerInning` (Task 1).
3. **Resume mid-inning.** A reload replays the store's facts to the same inning, runs and preview (Task 3).
4. **After inning 9.** Recording is refused once inning 9 closes. `wouldComplete` is true only on inning 9's third dart (Task 1).
5. **Persisted totals and the visual board:**
   - each inning's persisted `turns.totalScore` equals its runs, and they sum to the total;
   - an inner and an outer single each score 1 run (`VISUAL_BOARD`) (Task 1).

## File map

| File | Task | Change |
| --- | --- | --- |
| `app/src/lib/game/rulesets/types.ts` | 1 | `BaseballConfig`, keys, `RULESET_CONFIGS`, `BaseballSnapshot`, `ConfigSnapshotFor` |
| `app/src/lib/game/rulesets/capabilities.ts` | 1 | mode pairs, stats tags, game type |
| `app/src/modules/game/types.ts` | 1 | `BaseballSeatState`, `BaseballState`, `BaseballTrackExt` |
| `app/src/modules/game/baseball.engine.module.ts` | 1 | new engine |
| `app/src/services/rulesets/baseball/baseball.validator.ts` | 1 | new validator |
| `app/src/services/rulesets/registry.ts` | 1 | `BASEBALL_V1` |
| `scripts/engine-kernels.txt` | 1 | TRACK / KERNEL_BOUND row |
| `database/seeds/0007_ruleset_version_capabilities.sql`, `database/verification/0007_capability_seed_checks.sql` | 1 | two triples each list |
| `app/src/lib/stats/{replay-presenters,section-registry,constants,replay-fold}.ts` | 2 | presenter, result direction, heatmap layout, engine import |
| `app/src/modules/game/session-progress.module.ts` | 2 | summarizer |
| `app/tests/integration/{statistics-sql.itest.ts,fixtures/stats-world.ts}` | 2 | `BASEBALL` key and fixture |
| `app/src/lib/game/types.ts` | 3 | setup/play contexts, results types |
| `app/src/lib/game/baseball-{setup,play}.data.ts` | 3 | controllers |
| `app/src/components/layout/games/{setup/BaseballSetupForm,interfaces/Baseball,result-modals/BaseballResults}.astro` | 3 | UI |
| `app/src/components/layout/games/TargetGrid.astro` | 3 | optional `title` |
| `app/src/pages/games/baseball/{setup,play}/index.astro` | 3 | pages |
| `app/src/lib/game/rulesets/games-visibility.ts`, `app/src/lib/client/alpine/register-route-data.ts` | 3 | card, Alpine |
| `database/seeds/0041_baseball_game_engine_reference.sql`, `database/verification/0041_baseball_capability_checks.sql`, `database/README.md` | 4 | seed |
| docs (see Task 5) | 5 | inventories, patterns, rules file |

---

### Task 1: Ruleset contract, engine, validator

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts`, `app/src/lib/game/rulesets/capabilities.ts`, `app/src/modules/game/types.ts`, `app/src/services/rulesets/registry.ts`, `scripts/engine-kernels.txt`, `database/seeds/0007_ruleset_version_capabilities.sql`, `database/verification/0007_capability_seed_checks.sql`
- Create: `app/src/modules/game/baseball.engine.module.ts`, `app/src/services/rulesets/baseball/baseball.validator.ts`
- Test: `app/tests/modules/game/baseball.engine.module.test.ts` (new), `app/tests/services/rulesets/baseball/baseball.validator.test.ts` (new), `app/tests/lib/game/rulesets/types.test.ts`, `app/tests/lib/game/rulesets/capabilities.test.ts`

**Interfaces:**
- Produces (lib): `BaseballConfig` (Zod), `BaseballSnapshot = Record<string, never>`, `RulesetVersionKey` gains `"BASEBALL_V1"`, `GameTypeKey` gains `"BASEBALL"`.
- Produces (modules/game/types): `BaseballSeatState`, `BaseballState`, `BaseballTrackExt`.
- Produces (engine): `BASEBALL_INNINGS = 9`, `initialBaseballState(config: Seated<BaseballSnapshot>): BaseballState`, `applyBaseballDart(state: BaseballSeatState, observation: DartObservation): BaseballSeatState`, `foldBaseballState(facts: EngineFacts, config: Seated<BaseballSnapshot>): BaseballState`, `BaseballEngine`, `baseballEngineFactory`.
- Produces (validator): `baseballValidator: RulesetValidator`.

- [ ] **Step 1: Write the failing config and capability tests**

Append to `app/tests/lib/game/rulesets/types.test.ts` (add `BaseballConfig` to its import from `@lib/game/rulesets/types` or wherever `TacticsConfig` is imported from):

```ts
describe("BaseballConfig", () => {
  it("registers BASEBALL_V1", () => {
    expect(RULESET_CONFIGS.BASEBALL_V1).toBe(BaseballConfig);
  });

  it("accepts only the empty object", () => {
    expect(BaseballConfig.safeParse({}).success).toBe(true);
    expect(BaseballConfig.safeParse({ innings: 9 }).success).toBe(false);
  });
});
```

In `app/tests/lib/game/rulesets/capabilities.test.ts`, the three key lists (≈ lines 20, 80 and 145) each gain `"BASEBALL_V1"` in alphabetical position: first in the sorted lists, ahead of `"BOBS27_V1"`; and in the `DETAILED_DARTS` `it.each` list, after `"TACTICS_V1"`. Ledger this as one ruling: an exhaustive list gains a key and keeps its guarantee. Append:

```ts
describe("BASEBALL_V1", () => {
  it("declares DETAILED_DARTS and VISUAL_BOARD, the board tag, game type BASEBALL, no Dartbot", () => {
    expect(RULESET_CAPABILITIES.BASEBALL_V1).toEqual([
      { captureModeKey: "RECREATIONAL", inputModeKey: "DETAILED_DARTS" },
      { captureModeKey: "ANALYTICS", inputModeKey: "VISUAL_BOARD" },
    ]);
    expect(STATS_TAGS.BASEBALL_V1).toEqual(["board"]);
    expect(GAME_TYPE_BY_RULESET.BASEBALL_V1).toBe("BASEBALL");
    expect(supportsDartbot("BASEBALL_V1")).toBe(false);
  });
});
```

(Import `STATS_TAGS`, `GAME_TYPE_BY_RULESET` and `supportsDartbot` alongside the file's existing imports from `@lib/game/rulesets/capabilities` if they are not already imported.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- tests/lib/game/rulesets/types.test.ts tests/lib/game/rulesets/capabilities.test.ts`
Expected: FAIL — `BaseballConfig` is undefined, and the `BASEBALL_V1` rows are missing.

- [ ] **Step 3: Implement the config and capabilities**

In `app/src/lib/game/rulesets/types.ts`:

- Below `TacticsConfig`:

  ```ts
  /** Baseball Darts V1 locks every rule (nine innings, runs by ring, solo seat) — nothing to configure. */
  export const BaseballConfig = z.object({}).strict();
  ```

- Append `| "BASEBALL_V1"` to `RulesetVersionKey` and `| "BASEBALL"` to `GameTypeKey`.
- Add `BASEBALL_V1: BaseballConfig,` to `RULESET_CONFIGS` after `TACTICS_V1`.
- Below `TacticsSnapshot`:

  ```ts
  /** Baseball Darts V1 has nothing to configure — no fields to carry. */
  export type BaseballSnapshot = Record<string, never>;
  ```

- In `ConfigSnapshotFor`, replace the final `: TacticsSnapshot;` with:

  ```ts
                                    : K extends "TACTICS_V1"
                                      ? TacticsSnapshot
                                      : BaseballSnapshot;
  ```

In `app/src/lib/game/rulesets/capabilities.ts`, add after each `TACTICS_V1` row:
- `RULESET_CAPABILITIES`: `BASEBALL_V1: [DETAILED_DARTS, VISUAL_BOARD],`
- `STATS_TAGS`: `BASEBALL_V1: ["board"],`
- `GAME_TYPE_BY_RULESET`: `BASEBALL_V1: "BASEBALL",`

`capability-seed-parity.test.ts` needs the seed lists to match. Append to the `VALUES` list in `database/seeds/0007_ruleset_version_capabilities.sql`, after the `TACTICS_V1` rows (moving the closing `)` and comma correctly):

```sql
            ('TACTICS_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('BASEBALL_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BASEBALL_V1', 'ANALYTICS', 'VISUAL_BOARD')
```

Do the same in **both** `VALUES` lists of `database/verification/0007_capability_seed_checks.sql` (≈ lines 123 and 244).

- [ ] **Step 4: Run them to verify they pass**

Run: `npm test -- tests/lib/game/rulesets/`
Expected: PASS. That includes `capability-seed-parity.test.ts`. `GAME_TYPE_BY_RULESET` makes `BASEBALL` a game type, and `Record<GameTypeKey, …>` consumers stay type-red until Task 2, which is expected.

- [ ] **Step 5: Write the failing engine test**

Create `app/tests/modules/game/baseball.engine.module.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  applyBaseballDart,
  BASEBALL_INNINGS,
  BaseballEngine,
  baseballEngineFactory,
  foldBaseballState,
  initialBaseballState,
} from "@modules/game/baseball.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type { DartObservation, DartZoneKey } from "@modules/types";
import type { BaseballSnapshot, Seated } from "@lib/types";

const config: Seated<BaseballSnapshot> = {
  seats: [
    {
      participantRef: "participant-1",
      displayName: "Levi",
      sideKey: "A",
      participantTypeKey: "PLAYER" as const,
    },
  ],
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartZoneKey,
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const S = (n: number) => dart(n, "SINGLE");
const D = (n: number) => dart(n, "DOUBLE");
const T = (n: number) => dart(n, "TREBLE");
const MISS = dart(null, "MISS");

function engineAfter(observations: DartObservation[]) {
  const engine = new BaseballEngine(config);
  for (const observation of observations) engine.record(observation);
  return engine;
}

function seat(engine: BaseballEngine) {
  return engine.state().seats[0];
}

function perfectGame(): DartObservation[] {
  return Array.from({ length: BASEBALL_INNINGS }, (_, i) => [
    T(i + 1),
    T(i + 1),
    T(i + 1),
  ]).flat();
}

describe("baseball engine", () => {
  it("registers BASEBALL_V1 on a per-seat stage", () => {
    expect(getEngineFactory("BASEBALL_V1")).toBe(baseballEngineFactory);
    expect(baseballEngineFactory.stageOwnership).toBe("PER_SEAT");
  });

  it("starts at inning 1 with no runs and nine empty innings", () => {
    expect(initialBaseballState(config)).toEqual({
      activeParticipantRef: "participant-1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          targetIndex: 0,
          runs: 0,
          runsPerInning: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          dartsThisVisit: 0,
          hitsThisVisit: 0,
          status: "IN_PROGRESS",
        },
      ],
    });
  });

  it("scores single 1, double 2, treble 3 on the inning's number", () => {
    const after = seat(engineAfter([S(1), D(1), T(1)]));
    expect(after.runs).toBe(6);
    expect(after.runsPerInning[0]).toBe(6);
    expect(after.targetIndex).toBe(1);
  });

  it("scores an inner and an outer single 1 run each", () => {
    const after = seat(
      engineAfter([dart(1, "INNER_SINGLE"), dart(1, "OUTER_SINGLE"), MISS]),
    );
    expect(after.runs).toBe(2);
  });

  it("scores nothing on another number or the bull", () => {
    const after = seat(
      engineAfter([T(20), dart(25, "INNER_BULL"), dart(25, "OUTER_BULL")]),
    );
    expect(after.runs).toBe(0);
    expect(after.runsPerInning).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(after.targetIndex).toBe(1);
  });

  it("counts inning 2's runs only on the 2", () => {
    const after = seat(engineAfter([MISS, MISS, MISS, T(1), D(2), S(2)]));
    expect(after.runsPerInning.slice(0, 2)).toEqual([0, 3]);
    expect(after.runs).toBe(3);
  });

  it("reaches 81 over a perfect game and completes after inning 9", () => {
    const engine = engineAfter(perfectGame());
    expect(seat(engine).runs).toBe(81);
    expect(seat(engine).runsPerInning).toEqual([9, 9, 9, 9, 9, 9, 9, 9, 9]);
    expect(engine.state().status).toBe("COMPLETE");
    expect(engine.isComplete()).toBe(true);
  });

  it("refuses a dart once inning 9 has closed", () => {
    const engine = engineAfter(perfectGame());
    expect(() => engine.record(T(9))).toThrow(/ended/);
  });

  it("would complete only on inning 9's third dart", () => {
    const darts = perfectGame();
    const early = engineAfter(darts.slice(0, 25));
    expect(early.wouldComplete(T(9))).toBe(false);
    const last = engineAfter(darts.slice(0, 26));
    expect(last.wouldComplete(MISS)).toBe(true);
  });

  it("persists each inning's runs as the turn total", () => {
    const engine = engineAfter([T(1), MISS, S(1), D(2), MISS, MISS]);
    const totals = engine.facts().turns.map((turn) => turn.totalScore);
    expect(totals).toEqual([4, 2]);
    expect(engine.facts().stages[0].stageTypeKey).toBe("EXERCISE_BLOCK");
  });

  it("undoes across an inning boundary back to the open visit", () => {
    const engine = engineAfter([T(1), S(1), MISS, D(2)]);
    expect(engine.undo()).toBe(true);
    const after = seat(engine);
    expect(after.targetIndex).toBe(1);
    expect(after.runs).toBe(4);
    expect(after.runsPerInning.slice(0, 2)).toEqual([4, 0]);
    expect(engine.undo()).toBe(true);
    const reopened = seat(engine);
    expect(reopened.targetIndex).toBe(0);
    expect(reopened.dartsThisVisit).toBe(2);
    expect(reopened.runs).toBe(4);
  });

  it("folds the same state from facts as the live engine", () => {
    const engine = engineAfter([T(1), S(1), MISS, D(2)]);
    expect(foldBaseballState(engine.facts(), config)).toEqual(engine.state());
  });

  it("applies one dart to a seat", () => {
    const start = initialBaseballState(config).seats[0];
    expect(applyBaseballDart(start, D(1))).toMatchObject({
      runs: 2,
      dartsThisVisit: 1,
      hitsThisVisit: 1,
    });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- tests/modules/game/baseball.engine.module.test.ts`
Expected: FAIL — cannot resolve `@modules/game/baseball.engine.module`.

- [ ] **Step 7: Add the types and the engine**

Append to `app/src/modules/game/types.ts`, after the `Shanghai*` types:

```ts
/**
 * One seat's Baseball Darts progress: `targetIndex` is the inning (0–8),
 * `runs` the total, `runsPerInning` one entry per inning.
 */
export type BaseballSeatState = SeatState & {
  targetIndex: number;
  runs: number;
  runsPerInning: number[];
  dartsThisVisit: number;
  hitsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

export type BaseballState = MultiSeatState<BaseballSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE";
  winningSideKey: string | null;
};

/** Baseball Darts' Track extras: runs per inning, one round per target. */
export type BaseballTrackExt = RoundTallyExt;
```

(`RoundTallyExt` is declared later in the same file; type aliases hoist.)

Create `app/src/modules/game/baseball.engine.module.ts`:

```ts
import type { BaseballSnapshot, Seated } from "@lib/types";
import { numbersPath } from "./board-progression.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { activeSeatState } from "./seat-state.module";
import { applyTrackDart, foldTrackSeats } from "./track-kernel.module";
import {
  advanceToEnd,
  anyRingEitherBull,
  closeAfter,
  pathTarget,
  pointsTable,
  tallyRoundPoints,
} from "./track-policies";
import type { DartGameSpec, TrackRules } from "./interfaces";
import type {
  BaseballSeatState,
  BaseballState,
  BaseballTrackExt,
  DartIntent,
  DartObservation,
  EngineFacts,
  SeatState,
  TrackSeat,
} from "./types";

/** Nine innings; inning n aims at number n. */
export const BASEBALL_INNINGS = 9;

const LAST_INNING_INDEX = BASEBALL_INNINGS - 1;

const PATH = numbersPath().slice(0, BASEBALL_INNINGS);

const GAME_ENDED =
  "Cannot record a dart once the game has ended; undo first to correct it.";

const NO_INTENT: DartIntent = {
  intendedTargetNumber: null,
  intendedZoneKey: null,
};

/**
 * Baseball Darts as Track policies: innings 1–9, runs by ring on the
 * inning's number (1/2/3), nothing elsewhere; three-dart visits, the seat
 * finishing on inning 9's close.
 */
const BASEBALL_RULES: TrackRules<BaseballTrackExt> = {
  doneMessage: GAME_ENDED,
  target: pathTarget<BaseballTrackExt>(PATH),
  hit: anyRingEitherBull,
  points: pointsTable({
    number: {
      SINGLE: 1,
      INNER_SINGLE: 1,
      OUTER_SINGLE: 1,
      DOUBLE: 2,
      TREBLE: 3,
    },
    bull: {},
  }),
  onDart: tallyRoundPoints<BaseballTrackExt>(1),
  visitOpen: closeAfter<BaseballTrackExt>(3),
  onVisitClose: advanceToEnd<BaseballTrackExt>(LAST_INNING_INDEX),
};

function emptyInnings(): BaseballTrackExt {
  return { roundTotals: Array.from({ length: BASEBALL_INNINGS }, () => 0) };
}

function initialSeatState(seat: SeatState): BaseballSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    runs: 0,
    runsPerInning: emptyInnings().roundTotals,
    dartsThisVisit: 0,
    hitsThisVisit: 0,
    status: "IN_PROGRESS",
  };
}

/** Baseball starting state: every seat at inning 1 with no runs. */
export function initialBaseballState(
  config: Seated<BaseballSnapshot>,
): BaseballState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

/** Lifts a Baseball seat into the kernel's shape: runs as the score, runs per inning as the extra. */
function toTrackSeat(state: BaseballSeatState): TrackSeat<BaseballTrackExt> {
  return {
    participantRef: state.participantRef,
    sideKey: state.sideKey,
    targetIndex: state.targetIndex,
    score: state.runs,
    dartsThisVisit: state.dartsThisVisit,
    hitsThisVisit: state.hitsThisVisit,
    status: state.status === "IN_PROGRESS" ? "IN_PROGRESS" : "DONE",
    ext: { roundTotals: state.runsPerInning },
  };
}

/** Projects a kernel seat back to Baseball's seat state. */
function toBaseballSeat(seat: TrackSeat<BaseballTrackExt>): BaseballSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: seat.targetIndex,
    runs: seat.score,
    runsPerInning: seat.ext.roundTotals,
    dartsThisVisit: seat.dartsThisVisit,
    hitsThisVisit: seat.hitsThisVisit,
    status: seat.status === "IN_PROGRESS" ? "IN_PROGRESS" : "COMPLETE",
  };
}

/**
 * Pure reducer, via the Track kernel: folds one dart onto one seat.
 * @throws when the seat has finished inning 9; undo first to correct it.
 */
export function applyBaseballDart(
  state: BaseballSeatState,
  observation: DartObservation,
): BaseballSeatState {
  return toBaseballSeat(
    applyTrackDart(toTrackSeat(state), observation, BASEBALL_RULES),
  );
}

/** Folds the fact log into the session's state; complete once every seat has closed inning 9. */
export function foldBaseballState(
  facts: EngineFacts,
  config: Seated<BaseballSnapshot>,
): BaseballState {
  const seats = foldTrackSeats(
    facts.turns,
    config.seats,
    emptyInnings,
    BASEBALL_RULES,
  ).map(toBaseballSeat);
  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status: seats.every((seat) => seat.status === "COMPLETE")
      ? "COMPLETE"
      : "IN_PROGRESS",
    winningSideKey: null,
    seats,
  };
}

/** A seat's runs in `state`; 0 for a participant not seated. */
function runsOf(state: BaseballState, participantRef: string): number {
  return (
    state.seats.find((seat) => seat.participantRef === participantRef)
      ?.runs ?? 0
  );
}

/** Whether the next dart is inning 9's third, which ends the game. */
function closesLastInning(state: BaseballState): boolean {
  if (state.status !== "IN_PROGRESS") return false;
  const seat = activeSeatState(state);
  return seat.targetIndex === LAST_INNING_INDEX && seat.dartsThisVisit === 2;
}

/**
 * Baseball Darts for the dart engine shell: three darts an inning, no
 * stored intent, and a closed visit persists the runs it scored.
 */
const baseballSpec: DartGameSpec<Seated<BaseballSnapshot>, BaseballState> = {
  rulesetVersionKey: "BASEBALL_V1",
  stageOwnership: "PER_SEAT",
  fold: foldBaseballState,
  refusal: (state) => (state.status === "IN_PROGRESS" ? null : GAME_ENDED),
  intent: () => NO_INTENT,
  isVisitOpen: (turn) => turn.darts.length < 3,
  wouldComplete: closesLastInning,
  closedVisitTotal: (opened, closed, participantRef) =>
    runsOf(closed, participantRef) - runsOf(opened, participantRef),
};

/** Baseball Darts engine (Pattern 18), built by the dart engine shell. */
export class BaseballEngine extends dartGameEngineClass(baseballSpec) {}

export const baseballEngineFactory = dartGameEngineFactory(
  baseballSpec,
  BaseballEngine,
);

registerEngineFactory(baseballEngineFactory);
```

If `initialSeatState`'s parameter type does not accept a `SeatFact`, use `SeatFact` from `@lib/types`, as Shanghai does. Ledger any such adjustment.

- [ ] **Step 8: Write the failing validator test**

Create `app/tests/services/rulesets/baseball/baseball.validator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { baseballValidator } from "@services/rulesets/baseball/baseball.validator";
import { getRulesetValidator } from "@services/rulesets/registry";
import type { DartFactInput } from "@routes/types";

const t1: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 1,
  hitZoneKey: "TREBLE",
  score: 3,
  locationX: null,
  locationY: null,
};

function batchWithTurns(darts: DartFactInput[][]) {
  return {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: darts.map((turnDarts, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore: 0,
          completedAt: null,
          darts: turnDarts,
        })),
      },
    ],
  };
}

describe("baseballValidator", () => {
  it("is registered for BASEBALL_V1", () => {
    expect(getRulesetValidator("BASEBALL_V1")).toBe(baseballValidator);
  });

  it.each([
    ["RECREATIONAL", "DETAILED_DARTS"],
    ["ANALYTICS", "VISUAL_BOARD"],
  ])("accepts %s + %s with {}", (captureModeKey, inputModeKey) => {
    expect(
      baseballValidator.validateConfig({
        config: {},
        captureModeKey,
        inputModeKey,
      }).valid,
    ).toBe(true);
  });

  it("rejects RECREATIONAL + QUICK_SCORE and any config key", () => {
    expect(
      baseballValidator.validateConfig({
        config: {},
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }).valid,
    ).toBe(false);
    expect(
      baseballValidator.validateConfig({
        config: { innings: 9 },
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      }).valid,
    ).toBe(false);
  });

  it("accepts a three-dart inning and rejects a dartless one", () => {
    const validate = (darts: DartFactInput[][]) =>
      baseballValidator.validateBatch({
        config: {},
        batch: batchWithTurns(darts),
        existingTurnCounts: {},
      });
    expect(
      validate([[t1, { ...t1, sequence: 2 }, { ...t1, sequence: 3 }]]).valid,
    ).toBe(true);
    expect(validate([[]]).valid).toBe(false);
  });
});
```

If `validateBatch`'s input type needs mode keys (compare `tactics.validator.test.ts`), copy that file's call shape exactly and ledger the change.

- [ ] **Step 9: Run it to verify it fails**

Run: `npm test -- tests/services/rulesets/baseball/`
Expected: FAIL — cannot resolve `@services/rulesets/baseball/baseball.validator`.

- [ ] **Step 10: Implement the validator, the registry entry and the kernel row**

Create `app/src/services/rulesets/baseball/baseball.validator.ts`:

```ts
import { BaseballConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/** Baseball Darts: the two mode pairs and nothing beyond the shared three-dart rules. */
export const baseballValidator: RulesetValidator = createThreeDartValidator({
  label: "Baseball Darts",
  configSchema: BaseballConfig,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Baseball Darts inning is exactly 3 darts, hit or miss, never a dartless total`,
});
```

In `app/src/services/rulesets/registry.ts`, import it as `import { baseballValidator } from "./baseball/baseball.validator";`, placed first in the import list, and add `BASEBALL_V1: baseballValidator,` after `TACTICS_V1`.

In `scripts/engine-kernels.txt`, insert this line after the `around-the-clock` row:

```
app/src/modules/game/baseball.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/rulesets/baseball-darts.md |
```

- [ ] **Step 11: Run the task's tests and the gates**

Run: `npm test -- tests/modules/game/baseball.engine.module.test.ts tests/services/rulesets/ tests/lib/game/rulesets/`
Expected: PASS.

Run (from the repo root): `bash scripts/check-game-engines.sh && bash scripts/check-engine-kernels.sh && bash scripts/check-game-wiring.sh`
Expected: all OK. Baseball is engine-only, with no card, data files or pages.

- [ ] **Step 12: Commit**

```bash
git add app/src/lib/game/rulesets/types.ts app/src/lib/game/rulesets/capabilities.ts app/src/modules/game/types.ts app/src/modules/game/baseball.engine.module.ts app/src/services/rulesets/baseball/ app/src/services/rulesets/registry.ts scripts/engine-kernels.txt database/seeds/0007_ruleset_version_capabilities.sql database/verification/0007_capability_seed_checks.sql app/tests/modules/game/baseball.engine.module.test.ts app/tests/services/rulesets/baseball/ app/tests/lib/game/rulesets/types.test.ts app/tests/lib/game/rulesets/capabilities.test.ts
git commit -m "feat(baseball): Baseball Darts engine on the Track kernel, validator, capabilities" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg"
```

---

### Task 2: Stats and progress

**Files:**
- Modify: `app/src/lib/stats/replay-presenters.ts`, `app/src/lib/stats/section-registry.ts`, `app/src/lib/stats/constants.ts`, `app/src/lib/stats/replay-fold.ts`, `app/src/modules/game/session-progress.module.ts`, `app/tests/integration/statistics-sql.itest.ts`, `app/tests/integration/fixtures/stats-world.ts`
- Test: `app/tests/lib/stats/replay-presenters.test.ts`, `app/tests/lib/stats/section-registry.test.ts`, `app/tests/lib/stats/constants.test.ts`, `app/tests/lib/stats/replay-games.ts`, `app/tests/modules/game/session-progress.module.test.ts`

**Interfaces:**
- Consumes: `BaseballSeatState`, `BASEBALL_INNINGS`, `foldBaseballState`, `initialBaseballState`, `BaseballEngine`, `baseballEngineFactory` (Task 1).
- Produces: `REPLAY_PRESENTERS.BASEBALL`, `RESULT_DIRECTION.BASEBALL = "higher"`, the `BASEBALL_V1` summarizer.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/lib/stats/replay-presenters.test.ts`, importing `BaseballEngine` and `initialBaseballState` from `@modules/game/baseball.engine.module`:

```ts
describe("REPLAY_PRESENTERS.BASEBALL", () => {
  const config = {
    seats: [
      {
        participantRef: "p1",
        displayName: "L",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
    ],
  };
  const on = (hitTargetNumber: number, hitZoneKey: "TREBLE" | "SINGLE") => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: null,
    locationY: null,
  });

  function twoInnings() {
    const engine = new BaseballEngine(config);
    for (const observation of [
      on(1, "TREBLE"),
      on(1, "SINGLE"),
      on(20, "TREBLE"),
      on(2, "SINGLE"),
      on(2, "SINGLE"),
      on(2, "SINGLE"),
    ])
      engine.record(observation);
    return engine;
  }

  it("shows the inning, its runs and the running total after each visit", () => {
    const engine = twoInnings();
    const [, second] = engine.facts().turns;
    const before = new BaseballEngine(config, {
      stages: engine.facts().stages,
      turns: engine.facts().turns.slice(0, 1),
    }).state();
    const cells = REPLAY_PRESENTERS.BASEBALL.turn(
      { turn: second, before, after: engine.state() },
      config,
    );
    expect(
      cells.map((cell) => (cell.kind === "value" ? cell.value : "")),
    ).toEqual(["2", "3", "7"]);
  });

  it("ends the session line on runs", () => {
    const engine = twoInnings();
    const [turn] = engine.facts().turns;
    const line = REPLAY_PRESENTERS.BASEBALL.session(
      [{ turn, before: initialBaseballState(config), after: engine.state() }],
      config,
    );
    expect(line.entries).toEqual([
      { participantId: "p1", label: "Runs", value: "7" },
    ]);
  });
});
```

Append to `app/tests/lib/stats/section-registry.test.ts`, inside the `describe` that holds the Tactics result-direction case (≈ line 372):

```ts
  it("gives Baseball the higher result direction and only the board tag", () => {
    expect(RESULT_DIRECTION.BASEBALL).toBe("higher");
    expect(tagsForGameType("BASEBALL")).toEqual(new Set(["board"]));
  });
```

In `app/tests/lib/stats/constants.test.ts`, add `"BASEBALL_V1"` to the `HEATMAP_ONLY_LAYOUTS` expected list (ruling: the list gains a key).

In `app/tests/lib/stats/replay-games.ts`:

- import `baseballEngineFactory` from `@modules/game/baseball.engine.module`;
- add this function before `SCRIPTED_GAMES`:

  ```ts
  /** Two Baseball innings: a treble and a single on 1, then a single on 2 between misses. */
  export function playBaseball(): ScriptedGame {
    return scripted(baseballEngineFactory, { seats: SOLO_SEATS }, [
      [dart(1, "TREBLE"), dart(1, "OUTER_SINGLE"), MISS],
      [MISS, dart(2, "OUTER_SINGLE"), dart(20, "TREBLE")],
    ]);
  }
  ```

- append `["Baseball", playBaseball],` to `SCRIPTED_GAMES`. Ledger it: an `it.each` table gains a game, and the fold guarantee is unchanged.

Append to `app/tests/modules/game/session-progress.module.test.ts`, importing `baseballEngineFactory` from `@modules/game/baseball.engine.module`. Reuse the file's existing solo `config` builder; if it has none, inline one with the same `SEATS` shape the Tactics case uses.

```ts
describe("summarizeProgress — BASEBALL_V1", () => {
  const config = {
    seats: [
      {
        participantRef: "p1",
        displayName: "L",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
    ],
  };

  it("reads inning 1 and no runs before a dart", () => {
    expect(summarizeProgress("BASEBALL_V1", config, EMPTY_FACTS)).toEqual({
      detail: "Inning 1 of 9",
      big: { value: "0", label: "RUNS" },
    });
  });

  it("reads the next inning and the runs after a visit", () => {
    const treble = {
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE" as const,
      locationX: null,
      locationY: null,
    };
    const facts = factsAfter(baseballEngineFactory, config, [
      treble,
      treble,
      treble,
    ]);
    expect(summarizeProgress("BASEBALL_V1", config, facts)).toEqual({
      detail: "Inning 2 of 9",
      big: { value: "9", label: "RUNS" },
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- tests/lib/stats/ tests/modules/game/session-progress.module.test.ts`
Expected: FAIL. `REPLAY_PRESENTERS.BASEBALL` is undefined, `RESULT_DIRECTION.BASEBALL` is undefined, the heatmap list differs, and `summarizeProgress` returns null. The Baseball `foldReplay` row may already pass, because `replay-games.ts` imports the engine itself.

- [ ] **Step 3: Implement**

`app/src/lib/stats/replay-presenters.ts`:

- import `BaseballSeatState` in the existing `@modules/types` type import;
- add before the `REPLAY_PRESENTERS` declaration:

  ```ts
  /**
   * Baseball Darts, read off the play page: the inning just played, the runs
   * it scored and the running total; the session line is the run total.
   */
  const BASEBALL: ReplayPresenter = {
    turn({ turn, before, after }) {
      const prior = seatIn<BaseballSeatState>(before, turn.participantRef);
      const seat = seatIn<BaseballSeatState>(after, turn.participantRef);
      return [
        valueCell("Inning", prior.targetIndex + 1),
        valueCell("Runs", seat.runs - prior.runs),
        valueCell("Total", seat.runs),
      ];
    },
    session: (steps) =>
      finalLine<BaseballSeatState>(steps, "Runs", (seat) => seat.runs),
  };
  ```

- add `BASEBALL,` to `REPLAY_PRESENTERS` after `TACTICS`.

`app/src/lib/stats/section-registry.ts`:

- add `BASEBALL: "higher",` to `RESULT_DIRECTION` after `TACTICS: null,`;
- add this row to its JSDoc table, after the Tactics row:

  `| Baseball Darts | the inning's runs (`closedVisitTotal` in `baseball.engine.module.ts`) | yes — the headline is the run total; higher is better |`

`app/src/lib/stats/constants.ts`: add `"BASEBALL_V1",` to `HEATMAP_ONLY_LAYOUTS` after `"TACTICS_V1"`.

`app/src/lib/stats/replay-fold.ts`: add `import "@modules/game/baseball.engine.module";` as the second line, after the around-the-clock import.

`app/src/modules/game/session-progress.module.ts`:

- import `{ BASEBALL_INNINGS, foldBaseballState }` from `@modules/game/baseball.engine.module`;
- add after `tactics`:

  ```ts
  function baseball(
    config: Parameters<typeof foldBaseballState>[1],
    facts: EngineFacts,
  ): SessionProgress {
    const seat = activeOf(foldBaseballState(facts, config));
    const inning = Math.min((seat?.targetIndex ?? 0) + 1, BASEBALL_INNINGS);
    return {
      detail: `Inning ${inning} of ${BASEBALL_INNINGS}`,
      big: big(seat?.runs, "RUNS"),
    };
  }
  ```

- add `BASEBALL_V1: baseball,` to `SUMMARIZERS` after `TACTICS_V1`.

`app/tests/integration/statistics-sql.itest.ts`: add `BASEBALL: true,` to `GAME_KEYS` after `TACTICS: true,`.

`app/tests/integration/fixtures/stats-world.ts`: add after the `TACTICS` fixture:

```ts
  BASEBALL: {
    rulesetVersionKey: "BASEBALL_V1",
    stageTypeKey: "EXERCISE_BLOCK",
    configuration: {},
    script: UNIVERSAL_SCRIPT,
  },
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npm test -- tests/lib/stats/ tests/modules/game/session-progress.module.test.ts tests/lib/stats/replay-fold.test.ts`
Expected: PASS.

Run: `npm run check`
Expected: 0 errors, 0 warnings, 0 hints.

The integration suite needs Postgres seeded with `BASEBALL_V1`, which only exists after Task 4. It runs in Task 4.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/stats/ app/src/modules/game/session-progress.module.ts app/tests/integration/statistics-sql.itest.ts app/tests/integration/fixtures/stats-world.ts app/tests/lib/stats/ app/tests/modules/game/session-progress.module.test.ts
git commit -m "feat(baseball): replay presenter, result direction, heatmap layout, progress card" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg"
```

---

### Task 3: Setup and play UI, card, Alpine wiring (one commit)

**Files:**
- Create: `app/src/lib/game/baseball-setup.data.ts`, `app/src/lib/game/baseball-play.data.ts`, `app/src/components/layout/games/setup/BaseballSetupForm.astro`, `app/src/components/layout/games/interfaces/Baseball.astro`, `app/src/components/layout/games/result-modals/BaseballResults.astro`, `app/src/pages/games/baseball/setup/index.astro`, `app/src/pages/games/baseball/play/index.astro`
- Modify: `app/src/lib/game/types.ts`, `app/src/components/layout/games/TargetGrid.astro`, `app/src/lib/game/rulesets/games-visibility.ts`, `app/src/lib/client/alpine/register-route-data.ts`
- Test: `app/tests/lib/game/baseball-setup.data.test.ts` (new), `app/tests/lib/game/baseball-play.data.test.ts` (new), `app/tests/lib/game/rulesets/games-visibility.test.ts`, `app/tests/lib/client/alpine/register-route-data.test.ts`

**Interfaces:**
- Consumes: `BaseballEngine`, `foldBaseballState`, `applyBaseballDart`, `initialBaseballState`, `BASEBALL_INNINGS`, `baseballEngineFactory` (Task 1).
- Produces: `baseballSetup()`, `baseballPlay()`, `baseballSeatResult(seat: BaseballSeatState, turns: readonly TurnFact[]): BaseballSeatResult`; types `BaseballSetupContext`, `BaseballSeatResult`, `BaseballResultsSnapshot`, `BaseballPlayContext`.

- [ ] **Step 1: Write the failing setup test**

Create `app/tests/lib/game/baseball-setup.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { baseballSetup } from "@lib/game/baseball-setup.data";
import type { BaseballSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const PRESET = {
  configurationTemplateId: "tmpl-baseball",
  gameTypeKey: "BASEBALL",
  name: "Baseball Darts — Nine Innings",
  description: null,
  configuration: {},
  isSystemTemplate: true,
} as any;

describe("baseballSetup", () => {
  let store: BaseballSetupContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      game: { sessionId: null, reset: vi.fn(), startSession: vi.fn() },
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    };
  });

  function createSetup(
    overrides: Partial<BaseballSetupContext> = {},
  ): BaseballSetupContext {
    return { ...baseballSetup(), $store: store, ...overrides } as BaseballSetupContext;
  }

  it("loads the BASEBALL presets", async () => {
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([PRESET]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
    const setup = createSetup();
    await setup.init();
    expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith(
      "BASEBALL",
    );
    expect(setup.presets).toEqual([PRESET]);
  });

  it("starts BASEBALL_V1 from the seeded preset and opens the play page", async () => {
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "new-session-id",
      participants: [
        { ref: "participant-1", displayName: "Player", participantTypeKey: "PLAYER" },
      ],
    } as any);
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    const setup = createSetup({ presets: [PRESET] });

    await setup.start();

    expect(sessionsApi.createSession).toHaveBeenCalledWith({
      gameTypeKey: "BASEBALL",
      rulesetVersionKey: "BASEBALL_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
      config: { source: "template", templateRef: "tmpl-baseball" },
    });
    expect(locationSpy.href).toBe("/games/baseball/play");
  });
});
```

- [ ] **Step 2: Write the failing play test**

Create `app/tests/lib/game/baseball-play.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/sessions", () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
  createSession: vi.fn(),
}));

import { fetchActiveSessions } from "@client/api/sessions";
import {
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import { baseballEngineFactory } from "@modules/game/baseball.engine.module";
import { baseballPlay, baseballSeatResult } from "@lib/game/baseball-play.data";
import type { BaseballPlayContext, BaseballSnapshot, Seated } from "@lib/types";
import type { StageFact, TurnFact } from "@modules/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "BASEBALL",
  gameTypeName: "Baseball Darts",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "BASEBALL_V1",
  isRoutineStep: false,
  progress: null,
  startedAt: "now",
} as const;

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

type GameStub = BaseballPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "BASEBALL_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: { seats: SEATS } as Seated<BaseballSnapshot>,
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
    stages: [STAGE],
    turns: [] as TurnFact[],
    idempotencyKey: null,
    loading: false,
    setSessionModes: vi.fn(),
    recordFacts: vi.fn(function (this: GameStub, facts) {
      this.stages = [...facts.stages];
      this.turns = [...facts.turns];
    }),
    reset: vi.fn(function (this: GameStub) {
      this.loading = false;
    }),
    ...overrides,
  };
}

function makeContext(gameOverrides: Partial<GameStub> = {}) {
  return {
    ...baseballPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    },
  } as BaseballPlayContext;
}

async function started(gameOverrides: Partial<GameStub> = {}) {
  const ctx = makeContext(gameOverrides);
  await ctx.init.call(ctx);
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(baseballEngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
});

describe("baseballPlay", () => {
  it("records S/D/T taps on the inning's number as runs", async () => {
    const ctx = await started();
    await ctx.recordTap("SINGLE");
    await ctx.recordTap("DOUBLE");
    await ctx.recordTap("TREBLE");
    expect(ctx.currentScore()).toBe("6");
    expect(ctx.currentTargetLabel()).toBe("2");
    expect(ctx.inningLabel()).toBe("2/9");
    const [written] = ctx.$store.game.turns[0].darts;
    expect(written.hitTargetNumber).toBe(1);
    expect(written.hitZoneKey).toBe("SINGLE");
  });

  it("counts MISS as a dart with no runs and no number", async () => {
    const ctx = await started();
    await ctx.recordTap("MISS");
    expect(ctx.currentScore()).toBe("0");
    expect(ctx.$store.game.turns[0].darts[0].hitTargetNumber).toBeNull();
  });

  it("marks darts off the inning's number as misses in the preview", async () => {
    const ctx = await started();
    await ctx.recordTap("TREBLE");
    await ctx.recordDart({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    expect(ctx.previewSegments().map((segment) => segment.status)).toEqual([
      "hit",
      "miss",
      "empty",
    ]);
  });

  it("never offers the bull keys", async () => {
    const ctx = await started();
    expect(ctx.isBullVisit()).toBe(false);
  });

  it("resumes mid-inning from the store's facts", async () => {
    const first = await started();
    await first.recordTap("TREBLE");
    await first.recordTap("TREBLE");
    await first.recordTap("TREBLE");
    await first.recordTap("DOUBLE");
    const resumed = await started({ turns: first.$store.game.turns });
    expect(resumed.currentScore()).toBe("11");
    expect(resumed.inningLabel()).toBe("2/9");
    expect(resumed.previewSegments().map((segment) => segment.status)).toEqual([
      "hit",
      "empty",
      "empty",
    ]);
  });

  it("reads the inning in the subtitle; blank before config loads", () => {
    expect(makeContext().subtitle()).toBe("INNING 1 OF 9");
    const empty = makeContext({ configSnapshot: null });
    expect(empty.subtitle()).toBe("");
  });

  it("builds results with runs, accuracy, best inning and runs per inning", () => {
    const turns: TurnFact[] = [
      turnOf("t1", [
        [1, "TREBLE"],
        [1, "SINGLE"],
        [20, "TREBLE"],
      ]),
      turnOf("t2", [
        [2, "DOUBLE"],
        [null, "MISS"],
        [2, "SINGLE"],
      ]),
    ];
    const seat = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 2,
      runs: 7,
      runsPerInning: [4, 3, 0, 0, 0, 0, 0, 0, 0],
      dartsThisVisit: 0,
      hitsThisVisit: 0,
      status: "IN_PROGRESS" as const,
    };
    expect(baseballSeatResult(seat, turns)).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      runs: 7,
      accuracy: "66.67%",
      bestInning: 1,
      runsPerInning: [4, 3, 0, 0, 0, 0, 0, 0, 0],
    });
  });
});

function turnOf(
  clientKey: string,
  darts: [number | null, "TREBLE" | "DOUBLE" | "SINGLE" | "MISS"][],
): TurnFact {
  return {
    clientKey,
    stageClientKey: "block-1",
    participantRef: "participant-1",
    sequence: Number(clientKey.slice(1)),
    totalScore: 0,
    completedAt: "now",
    darts: darts.map(([hitTargetNumber, hitZoneKey], i) => ({
      sequence: i + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber,
      hitZoneKey,
      score: 0,
      locationX: null,
      locationY: null,
    })),
  } as TurnFact;
}
```

Ruling hooks:
- `accuracyDisplay(4, 6)` is `"66.67%"` (two decimals).
- If `TurnFact`/`DartFact` field names differ, match `app/src/modules/game/types.ts` and ledger it.

- [ ] **Step 3: Extend the shared tests (failing)**

`app/tests/lib/game/rulesets/games-visibility.test.ts` (ruling: lists gain the new card):
- recreational list: append `"BASEBALL_V1"` after `"AROUND_THE_CLOCK_V1"`;
- analytics list: add `"BASEBALL_V1"`;
- groups: the `CLASSICS` row becomes `["SHANGHAI_V1", "AROUND_THE_CLOCK_V1", "BASEBALL_V1"]`.

`app/tests/lib/client/alpine/register-route-data.test.ts`: import `baseballSetup` / `baseballPlay` and add `["baseballSetup", baseballSetup], ["baseballPlay", baseballPlay],` to the `it.each` table.

- [ ] **Step 4: Run them to verify they fail**

Run: `npm test -- tests/lib/game/baseball-setup.data.test.ts tests/lib/game/baseball-play.data.test.ts tests/lib/game/rulesets/games-visibility.test.ts tests/lib/client/alpine/register-route-data.test.ts`
Expected: FAIL — the modules do not resolve, and the card and registrations are missing.

- [ ] **Step 5: Add the types**

In `app/src/lib/game/types.ts`:
- add `import type { BaseballEngine } from "@modules/game/baseball.engine.module";` beside the Tactics engine import;
- add `BaseballState` to the `@modules/types` type import;
- add `BaseballSnapshot` to the snapshot type import.

Then append after the Tactics play context:

```ts
export type BaseballSetupContext = PresetSetupContext;

/** One seat's results: total runs, hits on the inning's number over darts thrown, the best inning (1-indexed, null with no runs) and runs per inning. */
export type BaseballSeatResult = {
  participantRef: string;
  sideKey: string;
  runs: number;
  accuracy: string;
  bestInning: number | null;
  runsPerInning: number[];
};

export type BaseballResultsSnapshot = {
  status: "COMPLETE";
  winningSideKey: null;
  seats: BaseballSeatResult[];
};

export type BaseballPlayContext = PlayLifecycleContext<
  BaseballSnapshot,
  BaseballEngine,
  BaseballResultsSnapshot
> & {
  visitMarkers(this: BaseballPlayContext): BoardMarker[];
  recordDart(
    this: BaseballPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  state(this: BaseballPlayContext): BaseballState | null;
  subtitle(this: BaseballPlayContext): string;
  currentTargetLabelFor(this: BaseballPlayContext, seatRef: string): string;
  currentTargetLabel(this: BaseballPlayContext): string;
  inningLabelFor(this: BaseballPlayContext, seatRef: string): string;
  inningLabel(this: BaseballPlayContext): string;
  currentScoreFor(this: BaseballPlayContext, seatRef: string): string;
  currentScore(this: BaseballPlayContext): string;
  isBullVisit(this: BaseballPlayContext): boolean;
  previewSegments(this: BaseballPlayContext): GamePreviewSegment[];
  init(this: BaseballPlayContext): Promise<void>;
  retryReconciliation(this: BaseballPlayContext): Promise<void>;
  recordTap(
    this: BaseballPlayContext,
    ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
  ): Promise<void>;
  commitDart(
    this: BaseballPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: BaseballPlayContext): Promise<void>;
  uploadAndCompleteSession(this: BaseballPlayContext): Promise<void>;
  resultsTitle(this: BaseballPlayContext): string;
  back(this: BaseballPlayContext): Promise<void>;
  playAgain(this: BaseballPlayContext): Promise<void>;
  abandonAndExit(this: BaseballPlayContext): Promise<void>;
};
```

`GamePreviewSegment`, `BoardMarker` and `DartObservation` are already in scope in that file; check, and import any that are missing.

- [ ] **Step 6: Implement the controllers**

Create `app/src/lib/game/baseball-setup.data.ts`:

```ts
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { BaseballSetupContext } from "./types";

export function baseballSetup() {
  return createPresetSetupController<BaseballSetupContext>({
    gameTypeKey: "BASEBALL",
    rulesetVersionKey: "BASEBALL_V1",
    playHref: "/games/baseball/play",
    label: "Baseball Darts",
  });
}
```

Create `app/src/lib/game/baseball-play.data.ts`:

```ts
import { getEngineFactory } from "@modules/game/engine.registry";
import { boardInputData } from "@lib/game/board-input.data";
import { accuracyDisplay } from "@lib/game/play-visit-stats";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playPreviewSegments,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import type { RulesetVersionKey } from "@lib/types";
import type {
  BaseballSeatState,
  BaseballState,
  DartObservation,
  TurnFact,
} from "@modules/types";
import type {
  BaseballPlayContext,
  BaseballResultsSnapshot,
  BaseballSeatResult,
  BoardMarker,
  GamePreviewSegment,
} from "./types";
import {
  BASEBALL_INNINGS,
  BaseballEngine,
  foldBaseballState,
} from "@modules/game/baseball.engine.module";

const GAME_TYPE_KEY = "BASEBALL";
const RULESET_VERSION_KEY: RulesetVersionKey = "BASEBALL_V1";

/** The 1-indexed inning a seat is on, capped at 9 once the game ends. */
function inningOf(seat: BaseballSeatState): number {
  return Math.min(seat.targetIndex + 1, BASEBALL_INNINGS);
}

/** One seat's results, its accuracy replayed from its own darts: dart i was thrown in inning floor(i / 3) + 1. */
export function baseballSeatResult(
  seat: BaseballSeatState,
  turns: readonly TurnFact[],
): BaseballSeatResult {
  const darts = turns
    .filter((turn) => turn.participantRef === seat.participantRef)
    .flatMap((turn) => turn.darts);
  const hits = darts.filter(
    (dart, index) => dart.hitTargetNumber === Math.floor(index / 3) + 1,
  ).length;
  const best = Math.max(...seat.runsPerInning);
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    runs: seat.runs,
    accuracy: accuracyDisplay(hits, darts.length),
    bestInning: best > 0 ? seat.runsPerInning.indexOf(best) + 1 : null,
    runsPerInning: [...seat.runsPerInning],
  };
}

/** Rebuilds the engine for the persisted session from the store's fact log. */
function resumeEngine(
  game: BaseballPlayContext["$store"]["game"],
): BaseballEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof BaseballEngine ? engine : null;
}

/** A seat in the folded state by ref. */
function seatOf(
  context: BaseballPlayContext,
  seatRef: string,
): BaseballSeatState | undefined {
  return context
    .state()
    ?.seats.find((candidate) => candidate.participantRef === seatRef);
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach
 * this page's own `recordDart` with the live, reactive `this`.
 */
export function baseballPlay() {
  let self: BaseballPlayContext;

  return {
    loading: false,
    error: "",
    finished: false,
    hasActiveSession: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    completionStatus: "pending" as
      "pending" | "saving" | "succeeded" | "failed",
    completionError: "",
    playAgainError: "",
    playAgainLoading: false,
    resultsSnapshot: null as BaseballResultsSnapshot | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as BaseballEngine | null,
    ...boardInputData(
      (observation) => self.recordDart(observation),
      () => self.$store.game.turns,
    ),

    state(this: BaseballPlayContext): BaseballState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldBaseballState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    /** Play-header subtitle: `INNING 3 OF 9`; blank before config loads. */
    subtitle(this: BaseballPlayContext): string {
      const state = this.state();
      const seat = state && seatOf(this, state.activeParticipantRef);
      return seat ? `INNING ${inningOf(seat)} OF ${BASEBALL_INNINGS}` : "";
    },

    currentTargetLabelFor(this: BaseballPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? String(inningOf(seat)) : "";
    },

    currentTargetLabel(this: BaseballPlayContext): string {
      const state = this.state();
      return state ? this.currentTargetLabelFor(state.activeParticipantRef) : "";
    },

    inningLabelFor(this: BaseballPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? `${inningOf(seat)}/${BASEBALL_INNINGS}` : "";
    },

    inningLabel(this: BaseballPlayContext): string {
      const state = this.state();
      return state ? this.inningLabelFor(state.activeParticipantRef) : "";
    },

    currentScoreFor(this: BaseballPlayContext, seatRef: string): string {
      const seat = seatOf(this, seatRef);
      return seat ? String(seat.runs) : "";
    },

    currentScore(this: BaseballPlayContext): string {
      const state = this.state();
      return state ? this.currentScoreFor(state.activeParticipantRef) : "";
    },

    isBullVisit(): boolean {
      return false;
    },

    /** The open (or last) visit's darts against its own inning's number. */
    previewSegments(this: BaseballPlayContext): GamePreviewSegment[] {
      const turns = this.$store.game.turns;
      const inning = turns.length;
      return playPreviewSegments(turns, this.hiddenTurnKey, (dart) =>
        dart.hitTargetNumber === inning ? "hit" : "miss",
      );
    },

    async init(this: BaseballPlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, resumeEngine);
    },

    retryReconciliation(this: BaseballPlayContext) {
      return playRetryReconciliation(this);
    },

    /** The recreational tap: S/D/T on the inning's number, or MISS. */
    async recordTap(
      this: BaseballPlayContext,
      ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
    ) {
      const state = this.state();
      if (!this.engine || !state) return;
      const inning = Number(
        this.currentTargetLabelFor(state.activeParticipantRef),
      );
      await this.commitDart({
        hitTargetNumber: ring === "MISS" ? null : inning,
        hitZoneKey: ring,
        locationX: null,
        locationY: null,
      });
    },

    async recordDart(this: BaseballPlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    async commitDart(this: BaseballPlayContext, observation: DartObservation) {
      await playCommitDart(this, observation);
    },

    /** Overrides `boardInputData`'s own `visitMarkers` with the shared play-lifecycle one. */
    visitMarkers(this: BaseballPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    async undoVisit(this: BaseballPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: BaseballPlayContext): Promise<void> {
      const turns = this.$store.game.turns;
      return playUploadAndCompleteSession(this, (finalState) => ({
        status: "COMPLETE",
        winningSideKey: null,
        seats: finalState.seats.map((seat) => baseballSeatResult(seat, turns)),
      }));
    },

    resultsTitle(): string {
      return "Nine innings played";
    },

    back(this: BaseballPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: BaseballPlayContext) {
      return playAbandonAndExit(this);
    },

    /** Replays the same preset with no overrides — V1 has nothing to set. */
    playAgain(this: BaseballPlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof BaseballEngine ? engine : null,
      );
    },
  };
}
```

`previewSegments` uses `turns.length` as the inning. That is the 1-indexed inning of the last turn, and it holds because V1 is one seat. The resume test pins it.

- [ ] **Step 7: Add the components, pages, card and Alpine registrations**

`app/src/components/layout/games/TargetGrid.astro`: add an optional `title` prop, defaulting to "Darts to close", and render it instead of the literal. Add `@param {string} [title] Heading; default "Darts to close"` to the JSDoc, then:

```astro
interface Props {
  labels: readonly string[];
  valuesExpr: string;
  cols: 3 | 4;
  title?: string;
}

// Props
const { labels, valuesExpr, cols, title = "Darts to close" }: Props =
  Astro.props;
```

and replace the `Darts to close` text node with `{title}`.

Create `app/src/components/layout/games/setup/BaseballSetupForm.astro`:

```astro
---
// Components
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import UserSection from "./UserSection.astro";

// Data
const infoSection = {
  title: "Baseball Darts rules",
  description:
    "Nine innings, three darts each. Inning 1 aims at the 1, inning 9 at the 9. On the inning's number a single scores 1 run, a double 2, a treble 3; any other number or the bull scores nothing. Most runs wins — 81 is a perfect game. Solo practice, locked rules.",
};
---

<SetupShell title="Baseball Darts">
  <UserSection />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
    open
  />
</SetupShell>
```

Create `app/src/components/layout/games/interfaces/Baseball.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SeatedPlayScreen from "@components/layout/games/SeatedPlayScreen.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import SinglesRecreationalInput from "@components/layout/games/SinglesRecreationalInput.astro";
---

<SeatedPlayScreen
  big={{ isTarget: false, value: (c) => c("currentScore") }}
  tiles={[
    { label: "Inning", value: (c) => c("inningLabel") },
    { label: "Target", value: (c) => c("currentTargetLabel") },
  ]}
  idle={{ label: "Target", value: (c) => c("currentTargetLabel") }}
  {...props}
>
  <VisitPreview />

  <SinglesRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
</SeatedPlayScreen>
```

Create `app/src/components/layout/games/result-modals/BaseballResults.astro`:

```astro
---
import ResultsModalShell from "@components/layout/games/ResultsModalShell.astro";
import SinglePlayerSummary from "@components/layout/games/SinglePlayerSummary.astro";
import TargetGrid from "@components/layout/games/TargetGrid.astro";

const STAT_ROWS = [
  { label: "Runs", key: "runs", hero: true, skeletonWidth: "w-30" },
  { label: "Accuracy", key: "accuracy", side: true, skeletonWidth: "w-11" },
  {
    label: "Best inning",
    key: "bestInning",
    side: true,
    skeletonWidth: "w-6",
    fallback: "–",
  },
] as const;

const INNING_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
---

<ResultsModalShell overline="Baseball Darts · Solo summary">
  <h2
    slot="title"
    id="results-title"
    class="text-balance font-display text-xl text-foreground"
    x-text="resultsTitle()"
  >
  </h2>

  <SinglePlayerSummary statRows={STAT_ROWS}>
    <TargetGrid
      title="Runs per inning"
      labels={INNING_LABELS}
      valuesExpr="resultsSnapshot?.seats?.[0]?.runsPerInning"
      cols={3}
    />
  </SinglePlayerSummary>
</ResultsModalShell>
```

If `SinglePlayerSummary` does not apply `fallback` to a null value, drop `fallback` and ledger it; the grid already dashes nulls.

Create `app/src/pages/games/baseball/setup/index.astro`:

```astro
---
export const prerender = true;
import GameSetupPage from "@components/layout/games/setup/GameSetupPage.astro";
import BaseballSetupForm from "@components/layout/games/setup/BaseballSetupForm.astro";
---

<GameSetupPage
  title="Baseball Darts"
  x-data="baseballSetup()"
>
  <BaseballSetupForm />
</GameSetupPage>
```

Create `app/src/pages/games/baseball/play/index.astro`:

```astro
---
export const prerender = true;
import GameLayout from "@layouts/GameLayout.astro";
import Baseball from "@components/layout/games/interfaces/Baseball.astro";
import BaseballResults from "@components/layout/games/result-modals/BaseballResults.astro";
import NoSessionPanel from "@components/layout/games/NoSessionPanel.astro";
import ReconciliationBlocked from "@components/layout/games/ReconciliationBlocked.astro";
---

<GameLayout
  title="Baseball Darts — Play"
  gameTitle="Baseball Darts"
  gameSubtitleExpr="hasActiveSession ? subtitle() : ''"
  x-data="baseballPlay()"
  @confirm-exit.window="abandonAndExit()"
>
  <div class="flex flex-col flex-1 min-h-0">
    {/* Loading / reconciliation-blocked */}
    <ReconciliationBlocked />

    {/* No active session view */}
    <NoSessionPanel href="/games/baseball/setup" />

    {/* Gameplay view */}
    <Baseball
      x-show="!finished && hasActiveSession"
      x-cloak
    />

    {/* Results modal (overlay) */}
    <BaseballResults />
  </div>
</GameLayout>
```

`app/src/lib/game/rulesets/games-visibility.ts`: append to `GAME_CARDS` after Around the Clock:

```ts
  {
    rulesetVersionKey: "BASEBALL_V1",
    group: "CLASSICS",
    href: "/games/baseball/setup",
    title: "Baseball Darts",
    caption: "Nine innings, runs by the ring.",
  },
```

`app/src/lib/client/alpine/register-route-data.ts`: import `baseballSetup` from `@lib/game/baseball-setup.data` and `baseballPlay` from `@lib/game/baseball-play.data`, then register both next to the Tactics pair:

```ts
  Alpine.data("baseballSetup", baseballSetup);
  Alpine.data("baseballPlay", baseballPlay);
```

- [ ] **Step 8: Run the tests, the type check and the gates**

Run: `npm test -- tests/lib/game/ tests/lib/client/alpine/register-route-data.test.ts`
Expected: PASS.

Run: `npm run check`
Expected: 0 errors, 0 warnings, 0 hints.

Run (from the repo root): `bash scripts/check-game-wiring.sh && bash scripts/check-game-engines.sh && bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh && bash scripts/check-no-inline-comments.sh`
Expected: all OK.

- [ ] **Step 9: Commit (the whole touch list at once)**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/baseball-setup.data.ts app/src/lib/game/baseball-play.data.ts app/src/components/layout/games/TargetGrid.astro app/src/components/layout/games/setup/BaseballSetupForm.astro app/src/components/layout/games/interfaces/Baseball.astro app/src/components/layout/games/result-modals/BaseballResults.astro app/src/pages/games/baseball/ app/src/lib/game/rulesets/games-visibility.ts app/src/lib/client/alpine/register-route-data.ts app/tests/lib/game/baseball-setup.data.test.ts app/tests/lib/game/baseball-play.data.test.ts app/tests/lib/game/rulesets/games-visibility.test.ts app/tests/lib/client/alpine/register-route-data.test.ts
git commit -m "feat(baseball): setup and play pages, results modal, games card" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg"
```

---

### Task 4: Seed 0041

**Files:**
- Create: `database/seeds/0041_baseball_game_engine_reference.sql`, `database/verification/0041_baseball_capability_checks.sql`
- Modify: `database/README.md`
- Test: local Postgres seed, verification run, integration suite

**Interfaces:**
- Consumes: the `BASEBALL_V1` capability rows (Task 1) and the stats-world fixture (Task 2).
- Produces: game type `BASEBALL`, ruleset `BASEBALL_V1`, preset "Baseball Darts — Nine Innings" (`{}`).

- [ ] **Step 1: Prove the integration fixture fails without the seed**

Start Postgres if needed: `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgci/data -o '-p 5433 -k /var/tmp/pgci' -l /var/tmp/pgci/log start"`.

Run (from `app/`): `DATABASE_URL=postgres://postgres@localhost:5433/integration npm run test:integration -- statistics-sql`
Expected: FAIL. The Baseball fixture session cannot resolve `BASEBALL_V1` (no ruleset row).

- [ ] **Step 2: Write the seed**

Create `database/seeds/0041_baseball_game_engine_reference.sql`:

```sql
-- ============================================================
-- Seed: 0041_baseball_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Baseball Darts v1: a solo nine-inning
-- run — inning n aims at number n, three darts an inning, a single
-- scores 1 run, a double 2, a treble 3, anything else 0. Without
-- this seed there is no game type, ruleset version, or preset to
-- start a session from — POST /api/sessions has nothing to look up
-- for BASEBALL_V1.
--
-- UUID allocation (continues the 0003 range, next after 0037's
-- 501_V2 rows and 0034's Tactics game type):
-- - 0198f000-...-00000000000c game_types              (BASEBALL)
-- - 0198f100-...-000000000018 ruleset_versions        (BASEBALL_V1)
-- - 0198f300-...-00000000001a configuration_templates (Baseball Darts — Nine Innings)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — BaseballConfig is an
-- empty `.strict()` object: v1 locks nine innings, runs by ring
-- and the solo seat, so its one preset's configuration is `{}`.
--
-- No game_type_features mapping: v1 is single-player only, with no
-- duration or opponent toggle, as 0034 Tactics.
--
-- Capability: BASEBALL_V1 + RECREATIONAL + DETAILED_DARTS and
-- BASEBALL_V1 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, the running ledger.
-- verification/0041_baseball_capability_checks.sql asserts them.
-- ============================================================
BEGIN;
-- ============================================================
-- Game type
-- ============================================================
INSERT INTO game_types (
        id,
        implementation_key,
        name,
        description,
        is_published,
        created_at,
        updated_at
    )
VALUES (
        '0198f000-0000-7000-8000-00000000000c',
        'BASEBALL',
        'Baseball Darts',
        'Nine innings, three darts each: inning 1 aims at the 1, inning 9 at the 9. On the inning''s number a single scores 1 run, a double 2, a treble 3; any other number or the bull scores nothing. Most runs wins — 81 is a perfect game.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Ruleset version
-- ============================================================
INSERT INTO ruleset_versions (
        id,
        game_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0198f100-0000-7000-8000-000000000018',
        '0198f000-0000-7000-8000-00000000000c',
        'BASEBALL_V1',
        1,
        'Initial Baseball Darts ruleset: solo, nine innings on 1-9, three darts each, runs 1/2/3 by ring on the inning''s number, no bull, ends after inning 9.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Configuration preset
-- ============================================================
INSERT INTO configuration_templates (
        id,
        game_type_id,
        player_id,
        name,
        description,
        configuration,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0198f300-0000-7000-8000-00000000001a',
        '0198f000-0000-7000-8000-00000000000c',
        NULL,
        'Baseball Darts — Nine Innings',
        'Innings 1 to 9, runs by the ring, solo.',
        '{}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
```

- [ ] **Step 3: Write the verification**

To create `database/verification/0041_baseball_capability_checks.sql`, copy `database/verification/0034_tactics_capability_checks.sql` and make these changes:

- In the header, replace `0034_tactics` with `0041_baseball`, `TACTICS_V1` with `BASEBALL_V1`, and `seeds/0034` with `seeds/0041`.
- In Steps 1–2, replace every `'TACTICS_V1'` with `'BASEBALL_V1'`, including the `WHERE rv.implementation_key = …` lines and the `detail` strings.
- Keep Step 3 (no undeclared `exercise_sessions` row) and the results block unchanged.

- [ ] **Step 4: Register the seed in the README**

In `database/README.md`:
- after item `40.`, add: ``41. `seeds/0041_baseball_game_engine_reference.sql` ``;
- after the `0040_doubles_lock_seed_checks.sql` verification row, add:

  `| \`verification/0041_baseball_capability_checks.sql\` | \`seeds/0041\`+\`0007\` combined: \`BASEBALL_V1\`/\`RECREATIONAL\`/\`DETAILED_DARTS\` and \`BASEBALL_V1\`/\`ANALYTICS\`/\`VISUAL_BOARD\` resolve, zero undeclared \`exercise_sessions\` (3 checks) (2026-10-18) |`

- [ ] **Step 5: Apply and verify**

Run (from `app/`):

```
DATABASE_URL='postgres://postgres@localhost:5433/integration?sslmode=disable' npm run db:seed:ci
psql 'postgres://postgres@localhost:5433/integration' -f ../database/verification/0041_baseball_capability_checks.sql
psql 'postgres://postgres@localhost:5433/integration' -f ../database/verification/0007_capability_seed_checks.sql
DATABASE_URL=postgres://postgres@localhost:5433/integration npm run test:integration
```

Expected:
- the seed exits 0;
- both verifications print `ALL … CHECKS PASSED`;
- the integration suite passes, including `statistics-sql` with the Baseball fixture.

Run: `bash scripts/check-constraint-mirror.sh` (from the repo root). Expected: OK.

- [ ] **Step 6: Commit**

```bash
git add database/seeds/0041_baseball_game_engine_reference.sql database/verification/0041_baseball_capability_checks.sql database/README.md
git commit -m "feat(baseball): seed 0041 game type, ruleset and preset" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg"
```

---

### Task 5: Docs, rules file, gates

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md`, `docs/architecture/00-File-Inventory.md`, `docs/architecture/00-Context-Map-History.md`, `docs/architecture/07-Frontend/08-Component-Inventory.md`, `docs/game-rules/rulesets/baseball-darts.md`

- [ ] **Step 1: Prove the doc gate fails without the docs**

Run (from the repo root): `bash scripts/check-doc-sync.sh`
Expected: FAIL. The change set touches `app/src/modules/` and `app/src/services/` with no `docs/architecture/` edit.

- [ ] **Step 2: Edit the docs**

`docs/architecture/04-Architecture-patterns.md`:

- Bump the version to `1.11.11` and prepend `(Pattern 18: Baseball Darts, the first new game on the Track kernel, bound through the game shell; `TargetGrid` titles 2026-10-18; prior 1.11.10: …`, keeping the rest of the chain.
- In the rule-kernel families table's `TRACK` row, change the built list's trailing `(D469)` clause to: `Hit Count, SwitchBlade, Doubles Lock bound through `trackExerciseSpec` (D469); Baseball Darts bound through the game shell (2026-10-18)`.

`docs/architecture/00-File-Inventory.md`:
- after the `0040_doubles_lock_exercise_type.sql` row, add:

  `| \`database/seeds/0041_baseball_game_engine_reference.sql\` | Seeds the \`BASEBALL\` game type, \`BASEBALL_V1\` ruleset version and its empty-config "Baseball Darts — Nine Innings" preset; capability rows live in \`0007\` (2026-10-18) | canonical |`

- after the `0040_doubles_lock_seed_checks.sql` row, add:

  `| \`database/verification/0041_baseball_capability_checks.sql\` | \`seeds/0041\`+\`0007\` combined: \`BASEBALL_V1\` resolves for \`RECREATIONAL\`/\`DETAILED_DARTS\` and \`ANALYTICS\`/\`VISUAL_BOARD\`, zero undeclared \`exercise_sessions\` (3 checks, 2026-10-18) | canonical |`

`docs/architecture/07-Frontend/08-Component-Inventory.md`, `TargetGrid.astro` row:
- change the description's lead to `Cricket/Tactics "Darts to close" grid, Baseball Darts "Runs per inning": one 56px inset-well tile per objective…`;
- add `` `title` (2026-10-18) `` to its props column, so it reads `` `labels`, `valuesExpr`, `cols` (3/4), `title` (default "Darts to close", 2026-10-18) ``.

`docs/architecture/00-Context-Map-History.md`: append one row after the Doubles Lock row, in the same column format. It lists:
- the files: `baseball.engine.module.ts`, `baseball.validator.ts`, `baseball-{setup,play}.data.ts`, `Baseball{SetupForm,,Results}.astro`, `TargetGrid.astro`, pages `games/baseball/`, `capabilities.ts`, `rulesets/types.ts`, `modules/game/types.ts`, stats replay/registry/constants, `session-progress.module.ts`, `games-visibility.ts`, `register-route-data.ts`, seeds `0041` and `0007`, and their tests;
- the summary: "Track T1.4: Baseball Darts V1, a standalone solo game on the Track kernel";
- the date `2026-10-18`.

`docs/game-rules/rulesets/baseball-darts.md`:
- `Current version: none (V1 in design)` → `Current version: V1 (shipped 2026-10-18)`.
- In §Capture, replace the line `Baseball Darts is unbuilt; this is the capture shape its V1 is designed for, taken from Shanghai's.` with `V1's capture shape, as built (2026-10-18), taken from Shanghai's. Ruleset `BASEBALL_V1` (seed `0041`).`
- Leave every other line unchanged.

No `CLAUDE.md` rule changes: game engines are not listed by name in `app/src/modules/game/CLAUDE.md`.

- [ ] **Step 3: Commit the docs**

```bash
git add docs/architecture/04-Architecture-patterns.md docs/architecture/00-File-Inventory.md docs/architecture/00-Context-Map-History.md docs/architecture/07-Frontend/08-Component-Inventory.md docs/game-rules/rulesets/baseball-darts.md
git commit -m "docs(baseball): patterns 1.11.11, inventories, history, rules V1" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg"
```

- [ ] **Step 4: Run every gate**

Run (from the repo root; run `check-context-map.sh` in the background, since it is slow):

```
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-skill-pointers.sh
bash scripts/check-worktree-location.sh
bash scripts/check-test-coverage.sh
bash scripts/check-doc-sync.sh
bash scripts/check-game-rules.sh
bash scripts/test-check-game-rules.sh
bash scripts/check-engine-kernels.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-game-engines.sh
bash scripts/check-refinement-coverage.sh
bash scripts/check-type-barrels.sh
bash scripts/check-alias-sync.sh
bash scripts/check-constraint-mirror.sh
bash scripts/check-no-inline-comments.sh
bash scripts/check-style-tokens.sh
bash scripts/check-game-wiring.sh
```

Then, from `app/`, with a temporary `app/.env` (`DATABASE_URL=postgres://postgres@localhost:5433/integration?sslmode=disable`), run `npm run validate:app` and delete `app/.env` afterwards.

Expected:
- every script prints OK;
- `validate:app` exits 0 with type gate 0/0/0 and fallow clean;
- the pre-existing `backdrop` warning (#970) is tolerated.

## Self-review

- **Spec coverage:**
  - kernel row: Task 1, with refinements 2–4;
  - readouts `inning`, `runs`, `runsPerInning`, status: Tasks 1 and 3;
  - persistence: Task 1 (`totalScore` test) and refinement 1;
  - game touch-list: Tasks 1–4, per `09-Adding-A-Game.md`;
  - kernel row and docs: Tasks 1 and 5.
  - The risk "Baseball UI scope grows" is met by one seat and reused components.
- **Out of scope:** Multiplayer, Extra innings, the tiebreaker, the variants, Team Play, Dartbot and a dedicated stats section.
- **Placeholders:** none. Copy-from-file steps name exact substitutions.
- **Type consistency:** `BaseballSeatState.runs` / `runsPerInning` / `targetIndex` are used the same way in the engine, presenter, progress card and play data. `baseballSeatResult(seat, turns)` matches its test.
