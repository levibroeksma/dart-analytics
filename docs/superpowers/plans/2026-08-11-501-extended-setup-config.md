# 501 Extended Setup Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the 501 setup screen with an editable starting-score picker (301/501/701/Custom), restyle the existing firstTo-legs input, reorder/relabel the play-page stat tiles, and rebuild the setup form on Score Training's shared setup components.

**Architecture:** Pure client-side change. `FiveOhOneConfig` already declares `starting_score` and `legs_to_win`; `POST /api/sessions`'s template `overrides` already merges arbitrary keys and validates against the ruleset schema. So this plan only touches the Alpine data factory (`five-oh-one-setup.data.ts`), a new pure clamp module, the shared type barrel, the `.astro` setup form (moved and rebuilt on `SetupShell`/`SettingSectionShell`/`UserSection`/`InfoSection`/`Toggle`/`Input`), and the play-page stat-tile markup. No API, schema, seed, or engine changes.

**Tech Stack:** Astro, TypeScript, Alpine.js, Vitest.

## Global Constraints

- Starting-score custom input: bounds 2–999, default 101 (spec §2).
- FirstTo-legs bounds stay 1–20, unchanged (existing `five-oh-one-legs.ts`).
- Double out stays the fixed default; no in/out control is added (spec scope).
- No API, schema, seed, or `config-codec.ts` changes — `overrides` and the snake↔camel mapper are already generic (spec §3).
- No `.astro` component unit tests — markup logic stays inline in frontmatter, verified by `astro check` + manual read (D101, `app/CLAUDE.md`).
- Test files mirror `app/src/` paths under `app/tests/`, never colocated (`app/CLAUDE.md`).
- No `//` or `/* */` comments inside function/method bodies in `app/src/**/*.ts`; JSDoc above the declaration only (`app/CLAUDE.md`).
- Alpine v3 shorthand only: `:attr`, `@event` — never `x-bind`/`x-on` (`app/CLAUDE.md`).
- Every `x-show` needs a matching `x-cloak` (`scripts/check-astro-conventions.sh`).
- Semantic Tailwind tokens only; reuse `Input`/`Toggle`/`Button` primitives — never hand-rolled markup (`app/CLAUDE.md` Style non-negotiables).

---

## Task 1: Starting-score clamp module

**Files:**
- Create: `app/src/lib/game/five-oh-one-starting-score.ts`
- Test: `app/tests/lib/game/five-oh-one-starting-score.test.ts`

**Interfaces:**
- Produces: `FIVE_OH_ONE_STARTING_SCORE_MIN` (`number`, `= 2`), `FIVE_OH_ONE_STARTING_SCORE_NOTICE` (`string`, `= "Allowed range: 2–999"`), `clampFiveOhOneStartingScore(value: unknown): { value: number; clamped: boolean }`

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/game/five-oh-one-starting-score.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clampFiveOhOneStartingScore,
  FIVE_OH_ONE_STARTING_SCORE_NOTICE,
} from "@lib/game/five-oh-one-starting-score";

describe("clampFiveOhOneStartingScore", () => {
  it("passes an in-range value through unclamped", () => {
    expect(clampFiveOhOneStartingScore(301)).toEqual({
      value: 301,
      clamped: false,
    });
  });

  it("accepts both bounds", () => {
    expect(clampFiveOhOneStartingScore(2)).toEqual({
      value: 2,
      clamped: false,
    });
    expect(clampFiveOhOneStartingScore(999)).toEqual({
      value: 999,
      clamped: false,
    });
  });

  it("clamps above the maximum of 999", () => {
    expect(clampFiveOhOneStartingScore(1500)).toEqual({
      value: 999,
      clamped: true,
    });
  });

  it("clamps below the minimum of 2", () => {
    expect(clampFiveOhOneStartingScore(1)).toEqual({
      value: 2,
      clamped: true,
    });
    expect(clampFiveOhOneStartingScore(-4)).toEqual({
      value: 2,
      clamped: true,
    });
  });

  it("floors a fractional value", () => {
    expect(clampFiveOhOneStartingScore(101.7)).toEqual({
      value: 101,
      clamped: true,
    });
  });

  it("clamps a blank or non-numeric input to the default of 101", () => {
    expect(clampFiveOhOneStartingScore(null)).toEqual({
      value: 101,
      clamped: true,
    });
    expect(clampFiveOhOneStartingScore("")).toEqual({
      value: 101,
      clamped: true,
    });
    expect(clampFiveOhOneStartingScore(Number.NaN)).toEqual({
      value: 101,
      clamped: true,
    });
  });

  it("states the allowed range in its notice", () => {
    expect(FIVE_OH_ONE_STARTING_SCORE_NOTICE).toBe("Allowed range: 2–999");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-starting-score.test.ts`
Expected: FAIL — cannot find module `@lib/game/five-oh-one-starting-score`

- [ ] **Step 3: Write minimal implementation**

Create `app/src/lib/game/five-oh-one-starting-score.ts`:

```ts
/**
 * `starting_score` bounds for the custom setup input, matching
 * `FiveOhOneConfig`'s `.min(2)` floor and the 301/501/701/Custom picker in
 * `docs/game-rules/rulesets/501.md`.
 */
export const FIVE_OH_ONE_STARTING_SCORE_MIN = 2;
const FIVE_OH_ONE_STARTING_SCORE_MAX = 999;
const FIVE_OH_ONE_STARTING_SCORE_DEFAULT = 101;

export const FIVE_OH_ONE_STARTING_SCORE_NOTICE = "Allowed range: 2–999";

/**
 * Floors finite numbers, then clamps into the inclusive starting-score
 * bounds. Non-finite / non-number inputs clamp to the custom field's stated
 * default of 101 — what the input shows before the player types anything —
 * rather than the bare minimum of 2.
 */
export function clampFiveOhOneStartingScore(value: unknown): {
  value: number;
  clamped: boolean;
} {
  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return { value: FIVE_OH_ONE_STARTING_SCORE_DEFAULT, clamped: true };
  }
  const floored = Math.floor(numeric);
  const clampedValue = Math.min(
    FIVE_OH_ONE_STARTING_SCORE_MAX,
    Math.max(FIVE_OH_ONE_STARTING_SCORE_MIN, floored),
  );
  return { value: clampedValue, clamped: clampedValue !== numeric };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-starting-score.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/five-oh-one-starting-score.ts app/tests/lib/game/five-oh-one-starting-score.test.ts
git commit -m "Add clampFiveOhOneStartingScore for the 501 custom starting-score input"
```

---

## Task 2: Setup context type + data-layer state

**Files:**
- Modify: `app/src/lib/game/types.ts:177-208` (the `FiveOhOneSetupContext` block)
- Modify: `app/src/lib/game/five-oh-one-setup.data.ts`
- Test: `app/tests/lib/game/five-oh-one-setup.data.test.ts`

**Interfaces:**
- Consumes: `clampFiveOhOneStartingScore`, `FIVE_OH_ONE_STARTING_SCORE_NOTICE` from Task 1; `clampFiveOhOneLegs`, `FIVE_OH_ONE_LEGS_MIN`, `FIVE_OH_ONE_LEGS_NOTICE` from `@lib/game/five-oh-one-legs` (unchanged)
- Produces: `FiveOhOneStartingScoreOption = "301" | "501" | "701" | "CUSTOM"`; `FiveOhOneSetupContext` gains `startingScoreOption`, `startingScoreValue`, `scoreClampNotice`, and renames `clampNotice` → `legsClampNotice`; `fiveOhOneSetup()`'s returned object carries the same fields; `start()`'s `config.overrides` now sends both `legs_to_win` and `starting_score`

- [ ] **Step 1: Update the type barrel**

In `app/src/lib/game/types.ts`, replace the `FiveOhOneSetupContext` block (lines 177–208):

```ts
export type FiveOhOneSetupContext = {
  presets: ConfigurationPresetData[];
  legsToWin: number | string | null;
  clampNotice: string;
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
  init(this: FiveOhOneSetupContext): Promise<void>;
  reconcile(
    this: FiveOhOneSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: FiveOhOneSetupContext): Promise<void>;
  continueSession(this: FiveOhOneSetupContext): void;
  abandonSession(this: FiveOhOneSetupContext): Promise<void>;
  basePreset(this: FiveOhOneSetupContext): ConfigurationPresetData | undefined;
  start(this: FiveOhOneSetupContext): Promise<void>;
};
```

with:

```ts
export type FiveOhOneStartingScoreOption = "301" | "501" | "701" | "CUSTOM";

export type FiveOhOneSetupContext = {
  presets: ConfigurationPresetData[];
  startingScoreOption: FiveOhOneStartingScoreOption;
  startingScoreValue: number | string | null;
  scoreClampNotice: string;
  legsToWin: number | string | null;
  legsClampNotice: string;
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
  init(this: FiveOhOneSetupContext): Promise<void>;
  reconcile(
    this: FiveOhOneSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: FiveOhOneSetupContext): Promise<void>;
  continueSession(this: FiveOhOneSetupContext): void;
  abandonSession(this: FiveOhOneSetupContext): Promise<void>;
  basePreset(this: FiveOhOneSetupContext): ConfigurationPresetData | undefined;
  start(this: FiveOhOneSetupContext): Promise<void>;
};
```

- [ ] **Step 2: Write the failing/updated tests**

Replace the full contents of `app/tests/lib/game/five-oh-one-setup.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fiveOhOneSetup } from "@lib/game/five-oh-one-setup.data";
import type { FiveOhOneSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const QUICK_PLAY_PRESET = {
  configurationTemplateId: "tmpl-quick",
  name: "501 — Quick Play",
  configuration: {
    starting_score: 501,
    legs_to_win: 1,
    check_in: "STRAIGHT_IN",
    check_out: "DOUBLE_OUT",
    max_darts_per_turn: 3,
    max_visit_score: 180,
  },
} as any;

const BEST_OF_5_PRESET = {
  configurationTemplateId: "tmpl-best-of-5",
  name: "501 — Best of 5 Legs",
  configuration: {
    starting_score: 501,
    legs_to_win: 3,
    check_in: "STRAIGHT_IN",
    check_out: "DOUBLE_OUT",
    max_darts_per_turn: 3,
    max_visit_score: 180,
  },
} as any;

describe("fiveOhOneSetup", () => {
  let store: FiveOhOneSetupContext["$store"];

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
    overrides: Partial<FiveOhOneSetupContext> = {},
  ): FiveOhOneSetupContext {
    return { ...fiveOhOneSetup(), $store: store, ...overrides };
  }

  it("defaults legsToWin and startingScoreOption, and loads the presets", async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
      QUICK_PLAY_PRESET,
      BEST_OF_5_PRESET,
    ]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

    await setup.init();

    expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith("501");
    expect(setup.legsToWin).toBe(1);
    expect(setup.legsClampNotice).toBe("");
    expect(setup.startingScoreOption).toBe("501");
    expect(setup.startingScoreValue).toBe(101);
    expect(setup.presets).toHaveLength(2);
  });

  it("falls back to 1 leg when no preset declares legs_to_win", async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
      { configurationTemplateId: "t", name: "odd", configuration: {} } as any,
    ]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

    await setup.init();

    expect(setup.legsToWin).toBe(1);
  });

  it('shows the active-session modal on "match"', async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      { sessionId: "match-id", gameTypeKey: "501" } as any,
    ]);
    store.game.sessionId = "match-id";

    await setup.init();

    expect(setup.showActiveSessionModal).toBe(true);
    expect(setup.activeSession).toEqual({
      sessionId: "match-id",
      gameTypeKey: "501",
    });
  });

  it('blocks with reconciliationFailed on "abandon_failed"', async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      { sessionId: "server-id", gameTypeKey: "501" } as any,
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

  it("continueSession navigates to the play page", () => {
    const setup = createSetup({
      activeSession: { sessionId: "match-id", gameTypeKey: "501" } as any,
    });
    const locationSpy = { href: "/games/501/setup" };
    vi.stubGlobal("location", locationSpy);

    setup.continueSession();

    expect(locationSpy.href).toBe("/games/501/play");
  });

  it("basePreset picks the single-leg template as the override base", () => {
    const setup = createSetup({
      presets: [BEST_OF_5_PRESET, QUICK_PLAY_PRESET],
    });
    expect(setup.basePreset()).toBe(QUICK_PLAY_PRESET);
  });

  it("falls back to the first preset when none declares legs_to_win = 1", () => {
    const setup = createSetup({ presets: [BEST_OF_5_PRESET] });
    expect(setup.basePreset()).toBe(BEST_OF_5_PRESET);
  });

  it("creates a session overriding legs_to_win and starting_score with the chosen values and redirects", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 5,
      startingScoreOption: "301",
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
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      config: {
        source: "template",
        templateRef: "tmpl-quick",
        overrides: { legs_to_win: 5, starting_score: 301 },
      },
    });
    expect(store.game.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        gameTypeKey: "501",
        rulesetVersionKey: "501_V1",
        templateRef: "tmpl-quick",
        configSnapshot: expect.objectContaining({
          startingScore: 301,
          legsToWin: 5,
          checkIn: "STRAIGHT_IN",
          checkOut: "DOUBLE_OUT",
        }),
      }),
    );
    expect(locationSpy.href).toBe("/games/501/play");
  });

  it("uses the custom starting score value when the option is CUSTOM", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 1,
      startingScoreOption: "CUSTOM",
      startingScoreValue: 350,
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

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: { legs_to_win: 1, starting_score: 350 },
        }),
      }),
    );
    expect(setup.scoreClampNotice).toBe("");
  });

  it("clamps an out-of-range custom starting score, sets the notice, and still creates", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 1,
      startingScoreOption: "CUSTOM",
      startingScoreValue: 5000,
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

    expect(setup.startingScoreValue).toBe(999);
    expect(setup.scoreClampNotice).toBe("Allowed range: 2–999");
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: { legs_to_win: 1, starting_score: 999 },
        }),
      }),
    );
  });

  it("clamps a blank custom starting score to the default of 101", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 1,
      startingScoreOption: "CUSTOM",
      startingScoreValue: null,
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

    expect(setup.startingScoreValue).toBe(101);
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: { legs_to_win: 1, starting_score: 101 },
        }),
      }),
    );
  });

  it("sends the player's chosen supported pair from settings instead of a hardcoded one", async () => {
    store.settings = {
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    };
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 5,
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

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      }),
    );
  });

  it("falls back to quick score when settings holds a pair 501 does not declare", async () => {
    store.settings = {
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    };
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 5,
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

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }),
    );
  });

  it("defaults to quick score when settings has not loaded", async () => {
    store.settings = {} as any;
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 5,
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

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }),
    );
  });

  it("clamps an out-of-range legs value, sets the notice, and still creates", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 99,
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

    expect(setup.legsToWin).toBe(20);
    expect(setup.legsClampNotice).toBe("Allowed range: 1–20 legs");
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: { legs_to_win: 20, starting_score: 501 },
        }),
      }),
    );
  });

  it("clamps a blank field to a single leg", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: null,
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

    expect(setup.legsToWin).toBe(1);
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: { legs_to_win: 1, starting_score: 501 },
        }),
      }),
    );
  });

  it("errors when no preset is available at all", async () => {
    const setup = createSetup({ presets: [], legsToWin: 3 });
    await setup.start();
    expect(sessionsApi.createSession).not.toHaveBeenCalled();
    expect(setup.error).toBe("Could not find a preset for 501.");
  });

  it("rejects a preset whose configuration fails schema validation, before creating a session", async () => {
    const setup = createSetup({
      presets: [
        {
          configurationTemplateId: "template-1",
          name: "Broken",
          configuration: { starting_score: 501 },
        } as any,
      ],
      legsToWin: 3,
    });

    await setup.start();

    expect(sessionsApi.createSession).not.toHaveBeenCalled();
    expect(store.game.startSession).not.toHaveBeenCalled();
    expect(setup.error).toMatch(/Could not start the session/);
    expect(setup.loading).toBe(false);
  });

  it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 1,
    });
    vi.mocked(sessionsApi.createSession).mockRejectedValue(
      Object.assign(new Error("already active"), {
        code: "SESSION_ALREADY_ACTIVE",
      }),
    );
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      { sessionId: "active-1", gameTypeKey: "501" } as any,
    ]);
    store.game.sessionId = "active-1";

    await setup.start();

    expect(setup.showActiveSessionModal).toBe(true);
    expect(setup.activeSession).toMatchObject({ sessionId: "active-1" });
    expect(setup.loading).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-setup.data.test.ts`
Expected: FAIL — `setup.startingScoreOption`/`scoreClampNotice` undefined, `legsClampNotice` undefined, `overrides` missing `starting_score`

- [ ] **Step 4: Implement the data-layer changes**

Replace the full contents of `app/src/lib/game/five-oh-one-setup.data.ts`:

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
import {
  clampFiveOhOneLegs,
  FIVE_OH_ONE_LEGS_MIN,
  FIVE_OH_ONE_LEGS_NOTICE,
} from "@lib/game/five-oh-one-legs";
import {
  clampFiveOhOneStartingScore,
  FIVE_OH_ONE_STARTING_SCORE_NOTICE,
} from "@lib/game/five-oh-one-starting-score";
import type {
  FiveOhOneSetupContext,
  FiveOhOneStartingScoreOption,
} from "./types";

const GAME_TYPE_KEY = "501";
const RULESET_VERSION_KEY = "501_V1";
const CUSTOM_STARTING_SCORE_DEFAULT = 101;

/**
 * Reads `legs_to_win` off a preset's `configuration`, which the API types as
 * `Record<string, unknown>`.
 */
function presetLegsToWin(
  preset: ConfigurationPresetData | undefined,
): number | undefined {
  const raw = preset?.configuration?.legs_to_win;
  return typeof raw === "number" ? raw : undefined;
}

export function fiveOhOneSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    startingScoreOption: "501" as FiveOhOneStartingScoreOption,
    startingScoreValue: CUSTOM_STARTING_SCORE_DEFAULT as
      | number
      | string
      | null,
    scoreClampNotice: "",
    legsToWin: FIVE_OH_ONE_LEGS_MIN as number | string | null,
    legsClampNotice: "",
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: FiveOhOneSetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);
        this.presets = presets;
        this.legsToWin =
          presetLegsToWin(this.basePreset()) ?? FIVE_OH_ONE_LEGS_MIN;
        this.legsClampNotice = "";
        await this.reconcile(activeSessions);
      } catch {
        this.showActiveSessionModal = false;
        this.error =
          "Could not load setup. Check your connection and try again.";
      } finally {
        this.loadingReconciliation = false;
      }
    },

    /**
     * The template whose configuration is copied, with `legs_to_win` and
     * `starting_score` overridden by the player's chosen values. The
     * single-leg preset is preferred so the overrides are the only
     * difference from a seeded default; any preset will do when that one is
     * absent, since every 501 preset shares the same locked V1 values for
     * every other key.
     */
    basePreset(this: FiveOhOneSetupContext) {
      return (
        this.presets.find((p) => presetLegsToWin(p) === FIVE_OH_ONE_LEGS_MIN) ??
        this.presets[0]
      );
    },

    async reconcile(
      this: FiveOhOneSetupContext,
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

    async retryReconciliation(this: FiveOhOneSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: FiveOhOneSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/501/play";
    },

    async abandonSession(this: FiveOhOneSetupContext) {
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

    async start(this: FiveOhOneSetupContext) {
      const preset = this.basePreset();
      if (!preset) {
        this.error = "Could not find a preset for 501.";
        return;
      }
      const { value: legsValue, clamped: legsClamped } = clampFiveOhOneLegs(
        this.legsToWin,
      );
      this.legsToWin = legsValue;
      this.legsClampNotice = legsClamped ? FIVE_OH_ONE_LEGS_NOTICE : "";

      let startingScore: number;
      if (this.startingScoreOption === "CUSTOM") {
        const { value: scoreValue, clamped: scoreClamped } =
          clampFiveOhOneStartingScore(this.startingScoreValue);
        this.startingScoreValue = scoreValue;
        this.scoreClampNotice = scoreClamped
          ? FIVE_OH_ONE_STARTING_SCORE_NOTICE
          : "";
        startingScore = scoreValue;
      } else {
        startingScore = Number(this.startingScoreOption);
        this.scoreClampNotice = "";
      }

      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          legs_to_win: legsValue,
          starting_score: startingScore,
        };
        const configSnapshot = toSnapshot(RULESET_VERSION_KEY, wire);
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
            overrides: {
              legs_to_win: legsValue,
              starting_score: startingScore,
            },
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
        globalThis.location.href = "/games/501/play";
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

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-setup.data.test.ts`
Expected: PASS — 17 tests

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/five-oh-one-setup.data.ts app/tests/lib/game/five-oh-one-setup.data.test.ts
git commit -m "Add starting-score state and widen 501 setup overrides to include starting_score"
```

---

## Task 3: Setup form UI — reuse Score Training's setup components

**Files:**
- Delete: `app/src/components/layout/games/FiveOhOneSetupForm.astro`
- Create: `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro`
- Modify: `app/src/pages/games/501/setup/index.astro`

**Interfaces:**
- Consumes: `startingScoreOption`, `startingScoreValue`, `scoreClampNotice`, `legsToWin`, `legsClampNotice`, `error`, `loading`, `start()` from the `fiveOhOneSetup()` Alpine context (Task 2); `SetupShell`, `SettingSectionShell`, `UserSection`, `Toggle` (all `components/layout/games/setup/`), `InfoSection` (`components/ui/`), `Input` (`components/forms/`) — all pre-existing, no signature changes
- Produces: no props — the page mounts `<FiveOhOneSetupForm />` bare, matching `<ScoreTrainingSetupForm />`

- [ ] **Step 1: Create the new form file**

Create `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro`:

```astro
---
// Components
import Input from "@components/forms/Input.astro";
import Toggle from "./Toggle.astro";
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import SettingSectionShell from "./SettingSectionShell.astro";
import UserSection from "./UserSection.astro";

// Data
const startingScoreOpts = [
  { value: "301", label: "301" },
  { value: "501", label: "501" },
  { value: "701", label: "701" },
  { value: "CUSTOM", label: "Custom" },
];

const infoSection = {
  title: "501 rules",
  description:
    "Race from your starting score down to exactly zero. Open in, double out — the finishing dart must land on a double. First to the chosen number of legs wins the match.",
};
---

<SetupShell title="501">
  <UserSection />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
  <SettingSectionShell>
    <Toggle
      orientation="horizontal"
      options={startingScoreOpts}
      x-model="startingScoreOption"
      class="w-full"
    />
    <Input
      id="startingScoreValue"
      name="startingScoreValue"
      type="text"
      inputmode="numeric"
      placeholder="Starting score"
      x-model.number="startingScoreValue"
      @input="scoreClampNotice = ''"
      x-show="startingScoreOption === 'CUSTOM'"
      x-cloak
      class="glass border-tab-border rounded-full! mt-4"
    />
    <p
      class="text-sm text-muted-foreground px-4 py-0"
      role="status"
      x-show="scoreClampNotice"
      x-text="scoreClampNotice"
      x-cloak
    >
    </p>
    <Input
      id="legsToWin"
      name="legsToWin"
      type="text"
      inputmode="numeric"
      placeholder="First to"
      x-model.number="legsToWin"
      @input="legsClampNotice = ''"
      class="glass border-tab-border rounded-full! mt-4"
    />
    <label
      for="legsToWin"
      class="text-xs text-muted-foreground px-4 py-0 italic"
    >
      Legs
    </label>
    <p
      class="text-sm text-muted-foreground px-4 py-0"
      role="status"
      x-show="legsClampNotice"
      x-text="legsClampNotice"
      x-cloak
    >
    </p>
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

- [ ] **Step 2: Delete the old form file**

```bash
git rm app/src/components/layout/games/FiveOhOneSetupForm.astro
```

- [ ] **Step 3: Update the setup page**

In `app/src/pages/games/501/setup/index.astro`, change the import and the call site.

Replace:

```astro
import FiveOhOneSetupForm from "@components/layout/games/FiveOhOneSetupForm.astro";
```

with:

```astro
import FiveOhOneSetupForm from "@components/layout/games/setup/FiveOhOneSetupForm.astro";
```

Replace:

```astro
      <FiveOhOneSetupForm
        title="501"
        description="Confirm the format and set your legs, then let's play."
      />
```

with:

```astro
      <FiveOhOneSetupForm />
```

- [ ] **Step 4: Verify the build**

Run: `cd app && npx astro check`
Expected: `0 errors, 0 warnings, 0 hints`

- [ ] **Step 5: Verify the gates that touch `.astro` conventions**

Run: `bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-file-locations.sh`
Expected: all three PASS

- [ ] **Step 6: Manual verification in the dev server**

```bash
cd app && astro dev --background
```

Visit `/games/501/setup`, confirm:
- Starting score toggle shows 301 / 501 / 701 / Custom, 501 selected by default
- Selecting Custom reveals a numeric input defaulting to 101
- The "First to" input and its "Legs" hint render below, matching Score Training's duration-input styling
- No locked-settings card remains

```bash
astro dev stop
```

- [ ] **Step 7: Commit**

```bash
git add app/src/components/layout/games/setup/FiveOhOneSetupForm.astro app/src/pages/games/501/setup/index.astro
git commit -m "Rebuild 501 setup form on Score Training's shared setup components"
```

---

## Task 4: Play-page stat tile reorder and relabel

**Files:**
- Modify: `app/src/components/layout/games/interfaces/FiveOhOne.astro`

**Interfaces:**
- Consumes: `dartsThrownThisLeg()`, `average()`, `previousScore()` from `FiveOhOnePlayContext` (`five-oh-one-play.data.ts`) — unchanged signatures, this task only reorders/relabels the `StatRow`s that call them

- [ ] **Step 1: Reorder and relabel the StatRows**

In `app/src/components/layout/games/interfaces/FiveOhOne.astro`, replace:

```astro
      <dl class="w-full space-y-1">
        <StatRow
          label="Darts"
          value="dartsThrownThisLeg()"
        />
        <StatRow
          label="Average"
          value="average()"
        />
        <StatRow
          label="Previous"
          value="previousScore()"
        />
      </dl>
```

with:

```astro
      <dl class="w-full space-y-1">
        <StatRow
          label="3 dart avg"
          value="average()"
        />
        <StatRow
          label="Previous score"
          value="previousScore()"
        />
        <StatRow
          label="Darts"
          value="dartsThrownThisLeg()"
        />
      </dl>
```

- [ ] **Step 2: Verify the build**

Run: `cd app && npx astro check`
Expected: `0 errors, 0 warnings, 0 hints`

- [ ] **Step 3: Manual verification in the dev server**

```bash
cd app && astro dev --background
```

Start a 501 session from `/games/501/setup`, confirm the play screen shows the stats top-to-bottom as **3 dart avg → Previous score → Darts**.

```bash
astro dev stop
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/layout/games/interfaces/FiveOhOne.astro
git commit -m "Reorder and relabel 501 play-page stat tiles: 3 dart avg, previous score, darts"
```

---

## Task 5: Validation, formatting, and context maintenance

**Files:** none new — repo-wide verification only

- [ ] **Step 1: Run the full app validation sequence**

Follow the `validate-app` skill's procedure:

```bash
npm run validate:app
```

Expected: all checks pass (db:status, db:migrate, db:introspect, fallow, full test suite, `astro check`, graph refresh warning-only if the local `graphify` CLI is absent).

- [ ] **Step 2: Run the mechanical gates this plan's changes touch**

```bash
bash scripts/check-file-locations.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-style-tokens.sh
bash scripts/check-alias-sync.sh
bash scripts/check-no-inline-comments.sh
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
```

Expected: all PASS. If `run-all-gates` skill is available, invoke it instead to dispatch the correct set automatically.

- [ ] **Step 3: Format**

```bash
cd app && npm run format
npm run format:check
```

Expected: `format:check` clean; commit any formatting diff produced by `format`.

- [ ] **Step 4: Context maintenance**

Invoke the `context-maintenance` skill. Expect it to:
- Register the new file `app/src/lib/game/five-oh-one-starting-score.ts` and the moved `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro` in `docs/architecture/00-Context-Map.md`'s File Inventory, bump the map version and changelog entry
- Update `docs/game-rules/rulesets/501.md` in three places — flipping only the Features row leaves the other two internally contradicting it:
  - Line 13, Features table: flip `Alternate start scores (301, 701, …)` from `TBD` to `v1`
  - Line 35, Identity: replace `Sibling start scores (301, 701) and alternate in/out rules exist as later variants.` with `Sibling start scores (301, 701, or a custom 2–999 value) are selectable at setup; alternate in/out rules exist as later variants.`
  - Line 49, Config & presets (V1) table: replace the `Start score | 501 | Shown, locked` row with `Start score | 501 default; 301 / 701 / custom (2–999) | Editable`
  - Line 81, Later versions (V2+) → Variants: delete the `**Start score:** other X01 values such as **301** and **701** (same rules as 501, different starting total)` bullet — it now ships in V1, not V2+
- Decide whether a `decisions/**` entry is warranted (e.g. component-reuse precedent for a second setup form) and append one if so, per `DECISIONS.md`'s routing table — never edit an existing block
- Run `scripts/check-context-map.sh`, `scripts/check-doc-links.sh`, `scripts/check-context-budget.sh`, `scripts/check-decision-ids.sh` and confirm all pass

- [ ] **Step 5: Confirm branch state**

```bash
git status
git log --oneline -8
```

Expected: working tree clean, all task commits present, branch `claude/501-config-planning-5ifo8g` unpushed changes ready for push per the user's workflow.
