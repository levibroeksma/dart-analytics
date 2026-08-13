# Singles Training Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Singles Training playable end-to-end — games-index card, setup page, tap-based play (S/D/T/Miss on number targets, Bull/Bullseye/Miss on the BULL visit), 3-dart visit preview, and a total-points results modal — reusing the already-shipped `SinglesTrainingEngine`, `singlesTrainingValidator` and `SINGLES_V1: [DETAILED_DARTS]` capability unchanged.

**Architecture:** Two new Alpine data modules mirror Bob's 27's shape: `singles-training-setup.data.ts` (zero-editable-settings session creation, reconciliation) and `singles-training-play.data.ts` (record → mirror → complete game loop). `SINGLES_V1` never enters `VISUAL_BOARD`, so the play module carries no board-input spread and no reveal-then-clear timer — a resolved visit hides synchronously. Five new `.astro` components (setup form, target-aware tap row, interface, results) are presentational only; a sixth existing component (`Bobs27VisitPreview.astro`) is generalized in place to `VisitPreview.astro` and reused by both games rather than duplicated, since it already carries no Bob's-27-specific text or props.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-13-singles-training-frontend-design.md`. `SINGLES_V1`, `singlesTrainingValidator`, `RULESET_CAPABILITIES.SINGLES_V1: [{ captureModeKey: "RECREATIONAL", inputModeKey: "DETAILED_DARTS" }]`, and seed `0007`'s matching row already ship — **no changes to `capabilities.ts`, the validator, or any seed/migration in this plan.**
- `GAME_TYPE_KEY = "SINGLES_TRAINING"` (seed `0001_reference_data.sql`), `RULESET_VERSION_KEY: RulesetVersionKey = "SINGLES_V1"`.
- Exactly one seeded V1 preset exists: `configuration_templates` row `0198f300-0000-7000-8000-000000000005`, name `"Singles — Low to High, Easy"`, `configuration: { order_mode: "LOW_TO_HIGH", difficulty: "EASY" }` (`points_single`/`points_double`/`points_treble` fall to their Zod defaults 1/2/3) — the setup module always uses `presets[0]`, exactly like Bob's 27's.
- `SINGLES_V1` declares only `RECREATIONAL + DETAILED_DARTS` — no `VISUAL_BOARD` pair. The play module has **no board-input spread, no `visitMarkers()`, no `hiddenTimer`/reveal-then-clear scheduling** — a resolved visit's `hiddenTurnKey` is set synchronously, not after a 1.5s delay.
- Each dart's fact carries `intendedTargetNumber: null` / `intendedZoneKey: null` (both, always — this is the existing engine's behavior, unchanged here). `previewSegments()` therefore cannot compare hit-vs-intent like Bob's 27's does; it must recompute training points per dart via a local, duplicated `trainingPointsFor` (the engine does not export its own). This duplication is a known, accepted seam — flagged in the design spec §5/§11, not resolved by this plan.
- `dart.score` on a `DartFact` is always the dart's **board** score, never training points — never use `dart.score` to decide a preview segment's hit/miss status.
- On the BULL visit (`targetIndex === 20`), the tap row shows `Bull` (outer bull, `OUTER_BULL`, `pointsSingle`) / `Bullseye` (inner bull, `INNER_BULL`, `pointsDouble`) / `Miss` — no Treble button; on every other visit it shows `S` / `D` / `T` / `Miss`. Both rows share one `recordTap(ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS")` method — `Bull`/`Bullseye` call `recordTap("SINGLE")`/`recordTap("DOUBLE")`, same ring vocabulary as the number-target buttons.
- Results show **total training points only** — no darts-thrown row, no win/loss heading (Singles has no outcome; `SinglesTrainingState.status` is only `IN_PROGRESS`/`COMPLETE`). Heading is the static string `"Session complete"`.
- `.astro` markup is not unit-tested in this codebase (D101, `app/CLAUDE.md`) — tasks that only add/edit `.astro` files have no TDD step.
- Adding `SINGLES_V1` to `GAME_CARDS` changes `games-visibility.test.ts`'s existing "shows every carded game under analytics" assertion and its premise comment — `SINGLES_V1` does **not** declare an `ANALYTICS` pair, so it must not appear in that test's expected list. This is a real, foreseen behavior change caught while reading the existing test, not a scope addition.
- No new decision-ledger entry: this plan is a mechanical frontend extension of already-decided patterns (D196 capability, D198 engine dispatch, D195/D206-adjacent session/store conventions) — nothing here introduces a new architectural pattern.
- Run the `run-all-gates` skill and the mandatory `context-maintenance` skill before this branch is considered done (root `CLAUDE.md`).

---

### Task 1: Games-index card + visibility test update

**Files:**
- Modify: `app/src/lib/game/rulesets/games-visibility.ts`
- Modify: `app/tests/lib/game/rulesets/games-visibility.test.ts`

**Interfaces:**
- Consumes: `supportsCaptureMode` (`./capabilities`, already declares `SINGLES_V1` under `RECREATIONAL`).
- Produces: a `SINGLES_V1` entry in `GAME_CARDS`, consumed by the games-index page template (unchanged — it renders `GAME_CARDS` generically) and by Task 4/9's setup/play routes via its `href`.

- [ ] **Step 1: Add the failing/changed assertions to `games-visibility.test.ts`**

Replace the file's top comment and the two mode-visibility tests:

```ts
import { describe, expect, it } from "vitest";
import { GAME_CARDS, visibleGames } from "@lib/game/rulesets/games-visibility";

// Every card in GAME_CARDS is a ruleset that has a real setup route, so a key
// asserted here is a card that can actually render. Visibility is keyed on
// capture mode alone, not the exact declared pair (see `visibleGames`'s own
// doc comment for why). Most carded rulesets declare a pair under both
// RECREATIONAL and ANALYTICS and so are visible under both real app modes —
// SINGLES_V1 is the first exception, declaring only RECREATIONAL +
// DETAILED_DARTS, so its card is RECREATIONAL-only.

describe("visibleGames", () => {
  it("shows every carded game under recreational", () => {
    const keys = visibleGames("RECREATIONAL", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual([
      "SCORE_TRAINING_V1",
      "501_V1",
      "BOBS27_V1",
      "SINGLES_V1",
    ]);
  });

  it("shows every carded game that declares an analytics pair, and no others, under analytics", () => {
    const keys = visibleGames("ANALYTICS", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual(["501_V1", "BOBS27_V1", "SCORE_TRAINING_V1"]);
    expect(keys).not.toContain("SINGLES_V1");
  });

  it("hides every game under a capture mode no carded ruleset supports", () => {
    expect(visibleGames("UNKNOWN_CAPTURE_MODE", null)).toEqual([]);
  });

  it("never hides a game with an active session", () => {
    const keys = visibleGames("UNKNOWN_CAPTURE_MODE", "501_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual(["501_V1"]);
  });

  it("does not duplicate a capable game that is also active", () => {
    const keys = visibleGames("ANALYTICS", "501_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys.filter((key) => key === "501_V1")).toHaveLength(1);
  });

  it("keeps the declared card order rather than the filter order", () => {
    const keys = visibleGames("RECREATIONAL", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual(GAME_CARDS.map((game) => game.rulesetVersionKey));
  });

  it("gives every card a setup href and copy", () => {
    for (const game of GAME_CARDS) {
      expect(game.href).toMatch(/^\/games\/.+\/setup$/);
      expect(game.title.length).toBeGreaterThan(0);
      expect(game.caption.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: FAIL — `visibleGames("RECREATIONAL", null)` doesn't yet include `SINGLES_V1`.

- [ ] **Step 3: Add the card**

In `app/src/lib/game/rulesets/games-visibility.ts`, append to `GAME_CARDS` (after the `BOBS27_V1` entry):

```ts
  {
    rulesetVersionKey: "SINGLES_V1",
    href: "/games/singles-training/setup",
    title: "Singles training",
    caption: "Section training, one target at a time.",
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd app && git add src/lib/game/rulesets/games-visibility.ts tests/lib/game/rulesets/games-visibility.test.ts
git commit -m "feat(singles-training): add games-index card"
```

---

### Task 2: Shared type contexts

**Files:**
- Modify: `app/src/lib/game/types.ts`

**Interfaces:**
- Consumes: `SinglesTrainingEngine` (`@modules/game/singles-training.engine.module`), `SinglesSnapshot` (already re-exported by this file's own `export * from "./rulesets/types"`, but also needed as an explicit import alongside the other snapshot types for the `PlayStoreContext<SinglesSnapshot>` instantiation below).
- Produces: `SinglesTrainingSetupContext`, `SinglesTrainingPlayContext`, `SinglesPreviewSegment` — consumed by Task 3 (setup data), Task 5 (play data), and their tests.

- [ ] **Step 1: Add the `SinglesSnapshot` import and the `SinglesTrainingEngine` import**

At the top of `app/src/lib/game/types.ts`, extend the existing imports:

```ts
import type { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";
```

and add `SinglesSnapshot` to the existing named import from `"./rulesets/types"`:

```ts
import type {
  ModePair,
  RulesetVersionKey,
  ScoreTrainingSnapshot,
  FiveOhOneSnapshot,
  Bobs27Snapshot,
  SinglesSnapshot,
} from "./rulesets/types";
```

- [ ] **Step 2: Add `SinglesTrainingSetupContext`**

Immediately after the existing `Bobs27SetupContext` block:

```ts
export type SinglesTrainingSetupContext = {
  presets: ConfigurationPresetData[];
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
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
  init(this: SinglesTrainingSetupContext): Promise<void>;
  reconcile(
    this: SinglesTrainingSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: SinglesTrainingSetupContext): Promise<void>;
  continueSession(this: SinglesTrainingSetupContext): void;
  abandonSession(this: SinglesTrainingSetupContext): Promise<void>;
  start(this: SinglesTrainingSetupContext): Promise<void>;
};
```

- [ ] **Step 3: Add `SinglesPreviewSegment` and `SinglesTrainingPlayContext`**

Immediately after the existing `Bobs27PlayContext` block:

```ts
/** One dart slot in Singles Training's visit preview — a resolved hit/miss mark (by training points, not board score), or a not-yet-thrown placeholder. */
export type SinglesPreviewSegment = { status: "hit" | "miss" | "empty" };

export type SinglesTrainingPlayContext = {
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
  resultsSnapshot: { points: number } | null;
  hiddenTurnKey: string | null;
  $store: PlayStoreContext<SinglesSnapshot>;
  engine: SinglesTrainingEngine | null;
  currentTargetLabel(this: SinglesTrainingPlayContext): string;
  currentPoints(this: SinglesTrainingPlayContext): string;
  isBullVisit(this: SinglesTrainingPlayContext): boolean;
  previewSegments(this: SinglesTrainingPlayContext): SinglesPreviewSegment[];
  init(this: SinglesTrainingPlayContext): Promise<void>;
  retryReconciliation(this: SinglesTrainingPlayContext): Promise<void>;
  recordTap(
    this: SinglesTrainingPlayContext,
    ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
  ): Promise<void>;
  commitDart(
    this: SinglesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: SinglesTrainingPlayContext): void;
  uploadAndCompleteSession(this: SinglesTrainingPlayContext): Promise<void>;
  back(this: SinglesTrainingPlayContext): Promise<void>;
  playAgain(this: SinglesTrainingPlayContext): Promise<void>;
  abandonAndExit(this: SinglesTrainingPlayContext): Promise<void>;
};
```

- [ ] **Step 4: Typecheck**

Run: `cd app && npm run check`
Expected: 0 errors (these types have no consumers yet, so nothing else should break).

- [ ] **Step 5: Commit**

```bash
cd app && git add src/lib/game/types.ts
git commit -m "feat(singles-training): add setup/play context types"
```

---

### Task 3: Setup data module

**Files:**
- Create: `app/src/lib/game/singles-training-setup.data.ts`
- Test: `app/tests/lib/game/singles-training-setup.data.test.ts`

**Interfaces:**
- Consumes: `fetchConfigurationPresets` (`@client/api/configuration-templates`), `createSession`/`fetchActiveSessions`/`completeSession` (`@client/api/sessions`), `toSnapshot` (`@lib/game/rulesets/config-codec`), `reconcileActiveSession` (`@lib/game/session-recovery`), `resolveSessionModePair`/`startSessionInput` (`@lib/game/session-mode-resolution`), `SinglesTrainingSetupContext` (Task 2).
- Produces: `singlesTrainingSetup()` factory, consumed by Task 4's setup route (`Alpine.data("singlesTrainingSetup", ...)`) and by this task's own test.

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/game/singles-training-setup.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { singlesTrainingSetup } from "@lib/game/singles-training-setup.data";
import type { SinglesTrainingSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const STANDARD_PRESET = {
  configurationTemplateId: "tmpl-singles-standard",
  gameTypeKey: "SINGLES_TRAINING",
  name: "Singles — Low to High, Easy",
  description: null,
  configuration: {
    order_mode: "LOW_TO_HIGH",
    difficulty: "EASY",
  },
  isSystemTemplate: true,
} as any;

describe("singlesTrainingSetup", () => {
  let store: SinglesTrainingSetupContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      game: {
        sessionId: null,
        reset: vi.fn(),
        startSession: vi.fn(),
      },
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    };
  });

  function createSetup(
    overrides: Partial<SinglesTrainingSetupContext> = {},
  ): SinglesTrainingSetupContext {
    return {
      ...singlesTrainingSetup(),
      $store: store,
      ...overrides,
    } as SinglesTrainingSetupContext;
  }

  describe("init", () => {
    it("loads the single seeded preset", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith(
        "SINGLES_TRAINING",
      );
      expect(setup.presets).toEqual([STANDARD_PRESET]);
      expect(setup.loadingReconciliation).toBe(false);
    });

    it("sets a visible error and clears loading when preset/active fetch throws", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockRejectedValue(
        new Error("Network error"),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      expect(setup.loadingReconciliation).toBe(false);
      expect(setup.error).toMatch(/connection/i);
      expect(setup.showActiveSessionModal).toBe(false);
    });
  });

  describe("reconciliation", () => {
    it('shows the active-session modal on "match"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "match-id", gameTypeKey: "SINGLES_TRAINING" } as any,
      ]);
      store.game.sessionId = "match-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "match-id",
        gameTypeKey: "SINGLES_TRAINING",
      });
    });

    it('blocks with reconciliationFailed on "abandon_failed"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "SINGLES_TRAINING" } as any,
      ]);
      vi.mocked(sessionsApi.completeSession).mockRejectedValue(
        new Error("Network error"),
      );
      store.game.sessionId = "different-local-id";

      await setup.init();

      expect(setup.reconciliationFailed).toBe(true);
      expect(setup.showActiveSessionModal).toBe(false);
      expect(store.game.reset).not.toHaveBeenCalled();
    });
  });

  describe("continueSession / abandonSession", () => {
    it("continueSession navigates to the play page", () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "SINGLES_TRAINING",
        } as any,
      });
      const locationSpy = { href: "/games/singles-training/setup" };
      vi.stubGlobal("location", locationSpy);

      setup.continueSession();

      expect(locationSpy.href).toBe("/games/singles-training/play");
    });

    it("abandons session when user clicks Abandon", async () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "SINGLES_TRAINING",
        } as any,
      });
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "match-id",
        statusKey: "ABANDONED",
        completedAt: "2026-08-13T10:00:00Z",
      });

      await setup.abandonSession();

      expect(sessionsApi.completeSession).toHaveBeenCalledWith(
        "match-id",
        "ABANDONED",
      );
      expect(store.game.reset).toHaveBeenCalled();
      expect(setup.showActiveSessionModal).toBe(false);
      expect(setup.loading).toBe(false);
    });
  });

  describe("start", () => {
    it("creates a session from the seeded preset with no overrides and redirects", async () => {
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      } as any);
      const locationSpy = { href: "" };
      vi.stubGlobal("location", locationSpy);

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith({
        gameTypeKey: "SINGLES_TRAINING",
        rulesetVersionKey: "SINGLES_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        config: {
          source: "template",
          templateRef: "tmpl-singles-standard",
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-singles-standard",
          configSnapshot: expect.objectContaining({
            orderMode: "LOW_TO_HIGH",
            difficulty: "EASY",
            pointsSingle: 1,
            pointsDouble: 2,
            pointsTreble: 3,
          }),
        }),
      );
      expect(locationSpy.href).toBe("/games/singles-training/play");
    });

    it("falls back to Singles Training's declared pair when settings holds a pair it does not declare", async () => {
      store.settings = {
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      };
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          captureModeKey: "RECREATIONAL",
          inputModeKey: "DETAILED_DARTS",
        }),
      );
    });

    it("errors when no preset is available", async () => {
      const setup = createSetup({ presets: [] });
      await setup.start();
      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(setup.error).toBe(
        "Could not find a preset for Singles Training.",
      );
    });

    it("rejects a preset whose configuration fails schema validation, before creating a session", async () => {
      const setup = createSetup({
        presets: [
          {
            ...STANDARD_PRESET,
            configuration: { order_mode: "SIDEWAYS" },
          },
        ],
      });

      await setup.start();

      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(store.game.startSession).not.toHaveBeenCalled();
      expect(setup.error).toMatch(/Could not start the session/);
      expect(setup.loading).toBe(false);
    });

    it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      vi.mocked(sessionsApi.createSession).mockRejectedValue(
        Object.assign(new Error("already active"), {
          code: "SESSION_ALREADY_ACTIVE",
        }),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "active-1", gameTypeKey: "SINGLES_TRAINING" } as any,
      ]);
      store.game.sessionId = "active-1";

      await setup.start();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toMatchObject({ sessionId: "active-1" });
      expect(setup.loading).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/singles-training-setup.data.test.ts`
Expected: FAIL — `Cannot find module '@lib/game/singles-training-setup.data'`.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/game/singles-training-setup.data.ts`:

```ts
import {
  fetchConfigurationPresets,
  type ConfigurationPresetData,
} from "@client/api/configuration-templates";
import {
  createSession,
  fetchActiveSessions,
  completeSession,
  type SessionActiveData,
} from "@client/api/sessions";
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import {
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
import type { SinglesTrainingSetupContext } from "./types";

const GAME_TYPE_KEY = "SINGLES_TRAINING";
const RULESET_VERSION_KEY = "SINGLES_V1";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function singlesTrainingSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: SinglesTrainingSetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);
        this.presets = presets;
        await this.reconcile(activeSessions);
      } catch {
        this.showActiveSessionModal = false;
        this.error =
          "Could not load setup. Check your connection and try again.";
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async reconcile(
      this: SinglesTrainingSetupContext,
      activeSessions: SessionActiveData[],
    ) {
      const result = await reconcileActiveSession(
        GAME_TYPE_KEY,
        this.$store.game.sessionId,
        activeSessions,
        this.$store.game,
      );

      if (result.action === "match") {
        this.activeSession = result.activeSession;
        this.showActiveSessionModal = true;
        this.reconciliationFailed = false;
      } else if (result.action === "abandon_failed") {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = true;
      } else {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = false;
      }
    },

    async retryReconciliation(this: SinglesTrainingSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: SinglesTrainingSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/singles-training/play";
    },

    async abandonSession(this: SinglesTrainingSetupContext) {
      if (!this.activeSession || this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        await completeSession(this.activeSession.sessionId, "ABANDONED");
        this.$store.game.reset();
        this.showActiveSessionModal = false;
        this.activeSession = null;
      } catch {
        this.error = "Could not abandon session. Try again.";
      } finally {
        this.loading = false;
      }
    },

    async start(this: SinglesTrainingSetupContext) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = "Could not find a preset for Singles Training.";
        return;
      }

      this.loading = true;
      this.error = "";
      try {
        const configSnapshot = toSnapshot(
          RULESET_VERSION_KEY,
          preset.configuration,
        );
        const modePair = resolveSessionModePair(
          RULESET_VERSION_KEY,
          this.$store.settings,
        );
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
          },
        });
        this.$store.game.startSession(
          startSessionInput({
            gameTypeKey: GAME_TYPE_KEY,
            rulesetVersionKey: RULESET_VERSION_KEY,
            session,
            templateRef: preset.configurationTemplateId,
            configSnapshot,
            modePair,
          }),
        );
        globalThis.location.href = "/games/singles-training/play";
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === "SESSION_ALREADY_ACTIVE") {
          await this.retryReconciliation();
          return;
        }
        this.error = "Could not start the session. Try again.";
      } finally {
        this.loading = false;
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/singles-training-setup.data.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
cd app && git add src/lib/game/singles-training-setup.data.ts tests/lib/game/singles-training-setup.data.test.ts
git commit -m "feat(singles-training): add setup data module"
```

---

### Task 4: Setup form + setup route

**Files:**
- Create: `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro`
- Create: `app/src/pages/games/singles-training/setup/index.astro`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`

**Interfaces:**
- Consumes: `SetupShell`/`UserSection` (`./`), `InfoSection` (`@components/ui/InfoSection.astro`), `ContinueSessionModal`/`IsLoading` (existing), `singlesTrainingSetup` (Task 3).
- Produces: the `/games/singles-training/setup` route, and `Alpine.data("singlesTrainingSetup", ...)` registration consumed by that route's `x-data`.

- [ ] **Step 1: Create the setup form**

Create `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro`:

```astro
---
// Components
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import UserSection from "./UserSection.astro";

// Data
const infoSection = {
  title: "Singles training rules",
  description:
    "One target at a time, three darts each: 1 through 20, then bull, low to high. Single = 1 point, double = 2, treble = 3 — only on the current target. On the bull, outer = 1 point, inner = 2, no treble. Misses score 0. The session ends once every target has been visited once.",
};
---

<SetupShell title="Singles training">
  <UserSection />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />

  <p
    class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>
</SetupShell>
```

- [ ] **Step 2: Create the setup route**

Create `app/src/pages/games/singles-training/setup/index.astro`:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import Button from "@components/forms/Button.astro";
import ContinueSessionModal from "@components/layout/games/ContinueSessionModal.astro";
import SinglesTrainingSetupForm from "@components/layout/games/setup/SinglesTrainingSetupForm.astro";
import IsLoading from "@components/ui/IsLoading.astro";
---

<AppLayout title="Singles Training — Setup">
  <div
    class="p-4"
    x-data="singlesTrainingSetup()"
  >
    <template x-if="showActiveSessionModal && activeSession">
      <ContinueSessionModal gameTitle="Singles Training" />
    </template>

    <template x-if="reconciliationFailed && !loadingReconciliation">
      <div
        class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-center text-sm text-error-foreground"
        role="alert"
      >
        <p>Could not clean up a previous session. Retry to continue.</p>
        <Button
          class="mt-4"
          @click="retryReconciliation()"
          title="Retry"
        />
      </div>
    </template>

    <template
      x-if="!showActiveSessionModal && !reconciliationFailed && !loadingReconciliation"
    >
      <SinglesTrainingSetupForm />
    </template>

    <template x-if="loadingReconciliation">
      <IsLoading title="Configuring your session..." />
    </template>
  </div>
</AppLayout>
```

- [ ] **Step 3: Register the Alpine data factory**

In `app/src/lib/client/alpine/register-route-data.ts`, add the import and registration:

```ts
import { singlesTrainingSetup } from "@lib/game/singles-training-setup.data";
```

```ts
  Alpine.data("singlesTrainingSetup", singlesTrainingSetup);
```

(placed after the existing `Alpine.data("bobs27Setup", bobs27Setup);` line)

- [ ] **Step 4: Typecheck**

Run: `cd app && npm run check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
cd app && git add src/components/layout/games/setup/SinglesTrainingSetupForm.astro src/pages/games/singles-training/setup/index.astro src/lib/client/alpine/register-route-data.ts
git commit -m "feat(singles-training): add setup page"
```

---

### Task 5: Play data module

**Files:**
- Create: `app/src/lib/game/singles-training-play.data.ts`
- Test: `app/tests/lib/game/singles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `getEngineFactory` (`@modules/game/engine.registry`), `SinglesTrainingEngine`/`singlesTrainingEngineFactory` (`@modules/game/singles-training.engine.module`), `BULL_TARGET_NUMBER`/`numbersPath`/`targetAt` (`@modules/game/board-progression.module`), `resolveSessionModePair` (`@lib/game/session-mode-resolution`), `reconcileActiveSession` (`@lib/game/session-recovery`), `appendBatch`/`completeSession`/`createSession`/`fetchActiveSessions` (`@client/api/sessions`), `buildEventsBatch` (`@modules/game/events.payload.module`), `SinglesTrainingPlayContext`/`SinglesPreviewSegment` (Task 2).
- Produces: `singlesTrainingPlay()` factory (registered in Task 9), consumed by Task 7's tap row, Task 8's interface/results components, and Task 9's play route. Exposes on `this`: `loading`, `error`, `finished`, `hasActiveSession`, `loadingReconciliation`, `reconciliationFailed`, `completionStatus`, `completionError`, `playAgainError`, `playAgainLoading`, `resultsSnapshot: { points: number } | null`, `hiddenTurnKey: string | null`, `engine: SinglesTrainingEngine | null`, plus methods `currentTargetLabel()`, `currentPoints()`, `isBullVisit()`, `previewSegments()`, `init()`, `retryReconciliation()`, `recordTap(ring)`, `commitDart(observation)`, `undoVisit()`, `uploadAndCompleteSession()`, `back()`, `playAgain()`, `abandonAndExit()`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/game/singles-training-play.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

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
import { singlesTrainingEngineFactory } from "@modules/game/singles-training.engine.module";
import { singlesTrainingPlay } from "@lib/game/singles-training-play.data";
import type {
  SinglesSnapshot,
  SinglesTrainingPlayContext,
} from "@lib/types";
import type { DartFact, StageFact, TurnFact } from "@modules/types";

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "SINGLES_TRAINING",
  gameTypeName: "Singles Training",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "SINGLES_V1",
  startedAt: "now",
} as const;

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function defaultConfig(): SinglesSnapshot {
  return {
    orderMode: "LOW_TO_HIGH",
    difficulty: "EASY",
    pointsSingle: 1,
    pointsDouble: 2,
    pointsTreble: 3,
  };
}

/** `n` prior turns (targets 1..n), each 3 SINGLE hits, so a fresh engine
 * rehydrated from it starts exactly at target `n + 1` (or BULL when n = 20),
 * in progress. */
function priorTurnsThroughNumber(n: number): TurnFact[] {
  const turns: TurnFact[] = [];
  for (let number = 1; number <= n; number += 1) {
    const darts: DartFact[] = [1, 2, 3].map((seq) => ({
      sequence: seq,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: number,
      hitZoneKey: "SINGLE",
      score: number,
      locationX: null,
      locationY: null,
    }));
    turns.push({
      clientKey: `prior-${number}`,
      stageClientKey: "block-1",
      sequence: number,
      completedAt: "2026-08-01T10:00:00.000Z",
      totalScore: darts.reduce((sum, d) => sum + d.score, 0),
      darts,
    });
  }
  return turns;
}

type GameStub = SinglesTrainingPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    rulesetVersionKey: "SINGLES_V1",
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
    ...singlesTrainingPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: settingsStub(settingsOverrides),
    },
  } as SinglesTrainingPlayContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(singlesTrainingEngineFactory);
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

  it("resuming an already-terminal engine finishes the session instead of leaving it silently playable", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const bullDarts: DartFact[] = [1, 2, 3].map((seq) => ({
      sequence: seq,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
      score: 25,
      locationX: null,
      locationY: null,
    }));
    const turns = [
      ...priorTurnsThroughNumber(20),
      {
        clientKey: "prior-bull",
        stageClientKey: "block-1",
        sequence: 21,
        completedAt: "2026-08-01T10:00:00.000Z",
        totalScore: 75,
        darts: bullDarts,
      },
    ];
    const play = makePlay({ turns });

    await play.init.call(play);

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
  });
});

describe("currentTargetLabel / currentPoints / isBullVisit", () => {
  it("starts at target 1 with zero points, not the bull visit", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("1");
    expect(play.currentPoints.call(play)).toBe("0");
    expect(play.isBullVisit.call(play)).toBe(false);
  });

  it("shows target 20 after 19 cleared targets", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(19) });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("20");
    expect(play.isBullVisit.call(play)).toBe(false);
  });

  it("shows BULL and isBullVisit true after 20 cleared targets", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("BULL");
    expect(play.isBullVisit.call(play)).toBe(true);
  });
});

describe("recordTap on a number target", () => {
  it("SINGLE adds 1 point and records a SINGLE dart on the current target", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");

    expect(play.currentPoints.call(play)).toBe("1");
    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.hitTargetNumber).toBe(1);
    expect(dart.hitZoneKey).toBe("SINGLE");
    expect(dart.intendedTargetNumber).toBeNull();
    expect(dart.intendedZoneKey).toBeNull();
  });

  it("DOUBLE adds 2 points, TREBLE adds 3, MISS adds 0", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "DOUBLE");
    expect(play.currentPoints.call(play)).toBe("2");

    await play.recordTap.call(play, "TREBLE");
    expect(play.currentPoints.call(play)).toBe("5");

    await play.recordTap.call(play, "MISS");
    expect(play.currentPoints.call(play)).toBe("5");
    expect(play.$store.game.turns[0].darts[2].hitZoneKey).toBe("MISS");
    expect(play.$store.game.turns[0].darts[2].hitTargetNumber).toBeNull();
  });

  it("a resolved 3-dart visit advances to the next target", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");

    expect(play.currentTargetLabel.call(play)).toBe("2");
    expect(play.currentPoints.call(play)).toBe("3");
  });
});

describe("recordTap on the BULL visit", () => {
  it("SINGLE records OUTER_BULL for pointsSingle, DOUBLE records INNER_BULL for pointsDouble", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    expect(play.currentPoints.call(play)).toBe("61"); // 60 prior + 1
    let dart = play.$store.game.turns[20].darts[0];
    expect(dart.hitTargetNumber).toBe(25);
    expect(dart.hitZoneKey).toBe("OUTER_BULL");

    await play.recordTap.call(play, "DOUBLE");
    expect(play.currentPoints.call(play)).toBe("63"); // + 2
    dart = play.$store.game.turns[20].darts[1];
    expect(dart.hitTargetNumber).toBe(25);
    expect(dart.hitZoneKey).toBe("INNER_BULL");
  });

  it("the BULL visit's 3rd dart completes the session and captures the final points total", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "DOUBLE");
    await play.recordTap.call(play, "MISS");

    expect(play.finished).toBe(true);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(play.resultsSnapshot).toEqual({ points: 63 }); // 60 + 1 + 2 + 0
    expect(play.completionStatus).toBe("succeeded");
  });
});

describe("undoVisit", () => {
  it("reverts the last dart, restoring the prior points total", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, "TREBLE");

    play.undoVisit.call(play);

    expect(play.currentPoints.call(play)).toBe("0");
    expect(play.$store.game.turns[0].darts).toHaveLength(0);
  });

  it("clears hiddenTurnKey set by a resolved visit", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    expect(play.hiddenTurnKey).not.toBeNull();

    play.undoVisit.call(play);

    expect(play.hiddenTurnKey).toBeNull();
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

  it("reflects hit/miss by training points for darts thrown so far, placeholders for the rest", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });

  it("marks a dart that scores board points on a different number as a miss, not a hit", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.commitDart.call(play, {
      hitTargetNumber: 5,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });

    expect(play.previewSegments.call(play)).toEqual([
      { status: "miss" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

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

describe("completion", () => {
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
    vi.mocked(completeSession).mockRejectedValue({
      code: "SESSION_ALREADY_COMPLETED",
    });
    const play = makePlay();
    await play.init.call(play);

    await play.uploadAndCompleteSession.call(play);

    expect(play.completionStatus).toBe("succeeded");
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
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });

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
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    play.completionStatus = "succeeded";
    play.finished = true;

    vi.mocked(createSession).mockResolvedValue({
      sessionId: "new-session",
      participants: [
        {
          ref: "new-participant",
          displayName: "Player",
          participantTypeKey: "PLAYER",
        },
      ],
    } as any);

    await play.playAgain.call(play);

    expect(createSession).toHaveBeenCalledWith({
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: "SINGLES_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
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

    expect(play.playAgainError).toBe(
      "Could not start a new session. Try again.",
    );
    expect(play.finished).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: FAIL — `Cannot find module '@lib/game/singles-training-play.data'`.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/game/singles-training-play.data.ts`:

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
import {
  BULL_TARGET_NUMBER,
  numbersPath,
  targetAt,
} from "@modules/game/board-progression.module";
import type { RulesetVersionKey, SinglesSnapshot } from "@lib/types";
import type {
  BoardTarget,
  DartFact,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  TurnFact,
} from "@modules/types";
import type {
  SinglesPreviewSegment,
  SinglesTrainingPlayContext,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// singlesTrainingEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";

const GAME_TYPE_KEY = "SINGLES_TRAINING";
const RULESET_VERSION_KEY: RulesetVersionKey = "SINGLES_V1";

const EMPTY_SEGMENTS: readonly SinglesPreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

/** Mirrors the engine's own (unexported) ring classification — the module
 * boundary between this play data module and the engine module means it
 * cannot be imported directly; see the design spec's flagged duplication. */
const SINGLE_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
]);

function trainingPointsFor(
  target: BoardTarget,
  config: SinglesSnapshot,
  dart: DartFact,
): number {
  if (target.kind === "BULL") {
    if (dart.hitTargetNumber !== BULL_TARGET_NUMBER) return 0;
    if (dart.hitZoneKey === "OUTER_BULL") return config.pointsSingle;
    if (dart.hitZoneKey === "INNER_BULL") return config.pointsDouble;
    return 0;
  }
  if (dart.hitTargetNumber !== target.number) return 0;
  if (SINGLE_ZONE_KEYS.has(dart.hitZoneKey)) return config.pointsSingle;
  if (dart.hitZoneKey === "DOUBLE") return config.pointsDouble;
  if (dart.hitZoneKey === "TREBLE") return config.pointsTreble;
  return 0;
}

/**
 * Every turn maps 1:1 to the target at its own array index (the engine only
 * ever opens a new turn once the previous one holds 3 darts), so the last
 * turn's target is always `targetAt(numbersPath(), turns.length - 1)` — no
 * separate per-dart target bookkeeping is needed.
 */
function previewSegmentsFor(
  turns: readonly TurnFact[],
  config: SinglesSnapshot | null,
  hiddenTurnKey: string | null,
): SinglesPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey || !config) {
    return [...EMPTY_SEGMENTS];
  }
  const target = targetAt(numbersPath(), turns.length - 1);
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return {
      status: trainingPointsFor(target, config, dart) > 0 ? "hit" : "miss",
    };
  });
}

function resumeEngine(
  game: SinglesTrainingPlayContext["$store"]["game"],
): SinglesTrainingEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY)
    return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof SinglesTrainingEngine ? engine : null;
}

function currentFacts(context: SinglesTrainingPlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

export function singlesTrainingPlay() {
  return {
    loading: false,
    error: "",
    finished: false,
    hasActiveSession: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    completionStatus: "pending" as
      | "pending"
      | "saving"
      | "succeeded"
      | "failed",
    completionError: "",
    playAgainError: "",
    playAgainLoading: false,
    resultsSnapshot: null as { points: number } | null,
    hiddenTurnKey: null as string | null,
    engine: null as SinglesTrainingEngine | null,

    currentTargetLabel(this: SinglesTrainingPlayContext): string {
      if (!this.engine) return "";
      const target = targetAt(numbersPath(), this.engine.state().targetIndex);
      return target.kind === "BULL" ? "BULL" : String(target.number);
    },

    currentPoints(this: SinglesTrainingPlayContext): string {
      if (!this.engine) return "";
      return String(this.engine.state().totalPoints);
    },

    isBullVisit(this: SinglesTrainingPlayContext): boolean {
      if (!this.engine) return false;
      return (
        targetAt(numbersPath(), this.engine.state().targetIndex).kind ===
        "BULL"
      );
    },

    previewSegments(
      this: SinglesTrainingPlayContext,
    ): SinglesPreviewSegment[] {
      return previewSegmentsFor(
        this.$store.game.turns,
        this.$store.game.configSnapshot,
        this.hiddenTurnKey,
      );
    },

    async init(this: SinglesTrainingPlayContext) {
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

        if (engine.isComplete()) {
          this.finished = true;
          this.completionStatus = "pending";
          await this.uploadAndCompleteSession();
        }
      } catch {
        this.reconciliationFailed = true;
        this.hasActiveSession = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async retryReconciliation(this: SinglesTrainingPlayContext) {
      await this.init();
    },

    async recordTap(
      this: SinglesTrainingPlayContext,
      ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
    ) {
      if (!this.engine || this.finished) return;
      const target = targetAt(numbersPath(), this.engine.state().targetIndex);
      const observation: DartObservation =
        ring === "MISS"
          ? {
              hitTargetNumber: null,
              hitZoneKey: "MISS",
              locationX: null,
              locationY: null,
            }
          : target.kind === "BULL"
            ? {
                hitTargetNumber: BULL_TARGET_NUMBER,
                hitZoneKey: ring === "SINGLE" ? "OUTER_BULL" : "INNER_BULL",
                locationX: null,
                locationY: null,
              }
            : {
                hitTargetNumber: target.number,
                hitZoneKey: ring,
                locationX: null,
                locationY: null,
              };
      await this.commitDart(observation);
    },

    async commitDart(
      this: SinglesTrainingPlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine) return;
      try {
        this.engine.record(observation);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        return;
      }
      this.error = "";
      const facts = this.engine.facts();
      this.$store.game.recordFacts(facts);

      const resolvedTurn = facts.turns.at(-1);
      if (resolvedTurn?.completedAt) {
        this.hiddenTurnKey = resolvedTurn.clientKey;
      }

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },

    undoVisit(this: SinglesTrainingPlayContext) {
      if (this.finished) return;
      if (!this.engine || !this.engine.undo()) return;
      this.hiddenTurnKey = null;
      this.$store.game.recordFacts(this.engine.facts());
      this.error = "";
    },

    async uploadAndCompleteSession(
      this: SinglesTrainingPlayContext,
    ): Promise<void> {
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
        this.resultsSnapshot = { points: finalState.totalPoints };
      }
      this.completionStatus = "succeeded";
    },

    async back(this: SinglesTrainingPlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: SinglesTrainingPlayContext) {
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
          await appendBatch(
            sessionId,
            this.$store.game.idempotencyKey,
            batch,
          );
        }
        await completeSession(sessionId, "ABANDONED");
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.$store.game.loading = false;
      }
    },

    async playAgain(this: SinglesTrainingPlayContext) {
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
        this.hiddenTurnKey = null;
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(config);
        if (!(engine instanceof SinglesTrainingEngine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: PASS, every test in the file green.

- [ ] **Step 5: Typecheck**

Run: `cd app && npm run check`
Expected: 0 errors, 0 unused imports.

- [ ] **Step 6: Commit**

```bash
cd app && git add src/lib/game/singles-training-play.data.ts tests/lib/game/singles-training-play.data.test.ts
git commit -m "feat(singles-training): add play data module"
```

---

### Task 6: Generalize the shared visit preview component

**Files:**
- Modify (rename): `app/src/components/layout/games/Bobs27VisitPreview.astro` → `app/src/components/layout/games/VisitPreview.astro`
- Modify: `app/src/components/layout/games/interfaces/Bobs27.astro` (update its import)

**Interfaces:**
- Consumes: nothing new — the component already reads only `previewSegments()` off whatever Alpine scope it's mounted in, with zero Bob's-27-specific props or text.
- Produces: `VisitPreview.astro`, consumed by both `Bobs27.astro` (unchanged behavior) and Task 8's `SinglesTraining.astro`.

`Bobs27VisitPreview.astro` carries no Bob's-27-specific markup, props, or copy — it renders whatever `previewSegments()` returns on the host Alpine scope, using the generic `CheckIcon`/`CrossIcon`/empty-dot visual and the literal "D1 D2 D3" caption. Duplicating it byte-for-byte for Singles Training would violate `app/CLAUDE.md`'s "reuse existing UI components before hand-rolling markup" rule — a plain rename is the correct move, not a new component.

- [ ] **Step 1: Rename the file**

```bash
cd app && git mv src/components/layout/games/Bobs27VisitPreview.astro src/components/layout/games/VisitPreview.astro
```

- [ ] **Step 2: Update `Bobs27.astro`'s import**

In `app/src/components/layout/games/interfaces/Bobs27.astro`, change:

```ts
import Bobs27VisitPreview from "@components/layout/games/Bobs27VisitPreview.astro";
```

to:

```ts
import VisitPreview from "@components/layout/games/VisitPreview.astro";
```

and change its usage in the template:

```astro
<Bobs27VisitPreview />
```

to:

```astro
<VisitPreview />
```

- [ ] **Step 3: Confirm no other references remain**

Run: `cd app && grep -rn "Bobs27VisitPreview" src/`
Expected: no output.

- [ ] **Step 4: Astro conventions gate**

Run: `bash scripts/check-astro-conventions.sh` (from repo root)
Expected: OK — the file's content is unchanged, only its path and both import sites.

- [ ] **Step 5: Commit**

```bash
cd app && git add -A src/components/layout/games/VisitPreview.astro src/components/layout/games/Bobs27VisitPreview.astro src/components/layout/games/interfaces/Bobs27.astro
git commit -m "refactor(games): generalize Bobs27VisitPreview into a shared VisitPreview"
```

---

### Task 7: Target-aware recreational input

**Files:**
- Create: `app/src/components/layout/games/SinglesRecreationalInput.astro`

**Interfaces:**
- Consumes: `InputButton` (`./InputButton.astro`), `UndoIcon` (`@icons/undo.svg`); reads `isBullVisit()`, `recordTap(ring)`, `undoVisit()`, `finished`, `$store.game.turns` off the host Alpine scope (Task 5's `singlesTrainingPlay()`).
- Produces: `SinglesRecreationalInput.astro`, consumed by Task 8's `SinglesTraining.astro`.

- [ ] **Step 1: Create the component**

Create `app/src/components/layout/games/SinglesRecreationalInput.astro`:

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
  class="rounded-lg glass border border-border bg-surface-raised flex flex-1 min-h-0 w-full divide-x divide-border"
  {...props}
>
  <InputButton
    aria-label="Undo last dart"
    :disabled="!$store.game.turns.length || finished"
    @click="undoVisit()"
  >
    <UndoIcon class="size-6 text-muted" />
  </InputButton>
  <template x-if="!isBullVisit()">
    <InputButton
      :disabled="finished"
      @click="recordTap('SINGLE')"
    >
      S
    </InputButton>
  </template>
  <template x-if="!isBullVisit()">
    <InputButton
      :disabled="finished"
      @click="recordTap('DOUBLE')"
    >
      D
    </InputButton>
  </template>
  <template x-if="!isBullVisit()">
    <InputButton
      :disabled="finished"
      @click="recordTap('TREBLE')"
    >
      T
    </InputButton>
  </template>
  <template x-if="isBullVisit()">
    <InputButton
      :disabled="finished"
      @click="recordTap('SINGLE')"
    >
      Bull
    </InputButton>
  </template>
  <template x-if="isBullVisit()">
    <InputButton
      :disabled="finished"
      @click="recordTap('DOUBLE')"
    >
      Bullseye
    </InputButton>
  </template>
  <InputButton
    :disabled="finished"
    @click="recordTap('MISS')"
  >
    Miss
  </InputButton>
</div>
```

- [ ] **Step 2: Astro conventions gate**

Run: `bash scripts/check-astro-conventions.sh` (from repo root)
Expected: OK.

- [ ] **Step 3: Commit**

```bash
cd app && git add src/components/layout/games/SinglesRecreationalInput.astro
git commit -m "feat(singles-training): add target-aware recreational input row"
```

---

### Task 8: Interface + results components

**Files:**
- Create: `app/src/components/layout/games/interfaces/SinglesTraining.astro`
- Create: `app/src/components/layout/games/result-modals/SinglesTrainingResults.astro`

**Interfaces:**
- Consumes: `SinglePlayerDisplay`, `StatRow`, `VisitPreview` (Task 6), `SinglesRecreationalInput` (Task 7), `Button`, `IsLoading` — all existing/just-created components.
- Produces: `SinglesTraining.astro` and `SinglesTrainingResults.astro`, consumed by Task 9's play route.

- [ ] **Step 1: Create the interface component**

Create `app/src/components/layout/games/interfaces/SinglesTraining.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import SinglesRecreationalInput from "@components/layout/games/SinglesRecreationalInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <SinglePlayerDisplay
    isTarget={false}
    score="currentPoints()"
    class="max-h-2/5 h-full"
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

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <VisitPreview />

  <SinglesRecreationalInput />
</div>
```

- [ ] **Step 2: Create the results modal**

Create `app/src/components/layout/games/result-modals/SinglesTrainingResults.astro`:

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
    <h2 class="font-display text-lg font-semibold text-foreground">
      Session complete
    </h2>

    {/* Stats: shown once the final score is known */}
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus === 'succeeded' && resultsSnapshot"
      x-cloak
    >
      <StatRow
        label="Total points"
        value="resultsSnapshot?.points"
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

- [ ] **Step 3: Astro conventions gate**

Run: `bash scripts/check-astro-conventions.sh` (from repo root)
Expected: OK.

- [ ] **Step 4: Commit**

```bash
cd app && git add src/components/layout/games/interfaces/SinglesTraining.astro src/components/layout/games/result-modals/SinglesTrainingResults.astro
git commit -m "feat(singles-training): add gameplay interface and results components"
```

---

### Task 9: Play page route

**Files:**
- Create: `app/src/pages/games/singles-training/play/index.astro`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`

**Interfaces:**
- Consumes: `GameLayout`, `SinglesTraining` (Task 8), `SinglesTrainingResults` (Task 8), `NoSessionPanel`, `ReconciliationBlocked`, `singlesTrainingPlay` (Task 5).
- Produces: the `/games/singles-training/play` route, and `Alpine.data("singlesTrainingPlay", ...)` registration.

- [ ] **Step 1: Create the play route**

Create `app/src/pages/games/singles-training/play/index.astro`:

```astro
---
export const prerender = true;
import GameLayout from "@layouts/GameLayout.astro";
import SinglesTraining from "@components/layout/games/interfaces/SinglesTraining.astro";
import SinglesTrainingResults from "@components/layout/games/result-modals/SinglesTrainingResults.astro";
import NoSessionPanel from "@components/layout/games/NoSessionPanel.astro";
import ReconciliationBlocked from "@components/layout/games/ReconciliationBlocked.astro";
---

<GameLayout
  title="Singles Training — Play"
  gameTitle="SINGLES TRAINING"
>
  <div
    class="flex flex-col flex-1 min-h-0 p-3"
    x-data="singlesTrainingPlay()"
    @confirm-exit.window="abandonAndExit()"
  >
    {/* Loading / reconciliation-blocked */}
    <ReconciliationBlocked />

    {/* No active session view */}
    <NoSessionPanel href="/games/singles-training/setup" />

    {/* Gameplay view */}
    <SinglesTraining
      x-show="!finished && hasActiveSession"
      x-cloak
    />

    {/* Results modal (overlay) */}
    <SinglesTrainingResults />
  </div>
</GameLayout>
```

- [ ] **Step 2: Register the Alpine data factory**

In `app/src/lib/client/alpine/register-route-data.ts`, add the import and registration:

```ts
import { singlesTrainingPlay } from "@lib/game/singles-training-play.data";
```

```ts
  Alpine.data("singlesTrainingPlay", singlesTrainingPlay);
```

(placed after the existing `Alpine.data("bobs27Play", bobs27Play);` line, after `singlesTrainingSetup` if both are added in the same file pass)

- [ ] **Step 3: Typecheck**

Run: `cd app && npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd app && git add src/pages/games/singles-training/play/index.astro src/lib/client/alpine/register-route-data.ts
git commit -m "feat(singles-training): wire play page to the full gameplay interface"
```

---

### Task 10: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full suite, typecheck, format**

Run: `cd app && npm test && npm run check && npm run format:check`
Expected: full suite green (no regressions vs. the pre-branch baseline, including `games-visibility.test.ts` and `capabilities.test.ts`), 0 type errors, format clean.

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

Expected: every script OK. (`npm run validate:app`'s DB-dependent steps — `db:status`/`db:migrate`/`db:introspect` — are expected to fail only if no `DATABASE_URL` is configured in the environment; no schema/migration/seed changes exist in this plan.)

- [ ] **Step 4: Manual dev-server smoke check**

Start: `cd app && astro dev --background`

- `/games` under RECREATIONAL app mode → "Singles training" card is visible; switch to ANALYTICS app mode → the card disappears (no active session).
- `/games/singles-training/setup` → Start → lands on `/games/singles-training/play` showing target "1", 0 points, an empty visit preview, and the S/D/T/Miss row.
- Play through target 1 (tap S, D, T) → preview shows three check marks, points reads 6, target advances to "2".
- Play through targets 2–19 with any mix of taps, using Undo at least once to confirm it decrements correctly.
- At target 20, tap Miss ×3 → target advances to "BULL" and the input row switches to Bull / Bullseye / Miss (no Treble button).
- Tap Bull, Bullseye, Miss → results modal shows "Session complete" and a total points figure; "Play again" starts a fresh session back at target "1", 0 points.
- Confirm the Exit button (top-left, `GameLayout`) opens the leave-game confirm and abandoning returns to `/games`.

Stop: `astro dev stop`

- [ ] **Step 5: Context maintenance**

Run the `context-maintenance` skill: update `docs/architecture/00-Context-Map.md`'s File Inventory (new setup/play data modules, new components, the `VisitPreview.astro` rename, new routes; bump the Version changelog), confirm no new decision-ledger entry is needed (per this plan's Global Constraints), confirm ISO dates on any new doc rows, and confirm `run-all-gates` was fully run (Step 3 above).

- [ ] **Step 6: finishing-a-development-branch**

Follow this repo's `finishing-a-development-branch` skill to decide push/PR, noting in the PR body (if opened) that this ships Singles Training's frontend on top of its already-shipped engine/validator/capability layer.
