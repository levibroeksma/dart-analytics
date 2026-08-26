# Dart Preview Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every per-dart recreational game mode (Bob's 27, Singles Training, Doubles Training, Shanghai, Around the Clock) shows all 3 dart-preview slots filled for 1.5s after the visit resolves — under every input mode, single-player and 1v1 — then clears them, via one shared mechanism instead of five independent copies.

**Architecture:** `play-lifecycle.ts` already owns the reveal-then-clear timer for 4 of 5 games; this plan (1) removes its input-mode branch so every mode gets the same 1.5s delay, (2) adds a shared `playPreviewSegments(turns, hiddenTurnKey, classify)` there to replace the 3 duplicated segment-computation functions and reshape the one already-shared helper (`doublesPathPreviewSegments`) onto it, and (3) migrates Bob's 27's hand-rolled lifecycle onto `play-lifecycle.ts`, deleting its independent copy of the same timer bug.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-26-dart-preview-hardening-design.md`.
- Timer duration stays **1500ms** (not 2000ms) — only the missing delay under tap/keypad input is the defect, not the duration.
- No `//`/`/* */` comments inside function bodies in `app/src/**/*.ts` (test files under `app/tests/` are exempt).
- Every `.ts` source change under `app/src/` must be accompanied by a touched test file that imports it (`scripts/check-test-coverage.sh`).
- A guarantee that changes (not merely a passing test) is re-pointed at the new guarantee, never loosened to keep the old assertion green.
- No inline comments (`//`) in Alpine `.astro` templates other than `{/* */}` — not touched by this plan.
- Run `cd app && npm test` after each task; run the full `npm run validate:app` before the final task.

---

### Task 1: Unify the reveal-then-clear timer in `play-lifecycle.ts`

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts:122-136` (inside `playCommitDart`)
- Test: `app/tests/lib/game/play-lifecycle.test.ts:731-807` (replace the `"playCommitDart — reveal-then-clear under VISUAL_BOARD"` describe block)

**Interfaces:**
- Consumes: nothing new.
- Produces: `playCommitDart(context, observation)` (unchanged signature) now always schedules `context.hiddenTimer = setTimeout(() => { context.hiddenTurnKey = clientKey }, 1500)` once a visit resolves, regardless of `context.$store.game.inputModeKey`.

- [ ] **Step 1: Write the failing tests**

Replace the entire `describe("playCommitDart — reveal-then-clear under VISUAL_BOARD", ...)` block (`app/tests/lib/game/play-lifecycle.test.ts:731-807`) with:

```ts
describe("playCommitDart — reveal-then-clear timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules hiddenTurnKey 1.5s after a resolving dart under VISUAL_BOARD", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.hiddenTurnKey).toBeNull();
    expect(context.hiddenTimer).not.toBeNull();

    vi.advanceTimersByTime(1500);

    expect(context.hiddenTurnKey).toBe("t1");
  });

  it("schedules the same 1.5s delay under a non-board input mode (tap/keypad)", async () => {
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.hiddenTurnKey).toBeNull();
    expect(context.hiddenTimer).not.toBeNull();

    vi.advanceTimersByTime(1499);
    expect(context.hiddenTurnKey).toBeNull();

    vi.advanceTimersByTime(1);
    expect(context.hiddenTurnKey).toBe("t1");
  });

  it("clears a still-pending hide timer before scheduling a new one", async () => {
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    const firstTimer = context.hiddenTimer;

    vi.advanceTimersByTime(1400);
    await playCommitDart(context, {
      hitTargetNumber: 2,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.hiddenTimer).not.toBe(firstTimer);

    vi.advanceTimersByTime(200);
    expect(context.hiddenTurnKey).toBeNull();

    vi.advanceTimersByTime(1300);
    expect(context.hiddenTurnKey).toBe("t2");
  });
});
```

- [ ] **Step 2: Run the tests to verify the second one fails**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts -t "reveal-then-clear timer"`
Expected: FAIL on `"schedules the same 1.5s delay under a non-board input mode"` — `context.hiddenTurnKey` is already `"t1"` before `advanceTimersByTime` runs (current code sets it synchronously outside `VISUAL_BOARD`).

- [ ] **Step 3: Implement the minimal fix**

In `app/src/lib/game/play-lifecycle.ts`, replace lines 122-136:

```ts
  const resolvedTurn = facts.turns.at(-1);
  if (resolvedTurn?.completedAt) {
    if (context.hiddenTimer) {
      clearTimeout(context.hiddenTimer);
      context.hiddenTimer = null;
    }
    if (context.$store.game.inputModeKey === "VISUAL_BOARD") {
      const clientKey = resolvedTurn.clientKey;
      context.hiddenTimer = setTimeout(() => {
        context.hiddenTurnKey = clientKey;
      }, 1500);
    } else {
      context.hiddenTurnKey = resolvedTurn.clientKey;
    }
  }
```

with:

```ts
  const resolvedTurn = facts.turns.at(-1);
  if (resolvedTurn?.completedAt) {
    if (context.hiddenTimer) {
      clearTimeout(context.hiddenTimer);
      context.hiddenTimer = null;
    }
    const clientKey = resolvedTurn.clientKey;
    context.hiddenTimer = setTimeout(() => {
      context.hiddenTurnKey = clientKey;
    }, 1500);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/play-lifecycle.ts app/tests/lib/game/play-lifecycle.test.ts
git commit -m "Unify dart-preview reveal timer across input modes"
```

---

### Task 2: Add shared `playPreviewSegments` + `PreviewSegment` type

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts` (imports + new export)
- Modify: `app/src/lib/game/types.ts` (new shared type)
- Test: `app/tests/lib/game/play-lifecycle.test.ts` (new describe block)

**Interfaces:**
- Consumes: `TurnFact`, `DartFact` from `@modules/types`.
- Produces:
  ```ts
  export type PreviewSegment = { status: "hit" | "miss" | "empty" };
  ```
  in `app/src/lib/game/types.ts`, and
  ```ts
  export function playPreviewSegments(
    turns: readonly TurnFact[],
    hiddenTurnKey: string | null,
    classify: (dart: DartFact, index: number) => "hit" | "miss",
  ): PreviewSegment[]
  ```
  in `app/src/lib/game/play-lifecycle.ts`. `classify` is only invoked once a non-hidden last turn exists, so a caller may safely assume that inside `classify` (e.g. read `turns.length - 1` as the current visit's index).

- [ ] **Step 1: Write the failing test**

Add to `app/tests/lib/game/play-lifecycle.test.ts`, after the `describe("playVisitMarkers", ...)` block (end of file):

```ts
describe("playPreviewSegments", () => {
  function turnWithDarts(
    clientKey: string,
    darts: TurnFact["darts"],
  ): TurnFact {
    return {
      clientKey,
      stageClientKey: "block-1",
      participantRef: "participant-1",
      sequence: 1,
      completedAt: "2026-08-14T00:00:00.000Z",
      totalScore: 0,
      darts,
    };
  }

  const DART: TurnFact["darts"][number] = {
    sequence: 1,
    intendedTargetNumber: 5,
    intendedZoneKey: "DOUBLE",
    hitTargetNumber: 5,
    hitZoneKey: "DOUBLE",
    score: 10,
    locationX: null,
    locationY: null,
  };

  it("returns 3 empty placeholders when there are no turns", () => {
    expect(playPreviewSegments([], null, () => "hit")).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("returns 3 empty placeholders when the last turn's key matches hiddenTurnKey", () => {
    const turns = [turnWithDarts("t1", [DART])];
    expect(playPreviewSegments(turns, "t1", () => "hit")).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("classifies each thrown dart and pads the remaining slots empty", () => {
    const turns = [turnWithDarts("t1", [DART, DART])];
    const classify = vi.fn((dart: typeof DART) =>
      dart.hitTargetNumber === 5 ? ("hit" as const) : ("miss" as const),
    );
    expect(playPreviewSegments(turns, null, classify)).toEqual([
      { status: "hit" },
      { status: "hit" },
      { status: "empty" },
    ]);
    expect(classify).toHaveBeenCalledTimes(2);
  });

  it("passes each dart's index within the turn to classify", () => {
    const turns = [turnWithDarts("t1", [DART, DART, DART])];
    const seenIndexes: number[] = [];
    playPreviewSegments(turns, null, (_dart, index) => {
      seenIndexes.push(index);
      return "hit";
    });
    expect(seenIndexes).toEqual([0, 1, 2]);
  });
});
```

Also add `playPreviewSegments` to the `@lib/game/play-lifecycle` import list at the top of the file (alongside `playVisitMarkers` etc.).

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts -t "playPreviewSegments"`
Expected: FAIL with `playPreviewSegments is not a function` / import error.

- [ ] **Step 3: Write the minimal implementation**

In `app/src/lib/game/types.ts`, add just above the existing `export type BoardMarker = {` (around line 125):

```ts
export type PreviewSegment = { status: "hit" | "miss" | "empty" };

```

In `app/src/lib/game/play-lifecycle.ts`, change the type-only import block at the top from:

```ts
import type { RulesetVersionKey, Seated } from "@lib/types";
import type { DartObservation, EngineFacts } from "@modules/types";
import type { GameEngine } from "@modules/interfaces";
import type {
  BoardMarker,
  PlayAgainOverrides,
  PlayLifecycleContext,
  PlayStoreContext,
} from "./types";
```

to:

```ts
import type { RulesetVersionKey, Seated } from "@lib/types";
import type {
  DartFact,
  DartObservation,
  EngineFacts,
  TurnFact,
} from "@modules/types";
import type { GameEngine } from "@modules/interfaces";
import type {
  BoardMarker,
  PlayAgainOverrides,
  PlayLifecycleContext,
  PlayStoreContext,
  PreviewSegment,
} from "./types";
```

Then add the new export directly after `playVisitMarkers` (after its closing `}` on the line before the `playUploadAndCompleteSession` JSDoc):

```ts
const EMPTY_PREVIEW_SEGMENTS: readonly PreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

/**
 * The open visit's 3-dart preview strip: the last turn's darts classified
 * hit/miss by the caller's own rule, padded to 3 placeholders, or all 3
 * empty once there is no turn yet or its reveal-then-clear timer
 * (`playCommitDart`) has fired. `classify` only runs once a turn exists, so
 * a caller may safely read state that assumes one (e.g. `turns.length - 1`
 * as the current visit's index).
 */
export function playPreviewSegments(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
  classify: (dart: DartFact, index: number) => "hit" | "miss",
): PreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey) {
    return [...EMPTY_PREVIEW_SEGMENTS];
  }
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return { status: classify(dart, i) };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/play-lifecycle.ts app/src/lib/game/types.ts app/tests/lib/game/play-lifecycle.test.ts
git commit -m "Add shared playPreviewSegments and PreviewSegment type"
```

---

### Task 3: Reshape `doublesPathPreviewSegments` onto the shared helper

**Files:**
- Modify: `app/src/lib/game/doubles-path-play.ts`
- Test: `app/tests/lib/game/doubles-path-play.test.ts`

**Interfaces:**
- Consumes: `playPreviewSegments` from Task 2, `PreviewSegment` type from Task 2.
- Produces: `doublesPathPreviewSegments(turns, hiddenTurnKey): PreviewSegment[]` — same name, same signature, same behavior as before (consumed unchanged by `bobs27-play.data.ts` and `doubles-training-play.data.ts`).

- [ ] **Step 1: Write the failing test**

Add to `app/tests/lib/game/doubles-path-play.test.ts`, inside the existing `describe("doublesPathPreviewSegments", ...)` block, after its last `it`:

```ts
  it("marks all 3 darts hit/miss once the visit holds 3 darts, with no padding", () => {
    const turns = [
      turnWithDarts("t1", [
        {
          sequence: 1,
          intendedTargetNumber: 5,
          intendedZoneKey: "DOUBLE",
          hitTargetNumber: 5,
          hitZoneKey: "DOUBLE",
          score: 10,
          locationX: null,
          locationY: null,
        },
        {
          sequence: 2,
          intendedTargetNumber: 5,
          intendedZoneKey: "DOUBLE",
          hitTargetNumber: null,
          hitZoneKey: "MISS",
          score: 0,
          locationX: null,
          locationY: null,
        },
        {
          sequence: 3,
          intendedTargetNumber: 5,
          intendedZoneKey: "DOUBLE",
          hitTargetNumber: 5,
          hitZoneKey: "DOUBLE",
          score: 10,
          locationX: null,
          locationY: null,
        },
      ]),
    ];
    expect(doublesPathPreviewSegments(turns, null)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "hit" },
    ]);
  });
```

- [ ] **Step 2: Run the test to verify it fails or passes against the current implementation**

Run: `cd app && npx vitest run tests/lib/game/doubles-path-play.test.ts`
Expected: PASS already (the pre-refactor implementation handles 3 darts correctly too) — this step confirms the new test is a genuine regression guard before the refactor, not a red step. Proceed to the refactor; re-run after to confirm it still passes unchanged.

- [ ] **Step 3: Refactor onto the shared helper**

In `app/src/lib/game/doubles-path-play.ts`, replace:

```ts
import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import type { BoardTarget, DartObservation, TurnFact } from "@modules/types";

type DoublesPathPreviewSegment = {
  status: "hit" | "miss" | "empty";
};

/** Shared by Bob's 27 and Doubles Training — both walk the same
 * BULL-terminated numeric doubles path (`doublesPath()`). */
export function doublesPathTargetLabel(target: BoardTarget): string {
  return target.kind === "BULL" ? "BULL" : `D${target.number}`;
}

const EMPTY_SEGMENTS: readonly DoublesPathPreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

export function doublesPathPreviewSegments(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): DoublesPathPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey) {
    return [...EMPTY_SEGMENTS];
  }
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    const onTarget =
      dart.hitTargetNumber === dart.intendedTargetNumber &&
      dart.hitZoneKey === dart.intendedZoneKey;
    return { status: onTarget ? "hit" : "miss" };
  });
}
```

with:

```ts
import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import { playPreviewSegments } from "@lib/game/play-lifecycle";
import type { BoardTarget, DartObservation, TurnFact } from "@modules/types";
import type { PreviewSegment } from "@lib/game/types";

/** Shared by Bob's 27 and Doubles Training — both walk the same
 * BULL-terminated numeric doubles path (`doublesPath()`). */
export function doublesPathTargetLabel(target: BoardTarget): string {
  return target.kind === "BULL" ? "BULL" : `D${target.number}`;
}

export function doublesPathPreviewSegments(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): PreviewSegment[] {
  return playPreviewSegments(turns, hiddenTurnKey, (dart) =>
    dart.hitTargetNumber === dart.intendedTargetNumber &&
    dart.hitZoneKey === dart.intendedZoneKey
      ? "hit"
      : "miss",
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/doubles-path-play.test.ts`
Expected: PASS, all tests in the file (including the pre-existing 2-dart cases and the new 3-dart case).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/doubles-path-play.ts app/tests/lib/game/doubles-path-play.test.ts
git commit -m "Reshape doublesPathPreviewSegments onto the shared preview helper"
```

---

### Task 4: Reshape Singles Training's preview onto the shared helper + regression test

**Files:**
- Modify: `app/src/lib/game/singles-training-play.data.ts`
- Test: `app/tests/lib/game/singles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `playPreviewSegments` from Task 2.
- Produces: `previewSegmentsFor(turns, config, hiddenTurnKey)` — same signature, same behavior, now delegating.

- [ ] **Step 1: Write the failing test**

In `app/tests/lib/game/singles-training-play.data.test.ts`, replace the test at lines 494-509 (`"hides the resolved visit's preview immediately, with no timer"`, inside the `describe("previewSegments", ...)` block) with a new sibling describe block placed immediately after that block's closing `});` (i.e. after line 510):

Remove:

```ts
  it("hides the resolved visit's preview immediately, with no timer", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});
```

Add in its place:

```ts
});

describe("previewSegments — reveal-then-clear timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps all 3 darts visible for 1.5s after the visit resolves, then clears", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "miss" },
    ]);

    vi.advanceTimersByTime(1500);

    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts -t "reveal-then-clear timer"`
Expected: FAIL — the current implementation clears the preview to all-empty in the same tick the 3rd dart resolves, so the first assertion (`hit`/`miss`/`miss`) does not match.

- [ ] **Step 3: Refactor `previewSegmentsFor` onto the shared helper**

In `app/src/lib/game/singles-training-play.data.ts`, add `playPreviewSegments` to the existing `@lib/game/play-lifecycle` import:

```ts
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
```

Replace:

```ts
function previewSegmentsFor(
  turns: readonly TurnFact[],
  config: SinglesSnapshot | null,
  hiddenTurnKey: string | null,
): SinglesPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey || !config) {
    return [...EMPTY_SEGMENTS];
  }
  const target = targetAt(numbersPath(config.targetOrder), turns.length - 1);
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return {
      status: trainingPointsFor(target, config, dart) > 0 ? "hit" : "miss",
    };
  });
}
```

with:

```ts
function previewSegmentsFor(
  turns: readonly TurnFact[],
  config: SinglesSnapshot | null,
  hiddenTurnKey: string | null,
): SinglesPreviewSegment[] {
  if (!config) return [...EMPTY_SEGMENTS];
  return playPreviewSegments(turns, hiddenTurnKey, (dart) => {
    const target = targetAt(numbersPath(config.targetOrder), turns.length - 1);
    return trainingPointsFor(target, config, dart) > 0 ? "hit" : "miss";
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/singles-training-play.data.ts app/tests/lib/game/singles-training-play.data.test.ts
git commit -m "Reshape Singles Training preview onto the shared helper"
```

---

### Task 5: Reshape Shanghai's preview onto the shared helper + regression test

**Files:**
- Modify: `app/src/lib/game/shanghai-play.data.ts`
- Test: `app/tests/lib/game/shanghai-play.data.test.ts`

**Interfaces:**
- Consumes: `playPreviewSegments` from Task 2.
- Produces: `previewSegmentsFor(turns, hiddenTurnKey)` — same signature, same behavior, now delegating.

- [ ] **Step 1: Write the failing test**

In `app/tests/lib/game/shanghai-play.data.test.ts`, replace the test at lines 550-565 (`"hides the resolved visit's preview once the 3rd dart lands"`, the last test inside `describe("previewSegments", ...)`) with a new sibling describe block after that block's closing `});` (after line 566):

Remove:

```ts
  it("hides the resolved visit's preview once the 3rd dart lands", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});
```

Add in its place:

```ts
});

describe("previewSegments — reveal-then-clear timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps all 3 darts visible for 1.5s after the visit resolves, then clears", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "miss" },
    ]);

    vi.advanceTimersByTime(1500);

    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/shanghai-play.data.test.ts -t "reveal-then-clear timer"`
Expected: FAIL — same same-tick-clear reason as Task 4.

- [ ] **Step 3: Refactor `previewSegmentsFor` onto the shared helper**

In `app/src/lib/game/shanghai-play.data.ts`, add `playPreviewSegments` to the existing `@lib/game/play-lifecycle` import:

```ts
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
```

Replace:

```ts
function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): ShanghaiPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey) {
    return [...EMPTY_SEGMENTS];
  }
  const targetNumber = targetNumberAt(turns.length - 1);
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return { status: dart.hitTargetNumber === targetNumber ? "hit" : "miss" };
  });
}
```

with:

```ts
function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): ShanghaiPreviewSegment[] {
  return playPreviewSegments(turns, hiddenTurnKey, (dart) => {
    const targetNumber = targetNumberAt(turns.length - 1);
    return dart.hitTargetNumber === targetNumber ? "hit" : "miss";
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/shanghai-play.data.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/shanghai-play.data.ts app/tests/lib/game/shanghai-play.data.test.ts
git commit -m "Reshape Shanghai preview onto the shared helper"
```

---

### Task 6: Reshape Around the Clock's preview onto the shared helper + regression test

**Files:**
- Modify: `app/src/lib/game/around-the-clock-play.data.ts`
- Test: `app/tests/lib/game/around-the-clock-play.data.test.ts`

**Interfaces:**
- Consumes: `playPreviewSegments` from Task 2.
- Produces: `previewSegmentsFor(config, turns, hiddenTurnKey)` — same signature, same behavior, now delegating. Around the Clock had no prior test for the reveal-timing guarantee at all (only hit/miss correctness), so this task adds new coverage rather than replacing an existing test.

- [ ] **Step 1: Write the failing test**

In `app/tests/lib/game/around-the-clock-play.data.test.ts`, add a new describe block immediately after the `describe("previewSegments", ...)` block closes (after line 483), and add `afterEach` to the file's vitest import (currently `import { describe, it, expect, vi, beforeEach } from "vitest";`):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
```

```ts
describe("previewSegments — reveal-then-clear timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps all 3 darts visible for 1.5s after the visit resolves, then clears", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "miss" },
    ]);

    vi.advanceTimersByTime(1500);

    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts -t "reveal-then-clear timer"`
Expected: FAIL — same same-tick-clear reason as Task 4.

- [ ] **Step 3: Refactor `previewSegmentsFor` onto the shared helper**

In `app/src/lib/game/around-the-clock-play.data.ts`, add `playPreviewSegments` to the existing `@lib/game/play-lifecycle` import:

```ts
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
```

Replace:

```ts
function previewSegmentsFor(
  config: Seated<AroundTheClockSnapshot>,
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): AroundTheClockPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey) {
    return [...EMPTY_SEGMENTS];
  }
  const priorDarts = turns
    .slice(0, -1)
    .reduce((total, turn) => total + turn.darts.length, 0);
  const hits = replayHits(config, turns);
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return { status: hits[priorDarts + i] ? "hit" : "miss" };
  });
}
```

with:

```ts
function previewSegmentsFor(
  config: Seated<AroundTheClockSnapshot>,
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): AroundTheClockPreviewSegment[] {
  const priorDarts = turns
    .slice(0, -1)
    .reduce((total, turn) => total + turn.darts.length, 0);
  const hits = replayHits(config, turns);
  return playPreviewSegments(turns, hiddenTurnKey, (_dart, i) =>
    hits[priorDarts + i] ? "hit" : "miss",
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/around-the-clock-play.data.ts app/tests/lib/game/around-the-clock-play.data.test.ts
git commit -m "Reshape Around the Clock preview onto the shared helper"
```

---

### Task 7: Add Doubles Training's reveal-timer regression test

**Files:**
- Test: `app/tests/lib/game/doubles-training-play.data.test.ts`

**Interfaces:**
- Consumes: nothing new — Doubles Training's `previewSegments()` already calls `doublesPathPreviewSegments`, which Task 3 already reshaped onto the shared helper. This task only adds the missing regression test; no source change.

- [ ] **Step 1: Write the failing test**

In `app/tests/lib/game/doubles-training-play.data.test.ts`, replace the test at lines 331-344 (`"hides the resolved visit's preview immediately, with no timer"`, inside the `describe("previewSegments", ...)` block) with a new sibling describe block after that block's closing `});` (after line 345):

Remove:

```ts
  it("hides the resolved visit's preview immediately, with no timer", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, true);

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});
```

Add in its place:

```ts
});

describe("previewSegments — reveal-then-clear timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the resolving dart visible for 1.5s after the visit resolves, then clears", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, true);

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "empty" },
      { status: "empty" },
    ]);

    vi.advanceTimersByTime(1500);

    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});
```

Note: a single `recordTap(true)` already resolves the visit in Doubles Training (a hit ends the visit on whichever dart it lands), matching the pre-existing test this replaces — this is why the "after" assertion only shows one filled slot, not three.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts -t "reveal-then-clear timer"`
Expected: FAIL — `previewSegments()` currently returns all-empty immediately after `recordTap(true)` because Task 3 has already unified the timer (Task 1) and reshaped `doublesPathPreviewSegments` (Task 3) by this point in the plan, so this is verifying, not fixing — if Tasks 1–3 landed correctly this test should already PASS. Treat a PASS here as confirmation, not a plan error; if it fails, re-check Tasks 1 and 3 landed as written before proceeding.

- [ ] **Step 3: No source change required**

Doubles Training's `previewSegments()` (`app/src/lib/game/doubles-training-play.data.ts`) already calls `doublesPathPreviewSegments(this.$store.game.turns, this.hiddenTurnKey)`, and `commitDart` already delegates to `playCommitDart`. Both were fixed in Tasks 1 and 3. No edit needed here.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add app/tests/lib/game/doubles-training-play.data.test.ts
git commit -m "Add Doubles Training reveal-timer regression test"
```

---

### Task 8: Migrate Bob's 27 onto the shared `play-lifecycle.ts`

**Files:**
- Modify: `app/src/lib/game/bobs27-play.data.ts`
- Modify: `app/src/lib/game/types.ts:642-687` (`Bobs27PlayContext` — no field/method removed, only satisfies `PlayLifecycleContext`'s shape, which it already does)
- Test: `app/tests/lib/game/bobs27-play.data.test.ts`

**Interfaces:**
- Consumes: `playInit`, `playCommitDart`, `playPreviewSegments`, `playUndoVisit`, `playVisitMarkers`, `playUploadAndCompleteSession`, `playBack`, `playAbandonAndExit`, `runPlayAgain`, `playRetryReconciliation` from `@lib/game/play-lifecycle` (all already used by `singles-training-play.data.ts` — same call shapes).
- Produces: `bobs27Play()`'s returned object keeps every method name and external signature unchanged (`init`, `commitDart`, `undoVisit`, `uploadAndCompleteSession`, `back`, `abandonAndExit`, `playAgain`, `previewSegments`, `visitMarkers`, `retryReconciliation`) — only their bodies change from hand-rolled to delegating.

- [ ] **Step 1: Write the failing tests**

Replace the `describe("reveal-then-clear under VISUAL_BOARD", ...)` block in `app/tests/lib/game/bobs27-play.data.test.ts` (lines 477-590) with:

```ts
describe("reveal-then-clear timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides the resolved visit's markers 1.5s after the 3rd dart under VISUAL_BOARD", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, hitAt(1));
    await play.recordDart.call(play, missAt(1));
    await play.recordDart.call(play, missAt(1));

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBeNull();
    expect(play.visitMarkers.call(play)).not.toEqual([]);

    vi.advanceTimersByTime(1500);

    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.visitMarkers.call(play)).toEqual([]);
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("keeps all 3 darts visible for 1.5s under tap input too, then clears", async () => {
    const play = makePlay({ inputModeKey: "DETAILED_DARTS" });
    await play.init.call(play);

    await play.recordTap.call(play, true);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBeNull();
    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "miss" },
    ]);

    vi.advanceTimersByTime(1500);

    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("undoVisit cancels a pending hide timer so a reopened visit stays visible", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    await play.recordDart.call(play, hitAt(1));
    await play.recordDart.call(play, missAt(1));
    await play.recordDart.call(play, missAt(1));

    vi.advanceTimersByTime(1000);
    play.undoVisit.call(play);
    vi.advanceTimersByTime(1000);

    expect(play.hiddenTurnKey).toBeNull();
  });

  it("undoVisit clears an already-set hiddenTurnKey", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    await play.recordDart.call(play, hitAt(1));
    await play.recordDart.call(play, missAt(1));
    await play.recordDart.call(play, missAt(1));
    vi.advanceTimersByTime(1500);
    expect(play.hiddenTurnKey).not.toBeNull();

    play.undoVisit.call(play);

    expect(play.hiddenTurnKey).toBeNull();
  });

  it("clears a still-pending hide timer before scheduling a new one, so a fast second visit never leaks the first timer", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, true);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    const firstTimer = play.hiddenTimer;

    vi.advanceTimersByTime(1400);

    await play.recordTap.call(play, true);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.hiddenTimer).not.toBe(firstTimer);

    vi.advanceTimersByTime(200);
    expect(play.hiddenTurnKey).toBeNull();

    vi.advanceTimersByTime(1300);

    expect(play.hiddenTurnKey).toBe(play.$store.game.turns[1].clientKey);
  });
});
```

Also update the `describe("previewSegments", ...)` block's 3rd test (`"marks an off-target on-board dart as a miss even though its zone isn't literally MISS"`, lines 458-474) — it currently reads `play.previewSegments.call(play)` synchronously right after one board dart, which stays correct (the reveal timer only fires once the *visit* resolves, i.e. after 3 darts) — no change needed there.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts -t "reveal-then-clear timer"`
Expected: FAIL on `"keeps all 3 darts visible for 1.5s under tap input too, then clears"` — the current hand-rolled `commitDart` sets `hiddenTurnKey` synchronously outside `VISUAL_BOARD`.

- [ ] **Step 3: Migrate `bobs27-play.data.ts` onto `play-lifecycle.ts`**

Replace the full contents of `app/src/lib/game/bobs27-play.data.ts` with:

```ts
import { getEngineFactory } from "@modules/game/engine.registry";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import {
  doublesPathObservation,
  doublesPathPreviewSegments,
  doublesPathTargetLabel,
} from "@lib/game/doubles-path-play";
import { boardInputData } from "@lib/game/board-input.data";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import type { RulesetVersionKey } from "@lib/types";
import type { Bobs27State, DartObservation, TurnFact } from "@modules/types";
import type { BoardMarker } from "./types";
import type { Bobs27PlayContext, Bobs27PreviewSegment } from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// bobs27EngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { Bobs27Engine } from "@modules/game/bobs27.engine.module";

const GAME_TYPE_KEY = "BOBS27";
const RULESET_VERSION_KEY: RulesetVersionKey = "BOBS27_V1";

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
function ownerRef(
  seats: readonly { participantRef: string; participantTypeKey: string }[],
): string | null {
  return (
    seats.find((seat) => seat.participantTypeKey === "PLAYER")
      ?.participantRef ?? null
  );
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Mirrors
 * `five-oh-one-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: Bobs27PlayContext["$store"]["game"],
): Bobs27Engine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof Bobs27Engine ? engine : null;
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` — see
 * `five-oh-one-play.data.ts`'s identical comment for the full reasoning.
 */
export function bobs27Play() {
  let self: Bobs27PlayContext;

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
    resultsSnapshot: null as {
      status: "WON" | "LOST";
      score: number;
      darts: number;
      doubleHitRate: string;
      highestNumberReached: string;
      winningSideKey: string | null;
    } | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as Bobs27Engine | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    state(this: Bobs27PlayContext): Bobs27State | null {
      return this.engine?.state() ?? null;
    },

    currentTargetLabelFor(this: Bobs27PlayContext, seatRef: string): string {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
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
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? String(seat.score) : "";
    },

    currentScore(this: Bobs27PlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentScoreFor(state.activeParticipantRef);
    },

    previewSegments(this: Bobs27PlayContext): Bobs27PreviewSegment[] {
      return doublesPathPreviewSegments(
        this.$store.game.turns,
        this.hiddenTurnKey,
      );
    },

    /** Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation. */
    visitMarkers(this: Bobs27PlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    init(this: Bobs27PlayContext) {
      self = this;
      return playInit(this, GAME_TYPE_KEY, resumeEngine);
    },

    retryReconciliation(this: Bobs27PlayContext) {
      return playRetryReconciliation(this);
    },

    /** The recreational tap row's entry point: synthesizes the observation
     * for a hit or miss on the current target and funnels it through
     * `commitDart`, exactly as the board's per-dart `recordDart` does. */
    async recordTap(this: Bobs27PlayContext, hit: boolean) {
      if (!this.engine || this.finished) return;
      const state = this.state();
      const activeSeat = state?.seats.find(
        (seat) => seat.participantRef === state.activeParticipantRef,
      );
      if (!activeSeat) return;
      const target = targetAt(doublesPath(), activeSeat.targetIndex);
      await this.commitDart(doublesPathObservation(target, hit));
    },

    async recordDart(this: Bobs27PlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    commitDart(this: Bobs27PlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    undoVisit(this: Bobs27PlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: Bobs27PlayContext): Promise<void> {
      const owner = ownerRef(this.$store.game.seats);
      return playUploadAndCompleteSession(this, (finalState) =>
        computeStats(finalState, this.$store.game.turns, owner),
      );
    },

    back(this: Bobs27PlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: Bobs27PlayContext) {
      return playAbandonAndExit(this);
    },

    /**
     * Replays the same configuration template the first session used, with
     * no overrides — V1 has zero editable settings.
     */
    playAgain(this: Bobs27PlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof Bobs27Engine ? engine : null,
      );
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts`
Expected: PASS, all tests in the file — including `init`, `currentTargetLabel`, `currentScore`, `recordTap`, `completion`, `previewSegments`, `back`, `abandonAndExit`, `playAgain`, and `bobs27Play — per-seat accessors` describes, none of which change behavior.

- [ ] **Step 5: Run the full frontend suite and type gate**

Run: `cd app && npm test`
Expected: PASS, full suite green (this migration touches a widely-imported module; confirm nothing else regressed).

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/bobs27-play.data.ts app/tests/lib/game/bobs27-play.data.test.ts
git commit -m "Migrate Bob's 27 onto the shared play-lifecycle module"
```

---

### Task 9: Architecture docs — Pattern 19, Component Inventory, decision, finding

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md`
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md`
- Modify: `decisions/frontend/alpine.md`
- Modify: `FINDINGS.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add Pattern 19 to `04-Architecture-patterns.md`**

Insert, after `# Pattern 18 — Game Engine Contract`'s own content ends (after the "Registration is two-sided..." paragraph and its trailing `---`, i.e. immediately before `# Pattern Adoption Process`):

````markdown
# Pattern 19 — Shared Reveal-Then-Clear Preview

## Principle

A per-dart game mode's visit preview is one shared mechanism, not a
per-ruleset reimplementation.

## Pattern

```
commitDart
    ↓
playCommitDart (play-lifecycle.ts) — uniform 1500ms reveal-then-clear
timer, regardless of input mode
    ↓
hiddenTurnKey
    ↓
playPreviewSegments(turns, hiddenTurnKey, classify) — gate + pad to 3
    ↓
VisitPreview.astro
```

## Application

- Timer duration and the hidden/empty gate live once in `play-lifecycle.ts`
  (`playCommitDart`, `playPreviewSegments`). A new per-dart game mode
  supplies only a `classify(dart, index) => "hit" | "miss"` callback — never
  its own timer or its own 3-empty-placeholder gate.
- The mechanism is turn/seat-scoped, not player-count-scoped: single-player
  and 1v1 both read `$store.game.turns`/`hiddenTurnKey` identically, so a
  future 2v2 (once its `sideKey`-group work lands) needs no special case
  here either.
- `VisitPreview.astro` stays markup-only, reading `previewSegments()` off
  the page's own Alpine scope — it never depends on which classifier the
  page used.

## Rule

Detail lives in `app/src/lib/game/play-lifecycle.ts` and
`07-Frontend/04-Modules-And-OOP.md`.

---
````

- [ ] **Step 2: Update `08-Component-Inventory.md`'s `VisitPreview.astro` row**

In `docs/architecture/07-Frontend/08-Component-Inventory.md`, replace:

```markdown
| `VisitPreview.astro` | Three-dart preview strip for the open visit | none |
```

with:

```markdown
| `VisitPreview.astro` | Three-dart preview strip for the open visit; every adopter builds its `previewSegments()` via the shared `playPreviewSegments()` (Pattern 19) | none |
```

- [ ] **Step 3: Append a decision to `decisions/frontend/alpine.md`**

Run: `git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md decisions/**/*.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1`
Note the printed number as `N`; the new decision id is `N + 1`.

Append to the end of `decisions/frontend/alpine.md` (after its existing last block):

```markdown
### D<N+1> — Unify the dart-preview reveal timer across input modes
Status: Accepted · Date: 2026-08-26
Decision: `play-lifecycle.ts`'s reveal-then-clear timer (`playCommitDart`) no
longer branches on `inputModeKey`. Every input mode gets the same 1500ms
delay between a visit resolving and its preview clearing. Bob's 27's
previously independent, hand-rolled copy of this same timer is deleted; it
now delegates to `play-lifecycle.ts` like every other per-dart game mode.
Reason: the branch's non-`VISUAL_BOARD` path set `hiddenTurnKey` in the same
tick the 3rd dart was recorded, before Alpine's reactive effects repaint —
so tap/keypad input (the recreational entry path for Bob's 27, Singles
Training, Doubles Training, Shanghai, and Around the Clock) never actually
rendered the 3rd dart's preview. This was an accidental divergence between
input modes, not a deliberate design choice.
Consequences: every per-dart game mode's preview now behaves identically
regardless of input mode or seat count. `playPreviewSegments()` (a new
shared export alongside the timer) replaces 3 duplicated segment-computation
functions and reshapes the pre-existing shared `doublesPathPreviewSegments`
helper onto the same gate. See Pattern 19,
`docs/architecture/04-Architecture-patterns.md`.
```

- [ ] **Step 4: Add a finding for the un-unified `*PlayContext` type shapes**

In `FINDINGS.md`, bump `highest-issued: F28` to `highest-issued: F29` in the front matter, and append:

```markdown
### F29 — 5 near-identical `*PlayContext` types restate `PlayLifecycleContext`'s shape instead of reusing it
Status: Open · Found: 2026-08-26 · Task: claude/dart-previews-architecture-9tomxf
Claim: `Bobs27PlayContext`, `SinglesTrainingPlayContext`, `DoublesTrainingPlayContext`, `ShanghaiPlayContext`, and `AroundTheClockPlayContext` (all in `app/src/lib/game/types.ts`) each hand-declare `hiddenTurnKey`, `hiddenTimer`, `loading`, `error`, `finished`, and the rest of `PlayLifecycleContext<TConfig, TEngine, TResults>`'s fields, rather than being defined in terms of it
Evidence: `app/src/lib/game/types.ts` — compare `PlayLifecycleContext` (around line 181) against any of the 5 named types; each restates the same ~15 fields verbatim with only `TConfig`/`TEngine`/`TResults` substituted by hand
Impact: a future field added to the shared lifecycle contract (e.g. a new timer or status field) must be hand-copied into 5 places instead of one; noticed while extracting `playPreviewSegments`/unifying the reveal timer (this task), but a full generic-based unification is a separate, larger type-level refactor outside this task's scope
Proposed: define each `*PlayContext` as `PlayLifecycleContext<XxxSnapshot, XxxEngine, XxxResultsSnapshot> & { <per-game methods> }` instead of a fully hand-written object type, once a task is scoped to take on that refactor across all 5 files at once
```

- [ ] **Step 5: Run the docs gates**

Run: `bash scripts/check-context-map.sh && bash scripts/check-decision-ids.sh && bash scripts/check-findings-log.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/04-Architecture-patterns.md docs/architecture/07-Frontend/08-Component-Inventory.md decisions/frontend/alpine.md FINDINGS.md
git commit -m "Document the shared reveal-then-clear preview pattern"
```

---

### Task 10: Final validation and context maintenance

**Files:** none (verification only).

- [ ] **Step 1: Run the full validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type gate reports 0 errors, 0 warnings, 0 hints; `npx fallow` exits 0.

- [ ] **Step 2: Run the format check**

Run: `cd app && npm run format:check`
Expected: clean (no diff). If not: `npm run format`, then re-stage and amend the relevant task's commit is not allowed by policy — instead create one more commit with the formatting fixes.

- [ ] **Step 3: Run the `context-maintenance` skill**

Invoke the `context-maintenance` skill per root `CLAUDE.md`'s mandatory rule. Confirm: `00-Context-Map.md`/`00-File-Inventory.md` need no new rows (no files added/moved/renamed/deleted — only Task 9's in-place edits), the decision and finding land correctly, and the branch is ready for its PR.

- [ ] **Step 4: Push the branch**

Run: `git push -u origin claude/dart-previews-architecture-9tomxf`
Expected: branch updated on `origin`.

---

## Self-Review Notes

- **Spec coverage:** §1 timer unification → Task 1. §2 shared segment computation + `PreviewSegment` type → Task 2. §3 Bob's 27 migration → Task 8. §4 edge cases (undo/back/abandon mid-reveal) → verified unchanged by Task 1 (no `clearTimeout` call sites touched) and re-asserted by Task 8's `undoVisit` tests. §5 architecture hardening (Pattern 19, component inventory, decision, finding) → Task 9. §Testing → one task per game mode (3–7) plus Task 1/2's own unit tests plus Task 8's rewritten suite. §Non-goals (2000ms, gate script, 2v2 code, deep `*PlayContext` refactor) → none added; Task 9 Step 4 logs the type-shape finding instead of fixing it.
- **Placeholder scan:** no TBD/TODO; every step shows the literal code or exact command.
- **Type consistency:** `playPreviewSegments(turns, hiddenTurnKey, classify)` — same 3-argument signature and `classify: (dart: DartFact, index: number) => "hit" | "miss"` shape used identically in Tasks 2 (definition), 3 (doubles path), 4 (Singles), 5 (Shanghai), 6 (Around the Clock), 8 (Bob's 27, via `doublesPathPreviewSegments`). `PreviewSegment` defined once in Task 2, consumed structurally by all 5 games' existing per-game aliases with no further edits needed (structurally identical shape, so no forced rename of call sites).
