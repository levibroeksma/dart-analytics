# Doubles Training v1 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the missing games-index card, setup page, play page, and results modal for `DOUBLES_TRAINING_V1`, whose engine/validator/capability/seed already shipped 2026-07-26 and are frozen.

**Architecture:** Astro pages + Alpine `.data.ts` factories, mirroring the already-shipped Bob's 27 and Singles Training frontends exactly. No board input: `DOUBLES_TRAINING_V1` declares only RECREATIONAL + DETAILED_DARTS (`capabilities.ts`), so there is no mode-gating branch anywhere in this phase. The play screen shows hit/miss totals only, derived from `DoublesTrainingEngine.state().outcomes` — never stored.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Vitest.

## Global Constraints

- No engine, validator, capability, or schema change — `app/src/modules/game/doubles-training.engine.module.ts`, `app/src/services/rulesets/doubles-training/doubles-training.validator.ts`, `capabilities.ts`, and seed `0007` are frozen inputs, not edited by this plan.
- Store facts; statistics are always derived (engine `state()`/`facts()`), never persisted as separate fields.
- No `.astro` component tests (D101) — variant logic stays inline in frontmatter.
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated.
- Semantic Tailwind tokens only; reuse existing primitives — no new one-off markup where an existing component fits.
- `app/CLAUDE.md`'s TypeScript comment rule: no `//`/`/* */` comments inside function/method bodies in `app/src/**/*.ts`; put necessary detail in JSDoc above the declaration.
- Run `cd app && npm run format` before considering any task's diff final; commit any formatting changes.

---

## File Structure

New files:
- `app/src/lib/game/doubles-training-setup.data.ts` — setup page Alpine factory
- `app/src/lib/game/doubles-training-play.data.ts` — play page Alpine factory
- `app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro`
- `app/src/components/layout/games/DoublesTrainingRecreationalInput.astro`
- `app/src/components/layout/games/interfaces/DoublesTraining.astro`
- `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro`
- `app/src/pages/games/doubles-training/setup/index.astro`
- `app/src/pages/games/doubles-training/play/index.astro`
- `app/tests/lib/game/doubles-training-setup.data.test.ts`
- `app/tests/lib/game/doubles-training-play.data.test.ts`

Modified files:
- `app/src/lib/game/types.ts` — add `DoublesPreviewSegment`, `DoublesTrainingSetupContext`, `DoublesTrainingPlayContext`
- `app/src/lib/game/rulesets/games-visibility.ts` — add the `DOUBLES_TRAINING_V1` card to `GAME_CARDS`
- `app/tests/lib/game/rulesets/games-visibility.test.ts` — extend for the new card

---

### Task 1: Type contracts for the new Alpine factories

**Files:**
- Modify: `app/src/lib/game/types.ts:1-25` (imports), `app/src/lib/game/types.ts:418-419` (insertion point, end of `SinglesTrainingPlayContext`, before `GamesIndexContext`)

**Interfaces:**
- Consumes: `PlayStoreContext<TConfig>` (`types.ts:70`), `DoublesTrainingSnapshot` (`rulesets/types.ts:150`), `DoublesTrainingEngine` (`@modules/game/doubles-training.engine.module`), `DartObservation`/`TurnFact` (`@modules/types`), `ConfigurationPresetData` (`@client/api/configuration-templates`), `SessionActiveData` (`@client/api/types`).
- Produces: `DoublesPreviewSegment`, `DoublesTrainingSetupContext`, `DoublesTrainingPlayContext` — consumed by Tasks 3 and 5's `.data.ts` modules and their tests.

- [ ] **Step 1: Add the two new imports**

In `app/src/lib/game/types.ts`, add the engine import alongside the other engine imports (after line 7):

```ts
import type { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";
import type { DoublesTrainingEngine } from "@modules/game/doubles-training.engine.module";
```

And add `DoublesTrainingSnapshot` to the existing `from "./rulesets/types"` import (lines 18-25):

```ts
import type {
  ModePair,
  RulesetVersionKey,
  ScoreTrainingSnapshot,
  FiveOhOneSnapshot,
  Bobs27Snapshot,
  SinglesSnapshot,
  DoublesTrainingSnapshot,
} from "./rulesets/types";
```

- [ ] **Step 2: Insert the three new types**

Insert after line 418 (the closing `};` of `SinglesTrainingPlayContext`) and before the `/** Games-page state. ... */` comment on line 420:

```ts
/** One dart slot in Doubles Training's visit preview — a resolved hit/miss mark (against the visit's own intended double/bull), or a not-yet-thrown placeholder. */
export type DoublesPreviewSegment = { status: "hit" | "miss" | "empty" };

export type DoublesTrainingSetupContext = {
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
  init(this: DoublesTrainingSetupContext): Promise<void>;
  reconcile(
    this: DoublesTrainingSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: DoublesTrainingSetupContext): Promise<void>;
  continueSession(this: DoublesTrainingSetupContext): void;
  abandonSession(this: DoublesTrainingSetupContext): Promise<void>;
  start(this: DoublesTrainingSetupContext): Promise<void>;
};

export type DoublesTrainingPlayContext = {
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
  resultsSnapshot: { hits: number; misses: number } | null;
  hiddenTurnKey: string | null;
  $store: PlayStoreContext<DoublesTrainingSnapshot>;
  engine: DoublesTrainingEngine | null;
  currentTargetLabel(this: DoublesTrainingPlayContext): string;
  hitCount(this: DoublesTrainingPlayContext): string;
  missCount(this: DoublesTrainingPlayContext): string;
  previewSegments(this: DoublesTrainingPlayContext): DoublesPreviewSegment[];
  init(this: DoublesTrainingPlayContext): Promise<void>;
  retryReconciliation(this: DoublesTrainingPlayContext): Promise<void>;
  recordTap(this: DoublesTrainingPlayContext, hit: boolean): Promise<void>;
  commitDart(
    this: DoublesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: DoublesTrainingPlayContext): void;
  uploadAndCompleteSession(this: DoublesTrainingPlayContext): Promise<void>;
  back(this: DoublesTrainingPlayContext): Promise<void>;
  playAgain(this: DoublesTrainingPlayContext): Promise<void>;
  abandonAndExit(this: DoublesTrainingPlayContext): Promise<void>;
};
```

- [ ] **Step 3: Type-check**

Run: `cd app && npm run check`
Expected: PASS, no TypeScript errors (the new types are exported but not yet consumed anywhere — that is fine, unused exports do not error).

- [ ] **Step 4: Commit**

```bash
cd app
git add src/lib/game/types.ts
git commit -m "Add Doubles Training play/setup Alpine context types"
```

---

### Task 2: Games-index card

**Files:**
- Modify: `app/src/lib/game/rulesets/games-visibility.ts:14-39` (`GAME_CARDS`)
- Modify: `app/tests/lib/game/rulesets/games-visibility.test.ts`

**Interfaces:**
- Consumes: `GameCardDescriptor` (`./types`), `supportsCaptureMode` (`./capabilities.ts` — already declares `DOUBLES_TRAINING_V1: [DETAILED_DARTS]`, no change needed there).
- Produces: a `DOUBLES_TRAINING_V1` entry in `GAME_CARDS`, read by `games-index.data.ts`'s `isVisible`/`noneVisible` (no change needed to that file — it already imports `GAME_CARDS` generically).

- [ ] **Step 1: Write the failing test**

In `app/tests/lib/game/rulesets/games-visibility.test.ts`, update the `"shows every carded game under recreational"` test (replace its body) to include the new card:

```ts
  it("shows every carded game under recreational", () => {
    const keys = visibleGames("RECREATIONAL", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual([
      "SCORE_TRAINING_V1",
      "501_V1",
      "BOBS27_V1",
      "SINGLES_V1",
      "DOUBLES_TRAINING_V1",
    ]);
  });
```

The `"shows every carded game that declares an analytics pair..."` test already asserts `SINGLES_V1` is absent from the ANALYTICS list via `expect(keys).not.toContain("SINGLES_V1")` and a fixed 3-element array — add the same absence assertion for the new card:

```ts
  it("shows every carded game that declares an analytics pair, and no others, under analytics", () => {
    const keys = visibleGames("ANALYTICS", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual(["501_V1", "BOBS27_V1", "SCORE_TRAINING_V1"]);
    expect(keys).not.toContain("SINGLES_V1");
    expect(keys).not.toContain("DOUBLES_TRAINING_V1");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: FAIL — the recreational-list assertion is missing `"DOUBLES_TRAINING_V1"` from the actual output (card does not exist yet).

- [ ] **Step 3: Add the card**

In `app/src/lib/game/rulesets/games-visibility.ts`, append to `GAME_CARDS` (after the `SINGLES_V1` entry, before the closing `];`):

```ts
  {
    rulesetVersionKey: "SINGLES_V1",
    href: "/games/singles-training/setup",
    title: "Singles training",
    caption: "Section training, one target at a time.",
  },
  {
    rulesetVersionKey: "DOUBLES_TRAINING_V1",
    href: "/games/doubles-training/setup",
    title: "Doubles training",
    caption: "Work every double, low to high, ending on the bull.",
  },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: PASS (all cases, including the unmodified `"gives every card a setup href and copy"` and `"keeps the declared card order..."` cases, which already generalize to any `GAME_CARDS` length).

- [ ] **Step 5: Commit**

```bash
cd app
git add src/lib/game/rulesets/games-visibility.ts tests/lib/game/rulesets/games-visibility.test.ts
git commit -m "Add Doubles Training games-index card"
```

---

### Task 3: Setup data module

**Files:**
- Create: `app/src/lib/game/doubles-training-setup.data.ts`
- Test: `app/tests/lib/game/doubles-training-setup.data.test.ts`

**Interfaces:**
- Consumes: `DoublesTrainingSetupContext` (Task 1), `fetchConfigurationPresets`/`createSession`/`fetchActiveSessions`/`completeSession` (`@client/api/*`), `toSnapshot` (`@lib/game/rulesets/config-codec`), `reconcileActiveSession` (`@lib/game/session-recovery`), `resolveSessionModePair`/`startSessionInput` (`@lib/game/session-mode-resolution`).
- Produces: `doublesTrainingSetup()` factory — exports `init`, `reconcile`, `retryReconciliation`, `continueSession`, `abandonSession`, `start` — consumed by Task 4's setup page (`x-data="doublesTrainingSetup()"`).

This is a line-for-line mirror of `app/src/lib/game/singles-training-setup.data.ts` with `GAME_TYPE_KEY = "DOUBLES_TRAINING"`, `RULESET_VERSION_KEY = "DOUBLES_TRAINING_V1"`, and the play route `/games/doubles-training/play`. The seeded preset (`database/seeds/0003_game_engine_reference.sql:136-149`, id `0198f300-...-000010`) has `configuration: { "mode": "EASY", "order_mode": "LOW_TO_HIGH" }`, matching `DoublesTrainingConfig`'s schema exactly — `toSnapshot("DOUBLES_TRAINING_V1", preset.configuration)` needs no per-field mapping beyond the codec's generic snake→camel conversion (`mode`/`order_mode` → `mode`/`orderMode`).

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/game/doubles-training-setup.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { doublesTrainingSetup } from "@lib/game/doubles-training-setup.data";
import type { DoublesTrainingSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const STANDARD_PRESET = {
  configurationTemplateId: "tmpl-doubles-standard",
  gameTypeKey: "DOUBLES_TRAINING",
  name: "Doubles Training — Easy, Low to High",
  description: null,
  configuration: {
    mode: "EASY",
    order_mode: "LOW_TO_HIGH",
  },
  isSystemTemplate: true,
} as any;

describe("doublesTrainingSetup", () => {
  let store: DoublesTrainingSetupContext["$store"];

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
    overrides: Partial<DoublesTrainingSetupContext> = {},
  ): DoublesTrainingSetupContext {
    return {
      ...doublesTrainingSetup(),
      $store: store,
      ...overrides,
    } as DoublesTrainingSetupContext;
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
        "DOUBLES_TRAINING",
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
        { sessionId: "match-id", gameTypeKey: "DOUBLES_TRAINING" } as any,
      ]);
      store.game.sessionId = "match-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "match-id",
        gameTypeKey: "DOUBLES_TRAINING",
      });
    });

    it('blocks with reconciliationFailed on "abandon_failed"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "DOUBLES_TRAINING" } as any,
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
          gameTypeKey: "DOUBLES_TRAINING",
        } as any,
      });
      const locationSpy = { href: "/games/doubles-training/setup" };
      vi.stubGlobal("location", locationSpy);

      setup.continueSession();

      expect(locationSpy.href).toBe("/games/doubles-training/play");
    });

    it("abandons session when user clicks Abandon", async () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "DOUBLES_TRAINING",
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
        gameTypeKey: "DOUBLES_TRAINING",
        rulesetVersionKey: "DOUBLES_TRAINING_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        config: {
          source: "template",
          templateRef: "tmpl-doubles-standard",
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-doubles-standard",
          configSnapshot: expect.objectContaining({
            mode: "EASY",
            orderMode: "LOW_TO_HIGH",
          }),
        }),
      );
      expect(locationSpy.href).toBe("/games/doubles-training/play");
    });

    it("falls back to Doubles Training's declared pair when settings holds a pair it does not declare", async () => {
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
        "Could not find a preset for Doubles Training.",
      );
    });

    it("rejects a preset whose configuration fails schema validation, before creating a session", async () => {
      const setup = createSetup({
        presets: [
          {
            ...STANDARD_PRESET,
            configuration: { mode: "HARD", order_mode: "LOW_TO_HIGH" },
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
        { sessionId: "active-1", gameTypeKey: "DOUBLES_TRAINING" } as any,
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

Run: `cd app && npx vitest run tests/lib/game/doubles-training-setup.data.test.ts`
Expected: FAIL with `Cannot find module '@lib/game/doubles-training-setup.data'`

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/game/doubles-training-setup.data.ts`:

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
import type { DoublesTrainingSetupContext } from "./types";

const GAME_TYPE_KEY = "DOUBLES_TRAINING";
const RULESET_VERSION_KEY = "DOUBLES_TRAINING_V1";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function doublesTrainingSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: DoublesTrainingSetupContext) {
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
      this: DoublesTrainingSetupContext,
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

    async retryReconciliation(this: DoublesTrainingSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: DoublesTrainingSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/doubles-training/play";
    },

    async abandonSession(this: DoublesTrainingSetupContext) {
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

    async start(this: DoublesTrainingSetupContext) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = "Could not find a preset for Doubles Training.";
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
        globalThis.location.href = "/games/doubles-training/play";
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

Run: `cd app && npx vitest run tests/lib/game/doubles-training-setup.data.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
cd app
git add src/lib/game/doubles-training-setup.data.ts tests/lib/game/doubles-training-setup.data.test.ts
git commit -m "Add Doubles Training setup data module"
```

---

### Task 4: Setup page

**Files:**
- Create: `app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro`
- Create: `app/src/pages/games/doubles-training/setup/index.astro`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`

**Interfaces:**
- Consumes: `doublesTrainingSetup()` (Task 3), `SetupShell`/`UserSection` (`./setup/*.astro`), `InfoSection` (`@components/ui/InfoSection.astro`), `ContinueSessionModal`/`Button`/`IsLoading` (existing shared components).
- Produces: the `/games/doubles-training/setup` route. No new exports consumed elsewhere.

No test (D101 — `.astro` markup stays untested; this task's correctness is verified by the dev-server check in Step 3).

- [ ] **Step 1: Create the setup form component**

Create `app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro`:

```astro
---
// Components
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import UserSection from "./UserSection.astro";

// Data
const infoSection = {
  title: "Doubles training rules",
  description:
    "Work through every double, D1 to D20, then the bull. Three darts per target — hit the double and move on immediately; miss all three and you still move on. On the bull, only the inner bull (double bull) counts.",
};
---

<SetupShell title="Doubles training">
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

- [ ] **Step 2: Create the setup page**

Create `app/src/pages/games/doubles-training/setup/index.astro`:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import Button from "@components/forms/Button.astro";
import ContinueSessionModal from "@components/layout/games/ContinueSessionModal.astro";
import DoublesTrainingSetupForm from "@components/layout/games/setup/DoublesTrainingSetupForm.astro";
import IsLoading from "@components/ui/IsLoading.astro";
---

<AppLayout title="Doubles Training — Setup">
  <div
    class="p-4"
    x-data="doublesTrainingSetup()"
  >
    <template x-if="showActiveSessionModal && activeSession">
      <ContinueSessionModal gameTitle="Doubles Training" />
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
      <DoublesTrainingSetupForm />
    </template>

    <template x-if="loadingReconciliation">
      <IsLoading title="Configuring your session..." />
    </template>
  </div>
</AppLayout>
```

- [ ] **Step 3: Register the Alpine factory and verify in the dev server**

In `app/src/lib/client/alpine/register-route-data.ts`, add the import next to `singlesTrainingSetup`'s:

```ts
import { singlesTrainingSetup } from "@lib/game/singles-training-setup.data";
import { singlesTrainingPlay } from "@lib/game/singles-training-play.data";
import { doublesTrainingSetup } from "@lib/game/doubles-training-setup.data";
import { gamesIndex } from "@lib/game/games-index.data";
```

And register it inside `registerRouteData`, next to `singlesTrainingSetup`'s registration:

```ts
  Alpine.data("singlesTrainingSetup", singlesTrainingSetup);
  Alpine.data("singlesTrainingPlay", singlesTrainingPlay);
  Alpine.data("doublesTrainingSetup", doublesTrainingSetup);
}
```

(`doublesTrainingPlay` is added to both blocks in Task 6 Step 5, once that module exists.)

Then run: `astro dev --background`, navigate to `/games/doubles-training/setup`, and confirm the page renders the "Doubles training" heading, Players section, rules `InfoSection`, and a working "Start Game" button with no console errors. Stop the server with `astro dev stop` when done.

- [ ] **Step 4: Format and commit**

```bash
cd app
npm run format
git add src/components/layout/games/setup/DoublesTrainingSetupForm.astro src/pages/games/doubles-training/setup/index.astro src/lib/client/alpine/register-route-data.ts
git add -u
git commit -m "Add Doubles Training setup page"
```

---

### Task 5: Play data module

**Files:**
- Create: `app/src/lib/game/doubles-training-play.data.ts`
- Test: `app/tests/lib/game/doubles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `DoublesTrainingPlayContext`/`DoublesPreviewSegment` (Task 1), `DoublesTrainingEngine`/`doublesTrainingEngineFactory` (`@modules/game/doubles-training.engine.module` — frozen), `doublesPath`/`targetAt`/`BULL_TARGET_NUMBER` (`@modules/game/board-progression.module`), `getEngineFactory` (`@modules/game/engine.registry`), `reconcileActiveSession`, `resolveSessionModePair`, `buildEventsBatch`, `appendBatch`/`completeSession`/`createSession`/`fetchActiveSessions` (`@client/api/sessions`).
- Produces: `doublesTrainingPlay()` factory — exports `currentTargetLabel`, `hitCount`, `missCount`, `previewSegments`, `init`, `retryReconciliation`, `recordTap`, `commitDart`, `undoVisit`, `uploadAndCompleteSession`, `back`, `abandonAndExit`, `playAgain` — consumed by Task 6's play page and its components.

This mirrors `bobs27-play.data.ts` structurally (no board input, no `hiddenTimer` — Doubles Training never enters `VISUAL_BOARD`, so a resolved turn's `hiddenTurnKey` is set synchronously like `singles-training-play.data.ts`'s `commitDart` does). `hitCount()`/`missCount()` read `engine.state().outcomes` directly — each `DoublesVisitOutcome.hit` is already the engine's own derived per-visit result, so no separate dart-scanning helper is needed or duplicated.

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/game/doubles-training-play.data.test.ts`:

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
import { doublesTrainingEngineFactory } from "@modules/game/doubles-training.engine.module";
import { doublesTrainingPlay } from "@lib/game/doubles-training-play.data";
import type {
  DoublesTrainingPlayContext,
  DoublesTrainingSnapshot,
} from "@lib/types";
import type { DartFact, StageFact, TurnFact } from "@modules/types";

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "DOUBLES_TRAINING",
  gameTypeName: "Doubles Training",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "DOUBLES_TRAINING_V1",
  startedAt: "now",
} as const;

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function defaultConfig(): DoublesTrainingSnapshot {
  return { mode: "EASY", orderMode: "LOW_TO_HIGH" };
}

/** `n` prior turns (doubles D1..Dn), each a single hit dart, so a fresh
 * engine rehydrated from it starts exactly at target index `n` (0-based;
 * BULL once n = 20), in progress. */
function priorHitTurnsThroughDouble(n: number): TurnFact[] {
  const turns: TurnFact[] = [];
  for (let number = 1; number <= n; number += 1) {
    const dart: DartFact = {
      sequence: 1,
      intendedTargetNumber: number,
      intendedZoneKey: "DOUBLE",
      hitTargetNumber: number,
      hitZoneKey: "DOUBLE",
      score: number * 2,
      locationX: null,
      locationY: null,
    };
    turns.push({
      clientKey: `prior-${number}`,
      stageClientKey: "block-1",
      sequence: number,
      completedAt: "2026-08-01T10:00:00.000Z",
      totalScore: dart.score,
      darts: [dart],
    });
  }
  return turns;
}

type GameStub = DoublesTrainingPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    rulesetVersionKey: "DOUBLES_TRAINING_V1",
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
    ...doublesTrainingPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: settingsStub(settingsOverrides),
    },
  } as DoublesTrainingPlayContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(doublesTrainingEngineFactory);
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
});

describe("currentTargetLabel", () => {
  it("starts at D1", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("D1");
  });

  it("shows D20 after 19 cleared doubles", async () => {
    const play = makePlay({ turns: priorHitTurnsThroughDouble(19) });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("D20");
  });

  it("shows BULL after 20 cleared doubles", async () => {
    const play = makePlay({ turns: priorHitTurnsThroughDouble(20) });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("BULL");
  });
});

describe("recordTap on a double target", () => {
  it("hit records a DOUBLE dart at the current target and advances immediately", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, true);

    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.hitTargetNumber).toBe(1);
    expect(dart.hitZoneKey).toBe("DOUBLE");
    expect(play.$store.game.turns[0].darts).toHaveLength(1);
    expect(play.currentTargetLabel.call(play)).toBe("D2");
  });

  it("a miss does not end the visit until the 3rd dart", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, false);
    expect(play.currentTargetLabel.call(play)).toBe("D1");
    expect(play.$store.game.turns[0].darts).toHaveLength(1);

    await play.recordTap.call(play, false);
    expect(play.currentTargetLabel.call(play)).toBe("D1");

    await play.recordTap.call(play, false);
    expect(play.currentTargetLabel.call(play)).toBe("D2");
    expect(play.$store.game.turns[0].darts).toHaveLength(3);
  });

  it("a hit on the 2nd or 3rd dart still ends the visit early", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, false);
    await play.recordTap.call(play, true);

    expect(play.$store.game.turns[0].darts).toHaveLength(2);
    expect(play.currentTargetLabel.call(play)).toBe("D2");
  });
});

describe("recordTap on the BULL visit", () => {
  it("hit records INNER_BULL at target number 25 and completes the session", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorHitTurnsThroughDouble(20) });
    await play.init.call(play);

    await play.recordTap.call(play, true);

    const dart = play.$store.game.turns[20].darts[0];
    expect(dart.hitTargetNumber).toBe(25);
    expect(dart.hitZoneKey).toBe("INNER_BULL");
    expect(play.finished).toBe(true);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
  });
});

describe("undoVisit", () => {
  it("reverts the last dart", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, false);

    play.undoVisit.call(play);

    expect(play.$store.game.turns).toHaveLength(0);
  });

  it("reopens a visit that a hit ended early, so the next tap resumes it rather than starting a new one", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, true);
    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.currentTargetLabel.call(play)).toBe("D2");

    play.undoVisit.call(play);

    expect(play.currentTargetLabel.call(play)).toBe("D1");
    expect(play.hiddenTurnKey).toBeNull();

    await play.recordTap.call(play, false);

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].darts).toHaveLength(1);
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
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.previewSegments.call(play)).toEqual([
      { status: "miss" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });

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

describe("hitCount / missCount", () => {
  it("counts zero for both before any visit resolves", async () => {
    const play = makePlay();
    await play.init.call(play);

    expect(play.hitCount.call(play)).toBe("0");
    expect(play.missCount.call(play)).toBe("0");
  });

  it("counts a full-miss visit as exactly one miss, not three", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.missCount.call(play)).toBe("1");
    expect(play.hitCount.call(play)).toBe("0");
  });

  it("counts a 2nd-dart hit visit as one hit", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, false);
    await play.recordTap.call(play, true);

    expect(play.hitCount.call(play)).toBe("1");
    expect(play.missCount.call(play)).toBe("0");
  });

  it("accumulates across resolved visits, ignoring an in-progress one", async () => {
    const play = makePlay({ turns: priorHitTurnsThroughDouble(3) });
    await play.init.call(play);

    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.hitCount.call(play)).toBe("3");
    expect(play.missCount.call(play)).toBe("0");
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

  it("captures the final hits/misses split in resultsSnapshot", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorHitTurnsThroughDouble(20) });
    await play.init.call(play);

    await play.recordTap.call(play, true);

    expect(play.resultsSnapshot).toEqual({ hits: 21, misses: 0 });
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
    const play = makePlay({ turns: priorHitTurnsThroughDouble(20) });

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
    const play = makePlay({ turns: priorHitTurnsThroughDouble(20) });
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
      gameTypeKey: "DOUBLES_TRAINING",
      rulesetVersionKey: "DOUBLES_TRAINING_V1",
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

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts`
Expected: FAIL with `Cannot find module '@lib/game/doubles-training-play.data'`

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/game/doubles-training-play.data.ts`:

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
  doublesPath,
  targetAt,
} from "@modules/game/board-progression.module";
import type { RulesetVersionKey } from "@lib/types";
import type {
  BoardTarget,
  DartObservation,
  EngineFacts,
  TurnFact,
} from "@modules/types";
import type {
  DoublesPreviewSegment,
  DoublesTrainingPlayContext,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// doublesTrainingEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { DoublesTrainingEngine } from "@modules/game/doubles-training.engine.module";

const GAME_TYPE_KEY = "DOUBLES_TRAINING";
const RULESET_VERSION_KEY: RulesetVersionKey = "DOUBLES_TRAINING_V1";

function targetLabel(target: BoardTarget): string {
  return target.kind === "BULL" ? "BULL" : `D${target.number}`;
}

const EMPTY_SEGMENTS: readonly DoublesPreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): DoublesPreviewSegment[] {
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

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Mirrors
 * `bobs27-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: DoublesTrainingPlayContext["$store"]["game"],
): DoublesTrainingEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof DoublesTrainingEngine ? engine : null;
}

function currentFacts(context: DoublesTrainingPlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

export function doublesTrainingPlay() {
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
    resultsSnapshot: null as { hits: number; misses: number } | null,
    hiddenTurnKey: null as string | null,
    engine: null as DoublesTrainingEngine | null,

    currentTargetLabel(this: DoublesTrainingPlayContext): string {
      if (!this.engine) return "";
      return targetLabel(
        targetAt(doublesPath(), this.engine.state().targetIndex),
      );
    },

    hitCount(this: DoublesTrainingPlayContext): string {
      if (!this.engine) return "0";
      return String(
        this.engine.state().outcomes.filter((outcome) => outcome.hit).length,
      );
    },

    missCount(this: DoublesTrainingPlayContext): string {
      if (!this.engine) return "0";
      return String(
        this.engine.state().outcomes.filter((outcome) => !outcome.hit)
          .length,
      );
    },

    previewSegments(this: DoublesTrainingPlayContext): DoublesPreviewSegment[] {
      return previewSegmentsFor(this.$store.game.turns, this.hiddenTurnKey);
    },

    async init(this: DoublesTrainingPlayContext) {
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

    async retryReconciliation(this: DoublesTrainingPlayContext) {
      await this.init();
    },

    /** The recreational tap row's entry point: synthesizes the observation
     * for a hit or miss on the current target and funnels it through
     * `commitDart`. */
    async recordTap(this: DoublesTrainingPlayContext, hit: boolean) {
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

    async commitDart(
      this: DoublesTrainingPlayContext,
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

    undoVisit(this: DoublesTrainingPlayContext) {
      if (this.finished) return;
      if (!this.engine || !this.engine.undo()) return;
      this.hiddenTurnKey = null;
      this.$store.game.recordFacts(this.engine.facts());
      this.error = "";
    },

    async uploadAndCompleteSession(
      this: DoublesTrainingPlayContext,
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
        this.resultsSnapshot = {
          hits: finalState.outcomes.filter((outcome) => outcome.hit).length,
          misses: finalState.outcomes.filter((outcome) => !outcome.hit)
            .length,
        };
      }
      this.completionStatus = "succeeded";
    },

    async back(this: DoublesTrainingPlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: DoublesTrainingPlayContext) {
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
     * no overrides — V1 has zero editable settings.
     */
    async playAgain(this: DoublesTrainingPlayContext) {
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
        if (!(engine instanceof DoublesTrainingEngine)) return;
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

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
cd app
git add src/lib/game/doubles-training-play.data.ts tests/lib/game/doubles-training-play.data.test.ts
git commit -m "Add Doubles Training play data module"
```

---

### Task 6: Play page — input row, interface, results modal, route

**Files:**
- Create: `app/src/components/layout/games/DoublesTrainingRecreationalInput.astro`
- Create: `app/src/components/layout/games/interfaces/DoublesTraining.astro`
- Create: `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro`
- Create: `app/src/pages/games/doubles-training/play/index.astro`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`

**Interfaces:**
- Consumes: `doublesTrainingPlay()` (Task 5, registered as an Alpine data factory), `SinglePlayerDisplay`/`VisitPreview`/`StatRow`/`InputButton` (existing shared components), `GameLayout`/`NoSessionPanel`/`ReconciliationBlocked` (existing shared layout/components).
- Produces: the `/games/doubles-training/play` route. No new exports consumed elsewhere.

No test (D101). Correctness verified by the dev-server playthrough in Step 5.

- [ ] **Step 1: Create the recreational input row**

Create `app/src/components/layout/games/DoublesTrainingRecreationalInput.astro`:

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
  />
</div>
```

- [ ] **Step 2: Create the interface component**

Create `app/src/components/layout/games/interfaces/DoublesTraining.astro`:

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
import DoublesTrainingRecreationalInput from "@components/layout/games/DoublesTrainingRecreationalInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
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

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <VisitPreview />

  <DoublesTrainingRecreationalInput />
</div>
```

- [ ] **Step 3: Create the results modal**

Create `app/src/components/layout/games/result-modals/DoublesTrainingResults.astro`:

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

    {/* Stats: shown once the final hit/miss split is known */}
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus === 'succeeded' && resultsSnapshot"
      x-cloak
    >
      <StatRow
        label="Hits"
        value="resultsSnapshot?.hits"
      />
      <StatRow
        label="Misses"
        value="resultsSnapshot?.misses"
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

- [ ] **Step 4: Create the play page route**

Create `app/src/pages/games/doubles-training/play/index.astro`:

```astro
---
export const prerender = true;
import GameLayout from "@layouts/GameLayout.astro";
import DoublesTraining from "@components/layout/games/interfaces/DoublesTraining.astro";
import DoublesTrainingResults from "@components/layout/games/result-modals/DoublesTrainingResults.astro";
import NoSessionPanel from "@components/layout/games/NoSessionPanel.astro";
import ReconciliationBlocked from "@components/layout/games/ReconciliationBlocked.astro";
---

<GameLayout
  title="Doubles Training — Play"
  gameTitle="DOUBLES TRAINING"
>
  <div
    class="flex flex-col flex-1 min-h-0 p-3"
    x-data="doublesTrainingPlay()"
    @confirm-exit.window="abandonAndExit()"
  >
    {/* Loading / reconciliation-blocked */}
    <ReconciliationBlocked />

    {/* No active session view */}
    <NoSessionPanel href="/games/doubles-training/setup" />

    {/* Gameplay view */}
    <DoublesTraining
      x-show="!finished && hasActiveSession"
      x-cloak
    />

    {/* Results modal (overlay) */}
    <DoublesTrainingResults />
  </div>
</GameLayout>
```

- [ ] **Step 5: Register the Alpine factory and verify a full playthrough**

In `app/src/lib/client/alpine/register-route-data.ts` (already touched in Task 4 Step 3), add the import next to `doublesTrainingSetup`'s:

```ts
import { doublesTrainingSetup } from "@lib/game/doubles-training-setup.data";
import { doublesTrainingPlay } from "@lib/game/doubles-training-play.data";
import { gamesIndex } from "@lib/game/games-index.data";
```

And register it inside `registerRouteData`, as the final line before the closing brace:

```ts
  Alpine.data("doublesTrainingSetup", doublesTrainingSetup);
  Alpine.data("doublesTrainingPlay", doublesTrainingPlay);
}
```

Run: `cd app && astro dev --background`. In a browser:
1. Go to `/games`, confirm the "Doubles training" card is visible and links to setup.
2. Start a session; confirm you land on `/games/doubles-training/play` at target `D1`.
3. Tap hit — confirm target advances to `D2`, Hits shows `1`.
4. Tap miss three times on `D2` — confirm target advances to `D3`, Misses shows `1`.
5. Tap Undo — confirm the last miss on `D3`'s visit reverts (or, if at the start of a fresh visit, the prior visit reopens) and the preview updates.
6. Play through to BULL and hit it — confirm the results modal shows "Session complete" with the correct Hits/Misses totals, and "Play again" starts a fresh session at `D1`.

Stop the server with `astro dev stop` when done.

- [ ] **Step 6: Format, full test suite, type-check, and commit**

```bash
cd app
npm run format
npm test
npm run check
git add src/components/layout/games/DoublesTrainingRecreationalInput.astro
git add src/components/layout/games/interfaces/DoublesTraining.astro
git add src/components/layout/games/result-modals/DoublesTrainingResults.astro
git add src/pages/games/doubles-training/play/index.astro
git add -u
git commit -m "Add Doubles Training play page"
```

Expected: `npm test` and `npm run check` both PASS.

---

### Task 7: Final validation and context maintenance

**Files:** none (verification-only task).

- [ ] **Step 1: Run the full validation gate**

Run: `cd app && npm run validate:app`
Expected: PASS (db status/migrate/introspect, `fallow` structural gates, full Vitest suite, `astro check`, graph refresh).

- [ ] **Step 2: Run the context-maintenance skill**

Invoke the `context-maintenance` skill (per root `CLAUDE.md`, mandatory before any task is claimed done). Update `docs/architecture/00-Context-Map.md`'s changelog and any stale context-pack entries to reflect the new Doubles Training frontend files.

- [ ] **Step 3: Final commit (if the context-maintenance skill produced changes)**

```bash
cd app
git status
```

If the skill modified any files, stage and commit them with a message describing the context update, following the skill's own commit convention.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin claude/doubles-training-game-v1-x6u0q3
```
