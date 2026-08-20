# TUOD Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn TUOD from an engine-only ruleset into a playable game by adding its frontend fan-out — setup/play/results pages, Alpine controllers, and shared-registry wiring — with no engine/validator/DB changes.

**Architecture:** Two bespoke Alpine data factories (`tuod-setup.data.ts`, `tuod-play.data.ts`), each hand-written rather than built on a shared factory — `createPresetSetupController` assumes exactly one preset per game and TUOD has two, and `PlayLifecycleContext` is typed to `GameEngine<DartObservation, unknown>` while TUOD's engine takes `TuodAttemptInput`. Both controllers otherwise mirror `score-training-{setup,play}.data.ts`'s D88 reconciliation, `SegmentTimer` wiring, and finish-confirm gate line for line.

**Tech Stack:** Astro, Alpine.js v3, TypeScript, Vitest, Zod (already-shipped `TuodConfig`/`TuodEngine`/`tuodValidator`).

## Global Constraints

- Route slug = code slug = `tuod`.
- `GAME_TYPE_KEY = "TUOD"`, `RULESET_VERSION_KEY: RulesetVersionKey = "TUOD_V1"`.
- Attempt capture is two direct buttons — **Checked out** / **Missed** — no darts-used picker, no double-confirmation modal. `checkedOut` and `finishedOnDouble` are always set together (`{ checkedOut, finishedOnDouble: checkedOut }`).
- No `ScoreInputBuffer`, no `BoardInputPanel`, no `DoubleCheckoutConfirm` — TUOD declares only `RECREATIONAL + QUICK_SCORE` (`RULESET_CAPABILITIES.TUOD_V1 = [QUICK_SCORE]`), never `VISUAL_BOARD`.
- Setup locks every field except session length (ROUNDS vs MINUTES); the chosen preset's `configuration` is sent to `createSession` unmodified (no `overrides`).
- Results modal shows: final ladder target reached, attempts, successes, failures. Nothing else.
- `app/CLAUDE.md` TypeScript comment rule: no `//`/`/* */` comments inside function/method bodies in `app/src/**/*.ts` (JSDoc above the declaration only). Not enforced in `app/tests/`.
- Every `.ts` file lives under `app/src/lib/game/` (imported via `@lib/game/`), never directly under `components/`/`pages/`.
- Format with `cd app && npm run format` before any commit that touches `.astro` files (Prettier + `prettier-plugin-astro`).
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated.

---

## Task 1: `TuodSetupContext` type + `tuod-setup.data.ts`

**Files:**
- Modify: `app/src/lib/game/types.ts` (add `TuodDurationType`, `TuodSetupContext`; add `TuodSnapshot` to the existing `from "./rulesets/types"` import block)
- Create: `app/src/lib/game/tuod-setup.data.ts`
- Test: `app/tests/lib/game/tuod-setup.data.test.ts`

**Interfaces:**
- Consumes: `fetchConfigurationPresets(gameTypeKey: string): Promise<ConfigurationPresetData[]>` (`@client/api/configuration-templates`); `createSession`, `fetchActiveSessions`, `completeSession` (`@client/api/sessions`); `toSnapshot<K>(key: K, wire: unknown): ConfigSnapshotFor<K>` (`@lib/game/rulesets/config-codec`); `reconcileActiveSession` (`@lib/game/session-recovery`); `resolveSessionModePair`, `startSessionInput` (`@lib/game/session-mode-resolution`); `TuodSnapshot` (`@lib/game/rulesets/types`).
- Produces: `export function tuodSetup()` returning a `TuodSetupContext`-shaped object, for Task 5's `register-route-data.ts` wiring and Task 2's `TuodSetupForm.astro` (`x-data="tuodSetup()"`).

- [ ] **Step 1: Add `TuodDurationType` and `TuodSetupContext` to `lib/game/types.ts`**

Add `TuodSnapshot` to the existing multi-line import from `"./rulesets/types"` (around line 23-34):

```typescript
import type {
  ModePair,
  RulesetVersionKey,
  ScoreTrainingSnapshot,
  FiveOhOneSnapshot,
  Bobs27Snapshot,
  SinglesSnapshot,
  DoublesTrainingSnapshot,
  ShanghaiSnapshot,
  OneTwentyOneSnapshot,
  AroundTheClockSnapshot,
  TuodSnapshot,
} from "./rulesets/types";
```

Then, directly below the existing `export type ScoreTrainingDurationType = "ROUNDS" | "MINUTES";` line, add:

```typescript
export type TuodDurationType = "ROUNDS" | "MINUTES";

export type TuodSetupContext = {
  presets: ConfigurationPresetData[];
  durationType: TuodDurationType;
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
  init(this: TuodSetupContext): Promise<void>;
  reconcile(
    this: TuodSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: TuodSetupContext): Promise<void>;
  continueSession(this: TuodSetupContext): void;
  abandonSession(this: TuodSetupContext): Promise<void>;
  presetForMode(
    this: TuodSetupContext,
    type: TuodDurationType,
  ): ConfigurationPresetData | undefined;
  start(this: TuodSetupContext): Promise<void>;
};
```

- [ ] **Step 2: Write the failing test**

Create `app/tests/lib/game/tuod-setup.data.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { tuodSetup } from "@lib/game/tuod-setup.data";
import type { TuodSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const ROUND_PRESET = {
  configurationTemplateId: "tmpl-rounds",
  name: "TUOD — 10 Rounds",
  configuration: {
    starting_target: 41,
    finish_bonus: 10,
    miss_penalty: 1,
    duration_type: "ROUNDS",
    duration_value: 10,
    max_darts_per_turn: 3,
  },
} as any;

const MINUTES_PRESET = {
  configurationTemplateId: "tmpl-minutes",
  name: "TUOD — 10 Minutes",
  configuration: {
    starting_target: 41,
    finish_bonus: 10,
    miss_penalty: 1,
    duration_type: "MINUTES",
    duration_value: 10,
    max_darts_per_turn: 3,
  },
} as any;

describe("tuodSetup", () => {
  let store: TuodSetupContext["$store"];

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
        inputModeKey: "QUICK_SCORE",
      },
    };
  });

  function createSetup(
    overrides: Partial<TuodSetupContext> = {},
  ): TuodSetupContext {
    return {
      ...tuodSetup(),
      $store: store,
      ...overrides,
    } as TuodSetupContext;
  }

  describe("init", () => {
    it("loads both presets and defaults to ROUNDS", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        ROUND_PRESET,
        MINUTES_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      expect(setup.presets).toEqual([ROUND_PRESET, MINUTES_PRESET]);
      expect(setup.durationType).toBe("ROUNDS");
      expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith(
        "TUOD",
      );
    });

    it("sets a visible error and clears loading when the fetch throws", async () => {
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

  describe("reconciliation on init", () => {
    it('shows modal on "match"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "match-id", gameTypeKey: "TUOD" } as any,
      ]);
      store.game.sessionId = "match-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "match-id",
        gameTypeKey: "TUOD",
      });
    });

    it('shows preset picker on "no_active" (mismatch auto-abandoned)', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "TUOD" } as any,
      ]);
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "server-id",
        statusKey: "ABANDONED",
        completedAt: "2026-08-20T10:00:00Z",
      });
      store.game.sessionId = "different-local-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(false);
      expect(setup.reconciliationFailed).toBe(false);
    });

    it('blocks the picker and sets reconciliationFailed on "abandon_failed"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "TUOD" } as any,
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
    it("continues to the play route", () => {
      const setup = createSetup({
        activeSession: { sessionId: "match-id", gameTypeKey: "TUOD" } as any,
      });
      const locationSpy = { href: "/games/tuod/setup" };
      vi.stubGlobal("location", locationSpy);

      setup.continueSession();

      expect(locationSpy.href).toBe("/games/tuod/play");
    });

    it("abandons the active session", async () => {
      const setup = createSetup({
        activeSession: { sessionId: "match-id", gameTypeKey: "TUOD" } as any,
      });
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "match-id",
        statusKey: "ABANDONED",
        completedAt: "2026-08-20T10:00:00Z",
      });

      await setup.abandonSession();

      expect(sessionsApi.completeSession).toHaveBeenCalledWith(
        "match-id",
        "ABANDONED",
      );
      expect(store.game.reset).toHaveBeenCalled();
      expect(setup.showActiveSessionModal).toBe(false);
    });
  });

  describe("presetForMode", () => {
    it("finds the preset matching the requested duration type", () => {
      const setup = createSetup({ presets: [ROUND_PRESET, MINUTES_PRESET] });
      expect(setup.presetForMode("ROUNDS")).toBe(ROUND_PRESET);
      expect(setup.presetForMode("MINUTES")).toBe(MINUTES_PRESET);
    });
  });

  describe("start", () => {
    it("creates a session from the selected preset's template, unmodified", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "MINUTES",
      });
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
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
        config: {
          source: "template",
          templateRef: "tmpl-minutes",
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-minutes",
          configSnapshot: expect.objectContaining({
            startingTarget: 41,
            finishBonus: 10,
            missPenalty: 1,
            durationType: "MINUTES",
            durationValue: 10,
            maxDartsPerTurn: 3,
          }),
        }),
      );
      expect(locationSpy.href).toBe("/games/tuod/play");
    });

    it("errors when no preset matches the selected mode", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET],
        durationType: "MINUTES",
      });

      await setup.start();

      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(setup.error).toBe("Could not find a preset for this mode.");
    });

    it("ignores a second start call while the first is in flight", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        loading: true,
      });

      await setup.start();

      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(store.game.startSession).not.toHaveBeenCalled();
    });

    it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
      });
      vi.mocked(sessionsApi.createSession).mockRejectedValue(
        Object.assign(new Error("already active"), {
          code: "SESSION_ALREADY_ACTIVE",
        }),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "active-1", gameTypeKey: "TUOD" } as any,
      ]);
      store.game.sessionId = "active-1";

      await setup.start();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toMatchObject({ sessionId: "active-1" });
      expect(setup.loading).toBe(false);
    });

    it("sends the player's chosen supported pair from settings", async () => {
      store.settings = {
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      };
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
      });
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

      // TUOD_V1 only declares QUICK_SCORE, so resolveSessionModePair falls
      // back to it even though settings holds an ANALYTICS pair.
      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          captureModeKey: "RECREATIONAL",
          inputModeKey: "QUICK_SCORE",
        }),
      );
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/tuod-setup.data.test.ts`
Expected: FAIL — `Cannot find module '@lib/game/tuod-setup.data'`

- [ ] **Step 4: Write `tuod-setup.data.ts`**

Create `app/src/lib/game/tuod-setup.data.ts`:

```typescript
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
import type { TuodDurationType, TuodSetupContext } from "./types";

const GAME_TYPE_KEY = "TUOD";
const RULESET_VERSION_KEY = "TUOD_V1";

export function tuodSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    durationType: "ROUNDS" as TuodDurationType,
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: TuodSetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);

        this.presets = presets;
        this.durationType = "ROUNDS";

        await this.reconcile(activeSessions);
      } catch {
        this.showActiveSessionModal = false;
        this.error =
          "Could not load setup. Check your connection and try again.";
      } finally {
        this.loadingReconciliation = false;
      }
    },

    presetForMode(this: TuodSetupContext, type: TuodDurationType) {
      return this.presets.find((p) => {
        const cfg = p.configuration as { duration_type?: string } | null;
        return cfg?.duration_type === type;
      });
    },

    async reconcile(
      this: TuodSetupContext,
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

    async retryReconciliation(this: TuodSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: TuodSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/tuod/play";
    },

    async abandonSession(this: TuodSetupContext) {
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

    async start(this: TuodSetupContext) {
      if (this.loading) return;
      const preset = this.presetForMode(this.durationType);
      if (!preset) {
        this.error = "Could not find a preset for this mode.";
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
        globalThis.location.href = "/games/tuod/play";
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

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/tuod-setup.data.test.ts`
Expected: PASS (all cases)

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/tuod-setup.data.ts app/tests/lib/game/tuod-setup.data.test.ts
git commit -m "feat(tuod): add setup controller"
```

---

## Task 2: `TuodSetupForm.astro` + setup page

**Files:**
- Create: `app/src/components/layout/games/setup/TuodSetupForm.astro`
- Create: `app/src/pages/games/tuod/setup/index.astro`

**Interfaces:**
- Consumes: `tuodSetup()` from Task 1 (`x-data="tuodSetup()"`, exposing `presets`, `durationType`, `error`, `loading`, `loadingReconciliation`, `showActiveSessionModal`, `reconciliationFailed`, `activeSession`, `retryReconciliation()`, `start()`); shared components `SetupShell`, `UserSection`, `InfoSection`, `Toggle` (`components/layout/games/setup/`), `ContinueSessionModal`, `Button` (`components/forms/Button.astro`).
- Produces: route `/games/tuod/setup` for Task 5's `games-visibility.ts` `href`.

No unit test for this step — `.astro` markup keeps its branching logic inline and is not covered by a component test runner (D101, `app/CLAUDE.md`). Verified manually in Task 6.

- [ ] **Step 1: Write `TuodSetupForm.astro`**

Create `app/src/components/layout/games/setup/TuodSetupForm.astro`:

```astro
---
// Components
import Toggle from "./Toggle.astro";
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import SettingSectionShell from "./SettingSectionShell.astro";
import UserSection from "./UserSection.astro";

// Data
const durationOpts = [
  { value: "ROUNDS", label: "10 Rounds" },
  { value: "MINUTES", label: "10 Minutes" },
];

const infoSection = {
  title: "Ten Up One Down rules",
  description:
    "Start at 41. One visit (3 darts) to check out on a double. Check out and the next target climbs +10; miss and it drops -1, floored at 2 — the lowest target any double can finish.",
};
---

<SetupShell title="Ten Up One Down">
  <UserSection />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
  <SettingSectionShell>
    <Toggle
      orientation="horizontal"
      options={durationOpts}
      x-model="durationType"
      class="w-full"
    />
  </SettingSectionShell>

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

- [ ] **Step 2: Write the setup page**

Create `app/src/pages/games/tuod/setup/index.astro`:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import Button from "@components/forms/Button.astro";
import ContinueSessionModal from "@components/layout/games/ContinueSessionModal.astro";
import TuodSetupForm from "@components/layout/games/setup/TuodSetupForm.astro";
---

<AppLayout title="Ten Up One Down — Setup">
  <div
    class="p-4"
    x-data="tuodSetup()"
  >
    <template x-if="showActiveSessionModal && activeSession">
      <ContinueSessionModal gameTitle="Ten Up One Down" />
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

    <template x-if="!showActiveSessionModal && !reconciliationFailed">
      <TuodSetupForm />
    </template>
  </div>
</AppLayout>
```

- [ ] **Step 3: Format**

Run: `cd app && npm run format`
Expected: reformats the two new `.astro` files if needed (Prettier + `prettier-plugin-astro`), no other diffs.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/layout/games/setup/TuodSetupForm.astro app/src/pages/games/tuod/setup/index.astro
git commit -m "feat(tuod): add setup page"
```

---

## Task 3: `TuodPlayContext` type + `tuod-play.data.ts`

**Files:**
- Modify: `app/src/lib/game/types.ts` (add `TuodPlayContext`; add `TuodEngine` value-type import)
- Create: `app/src/lib/game/tuod-play.data.ts`
- Test: `app/tests/lib/game/tuod-play.data.test.ts`

**Interfaces:**
- Consumes: `TuodEngine`, `tuodEngineFactory`, `applyTuodAttempt`, `initialTuodState` (`@modules/game/tuod.engine.module`, all already shipped in D153); `getEngineFactory` (`@modules/game/engine.registry`); `buildEventsBatch` (`@modules/game/events.payload.module`); `SegmentTimer` (`@modules/ui/segment-timer.module`); `appendBatch`, `completeSession`, `createSession`, `fetchActiveSessions` (`@client/api/sessions`); `reconcileActiveSession` (`@lib/game/session-recovery`); `resolveSessionModePair` (`@lib/game/session-mode-resolution`); `TuodAttemptInput`, `TuodState`, `EngineFacts`, `TurnFact` (`@modules/types`); `PlayStoreContext<TuodSnapshot>` (`./types`, already generic — no change needed).
- Produces: `export function tuodPlay()` returning a `TuodPlayContext`-shaped object, for Task 4's interface/results `.astro` files and Task 5's `register-route-data.ts`.

- [ ] **Step 1: Add `TuodPlayContext` to `lib/game/types.ts`**

Add the `TuodEngine` value... no — this one is a **type-only** import (the value-import side-effect trick is only needed in the `.data.ts` file that builds engines, not in `types.ts`, which never constructs one). Add below the existing `import type { ScoreTrainingEngine } from ...` line (around line 4):

```typescript
import type { TuodEngine } from "@modules/game/tuod.engine.module";
```

Then add `TuodAttemptInput` to the existing `@modules/types` import block (around lines 12-19):

```typescript
import type {
  BoardCoordinate,
  DartObservation,
  EngineFacts,
  MagnifierPlacement,
  StageFact,
  TurnFact,
  TuodAttemptInput,
} from "@modules/types";
```

Then, directly below `ScoreTrainingPlayContext` (after its closing `};`), add:

```typescript
export type TuodResultsSnapshot = {
  target: number;
  attempts: number;
  successes: number;
  failures: number;
};

export type TuodPlayContext = {
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
  resultsSnapshot: TuodResultsSnapshot | null;
  pendingAttempt: boolean | null;
  showFinishConfirm: boolean;
  $store: PlayStoreContext<TuodSnapshot>;
  engine: TuodEngine | null;
  timer: SegmentTimer | null;
  currentTargetLabel(this: TuodPlayContext): string;
  remainingLabel(this: TuodPlayContext): string;
  init(this: TuodPlayContext): Promise<void>;
  retryReconciliation(this: TuodPlayContext): Promise<void>;
  recordAttempt(this: TuodPlayContext, checkedOut: boolean): Promise<void>;
  confirmFinish(this: TuodPlayContext): Promise<void>;
  cancelFinish(this: TuodPlayContext): void;
  undoAttempt(this: TuodPlayContext): void;
  uploadAndCompleteSession(this: TuodPlayContext): Promise<void>;
  back(this: TuodPlayContext): Promise<void>;
  playAgain(this: TuodPlayContext): Promise<void>;
  abandonAndExit(this: TuodPlayContext): Promise<void>;
  destroy(this: TuodPlayContext): void;
};
```

(`loading` carries no consumer in `tuod-play.data.ts` — `recordAttempt`/`confirmFinish` are synchronous engine calls with no in-flight state to guard — but stays in the type for parity with every other `*PlayContext` and because `SetupShell`'s submit-disable convention (`app/CLAUDE.md`) reads a sibling `loading` field by default. It is simply never set to `true` here.)

- [ ] **Step 2: Write the failing test**

Create `app/tests/lib/game/tuod-play.data.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@client/api/sessions", () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
  createSession: vi.fn(),
}));

const segmentTimerInstances: Array<{
  options: Record<string, unknown>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("@modules/ui/segment-timer.module", () => ({
  SegmentTimer: vi.fn().mockImplementation(function (
    options: Record<string, unknown>,
  ) {
    const instance = { options, start: vi.fn(), stop: vi.fn() };
    segmentTimerInstances.push(instance);
    return instance;
  }),
}));

import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import {
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import { tuodEngineFactory } from "@modules/game/tuod.engine.module";
import type { GameEngine, GameEngineFactory } from "@modules/interfaces";
import { tuodPlay } from "@lib/game/tuod-play.data";
import type { TuodPlayContext, TuodSnapshot } from "@lib/types";
import type { EngineFacts, StageFact, TurnFact } from "@modules/types";

const BLOCK: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function turnFact(
  clientKey: string,
  sequence: number,
  totalScore: number,
): TurnFact {
  return {
    clientKey,
    stageClientKey: BLOCK.clientKey,
    sequence,
    completedAt: "2026-08-20T10:00:00.000Z",
    totalScore,
    darts: [],
  };
}

function rounds(durationValue: number): TuodSnapshot {
  return {
    startingTarget: 41,
    finishBonus: 10,
    missPenalty: 1,
    durationType: "ROUNDS",
    durationValue,
    maxDartsPerTurn: 3,
  };
}

function minutes(durationValue: number): TuodSnapshot {
  return {
    startingTarget: 41,
    finishBonus: 10,
    missPenalty: 1,
    durationType: "MINUTES",
    durationValue,
    maxDartsPerTurn: 3,
  };
}

type GameStub = TuodPlayContext["$store"]["game"];
type SettingsStub = TuodPlayContext["$store"]["settings"];

function settingsStub(overrides: Partial<SettingsStub> = {}): SettingsStub {
  return {
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    ...overrides,
  };
}

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    rulesetVersionKey: "TUOD_V1",
    sessionId: "s1",
    participantRef: "p1",
    templateRef: "tpl-1",
    configSnapshot: rounds(3),
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    stages: [BLOCK],
    turns: [],
    timerRemainingMs: null,
    timerStartedAt: null,
    timerExpired: false,
    idempotencyKey: null,
    loading: false,
    setSessionModes: vi.fn(function (
      this: GameStub,
      modes: { captureModeKey: string; inputModeKey: string },
    ) {
      this.captureModeKey = modes.captureModeKey;
      this.inputModeKey = modes.inputModeKey;
    }),
    recordFacts: vi.fn(function (this: GameStub, facts: EngineFacts) {
      this.stages = [...facts.stages];
      this.turns = [...facts.turns];
    }),
    reset: vi.fn(function (this: GameStub) {
      this.loading = false;
    }),
    ...overrides,
  };
}

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "TUOD",
  gameTypeName: "Ten Up One Down",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
  rulesetVersionKey: "TUOD_V1",
  startedAt: "now",
} as const;

describe("tuodPlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    segmentTimerInstances.length = 0;
    vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
  });

  it("records a checked-out attempt: the turn total is the target it was thrown at", async () => {
    const store = gameStub();
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);
    await component.recordAttempt.call(component, true);

    expect(store.turns).toHaveLength(1);
    expect(store.turns[0].totalScore).toBe(41);
  });

  it("records a missed attempt as a zero-scoring turn", async () => {
    const store = gameStub();
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);
    await component.recordAttempt.call(component, false);

    expect(store.turns).toHaveLength(1);
    expect(store.turns[0].totalScore).toBe(0);
  });

  it("climbs the ladder +10 on success and reads it back from currentTargetLabel", async () => {
    const store = gameStub({ configSnapshot: rounds(5) });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);
    expect(component.currentTargetLabel.call(component)).toBe("41");

    await component.recordAttempt.call(component, true);

    expect(component.currentTargetLabel.call(component)).toBe("51");
  });

  it("uploads the batch and completes the session on the final attempt", async () => {
    const store = gameStub({ configSnapshot: rounds(2) });
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);
    await component.recordAttempt.call(component, true); // attempt 1
    await component.recordAttempt.call(component, false); // would complete

    expect(component.showFinishConfirm).toBe(true);
    expect(appendBatch).not.toHaveBeenCalled();

    await component.confirmFinish.call(component);

    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(component.finished).toBe(true);
    expect(component.completionStatus).toBe("succeeded");
    expect(store.turns).toHaveLength(2);
  });

  describe("finish confirm gate", () => {
    it("stashes the pending attempt and does not commit or upload", async () => {
      const store = gameStub({ configSnapshot: rounds(1) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      await component.recordAttempt.call(component, true);

      expect(store.turns).toHaveLength(0);
      expect(component.showFinishConfirm).toBe(true);
      expect(component.pendingAttempt).toBe(true);
      expect(component.finished).toBe(false);
      expect(appendBatch).not.toHaveBeenCalled();
    });

    it("cancelFinish discards the pending attempt without committing", async () => {
      const store = gameStub({ configSnapshot: rounds(1) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      await component.recordAttempt.call(component, true);

      component.cancelFinish();

      expect(component.showFinishConfirm).toBe(false);
      expect(component.pendingAttempt).toBeNull();
      expect(store.turns).toHaveLength(0);
      expect(component.finished).toBe(false);
    });

    it("confirmFinish commits the pending attempt, sets finished, and uploads", async () => {
      const store = gameStub({ configSnapshot: rounds(1) });
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      await component.recordAttempt.call(component, true);

      await component.confirmFinish.call(component);

      expect(store.turns).toHaveLength(1);
      expect(store.turns[0].totalScore).toBe(41);
      expect(component.showFinishConfirm).toBe(false);
      expect(component.pendingAttempt).toBeNull();
      expect(component.finished).toBe(true);
      expect(appendBatch).toHaveBeenCalledTimes(1);
    });
  });

  describe("reconciliation on init", () => {
    it('resumes silently on "match" — no modal, hasActiveSession = true', async () => {
      const store = gameStub({
        sessionId: "match-id",
        configSnapshot: rounds(20),
      });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { ...ACTIVE_SESSION, sessionId: "match-id" },
      ]);
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(component.hasActiveSession).toBe(true);
      expect(store.reset).not.toHaveBeenCalled();
    });

    it('shows no-active-session view on "no_active" (mismatch auto-abandoned)', async () => {
      const store = gameStub({ sessionId: "different-id" });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { ...ACTIVE_SESSION, sessionId: "server-id" },
      ]);
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "server-id",
        statusKey: "ABANDONED",
        completedAt: "now",
      });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(completeSession).toHaveBeenCalledWith("server-id", "ABANDONED");
      expect(store.reset).toHaveBeenCalled();
      expect(component.hasActiveSession).toBe(false);
    });

    it("preserves turns array on resume (no clear)", async () => {
      const store = gameStub({
        sessionId: "match-id",
        configSnapshot: rounds(20),
        turns: [turnFact("t1", 1, 41)],
      });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { ...ACTIVE_SESSION, sessionId: "match-id" },
      ]);
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(store.turns).toHaveLength(1);
      expect(store.turns[0].clientKey).toBe("t1");
    });

    it("leaves the session unplayable when no engine is registered for the persisted ruleset", async () => {
      const store = gameStub({ rulesetVersionKey: "BOBS27_V1" });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(component.engine).toBeNull();
      expect(component.hasActiveSession).toBe(false);
    });
  });

  describe("cross-game engine guard", () => {
    afterEach(() => {
      resetEngineRegistry();
      registerEngineFactory(tuodEngineFactory);
    });

    it("refuses to build an engine for a ruleset this page does not own", async () => {
      const foreignEngine: GameEngine<unknown, unknown> = {
        rulesetVersionKey: "BOBS27_V1",
        record: () => ({}),
        undo: () => false,
        wouldComplete: () => false,
        isComplete: () => false,
        state: () => ({}),
        facts: () => ({ stages: [], turns: [] }),
      };
      const foreignCreate = vi.fn(() => foreignEngine);
      const foreignFactory: GameEngineFactory<unknown, unknown, unknown> = {
        rulesetVersionKey: "BOBS27_V1",
        create: foreignCreate,
      };
      registerEngineFactory(foreignFactory);

      const store = gameStub({ rulesetVersionKey: "BOBS27_V1" });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(foreignCreate).not.toHaveBeenCalled();
      expect(component.engine).toBeNull();
    });
  });

  describe("MINUTES duration mode timer wiring", () => {
    it("instantiates and starts a SegmentTimer whose onComplete sets store.timerExpired and expires the engine", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(SegmentTimer).toHaveBeenCalledTimes(1);
      const instance = segmentTimerInstances[0];
      expect(instance.options.totalMinutes).toBe(15);
      expect(instance.start).toHaveBeenCalledTimes(1);

      expect(store.timerExpired).toBe(false);
      (instance.options.onComplete as () => void)();
      expect(store.timerExpired).toBe(true);
    });

    it("lets the current attempt finish after the timer expires, then completes on the next", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 2, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      (segmentTimerInstances[0].options.onComplete as () => void)();

      await component.recordAttempt.call(component, true);

      expect(component.showFinishConfirm).toBe(true);

      await component.confirmFinish.call(component);

      expect(store.turns).toHaveLength(1);
      expect(component.finished).toBe(true);
    });

    it("does not instantiate a SegmentTimer in ROUNDS mode", async () => {
      const store = gameStub();
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      expect(SegmentTimer).not.toHaveBeenCalled();
    });

    it("destroy() stops the timer", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      const instance = segmentTimerInstances[0];
      component.destroy.call(component);
      expect(instance.stop).toHaveBeenCalledTimes(1);
    });

    it("destroy() does not throw when no timer was ever started (ROUNDS mode)", async () => {
      const store = gameStub();
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      expect(() => component.destroy.call(component)).not.toThrow();
    });
  });

  describe("undoAttempt", () => {
    it("pops the engine log and mirrors it into the store", async () => {
      const store = gameStub({ configSnapshot: rounds(20) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      await component.recordAttempt.call(component, true);
      expect(store.turns).toHaveLength(1);

      component.undoAttempt();

      expect(store.turns).toHaveLength(0);
      expect(component.error).toBe("");
    });

    it("is a no-op when there are no turns", async () => {
      const store = gameStub({ configSnapshot: rounds(20) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      const recordCallsAfterInit = vi.mocked(store.recordFacts).mock.calls
        .length;

      component.undoAttempt();

      expect(vi.mocked(store.recordFacts).mock.calls.length).toBe(
        recordCallsAfterInit,
      );
    });

    it("is a no-op while finish confirm is open", async () => {
      const store = gameStub({ configSnapshot: rounds(1) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      await component.recordAttempt.call(component, true);
      expect(component.showFinishConfirm).toBe(true);

      component.undoAttempt();

      expect(store.turns).toHaveLength(0);
    });
  });

  describe("Completion sequence", () => {
    function makePlay(gameOverrides: Partial<GameStub> = {}): TuodPlayContext {
      return {
        ...tuodPlay(),
        $store: {
          game: gameStub({
            sessionId: "session-1",
            participantRef: "participant-1",
            configSnapshot: rounds(20),
            turns: [turnFact("t1", 1, 41)],
            ...gameOverrides,
          }),
          settings: settingsStub(),
        },
      };
    }

    it("copies target/attempts/successes/failures into resultsSnapshot on success", async () => {
      const play = makePlay();

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot).toEqual({
        target: 51,
        attempts: 1,
        successes: 1,
        failures: 0,
      });
    });

    it("folds a mixed attempt log into the correct final target", async () => {
      const play = makePlay({
        turns: [
          turnFact("t1", 1, 41), // success: 41 -> 51
          turnFact("t2", 2, 0), // failure: 51 -> 50
          turnFact("t3", 3, 50), // success: 50 -> 60
        ],
      });
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 3, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot).toEqual({
        target: 60,
        attempts: 3,
        successes: 2,
        failures: 1,
      });
    });

    it('sets completionStatus = "failed" and keeps buttons disabled on error', async () => {
      const play = makePlay();
      vi.mocked(appendBatch).mockRejectedValue(new Error("Network error"));

      await play.uploadAndCompleteSession();

      expect(play.completionError).toContain("connection");
      expect(play.completionStatus).toBe("failed");
    });

    it("treats SESSION_ALREADY_COMPLETED as success on the completion path", async () => {
      const play = makePlay();
      const error = new Error("SESSION_ALREADY_COMPLETED");
      (error as { code?: string }).code = "SESSION_ALREADY_COMPLETED";
      vi.mocked(completeSession).mockRejectedValue(error);
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 0 },
      });

      await play.uploadAndCompleteSession();

      expect(play.completionError).toBe("");
      expect(play.completionStatus).toBe("succeeded");
    });

    it("mints idempotencyKey once and reuses on retry", async () => {
      const play = makePlay();
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });

      await play.uploadAndCompleteSession();
      const firstKey = play.$store.game.idempotencyKey;
      expect(firstKey).toBeTruthy();

      vi.mocked(appendBatch).mockClear();
      await play.uploadAndCompleteSession();
      expect(play.$store.game.idempotencyKey).toBe(firstKey);
    });

    it("ST4: playAgain reuses the original template, no overrides", async () => {
      const play = makePlay({
        idempotencyKey: "old-key",
        timerRemainingMs: 1000,
        timerExpired: true,
      });
      play.completionStatus = "succeeded";
      play.finished = true;
      play.resultsSnapshot = {
        target: 51,
        attempts: 1,
        successes: 1,
        failures: 0,
      };
      const priorConfig = play.$store.game.configSnapshot;

      vi.mocked(createSession).mockResolvedValue({
        sessionId: "new-session",
        participants: [
          {
            ref: "new-participant",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      } as Awaited<ReturnType<typeof createSession>>);

      await play.playAgain();

      expect(createSession).toHaveBeenCalledWith({
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
        config: {
          source: "template",
          templateRef: "tpl-1",
        },
      });
      expect(play.$store.game.sessionId).toBe("new-session");
      expect(play.$store.game.turns).toEqual([]);
      expect(play.$store.game.idempotencyKey).toBeNull();
      expect(play.$store.game.timerExpired).toBe(false);
      expect(play.$store.game.configSnapshot).toBe(priorConfig);
      expect(play.finished).toBe(false);
      expect(play.completionStatus).toBe("pending");
      expect(play.resultsSnapshot).toBeNull();
      expect(play.hasActiveSession).toBe(true);
    });

    it("playAgain failure sets playAgainError only, leaves completionStatus untouched", async () => {
      const play = makePlay();
      play.completionStatus = "succeeded";
      vi.mocked(createSession).mockRejectedValue(new Error("Network error"));

      await play.playAgain();

      expect(play.playAgainError).toBeTruthy();
      expect(play.completionStatus).toBe("succeeded");
      expect(play.$store.game.turns.length).toBe(1);
    });

    it("playAgain double-fire while in flight only creates one session", async () => {
      const play = makePlay();
      play.completionStatus = "succeeded";
      play.finished = true;

      let resolveCreate!: (
        value: Awaited<ReturnType<typeof createSession>>,
      ) => void;
      vi.mocked(createSession).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          }),
      );

      const first = play.playAgain();
      const second = play.playAgain();
      expect(play.playAgainLoading).toBe(true);
      expect(createSession).toHaveBeenCalledTimes(1);

      resolveCreate({
        sessionId: "new-session",
        participants: [
          {
            ref: "new-participant",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      } as Awaited<ReturnType<typeof createSession>>);
      await Promise.all([first, second]);

      expect(createSession).toHaveBeenCalledTimes(1);
      expect(play.playAgainLoading).toBe(false);
    });
  });

  describe("abandonAndExit", () => {
    function makeAbandonPlay(gameOverrides: Partial<GameStub> = {}) {
      return {
        ...tuodPlay(),
        $store: { game: gameStub(gameOverrides), settings: settingsStub() },
      };
    }

    it("with turns: appendBatch then completeSession ABANDONED, reset, navigate /games", async () => {
      const locationSpy = { href: "" };
      vi.stubGlobal("location", locationSpy);
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "ABANDONED",
        completedAt: "now",
      });
      const play = makeAbandonPlay({ turns: [turnFact("t1", 1, 41)] });

      await play.abandonAndExit.call(play);

      expect(appendBatch).toHaveBeenCalledTimes(1);
      expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
      expect(play.$store.game.reset).toHaveBeenCalled();
      expect(locationSpy.href).toBe("/games");
    });

    it("with zero turns: skips batch, PATCHes ABANDONED, reset, navigate", async () => {
      const locationSpy = { href: "" };
      vi.stubGlobal("location", locationSpy);
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "ABANDONED",
        completedAt: "now",
      });
      const play = makeAbandonPlay({ turns: [] });

      await play.abandonAndExit.call(play);

      expect(appendBatch).not.toHaveBeenCalled();
      expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
      expect(locationSpy.href).toBe("/games");
    });

    it("with no sessionId: reset and navigate without API calls", async () => {
      const locationSpy = { href: "" };
      vi.stubGlobal("location", locationSpy);
      const play = makeAbandonPlay({ sessionId: null });

      await play.abandonAndExit.call(play);

      expect(appendBatch).not.toHaveBeenCalled();
      expect(completeSession).not.toHaveBeenCalled();
      expect(play.$store.game.reset).toHaveBeenCalled();
      expect(locationSpy.href).toBe("/games");
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`
Expected: FAIL — `Cannot find module '@lib/game/tuod-play.data'`

- [ ] **Step 4: Write `tuod-play.data.ts`**

Create `app/src/lib/game/tuod-play.data.ts`:

```typescript
import { getEngineFactory } from "@modules/game/engine.registry";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { resolveSessionModePair } from "@lib/game/session-mode-resolution";
import type { RulesetVersionKey } from "@lib/types";
import type { EngineFacts, TuodAttemptInput, TurnFact } from "@modules/types";
import type { TuodPlayContext, TuodResultsSnapshot } from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// tuodEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import {
  TuodEngine,
  applyTuodAttempt,
  initialTuodState,
} from "@modules/game/tuod.engine.module";

const GAME_TYPE_KEY = "TUOD";
const RULESET_VERSION_KEY: RulesetVersionKey = "TUOD_V1";

function formatRemaining(ms: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the ladder exactly. Mirrors
 * `score-training-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: TuodPlayContext["$store"]["game"],
): TuodEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof TuodEngine ? engine : null;
}

/**
 * The engine owns the fact log while a session is live; the store mirrors it.
 * Upload paths that can run without a live engine (a completion retry driven
 * straight from the results modal) fall back to the persisted mirror.
 */
function currentFacts(context: TuodPlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

/**
 * Folds the fact log into the ladder's final resting state using the same
 * pure reducer the engine replays with — never re-derives the ladder math
 * separately.
 */
function computeStats(
  turns: readonly TurnFact[],
  config: TuodPlayContext["$store"]["game"]["configSnapshot"],
): TuodResultsSnapshot {
  const state = turns.reduce(
    (s, turn) => applyTuodAttempt(config!, s, turn.totalScore > 0),
    initialTuodState(config!),
  );
  return {
    target: state.currentTarget,
    attempts: state.attempts,
    successes: state.successes,
    failures: state.failures,
  };
}

/**
 * Starts the MINUTES countdown, resuming from the persisted remaining time
 * when a prior session left one and starting a fresh segment otherwise.
 * Mirrors `score-training-play.data.ts`'s `startCountdown`.
 */
function startCountdown(
  game: TuodPlayContext["$store"]["game"],
  durationValue: number,
  engine: TuodEngine,
): SegmentTimer {
  const resumedRemainingMs = game.timerRemainingMs;
  const durationMinutes =
    resumedRemainingMs != null ? resumedRemainingMs / 60000 : durationValue;

  game.timerRemainingMs = durationMinutes * 60000;
  if (resumedRemainingMs == null) {
    game.timerStartedAt = new Date().toISOString();
  }

  const timer = new SegmentTimer({
    totalMinutes: durationMinutes,
    intervalMinutes: durationMinutes,
    onTick: (secondsRemaining) => {
      game.timerRemainingMs = secondsRemaining * 1000;
    },
    onComplete: () => {
      game.timerExpired = true;
      engine.expireTimer();
    },
  });
  timer.start();
  return timer;
}

export function tuodPlay() {
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
    resultsSnapshot: null as TuodResultsSnapshot | null,
    pendingAttempt: null as boolean | null,
    showFinishConfirm: false,
    engine: null as TuodEngine | null,
    timer: null as SegmentTimer | null,

    currentTargetLabel(this: TuodPlayContext): string {
      return String(this.engine?.state().currentTarget ?? "");
    },

    remainingLabel(this: TuodPlayContext): string {
      return formatRemaining(this.$store.game.timerRemainingMs);
    },

    /**
     * D88 auto-cleanup via shared reconcileActiveSession helper. On "match",
     * resume silently: the engine is rebuilt from the persisted facts and the
     * store is written back from `engine.facts()` immediately.
     */
    async init(this: TuodPlayContext) {
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

        if (config.durationType === "MINUTES") {
          if (this.$store.game.timerExpired) {
            engine.expireTimer();
          } else {
            this.timer = startCountdown(
              this.$store.game,
              config.durationValue,
              engine,
            );
          }
        }

        this.hasActiveSession = true;
      } catch {
        this.reconciliationFailed = true;
        this.hasActiveSession = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async retryReconciliation(this: TuodPlayContext) {
      await this.init();
    },

    destroy(this: TuodPlayContext) {
      this.timer?.stop();
    },

    /**
     * Records one attempt directly — there is no typed score to confirm, so
     * the only gate is `wouldComplete`, which defers a session-ending attempt
     * to the finish confirm exactly as every other quick-score game does.
     */
    async recordAttempt(
      this: TuodPlayContext,
      checkedOut: boolean,
    ): Promise<void> {
      if (!this.engine || this.finished || this.showFinishConfirm) return;
      const input: TuodAttemptInput = {
        checkedOut,
        finishedOnDouble: checkedOut,
      };

      if (this.engine.wouldComplete(input)) {
        this.error = "";
        this.pendingAttempt = checkedOut;
        this.showFinishConfirm = true;
        return;
      }

      try {
        this.engine.record(input);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        return;
      }

      this.error = "";
      this.$store.game.recordFacts(this.engine.facts());
    },

    async confirmFinish(this: TuodPlayContext): Promise<void> {
      if (!this.engine || this.finished || !this.showFinishConfirm) return;
      if (this.pendingAttempt === null) return;

      const input: TuodAttemptInput = {
        checkedOut: this.pendingAttempt,
        finishedOnDouble: this.pendingAttempt,
      };
      this.pendingAttempt = null;
      this.showFinishConfirm = false;

      this.engine.record(input);
      this.$store.game.recordFacts(this.engine.facts());

      this.finished = true;
      this.completionStatus = "pending";
      await this.uploadAndCompleteSession();
    },

    cancelFinish(this: TuodPlayContext) {
      if (!this.showFinishConfirm) return;
      this.pendingAttempt = null;
      this.showFinishConfirm = false;
    },

    undoAttempt(this: TuodPlayContext) {
      if (this.finished || this.showFinishConfirm) return;
      if (!this.engine || !this.engine.undo()) return;

      this.$store.game.recordFacts(this.engine.facts());
      this.error = "";
    },

    async uploadAndCompleteSession(this: TuodPlayContext): Promise<void> {
      const sessionId = this.$store.game.sessionId!;

      if (!this.$store.game.idempotencyKey) {
        this.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const idempotencyKey = this.$store.game.idempotencyKey;

      this.completionStatus = "saving";
      this.completionError = "";

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

      this.resultsSnapshot = computeStats(
        this.$store.game.turns,
        this.$store.game.configSnapshot,
      );
      this.completionStatus = "succeeded";
    },

    async back(this: TuodPlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: TuodPlayContext) {
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
        this.timer?.stop();
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.$store.game.loading = false;
      }
    },

    /**
     * Replays the same configuration template the first session used — V1
     * has nothing to override, unlike Score Training's `duration_value`.
     */
    async playAgain(this: TuodPlayContext) {
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
            config: {
              source: "template",
              templateRef,
            },
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        this.$store.game.sessionId = session.sessionId;
        this.$store.game.participantRef = session.participants[0].ref;
        this.$store.game.idempotencyKey = null;
        this.$store.game.setSessionModes(modePair);
        this.$store.game.timerRemainingMs = null;
        this.$store.game.timerStartedAt = null;
        this.$store.game.timerExpired = false;

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.pendingAttempt = null;
        this.showFinishConfirm = false;
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(config);
        if (!(engine instanceof TuodEngine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());

        if (config.durationType === "MINUTES") {
          this.timer?.stop();
          this.timer = startCountdown(
            this.$store.game,
            config.durationValue,
            engine,
          );
        }
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`
Expected: PASS (all cases)

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/tuod-play.data.ts app/tests/lib/game/tuod-play.data.test.ts
git commit -m "feat(tuod): add play controller"
```

---

## Task 4: Play interface, results modal, play page

**Files:**
- Create: `app/src/components/layout/games/interfaces/TenUpOneDown.astro`
- Create: `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro`
- Create: `app/src/pages/games/tuod/play/index.astro`

**Interfaces:**
- Consumes: `tuodPlay()` from Task 3, exposing `finished`, `hasActiveSession`, `error`, `showFinishConfirm`, `currentTargetLabel()`, `remainingLabel()`, `recordAttempt(checkedOut)`, `undoAttempt()`, `cancelFinish()`, `confirmFinish()`, `completionStatus`, `completionError`, `playAgainError`, `resultsSnapshot`, `back()`, `playAgain()`, `abandonAndExit()`. Shared components `SinglePlayerDisplay`, `StatRow` (`components/layout/games/`), `ConfirmDialog`, `IsLoading` (`components/ui/`), `Button` (`components/forms/`), `GameLayout` (`layouts/`), `ReconciliationBlocked`, `NoSessionPanel`.
- Produces: route `/games/tuod/play` for Task 5's `games-visibility.ts` `href` and Task 1/3's `continueSession()`/`playHref` navigation targets.

No unit test for this step — `.astro` markup is not covered by a component test runner (D101). Verified manually in Task 6.

- [ ] **Step 1: Write `TenUpOneDown.astro`**

Create `app/src/components/layout/games/interfaces/TenUpOneDown.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

const { ...props }: Props = Astro.props;

import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import Button from "@components/forms/Button.astro";
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

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <div class="flex gap-3 px-3">
    <Button
      variant="primary"
      class="flex-1"
      title="Checked out"
      @click="recordAttempt(true)"
      :disabled="showFinishConfirm || finished"
    />
    <Button
      variant="secondary"
      class="flex-1"
      title="Missed"
      @click="recordAttempt(false)"
      :disabled="showFinishConfirm || finished"
    />
  </div>
  <Button
    variant="ghost"
    class="mx-3"
    title="Undo"
    @click="undoAttempt()"
    :disabled="!$store.game.turns.length || showFinishConfirm || finished"
  />
</div>
```

- [ ] **Step 2: Write `TenUpOneDownResults.astro`**

Create `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro`:

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
      Game Summary
    </h2>

    {/* Stats: live from store while saving, snapshot once succeeded */}
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus !== 'succeeded'"
      x-cloak
    >
      <StatRow
        label="Target reached"
        value="currentTargetLabel()"
      />
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
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus === 'succeeded' && resultsSnapshot"
      x-cloak
    >
      <StatRow
        label="Target reached"
        value="resultsSnapshot?.target"
      />
      <StatRow
        label="Attempts"
        value="resultsSnapshot?.attempts"
      />
      <StatRow
        label="Successes"
        value="resultsSnapshot?.successes"
      />
      <StatRow
        label="Failures"
        value="resultsSnapshot?.failures"
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
      <p
        class="text-sm text-success"
        x-show="completionStatus === 'succeeded'"
        x-cloak
      >
        Saved!
      </p>
    </div>

    <p
      class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
      role="alert"
      x-text="playAgainError"
      x-show="playAgainError"
      x-cloak
    >
    </p>

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

- [ ] **Step 3: Write the play page**

Create `app/src/pages/games/tuod/play/index.astro`:

```astro
---
export const prerender = true;
import GameLayout from "@layouts/GameLayout.astro";
import TenUpOneDown from "@components/layout/games/interfaces/TenUpOneDown.astro";
import ConfirmDialog from "@components/ui/ConfirmDialog.astro";
import TenUpOneDownResults from "@components/layout/games/result-modals/TenUpOneDownResults.astro";
import NoSessionPanel from "@components/layout/games/NoSessionPanel.astro";
import ReconciliationBlocked from "@components/layout/games/ReconciliationBlocked.astro";
---

<GameLayout
  title="Ten Up One Down — Play"
  gameTitle="Ten Up One Down"
>
  <div
    class="flex flex-col flex-1 min-h-0 p-3"
    x-data="tuodPlay()"
    @confirm-exit.window="abandonAndExit()"
  >
    {/* Loading / reconciliation-blocked */}
    <ReconciliationBlocked />

    {/* No active session view */}
    <NoSessionPanel href="/games/tuod/setup" />

    {/* Gameplay view */}
    <TenUpOneDown
      x-show="!finished && hasActiveSession"
      x-cloak
    />

    {/* Finish confirm (before results) */}
    <div
      x-show="showFinishConfirm"
      x-cloak
    >
      <ConfirmDialog
        titleId="finish-confirm-title"
        title="Finish session?"
        description="This attempt completes the session. Confirm to save and finish, or cancel to reconsider."
        confirmLabel="Confirm"
        onCancel="cancelFinish()"
        onConfirm="confirmFinish()"
        dismissible={false}
      />
    </div>

    {/* Results modal (overlay) */}
    <TenUpOneDownResults />
  </div>
</GameLayout>
```

- [ ] **Step 4: Format**

Run: `cd app && npm run format`
Expected: reformats the three new `.astro` files if needed, no other diffs.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/games/interfaces/TenUpOneDown.astro app/src/components/layout/games/result-modals/TenUpOneDownResults.astro app/src/pages/games/tuod/play/index.astro
git commit -m "feat(tuod): add play page and results modal"
```

---

## Task 5: Wiring — games-visibility, route registration

**Files:**
- Modify: `app/src/lib/game/rulesets/games-visibility.ts`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`
- Modify: `app/tests/lib/game/rulesets/games-visibility.test.ts`

**Interfaces:**
- Consumes: `tuodSetup` (Task 1), `tuodPlay` (Task 3).
- Produces: `TUOD_V1` visible in `GAME_CARDS`; `Alpine.data("tuodSetup", ...)` / `Alpine.data("tuodPlay", ...)` registered for Task 2/4's `x-data` mounts.

- [ ] **Step 1: Update the failing assertions in `games-visibility.test.ts`**

`TUOD_V1` declares only `QUICK_SCORE` (`RULESET_CAPABILITIES.TUOD_V1 = [QUICK_SCORE]`, no `ANALYTICS` pair), so it must appear in the RECREATIONAL list but **not** in the "every carded game" ANALYTICS list. Edit `app/tests/lib/game/rulesets/games-visibility.test.ts`:

Replace the whole file with:

```typescript
import { describe, expect, it } from "vitest";
import { GAME_CARDS, visibleGames } from "@lib/game/rulesets/games-visibility";

// Every card in GAME_CARDS is a ruleset that has a real setup route, so a key
// asserted here is a card that can actually render. Visibility is keyed on
// capture mode alone, not the exact declared pair (see `visibleGames`'s own
// doc comment for why). Every carded ruleset declares a pair under
// RECREATIONAL; all but TUOD_V1 (QUICK_SCORE-only, no VISUAL_BOARD path)
// also declare one under ANALYTICS.

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
      "DOUBLES_TRAINING_V1",
      "SHANGHAI_V1",
      "121_V1",
      "AROUND_THE_CLOCK_V1",
      "TUOD_V1",
    ]);
  });

  it("shows every ANALYTICS-capable carded game under analytics, excluding the quick-score-only TUOD_V1", () => {
    const keys = visibleGames("ANALYTICS", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual(
      [
        "SCORE_TRAINING_V1",
        "501_V1",
        "BOBS27_V1",
        "SINGLES_V1",
        "DOUBLES_TRAINING_V1",
        "SHANGHAI_V1",
        "121_V1",
        "AROUND_THE_CLOCK_V1",
      ].sort(),
    );
    expect(keys).not.toContain("TUOD_V1");
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

  it("never hides TUOD_V1 under ANALYTICS when it has an active session", () => {
    const keys = visibleGames("ANALYTICS", "TUOD_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toContain("TUOD_V1");
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

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: FAIL — the RECREATIONAL list assertion is missing `TUOD_V1` (not yet in `GAME_CARDS`).

- [ ] **Step 3: Add the `TUOD_V1` card to `games-visibility.ts`**

In `app/src/lib/game/rulesets/games-visibility.ts`, append to `GAME_CARDS` (after the `AROUND_THE_CLOCK_V1` entry, before the closing `];`):

```typescript
  {
    rulesetVersionKey: "TUOD_V1",
    href: "/games/tuod/setup",
    title: "Ten Up One Down",
    caption: "Climb the checkout ladder — +10 on a finish, −1 on a miss.",
  },
```

Also update the file's doc comment — the line `That is why TUOD is absent despite declaring capabilities.` is now false. Change:

```typescript
 * `href` resolves. That is why TUOD is absent despite declaring capabilities.
```

to:

```typescript
 * `href` resolves.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Wire the route data**

In `app/src/lib/client/alpine/register-route-data.ts`, add two imports after the `aroundTheClockPlay` import:

```typescript
import { tuodSetup } from "@lib/game/tuod-setup.data";
import { tuodPlay } from "@lib/game/tuod-play.data";
```

And two registrations after `Alpine.data("aroundTheClockPlay", aroundTheClockPlay);`, before the closing `}`:

```typescript
  Alpine.data("tuodSetup", tuodSetup);
  Alpine.data("tuodPlay", tuodPlay);
```

- [ ] **Step 6: Run the full frontend test suite**

Run: `cd app && npx vitest run`
Expected: PASS — no regressions in any other game's tests.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/rulesets/games-visibility.ts app/src/lib/client/alpine/register-route-data.ts app/tests/lib/game/rulesets/games-visibility.test.ts
git commit -m "feat(tuod): wire into games list and route registration"
```

---

## Task 6: Manual verification, gates, context maintenance

**Files:**
- Modify: `docs/architecture/07-Frontend/09-Adding-A-Game.md` (remove the now-stale "TUOD is absent" note)
- Modify: `decisions/game-engine.md` (append entry; never edit the existing D153 block)
- No new test files — this task verifies, runs gates, and updates docs.

- [ ] **Step 1: Type-check and full validation**

Run: `cd app && npm run validate:app`
Expected: PASS — `db:status`, `db:migrate`, `db:introspect`, fallow, full test suite, `astro check`, graph refresh all clean. (Full procedure: `validate-app` skill.)

- [ ] **Step 2: Manual smoke test in the browser**

Run: `cd app && astro dev --background`, then open `/games` and confirm:
1. A "Ten Up One Down" card appears (RECREATIONAL mode).
2. `/games/tuod/setup` loads, shows the ROUNDS/MINUTES toggle, and "Start Game" creates a session and navigates to `/games/tuod/play`.
3. Tapping "Checked out" climbs the target by 10 (41 → 51); tapping "Missed" drops it by 1.
4. "Undo" reverts the last attempt.
5. Completing the configured ROUNDS count (or letting a MINUTES session's timer expire, then finishing the open attempt) opens the finish-confirm dialog, then the results modal with target/attempts/successes/failures.
6. "Play again" starts a fresh session at the same preset.

Stop the dev server after verifying: `cd app && astro dev stop`.

- [ ] **Step 3: Update `07-Frontend/09-Adding-A-Game.md`**

Read the file's current header `updated:` date and bump it to today. Remove or rephrase the sentence in the "Two slugs, and why" / touch-list intro that calls out TUOD as the standing example of an engine-only, frontend-absent ruleset — grep for `TUOD` in the file and rephrase each hit that assumed TUOD had no frontend (the *pattern* description — "an engine-only ruleset with no page" — stays valid as a general case; only the TUOD-specific claim is now stale).

- [ ] **Step 4: Append a decision entry**

In `decisions/game-engine.md` (never edit the existing D153 row), append a new row documenting: TUOD's frontend fan-out landed (setup/play/results pages, bespoke controllers); the `createPresetSetupController` factory now has three opt-outs for three distinct reasons (501/Score Training: custom `start` logic; TUOD: multi-preset selection where the factory assumes exactly one preset); `games-visibility.test.ts`'s ANALYTICS assertion no longer means "every carded game" — TUOD_V1 is the first QUICK_SCORE-only card. Follow `DECISIONS.md`'s format (ID, date, one paragraph, "why" note) and routing table.

- [ ] **Step 5: Run the context-maintenance and run-all-gates skills**

Invoke the `context-maintenance` skill, then the `run-all-gates` skill, per the root `CLAUDE.md` mandatory protocol. Fix anything either flags before considering the task done.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/07-Frontend/09-Adding-A-Game.md decisions/game-engine.md
git commit -m "docs(tuod): update adding-a-game note and decision ledger"
```

- [ ] **Step 7: Push and offer PR**

```bash
git push -u origin claude/tuod-implementation-2lb1mh
```

Per `finishing-a-development-branch`, present merge/PR/cleanup options to the user rather than opening a PR unasked.

---

## Self-Review Notes

**Spec coverage:** Setup (§1) → Task 1–2. Play (§2) → Task 3–4. Results (§3) → Task 4. Wiring (§4) → Task 5. Testing (§5) → folded into each task's own test file (no separate task, per "fold into the task whose deliverable needs it"). Edge cases (§6): MINUTES-expiry-before-any-attempt is the engine's own `completesAt` guard (already shipped, D153) — covered by Task 3's "lets the current attempt finish" test. No-preset-for-mode and reload-mid-session are covered by Task 1/3's tests. `playAgain` with no overrides is covered by Task 3's "ST4" test.

**Placeholder scan:** none — every step ships complete file contents or an exact diff instruction.

**Type consistency:** `TuodSetupContext`/`TuodPlayContext`/`TuodResultsSnapshot`/`TuodDurationType` are defined once in Task 1/3 and referenced identically (same field names: `presetForMode`, `recordAttempt`, `pendingAttempt`, `currentTargetLabel`, `undoAttempt`) in every later task and test. `computeStats`'s return shape (`target`/`attempts`/`successes`/`failures`) matches `TuodResultsSnapshot` and the results modal's field names exactly.
