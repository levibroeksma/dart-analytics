# Bob's 27 Phase 3 — Setup Page + Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Bob's 27 a reachable setup page — a games-page card, a setup route that starts a
session under either mode pair Phase 2 declared, and a play route that exists (does not 404) for
the setup page to redirect to.

**Architecture:** Pure mechanical extension of the 501/Score Training setup pattern
(`fiveOhOneSetup`/`scoreTrainingSetup` → `bobs27Setup`), simplified because Bob's 27 V1 has zero
editable settings (one seeded preset, no overrides). No server-side change — Phase 2 already
declared `BOBS27_V1`'s capabilities, seeded its game type/ruleset/preset (`database/seeds/
0003_game_engine_reference.sql`), and generalized `resolveSessionModePair`'s fallback.

**Tech Stack:** Astro.js, TypeScript, Alpine.js (`.data.ts` factories registered via
`register-route-data.ts`), Vitest.

## Global Constraints

- Server-side prerequisites already exist and are NOT touched by this phase: `game_types` row
  `BOBS27` (`0198f000-…-0005`), `ruleset_versions` row `BOBS27_V1` (`0198f100-…-0005`), and the
  single `configuration_templates` preset "Bob's 27 — Standard" (`0198f300-…-0009`,
  `{ start_score: 27, bull_hit_value: 50, miss_penalty_multiplier: 1 }`) — all in
  `database/seeds/0003_game_engine_reference.sql`. `BOBS27_V1` supports exactly two mode pairs
  (`RECREATIONAL`+`DETAILED_DARTS`, `ANALYTICS`+`VISUAL_BOARD`) per `capabilities.ts`
  (`app/src/lib/game/rulesets/capabilities.ts:44`) — no other pair may be sent.
- V1 has zero editable settings — every task in this plan omits `overrides` from the session
  config entirely (`config: { source: "template", templateRef }`, no `overrides` key) rather than
  sending `overrides: {}`. `ConfigInput`'s `overrides` field is `.optional()`
  (`app/src/pages/api/sessions/types.ts`) and `session.service.ts` already treats a missing key as
  `{}` (`...(input.config.overrides ?? {})`).
- `.astro` component markup is not unit-tested in this codebase (D101, `app/CLAUDE.md`) — tasks
  that only add/edit `.astro` files have no test step; variant logic stays inline in the
  component's own frontmatter.
- Corrected (Phase 1, board-value) scoring text — use this exact wording wherever the ruleset is
  described to a player:
  > "3 targets at the designated double, for each double hit, add the double's board value to
  > your total. For each three darts missed, deduct the target double's board value from your
  > total. E.g. miss all three darts at D18 → deduct 36; hit two D16 → add 2 × 32 = 64."
- Route/game-type/ruleset keys used throughout: `GAME_TYPE_KEY = "BOBS27"`,
  `RULESET_VERSION_KEY = "BOBS27_V1"`, setup route `/games/bobs27/setup`, play route
  `/games/bobs27/play`.
- Deviation from the design spec's literal wording: the spec describes the setup page as mirroring
  "501 setup's shell (reconciliation, ContinueSessionModal, `ReconciliationBlocked`, `IsLoading`)".
  The real `app/src/pages/games/501/setup/index.astro` does not use the `ReconciliationBlocked`
  component (that component is play-page-only, e.g. `pages/games/501/play/index.astro`) — 501's and
  Score Training's setup pages both inline the equivalent `reconciliationFailed`/
  `loadingReconciliation` markup directly. Task 3 mirrors the actual 501 setup file byte-for-byte
  in structure, not the spec's shorthand description of it.

---

### Task 1: Games-visibility card

**Files:**

- Modify: `app/src/lib/game/rulesets/games-visibility.ts`
- Test: `app/tests/lib/game/rulesets/games-visibility.test.ts`

**Interfaces:**

- Consumes: `RulesetVersionKey` (`@lib/types`), `supportsMode` (`./capabilities`) — both unchanged.
- Produces: `GAME_CARDS` gains a third entry (`rulesetVersionKey: "BOBS27_V1"`), which Task 3's
  setup route and `app/src/pages/games/index.astro` (unmodified — it already renders straight from
  `GAME_CARDS`) both depend on for the games page to link to `/games/bobs27/setup`.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `app/tests/lib/game/rulesets/games-visibility.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { GAME_CARDS, visibleGames } from "@lib/game/rulesets/games-visibility";

// Every card in GAME_CARDS is a ruleset that has a real setup route, so a key
// asserted here is a card that can actually render. No single mode pair is
// supported by all three carded rulesets — 501/Score Training declare
// QUICK_SCORE+VISUAL_BOARD, Bob's 27 declares DETAILED_DARTS+VISUAL_BOARD —
// so tests exercising "all cards visible" pick VISUAL_BOARD, the one pair
// every carded ruleset shares.

describe("visibleGames", () => {
  it("shows every quick-score-capable game under quick score", () => {
    const keys = visibleGames("RECREATIONAL", "QUICK_SCORE", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toContain("501_V1");
    expect(keys).toContain("SCORE_TRAINING_V1");
    expect(keys).not.toContain("BOBS27_V1");
  });

  it("shows only detailed-darts-capable games under recreational detailed darts", () => {
    const keys = visibleGames("RECREATIONAL", "DETAILED_DARTS", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual(["BOBS27_V1"]);
  });

  it("shows every carded game under analytics visual board", () => {
    const keys = visibleGames("ANALYTICS", "VISUAL_BOARD", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual(["501_V1", "BOBS27_V1", "SCORE_TRAINING_V1"]);
  });

  it("hides every game under a mode no carded ruleset supports", () => {
    expect(visibleGames("RECREATIONAL", "UNKNOWN_INPUT_MODE", null)).toEqual(
      [],
    );
  });

  it("never hides a game with an active session", () => {
    const keys = visibleGames("RECREATIONAL", "DETAILED_DARTS", "501_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual(["501_V1", "BOBS27_V1"]);
  });

  it("does not duplicate a capable game that is also active", () => {
    const keys = visibleGames("ANALYTICS", "VISUAL_BOARD", "501_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys.filter((key) => key === "501_V1")).toHaveLength(1);
  });

  it("keeps the declared card order rather than the filter order", () => {
    const keys = visibleGames("RECREATIONAL", "QUICK_SCORE", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual(["SCORE_TRAINING_V1", "501_V1"]);
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

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: FAIL — "shows only detailed-darts-capable games under recreational detailed darts"
expects `["BOBS27_V1"]` but gets `[]` (no card declares `BOBS27_V1` yet); "shows every carded game
under analytics visual board" and "never hides a game with an active session" fail the same way.

- [ ] **Step 3: Add the Bob's 27 card**

In `app/src/lib/game/rulesets/games-visibility.ts`, add a third entry to `GAME_CARDS` (after the
existing `501_V1` entry, closing the array's existing bracket around it):

```ts
export const GAME_CARDS: readonly GameCardDescriptor[] = [
  {
    rulesetVersionKey: "SCORE_TRAINING_V1",
    href: "/games/score-training/setup",
    title: "Score training",
    caption: "Exercise your scoring abilities.",
  },
  {
    rulesetVersionKey: "501_V1",
    href: "/games/501/setup",
    title: "501",
    caption: "Classic double-out darts.",
  },
  {
    rulesetVersionKey: "BOBS27_V1",
    href: "/games/bobs27/setup",
    title: "Bob's 27",
    caption: "Running-score doubles training.",
  },
];
```

Nothing else in the file changes — `visibleGames` already filters on `supportsMode`, which already
knows `BOBS27_V1`'s pairs from Phase 2.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: PASS (8/8).

- [ ] **Step 5: Commit**

```bash
cd app && git add src/lib/game/rulesets/games-visibility.ts tests/lib/game/rulesets/games-visibility.test.ts
git commit -m "feat(bobs27): add games-page card for Bob's 27"
```

---

### Task 2: `bobs27Setup` data module

**Files:**

- Create: `app/src/lib/game/bobs27-setup.data.ts`
- Modify: `app/src/lib/game/types.ts` — add `Bobs27SetupContext`
- Modify: `app/src/lib/client/alpine/register-route-data.ts` — register `bobs27Setup`
- Test: `app/tests/lib/game/bobs27-setup.data.test.ts`

**Interfaces:**

- Consumes: `fetchConfigurationPresets`, `createSession`, `fetchActiveSessions`,
  `completeSession`, `type SessionActiveData` (`@client/api/*`), `toSnapshot`
  (`@lib/game/rulesets/config-codec`), `reconcileActiveSession`
  (`@lib/game/session-recovery`), `resolveSessionModePair`, `startSessionInput`
  (`@lib/game/session-mode-resolution` — both already generalized/ruleset-agnostic by Phase 2, no
  change needed here).
- Produces: `bobs27Setup()` factory and `Bobs27SetupContext` type, consumed by Task 3's
  `Bobs27SetupForm.astro` (`x-data="bobs27Setup()"` on the page) and by
  `register-route-data.ts`'s `Alpine.data("bobs27Setup", bobs27Setup)`.

- [ ] **Step 1: Write the failing tests**

Create `app/tests/lib/game/bobs27-setup.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { bobs27Setup } from "@lib/game/bobs27-setup.data";
import type { Bobs27SetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const STANDARD_PRESET = {
  configurationTemplateId: "tmpl-standard",
  gameTypeKey: "BOBS27",
  name: "Bob's 27 — Standard",
  description: null,
  configuration: {
    start_score: 27,
    bull_hit_value: 50,
    miss_penalty_multiplier: 1,
  },
  isSystemTemplate: true,
} as any;

describe("bobs27Setup", () => {
  let store: Bobs27SetupContext["$store"];

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
    overrides: Partial<Bobs27SetupContext> = {},
  ): Bobs27SetupContext {
    return {
      ...bobs27Setup(),
      $store: store,
      ...overrides,
    } as Bobs27SetupContext;
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
        "BOBS27",
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
        { sessionId: "match-id", gameTypeKey: "BOBS27" } as any,
      ]);
      store.game.sessionId = "match-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "match-id",
        gameTypeKey: "BOBS27",
      });
    });

    it('blocks with reconciliationFailed on "abandon_failed"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "BOBS27" } as any,
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
        activeSession: { sessionId: "match-id", gameTypeKey: "BOBS27" } as any,
      });
      const locationSpy = { href: "/games/bobs27/setup" };
      vi.stubGlobal("location", locationSpy);

      setup.continueSession();

      expect(locationSpy.href).toBe("/games/bobs27/play");
    });

    it("abandons session when user clicks Abandon", async () => {
      const setup = createSetup({
        activeSession: { sessionId: "match-id", gameTypeKey: "BOBS27" } as any,
      });
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "match-id",
        statusKey: "ABANDONED",
        completedAt: "2026-08-12T10:00:00Z",
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
        gameTypeKey: "BOBS27",
        rulesetVersionKey: "BOBS27_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        config: {
          source: "template",
          templateRef: "tmpl-standard",
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-standard",
          configSnapshot: expect.objectContaining({
            startScore: 27,
            bullHitValue: 50,
            missPenaltyMultiplier: 1,
          }),
        }),
      );
      expect(locationSpy.href).toBe("/games/bobs27/play");
    });

    it("sends the player's chosen supported pair from settings instead of a hardcoded one", async () => {
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
          captureModeKey: "ANALYTICS",
          inputModeKey: "VISUAL_BOARD",
        }),
      );
    });

    it("falls back to Bob's 27's first declared pair when settings holds a pair it does not declare", async () => {
      store.settings = {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
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
      expect(setup.error).toBe("Could not find a preset for Bob's 27.");
    });

    it("rejects a preset whose configuration fails schema validation, before creating a session", async () => {
      const setup = createSetup({
        presets: [
          {
            ...STANDARD_PRESET,
            configuration: { start_score: "twenty-seven" },
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
        { sessionId: "active-1", gameTypeKey: "BOBS27" } as any,
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

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/bobs27-setup.data.test.ts`
Expected: FAIL with "Cannot find module '@lib/game/bobs27-setup.data'" (module does not exist yet)
and "Cannot find name 'Bobs27SetupContext'" (type does not exist yet).

- [ ] **Step 3: Add `Bobs27SetupContext` to types.ts**

In `app/src/lib/game/types.ts`, add (near `FiveOhOneSetupContext`, same shape minus the
score/legs fields — no `$watch`, since there is no mode toggle to watch):

```ts
export type Bobs27SetupContext = {
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
  init(this: Bobs27SetupContext): Promise<void>;
  reconcile(
    this: Bobs27SetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: Bobs27SetupContext): Promise<void>;
  continueSession(this: Bobs27SetupContext): void;
  abandonSession(this: Bobs27SetupContext): Promise<void>;
  start(this: Bobs27SetupContext): Promise<void>;
};
```

- [ ] **Step 4: Create `bobs27-setup.data.ts`**

Create `app/src/lib/game/bobs27-setup.data.ts`:

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
import type { Bobs27SetupContext } from "./types";

const GAME_TYPE_KEY = "BOBS27";
const RULESET_VERSION_KEY = "BOBS27_V1";

export function bobs27Setup() {
  return {
    presets: [] as ConfigurationPresetData[],
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: Bobs27SetupContext) {
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
      this: Bobs27SetupContext,
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

    async retryReconciliation(this: Bobs27SetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: Bobs27SetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/bobs27/play";
    },

    async abandonSession(this: Bobs27SetupContext) {
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

    async start(this: Bobs27SetupContext) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = "Could not find a preset for Bob's 27.";
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
        globalThis.location.href = "/games/bobs27/play";
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

`toSnapshot(RULESET_VERSION_KEY, preset.configuration)` parses against `Bobs27Config`'s Zod schema
(`.strict()`), so `preset.configuration = { start_score: "twenty-seven" }` throws inside the `try`
and is caught by the same `catch` branch `createSession` failures use — matching the last new
test's expectation without a separate validation branch.

- [ ] **Step 5: Register `bobs27Setup`**

In `app/src/lib/client/alpine/register-route-data.ts`:

```ts
import type { Alpine } from "alpinejs";
import { loginForm } from "@auth/login.data";
import { scoreTrainingSetup } from "@lib/game/score-training-setup.data";
import { scoreTrainingPlay } from "@lib/game/score-training-play.data";
import { fiveOhOneSetup } from "@lib/game/five-oh-one-setup.data";
import { fiveOhOnePlay } from "@lib/game/five-oh-one-play.data";
import { bobs27Setup } from "@lib/game/bobs27-setup.data";
import { gamesIndex } from "@lib/game/games-index.data";

export function registerRouteData(Alpine: Alpine) {
  Alpine.data("loginForm", loginForm);
  Alpine.data("gamesIndex", gamesIndex);
  Alpine.data("scoreTrainingSetup", scoreTrainingSetup);
  Alpine.data("scoreTrainingPlay", scoreTrainingPlay);
  Alpine.data("fiveOhOneSetup", fiveOhOneSetup);
  Alpine.data("fiveOhOnePlay", fiveOhOnePlay);
  Alpine.data("bobs27Setup", bobs27Setup);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/bobs27-setup.data.test.ts`
Expected: PASS (11/11).

- [ ] **Step 7: Commit**

```bash
cd app && git add src/lib/game/bobs27-setup.data.ts src/lib/game/types.ts src/lib/client/alpine/register-route-data.ts tests/lib/game/bobs27-setup.data.test.ts
git commit -m "feat(bobs27): add bobs27Setup data module"
```

---

### Task 3: Setup page + form component

**Files:**

- Create: `app/src/components/layout/games/setup/Bobs27SetupForm.astro`
- Create: `app/src/pages/games/bobs27/setup/index.astro`

**Interfaces:**

- Consumes: `Button` (`@components/forms/Button.astro`), `InfoSection`
  (`@components/ui/InfoSection.astro`), `SetupShell`, `UserSection`
  (`./` — `app/src/components/layout/games/setup/`), `ContinueSessionModal`
  (`@components/layout/games/ContinueSessionModal.astro`), `IsLoading`
  (`@components/ui/IsLoading.astro`) — all unchanged, all already used by
  `FiveOhOneSetupForm.astro`/`pages/games/501/setup/index.astro`. Consumes the `bobs27Setup()`
  Alpine factory registered in Task 2 via `x-data="bobs27Setup()"`.
- Produces: the `/games/bobs27/setup` route Task 1's games-page card links to.

No test step — `.astro` markup is not unit-tested (D101, see Global Constraints).

- [ ] **Step 1: Create `Bobs27SetupForm.astro`**

Create `app/src/components/layout/games/setup/Bobs27SetupForm.astro`:

```astro
---
// Components
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import UserSection from "./UserSection.astro";

const infoSection = {
  title: "Bob's 27 rules",
  description:
    "3 targets at the designated double, for each double hit, add the double's board value to your total. For each three darts missed, deduct the target double's board value from your total. E.g. miss all three darts at D18 → deduct 36; hit two D16 → add 2 × 32 = 64.",
};
---

<SetupShell title="Bob's 27">
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

V1 has no editable settings (start score, path, mode are all locked per the ruleset doc's "Config
& presets" table), so unlike `FiveOhOneSetupForm.astro` there is no `SettingSectionShell`/
`Toggle`/`Input` block — `SetupShell`'s own submit button (`start()`, wired inside `SetupShell`)
is the only control.

- [ ] **Step 2: Create the setup route**

Create `app/src/pages/games/bobs27/setup/index.astro`, mirroring
`app/src/pages/games/501/setup/index.astro` exactly (see Global Constraints — the real 501 file
inlines the reconciliation-failed block rather than using the `ReconciliationBlocked` component):

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import Button from "@components/forms/Button.astro";
import ContinueSessionModal from "@components/layout/games/ContinueSessionModal.astro";
import Bobs27SetupForm from "@components/layout/games/setup/Bobs27SetupForm.astro";
import IsLoading from "@components/ui/IsLoading.astro";
---

<AppLayout title="Bob's 27 — Setup">
  <div
    class="p-4"
    x-data="bobs27Setup()"
  >
    <template x-if="showActiveSessionModal && activeSession">
      <ContinueSessionModal gameTitle="Bob's 27" />
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
      <Bobs27SetupForm />
    </template>

    <template x-if="loadingReconciliation">
      <IsLoading title="Configuring your session..." />
    </template>
  </div>
</AppLayout>
```

- [ ] **Step 3: Format**

Run: `cd app && npm run format`

- [ ] **Step 4: Commit**

```bash
cd app && git add src/components/layout/games/setup/Bobs27SetupForm.astro src/pages/games/bobs27/setup/index.astro
git commit -m "feat(bobs27): add setup page and form"
```

---

### Task 4: Play route placeholder

**Files:**

- Create: `app/src/pages/games/bobs27/play/index.astro`

**Interfaces:**

- Consumes: `GameLayout` (`@layouts/GameLayout.astro`) — unchanged; requires no page-level
  `x-data`, so this task pulls in none of Phase 4's play-page data module.
- Produces: the `/games/bobs27/play` route `bobs27Setup().start()`/`continueSession()` (Task 2)
  redirect to. Phase 4 replaces this file's body with the real gameplay interface; this task's job
  is only that the route exists and renders something coherent, per the design spec's Phase 3
  acceptance note ("the route must exist and not 404, but full gameplay is not required for this
  phase's acceptance").

This is intentionally a static placeholder, not a stub of the play interface: no preview
component, recreational/analytics input, or results modal (all explicitly out of scope for this
phase per the design spec) — those are Phase 4. It does not read `$store.game` or attempt session
reconciliation, so a session started from Task 3's setup page lands here without error even though
nothing on this page displays it yet.

No test step — `.astro` markup is not unit-tested (D101, see Global Constraints).

- [ ] **Step 1: Create the placeholder route**

Create `app/src/pages/games/bobs27/play/index.astro`:

```astro
---
export const prerender = true;
import GameLayout from "@layouts/GameLayout.astro";
---

<GameLayout
  title="Bob's 27 — Play"
  gameTitle="Bob's 27"
>
  <div class="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
    <h2 class="text-foreground font-semibold">Bob's 27 gameplay is coming soon</h2>
    <p class="text-muted-foreground text-sm">
      Your session has been saved. This screen will support play in a future update.
    </p>
  </div>
</GameLayout>
```

- [ ] **Step 2: Format**

Run: `cd app && npm run format`

- [ ] **Step 3: Commit**

```bash
cd app && git add src/pages/games/bobs27/play/index.astro
git commit -m "feat(bobs27): add play route placeholder"
```

---

### Task 5: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full DB-independent validation set**

Run from `app/` (no `DATABASE_URL` in this container — see `validate-app` skill's mid-task gate):

```bash
cd app && npm test
npx fallow
npm run check
npm run format:check
```

Expected: full suite green (no regressions beyond the tests this plan added); `npx fallow` reports
0 functions above the complexity/duplication thresholds; `npm run check` (TypeScript) clean;
`npm run format:check` clean.

- [ ] **Step 2: Relevant gate scripts**

```bash
bash scripts/check-file-locations.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-style-tokens.sh
```

Expected: all green. (`check-game-engines.sh`, `check-refinement-coverage.sh`,
`check-decision-ids.sh` are unaffected — this phase touches no engine, no schema, and adds no new
decision block.)

- [ ] **Step 3: Manual route smoke check (if a dev server is reachable in this environment)**

```bash
cd app && astro dev --background
```

Verify `/games` renders a "Bob's 27" card under both `RECREATIONAL` and `ANALYTICS` app modes,
`/games/bobs27/setup` starts a session and redirects to `/games/bobs27/play` without a 404 under
each mode, then stop the server (`astro dev stop`). Skip this step and note it explicitly in the
final report if no browser/dev-server access is available in this environment — do not claim it
was verified if it was not run.

No commit for this task — it is verification of Tasks 1–4's commits, not new work.
