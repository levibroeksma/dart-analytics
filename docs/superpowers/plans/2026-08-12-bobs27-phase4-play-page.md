# Bob's 27 Phase 4 — Play Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Bob's 27 fully playable — visit preview, recreational tap input, analytics/board input with a reveal-then-clear delay, and a Won/Lost results modal — replacing Phase 3's static play-page placeholder.

**Architecture:** One new Alpine data module (`bobs27-play.data.ts`) owns the game loop (record → mirror → complete), spreading the existing `boardInputData()` factory and overriding only `visitMarkers()` to respect a local reveal-then-clear gate. Four new `.astro` components (visit preview, recreational tap row, the assembled interface, the results modal) are presentational only, mirroring `FiveOhOne`'s established shapes. The play page itself swaps back from Phase 3's `AppLayout` placeholder to `GameLayout`, mirroring `pages/games/501/play/index.astro`'s shell minus the double-checkout/match-finish confirm dialogs Bob's 27 doesn't need.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Vitest.

## Global Constraints

- Bob's 27 has no bust/double ambiguity — every tap or board hit is unambiguous, so **no confirm dialogs** (`showDoubleConfirm`/`showMatchFinishConfirm`-style gates) anywhere in this phase.
- `BoardInputPanel.astro` and `board-input.data.ts` are reused **unchanged** — no edits to either file. The 1.5s reveal-then-clear logic lives entirely in `bobs27-play.data.ts`, overriding `visitMarkers()` after spreading `...boardInputData(...)` (object-literal key order means the later definition wins).
- Zero-editable-settings pattern from Phase 3 continues: any session Bob's 27 creates (including `playAgain`) sends `config: { source: "template", templateRef }` with **no `overrides` key** — `ConfigInput.overrides` is optional and a missing key is treated as `{}`.
- `.astro` markup is not unit-tested in this codebase (D101, `app/CLAUDE.md`) — every task that only adds/edits `.astro` files has no TDD step.
- No new decision-ledger entry: per the design spec's cross-phase notes, Phase 1's `decisions/game-engine.md` entry is the only ledger write across all four phases — Phases 2-4 are mechanical extension of already-decided patterns (D196, D198, D201).
- The double's **board value** (D16 hit → +32, bull → +50) is already the corrected Phase 1 formula (`bobs27.engine.module.ts`'s `pointValueOf`) — nothing in this phase touches that function.
- Visit preview caption row reads literally "D1", "D2", "D3" (three static labels under the three dart segments) — not dynamic per-target text.
- Recreational input's miss button reads literally "MIS".
- The design spec's phrase "headlined Won/Lost off the engine's `result()`" has no literal `result()` method on `Bobs27Engine` — the engine exposes `state().status: "IN_PROGRESS" | "WON" | "LOST"` instead. This plan treats `state().status`, captured into `resultsSnapshot` at completion time (before any store reset), as that single source of truth — not a deviation, since no `result()` method exists to call.
- Every task in this plan runs against Phase 3's already-merged `BOBS27_V1` capability declaration (`RECREATIONAL`+`DETAILED_DARTS`, `ANALYTICS`+`VISUAL_BOARD`) and setup flow — nothing here changes `capabilities.ts`, `games-visibility.ts`, or the setup page/data module.
- Run the `run-all-gates` skill and the mandatory `context-maintenance` skill before this branch is considered done (root `CLAUDE.md`).

---

### Task 1: `bobs27-play.data.ts` — play-page data module

**Files:**
- Create: `app/src/lib/game/bobs27-play.data.ts`
- Modify: `app/src/lib/game/types.ts` — add `Bobs27PlayContext` and `Bobs27PreviewSegment`, add `Bobs27Snapshot` and `Bobs27Engine` to the existing import blocks
- Modify: `app/src/lib/client/alpine/register-route-data.ts` — register `bobs27Play`
- Test: `app/tests/lib/game/bobs27-play.data.test.ts`

**Interfaces:**
- Consumes: `Bobs27Engine`/`bobs27EngineFactory` (`@modules/game/bobs27.engine.module`), `boardInputData`/`markersForTurns` (`@lib/game/board-input.data`), `doublesPath`/`targetAt`/`BULL_TARGET_NUMBER` (`@modules/game/board-progression.module`), `resolveSessionModePair` (`@lib/game/session-mode-resolution`), `reconcileActiveSession` (`@lib/game/session-recovery`), `getEngineFactory` (`@modules/game/engine.registry`), `appendBatch`/`completeSession`/`createSession`/`fetchActiveSessions` (`@client/api/sessions`), `buildEventsBatch` (`@modules/game/events.payload.module`).
- Produces: `bobs27Play()` factory (registered as Alpine data `"bobs27Play"`), consumed by Task 4's interface component, Task 5's results modal, and Task 6's play page. Exposes on `this`: `loading`, `error`, `finished`, `hasActiveSession`, `loadingReconciliation`, `reconciliationFailed`, `completionStatus`, `completionError`, `playAgainError`, `playAgainLoading`, `resultsSnapshot: { status: "WON" | "LOST"; score: number; darts: number } | null`, `hiddenTurnKey: string | null`, `engine: Bobs27Engine | null`, plus methods `currentTargetLabel()`, `previewSegments()`, `init()`, `retryReconciliation()`, `recordTap(hit: boolean)`, `recordDart(observation)`, `commitDart(observation)`, `undoVisit()`, `uploadAndCompleteSession()`, `back()`, `playAgain()`, `abandonAndExit()`, plus everything `boardInputData(...)` spreads in (`board`, `onPointerDown`/`onPointerMove`/`onPointerUp`/`onPointerCancel`, `recordUnseen`, `magnifierAnchor`/`magnifierBox`/`magnifierBoard`/`magnifierLabel`/`magnifierRead`, and `visitMarkers()` overridden below).

- [ ] **Step 1: Add `Bobs27PlayContext` and `Bobs27PreviewSegment` to `app/src/lib/game/types.ts`**

First, extend the two existing import blocks near the top of the file:

```ts
import type { FiveOhOneEngine } from "@modules/game/five-oh-one.engine.module";
import type { Bobs27Engine } from "@modules/game/bobs27.engine.module";
```

(add the `Bobs27Engine` line directly below the existing `FiveOhOneEngine` import), and:

```ts
import type {
  ModePair,
  RulesetVersionKey,
  ScoreTrainingSnapshot,
  FiveOhOneSnapshot,
  Bobs27Snapshot,
} from "./rulesets/types";
```

(add `Bobs27Snapshot` to the existing named-import list).

Then add the following after `FiveOhOnePlayContext`'s closing `};` and before `GamesIndexContext`:

```ts
/** One dart slot in Bob's 27's shared visit preview — a resolved hit/miss mark, or a not-yet-thrown placeholder. */
export type Bobs27PreviewSegment = { status: "hit" | "miss" | "empty" };

export type Bobs27PlayContext = {
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: {
    status: "WON" | "LOST";
    score: number;
    darts: number;
  } | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<Bobs27Snapshot>;
  engine: Bobs27Engine | null;
  currentTargetLabel(this: Bobs27PlayContext): string;
  previewSegments(this: Bobs27PlayContext): Bobs27PreviewSegment[];
  init(this: Bobs27PlayContext): Promise<void>;
  retryReconciliation(this: Bobs27PlayContext): Promise<void>;
  recordTap(this: Bobs27PlayContext, hit: boolean): Promise<void>;
  recordDart(
    this: Bobs27PlayContext,
    observation: DartObservation,
  ): Promise<void>;
  commitDart(
    this: Bobs27PlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: Bobs27PlayContext): void;
  uploadAndCompleteSession(this: Bobs27PlayContext): Promise<void>;
  back(this: Bobs27PlayContext): Promise<void>;
  playAgain(this: Bobs27PlayContext): Promise<void>;
  abandonAndExit(this: Bobs27PlayContext): Promise<void>;
};
```

- [ ] **Step 2: Write the failing test file `app/tests/lib/game/bobs27-play.data.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@client/api/sessions", () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
  createSession: vi.fn(),
}));

import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import {
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import { bobs27EngineFactory } from "@modules/game/bobs27.engine.module";
import { bobs27Play } from "@lib/game/bobs27-play.data";
import type { Bobs27PlayContext, Bobs27Snapshot } from "@lib/types";
import type { DartFact, DartObservation, StageFact, TurnFact } from "@modules/types";

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "BOBS27",
  gameTypeName: "Bob's 27",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "BOBS27_V1",
  startedAt: "now",
} as const;

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function defaultConfig(): Bobs27Snapshot {
  return { startScore: 27, bullHitValue: 50, missPenaltyMultiplier: 1 };
}

function hitAt(number: number): DartObservation {
  return { hitTargetNumber: number, hitZoneKey: "DOUBLE", locationX: 10, locationY: 20 };
}

function missAt(number: number): DartObservation {
  return { hitTargetNumber: number, hitZoneKey: "MISS", locationX: 10, locationY: 20 };
}

/** One prior turn holding 60 hit darts (3 per double, D1..D20), so a fresh
 * engine rehydrated from it starts exactly at BULL, in progress. */
function priorTurnsThroughBull(): TurnFact[] {
  const darts: DartFact[] = [];
  let sequence = 1;
  for (let number = 1; number <= 20; number += 1) {
    for (let i = 0; i < 3; i += 1) {
      darts.push({
        sequence,
        intendedTargetNumber: number,
        intendedZoneKey: "DOUBLE",
        hitTargetNumber: number,
        hitZoneKey: "DOUBLE",
        score: number * 2,
        locationX: null,
        locationY: null,
      });
      sequence += 1;
    }
  }
  return [
    {
      clientKey: "prior",
      stageClientKey: "block-1",
      sequence: 1,
      completedAt: "2026-08-01T10:00:00.000Z",
      totalScore: darts.reduce((sum, d) => sum + d.score, 0),
      darts,
    },
  ];
}

type GameStub = Bobs27PlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    rulesetVersionKey: "BOBS27_V1",
    sessionId: "s1",
    participantRef: "p1",
    templateRef: "tpl-1",
    configSnapshot: defaultConfig(),
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
    stages: [STAGE],
    turns: [],
    idempotencyKey: null,
    loading: false,
    setSessionModes: vi.fn(function (
      this: GameStub,
      modes: { captureModeKey: string; inputModeKey: string },
    ) {
      this.captureModeKey = modes.captureModeKey;
      this.inputModeKey = modes.inputModeKey;
    }),
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

type SettingsStub = { captureModeKey: string; inputModeKey: string };

function settingsStub(overrides: Partial<SettingsStub> = {}): SettingsStub {
  return {
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
    ...overrides,
  };
}

function makePlay(
  gameOverrides: Partial<GameStub> = {},
  settingsOverrides: Partial<SettingsStub> = {},
) {
  return {
    ...bobs27Play(),
    $store: {
      game: gameStub(gameOverrides),
      settings: settingsStub(settingsOverrides),
    },
  } as Bobs27PlayContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(bobs27EngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
});

describe("init", () => {
  it("resumes the engine and mirrors its facts into the store on a match", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.hasActiveSession).toBe(true);
    expect(play.engine).not.toBeNull();
  });

  it("leaves hasActiveSession false when there is no server session for this game", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([]);
    const play = makePlay();
    await play.init.call(play);
    expect(play.hasActiveSession).toBe(false);
    expect(play.engine).toBeNull();
  });

  it("blocks with reconciliationFailed when auto-abandoning a mismatched session fails", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, sessionId: "other" },
    ]);
    vi.mocked(completeSession).mockRejectedValue(new Error("boom"));
    const play = makePlay({ sessionId: "s1" });
    await play.init.call(play);
    expect(play.reconciliationFailed).toBe(true);
    expect(play.hasActiveSession).toBe(false);
  });
});

describe("currentTargetLabel", () => {
  it("shows D1 at the start and BULL once the path reaches it", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("D1");

    const bullPlay = makePlay({ turns: priorTurnsThroughBull() });
    await bullPlay.init.call(bullPlay);
    expect(bullPlay.currentTargetLabel.call(bullPlay)).toBe("BULL");
  });
});

describe("recordTap", () => {
  it("hit adds the current double's board value to the score", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, true);

    expect(play.engine!.state().score).toBe(29); // 27 + D1 board value (2)
    expect(play.$store.game.turns[0].darts[0].hitZoneKey).toBe("DOUBLE");
  });

  it("miss records a MISS dart without changing the score mid-visit", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, false);

    expect(play.engine!.state().score).toBe(27);
    expect(play.$store.game.turns[0].darts[0].hitZoneKey).toBe("MISS");
  });

  it("a resolved visit with at least one hit advances the target with no penalty", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, true);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.engine!.state().score).toBe(29);
    expect(play.currentTargetLabel.call(play)).toBe("D2");
  });

  it("a full-miss visit deducts the target's board value and still advances", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.engine!.state().score).toBe(25); // 27 - D1 board value (2)
    expect(play.currentTargetLabel.call(play)).toBe("D2");
  });
});

describe("completion", () => {
  it("wins and uploads results when BULL is cleared", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorTurnsThroughBull() });
    await play.init.call(play);

    await play.recordTap.call(play, true);
    await play.recordTap.call(play, true);
    await play.recordTap.call(play, true);

    expect(play.finished).toBe(true);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(play.resultsSnapshot).toEqual({ status: "WON", score: 1437, darts: 63 });
    expect(play.completionStatus).toBe("succeeded");
  });

  it("loses when a full-miss visit drops the score to zero or below", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      configSnapshot: { startScore: 27, bullHitValue: 50, missPenaltyMultiplier: 20 },
    });
    await play.init.call(play);

    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot).toEqual({ status: "LOST", score: -13, darts: 3 });
  });

  it("marks completionStatus failed on a real upload error", async () => {
    vi.mocked(appendBatch).mockRejectedValue(new Error("network down"));
    const play = makePlay();
    await play.init.call(play);

    await play.uploadAndCompleteSession.call(play);

    expect(play.completionStatus).toBe("failed");
    expect(play.completionError).toBe(
      "Could not save your game. Check your connection and retry.",
    );
  });

  it("treats SESSION_ALREADY_COMPLETED as success", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 0, darts: 0 },
    });
    vi.mocked(completeSession).mockRejectedValue({ code: "SESSION_ALREADY_COMPLETED" });
    const play = makePlay();
    await play.init.call(play);

    await play.uploadAndCompleteSession.call(play);

    expect(play.completionStatus).toBe("succeeded");
  });
});

describe("previewSegments", () => {
  it("returns empty placeholders before any dart is thrown this visit", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("reflects hit/miss for darts thrown so far, placeholders for the rest", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, true);
    await play.recordTap.call(play, false);

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });
});

describe("reveal-then-clear under VISUAL_BOARD", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides the resolved visit's markers 1.5s after the 3rd dart", async () => {
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

  it("never schedules a hide timer under RECREATIONAL", async () => {
    const play = makePlay({ inputModeKey: "DETAILED_DARTS" });
    await play.init.call(play);

    await play.recordTap.call(play, true);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    vi.advanceTimersByTime(5000);
    expect(play.hiddenTurnKey).toBeNull();
  });

  it("undoVisit cancels a pending hide timer so a reopened visit stays visible", async () => {
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    await play.recordDart.call(play, hitAt(1));
    await play.recordDart.call(play, missAt(1));
    await play.recordDart.call(play, missAt(1));

    vi.advanceTimersByTime(1000); // before the 1.5s mark
    play.undoVisit.call(play);
    vi.advanceTimersByTime(1000); // past where the original timer would have fired

    expect(play.hiddenTurnKey).toBeNull();
  });

  it("undoVisit clears an already-set hiddenTurnKey", async () => {
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
});

describe("back", () => {
  it("resets the store and navigates to /games", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    const play = makePlay();

    await play.back.call(play);

    expect(play.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe("/games");
  });
});

describe("abandonAndExit", () => {
  it("with turns: appendBatch then completeSession ABANDONED, reset, navigate", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "ABANDONED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorTurnsThroughBull() });

    await play.abandonAndExit.call(play);

    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
    expect(play.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe("/games");
  });

  it("with zero turns: skips the batch call entirely", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "ABANDONED",
      completedAt: "now",
    });
    const play = makePlay({ turns: [] });

    await play.abandonAndExit.call(play);

    expect(appendBatch).not.toHaveBeenCalled();
    expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
  });
});

describe("playAgain", () => {
  it("starts a fresh session under the player's current mode pair with no overrides", async () => {
    const play = makePlay(
      { turns: priorTurnsThroughBull() },
      { captureModeKey: "ANALYTICS", inputModeKey: "VISUAL_BOARD" },
    );
    play.completionStatus = "succeeded";
    play.finished = true;

    vi.mocked(createSession).mockResolvedValue({
      sessionId: "new-session",
      participants: [
        { ref: "new-participant", displayName: "Player", participantTypeKey: "PLAYER" },
      ],
    } as any);

    await play.playAgain.call(play);

    expect(createSession).toHaveBeenCalledWith({
      gameTypeKey: "BOBS27",
      rulesetVersionKey: "BOBS27_V1",
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
      config: { source: "template", templateRef: "tpl-1" },
    });
    expect(play.$store.game.sessionId).toBe("new-session");
    expect(play.$store.game.turns).toEqual([]);
    expect(play.finished).toBe(false);
    expect(play.completionStatus).toBe("pending");
    expect(play.resultsSnapshot).toBeNull();
    expect(play.hasActiveSession).toBe(true);
  });

  it("surfaces an error and leaves the modal open when session creation fails", async () => {
    const play = makePlay();
    play.completionStatus = "succeeded";
    play.finished = true;
    vi.mocked(createSession).mockRejectedValue(new Error("boom"));

    await play.playAgain.call(play);

    expect(play.playAgainError).toBe("Could not start a new session. Try again.");
    expect(play.finished).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test file to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts`
Expected: FAIL — `Cannot find module '@lib/game/bobs27-play.data'` (module does not exist yet).

- [ ] **Step 4: Write `app/src/lib/game/bobs27-play.data.ts`**

```ts
import { getEngineFactory } from "@modules/game/engine.registry";
import { resolveSessionModePair } from "@lib/game/session-mode-resolution";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { boardInputData, markersForTurns } from "@lib/game/board-input.data";
import {
  BULL_TARGET_NUMBER,
  doublesPath,
  targetAt,
} from "@modules/game/board-progression.module";
import type { RulesetVersionKey } from "@lib/types";
import type {
  BoardTarget,
  Bobs27State,
  DartObservation,
  EngineFacts,
  TurnFact,
} from "@modules/types";
import type { BoardMarker } from "./types";
import type { Bobs27PlayContext, Bobs27PreviewSegment } from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// bobs27EngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { Bobs27Engine } from "@modules/game/bobs27.engine.module";

const GAME_TYPE_KEY = "BOBS27";
const RULESET_VERSION_KEY: RulesetVersionKey = "BOBS27_V1";

function targetLabel(target: BoardTarget): string {
  return target.kind === "BULL" ? "BULL" : `D${target.number}`;
}

const EMPTY_SEGMENTS: readonly Bobs27PreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): Bobs27PreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey) {
    return [...EMPTY_SEGMENTS];
  }
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return { status: dart.hitZoneKey === "MISS" ? "miss" : "hit" };
  });
}

function computeStats(
  state: Bobs27State,
  turns: readonly TurnFact[],
): { status: "WON" | "LOST"; score: number; darts: number } {
  const darts = turns.reduce((sum, turn) => sum + turn.darts.length, 0);
  return {
    status: state.status === "WON" ? "WON" : "LOST",
    score: state.score,
    darts,
  };
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
 * The engine owns the fact log while a session is live; the store mirrors
 * it. Upload paths that can run without a live engine fall back to the
 * persisted mirror — mirrors `five-oh-one-play.data.ts`'s `currentFacts`.
 */
function currentFacts(context: Bobs27PlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
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
    } | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as Bobs27Engine | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    currentTargetLabel(this: Bobs27PlayContext): string {
      if (!this.engine) return "";
      return targetLabel(targetAt(doublesPath(), this.engine.state().targetIndex));
    },

    previewSegments(this: Bobs27PlayContext): Bobs27PreviewSegment[] {
      return previewSegmentsFor(this.$store.game.turns, this.hiddenTurnKey);
    },

    /** Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Hides the last turn's markers once its reveal-then-clear timer
     * has fired. */
    visitMarkers(this: Bobs27PlayContext): BoardMarker[] {
      if (this.$store.game.turns.at(-1)?.clientKey === this.hiddenTurnKey) {
        return [];
      }
      return markersForTurns(this.$store.game.turns);
    },

    async init(this: Bobs27PlayContext) {
      self = this;
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        const result = await reconcileActiveSession(
          GAME_TYPE_KEY,
          this.$store.game.sessionId,
          activeSessions,
          this.$store.game,
        );

        if (result.action === "abandon_failed") {
          this.reconciliationFailed = true;
          this.hasActiveSession = false;
          return;
        }
        this.reconciliationFailed = false;

        if (result.action === "no_active" || !result.activeSession) {
          this.hasActiveSession = false;
          return;
        }

        this.$store.game.setSessionModes(result.activeSession);

        const config = this.$store.game.configSnapshot;
        const engine = resumeEngine(this.$store.game);
        if (!config || !engine) {
          this.hasActiveSession = false;
          return;
        }
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());
        this.hasActiveSession = true;
      } catch {
        this.reconciliationFailed = true;
        this.hasActiveSession = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async retryReconciliation(this: Bobs27PlayContext) {
      await this.init();
    },

    /** The recreational tap row's entry point: synthesizes the observation
     * for a hit or miss on the current target and funnels it through
     * `commitDart`, exactly as the board's per-dart `recordDart` does. */
    async recordTap(this: Bobs27PlayContext, hit: boolean) {
      if (!this.engine || this.finished) return;
      const target = targetAt(doublesPath(), this.engine.state().targetIndex);
      const observation: DartObservation = hit
        ? {
            hitTargetNumber:
              target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number,
            hitZoneKey: target.kind === "BULL" ? "INNER_BULL" : "DOUBLE",
            locationX: null,
            locationY: null,
          }
        : {
            hitTargetNumber: null,
            hitZoneKey: "MISS",
            locationX: null,
            locationY: null,
          };
      await this.commitDart(observation);
    },

    async recordDart(this: Bobs27PlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    /**
     * Records one dart and refreshes displayed state, shared by the
     * recreational tap path (`recordTap`) and the board's per-dart path
     * (`recordDart`). Bob's 27 has no bust/double ambiguity, so unlike 501
     * there is no confirm gate here — every dart commits immediately.
     *
     * A dart that resolves a visit (closes its 3rd dart) under VISUAL_BOARD
     * input schedules the 1.5s reveal-then-clear: `hiddenTimer` is tracked so
     * `undoVisit` can cancel a still-pending one rather than let it fire and
     * hide markers for a visit the undo just reopened.
     */
    async commitDart(this: Bobs27PlayContext, observation: DartObservation) {
      if (!this.engine) return;
      this.engine.record(observation);
      this.error = "";
      const facts = this.engine.facts();
      this.$store.game.recordFacts(facts);

      const resolvedTurn = facts.turns.at(-1);
      if (
        resolvedTurn?.completedAt &&
        this.$store.game.inputModeKey === "VISUAL_BOARD"
      ) {
        const clientKey = resolvedTurn.clientKey;
        this.hiddenTimer = setTimeout(() => {
          this.hiddenTurnKey = clientKey;
        }, 1500);
      }

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },

    undoVisit(this: Bobs27PlayContext) {
      if (this.finished) return;
      if (!this.engine || !this.engine.undo()) return;

      if (this.hiddenTimer) {
        clearTimeout(this.hiddenTimer);
        this.hiddenTimer = null;
      }
      this.hiddenTurnKey = null;
      this.$store.game.recordFacts(this.engine.facts());
      this.error = "";
    },

    /**
     * Uploads the fact log, then marks the session COMPLETED. On this path
     * only, SESSION_ALREADY_COMPLETED counts as success. Final state is read
     * before any store mutation so `resultsSnapshot` never depends on
     * `$store.game.turns` surviving a later reset.
     */
    async uploadAndCompleteSession(this: Bobs27PlayContext): Promise<void> {
      const sessionId = this.$store.game.sessionId!;

      if (!this.$store.game.idempotencyKey) {
        this.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const idempotencyKey = this.$store.game.idempotencyKey;

      this.completionStatus = "saving";
      this.completionError = "";

      const finalState = this.engine?.state() ?? null;

      try {
        const batch = buildEventsBatch(
          this.$store.game.participantRef!,
          currentFacts(this),
        );
        await appendBatch(sessionId, idempotencyKey, batch);
        await completeSession(sessionId, "COMPLETED");
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        const alreadyCompleted =
          error.code === "SESSION_ALREADY_COMPLETED" ||
          error.message?.includes("SESSION_ALREADY_COMPLETED");
        if (!alreadyCompleted) {
          this.completionError =
            "Could not save your game. Check your connection and retry.";
          this.completionStatus = "failed";
          return;
        }
      }

      if (finalState) {
        this.resultsSnapshot = computeStats(finalState, this.$store.game.turns);
      }
      this.completionStatus = "succeeded";
    },

    async back(this: Bobs27PlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: Bobs27PlayContext) {
      if (this.$store.game.loading) return;
      const sessionId = this.$store.game.sessionId;
      if (!sessionId) {
        this.$store.game.reset();
        globalThis.location.href = "/games";
        return;
      }
      this.$store.game.loading = true;
      this.error = "";
      try {
        const facts = currentFacts(this);
        if (facts.turns.length > 0) {
          if (!this.$store.game.idempotencyKey) {
            this.$store.game.idempotencyKey = crypto.randomUUID();
          }
          const batch = buildEventsBatch(
            this.$store.game.participantRef!,
            facts,
          );
          await appendBatch(sessionId, this.$store.game.idempotencyKey, batch);
        }
        await completeSession(sessionId, "ABANDONED");
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.$store.game.loading = false;
      }
    },

    /**
     * Replays the same configuration template the first session used, with
     * no overrides — V1 has zero editable settings, same rule Phase 3's
     * setup `start()` follows.
     */
    async playAgain(this: Bobs27PlayContext) {
      const config = this.$store.game.configSnapshot;
      const templateRef = this.$store.game.templateRef;
      if (!config || !templateRef || this.playAgainLoading) return;
      const factory = getEngineFactory(RULESET_VERSION_KEY);
      if (!factory) return;

      this.playAgainLoading = true;
      this.playAgainError = "";

      const modePair = resolveSessionModePair(
        RULESET_VERSION_KEY,
        this.$store.settings,
      );

      try {
        let session;
        try {
          session = await createSession({
            gameTypeKey: GAME_TYPE_KEY,
            rulesetVersionKey: RULESET_VERSION_KEY,
            captureModeKey: modePair.captureModeKey,
            inputModeKey: modePair.inputModeKey,
            config: { source: "template", templateRef },
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        this.$store.game.sessionId = session.sessionId;
        this.$store.game.participantRef = session.participants[0].ref;
        this.$store.game.idempotencyKey = null;
        this.$store.game.setSessionModes(modePair);

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        if (this.hiddenTimer) {
          clearTimeout(this.hiddenTimer);
          this.hiddenTimer = null;
        }
        this.hiddenTurnKey = null;
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(config);
        if (!(engine instanceof Bobs27Engine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
```

- [ ] **Step 5: Register `bobs27Play` in `app/src/lib/client/alpine/register-route-data.ts`**

```ts
import type { Alpine } from "alpinejs";
import { loginForm } from "@auth/login.data";
import { scoreTrainingSetup } from "@lib/game/score-training-setup.data";
import { scoreTrainingPlay } from "@lib/game/score-training-play.data";
import { fiveOhOneSetup } from "@lib/game/five-oh-one-setup.data";
import { fiveOhOnePlay } from "@lib/game/five-oh-one-play.data";
import { bobs27Setup } from "@lib/game/bobs27-setup.data";
import { bobs27Play } from "@lib/game/bobs27-play.data";
import { gamesIndex } from "@lib/game/games-index.data";

export function registerRouteData(Alpine: Alpine) {
  Alpine.data("loginForm", loginForm);
  Alpine.data("gamesIndex", gamesIndex);
  Alpine.data("scoreTrainingSetup", scoreTrainingSetup);
  Alpine.data("scoreTrainingPlay", scoreTrainingPlay);
  Alpine.data("fiveOhOneSetup", fiveOhOneSetup);
  Alpine.data("fiveOhOnePlay", fiveOhOnePlay);
  Alpine.data("bobs27Setup", bobs27Setup);
  Alpine.data("bobs27Play", bobs27Play);
}
```

- [ ] **Step 6: Run the test file to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/bobs27-play.data.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `cd app && npm test && npm run check`
Expected: full suite green, 0 type errors.

- [ ] **Step 8: Commit**

```bash
cd app && git add src/lib/game/bobs27-play.data.ts src/lib/game/types.ts src/lib/client/alpine/register-route-data.ts tests/lib/game/bobs27-play.data.test.ts
git commit -m "feat(bobs27): play-page data module — game loop, reveal-then-clear, results"
```

---

### Task 2: `Bobs27VisitPreview.astro` — shared visit preview

**Files:**
- Create: `app/src/components/layout/games/Bobs27VisitPreview.astro`

**Interfaces:**
- Consumes: `previewSegments()` from Task 1's `bobs27Play()` (via the page's Alpine scope).
- Produces: `<Bobs27VisitPreview />`, consumed by Task 4's `Bobs27.astro`.

No TDD step — `.astro` markup is not unit-tested (D101).

- [ ] **Step 1: Write the component**

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Icons
import CheckIcon from "@icons/check.svg";
import DeleteIcon from "@icons/delete.svg";
---

<div
  class="flex flex-col items-center gap-1"
  {...props}
>
  <div
    class="rounded-lg glass border border-border bg-surface-raised flex w-full divide-x divide-border"
  >
    <template
      x-for="(segment, index) in previewSegments()"
      :key="index"
    >
      <div class="flex h-12 flex-1 items-center justify-center">
        <CheckIcon
          class="size-5 text-success"
          x-show="segment.status === 'hit'"
          x-cloak
        />
        <DeleteIcon
          class="size-5 text-error"
          x-show="segment.status === 'miss'"
          x-cloak
        />
        <span
          class="size-2 rounded-full bg-border"
          x-show="segment.status === 'empty'"
          x-cloak
        >
        </span>
      </div>
    </template>
  </div>
  <div
    class="flex w-full justify-around text-xs text-muted-foreground uppercase"
  >
    <span>D1</span>
    <span>D2</span>
    <span>D3</span>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
cd app && git add src/components/layout/games/Bobs27VisitPreview.astro
git commit -m "feat(bobs27): shared visit preview component"
```

---

### Task 3: `Bobs27RecreationalInput.astro` — tap input row

**Files:**
- Create: `app/src/components/layout/games/Bobs27RecreationalInput.astro`

**Interfaces:**
- Consumes: `undoVisit()`, `recordTap(hit)`, `currentTargetLabel()`, `finished`, `$store.game.turns` from Task 1's `bobs27Play()`.
- Produces: `<Bobs27RecreationalInput />`, consumed by Task 4's `Bobs27.astro`.

No TDD step — `.astro` markup is not unit-tested (D101).

- [ ] **Step 1: Write the component**

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import InputButton from "./InputButton.astro";

// Icons
import UndoIcon from "@icons/undo.svg";
---

<div
  class="rounded-lg glass border border-border bg-surface-raised flex w-full divide-x divide-border"
  {...props}
>
  <InputButton
    aria-label="Undo last dart"
    :disabled="!$store.game.turns.length || finished"
    @click="undoVisit()"
  >
    <UndoIcon class="size-6 text-muted" />
  </InputButton>
  <InputButton
    :disabled="finished"
    @click="recordTap(false)"
  >
    MIS
  </InputButton>
  <InputButton
    :disabled="finished"
    @click="recordTap(true)"
    x-text="currentTargetLabel()"
  >
  </InputButton>
</div>
```

- [ ] **Step 2: Commit**

```bash
cd app && git add src/components/layout/games/Bobs27RecreationalInput.astro
git commit -m "feat(bobs27): recreational tap input row"
```

---

### Task 4: `Bobs27.astro` — assembled interface

**Files:**
- Create: `app/src/components/layout/games/interfaces/Bobs27.astro`

**Interfaces:**
- Consumes: `currentTargetLabel()`, `error`, `$store.game.inputModeKey` from Task 1; `<Bobs27VisitPreview />` (Task 2); `<Bobs27RecreationalInput />` (Task 3); `<BoardInputPanel />` (existing, unchanged).
- Produces: `<Bobs27 />`, consumed by Task 6's play page.

No TDD step — `.astro` markup is not unit-tested (D101).

- [ ] **Step 1: Write the component**

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import Bobs27VisitPreview from "@components/layout/games/Bobs27VisitPreview.astro";
import Bobs27RecreationalInput from "@components/layout/games/Bobs27RecreationalInput.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <SinglePlayerDisplay
    isTarget={true}
    target="currentTargetLabel()"
    class="max-h-2/5 h-full"
  />

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <Bobs27VisitPreview />

  <Bobs27RecreationalInput
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

- [ ] **Step 2: Commit**

```bash
cd app && git add src/components/layout/games/interfaces/Bobs27.astro
git commit -m "feat(bobs27): assembled play interface"
```

---

### Task 5: `Bobs27Results.astro` — results modal

**Files:**
- Create: `app/src/components/layout/games/result-modals/Bobs27Results.astro`

**Interfaces:**
- Consumes: `finished`, `completionStatus`, `completionError`, `resultsSnapshot: { status, score, darts } | null`, `playAgainError`, `playAgainLoading`, `back()`, `playAgain()`, `uploadAndCompleteSession()` from Task 1.
- Produces: `<Bobs27Results />`, consumed by Task 6's play page.

No TDD step — `.astro` markup is not unit-tested (D101).

- [ ] **Step 1: Write the component**

```astro
---
import Button from "@components/forms/Button.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import IsLoading from "@components/ui/IsLoading.astro";
---

<div
  class="fixed inset-0 flex items-center justify-center bg-black/50 z-50 w-full"
  x-show="finished"
  x-cloak
>
  <div
    class="glass rounded-lg border border-border bg-surface-raised p-6 shadow-lg max-w-sm"
  >
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-text="resultsSnapshot?.status === 'LOST' ? 'Lost' : 'Won'"
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

    {/* Stats: shown once the final score is known */}
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus === 'succeeded' && resultsSnapshot"
      x-cloak
    >
      <StatRow
        label="Score"
        value="resultsSnapshot?.score"
      />
      <StatRow
        label="Darts"
        value="resultsSnapshot?.darts"
      />
    </dl>

    {/* Completion status */}
    <div class="mt-4">
      <IsLoading
        title="Saving..."
        x-show="completionStatus === 'pending' || completionStatus === 'saving'"
        x-cloak
      />
      <div
        x-show="completionStatus === 'failed'"
        x-cloak
      >
        <p
          class="alert alert-error rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
          role="alert"
          x-text="completionError"
        >
        </p>
        <Button
          class="mt-2"
          @click="uploadAndCompleteSession()"
          title="Retry"
        />
      </div>
    </div>

    {
      /* Play-again failure: separate from completion status, buttons stay enabled */
    }
    <p
      class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
      role="alert"
      x-text="playAgainError"
      x-show="playAgainError"
      x-cloak
    >
    </p>

    {/* Action buttons: enabled only when completionStatus === 'succeeded' */}
    <div class="mt-6 flex justify-end gap-3">
      <Button
        variant="secondary"
        @click="back()"
        :disabled="completionStatus !== 'succeeded'"
        title="Back to games"
      />
      <Button
        @click="playAgain()"
        :disabled="completionStatus !== 'succeeded' || playAgainLoading"
        title="Play again"
      />
    </div>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
cd app && git add src/components/layout/games/result-modals/Bobs27Results.astro
git commit -m "feat(bobs27): results modal"
```

---

### Task 6: Play page — replace Phase 3's placeholder

**Files:**
- Modify: `app/src/pages/games/bobs27/play/index.astro` (replaces Phase 3's static `AppLayout` placeholder in full)

**Interfaces:**
- Consumes: `bobs27Play()` (Task 1, registered as Alpine data `"bobs27Play"`), `<Bobs27 />` (Task 4), `<Bobs27Results />` (Task 5), existing `<ReconciliationBlocked />`/`<NoSessionPanel />`, `abandonAndExit()` from Task 1.

No TDD step — `.astro` markup is not unit-tested (D101).

- [ ] **Step 1: Replace the page**

```astro
---
export const prerender = true;
import GameLayout from "@layouts/GameLayout.astro";
import Bobs27 from "@components/layout/games/interfaces/Bobs27.astro";
import Bobs27Results from "@components/layout/games/result-modals/Bobs27Results.astro";
import NoSessionPanel from "@components/layout/games/NoSessionPanel.astro";
import ReconciliationBlocked from "@components/layout/games/ReconciliationBlocked.astro";
---

<GameLayout
  title="Bob's 27 — Play"
  gameTitle="BOB'S 27"
>
  <div
    class="flex flex-col flex-1 min-h-0 p-3"
    x-data="bobs27Play()"
    @confirm-exit.window="abandonAndExit()"
  >
    {/* Loading / reconciliation-blocked */}
    <ReconciliationBlocked />

    {/* No active session view */}
    <NoSessionPanel href="/games/bobs27/setup" />

    {/* Gameplay view */}
    <Bobs27
      x-show="!finished && hasActiveSession"
      x-cloak
    />

    {/* Results modal (overlay) */}
    <Bobs27Results />
  </div>
</GameLayout>
```

- [ ] **Step 2: Commit**

```bash
cd app && git add src/pages/games/bobs27/play/index.astro
git commit -m "feat(bobs27): wire play page to the full gameplay interface"
```

---

### Task 7: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full suite, typecheck, format**

Run: `cd app && npm test && npm run check && npm run format:check`
Expected: full suite green (no regressions vs. the pre-branch baseline), 0 type errors, format clean.

- [ ] **Step 2: fallow**

Run: `cd app && npx fallow`
Expected: 0 files above threshold.

- [ ] **Step 3: Applicable gate scripts**

Run from repo root:

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-game-engines.sh
bash scripts/check-refinement-coverage.sh
bash scripts/check-type-barrels.sh
bash scripts/check-alias-sync.sh
bash scripts/check-constraint-mirror.sh
bash scripts/check-no-inline-comments.sh
bash scripts/check-style-tokens.sh
```

Expected: every script OK. (`npm run validate:app`'s DB-dependent steps — `db:status`/`db:migrate`/`db:introspect` — are expected to fail only if no `DATABASE_URL` is configured in the environment; no schema/migration/seed changes exist in this phase, so this is the same known-expected gap Phase 3 documented.)

- [ ] **Step 4: Manual dev-server smoke check**

Start: `cd app && astro dev --background`

- `/games/bobs27/setup` → start a session under RECREATIONAL app mode → lands on `/games/bobs27/play` showing the tap row, target "D1", and an empty visit preview.
- Play a full recreational game hitting every double D1→D20 then BULL (tap the target button 3× per visit, using Undo at least once to confirm it decrements correctly) → results modal shows "Won", a score, and a darts count; "Play again" starts a fresh RECREATIONAL session back at "D1".
- Start a fresh session, deliberately miss all 3 darts on several early visits until the score reaches zero or below → results modal shows "Lost".
- Switch app mode to ANALYTICS, start a new Bob's 27 session → play lands showing the board (`BoardInputPanel`) instead of the tap row; tap the board to record a dart, confirm the visit preview and board markers show the dart, and that after a visit's 3rd dart the markers/preview clear roughly 1.5s later; confirm Undo immediately after a visit resolves (before the 1.5s mark) keeps the markers visible instead of hiding them.
- Confirm the Exit button (top-left, `GameLayout`) opens the leave-game confirm and abandoning returns to `/games`.

Stop: `astro dev stop`

- [ ] **Step 5: Context maintenance**

Run the `context-maintenance` skill: update `docs/architecture/00-Context-Map.md`'s File Inventory (new play data module, new components, updated play page; bump the Version changelog), confirm no new decision-ledger entry is needed (per this plan's Global Constraints), confirm ISO dates on any new doc rows, and confirm `run-all-gates` was fully run (Step 3 above).

- [ ] **Step 6: finishing-a-development-branch**

Push the branch and open a PR (per this repo's `finishing-a-development-branch` override — Option 2 always), noting in the PR body that this is the fourth and final phase of the Bob's 27 frontend rollout (spec: `docs/superpowers/specs/2026-08-12-bobs27-frontend-design.md`).
