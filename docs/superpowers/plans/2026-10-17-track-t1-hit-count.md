# Track T1.1 — Hit Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Hit Count V1 as a playable routine-step exercise bound to the Track kernel, end to end (engine, seed, validator, routine wiring, stats, docs).

**Architecture:** A new `trackExerciseSpec` helper turns a Track rules record plus a projection into a plain `DartExerciseSpec`, bound by the existing exercise shell. `BoardTarget` gains a `TREBLE` kind. Three new policies (`tallyOnTarget`, `advanceAfterDarts`, `passOnWrap`) carry Hit Count's per-target darts and its pass wrap. Wiring follows Random Checkout / Target Scoring file by file.

**Tech Stack:** TypeScript, Zod, Vitest, Astro + Alpine, PostgreSQL seeds (dbmate / `app/scripts/seed.ts`), bash gates.

**Spec:** `docs/superpowers/specs/2026-10-17-track-wave-t1-design.md` (T1.1). Rules: `docs/game-rules/training/exercises/hit-count.md`.

## Global Constraints

- Branch `feat/track-t1-hit-count` (from `origin/main`); never merge to `main`; never `--no-verify`.
- TDD per `app/CLAUDE.md` §TDD: failing test first, watch it fail, then code. Commands from `app/`: `npm test -- <path>`.
- No `//` or `/* */` comments inside function bodies; JSDoc above declarations only, no decision history in prose.
- fallow complexity ≤ 15; `npm run validate:app` must exit 0 with type gate 0/0/0.
- Existing tests and snapshots are append-only (add cases, never edit assertions). New golden snapshot files are fine.
- Never modify migrations `0001`–`0046`. No schema change in this PR.
- Seed number `0038` (highest on `main` is `0037`). Seed ids: type `0199a000-0000-7000-8000-00000000000c`, ruleset `0199a100-0000-7000-8000-00000000000b`, template `0199b000-0000-7000-8000-000000000012`.
- Decision id: `D469` now; re-run `bash scripts/next-decision-id.sh` before the PR and `bash scripts/renumber-decision.sh` if it moved.
- Discovered work → GitHub issue (`discovered-work`), never fixed here.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```
- Before the PR: `cd app && npm run format && npm run format:check`.

## Spec refinements (write back into the spec on approval)

1. `project` takes `facts` as a fourth argument: `project(seat, config, expired, facts)`. Darts thrown is a count of fact darts, not a kernel field; passing facts keeps ext free of a dart counter.
2. Hit Count's per-dart bookkeeping is a fourth policy, `tallyOnTarget` (onDart), not unnamed engine code; D468 asks each policy to land with its first caller.
3. `passOnWrap` and `lapOnWrap` share one private `wrapToStart(lastIndex, bump)`; `lapOnWrap`'s behaviour is unchanged (Around the Clock goldens prove it).
4. `HitCountState` drops `hitRate`: no shipped exercise state carries a rate; the summary and panel derive it with `accuracyDisplay(hits, darts)`.
5. `scripts/check-engine-kernels.sh` accepts `<kernel>-exercise-spec.module` as the binding import: a `trackExerciseSpec` engine imports the helper, not the kernel.
6. Hit Count's config targets are `HitCountTarget = TREBLE | DOUBLE | BULL` (no `NUMBER`); `BULL` means the bullseye (`isHitOn`'s inner bull).
7. The routine-stats integration fixture gains Hit Count as step 12, after the 501 step, so existing steps keep their numbers.

## Review Focus

1. Pass wrap at the boundary: the last target's last dart closes the visit, wraps to target 0 and adds a pass in one close — `passes` 1, `dartsLeftOnTarget` back to full. Pinned in Task 5 (`wraps to the first target and counts a pass`).
2. Undo across the wrap: undoing the first dart of pass 2 restores pass 1's last-visit state, since state is a pure fold. Pinned in Task 5 (`undo across a pass wrap`).
3. Bullseye target: only `INNER_BULL` hits; `OUTER_BULL` is a miss; intent is `25`/`INNER_BULL`. Pinned in Task 5 (`bull target counts the bullseye only`).
4. Resume from persisted facts mid-target (dart 5 of 9): a rebuilt engine reads the same target and darts left. Pinned in Task 5 (`rehydrates mid-target`).
5. A config with `dartsPerTarget` not a multiple of three, or a `NUMBER` target, is refused at parse (server validator and engine). Pinned in Task 4 and Task 6.

---

### Task 1: `BoardTarget` TREBLE

**Files:**
- Modify: `app/src/modules/game/types.ts` (`BoardTarget`, ~line 423)
- Modify: `app/src/modules/game/board-progression.module.ts` (`boardTargetLabel`, `isHitOn`)
- Test: `app/tests/modules/game/board-progression.module.test.ts`

**Interfaces:**
- Produces: `BoardTarget` gains `{ kind: "TREBLE"; number: number }`; `boardTargetLabel({kind:"TREBLE",number:20})` → `"T20"`; `isHitOn` on TREBLE is true only for `hitZoneKey === "TREBLE"` on that number.

- [ ] **Step 1: Write the failing tests** (append to the file's top-level `describe` blocks or a new one)

```ts
describe("TREBLE board target", () => {
  const T20 = { kind: "TREBLE", number: 20 } as const;
  const obs = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
  ): DartObservation => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: null,
    locationY: null,
  });

  it("labels a treble target T<n>", () => {
    expect(boardTargetLabel(T20)).toBe("T20");
  });

  it("isHitOn counts only the treble of the target's number", () => {
    expect(isHitOn(T20, obs(20, "TREBLE"))).toBe(true);
    expect(isHitOn(T20, obs(20, "SINGLE"))).toBe(false);
    expect(isHitOn(T20, obs(20, "DOUBLE"))).toBe(false);
    expect(isHitOn(T20, obs(1, "TREBLE"))).toBe(false);
    expect(isHitOn(T20, obs(null, "MISS"))).toBe(false);
  });
});
```

Add `boardTargetLabel`, `isHitOn` and the `DartObservation`/`DartZoneKey` types to the file's imports if absent.

- [ ] **Step 2: Run** `cd app && npm test -- tests/modules/game/board-progression.module.test.ts`
Expected: FAIL — type error / `"20"` not `"T20"` / treble single counted as hit.

- [ ] **Step 3: Implement**

`types.ts`:
```ts
export type BoardTarget =
  | { kind: "NUMBER"; number: number }
  | { kind: "DOUBLE"; number: number }
  | { kind: "TREBLE"; number: number }
  | { kind: "BULL" };
```

`board-progression.module.ts`:
```ts
const RING_PREFIX: Record<"DOUBLE" | "TREBLE", string> = {
  DOUBLE: "D",
  TREBLE: "T",
};

/** A path target's display label: `BULL`, `D16` for a double, `T20` for a treble, the bare number otherwise. */
export function boardTargetLabel(target: BoardTarget): string {
  if (target.kind === "BULL") return "BULL";
  if (target.kind === "NUMBER") return String(target.number);
  return `${RING_PREFIX[target.kind]}${target.number}`;
}

const RING_ZONE: Record<"DOUBLE" | "TREBLE", DartZoneKey> = {
  DOUBLE: "DOUBLE",
  TREBLE: "TREBLE",
};

export function isHitOn(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  if (target.kind === "BULL") {
    return (
      observation.hitTargetNumber === BULL_TARGET_NUMBER &&
      observation.hitZoneKey === "INNER_BULL"
    );
  }
  if (observation.hitTargetNumber !== target.number) return false;
  return target.kind === "NUMBER"
    ? observation.hitZoneKey !== "MISS"
    : observation.hitZoneKey === RING_ZONE[target.kind];
}
```

- [ ] **Step 4: Run** the file, then the shipped Track goldens unchanged:
`npm test -- tests/modules/game/board-progression.module.test.ts tests/modules/game/doubles-training tests/modules/game/bobs27 tests/modules/game/singles-training tests/modules/game/around-the-clock tests/modules/game/shanghai tests/modules/training/exercises/target-scoring tests/modules/training/exercises/switching-target-scoring`
Expected: PASS, no snapshot written or changed. Then `npx tsc --noEmit -p .` (or `npm run check`) — Expected: 0 errors (no exhaustive switch over `BoardTarget` breaks).

- [ ] **Step 5: Commit**
```bash
git add app/src/modules/game/types.ts app/src/modules/game/board-progression.module.ts app/tests/modules/game/board-progression.module.test.ts
git commit -m "feat(track): BoardTarget gains a TREBLE kind"
```

---

### Task 2: Policies `tallyOnTarget`, `advanceAfterDarts`, `passOnWrap`

**Files:**
- Modify: `app/src/modules/game/types.ts` (ext types beside `ChainTrackExt`)
- Modify: `app/src/modules/game/track-policies.ts`
- Test: `app/tests/modules/game/track-policies.test.ts`

**Interfaces:**
- Consumes: `TrackSeat`, `JudgedDart` (existing).
- Produces:
  ```ts
  export type TargetTallyExt = { dartsOnTarget: number; hitsPerTarget: number[] };
  export type PassTrackExt = { passes: number };
  export type HitCountTrackExt = TargetTallyExt & PassTrackExt;
  tallyOnTarget<TExt extends TargetTallyExt>(seat, dart): TrackSeat<TExt>          // onDart
  advanceAfterDarts<TExt extends TargetTallyExt>(darts: number): (seat) => seat   // onVisitClose
  passOnWrap<TExt extends PassTrackExt>(lastIndex: number): (seat) => seat        // onVisitClose
  ```

- [ ] **Step 1: Write the failing tests** (append; add the three names and the ext types to the imports)

```ts
describe("Hit Count policies", () => {
  const tally = (
    over: Partial<TrackSeat<HitCountTrackExt>> = {},
    ext: Partial<HitCountTrackExt> = {},
  ): TrackSeat<HitCountTrackExt> => ({
    ...initialTrackSeat(SEAT, {
      dartsOnTarget: 0,
      hitsPerTarget: [0, 0],
      passes: 0,
      ...ext,
    }),
    ...over,
  });
  const judged = (hit: boolean): JudgedDart => ({
    observation: {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    },
    target: { kind: "TREBLE", number: 20 },
    hit,
    points: hit ? 1 : 0,
  });

  it("tallyOnTarget counts every dart and only hits against the current target", () => {
    const afterHit = tallyOnTarget(tally({ targetIndex: 1 }), judged(true));
    expect(afterHit.ext).toEqual({
      dartsOnTarget: 1,
      hitsPerTarget: [0, 1],
      passes: 0,
    });
    const afterMiss = tallyOnTarget(afterHit, judged(false));
    expect(afterMiss.ext).toEqual({
      dartsOnTarget: 2,
      hitsPerTarget: [0, 1],
      passes: 0,
    });
  });

  it("tallyOnTarget never mutates the seat it was given", () => {
    const before = tally();
    tallyOnTarget(before, judged(true));
    expect(before.ext.hitsPerTarget).toEqual([0, 0]);
  });

  it("advanceAfterDarts holds the target until its darts are thrown", () => {
    const seat = tally({}, { dartsOnTarget: 6 });
    expect(advanceAfterDarts<HitCountTrackExt>(9)(seat)).toBe(seat);
  });

  it("advanceAfterDarts moves on and zeroes the count once they are", () => {
    const moved = advanceAfterDarts<HitCountTrackExt>(9)(
      tally({ targetIndex: 0 }, { dartsOnTarget: 9 }),
    );
    expect(moved.targetIndex).toBe(1);
    expect(moved.ext.dartsOnTarget).toBe(0);
  });

  it("passOnWrap leaves an in-range index alone", () => {
    const seat = tally({ targetIndex: 1 });
    expect(passOnWrap<HitCountTrackExt>(1)(seat)).toBe(seat);
  });

  it("passOnWrap restarts past the last index and counts a pass", () => {
    const wrapped = passOnWrap<HitCountTrackExt>(1)(
      tally({ targetIndex: 2 }, { passes: 1 }),
    );
    expect(wrapped.targetIndex).toBe(0);
    expect(wrapped.ext.passes).toBe(2);
  });

  it("lapOnWrap still counts laps after sharing the wrap", () => {
    const lap = lapOnWrap<{ laps: number }>(20)({
      ...initialTrackSeat(SEAT, { laps: 0 }),
      targetIndex: 21,
    });
    expect(lap.targetIndex).toBe(0);
    expect(lap.ext.laps).toBe(1);
  });
});
```

(`JudgedDart` and `HitCountTrackExt` join the existing `@modules/types` import.)

- [ ] **Step 2: Run** `npm test -- tests/modules/game/track-policies.test.ts`
Expected: FAIL — `tallyOnTarget` / `advanceAfterDarts` / `passOnWrap` not exported.

- [ ] **Step 3: Implement**

`types.ts` (after `SequenceTrackExt`):
```ts
/** Per-target bookkeeping for a Track seat (Hit Count): darts thrown at the current target, and hits per path index. */
export type TargetTallyExt = {
  dartsOnTarget: number;
  hitsPerTarget: number[];
};

/** Completed walks of a repeating path. */
export type PassTrackExt = {
  passes: number;
};

/** Hit Count's Track extras. */
export type HitCountTrackExt = TargetTallyExt & PassTrackExt;
```

`track-policies.ts` — import `PassTrackExt`, `TargetTallyExt`; replace `lapOnWrap`'s body and add the new policies:
```ts
function wrapToStart<TExt>(
  lastIndex: number,
  bump: (ext: TExt) => TExt,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.targetIndex > lastIndex
      ? { ...seat, targetIndex: 0, ext: bump(seat.ext) }
      : seat;
}

/** Visit-close policy: past `lastIndex`, restart at the first target and count a lap. */
export function lapOnWrap<TExt extends { laps: number }>(
  lastIndex: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return wrapToStart<TExt>(lastIndex, (ext) => ({ ...ext, laps: ext.laps + 1 }));
}

/** Visit-close policy: past `lastIndex`, restart at the first target and count a pass. */
export function passOnWrap<TExt extends PassTrackExt>(
  lastIndex: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return wrapToStart<TExt>(lastIndex, (ext) => ({
    ...ext,
    passes: ext.passes + 1,
  }));
}

/** Per-dart policy: count the dart against the current target in `ext.dartsOnTarget`, and a hit in `ext.hitsPerTarget[targetIndex]`. */
export function tallyOnTarget<TExt extends TargetTallyExt>(
  seat: TrackSeat<TExt>,
  dart: JudgedDart,
): TrackSeat<TExt> {
  const hitsPerTarget = [...seat.ext.hitsPerTarget];
  hitsPerTarget[seat.targetIndex] =
    (hitsPerTarget[seat.targetIndex] ?? 0) + (dart.hit ? 1 : 0);
  return {
    ...seat,
    ext: {
      ...seat.ext,
      dartsOnTarget: seat.ext.dartsOnTarget + 1,
      hitsPerTarget,
    },
  };
}

/** Visit-close policy: once `darts` darts were thrown at the target, step to the next and zero the count. */
export function advanceAfterDarts<TExt extends TargetTallyExt>(
  darts: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.ext.dartsOnTarget < darts
      ? seat
      : {
          ...seat,
          targetIndex: seat.targetIndex + 1,
          ext: { ...seat.ext, dartsOnTarget: 0 },
        };
}
```

- [ ] **Step 4: Run** `npm test -- tests/modules/game/track-policies.test.ts tests/modules/game/around-the-clock`
Expected: PASS; Around the Clock goldens unchanged.

- [ ] **Step 5: Mutation checks** (record each result in the ledger for the PR body; revert after each):
  - `tallyOnTarget`: (a) `dart.hit ? 1 : 0` → `1`; (b) drop `+ 1` on `dartsOnTarget`. Expected: a policy test fails each time.
  - `advanceAfterDarts`: (a) `<` → `<=`; (b) drop `dartsOnTarget: 0`. Expected: fail each time.
  - `passOnWrap`: (a) `passes + 1` → `passes`; (b) `>` → `>=` in `wrapToStart`. Expected: fail each time ((b) also fails the lap test).

- [ ] **Step 6: Commit**
```bash
git add app/src/modules/game/types.ts app/src/modules/game/track-policies.ts app/tests/modules/game/track-policies.test.ts
git commit -m "feat(track): tallyOnTarget, advanceAfterDarts and passOnWrap policies"
```

---

### Task 3: `trackExerciseSpec`

**Files:**
- Modify: `app/src/modules/training/exercises/interfaces.ts` (add `TrackExerciseDefinition`)
- Create: `app/src/modules/training/exercises/track-exercise-spec.module.ts`
- Test: `app/tests/modules/training/exercises/track-exercise-spec.module.test.ts`

**Interfaces:**
- Consumes: `foldTrackDarts`, `initialTrackSeat` (kernel); `TrackRules`, `TrackSeat`; `DartExerciseSpec`; `SOLO_PARTICIPANT_REF`.
- Produces:
  ```ts
  export interface TrackExerciseDefinition<TConfig, TExt, TState> {
    readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
    parse(config: TConfig): TConfig;
    rules(config: TConfig): TrackRules<TExt>;
    initialExt(config: TConfig): TExt;
    project(seat: TrackSeat<TExt>, config: TConfig, expired: boolean, facts: EngineFacts): TState;
    intent(state: TState, config: TConfig): DartIntent;
  }
  export function trackExerciseSpec<TConfig, TExt, TState>(
    definition: TrackExerciseDefinition<TConfig, TExt, TState>,
  ): DartExerciseSpec<TConfig, TState>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { trackExerciseSpec } from "@modules/training/exercises/track-exercise-spec.module";
import { closeAfter, pathTarget } from "@modules/game/track-policies";
import { isHitOn, numbersPath } from "@modules/game/board-progression.module";
import type { DartObservation, EngineFacts, TurnFact } from "@modules/types";

type Config = { start: number };
type State = {
  score: number;
  index: number;
  seen: number;
  expired: boolean;
  darts: number;
};

const spec = trackExerciseSpec<Config, { seen: number }, State>({
  exerciseRulesetVersionKey: "TARGET_SCORING_V1",
  parse: (config) => config,
  rules: () => ({
    doneMessage: "never",
    startScore: 5,
    target: pathTarget(numbersPath()),
    hit: isHitOn,
    points: (_target, _observation, hit) => (hit ? 1 : 0),
    onDart: (seat) => ({ ...seat, ext: { seen: seat.ext.seen + 1 } }),
    visitOpen: closeAfter(3),
  }),
  initialExt: (config) => ({ seen: config.start }),
  project: (seat, _config, expired, facts) => ({
    score: seat.score,
    index: seat.targetIndex,
    seen: seat.ext.seen,
    expired,
    darts: facts.turns.flatMap((turn) => turn.darts).length,
  }),
  intent: (state) => ({
    intendedTargetNumber: state.index + 1,
    intendedZoneKey: "SINGLE",
  }),
});

const dart = (n: number): DartObservation => ({
  hitTargetNumber: n,
  hitZoneKey: "SINGLE",
  locationX: null,
  locationY: null,
});

function facts(darts: DartObservation[]): EngineFacts {
  const turn = { darts } as unknown as TurnFact;
  return { stages: [], turns: [turn] };
}

describe("trackExerciseSpec", () => {
  it("folds the solo seat from the rules' start score and initial ext through the kernel", () => {
    expect(spec.fold(facts([dart(1), dart(7)]), { start: 10 }, false)).toEqual({
      score: 6,
      index: 0,
      seen: 12,
      expired: false,
      darts: 2,
    });
  });

  it("passes expiry through to the projection", () => {
    expect(spec.fold(facts([]), { start: 0 }, true).expired).toBe(true);
  });

  it("closes a visit at three darts", () => {
    const open = { darts: [1, 2] } as unknown as TurnFact;
    const full = { darts: [1, 2, 3] } as unknown as TurnFact;
    expect(spec.isVisitOpen(open)).toBe(true);
    expect(spec.isVisitOpen(full)).toBe(false);
  });

  it("keeps the definition's key, parse and intent", () => {
    expect(spec.exerciseRulesetVersionKey).toBe("TARGET_SCORING_V1");
    expect(spec.parse({ start: 3 })).toEqual({ start: 3 });
    expect(
      spec.intent(
        { score: 0, index: 4, seen: 0, expired: false, darts: 0 },
        { start: 0 },
      ),
    ).toEqual({ intendedTargetNumber: 5, intendedZoneKey: "SINGLE" });
  });
});
```

Note the `TurnFact` casts: `foldTrackDarts` reads only `turn.darts`. If `TurnFact`'s dart type requires more fields than `DartObservation`, build the darts with `appendObservedDart` instead and record a ruling.

- [ ] **Step 2: Run** `npm test -- tests/modules/training/exercises/track-exercise-spec.module.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`interfaces.ts` (beside `DartExerciseSpec`; import `TrackRules` and `TrackSeat` from the modules barrels the file already uses):
```ts
/**
 * A Track-family exercise as rules plus a projection; `trackExerciseSpec`
 * turns it into a `DartExerciseSpec` over one solo seat, three-dart visits.
 */
export interface TrackExerciseDefinition<TConfig, TExt, TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  parse(config: TConfig): TConfig;
  rules(config: TConfig): TrackRules<TExt>;
  initialExt(config: TConfig): TExt;
  project(
    seat: TrackSeat<TExt>,
    config: TConfig,
    expired: boolean,
    facts: EngineFacts,
  ): TState;
  intent(state: TState, config: TConfig): DartIntent;
}
```

`track-exercise-spec.module.ts`:
```ts
import type { EngineFacts } from "@modules/types";
import {
  foldTrackDarts,
  initialTrackSeat,
} from "@modules/game/track-kernel.module";
import type { DartExerciseSpec, TrackExerciseDefinition } from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";

const DARTS_PER_VISIT = 3;
const SOLO_SEAT = {
  participantRef: SOLO_PARTICIPANT_REF,
  sideKey: SOLO_PARTICIPANT_REF,
};

/**
 * Binds a Track-family exercise to the exercise shell: `fold` replays every
 * dart through `foldTrackDarts` from the solo seat and hands the seat to
 * `project`; visits close at three darts (Track wave T1 spec §2.1).
 */
export function trackExerciseSpec<TConfig, TExt, TState>(
  definition: TrackExerciseDefinition<TConfig, TExt, TState>,
): DartExerciseSpec<TConfig, TState> {
  const fold = (facts: EngineFacts, config: TConfig, expired: boolean) => {
    const rules = definition.rules(config);
    const initial = initialTrackSeat(
      SOLO_SEAT,
      definition.initialExt(config),
      rules.startScore,
    );
    const seat = foldTrackDarts(facts.turns, initial, rules);
    return definition.project(seat, config, expired, facts);
  };
  return {
    exerciseRulesetVersionKey: definition.exerciseRulesetVersionKey,
    parse: definition.parse,
    fold,
    intent: definition.intent,
    isVisitOpen: (turn) => turn.darts.length < DARTS_PER_VISIT,
  };
}
```

- [ ] **Step 4: Run** the test file. Expected: PASS (4/4).

- [ ] **Step 5: Commit**
```bash
git add app/src/modules/training/exercises/interfaces.ts app/src/modules/training/exercises/track-exercise-spec.module.ts app/tests/modules/training/exercises/track-exercise-spec.module.test.ts
git commit -m "feat(training): trackExerciseSpec binds Track rules to the exercise shell"
```

---

### Task 4: `HIT_COUNT_V1` key and config

**Files:**
- Modify: `app/src/lib/training/exercises/rulesets/types.ts`
- Test: `app/tests/lib/training/exercises/rulesets/types.test.ts`

**Interfaces:**
- Produces: `ExerciseRulesetVersionKey` gains `"HIT_COUNT_V1"`; `HitCountV1Config` (Zod); `HitCountConfigData = { targets: HitCountTarget[]; dartsPerTarget: number }`, `HitCountTarget = {kind:"TREBLE";number} | {kind:"DOUBLE";number} | {kind:"BULL"}`; `EXERCISE_RULESET_CONFIGS.HIT_COUNT_V1`.

- [ ] **Step 1: Write the failing tests** (append; import `HitCountV1Config`)

```ts
describe("HitCountV1Config", () => {
  const BIG_TREBLES = {
    targets: [20, 19, 18, 17].map((number) => ({ kind: "TREBLE", number })),
    dartsPerTarget: 9,
  };

  it("accepts the Big Trebles template", () => {
    expect(HitCountV1Config.safeParse(BIG_TREBLES).success).toBe(true);
  });

  it("accepts doubles and the bullseye", () => {
    expect(
      HitCountV1Config.safeParse({
        targets: [{ kind: "DOUBLE", number: 16 }, { kind: "BULL" }],
        dartsPerTarget: 3,
      }).success,
    ).toBe(true);
  });

  it("rejects darts per target that is not a positive multiple of three", () => {
    for (const dartsPerTarget of [0, 1, 2, 4, 10, -3, 4.5]) {
      expect(
        HitCountV1Config.safeParse({ ...BIG_TREBLES, dartsPerTarget }).success,
      ).toBe(false);
    }
  });

  it("rejects an empty list, a NUMBER target and an off-board number", () => {
    for (const targets of [
      [],
      [{ kind: "NUMBER", number: 20 }],
      [{ kind: "TREBLE", number: 21 }],
      [{ kind: "DOUBLE", number: 0 }],
      [{ kind: "BULL", number: 25 }],
    ]) {
      expect(
        HitCountV1Config.safeParse({ ...BIG_TREBLES, targets }).success,
      ).toBe(false);
    }
  });

  it("rejects extra keys", () => {
    expect(
      HitCountV1Config.safeParse({ ...BIG_TREBLES, scoring: 1 }).success,
    ).toBe(false);
  });

  it("is registered under HIT_COUNT_V1", () => {
    expect(EXERCISE_RULESET_CONFIGS.HIT_COUNT_V1).toBe(HitCountV1Config);
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/lib/training/exercises/rulesets/types.test.ts`
Expected: FAIL — `HitCountV1Config` not exported.

- [ ] **Step 3: Implement** — add `| "HIT_COUNT_V1"` to the key union, then after `RandomCheckoutConfigData`:

```ts
const BoardNumber = z.number().int().min(1).max(20);

const HitCountTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("TREBLE"), number: BoardNumber }).strict(),
  z.object({ kind: z.literal("DOUBLE"), number: BoardNumber }).strict(),
  z.object({ kind: z.literal("BULL") }).strict(),
]);

/**
 * Hit Count v1: a list of targets, each a treble, a double or the
 * bullseye, and how many darts each gets — a multiple of three, so the aim
 * moves only between visits (`docs/game-rules/training/exercises/hit-count.md`).
 */
export const HitCountV1Config = z
  .object({
    targets: z.array(HitCountTarget).min(1).max(21),
    dartsPerTarget: z.number().int().min(3).max(99).multipleOf(3),
  })
  .strict();

export type HitCountConfigData = z.infer<typeof HitCountV1Config>;
export type HitCountTarget = HitCountConfigData["targets"][number];
```
and `HIT_COUNT_V1: HitCountV1Config,` in `EXERCISE_RULESET_CONFIGS`. Confirm `@lib/types` re-exports this file (it does for `TargetScoringConfigData`).

- [ ] **Step 4: Run** the file. Expected: PASS. `npm run check` Expected: a type error only where a `Record<ExerciseRulesetVersionKey, …>` now lacks `HIT_COUNT_V1` (e.g. `services/exercise-rulesets`); if so, note it — Task 6 fills it. If the type gate must stay green per commit, add the Task 6 registry entry now and record a ruling.

- [ ] **Step 5: Commit**
```bash
git add app/src/lib/training/exercises/rulesets/types.ts app/tests/lib/training/exercises/rulesets/types.test.ts
git commit -m "feat(hit-count): HIT_COUNT_V1 ruleset key and config"
```

---

### Task 5: Hit Count engine, kernel row, gate

**Files:**
- Modify: `app/src/modules/training/exercises/types.ts` (add `HitCountState`)
- Create: `app/src/modules/training/exercises/hit-count.engine.module.ts`
- Modify: `scripts/check-engine-kernels.sh`, `scripts/test-check-engine-kernels.sh`, `scripts/engine-kernels.txt`
- Modify: `app/tests/modules/game/support/aimed-observations.ts` (add `aimedOnCurrentBoardTarget`)
- Test: `app/tests/modules/training/exercises/hit-count.engine.module.test.ts`, `app/tests/modules/training/exercises/hit-count.aimed.golden.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  ```ts
  export type HitCountState = {
    currentTarget: HitCountTarget;
    targetIndex: number;
    dartsLeftOnTarget: number;
    hits: number;
    dartsThrown: number;
    hitsPerTarget: { target: HitCountTarget; hits: number }[];
    passes: number;
    status: "IN_PROGRESS" | "COMPLETE";
  };
  export function hitCountIntent(target: HitCountTarget): DartIntent;
  export function foldHitCountState(facts: EngineFacts, config: HitCountConfigData, complete: boolean): HitCountState;
  export class HitCountEngine;          // shell-built
  export const hitCountEngineFactory;   // registered under HIT_COUNT_V1
  ```

- [ ] **Step 1: Write the failing engine tests**

```ts
import { describe, expect, it } from "vitest";
import {
  foldHitCountState,
  hitCountEngineFactory,
  HitCountEngine,
  hitCountIntent,
} from "@modules/training/exercises/hit-count.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { EventsBatchRequest } from "@pages/api/sessions/types";
import type { HitCountConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";

const T = (number: number) => ({ kind: "TREBLE", number }) as const;
const BIG_TREBLES: HitCountConfigData = {
  targets: [T(20), T(19), T(18), T(17)],
  dartsPerTarget: 9,
};
const SHORT: HitCountConfigData = {
  targets: [T(20), { kind: "DOUBLE", number: 16 }],
  dartsPerTarget: 3,
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}
const MISS = dart(null, "MISS");
const times = (n: number, d: DartObservation) => Array.from({ length: n }, () => d);

function play(engine: HitCountEngine, darts: DartObservation[]) {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("Hit Count engine", () => {
  it("starts on the first target with its full darts", () => {
    expect(new HitCountEngine(BIG_TREBLES).state()).toEqual({
      currentTarget: T(20),
      targetIndex: 0,
      dartsLeftOnTarget: 9,
      hits: 0,
      dartsThrown: 0,
      hitsPerTarget: BIG_TREBLES.targets.map((target) => ({ target, hits: 0 })),
      passes: 0,
      status: "IN_PROGRESS",
    });
  });

  it("counts only the named bed", () => {
    const state = play(new HitCountEngine(BIG_TREBLES), [
      dart(20, "TREBLE"),
      dart(20, "SINGLE"),
      dart(20, "DOUBLE"),
    ]);
    expect(state.hits).toBe(1);
    expect(state.dartsThrown).toBe(3);
  });

  it("counts darts left mid-visit", () => {
    const state = play(new HitCountEngine(BIG_TREBLES), [MISS, MISS]);
    expect(state.dartsLeftOnTarget).toBe(7);
    expect(state.currentTarget).toEqual(T(20));
  });

  it("moves to the next target after its darts", () => {
    const state = play(new HitCountEngine(BIG_TREBLES), times(9, dart(20, "TREBLE")));
    expect(state.currentTarget).toEqual(T(19));
    expect(state.dartsLeftOnTarget).toBe(9);
    expect(state.hitsPerTarget[0]!.hits).toBe(9);
  });

  it("wraps to the first target and counts a pass", () => {
    const state = play(new HitCountEngine(SHORT), [
      ...times(3, dart(20, "TREBLE")),
      ...times(3, dart(16, "DOUBLE")),
    ]);
    expect(state.passes).toBe(1);
    expect(state.targetIndex).toBe(0);
    expect(state.dartsLeftOnTarget).toBe(3);
  });

  it("sums hits per target over every pass", () => {
    const pass = [...times(3, dart(20, "TREBLE")), dart(16, "DOUBLE"), MISS, MISS];
    const state = play(new HitCountEngine(SHORT), [...pass, ...pass]);
    expect(state.hitsPerTarget.map((entry) => entry.hits)).toEqual([6, 2]);
    expect(state.hits).toBe(8);
    expect(state.passes).toBe(2);
  });

  it("bull target counts the bullseye only", () => {
    const engine = new HitCountEngine({
      targets: [{ kind: "BULL" }],
      dartsPerTarget: 3,
    });
    const state = play(engine, [
      dart(25, "INNER_BULL"),
      dart(25, "OUTER_BULL"),
      MISS,
    ]);
    expect(state.hits).toBe(1);
    expect(engine.facts().turns[0]!.darts[0]).toMatchObject({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
    });
  });

  it("stamps each dart with the target's bed", () => {
    const engine = new HitCountEngine(SHORT);
    play(engine, [...times(3, MISS), MISS]);
    const [first, second] = engine.facts().turns;
    expect(first!.darts[0]).toMatchObject({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
    });
    expect(second!.darts[0]).toMatchObject({
      intendedTargetNumber: 16,
      intendedZoneKey: "DOUBLE",
    });
  });

  it("writes one turn per three-dart visit", () => {
    const engine = new HitCountEngine(BIG_TREBLES);
    play(engine, times(7, MISS));
    expect(engine.facts().turns.map((turn) => turn.darts.length)).toEqual([3, 3, 1]);
  });

  it("undo across a pass wrap restores the last visit of pass 1", () => {
    const engine = new HitCountEngine(SHORT);
    const before = play(engine, [
      ...times(3, dart(20, "TREBLE")),
      ...times(3, dart(16, "DOUBLE")),
    ]);
    engine.record(dart(20, "TREBLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.state()).toEqual(before);
  });

  it("rehydrates mid-target", () => {
    const engine = new HitCountEngine(BIG_TREBLES);
    const state = play(engine, [...times(4, dart(20, "TREBLE")), MISS]);
    expect(new HitCountEngine(BIG_TREBLES, engine.facts()).state()).toEqual(state);
    expect(state.dartsLeftOnTarget).toBe(4);
  });

  it("completes only on timer expiry and refuses darts after it", () => {
    const engine = new HitCountEngine(SHORT);
    play(engine, times(30, MISS));
    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.state().status).toBe("COMPLETE");
    expect(() => engine.record(MISS)).toThrow();
  });

  it("refuses a config whose darts per target is not a multiple of three", () => {
    expect(
      () => new HitCountEngine({ ...SHORT, dartsPerTarget: 4 }),
    ).toThrow();
  });

  it("folds state from a fact log without an engine", () => {
    const engine = new HitCountEngine(SHORT);
    const state = play(engine, [dart(20, "TREBLE"), MISS]);
    expect(foldHitCountState(engine.facts(), SHORT, false)).toEqual(state);
  });

  it("hitCountIntent aims at the target's bed", () => {
    expect(hitCountIntent(T(19))).toEqual({
      intendedTargetNumber: 19,
      intendedZoneKey: "TREBLE",
    });
    expect(hitCountIntent({ kind: "DOUBLE", number: 8 })).toEqual({
      intendedTargetNumber: 8,
      intendedZoneKey: "DOUBLE",
    });
    expect(hitCountIntent({ kind: "BULL" })).toEqual({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
    });
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("HIT_COUNT_V1")).toBe(hitCountEngineFactory);
  });

  it("produces an events batch the API accepts", () => {
    const engine = new HitCountEngine(BIG_TREBLES);
    play(engine, [dart(20, "TREBLE"), MISS, dart(20, "SINGLE"), MISS]);
    expect(
      EventsBatchRequest.safeParse(buildEventsBatch(engine.facts())).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npm test -- tests/modules/training/exercises/hit-count.engine.module.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`exercises/types.ts` (after `RandomCheckoutState`; import `HitCountTarget` from `@lib/types` as the file imports config types):
```ts
/**
 * Hit Count state, derived by replaying `facts()` (`foldHitCountState`).
 * `currentTarget`/`targetIndex` locate the target the next dart is thrown
 * at; `hitsPerTarget` follows the config's list and sums every pass.
 */
export type HitCountState = {
  currentTarget: HitCountTarget;
  targetIndex: number;
  dartsLeftOnTarget: number;
  hits: number;
  dartsThrown: number;
  hitsPerTarget: { target: HitCountTarget; hits: number }[];
  passes: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
```

`hit-count.engine.module.ts`:
```ts
import type { HitCountConfigData, HitCountTarget } from "@lib/types";
import { HitCountV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  BoardTarget,
  DartIntent,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  HitCountTrackExt,
  TrackSeat,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import { isHitOn } from "@modules/game/board-progression.module";
import {
  advanceAfterDarts,
  closeAfter,
  passOnWrap,
  pathTarget,
  sectionOf,
  tallyOnTarget,
} from "@modules/game/track-policies";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import {
  dartExerciseEngineClass,
  dartExerciseEngineFactory,
} from "./dart-exercise-shell.module";
import { trackExerciseSpec } from "./track-exercise-spec.module";
import type { HitCountState } from "./types";

const DARTS_PER_VISIT = 3;
const DONE_MESSAGE =
  "A Hit Count seat never finishes; only the timer ends the exercise.";

const INTENDED_ZONE: Record<HitCountTarget["kind"], DartZoneKey> = {
  TREBLE: "TREBLE",
  DOUBLE: "DOUBLE",
  BULL: "INNER_BULL",
};

/** The bed each dart is aimed at: the target's treble or double, or the bullseye. */
export function hitCountIntent(target: HitCountTarget): DartIntent {
  return {
    intendedTargetNumber: sectionOf(target),
    intendedZoneKey: INTENDED_ZONE[target.kind],
  };
}

function hitPoint(
  _target: BoardTarget,
  _observation: DartObservation,
  hit: boolean,
): number {
  return hit ? 1 : 0;
}

/**
 * Hit Count's Track rules: the config's targets in order; a dart hits only
 * in the target's named bed (`isHitOn`) and scores 1; `tallyOnTarget`
 * counts it; at a visit's close `advanceAfterDarts` moves on after
 * `dartsPerTarget` darts and `passOnWrap` restarts the list past its end.
 */
function hitCountRules(
  config: HitCountConfigData,
): TrackRules<HitCountTrackExt> {
  const advance = advanceAfterDarts<HitCountTrackExt>(config.dartsPerTarget);
  const wrap = passOnWrap<HitCountTrackExt>(config.targets.length - 1);
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(config.targets),
    hit: isHitOn,
    points: hitPoint,
    onDart: tallyOnTarget,
    visitOpen: closeAfter(DARTS_PER_VISIT),
    onVisitClose: (seat) => wrap(advance(seat)),
  };
}

function projectHitCount(
  seat: TrackSeat<HitCountTrackExt>,
  config: HitCountConfigData,
  complete: boolean,
  facts: EngineFacts,
): HitCountState {
  return {
    currentTarget: config.targets[seat.targetIndex],
    targetIndex: seat.targetIndex,
    dartsLeftOnTarget: config.dartsPerTarget - seat.ext.dartsOnTarget,
    hits: seat.score,
    dartsThrown: facts.turns.reduce((count, turn) => count + turn.darts.length, 0),
    hitsPerTarget: config.targets.map((target, index) => ({
      target,
      hits: seat.ext.hitsPerTarget[index] ?? 0,
    })),
    passes: seat.ext.passes,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

const hitCountSpec = trackExerciseSpec<
  HitCountConfigData,
  HitCountTrackExt,
  HitCountState
>({
  exerciseRulesetVersionKey: "HIT_COUNT_V1",
  parse: (config) => HitCountV1Config.parse(config),
  rules: hitCountRules,
  initialExt: (config) => ({
    dartsOnTarget: 0,
    hitsPerTarget: config.targets.map(() => 0),
    passes: 0,
  }),
  project: projectHitCount,
  intent: (state) => hitCountIntent(state.currentTarget),
});

/** Hit Count's state from a fact log alone, through the same fold the engine uses. */
export function foldHitCountState(
  facts: EngineFacts,
  config: HitCountConfigData,
  complete: boolean,
): HitCountState {
  return hitCountSpec.fold(facts, config, complete);
}

/** Hit Count exercise engine, built by the exercise shell. */
export class HitCountEngine extends dartExerciseEngineClass(hitCountSpec) {}

export const hitCountEngineFactory = dartExerciseEngineFactory(
  hitCountSpec,
  HitCountEngine,
);

registerDartExerciseEngineFactory(hitCountEngineFactory);
```

- [ ] **Step 4: Run** the engine test. Expected: PASS. If `pathTarget(config.targets)` refuses `HitCountTarget[]` as `readonly BoardTarget[]`, check Task 1's union and the Zod inferred literal types; fix at the type, not with a cast.

- [ ] **Step 5: Kernel row + gate (failing first)**

Append to `scripts/test-check-engine-kernels.sh` before the summary line:
```bash
T=$(tree); printf 'import { a } from "./track-exercise-spec.module";\n' > "$T/app/src/modules/game/foo.engine.module.ts"; row TRACK KERNEL_BOUND docs/game-rules/rulesets/foo.md "" "$T"
expect pass "KERNEL_BOUND through the exercise spec" "$T"

T=$(tree); printf 'import { a } from "./track-exercise-spec.module";\n' > "$T/app/src/modules/game/foo.engine.module.ts"; row TRACK PENDING docs/game-rules/rulesets/foo.md "Track PR 9" "$T"
expect fail "stale PENDING row, exercise spec import" "$T" "imports a kernel but is marked PENDING"
```
Run `bash scripts/test-check-engine-kernels.sh` — Expected: 2 failed.

Edit `scripts/check-engine-kernels.sh`:
  - header comment: `KERNEL_BOUND -> the file imports ./<kernel>-kernel.module (exercises: @modules/game/<kernel>-kernel.module, or ./<kernel>-exercise-spec.module)`;
  - `imports_kernel` grep → `grep -qE "from \"(\./|@modules/game/|@modules/training/exercises/)[a-z-]+-(kernel|exercise-spec)\.module\"" "$path"`;
  - KERNEL_BOUND grep → `grep -qE "from \"(\./|@modules/game/|@modules/training/exercises/)${slug}-(kernel|exercise-spec)\.module\"" "$path"` (failure message unchanged).

Append to `scripts/engine-kernels.txt` (keep rows sorted by path as the file is):
```
app/src/modules/training/exercises/hit-count.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/training/exercises/hit-count.md |
```
Run `bash scripts/test-check-engine-kernels.sh && bash scripts/check-engine-kernels.sh` — Expected: all pass; OK line counts one more engine.

- [ ] **Step 6: Aimed golden**

Add to `aimed-observations.ts`:
```ts
/**
 * `rate` of darts on an exercise's `currentTarget` board target, in any
 * ring (either bull on BULL), otherwise `randomObservation`.
 */
export function aimedOnCurrentBoardTarget(
  rate: number,
): (rand: () => number, engine: OracleEngine) => DartObservation {
  return (rand, engine) => {
    if (rand() >= rate) return randomObservation(rand);
    const { currentTarget } = engine.state() as { currentTarget: BoardTarget };
    return observationOn(currentTarget, rand, () => anyRing(rand));
  };
}
```

`hit-count.aimed.golden.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HitCountEngine } from "@modules/training/exercises/hit-count.engine.module";
import { goldenTrace } from "../../game/support/engine-oracle";
import { aimedOnCurrentBoardTarget } from "../../game/support/aimed-observations";
import type { HitCountConfigData } from "@lib/types";

const T = (number: number) => ({ kind: "TREBLE", number }) as const;

const CASES: [string, HitCountConfigData, boolean][] = [
  ["big trebles", { targets: [T(20), T(19), T(18), T(17)], dartsPerTarget: 9 }, false],
  ["doubles and bull", { targets: [{ kind: "DOUBLE", number: 16 }, { kind: "BULL" }], dartsPerTarget: 3 }, false],
  ["one target, expired", { targets: [T(20)], dartsPerTarget: 30 }, true],
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Hit Count — aimed golden trace", () => {
  for (const [name, config, resumeExpired] of CASES) {
    it(`${name}: seed 11 aimed step trace is unchanged`, () => {
      expect(
        goldenTrace({
          build: (prior) => new HitCountEngine(config, prior),
          seed: 11,
          steps: 260,
          undoRate: 0.1,
          rehydrateEvery: 17,
          expireAt: 200,
          resumeExpired,
          observe: aimedOnCurrentBoardTarget(0.6),
        }),
      ).toMatchSnapshot();
    });
  }
});
```
Run it twice: first writes `__snapshots__/hit-count.aimed.golden.test.ts.snap`; second Expected: PASS with no write. Open the snapshot and confirm `passes` > 0 in "doubles and bull" (the trace crosses a wrap).

- [ ] **Step 7: Engine mutation spot-check** — swap `wrap(advance(seat))` → `advance(seat)`: Expected the wrap test and the golden fail. Revert.

- [ ] **Step 8: Commit**
```bash
git add app/src/modules/training/exercises/types.ts app/src/modules/training/exercises/hit-count.engine.module.ts app/tests/modules/training/exercises/hit-count.engine.module.test.ts app/tests/modules/training/exercises/hit-count.aimed.golden.test.ts app/tests/modules/training/exercises/__snapshots__/hit-count.aimed.golden.test.ts.snap app/tests/modules/game/support/aimed-observations.ts scripts/check-engine-kernels.sh scripts/test-check-engine-kernels.sh scripts/engine-kernels.txt
git commit -m "feat(hit-count): Hit Count engine bound to the Track kernel"
```

---

### Task 6: Server wiring

**Files:**
- Create: `app/src/services/exercise-rulesets/hit-count/hit-count.validator.ts`
- Modify: `app/src/services/exercise-rulesets/registry.ts`, `app/src/services/types.ts`, `app/src/services/training-session.service.ts`, `app/src/pages/api/training-sessions/types.ts`
- Test: `app/tests/services/exercise-rulesets/hit-count.validator.test.ts`, `app/tests/services/exercise-rulesets/registry.test.ts`, `app/tests/services/training-session.service.test.ts`, `app/tests/pages/api/training-sessions/types.test.ts`

**Interfaces:**
- Produces: `hitCountValidator: ExerciseRulesetValidator`; `"HIT_COUNT"` in `TrainingStepResolved.exerciseTypeKey` (service + API Zod enums) and in `DART_EXERCISE_TYPE_KEYS`; `"HIT_COUNT_V1"` in the validator registry and `DART_WRITING_RULESET_VERSION_KEYS`.

- [ ] **Step 1: Write the failing tests**

`hit-count.validator.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { hitCountValidator } from "@services/exercise-rulesets/hit-count/hit-count.validator";

const BIG_TREBLES = {
  targets: [20, 19, 18, 17].map((number) => ({ kind: "TREBLE", number })),
  dartsPerTarget: 9,
};

describe("hitCountValidator", () => {
  it("accepts the Big Trebles template", () => {
    expect(hitCountValidator.validateConfig({ config: BIG_TREBLES })).toEqual({
      ok: true,
      config: BIG_TREBLES,
    });
  });

  it("names the path of a bad darts-per-target", () => {
    const result = hitCountValidator.validateConfig({
      config: { ...BIG_TREBLES, dartsPerTarget: 10 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toMatch(/^dartsPerTarget: /);
  });
});
```
(If `validateConfig`'s input type has more fields, copy the call shape from `random-checkout.validator.test.ts`.)

Append to `registry.test.ts`: `it("resolves HIT_COUNT_V1", …toBe(hitCountValidator))` in the resolver describe, and a new `it("is true for Hit Count", () => expect(exerciseRulesetWritesDarts("HIT_COUNT_V1")).toBe(true))` in `exerciseRulesetWritesDarts`.

Append to `pages/api/training-sessions/types.test.ts` two cases copied from the RANDOM_CHECKOUT ones with `exerciseTypeKey: "HIT_COUNT"`, `exerciseRulesetVersionKey: "HIT_COUNT_V1"`, `configuration: BIG_TREBLES`-shaped literal.

Append to `training-session.service.test.ts` a copy of "inserts RANDOM_CHECKOUT under the ANALYTICS/VISUAL_BOARD capture pair" named "inserts HIT_COUNT under the ANALYTICS/VISUAL_BOARD capture pair", with the Hit Count step (`exerciseTypeKey: "HIT_COUNT"`, `"HIT_COUNT_V1"`, the Big Trebles configuration, ids `"et-hc"`/`"erv-hc"`) and the same capture-pair assertions as the original (`captureModeId: 3`, `inputModeId: 4`).

- [ ] **Step 2: Run** `npm test -- tests/services/exercise-rulesets tests/services/training-session.service.test.ts tests/pages/api/training-sessions/types.test.ts`
Expected: FAIL — validator module missing; enums reject `HIT_COUNT`; capture pair null.

- [ ] **Step 3: Implement**

`hit-count.validator.ts`:
```ts
import { HitCountV1Config } from "@lib/training/exercises/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Hit Count v1 asserts the target list and darts per target parse —
 * trebles, doubles or the bullseye, a positive multiple of three darts each
 * (`docs/game-rules/training/exercises/hit-count.md`).
 */
export const hitCountValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = HitCountV1Config.safeParse(config);
    if (!parsed.success) {
      return {
        ok: false,
        issues: parsed.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      };
    }
    return { ok: true, config: parsed.data as Record<string, unknown> };
  },
};
```
`registry.ts`: import it; `HIT_COUNT_V1: hitCountValidator,` in `REGISTRY`; `"HIT_COUNT_V1",` in `DART_WRITING_RULESET_VERSION_KEYS`.
`services/types.ts`: `| "HIT_COUNT"` before `| "GAME"`.
`training-session.service.ts`: `"HIT_COUNT",` in `DART_EXERCISE_TYPE_KEYS`; add Hit Count to the JSDoc's list of dart exercises.
`pages/api/training-sessions/types.ts`: `"HIT_COUNT",` before `"GAME",` in both enums.

If fallow reports the validator as a duplicate of `target-scoring.validator.ts`, record a ruling and file a `discovered-work` issue for a shared Zod validator helper; do not refactor here.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add app/src/services app/src/pages/api/training-sessions/types.ts app/tests/services app/tests/pages/api/training-sessions/types.test.ts
git commit -m "feat(hit-count): server validator, keys and capture pair"
```

---

### Task 7: Seed `0038` and verification

**Files:**
- Create: `database/seeds/0038_hit_count_exercise_type.sql`, `database/verification/0038_hit_count_seed_checks.sql`
- Modify: `database/README.md` (seed list item 38, verification table row)

- [ ] **Step 1: Write the verification script first** (the failing check). Copy `database/verification/0036_random_checkout_seed_checks.sql` verbatim, then replace: `0036_random_checkout` → `0038_hit_count`; `RANDOM_CHECKOUT` → `HIT_COUNT`; `RANDOM_CHECKOUT_V1` → `HIT_COUNT_V1`; check 3's name → `'the system template pins HIT_COUNT_V1 with the Big Trebles configuration'` and its predicate:
```sql
    AND t.default_configuration = '{"targets":[{"kind":"TREBLE","number":20},{"kind":"TREBLE","number":19},{"kind":"TREBLE","number":18},{"kind":"TREBLE","number":17}],"dartsPerTarget":9}'::jsonb;
```
Header purpose lines: "the HIT_COUNT exercise type is published, its v1 ruleset belongs to it, the system template pins that ruleset with the Big Trebles configuration, and the template reaches the routine builder through v_exercise_template_catalog."

- [ ] **Step 2: Run against a database if one is reachable** (`DATABASE_URL` set): `psql "$DATABASE_URL" -f database/verification/0038_hit_count_seed_checks.sql`
Expected: checks 1–4 FAIL. With no `DATABASE_URL`, record a ledger note — CI's `integration.yml` seeds the chain; the script is proven in CI or by the user.

- [ ] **Step 3: Write the seed** — copy `0036_random_checkout_exercise_type.sql` and change:
  - header: `0038_hit_count_exercise_type.sql`; purpose "Insert the HIT_COUNT exercise type, its v1 ruleset and the Big Trebles system template … Rules: docs/game-rules/training/exercises/hit-count.md. No routine is seeded: V1 is a routine step only." Drop the draw-seed paragraph.
  - `exercise_types`: id `'0199a000-0000-7000-8000-00000000000c'`, key `'HIT_COUNT'`, name `'Hit Count'`, description `'A set number of darts at each target in a list, counting only the named bed; the list repeats until the time runs out.'`
  - `exercise_ruleset_versions`: id `'0199a100-0000-7000-8000-00000000000b'`, type id `…00c`, key `'HIT_COUNT_V1'`, description `'Initial hit count ruleset: fixed darts per target, a multiple of three; one point per hit in the named bed; passes repeat until time.'`
  - `exercise_templates`: id `'0199b000-0000-7000-8000-000000000012'`, type id `…00c`, ruleset subselect on `'HIT_COUNT_V1'`, name `'Big Trebles'`, description `'Nine darts each at T20, T19, T18 and T17. Count the trebles.'`, configuration the JSON from Step 1.

- [ ] **Step 4: Run** (if `DATABASE_URL`): `cd app && npm run db:seed && psql "$DATABASE_URL" -f ../database/verification/0038_hit_count_seed_checks.sql` — Expected: `ALL 4 CHECKS PASSED`; run `npm run db:seed` again — Expected: no error (idempotent). Without a database: ledger note.

- [ ] **Step 5: README** — item `38. \`seeds/0038_hit_count_exercise_type.sql\`` after item 37; verification row after the `0037_five_oh_one_v2` row:
```
| `verification/0038_hit_count_seed_checks.sql` | seed `0038`: the `HIT_COUNT` type is published, `HIT_COUNT_V1` is its version 1, the system template "Big Trebles" pins it with T20–T17, nine darts each, and `v_exercise_template_catalog` offers it (4 checks) (2026-10-17) |
```

- [ ] **Step 6: Commit**
```bash
git add database/seeds/0038_hit_count_exercise_type.sql database/verification/0038_hit_count_seed_checks.sql database/README.md
git commit -m "feat(hit-count): seed the HIT_COUNT type and Big Trebles template"
```

---

### Task 8: Stats

**Files:**
- Modify: `app/src/modules/stats/types.ts` (`DartExerciseKind`), `app/src/modules/stats/step-metrics.module.ts`, `app/src/modules/stats/sections/step-result.module.ts` (engine import), `app/src/lib/stats/replay-fold.ts` (engine import), `app/src/lib/stats/replay-presenters.ts` (`DARTS_METRIC_KEY`)
- Test: `app/tests/modules/stats/step-metrics.module.test.ts`, `app/tests/modules/stats/sections/step-result.module.test.ts`, `app/tests/lib/stats/replay-step-games.ts`, `app/tests/lib/stats/replay-fold-steps.test.ts`, `app/tests/integration/fixtures/stats-routine.ts`

**Interfaces:**
- Produces: `STEP_METRIC_SPECS.HIT_COUNT = { metrics: { hits: "sum", darts: "sum" }, headline: "hits", direction: "higher", rates: [["hits", "darts"]] }`; `stepMetrics("HIT_COUNT", state, facts)` → `{ hits: state.hits, darts: state.dartsThrown }`.

- [ ] **Step 1: Write the failing tests**

`step-metrics.module.test.ts` — in `fixtures()`, build a Hit Count engine like its siblings and append:
```ts
    {
      kind: "HIT_COUNT",
      state: hitCount.state(),
      facts: hitCount.facts(),
      expected: { hits: 2, darts: 4 },
    },
```
where `hitCount = hitCountEngineFactory.create({ targets: [{ kind: "TREBLE", number: 20 }], dartsPerTarget: 3 })` played with `T20, S20, T20, MISS` (use the file's own `dart` helper).

`replay-step-games.ts` — append to `EXERCISE_FIXTURES`:
```ts
  HIT_COUNT: {
    rulesetKey: "HIT_COUNT_V1",
    factory: hitCountEngineFactory,
    config: {
      targets: [{ kind: "TREBLE", number: 20 }, { kind: "BULL" }],
      dartsPerTarget: 3,
    },
    darts: [
      dart(20, "TREBLE"),
      dart(20, "SINGLE"),
      dart(null, "MISS"),
      dart(25, "INNER_BULL"),
    ],
  },
```
`replay-fold-steps.test.ts` — append a case modeled on the RANDOM_CHECKOUT one at line 74: `playExerciseKind("HIT_COUNT")`, expect `finalState` `hits` 2 and the replayed turn count 2.

`step-result.module.test.ts` — append a case modeled on line 175: two dart rows for session `"hc"`, `exerciseRulesetVersionKey: "HIT_COUNT_V1"`, configuration `{ targets: [{ kind: "TREBLE", number: 20 }], dartsPerTarget: 3 }`, darts `(1, 20, "TREBLE", 60)` and `(1, 20, "SINGLE", 20)` with `dartNumber` 1 and 2; expect `foldStepResult("HIT_COUNT", rows).metrics` `{ hits: 1, darts: 2 }`.

`integration/fixtures/stats-routine.ts` — append after the 501 step (sequence 11), so no existing step renumbers:
```ts
  exerciseStep(12, "HIT_COUNT", {
    targets: [{ kind: "TREBLE", number: 20 }],
    dartsPerTarget: 3,
  }),
```
and update the JSDoc above `ROUTINE_STEPS` ("the ten dart kinds … then a 501 game step, then Hit Count").

- [ ] **Step 2: Run** `npm test -- tests/modules/stats tests/lib/stats`
Expected: FAIL — `"HIT_COUNT"` not a `DartExerciseKind`; no spec.

- [ ] **Step 3: Implement**
  - `types.ts`: `| "HIT_COUNT"` in `DartExerciseKind`; JSDoc "nine" → "ten".
  - `step-metrics.module.ts`: the spec above in `STEP_METRIC_SPECS` and
    ```ts
        case "HIT_COUNT":
          return {
            hits: numberField(state, "hits", kind),
            darts: numberField(state, "dartsThrown", kind),
          };
    ```
  - `step-result.module.ts` and `replay-fold.ts`: `import "@modules/training/exercises/hit-count.engine.module";` in sorted position.
  - `replay-presenters.ts`: `HIT_COUNT: "darts",` in `DARTS_METRIC_KEY`.
  - `section-registry.ts` JSDoc "seven" stays as is (stale count — file a `discovered-work` issue rather than fixing).

- [ ] **Step 4: Run** `npm test -- tests/modules/stats tests/lib/stats` — Expected: PASS. If `DATABASE_URL` is set: `npm run test:integration -- statistics-sql` — Expected: PASS (the sweep now finds a `HIT_COUNT` step); else ledger note (CI proves it).

- [ ] **Step 5: Commit**
```bash
git add app/src/modules/stats app/src/lib/stats app/tests/modules/stats app/tests/lib/stats app/tests/integration/fixtures/stats-routine.ts
git commit -m "feat(hit-count): step metrics, step result and replay"
```

---

### Task 9: Routine summary, step adapter

**Files:**
- Modify: `app/src/modules/training/routines/routine-summary.module.ts`
- Create: `app/src/lib/training/routines/adapters/hit-count.adapter.ts`
- Modify: `app/src/lib/training/routines/adapters/types.ts`, `app/src/lib/training/routines/adapters/step-adapter.registry.ts`, `app/src/lib/training/routines/types.ts` (slot `hitCountEngine` on `RoutinePlayContext`)
- Test: `app/tests/modules/training/routines/routine-summary-engines.module.test.ts`, `app/tests/lib/training/routines/adapters/hit-count.adapter.test.ts`, `app/tests/lib/training/routines/adapters/step-adapter.registry.test.ts`

**Interfaces:**
- Produces: `summariseHitCount(state: HitCountState): RoutineStepSummary`; `hitCountAdapter` (`key "HIT_COUNT"`, `headerLabel "Hit Count"`, `title "Hit Count"`, `panel "hit-count"`); `StepAdapterKey` `| "HIT_COUNT"`; `StepPanel` `| "hit-count"`; `RoutinePlayContext.hitCountEngine: HitCountEngine | null`.

- [ ] **Step 1: Write the failing tests**

Summary (append):
```ts
  it("summariseHitCount reads hits, per-target hits, passes, darts and rate", () => {
    const engine = hitCountEngineFactory.create({
      targets: [
        { kind: "TREBLE", number: 20 },
        { kind: "DOUBLE", number: 16 },
      ],
      dartsPerTarget: 3,
    });
    [
      dart(20, "TREBLE"),
      dart(20, "SINGLE"),
      dart(20, "TREBLE"),
      dart(16, "DOUBLE"),
      dart(null, "MISS"),
      dart(null, "MISS"),
      dart(20, "TREBLE"),
    ].forEach((d) => engine.record(d));

    expect(summariseHitCount(engine.state())).toEqual({
      stepKey: "HIT_COUNT",
      label: "Hit Count",
      rows: [
        { label: "Hits", value: "4" },
        { label: "Hits on T20", value: "3" },
        { label: "Hits on D16", value: "1" },
        { label: "Passes", value: "1" },
        { label: "Darts", value: "7" },
        { label: "Hit rate", value: "57.14%" },
      ],
    });
  });

  it("summariseHitCount shows no rate before a dart", () => {
    const engine = hitCountEngineFactory.create({
      targets: [{ kind: "BULL" }],
      dartsPerTarget: 3,
    });
    expect(summariseHitCount(engine.state()).rows.at(-1)).toEqual({
      label: "Hit rate",
      value: "—",
    });
  });
```

`hit-count.adapter.test.ts` — copy `random-checkout.adapter.test.ts` and adapt: context slot `hitCountEngine`; `resultStub()` `exerciseTypeKey: "HIT_COUNT"`, `configuration` the Big Trebles object; assertions: key `"HIT_COUNT"`, headerLabel/title `"Hit Count"`, panel `"hit-count"`, `completesOwnSession` false; `open()` builds a `HitCountEngine` and calls `startStepTimer(600)`; `facts()` returns the engine's facts after one recorded dart; `summarise()` returns `stepKey "HIT_COUNT"`; `close()` nulls the slot; `summarise()`/`facts()` return null with no engine.

`step-adapter.registry.test.ts` — append a new `it` asserting `resolveStepAdapter("HIT_COUNT")?.title` is `"Hit Count"` and `STEP_ADAPTERS.HIT_COUNT` is `hitCountAdapter`. The existing key-list test and inline snapshot will now fail; per the append-only rule do not edit them — **Ruling expected here:** these two assertions enumerate every adapter by design, so they must gain the new key; record `Ruling: step-adapter registry exhaustive lists gain HIT_COUNT — the assertion is "one adapter per kind", the same guarantee — cost if wrong: none`. Update them by adding `"HIT_COUNT"` to the list and `"HIT_COUNT": "Hit Count"` to the inline snapshot only.

- [ ] **Step 2: Run** `npm test -- tests/modules/training/routines tests/lib/training/routines/adapters`
Expected: FAIL — `summariseHitCount` / adapter missing.

- [ ] **Step 3: Implement**

`routine-summary.module.ts`:
```ts
/**
 * Hit Count's result is its hits — overall, then per target in list order —
 * then passes and darts. The engine sums every pass, so no replay is needed.
 */
export function summariseHitCount(state: HitCountState): RoutineStepSummary {
  const { hits, darts } = stepMetrics("HIT_COUNT", state, NO_FACTS);
  return {
    stepKey: "HIT_COUNT",
    label: "Hit Count",
    rows: [
      { label: "Hits", value: String(hits) },
      ...state.hitsPerTarget.map((entry) => ({
        label: `Hits on ${boardTargetLabel(entry.target)}`,
        value: String(entry.hits),
      })),
      { label: "Passes", value: String(state.passes) },
      { label: "Darts", value: String(darts) },
      hitRateRow(hits, darts),
    ],
  };
}
```
(import `boardTargetLabel` from `@modules/game/board-progression.module`, `HitCountState` from `@modules/types`). If `RoutineStepSummary.stepKey` is a union, add `"HIT_COUNT"` to it.

`hit-count.adapter.ts`:
```ts
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { HitCountEngine } from "@modules/training/exercises/hit-count.engine.module";
import { summariseHitCount } from "@modules/training/routines/routine-summary.module";
import type { HitCountConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const hitCountAdapter: StepAdapter = {
  key: "HIT_COUNT",
  headerLabel: "Hit Count",
  title: "Hit Count",
  panel: "hit-count",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("HIT_COUNT_V1");
    const created = factory?.create(
      result.configuration as HitCountConfigData,
    );
    ctx.hitCountEngine = created instanceof HitCountEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.hitCountEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.hitCountEngine) return null;
    return summariseHitCount(ctx.hitCountEngine.state());
  },
  close(ctx) {
    ctx.hitCountEngine = null;
  },
};
```
`adapters/types.ts`: `| "HIT_COUNT"` (before the `GAME:` member), `| "hit-count"` in `StepPanel`. Registry: import and `HIT_COUNT: hitCountAdapter,`. `routines/types.ts`: import `HitCountEngine` type; `hitCountEngine: HitCountEngine | null;` after `randomCheckoutEngine`. `routine-play.data.ts`: `hitCountEngine: null,` in the initial object (so the type checks; the rest of the play wiring is Task 10).

- [ ] **Step 4: Run** the Step 2 command, then `npm run check`. Expected: PASS; 0 type errors.

- [ ] **Step 5: Commit**
```bash
git add app/src/modules/training/routines/routine-summary.module.ts app/src/lib/training/routines app/tests/modules/training/routines app/tests/lib/training/routines/adapters
git commit -m "feat(hit-count): routine summary and step adapter"
```

---

### Task 10: Play surface

**Files:**
- Modify: `app/src/lib/training/routines/routine-play.data.ts`, `app/src/lib/training/routines/types.ts`, `app/src/lib/training/routines/exercise-preview.ts`
- Create: `app/src/components/layout/training/exercises/HitCountPanel.astro`
- Modify: `app/src/pages/training/routines/play/index.astro`
- Test: `app/tests/lib/training/routines/routine-play.data.test.ts`, `app/tests/lib/training/routines/exercise-preview.test.ts`

**Interfaces:**
- Consumes: `hitCountEngine` slot (Task 9), `HitCountState`, `boardTargetLabel`.
- Produces on `RoutinePlayContext`: `recordHitCountDart(observation)`, `hitCountHits(): number`, `hitCountTargetLabel(): string`, `hitCountDartsLeft(): number`, `hitCountPasses(): number`, `hitCountRate(): string`; preview family `"hitCount"`; `VisitLabelInput.currentTargetLabel?: string`.

- [ ] **Step 1: Write the failing tests**

`exercise-preview.test.ts` — append:
```ts
describe("Hit Count preview", () => {
  const aimed = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
    intendedTargetNumber: number,
    intendedZoneKey: DartZoneKey,
  ) =>
    ({
      hitTargetNumber,
      hitZoneKey,
      intendedTargetNumber,
      intendedZoneKey,
    }) as DartFact;

  it("judges a hit only in the intended bed", () => {
    expect(judgeDart("hitCount", aimed(20, "TREBLE", 20, "TREBLE"))).toBe("hit");
    expect(judgeDart("hitCount", aimed(20, "SINGLE", 20, "TREBLE"))).toBe("miss");
    expect(judgeDart("hitCount", aimed(25, "OUTER_BULL", 25, "INNER_BULL"))).toBe("miss");
  });

  it("captions every slot with the current target", () => {
    expect(
      visitLabelsFor("hitCount", {
        config: null,
        visitIndex: 0,
        currentTargetNumber: undefined,
        currentTargetLabel: "T19",
        targetIndex: 1,
        dartsInOpenVisit: 0,
      }),
    ).toEqual(["T19", "T19", "T19"]);
  });
});
```
Also append a case to the existing `exerciseFamily` table test pattern: `exerciseFamily({ ...none, hitCountEngine: {} as never })` → `"hitCount"` (as a new `it`, since `none` will need the new key — add `hitCountEngine: null` to `none` only if the type forces it, and ledger that as a ruling).

`routine-play.data.test.ts` — append a `describe("routinePlay — Hit Count", …)` copied from the Random Checkout block's setup (`HIT_COUNT_STEP` with `exerciseTypeKey: "HIT_COUNT"`, `"HIT_COUNT_V1"`, configuration `{ targets: [{ kind: "TREBLE", number: 20 }, { kind: "BULL" }], dartsPerTarget: 3 }`), with cases:
  - start: `hitCountEngine` not null; `hitCountHits()` 0; `hitCountTargetLabel()` `"T20"`; `hitCountDartsLeft()` 3; `hitCountPasses()` 0; `hitCountRate()` `"—"`.
  - readouts: `T20, S20, T20` → hits 2, label `"BULL"`, left 3, rate `"66.67%"`; then `INNER_BULL, MISS, MISS` → passes 1, label `"T20"`.
  - preview: after `T20, S20` → `[{status:"hit",label:"T20"},{status:"miss",label:"T20"},{status:"empty",label:"T20"}]` (adjust to `previewSegments`' real shape for captioned slots — read one Target Scoring preview assertion in this file first).
  - board commit routes to the engine: `boardCommit.onCommit!(T20obs)` → `hitCountEngine!.state().dartsThrown` 1.
  - never completes on a dart (60 darts): `appendBatch` not called; `isComplete()` false.
  - deadline expires and uploads: `advanceTimersByTimeAsync(600_000)` → `appendBatch` called; `stepSummaries[0]` matches `{ stepKey: "HIT_COUNT" }`.

- [ ] **Step 2: Run** `npm test -- tests/lib/training/routines/routine-play.data.test.ts tests/lib/training/routines/exercise-preview.test.ts`
Expected: FAIL — methods/family missing.

- [ ] **Step 3: Implement**

`routines/types.ts`: `| "hitCount"` in `ExercisePreviewFamily`; `| "hitCountEngine"` in `ExerciseEngineSlots`; `currentTargetLabel?: string;` in `VisitLabelInput`; `| HitCountEngine` in `activeDartEngine`'s return type; method signatures for `recordHitCountDart` and the five readouts.

`exercise-preview.ts`:
```ts
function judgeIntendedBed(dart: DartFact): DartJudgement {
  return dart.hitTargetNumber === dart.intendedTargetNumber &&
    dart.hitZoneKey === dart.intendedZoneKey
    ? "hit"
    : "miss";
}

function hitCountCaptions(input: VisitLabelInput): Captions {
  const label = input.currentTargetLabel;
  return label === undefined ? noCaptions() : [label, label, label];
}
```
`["hitCountEngine", "hitCount"]` in `ENGINE_FAMILIES`; `hitCount: judgeIntendedBed` in `JUDGES`; `hitCount: hitCountCaptions` in `CAPTIONS`; extend `judgeDart`'s JSDoc with one clause ("Hit Count counts only the intended bed").

`routine-play.data.ts`:
  - import `type HitCountEngine` and `boardTargetLabel`;
  - board dispatch: insert `else if (self.hitCountEngine) self.recordHitCountDart(observation);` before the final `else`;
  - `activeDartEngine`: `| HitCountEngine` in the return type and `?? this.hitCountEngine` at the end of the chain;
  - `exerciseVisitLabels`: add `currentTargetLabel: this.hitCountTargetLabel() || undefined,` to the object passed to `visitLabelsFor`;
  - `startStepTimer` `onComplete`: `this.hitCountEngine?.expireTimer();`;
  - methods:
```ts
    /** Hit Count never ends on a dart; only the step deadline completes it. */
    recordHitCountDart(this: RoutinePlayContext, observation: DartObservation) {
      if (!this.hitCountEngine) return;
      this.hitCountEngine.record(observation);
    },

    hitCountHits(this: RoutinePlayContext): number {
      return this.hitCountEngine?.state().hits ?? 0;
    },

    hitCountTargetLabel(this: RoutinePlayContext): string {
      const target = this.hitCountEngine?.state().currentTarget;
      return target === undefined ? "" : boardTargetLabel(target);
    },

    hitCountDartsLeft(this: RoutinePlayContext): number {
      return this.hitCountEngine?.state().dartsLeftOnTarget ?? 0;
    },

    hitCountPasses(this: RoutinePlayContext): number {
      return this.hitCountEngine?.state().passes ?? 0;
    },

    hitCountRate(this: RoutinePlayContext): string {
      const state = this.hitCountEngine?.state();
      return !state || state.dartsThrown === 0
        ? "—"
        : accuracyDisplay(state.hits, state.dartsThrown);
    },
```
If fallow flags the board-dispatch arrow's complexity above 15, record a ruling and replace the `else if` chain with a lookup over `activeDartEngine()` (`this.activeDartEngine()?.record(observation)` plus Catch 40's completion check) in this task, with the existing dispatch tests proving it — that is work the step genuinely needs.

`HitCountPanel.astro`:
```astro
---
// Components
import ExercisePanelShell from "./ExercisePanelShell.astro";
---

<ExercisePanelShell
  score="hitCountHits()"
  caption="HITS"
  tiles={[
    { label: "Target", value: "hitCountTargetLabel()" },
    { label: "Left", value: "hitCountDartsLeft()" },
    { label: "Pass", value: "hitCountPasses() + 1" },
    { label: "Rate", value: "hitCountRate()" },
  ]}
/>
```
`play/index.astro`: import `HitCountPanel` beside the other panels and mount after the Random Checkout block:
```astro
        <template x-if="adapter?.panel === 'hit-count' && hitCountEngine">
          <HitCountPanel />
        </template>
```

- [ ] **Step 4: Run** the Step 2 command, then `npm test` (full suite) and `npm run check`. Expected: all PASS; 0/0/0.

- [ ] **Step 5: Commit**
```bash
git add app/src/lib/training/routines app/src/components/layout/training/exercises/HitCountPanel.astro app/src/pages/training/routines/play/index.astro app/tests/lib/training/routines
git commit -m "feat(hit-count): routine play surface and panel"
```

---

### Task 11: Docs and decision

**Files:**
- Modify: `decisions/game-engine.md` (append D469), `docs/architecture/04-Architecture-patterns.md` (version line → 1.11.8; Pattern 18 TRACK row), `docs/architecture/09-Training/01-Routines.md` (§17 Hit Count after Random Checkout), `docs/architecture/10-Statistics/01-Section-Catalog.md` (row), `docs/architecture/07-Frontend/08-Component-Inventory.md` (HitCountPanel row), `docs/architecture/00-File-Inventory.md` (new files + `decisions/game-engine.md` row count/summary), `docs/architecture/00-Context-Map-History.md` (row), `app/src/modules/training/CLAUDE.md`, `docs/game-rules/training/exercises/hit-count.md` (`Current version: V1`, `Exercise type` constant no longer "proposed")

- [ ] **Step 1: Decision** — `bash scripts/next-decision-id.sh` (Expected `D469`), append:
```
### D469 — Track exercises bind through trackExerciseSpec; one seed per engine PR
Status: Accepted · Date: 2026-10-17
Decision: a Track-family exercise is a `TrackExerciseDefinition` (key, parse, rules, initial ext, projection, intent) turned into a `DartExerciseSpec` by `modules/training/exercises/track-exercise-spec.module.ts`'s `trackExerciseSpec`, which folds the solo seat through `foldTrackDarts` and closes visits at three darts. `scripts/check-engine-kernels.sh` accepts `./<kernel>-exercise-spec.module` as a KERNEL_BOUND import. `BoardTarget` gains `TREBLE`. Track waves seed one file per engine PR. Hit Count is the first caller.
Reason: the third Track exercise reopened the Track spec §3 deferral: Hit Count, SwitchBlade and Doubles Lock differ only in rules and projection, so binding each by hand would repeat the seat setup, fold and visit rule three times. A seed per PR keeps every merged PR a playable type.
Consequences: Target Scoring and Switching Target Scoring still bind by hand until issue #993. SwitchBlade and Doubles Lock (T1.2, T1.3) use the helper. Spec: `docs/superpowers/specs/2026-10-17-track-wave-t1-design.md`; plan: `docs/superpowers/plans/2026-10-17-track-t1-hit-count.md`.
Supersedes: none.
```
Run `bash scripts/check-decision-ids.sh` — Expected: OK.

- [ ] **Step 2: Canonical docs**, minimal diffs, ISO dates:
  - Pattern 18: version `1.11.8 (Pattern 18: Hit Count, the first `trackExerciseSpec` exercise; `BoardTarget` gains TREBLE 2026-10-17, D469; prior 1.11.7: …)` — prepend, keep the prior chain; TRACK row's bound list gains "Hit Count".
  - Routines §17, after Random Checkout:
    ````markdown
    ## Hit Count

    Configuration:

    ```text
    duration: 15m

    targets:
        T20
        T19
        T18
        T17

    dartsPerTarget: 9
    ```

    A set number of darts at each target in turn, counting only the named bed — the treble, the double or the bullseye. After the last target the list starts again until the time runs out. Rules: `docs/game-rules/training/exercises/hit-count.md`.

    **Implemented** (`HIT_COUNT_V1`, `app/src/modules/training/exercises/hit-count.engine.module.ts`, seed `0038`): `targets` (1–21 of `{kind: "TREBLE"|"DOUBLE", number: 1–20}` or `{kind: "BULL"}`) and `dartsPerTarget` (a multiple of three, 3–99), bound to the Track kernel through `trackExerciseSpec` (D469). Each dart carries the target's number (`25` for the bull) and bed (`TREBLE`, `DOUBLE`, `INNER_BULL`); `score` is the board score. One turn per three-dart visit; the aim moves only between visits. State carries hits, hits per target summed over every pass, passes, the current target and darts left on it; the hit rate is derived at display. Time-bound only. Capture pair and upload path match Target Scoring (D277). Routine step only in V1; the seeded template is Big Trebles (D469).
    ````
  - Section catalog table: `| HIT_COUNT | hits, darts (sum) | hits ↑ | hits/darts |` after RANDOM_CHECKOUT.
  - Component inventory: `| \`HitCountPanel.astro\` | Hit Count play surface (2026-10-17): \`hitCountHits()\` HITS with Target / Left / Pass / Rate tiles — a call to \`ExercisePanelShell\` | none (reads the routine play page scope) |` after RandomCheckoutPanel.
  - File Inventory: rows for the seed, verification script, engine, `track-exercise-spec.module.ts`, validator, adapter (mirror the Random Checkout rows' wording and place); update the `decisions/game-engine.md` row (count +1, "D469 Track exercises bind through `trackExerciseSpec`, 2026-10-17").
  - Context-Map History: one row listing the changed files and "Hit Count V1 shipped on the Track kernel through `trackExerciseSpec`; `BoardTarget` TREBLE; policies `tallyOnTarget`, `advanceAfterDarts`, `passOnWrap`; the kernel gate accepts the exercise-spec import; seed `0038`. Track T1.1, D469 (2026-10-17)".
  - `modules/training/CLAUDE.md`: replace the sentence "There is no `trackExerciseSpec` adapter: … (Track spec §3)." with "A new Track exercise binds through `exercises/track-exercise-spec.module.ts`'s `trackExerciseSpec` (Hit Count); Target Scoring and Switching Target Scoring still bind by hand (#993). (2026-10-17, D469)"; add `hit-count` and `track-exercise-spec` to the file list paragraph.
  - Rules file: `Current version: V1`; Exercise type bullet "Type constant: `HIT_COUNT` (seed `0038`)".

- [ ] **Step 3: Run** `bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh && bash scripts/check-game-rules.sh && bash scripts/check-doc-sync.sh && bash scripts/check-decision-ids.sh`
Expected: all OK.

- [ ] **Step 4: Commit**
```bash
git add decisions/game-engine.md docs app/src/modules/training/CLAUDE.md
git commit -m "docs(hit-count): D469, routines, stats catalog, inventories"
```

---

### Task 12: Gates

- [ ] **Step 1:** `cd app && npm run format && npm run format:check` — commit any formatting diff (`style: format`).
- [ ] **Step 2:** `cd app && npm run validate:app` — Expected: exit 0, type gate 0/0/0, fallow clean.
- [ ] **Step 3:** run every script in the `run-all-gates` skill's "Always run" and "app/ changed" lists plus `bash scripts/test-check-engine-kernels.sh` and `bash scripts/check-engine-kernels.sh`. Expected: all OK. Record each result for the PR body.
- [ ] **Step 4:** `bash scripts/next-decision-id.sh` — if not `D470` (i.e. D469 was taken on `main` meanwhile), `bash scripts/renumber-decision.sh D469 <new>` and re-run Task 11 Step 3.
