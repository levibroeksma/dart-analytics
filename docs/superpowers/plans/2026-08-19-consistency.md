<!--
status: canonical
scope: implementation plan — preset setup factory, three-dart validator builder, adding-a-game exemplar, wiring gate
read-when: executing the consistency spec (Spec 3 of 3)
updated: 2026-08-19
-->

# Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "one shape per game" a thing that is written down once, extracted once, and mechanically held — instead of a shape reproduced by copying whichever game the last agent happened to open.

**Architecture:** Two behaviour-preserving extractions (`lib/game/setup-controller.ts` absorbing the 157-line preset setup skeleton six games repeat; `services/rulesets/three-dart.validator.ts` absorbing the shared assertions five validators repeat), one exemplar doc (`07-Frontend/09-Adding-A-Game.md`) carrying the 25-file touch list, and one new gate (`scripts/check-game-wiring.sh`, gate 17) holding the six shared registries a half-wired game falls through. Plus the closure of finding `F2`, by explicit user permission.

**Tech Stack:** TypeScript, Alpine.js (`Alpine.data` controllers), Zod, Vitest, Astro; Bash + `python3` heredoc gate scripts; Markdown.

**Source spec:** `docs/superpowers/specs/2026-08-19-consistency-design.md`

## Global Constraints

- Branch: `claude/consistency-spec3`, already checked out, carrying the design-doc commit. Do **not** create a worktree (root `CLAUDE.md`: "No git worktrees"). Do not open a PR unless the user asks.
- Today's date for every ISO stamp in this plan: `2026-08-19`.
- Next decision id is **D215** (derived max across `decisions/**` is `D214`). It is appended at the **end** of `decisions/frontend/architecture.md`. Decisions are append-only: never edit or delete an existing block.
- **`F2` is the only finding this branch touches.** `F1`, `F3`–`F6` stay open and untouched. Anything new noticed while executing is appended to `FINDINGS.md` as a new `F` entry (ids from the `highest-issued:` high-water mark, currently `F6`), never fixed.
- **The 819 existing tests are the proof.** Both extractions are behaviour-preserving. `app/tests/lib/game/*-setup.data.test.ts` and `app/tests/services/rulesets/**` must stay green **unmodified**. If a test needs editing to accommodate an extraction, the extraction is wrong — change the extraction, not the test. (Root `CLAUDE.md`: a test re-pointed so it keeps passing is a failure to detect.)
- No `//` or non-JSDoc `/* */` comments inside function bodies under `app/src/**/*.ts` (`scripts/check-no-inline-comments.sh`). Detail goes in a `/** */` block above the declaration.
- Types go in the folder's `types.ts` barrel, never inline in an implementation file (`scripts/check-type-barrels.sh`, D103/D115). **`interface` declarations may not live in `types.ts`** — they belong to the parallel `interfaces.ts` chain. This constrains Task 1; see its note.
- Never modify applied migrations (`0001`–`0022`). Never commit secrets.
- No model identifier in any commit message, code comment, or file content.
- Gate scripts print `OK: …` on stdout and `FAIL: …` on stderr, exit 1 if any check failed, and take an optional path argument so the gate can be aimed at a fixture and proven to bite. Copy `scripts/check-findings-log.sh`'s conventions.
- Run `cd app && npm run format` before any commit that touches `app/`, and confirm `npm run format:check` is clean.

## Three corrections to the design doc, verified against the repo

The design was written from measurement, but three of its details do not survive contact with the compiler. **The plan is authority where they differ; do not "fix" the plan back toward the spec.**

1. **§2's `PresetSetupContext<Self>` does not compile as written.** `export type Bobs27SetupContext = PresetSetupContext<Bobs27SetupContext>;` is rejected: `error TS2456: Type alias 'Bobs27SetupContext' circularly references itself` (verified with `tsc --strict`). The `interface X extends PresetSetupContext<X> {}` form does compile — but interfaces may not live in `types.ts`, and moving the six contexts to `interfaces.ts` would force an import-path edit in every test, which the "tests stay green unmodified" rule forbids. **Task 1 uses a non-generic `PresetSetupContext` instead**, with the self-type parameter kept only where it earns its keep: on the factory (`Ctx extends PresetSetupContext`), so `configOverrides` can see `orderMode`. Verified to compile.
2. **§1 puts `overrides` in the wrong call.** The training games pass `overrides` inside `createSession({ config: { source, templateRef, overrides } })` — **not** to `startSessionInput`, whose parameter type (`session-mode-resolution.ts:47`) declares no such field. Task 2 follows the code.
3. **§3's `createThreeDartValidator({ label, configSchema })` is one field short.** The five validators' dartless-turn message has three distinct bodies, not one: Around the Clock's names the two mode pairs (a BULL hit can legitimately end a visit early), Doubles Training's says "carries at least one dart", the other three say "is exactly 3 darts". A default would silently reword two shipped API messages. Task 5 takes a **required** `dartlessIssue` third field so each game keeps its exact string; the prose is game-specific fact, which is what the builder is supposed to keep.

4. **The design's touch list is 25 files; the measured number is 26, and two of its rows name the wrong files.** Re-measured with `grep -rl` over `app/src`, `app/tests` and `database`, then hand-filtered: Shanghai touches **26 files across 9 trees**. The spec's list omits `app/src/components/layout/games/interfaces/Shanghai.astro` (the filename carries the game's name; the file body does not, so a content grep misses it), and its "two shared registry suites" are `engine.registry.test.ts` / `registry.test.ts` — neither of which mentions any game. The two shared suites that really need a per-game edit are `app/tests/lib/game/rulesets/capabilities.test.ts` and `games-visibility.test.ts`. Task 9 ships the measured list.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `app/src/lib/game/types.ts` (modify) | `PresetSetupContext` base + `PresetSetupControllerOptions<Ctx>`; the six cloned contexts become aliases |
| `app/src/lib/game/setup-controller.ts` (new) | `createPresetSetupController` — the whole preset setup skeleton, one seam |
| `app/src/lib/game/<game>-setup.data.ts` (modify ×6) | Each becomes a factory call plus whatever extra state its form binds |
| `app/src/services/rulesets/three-dart.validator.ts` (new) | `createThreeDartValidator` — the shared three-dart assertions |
| `app/src/services/rulesets/<game>/<game>.validator.ts` (modify ×5) | Each becomes a builder call, keeping its own export name |
| `app/tests/lib/game/setup-controller.test.ts` (new) | The factory's own tests, incl. the `configOverrides` seam |
| `app/tests/services/rulesets/three-dart.validator.test.ts` (new) | The builder's own tests |
| `scripts/check-game-wiring.sh` (new) | Gate 17 — the six shared registries, checked against each other |
| `.husky/pre-commit`, `.github/workflows/quality.yml`, `.claude/skills/run-all-gates/SKILL.md`, `app/CLAUDE.md` (modify) | Wire gate 17 (12 → 13 pre-commit, 16 → 17 in CI `structure`) |
| `docs/architecture/07-Frontend/09-Adding-A-Game.md` (new) | The exemplar: touch list, reference game, opt-outs, slug rule, engine-only rows |
| `docs/architecture/00-Context-Map.md` (modify) | "New game (full stack)" pack points at the exemplar instead of carrying the fan-out inline |
| `docs/architecture/00-File-Inventory.md` (modify) | Rows for the two new source files, two new test files, the exemplar and the gate |
| `CLAUDE.md`, `FINDINGS.md` (modify) | F2: Knowledge Graph section reworded; `F2` block deleted |
| `decisions/frontend/architecture.md` (modify) | D215, appended at end |
| `docs/architecture/00-Context-Map-History.md` (modify) | 1.10.0 entry + this plan/spec's task rows |

---

## Task 0: Record the baseline

Not a code change. The number every later task is measured against.

- [ ] **Step 1: Capture the baseline test counts**

```bash
npx vitest run tests/lib/game tests/services/rulesets 2>&1 | tail -5
```

Expected: `Test Files  52 passed (52)` and `Tests  819 passed (819)`.

Write the two numbers down. If they differ from 52/819, use what you observe as the baseline and say so in the completion report — do not adjust anything to reach 52/819.

- [ ] **Step 2: Capture the baseline line counts**

```bash
cd /home/user/dart-analytics/app/src && wc -l lib/game/{bobs27,shanghai,around-the-clock,one-twenty-one,singles-training,doubles-training}-setup.data.ts | tail -1
wc -l services/rulesets/{shanghai/shanghai,bobs27/bobs27,singles-training/singles-training,doubles-training/doubles-training,around-the-clock/around-the-clock}.validator.ts | tail -1
```

Expected: `961 total` and `749 total`. These are the figures the completion report's line-count delta is computed against.

- [ ] **Step 3: Capture the duplication baseline**

```bash
cd /home/user/dart-analytics/app && npx fallow 2>&1 | tail -20
```

Record the duplication percentage and the exit code. Both extractions should move it **down**; the CI "Stale-usage gate" runs this as a hard pass/fail (D209).

---

## Task 1: The shared setup-context type

Types only. No runtime change, so the whole suite must stay green on a pure type edit — which is the point: it proves the six contexts really were the same type.

**Files:**
- Modify: `app/src/lib/game/types.ts` — the six `<Game>SetupContext` blocks (`Bobs27SetupContext` ~line 277, `SinglesTrainingSetupContext` ~line 307, `DoublesTrainingSetupContext` ~line 556, `ShanghaiSetupContext` ~line 587, `OneTwentyOneSetupContext` ~line 617, `AroundTheClockSetupContext` ~line 647)
- Test: no new test file — `npm run check` plus the existing suites are the verification.

**Interfaces:**
- Consumes: nothing.
- Produces: `PresetSetupContext` (non-generic object type) and `PresetSetupControllerOptions<Ctx>` in `@lib/types`. Task 2 imports both. `Bobs27SetupContext`, `ShanghaiSetupContext`, `OneTwentyOneSetupContext`, `AroundTheClockSetupContext` become bare aliases of `PresetSetupContext`; `SinglesTrainingSetupContext` and `DoublesTrainingSetupContext` become `PresetSetupContext & { orderMode: TargetOrderMode }`. Every existing import path (`import type { Bobs27SetupContext } from "@lib/types"`) keeps working unchanged — that is a hard requirement, because the tests use it.

**Why not the generic self-type the spec described:** see "Three corrections" above. `type X = PresetSetupContext<X>` is `TS2456`.

- [ ] **Step 1: Add the base type and the options type**

Insert this immediately **above** the existing `export type Bobs27SetupContext = {` block in `app/src/lib/game/types.ts`:

```ts
/**
 * The setup-page contract every preset-driven game shares. Six games declare
 * exactly this shape (Bob's 27, Shanghai, 121, Around the Clock, and — plus
 * an `orderMode` field — Singles and Doubles Training), which is why
 * `createPresetSetupController` can serve all six from one implementation.
 *
 * `501` and Score Training deliberately keep hand-written contexts: both
 * replace `start` wholesale (preset selection, leg counts, a clamped custom
 * starting score), so routing them through the factory would need one hook
 * per branch. See `docs/architecture/07-Frontend/09-Adding-A-Game.md`.
 *
 * The `this` parameters name this base type rather than a self-type
 * parameter: `type X = PresetSetupContext<X>` is rejected by TypeScript
 * (TS2456, circular type alias), and the `interface X extends …` form that
 * would compile may not live in `types.ts` (D103 — interfaces raise through
 * the parallel `interfaces.ts` chain). No method body needs the concrete
 * type; only `configOverrides` does, and it takes it as a generic parameter.
 */
export type PresetSetupContext = {
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
  init(this: PresetSetupContext): Promise<void>;
  reconcile(
    this: PresetSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: PresetSetupContext): Promise<void>;
  continueSession(this: PresetSetupContext): void;
  abandonSession(this: PresetSetupContext): Promise<void>;
  start(this: PresetSetupContext): Promise<void>;
};

/**
 * What `createPresetSetupController` needs to know about one game. Everything
 * here is a fact about the game and nothing here is a behaviour switch — the
 * single exception, `configOverrides`, exists because Singles and Doubles
 * Training inject their chosen target order into both the config snapshot and
 * the create-session overrides, and nothing else in the six deviates at all.
 *
 * `label` is not derived from a key. The shipped copy reads `Bob's 27`, not
 * `BOBS27`, and a derivation would silently reword a user-visible message.
 */
export type PresetSetupControllerOptions<Ctx extends PresetSetupContext> = {
  gameTypeKey: string;
  rulesetVersionKey: RulesetVersionKey;
  playHref: string;
  label: string;
  configOverrides?: (ctx: Ctx) => Record<string, unknown>;
};
```

If `RulesetVersionKey` is not already imported in `types.ts`, add it to the existing `import type { … } from "@lib/types"`-style import at the top of the file rather than creating a second import statement. Check first:

```bash
grep -n "RulesetVersionKey" app/src/lib/game/types.ts | head -3
```

- [ ] **Step 2: Replace the six cloned context blocks with aliases**

Delete each of the six `export type <Game>SetupContext = { … };` blocks in full and put these in their places (keep each alias at its original position in the file, so the diff stays readable and the surrounding play-context types are untouched):

```ts
export type Bobs27SetupContext = PresetSetupContext;
```

```ts
export type SinglesTrainingSetupContext = PresetSetupContext & {
  orderMode: TargetOrderMode;
};
```

```ts
export type DoublesTrainingSetupContext = PresetSetupContext & {
  orderMode: TargetOrderMode;
};
```

```ts
export type ShanghaiSetupContext = PresetSetupContext;
```

```ts
export type OneTwentyOneSetupContext = PresetSetupContext;
```

```ts
export type AroundTheClockSetupContext = PresetSetupContext;
```

Do **not** touch `ScoreTrainingSetupContext` (~line 194) or `FiveOhOneSetupContext` (~line 241). They stay hand-written, matching their opted-out controllers.

- [ ] **Step 3: Type-check**

```bash
cd /home/user/dart-analytics/app && npm run check
```

Expected: `0 errors`. A `TS2456` here means someone reintroduced the self-type parameter — go back to Step 1.

- [ ] **Step 4: Run the suites the type touches**

```bash
cd /home/user/dart-analytics/app && npx vitest run tests/lib/game
```

Expected: all pass, **no test file edited**. This is a type-only change; a failure here means a context lost a field.

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics/app && npm run format && cd ..
git add app/src/lib/game/types.ts
git commit -m "refactor(types): six setup contexts collapse onto one PresetSetupContext

The six were byte-identical but for the self-type. Score Training and 501
keep their hand-written contexts, matching their opted-out controllers."
```

---

## Task 2: The preset setup factory

The extraction itself, with its own tests. No adopters yet — the six data files still hold their own copies after this task, so the suite proves the factory in isolation before anything depends on it.

**Files:**
- Create: `app/src/lib/game/setup-controller.ts`
- Create: `app/tests/lib/game/setup-controller.test.ts`

**Interfaces:**
- Consumes: `PresetSetupContext`, `PresetSetupControllerOptions<Ctx>` from Task 1 (`@lib/types`).
- Produces: `createPresetSetupController<Ctx extends PresetSetupContext>(options: PresetSetupControllerOptions<Ctx>)`, returning the controller object literal. Tasks 3 and 4 call it.

**The one behavioural subtlety, stated so nobody "simplifies" it away:** when `configOverrides` is absent the factory must pass `preset.configuration` to `toSnapshot` **by reference** and omit the `overrides` key from `createSession`'s `config` entirely — not pass `{ ...preset.configuration }` and `overrides: undefined`. Four of the six games send exactly that shape today; spreading into a fresh object or adding an undefined key is a wire-format change, however invisible it looks.

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/game/setup-controller.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { PresetSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const PRESET = {
  configurationTemplateId: "tmpl-1",
  gameTypeKey: "SHANGHAI",
  name: "Shanghai — Standard",
  description: null,
  configuration: { rounds: 20 },
  isSystemTemplate: true,
} as any;

const SESSION = {
  sessionId: "sess-1",
  participants: [{ ref: "p1" }],
} as any;

type OrderCtx = PresetSetupContext & { orderMode: string };

describe("createPresetSetupController", () => {
  let store: PresetSetupContext["$store"];

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
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });

  function plain(): PresetSetupContext {
    return {
      ...createPresetSetupController<PresetSetupContext>({
        gameTypeKey: "SHANGHAI",
        rulesetVersionKey: "SHANGHAI_V1",
        playHref: "/games/shanghai/play",
        label: "Shanghai",
      }),
      $store: store,
    } as PresetSetupContext;
  }

  function withOverrides(): OrderCtx {
    return {
      ...createPresetSetupController<OrderCtx>({
        gameTypeKey: "SINGLES_TRAINING",
        rulesetVersionKey: "SINGLES_V1",
        playHref: "/games/singles-training/play",
        label: "Singles Training",
        configOverrides: (ctx) => ({ order_mode: ctx.orderMode }),
      }),
      orderMode: "HIGH_TO_LOW",
      $store: store,
    } as OrderCtx;
  }

  it("loads presets for its own game type", async () => {
    const setup = plain();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([PRESET]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

    await setup.init();

    expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith(
      "SHANGHAI",
    );
    expect(setup.presets).toEqual([PRESET]);
    expect(setup.loadingReconciliation).toBe(false);
  });

  it("names the game in the missing-preset error, using label verbatim", async () => {
    const setup = plain();
    setup.presets = [];

    await setup.start();

    expect(setup.error).toBe("Could not find a preset for Shanghai.");
    expect(sessionsApi.createSession).not.toHaveBeenCalled();
  });

  it("navigates to its own play route on a successful start", async () => {
    const setup = plain();
    setup.presets = [PRESET];
    vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

    await setup.start();

    expect(globalThis.location.href).toBe("/games/shanghai/play");
    expect(store.game.startSession).toHaveBeenCalledTimes(1);
  });

  it("omits the overrides key entirely when no configOverrides hook is given", async () => {
    const setup = plain();
    setup.presets = [PRESET];
    vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

    await setup.start();

    const body = vi.mocked(sessionsApi.createSession).mock.calls[0][0];
    expect(body.config).toEqual({
      source: "template",
      templateRef: "tmpl-1",
    });
    expect("overrides" in (body.config as object)).toBe(false);
  });

  it("sends the hook's fields as createSession overrides when one is given", async () => {
    const setup = withOverrides();
    setup.presets = [PRESET];
    vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

    await setup.start();

    const body = vi.mocked(sessionsApi.createSession).mock.calls[0][0];
    expect(body.config).toEqual({
      source: "template",
      templateRef: "tmpl-1",
      overrides: { order_mode: "HIGH_TO_LOW" },
    });
  });

  it("retries reconciliation instead of erroring on SESSION_ALREADY_ACTIVE", async () => {
    const setup = plain();
    setup.presets = [PRESET];
    vi.mocked(sessionsApi.createSession).mockRejectedValue(
      Object.assign(new Error("active"), { code: "SESSION_ALREADY_ACTIVE" }),
    );
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

    await setup.start();

    expect(sessionsApi.fetchActiveSessions).toHaveBeenCalled();
    expect(setup.error).toBe("");
  });

  it("clears the modal and abandons an active session", async () => {
    const setup = plain();
    setup.activeSession = { sessionId: "sess-old" } as any;
    setup.showActiveSessionModal = true;
    vi.mocked(sessionsApi.completeSession).mockResolvedValue(undefined as any);

    await setup.abandonSession();

    expect(sessionsApi.completeSession).toHaveBeenCalledWith(
      "sess-old",
      "ABANDONED",
    );
    expect(store.game.reset).toHaveBeenCalled();
    expect(setup.showActiveSessionModal).toBe(false);
    expect(setup.activeSession).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /home/user/dart-analytics/app && npx vitest run tests/lib/game/setup-controller.test.ts
```

Expected: FAIL — `Failed to resolve import "@lib/game/setup-controller"`. Every test errors; nothing passes.

- [ ] **Step 3: Write the factory**

Create `app/src/lib/game/setup-controller.ts`:

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
import type {
  PresetSetupContext,
  PresetSetupControllerOptions,
} from "./types";

/**
 * The setup controller every preset-driven game shares: load the presets and
 * any active session, reconcile a recovered one, retry that reconciliation,
 * continue or abandon it, then start — create the session, snapshot the
 * config, push it into the game store and navigate to play.
 *
 * V1 seeds exactly one configuration preset per game; index 0 is always that
 * preset.
 *
 * Six games use this: Bob's 27, Shanghai, 121, Around the Clock, Singles
 * Training and Doubles Training. `501` and Score Training deliberately do
 * not — both replace `start` wholesale, and routing them through here would
 * need one hook per branch, which is the factory dissolving into its callers.
 * The touch list and the reasoning live in
 * `docs/architecture/07-Frontend/09-Adding-A-Game.md`.
 */
export function createPresetSetupController<
  Ctx extends PresetSetupContext,
>(options: PresetSetupControllerOptions<Ctx>) {
  const { gameTypeKey, rulesetVersionKey, playHref, label, configOverrides } =
    options;

  return {
    presets: [] as ConfigurationPresetData[],
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: Ctx) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(gameTypeKey),
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

    async reconcile(this: Ctx, activeSessions: SessionActiveData[]) {
      const result = await reconcileActiveSession(
        gameTypeKey,
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

    async retryReconciliation(this: Ctx) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: Ctx) {
      this.showActiveSessionModal = false;
      globalThis.location.href = playHref;
    },

    async abandonSession(this: Ctx) {
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

    async start(this: Ctx) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = `Could not find a preset for ${label}.`;
        return;
      }

      const overrides = configOverrides?.(this);

      this.loading = true;
      this.error = "";
      try {
        const configSnapshot = toSnapshot(
          rulesetVersionKey,
          overrides
            ? {
                ...(preset.configuration as Record<string, unknown>),
                ...overrides,
              }
            : preset.configuration,
        );
        const modePair = resolveSessionModePair(
          rulesetVersionKey,
          this.$store.settings,
        );
        const session = await createSession({
          gameTypeKey,
          rulesetVersionKey,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            ...(overrides ? { overrides } : {}),
          },
        });
        this.$store.game.startSession(
          startSessionInput({
            gameTypeKey,
            rulesetVersionKey,
            session,
            templateRef: preset.configurationTemplateId,
            configSnapshot,
            modePair,
          }),
        );
        globalThis.location.href = playHref;
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

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /home/user/dart-analytics/app && npx vitest run tests/lib/game/setup-controller.test.ts && npm run check
```

Expected: all 7 tests pass; `npm run check` reports 0 errors.

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics/app && npm run format && cd ..
git add app/src/lib/game/setup-controller.ts app/tests/lib/game/setup-controller.test.ts
git commit -m "feat(setup): extract createPresetSetupController

One seam only — configOverrides, for the two training games' target order.
No adopters yet; the six data files still hold their own copies."
```

---

## Task 3: The four plain adopters

Bob's 27, Shanghai, 121 and Around the Clock — the four that differ from each other in nothing but a name, two keys and a route.

**Files:**
- Modify: `app/src/lib/game/bobs27-setup.data.ts` (157 lines → 8)
- Modify: `app/src/lib/game/shanghai-setup.data.ts`
- Modify: `app/src/lib/game/one-twenty-one-setup.data.ts`
- Modify: `app/src/lib/game/around-the-clock-setup.data.ts`
- Test: `app/tests/lib/game/{bobs27,shanghai,one-twenty-one,around-the-clock}-setup.data.test.ts` — existing, **unmodified**

**Interfaces:**
- Consumes: `createPresetSetupController` (Task 2), the four context aliases (Task 1).
- Produces: `bobs27Setup()`, `shanghaiSetup()`, `oneTwentyOneSetup()`, `aroundTheClockSetup()` — same export names, same call signature, same returned shape. Nothing downstream changes: `register-route-data.ts` and every page keep their existing imports.

**The four constant sets, copied from the files being replaced.** Do not derive any of these; a derivation that produces the right string today is a rule that will produce the wrong one for game nine.

| File | `gameTypeKey` | `rulesetVersionKey` | `playHref` | `label` |
| ---- | ------------- | ------------------- | ---------- | ------- |
| `bobs27-setup.data.ts` | `BOBS27` | `BOBS27_V1` | `/games/bobs27/play` | `Bob's 27` |
| `shanghai-setup.data.ts` | `SHANGHAI` | `SHANGHAI_V1` | `/games/shanghai/play` | `Shanghai` |
| `one-twenty-one-setup.data.ts` | `ONE_TWENTY_ONE` | `121_V1` | `/games/121/play` | `121` |
| `around-the-clock-setup.data.ts` | `AROUND_THE_CLOCK` | `AROUND_THE_CLOCK_V1` | `/games/around-the-clock/play` | `Around the Clock` |

Note row 3: the code slug is `one-twenty-one`, the ruleset key is `"121_V1"` (quoted — a TypeScript identifier cannot start with a digit) and the route is `/games/121/play`. All three differ on purpose.

- [ ] **Step 1: Replace `bobs27-setup.data.ts` in full**

```ts
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { Bobs27SetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function bobs27Setup() {
  return createPresetSetupController<Bobs27SetupContext>({
    gameTypeKey: "BOBS27",
    rulesetVersionKey: "BOBS27_V1",
    playHref: "/games/bobs27/play",
    label: "Bob's 27",
  });
}
```

- [ ] **Step 2: Run Bob's 27's existing suite unmodified**

```bash
cd /home/user/dart-analytics/app && npx vitest run tests/lib/game/bobs27-setup.data.test.ts
```

Expected: PASS, with zero edits to the test file. If anything fails, fix `setup-controller.ts` — never the test. Confirm the test file is untouched:

```bash
cd /home/user/dart-analytics && git diff --name-only app/tests/
```

Expected: empty output.

- [ ] **Step 3: Replace the other three**

`app/src/lib/game/shanghai-setup.data.ts`:

```ts
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { ShanghaiSetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function shanghaiSetup() {
  return createPresetSetupController<ShanghaiSetupContext>({
    gameTypeKey: "SHANGHAI",
    rulesetVersionKey: "SHANGHAI_V1",
    playHref: "/games/shanghai/play",
    label: "Shanghai",
  });
}
```

`app/src/lib/game/one-twenty-one-setup.data.ts`:

```ts
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { OneTwentyOneSetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function oneTwentyOneSetup() {
  return createPresetSetupController<OneTwentyOneSetupContext>({
    gameTypeKey: "ONE_TWENTY_ONE",
    rulesetVersionKey: "121_V1",
    playHref: "/games/121/play",
    label: "121",
  });
}
```

`app/src/lib/game/around-the-clock-setup.data.ts`:

```ts
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { AroundTheClockSetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function aroundTheClockSetup() {
  return createPresetSetupController<AroundTheClockSetupContext>({
    gameTypeKey: "AROUND_THE_CLOCK",
    rulesetVersionKey: "AROUND_THE_CLOCK_V1",
    playHref: "/games/around-the-clock/play",
    label: "Around the Clock",
  });
}
```

- [ ] **Step 4: Run all four suites plus the type check**

```bash
cd /home/user/dart-analytics/app && npx vitest run tests/lib/game && npm run check
```

Expected: every `tests/lib/game` file passes, 0 type errors, and `git diff --name-only app/tests/` still prints nothing but the new `setup-controller.test.ts`.

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics/app && npm run format && cd ..
git add app/src/lib/game/{bobs27,shanghai,one-twenty-one,around-the-clock}-setup.data.ts
git commit -m "refactor(setup): four games adopt createPresetSetupController

Each file is now four facts and a call. Their existing suites pass unedited."
```

---

## Task 4: The two training adopters

Singles and Doubles Training — the only two with a seam, and the reason the seam exists.

**Files:**
- Modify: `app/src/lib/game/singles-training-setup.data.ts`
- Modify: `app/src/lib/game/doubles-training-setup.data.ts`
- Test: `app/tests/lib/game/{singles,doubles}-training-setup.data.test.ts` — existing, **unmodified**

**Interfaces:**
- Consumes: `createPresetSetupController` (Task 2), `SinglesTrainingSetupContext` / `DoublesTrainingSetupContext` (Task 1), `targetOrderFor` (`@lib/game/target-order`, unchanged).
- Produces: `singlesTrainingSetup()`, `doublesTrainingSetup()` — same export names. Each returns the factory's object **spread into an object that adds `orderMode`**, because the setup form binds `x-model` to it.

**What the hook must return, exactly.** Today both games build the same two fields, in this order, and send them to two places:

```ts
const targetOrder = targetOrderFor(this.orderMode);
const wire = {
  ...(preset.configuration as Record<string, unknown>),
  order_mode: this.orderMode,
  target_order: targetOrder,
};
```

…and `createSession({ config: { …, overrides: { order_mode: this.orderMode, target_order: targetOrder } } })`. The factory spreads the hook's return into the wire config **and** sends it as `overrides`, so returning `{ order_mode, target_order }` reproduces both call sites at once.

- [ ] **Step 1: Replace `singles-training-setup.data.ts` in full**

```ts
import { createPresetSetupController } from "@lib/game/setup-controller";
import { targetOrderFor } from "@lib/game/target-order";
import type { SinglesTrainingSetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function singlesTrainingSetup() {
  return {
    orderMode: "LOW_TO_HIGH" as SinglesTrainingSetupContext["orderMode"],
    ...createPresetSetupController<SinglesTrainingSetupContext>({
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: "SINGLES_V1",
      playHref: "/games/singles-training/play",
      label: "Singles Training",
      configOverrides: (ctx) => ({
        order_mode: ctx.orderMode,
        target_order: targetOrderFor(ctx.orderMode),
      }),
    }),
  };
}
```

- [ ] **Step 2: Replace `doubles-training-setup.data.ts` in full**

```ts
import { createPresetSetupController } from "@lib/game/setup-controller";
import { targetOrderFor } from "@lib/game/target-order";
import type { DoublesTrainingSetupContext } from "./types";

export function doublesTrainingSetup() {
  return {
    orderMode: "LOW_TO_HIGH" as DoublesTrainingSetupContext["orderMode"],
    ...createPresetSetupController<DoublesTrainingSetupContext>({
      gameTypeKey: "DOUBLES_TRAINING",
      rulesetVersionKey: "DOUBLES_TRAINING_V1",
      playHref: "/games/doubles-training/play",
      label: "Doubles Training",
      configOverrides: (ctx) => ({
        order_mode: ctx.orderMode,
        target_order: targetOrderFor(ctx.orderMode),
      }),
    }),
  };
}
```

Note the missing JSDoc line on `doublesTrainingSetup`: `doubles-training-setup.data.ts` does not carry the "V1 seeds exactly one configuration preset" comment today (it is the one file in the six that lost it). Do not add it — that is a `FINDINGS.md` entry if you think it should be there, not a drive-by edit.

- [ ] **Step 3: Run both suites unmodified**

```bash
cd /home/user/dart-analytics/app && npx vitest run tests/lib/game/singles-training-setup.data.test.ts tests/lib/game/doubles-training-setup.data.test.ts
```

Expected: PASS. Watch specifically for the assertions on `createSession`'s `config.overrides` — those are the seam's real proof.

- [ ] **Step 4: Run the full suite and the type check**

```bash
cd /home/user/dart-analytics/app && npm test && npm run check
```

Expected: the full suite green (baseline count from Task 0, plus the new `setup-controller.test.ts` file and its 7 tests), 0 type errors.

- [ ] **Step 5: Confirm nothing under `app/tests/` was edited**

```bash
cd /home/user/dart-analytics && git status --short app/tests/
```

Expected: only `?? app/tests/lib/game/setup-controller.test.ts` if it is not yet committed, and nothing else. Any `M` line under `app/tests/` means the extraction changed behaviour — stop and fix the extraction.

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics/app && npm run format && cd ..
git add app/src/lib/game/{singles,doubles}-training-setup.data.ts
git commit -m "refactor(setup): training games adopt the factory via configOverrides

The one seam, used by the only two games that need it: order_mode and
target_order reach both the config snapshot and createSession's overrides."
```

---

## Task 5: The three-dart validator builder

**Files:**
- Create: `app/src/services/rulesets/three-dart.validator.ts`
- Modify: `app/src/services/rulesets/types.ts` — add `ThreeDartValidatorOptions` (types never live inline in an implementation file, D115)
- Create: `app/tests/services/rulesets/three-dart.validator.test.ts`

**Interfaces:**
- Consumes: `isVisualBoardCapture`, `validateVisualBoardTurns`, `VISUAL_BOARD_MODES` from `./visual-board.validator` (unchanged); `RulesetValidator` from `@services/interfaces`; `BatchValidationResult`, `ConfigValidationResult` from `@services/types`.
- Produces:
  - `createThreeDartValidator(options: ThreeDartValidatorOptions): RulesetValidator`
  - `DETAILED_DARTS_MODES: string` — the `"RECREATIONAL + DETAILED_DARTS"` string, exported because Around the Clock's dartless message interpolates it (Task 6).
  - `ThreeDartValidatorOptions = { label: string; configSchema: ZodTypeAny; dartlessIssue: (clientKey: string) => string }` in `@services/types`.

**Why `dartlessIssue` is required, not defaulted:** the five games ship three different message bodies (see "Three corrections" above). A default would silently reword two of them, and these strings cross the API boundary to the client. Required means the fact stays where the fact is.

**Why `ZodTypeAny` and not a narrower schema type:** the five schemas infer different output types, and `ConfigValidationResult.config` is `Record<string, unknown>`. `ZodTypeAny` makes `parsed.data` `any` at exactly the one assignment where today's five hand-written files already assign an inferred type into that field — the typing is no looser than what it replaces, and each schema is still exercised by its own game's tests. Verified to compile with `tsc --strict` against zod 3.25.

- [ ] **Step 1: Write the failing test**

Create `app/tests/services/rulesets/three-dart.validator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createThreeDartValidator } from "@services/rulesets/three-dart.validator";
import type { DartFactInput } from "@routes/types";

const TestConfig = z.object({ rounds: z.number() }).strict();

const validator = createThreeDartValidator({
  label: "Test Game",
  configSchema: TestConfig,
  dartlessIssue: (clientKey) => `turn ${clientKey} needs darts`,
});

const hitDart: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 1,
  hitZoneKey: "SINGLE",
  score: 1,
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
          totalScore: turnDarts.reduce((total, dart) => total + dart.score, 0),
          completedAt: null,
          darts: turnDarts,
        })),
      },
    ],
  };
}

describe("createThreeDartValidator — validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS", () => {
    const result = validator.validateConfig({
      config: { rounds: 20 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts ANALYTICS + VISUAL_BOARD", () => {
    const result = validator.validateConfig({
      config: { rounds: 20 },
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });

  it("names the label in the rejection for an unsupported mode pair", () => {
    const result = validator.validateConfig({
      config: { rounds: 20 },
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
    expect(JSON.stringify(result)).toContain("Test Game V1 only supports");
  });

  it("runs the caller's own schema, strictness included", () => {
    const result = validator.validateConfig({
      config: { rounds: 20, extra: true },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("createThreeDartValidator — validateBatch", () => {
  it("accepts turns carrying dart rows with non-negative scores", () => {
    const result = validator.validateBatch({
      config: { rounds: 20 },
      batch: batchWithTurns([[hitDart]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a dartless turn with the caller's own message", () => {
    const result = validator.validateBatch({
      config: { rounds: 20 },
      batch: batchWithTurns([[]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
    expect(JSON.stringify(result)).toContain("turn t1 needs darts");
  });

  it("rejects a dart with a negative score", () => {
    const result = validator.validateBatch({
      config: { rounds: 20 },
      batch: batchWithTurns([[{ ...hitDart, score: -1 }]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("checks the dartless rule before branching on capture mode", () => {
    const result = validator.validateBatch({
      config: { rounds: 20 },
      batch: batchWithTurns([[]]),
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(false);
    expect(JSON.stringify(result)).toContain("turn t1 needs darts");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /home/user/dart-analytics/app && npx vitest run tests/services/rulesets/three-dart.validator.test.ts
```

Expected: FAIL — `Failed to resolve import "@services/rulesets/three-dart.validator"`.

- [ ] **Step 3: Add the options type**

Append to `app/src/services/rulesets/types.ts`:

```ts
/**
 * What `createThreeDartValidator` needs to know about one ruleset. Three
 * fields, because measurement found exactly three things the five three-dart
 * validators differ in: the Zod config schema, the game's name in the
 * mode-pair rejection, and the dartless-turn message.
 *
 * `dartlessIssue` is required rather than defaulted on purpose. The five ship
 * three distinct message bodies — Around the Clock names the two supported
 * mode pairs (a BULL hit can end a visit before three darts), Doubles
 * Training says "carries at least one dart", the rest say "is exactly 3
 * darts" — and these strings cross the API boundary to the client, so a
 * default would silently reword two of them.
 */
export type ThreeDartValidatorOptions = {
  label: string;
  configSchema: ZodTypeAny;
  dartlessIssue: (clientKey: string) => string;
};
```

Add `import type { ZodTypeAny } from "zod";` at the top of that file if it is not already imported.

- [ ] **Step 4: Write the builder**

Create `app/src/services/rulesets/three-dart.validator.ts`:

```ts
import type { RulesetValidator } from "@services/interfaces";
import {
  isVisualBoardCapture,
  validateVisualBoardTurns,
  VISUAL_BOARD_MODES,
} from "./visual-board.validator";
import type { EventsBatchRequestInput } from "@routes/types";
import type {
  BatchValidationResult,
  ConfigValidationResult,
  ThreeDartValidatorOptions,
} from "@services/types";

const ALLOWED_CAPTURE_MODE = "RECREATIONAL";
const ALLOWED_INPUT_MODE = "DETAILED_DARTS";

/**
 * The per-dart keypad mode pair, as it reads in a rejection message.
 * Exported because Around the Clock's dartless message interpolates it.
 */
export const DETAILED_DARTS_MODES = `${ALLOWED_CAPTURE_MODE} + ${ALLOWED_INPUT_MODE}`;

/** Same ceiling every coordinate-capturing three-dart ruleset uses for a dartless keypad visit (3 darts, treble 20 max) — none of them has a `max_visit_score` config field to read one from. */
const DEFAULT_MAX_TURN_SCORE = 180;

/** Whether a session's mode pair is the per-dart keypad capture. */
function isDetailedDartsCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    captureModeKey === ALLOWED_CAPTURE_MODE &&
    inputModeKey === ALLOWED_INPUT_MODE
  );
}

/**
 * Whether a session's mode pair is one a three-dart ruleset implements:
 * RECREATIONAL + DETAILED_DARTS for a per-dart keypad capture, or
 * ANALYTICS + VISUAL_BOARD for a coordinate capture.
 */
function isDetailedDartsOrVisualBoardCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    isDetailedDartsCapture(captureModeKey, inputModeKey) ||
    isVisualBoardCapture(captureModeKey, inputModeKey)
  );
}

/**
 * Every visit, under either capture mode, carries at least one dart row —
 * never a dartless total. Returns the rejection, or `null` when every turn in
 * the batch carries at least one dart. The message is the caller's, because
 * why a visit may hold fewer than three darts is a fact about the game.
 */
function rejectDartlessTurn(
  batch: EventsBatchRequestInput,
  dartlessIssue: (clientKey: string) => string,
): BatchValidationResult | null {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      if (turn.darts.length === 0) {
        return {
          valid: false,
          code: "VALIDATION_FAILED",
          issues: [dartlessIssue(turn.clientKey)],
        };
      }
    }
  }
  return null;
}

/**
 * Under RECREATIONAL + DETAILED_DARTS every dart's board score must be
 * non-negative. Returns the rejection, or `null` when every dart in the batch
 * clears that floor.
 */
function rejectNegativeDartScore(
  batch: EventsBatchRequestInput,
): BatchValidationResult | null {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      for (const dart of turn.darts) {
        if (dart.score < 0) {
          return {
            valid: false,
            code: "VALIDATION_FAILED",
            issues: [
              `turn ${turn.clientKey} dart ${dart.sequence} score must be non-negative`,
            ],
          };
        }
      }
    }
  }
  return null;
}

/**
 * The validator five three-dart rulesets share. Each supports two mode pairs.
 * Under RECREATIONAL + DETAILED_DARTS the engine emits one dart row per
 * throw, so every turn in a batch must carry at least one and no dart's board
 * score may be negative. Under ANALYTICS + VISUAL_BOARD every dart carries a
 * landing coordinate, re-derived and cross-checked by
 * `validateVisualBoardTurns`.
 *
 * A ruleset needing more than these assertions composes rather than forks:
 * call this, then wrap the returned `validate*` method.
 */
export function createThreeDartValidator(
  options: ThreeDartValidatorOptions,
): RulesetValidator {
  const { label, configSchema, dartlessIssue } = options;

  return {
    validateConfig({
      config,
      captureModeKey,
      inputModeKey,
    }): ConfigValidationResult {
      if (!isDetailedDartsOrVisualBoardCapture(captureModeKey, inputModeKey)) {
        return {
          valid: false,
          issues: [
            `${label} V1 only supports ${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES}`,
          ],
        };
      }
      const parsed = configSchema.safeParse(config);
      if (!parsed.success) {
        return { valid: false, issues: parsed.error.issues };
      }
      return { valid: true, config: parsed.data };
    },

    validateBatch({
      batch,
      captureModeKey,
      inputModeKey,
    }: {
      config: Record<string, unknown>;
      batch: EventsBatchRequestInput;
      existingTurnCount: number;
      captureModeKey?: string;
      inputModeKey?: string;
    }): BatchValidationResult {
      const dartlessRejection = rejectDartlessTurn(batch, dartlessIssue);
      if (dartlessRejection) return dartlessRejection;

      if (isVisualBoardCapture(captureModeKey ?? "", inputModeKey ?? "")) {
        return validateVisualBoardTurns(batch, DEFAULT_MAX_TURN_SCORE);
      }

      const negativeScoreRejection = rejectNegativeDartScore(batch);
      if (negativeScoreRejection) return negativeScoreRejection;

      return { valid: true };
    },
  };
}
```

Note the `?? ""` on the two mode keys: `RulesetValidator.validateBatch` declares them optional (`services/rulesets/interfaces.ts:17`), and the five hand-written files each destructure them as required in their own local parameter type. Keeping the interface's optionality and defaulting to a non-matching string preserves today's behaviour exactly — a call without modes takes the DETAILED_DARTS path, same as before.

- [ ] **Step 5: Run the builder's tests and the type check**

```bash
cd /home/user/dart-analytics/app && npx vitest run tests/services/rulesets/three-dart.validator.test.ts && npm run check
```

Expected: 8 tests pass, 0 type errors.

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics/app && npm run format && cd ..
git add app/src/services/rulesets/three-dart.validator.ts app/src/services/rulesets/types.ts app/tests/services/rulesets/three-dart.validator.test.ts
git commit -m "feat(rulesets): extract createThreeDartValidator

Three fields, because measurement found three differences: schema, label,
dartless message. No adopters yet."
```

---

## Task 6: The five validator adopters

**Files:**
- Modify: `app/src/services/rulesets/shanghai/shanghai.validator.ts` (149 lines → ~14)
- Modify: `app/src/services/rulesets/bobs27/bobs27.validator.ts`
- Modify: `app/src/services/rulesets/singles-training/singles-training.validator.ts`
- Modify: `app/src/services/rulesets/doubles-training/doubles-training.validator.ts`
- Modify: `app/src/services/rulesets/around-the-clock/around-the-clock.validator.ts`
- Test: `app/tests/services/rulesets/{shanghai,bobs27,singles-training,doubles-training,around-the-clock}/*.validator.test.ts` — existing, **unmodified**

**Interfaces:**
- Consumes: `createThreeDartValidator`, `DETAILED_DARTS_MODES` (Task 5).
- Produces: `shanghaiValidator`, `bobs27Validator`, `singlesTrainingValidator`, `doublesTrainingValidator`, `aroundTheClockValidator` — **same export names, same file paths**, so `registry.ts` and every test import are untouched. Do not rename anything; do not touch `registry.ts`.

**Untouched:** `five-oh-one`, `one-twenty-one`, `score-training`, `tuod`, `quick-score.validator.ts`. Those four are QUICK_SCORE-shaped and share a different (already-extracted) helper.

**The three message bodies, copied verbatim.** Reproduce these character for character — they are the current API responses.

| Validator | `label` | `dartlessIssue(clientKey)` returns |
| --------- | ------- | ---------------------------------- |
| `shanghai` | `Shanghai` | ``turn ${clientKey} must carry dart rows — every Shanghai visit is exactly 3 darts, hit or miss, never a dartless total`` |
| `bobs27` | `Bob's 27` | ``turn ${clientKey} must carry dart rows — every Bob's 27 visit is exactly 3 darts, hit or miss, never a dartless total`` |
| `singles-training` | `Singles Training` | ``turn ${clientKey} must carry dart rows — every Singles Training visit is exactly 3 darts, hit or miss, never a dartless total`` |
| `doubles-training` | `Doubles Training` | ``turn ${clientKey} must carry dart rows — every Doubles Training visit carries at least one dart, never a dartless total`` |
| `around-the-clock` | `Around the Clock` | ``turn ${clientKey} must carry dart rows (${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES})`` |

Schema imports, also verbatim: `ShanghaiConfig`, `Bobs27Config`, `SinglesConfig` (not `SinglesTrainingConfig`), `DoublesTrainingConfig`, `AroundTheClockConfig` — all from `@lib/types`.

- [ ] **Step 1: Replace `shanghai.validator.ts` in full**

```ts
import { ShanghaiConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/**
 * Shanghai supports two mode pairs, and asserts nothing beyond the shared
 * three-dart rules: a non-empty dart list per visit under either capture
 * mode, non-negative board scores under RECREATIONAL + DETAILED_DARTS, and
 * coordinate re-derivation under ANALYTICS + VISUAL_BOARD.
 */
export const shanghaiValidator: RulesetValidator = createThreeDartValidator({
  label: "Shanghai",
  configSchema: ShanghaiConfig,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Shanghai visit is exactly 3 darts, hit or miss, never a dartless total`,
});
```

- [ ] **Step 2: Run Shanghai's existing suite unmodified**

```bash
cd /home/user/dart-analytics/app && npx vitest run tests/services/rulesets/shanghai
```

Expected: PASS with zero edits to the test file.

- [ ] **Step 3: Replace `bobs27.validator.ts` in full**

```ts
import { Bobs27Config } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/**
 * Bob's 27 supports two mode pairs, and asserts nothing beyond the shared
 * three-dart rules.
 */
export const bobs27Validator: RulesetValidator = createThreeDartValidator({
  label: "Bob's 27",
  configSchema: Bobs27Config,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Bob's 27 visit is exactly 3 darts, hit or miss, never a dartless total`,
});
```

- [ ] **Step 4: Replace `singles-training.validator.ts` in full**

```ts
import { SinglesConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/**
 * Singles Training supports two mode pairs, and asserts nothing beyond the
 * shared three-dart rules.
 */
export const singlesTrainingValidator: RulesetValidator =
  createThreeDartValidator({
    label: "Singles Training",
    configSchema: SinglesConfig,
    dartlessIssue: (clientKey) =>
      `turn ${clientKey} must carry dart rows — every Singles Training visit is exactly 3 darts, hit or miss, never a dartless total`,
  });
```

- [ ] **Step 5: Replace `doubles-training.validator.ts` in full**

```ts
import { DoublesTrainingConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/**
 * Doubles Training supports two mode pairs, and asserts nothing beyond the
 * shared three-dart rules.
 */
export const doublesTrainingValidator: RulesetValidator =
  createThreeDartValidator({
    label: "Doubles Training",
    configSchema: DoublesTrainingConfig,
    dartlessIssue: (clientKey) =>
      `turn ${clientKey} must carry dart rows — every Doubles Training visit carries at least one dart, never a dartless total`,
  });
```

- [ ] **Step 6: Replace `around-the-clock.validator.ts` in full**

```ts
import { AroundTheClockConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  createThreeDartValidator,
  DETAILED_DARTS_MODES,
} from "../three-dart.validator";
import { VISUAL_BOARD_MODES } from "../visual-board.validator";

/**
 * Around the Clock supports two mode pairs, and asserts nothing beyond the
 * shared three-dart rules. Its dartless message names the two mode pairs
 * rather than a dart count: a visit can legitimately hold fewer than 3 darts,
 * because a BULL hit ends the session immediately.
 */
export const aroundTheClockValidator: RulesetValidator =
  createThreeDartValidator({
    label: "Around the Clock",
    configSchema: AroundTheClockConfig,
    dartlessIssue: (clientKey) =>
      `turn ${clientKey} must carry dart rows (${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES})`,
  });
```

- [ ] **Step 7: Run every ruleset suite and the type check**

```bash
cd /home/user/dart-analytics/app && npx vitest run tests/services/rulesets && npm run check
```

Expected: all pass, 0 type errors.

- [ ] **Step 8: Prove no test was edited, and measure**

```bash
git status --short app/tests/
cd app/src && wc -l services/rulesets/{shanghai/shanghai,bobs27/bobs27,singles-training/singles-training,doubles-training/doubles-training,around-the-clock/around-the-clock}.validator.ts | tail -1
```

Expected: no `M` lines under `app/tests/`; the five validators total well under the 749-line baseline. Record the number.

- [ ] **Step 9: Run the full suite and the duplication gate**

```bash
cd /home/user/dart-analytics/app && npm test && npx fallow 2>&1 | tail -20
```

Expected: full suite green; `fallow`'s duplication percentage **below** the Task 0 baseline. If it went up, an extraction added a clone instead of removing one — stop and investigate before committing.

- [ ] **Step 10: Commit**

```bash
cd /home/user/dart-analytics/app && npm run format && cd ..
git add app/src/services/rulesets/
git commit -m "refactor(rulesets): five validators adopt createThreeDartValidator

Export names and paths unchanged, so registry.ts and every test import are
untouched. Each file now holds only its schema, label and dartless message."
```

---

## Task 7: The wiring gate

Written and proven against fixtures **before** it is wired into anything (Task 8). A gate not proven to bite is not a gate.

**Files:**
- Create: `scripts/check-game-wiring.sh`
- Test: no repo test file — verified against fixture trees under the scratchpad (Steps 2–3). The repo has no bash test harness; every existing `check-*.sh` is verified the same way.

**Interfaces:**
- Consumes: nothing from earlier tasks. It reads `app/src/services/rulesets/registry.ts`, `app/src/lib/game/rulesets/capabilities.ts`, `app/src/lib/game/rulesets/games-visibility.ts`, `app/src/lib/client/alpine/register-route-data.ts`, plus the data files and pages those name.
- Produces: `bash scripts/check-game-wiring.sh [app-root]` — app-root defaults to `app`, resolved from the repo root. Exit 0 = pass, exit 1 = at least one check failed. Task 8 wires the zero-argument form into pre-commit and CI.

**The script below has been run against this repo and against six break-fixtures; it passes clean (9 rulesets) and fails on each fixture with a message naming the file.** Write it exactly as given. Two details that look like typos and are not: `cards[key.group(1)] = href.group(1)` (the `href` pattern has one capture group, not two), and the absence of `…` inside any f-string (a literal `{ … }` in an f-string is parsed as an expression and raises `SyntaxError`).

- [ ] **Step 1: Write the gate script**

Create `scripts/check-game-wiring.sh` with exactly this content:

```bash
#!/usr/bin/env bash
# Game-wiring gate — the six shared registries a new game must be added to,
# checked against each other. `scripts/check-game-engines.sh` proves an engine
# has a validator and declared capabilities; this proves the rest of the row:
# that a game reachable from the games page has data files, pages, and Alpine
# registrations, and that an engine-only ruleset has none of them.
#
# Driven from app/src/services/rulesets/registry.ts. For every key in it:
#   1. Validator file  — the path the registry imports resolves on disk.
#   2. Capabilities    — the key is declared in RULESET_CAPABILITIES.
#   3a. Visible games (the key appears in games-visibility.ts's GAME_CARDS):
#       both <code-slug>-{setup,play}.data.ts exist; both
#       pages/games/<route-slug>/{setup,play}/index.astro exist; each page's
#       x-data name is registered by Alpine.data(...) in
#       register-route-data.ts and imported there from the matching data file.
#   3b. Engine-only games (absent from GAME_CARDS): neither data file exists
#       and no pages/games/<code-slug>/ directory exists. Half a row is a
#       failure whichever half it fell on.
# Plus the reverse direction: every GAME_CARDS key has a registry entry, and
# every @lib/game/<slug>-setup.data import in register-route-data.ts belongs
# to some registry key.
#
# TWO SLUGS, BOTH DERIVED, NO TABLE. The code slug is the validator's own
# directory (services/rulesets/one-twenty-one/ → one-twenty-one); the route
# slug is read from the href GAME_CARDS already declares (/games/121/setup →
# 121). They differ for exactly the games whose real name starts with a digit,
# because a TypeScript identifier cannot. Deriving both means the gate never
# needs a mapping of its own to fall out of date.
#
# WHAT THIS GATE CANNOT DO, stated plainly so nobody mistakes its green for a
# guarantee: it proves the files exist and reference each other. It cannot
# prove anyone read docs/architecture/07-Frontend/09-Adding-A-Game.md, that a
# page renders, or that a setup form binds the right fields. The doc is the
# map; this is the specific failure a map does not catch — a registry left
# half-edited, which fails no test because every game's tests only ever
# exercise that game.
#
# ARGUMENT: takes an optional app-root path (default `app`) purely so the gate
# can be aimed at a fixture tree and proven to FAIL. A gate not proven to bite
# is not a gate. Pre-commit and CI both invoke the zero-argument form.

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

APP_ROOT="${1:-app}"

python3 - "$APP_ROOT" <<'PY'
import re
import sys
from pathlib import Path

app = Path(sys.argv[1])
FAIL = 0


def err(msg: str) -> None:
    global FAIL
    print(f"FAIL: {msg}", file=sys.stderr)
    FAIL = 1


def ok(msg: str) -> None:
    print(f"OK: {msg}")


REGISTRY = app / "src/services/rulesets/registry.ts"
CAPABILITIES = app / "src/lib/game/rulesets/capabilities.ts"
VISIBILITY = app / "src/lib/game/rulesets/games-visibility.ts"
ROUTE_DATA = app / "src/lib/client/alpine/register-route-data.ts"

missing = [p for p in (REGISTRY, CAPABILITIES, VISIBILITY, ROUTE_DATA) if not p.is_file()]
for p in missing:
    err(f"{p} not found")
if missing:
    sys.exit(1)

registry_text = REGISTRY.read_text(encoding="utf-8")
capabilities_text = CAPABILITIES.read_text(encoding="utf-8")
visibility_text = VISIBILITY.read_text(encoding="utf-8")
route_data_text = ROUTE_DATA.read_text(encoding="utf-8")

# --- Parse the registry: key -> validator module path ----------------------
imports = dict(
    (name, path)
    for name, path in re.findall(
        r'import\s*\{\s*(\w+)\s*\}\s*from\s*"\./([\w./-]+)"\s*;', registry_text
    )
)
body = re.search(r"const REGISTRY[^{]*\{(.*?)\n\};", registry_text, re.S)
if body is None:
    err(f"{REGISTRY}: no `const REGISTRY` object literal block found")
    sys.exit(1)
entries = re.findall(r'^\s*"?([A-Z0-9_]+)"?:\s*(\w+),', body.group(1), re.M)
if not entries:
    err(f"{REGISTRY}: REGISTRY block declares no ruleset keys")
    sys.exit(1)

# --- Parse the capability keys ---------------------------------------------
cap_body = re.search(
    r"export const RULESET_CAPABILITIES[^{]*\{(.*?)\n\};", capabilities_text, re.S
)
cap_keys = (
    set(re.findall(r'^\s*"?([A-Z0-9_]+)"?:', cap_body.group(1), re.M))
    if cap_body
    else set()
)
if not cap_keys:
    err(f"{CAPABILITIES}: no RULESET_CAPABILITIES keys found")
    sys.exit(1)

# --- Parse the game cards: key -> route slug -------------------------------
cards = {}
for block in re.findall(r"\{(.*?)\}", visibility_text.split("GAME_CARDS")[1], re.S):
    key = re.search(r'rulesetVersionKey:\s*"([A-Z0-9_]+)"', block)
    href = re.search(r'href:\s*"/games/([\w-]+)/setup"', block)
    if key and href:
        cards[key.group(1)] = href.group(1)
if not cards:
    err(f"{VISIBILITY}: no GAME_CARDS entries found")
    sys.exit(1)

registered = set(re.findall(r'Alpine\.data\(\s*"(\w+)"', route_data_text))
data_imports = dict(
    (name, slug)
    for name, slug in re.findall(
        r'import\s*\{\s*(\w+)\s*\}\s*from\s*"@lib/game/([\w-]+)-(?:setup|play)\.data"\s*;',
        route_data_text,
    )
)

code_slugs = set()
checked = 0

for key, binding in entries:
    module = imports.get(binding)
    if module is None:
        err(f"{REGISTRY}: {key} maps to `{binding}`, which the file never imports")
        continue

    validator = app / "src/services/rulesets" / f"{module}.ts"
    if not validator.is_file():
        err(f"{REGISTRY}: {key}'s validator `{validator}` does not exist")

    if key not in cap_keys:
        err(f"{key} has a validator but is not declared in {CAPABILITIES}")

    code_slug = module.split("/")[0]
    code_slugs.add(code_slug)
    setup_data = app / f"src/lib/game/{code_slug}-setup.data.ts"
    play_data = app / f"src/lib/game/{code_slug}-play.data.ts"

    if key not in cards:
        for stray in (setup_data, play_data):
            if stray.is_file():
                err(
                    f"{key} is engine-only (absent from {VISIBILITY}) but `{stray}` exists — "
                    "a game is either wired end to end or not wired at all"
                )
        stray_pages = app / f"src/pages/games/{code_slug}"
        if stray_pages.is_dir():
            err(
                f"{key} is engine-only (absent from {VISIBILITY}) but `{stray_pages}` exists"
            )
        checked += 1
        continue

    route_slug = cards[key]
    for data_file in (setup_data, play_data):
        if not data_file.is_file():
            err(f"{key} renders a card but `{data_file}` does not exist")

    for kind in ("setup", "play"):
        page = app / f"src/pages/games/{route_slug}/{kind}/index.astro"
        if not page.is_file():
            err(f"{key}'s card points at /games/{route_slug} but `{page}` does not exist")
            continue
        name = re.search(r'x-data="(\w+)\(\)"', page.read_text(encoding="utf-8"))
        if name is None:
            err(f"{page}: no x-data controller call found")
            continue
        controller = name.group(1)
        if controller not in registered:
            err(
                f"{page} mounts `{controller}()` but {ROUTE_DATA} never calls "
                f'Alpine.data("{controller}", callback) — the page renders and the controller is undefined'
            )
        elif data_imports.get(controller) != code_slug:
            err(
                f'{ROUTE_DATA} registers "{controller}" but does not import it from '
                f"`@lib/game/{code_slug}-{kind}.data`"
            )
    checked += 1

for key in cards:
    if key not in {k for k, _ in entries}:
        err(f"{VISIBILITY} renders a card for {key}, which has no entry in {REGISTRY}")

for name, slug in data_imports.items():
    if slug not in code_slugs:
        err(
            f"{ROUTE_DATA} imports `{name}` from `@lib/game/{slug}-*.data`, but no ruleset "
            f"in {REGISTRY} owns the `{slug}` slug"
        )

if FAIL:
    sys.exit(1)

ok(f"game wiring — {checked} ruleset(s) checked against six shared registries")
sys.exit(0)
PY
```

Then make it executable and confirm it passes on the current tree:

```bash
bash scripts/check-game-wiring.sh
```

Expected: `OK: game wiring — 9 ruleset(s) checked against six shared registries`, exit 0.

- [ ] **Step 2: Build a fixture tree**

```bash
FX=/tmp/claude-0/-home-user-dart-analytics/14792fb8-cb81-5b2a-9dc5-8ad87b6dd8ce/scratchpad/fx
mkfx() {
  rm -rf "$FX"
  mkdir -p "$FX/src/lib/game" "$FX/src/lib/client/alpine" "$FX/src/pages" "$FX/src/services"
  cp -r app/src/services/rulesets "$FX/src/services/"
  cp app/src/lib/game/*.ts "$FX/src/lib/game/"
  cp -r app/src/lib/game/rulesets "$FX/src/lib/game/"
  cp app/src/lib/client/alpine/register-route-data.ts "$FX/src/lib/client/alpine/"
  cp -r app/src/pages/games "$FX/src/pages/"
}
mkfx && bash scripts/check-game-wiring.sh "$FX"
```

Expected: exit 0. An unbroken copy must pass, or the fixtures below prove nothing.

- [ ] **Step 3: Prove the gate bites, six ways**

Run each break in turn, re-running `mkfx` before each so the fixture starts clean. **Every one must exit 1 and name the offending file.**

| # | Break | Command | Must report |
| - | ----- | ------- | ----------- |
| A | Key missing from `capabilities.ts` | `mkfx; sed -i '/^  SHANGHAI_V1:/d' "$FX/src/lib/game/rulesets/capabilities.ts"` | `SHANGHAI_V1 has a validator but is not declared in …/capabilities.ts` |
| B | Page controller never registered | `mkfx; sed -i '/Alpine.data("shanghaiSetup", shanghaiSetup);/d' "$FX/src/lib/client/alpine/register-route-data.ts"` | `…/shanghai/setup/index.astro mounts \`shanghaiSetup()\` but …register-route-data.ts never calls Alpine.data(…)` |
| C | Game dropped from `games-visibility.ts` | `mkfx;` then delete the `SHANGHAI_V1` card object from `"$FX/src/lib/game/rulesets/games-visibility.ts"` | three failures: both data files and the pages directory still exist for a now-engine-only ruleset |
| D | Pages missing for a card that renders | `mkfx; rm -rf "$FX/src/pages/games/121"` | `121_V1's card points at /games/121 but …/121/setup/index.astro does not exist` (and the play page) |
| E | Engine-only ruleset grows half a row | `mkfx; touch "$FX/src/lib/game/tuod-setup.data.ts"` | `TUOD_V1 is engine-only … but \`…/tuod-setup.data.ts\` exists` |
| F | Data file missing | `mkfx; rm -f "$FX/src/lib/game/around-the-clock-play.data.ts"` | `AROUND_THE_CLOCK_V1 renders a card but \`…/around-the-clock-play.data.ts\` does not exist` |

Case D is the one that proves the slug derivation: the card's href is `/games/121`, the code slug is `one-twenty-one`, and the gate must look for the pages under the **route** slug. If D passes when it should fail, the gate is using the wrong slug.

Case E is the one that proves engine-only is derived, not hardcoded: `TUOD_V1` is legitimate today precisely because it has *no* data files and *no* pages.

- [ ] **Step 4: Clean up and commit**

```bash
rm -rf "$FX"
cd /home/user/dart-analytics
git add scripts/check-game-wiring.sh
git commit -m "feat(gates): add check-game-wiring.sh

Holds the six shared registries against each other: validator, capabilities,
visibility, data files, Alpine registrations, pages. Both slugs derived —
code slug from the validator directory, route slug from the card href.
Proven against six break-fixtures before wiring."
```

---

## Task 8: Wire the gate

Four files, one number each. The gate is worthless until it runs without anyone choosing to run it.

**Files:**
- Modify: `.husky/pre-commit` (12 → 13 scripts)
- Modify: `.github/workflows/quality.yml` (`structure` job, 16 → 17 steps)
- Modify: `.claude/skills/run-all-gates/SKILL.md` (the `app/` list, and the "12 structural gates" count in the decision-ids entry)
- Modify: `app/CLAUDE.md` (the pre-commit gate list and its count, line ~70)

**Interfaces:**
- Consumes: `scripts/check-game-wiring.sh` (Task 7).
- Produces: nothing importable. After this task the gate runs on every commit and every CI `structure` job.

- [ ] **Step 1: Add it to the pre-commit chain**

In `.husky/pre-commit`, append one line to the `&&` chain, after `check-findings-log.sh`:

```sh
       && bash scripts/check-findings-log.sh \
       && bash scripts/check-game-wiring.sh
```

(The old last line ends without a backslash; add the backslash to it and put the new line last.)

- [ ] **Step 2: Add it to CI**

In `.github/workflows/quality.yml`, in the `structure` job, after the `Findings-log gate` step:

```yaml
      - name: Game-wiring gate
        run: bash scripts/check-game-wiring.sh
```

- [ ] **Step 3: Update the run-all-gates skill**

In `.claude/skills/run-all-gates/SKILL.md`, add to the "If `app/` changed, also run" block, after `check-style-tokens.sh`:

```bash
bash scripts/check-game-wiring.sh
```

And in the `decisions/` entry's prose, change `pre-commit already runs on every commit for the 12 structural gates` to `… for the 13 structural gates`.

- [ ] **Step 4: Update `app/CLAUDE.md`**

In the `**pre-commit:**` bullet (~line 70), change `then all 12 structural gates` to `then all 13 structural gates`, and add `game-wiring` to the end of the parenthesised list, after `findings-log`.

- [ ] **Step 5: Verify the wiring actually fires**

```bash
cd /home/user/dart-analytics && bash .husky/pre-commit
```

Expected: `OK:` lines for all 13 gates, ending with `OK: game wiring — 9 ruleset(s) checked…`. (`lint-staged` reporting "could not find any staged files matching configured tasks" is expected when nothing is staged.)

Then confirm the counts are consistent:

```bash
grep -c "bash scripts/check-" .husky/pre-commit
grep -c "run: bash scripts/check-" .github/workflows/quality.yml
```

Expected: `13` and `17`.

- [ ] **Step 6: Commit**

```bash
git add .husky/pre-commit .github/workflows/quality.yml .claude/skills/run-all-gates/SKILL.md app/CLAUDE.md
git commit -m "chore(gates): wire check-game-wiring.sh as gate 13/17

Pre-commit 12 -> 13, quality.yml structure 16 -> 17, run-all-gates and
app/CLAUDE.md counts updated to match."
```

---

## Task 9: The exemplar doc

The map the gate cannot draw. One game named as the reference, the fan-out written down once, and the two opt-outs stated so nobody concludes the factory is optional.

**Files:**
- Create: `docs/architecture/07-Frontend/09-Adding-A-Game.md`
- Modify: `docs/architecture/00-Context-Map.md` — the "New game (full stack)" pack row
- Modify: `docs/architecture/00-File-Inventory.md` — rows for the exemplar, the gate, and the four new source/test files

**Interfaces:**
- Consumes: the shapes Tasks 2, 5 and 7 established (the factory's option names, the builder's option names, the gate's checks).
- Produces: a doc path other docs point at. Task 11's decision cites it.

- [ ] **Step 1: Write the exemplar**

Create `docs/architecture/07-Frontend/09-Adding-A-Game.md` with exactly this content:

````markdown
<!--
status: canonical
scope: the file fan-out a new game requires, and the shapes it must reuse
read-when: adding a game, or changing anything a game is wired into
updated: 2026-08-19
-->

# Adding a Game

A game is 26 files across 9 trees. Six of them are **shared registries** — a
game wired into five of the six does not fail, it goes quiet. This page is the
list; `scripts/check-game-wiring.sh` is the gate that holds it.

**Reference exemplar: Bob's 27.** When a step below says "copy the existing
shape", copy Bob's 27's — `bobs27-setup.data.ts`, `bobs27.validator.ts`,
`bobs27.engine.module.ts`. One named game, so "copy an existing game" has one
answer instead of eight.

## Two slugs, and why

| Slug | Where it appears | Shanghai | 121 |
| ---- | ---------------- | -------- | --- |
| **Route slug** — the game's real name | `pages/games/<slug>/`, the `href` in `games-visibility.ts` | `shanghai` | `121` |
| **Code slug** — its spelled-out form | `lib/game/<slug>-*.data.ts`, `services/rulesets/<slug>/` | `shanghai` | `one-twenty-one` |

They are identical for every game whose name starts with a letter, and they
differ for every game whose name starts with a digit — because a route should
read as the game's real name and a TypeScript identifier cannot start with a
digit. This is forced, not sloppy. Do not "fix" it by renaming either side.

The ruleset version key follows the route slug, quoted where it must be:
`"121_V1"`, `"501_V1"`.

## The touch list

Rows marked **shared** are files that already exist and that every game edits.
Rows marked *engine-only skips* are the ones a ruleset with an engine but no
page (`TUOD_V1`) legitimately has none of.

### `app/src/lib/game/`

| File | What goes in it |
| ---- | --------------- |
| `<code-slug>-setup.data.ts` | A `createPresetSetupController` call. *Engine-only skips.* |
| `<code-slug>-play.data.ts` | The game's own play controller — genuinely per-game, no shared factory. *Engine-only skips.* |
| `types.ts` | **shared** — the play context; the setup context is a one-line alias of `PresetSetupContext` |

### `app/src/lib/game/rulesets/`

| File | What goes in it |
| ---- | --------------- |
| `types.ts` | **shared** — the game's Zod config schema |
| `capabilities.ts` | **shared** — the ruleset key and its capture/input mode pairs |
| `games-visibility.ts` | **shared** — the card: key, `href`, title, caption. *Engine-only skips:* a ruleset joins this list only once its `href` resolves, which is why TUOD is absent despite declaring capabilities. |

### `app/src/modules/game/`

| File | What goes in it |
| ---- | --------------- |
| `<code-slug>.engine.module.ts` | The engine + its `registerEngineFactory` call (`04-Architecture-patterns.md` Pattern 18) |
| `types.ts` | **shared** — engine options, recorded-visit shapes |

### `app/src/services/rulesets/`

| File | What goes in it |
| ---- | --------------- |
| `<code-slug>/<code-slug>.validator.ts` | For a three-dart game: a `createThreeDartValidator` call. Otherwise its own validator. |
| `registry.ts` | **shared** — ruleset key → validator. Must land in the **same commit** as the engine (`scripts/check-game-engines.sh` rejects one without the other). |

### `app/src/components/layout/games/`

| File | What goes in it |
| ---- | --------------- |
| `setup/<Game>SetupForm.astro` | The setup form. *Engine-only skips.* |
| `interfaces/<Game>.astro` | The play-screen interface. *Engine-only skips.* |
| `result-modals/<Game>Results.astro` | The results modal. *Engine-only skips.* |

Check `08-Component-Inventory.md` before hand-rolling markup — `SetupShell`,
`UserSection`, `InfoSection`, `SettingSectionShell`, `Toggle` already exist.

### `app/src/pages/games/<route-slug>/`

| File | What goes in it |
| ---- | --------------- |
| `setup/index.astro` | Mounts `x-data="<codeSlug>Setup()"`. *Engine-only skips.* |
| `play/index.astro` | Mounts `x-data="<codeSlug>Play()"`. *Engine-only skips.* |

### `app/src/lib/client/alpine/`

| File | What goes in it |
| ---- | --------------- |
| `register-route-data.ts` | **shared** — the import and the `Alpine.data(…)` call for both controllers. *Engine-only skips.* A page whose controller is missing here renders, and the controller is simply undefined. |

### `app/tests/`

| File | What it covers |
| ---- | -------------- |
| `modules/game/<code-slug>.engine.module.test.ts` | The engine |
| `services/rulesets/<code-slug>/<code-slug>.validator.test.ts` | The validator |
| `lib/game/<code-slug>-setup.data.test.ts` | Setup. *Engine-only skips.* |
| `lib/game/<code-slug>-play.data.test.ts` | Play. *Engine-only skips.* |
| `lib/game/rulesets/capabilities.test.ts` | **shared** |
| `lib/game/rulesets/games-visibility.test.ts` | **shared**. *Engine-only skips.* |

### `database/`

| File | What goes in it |
| ---- | --------------- |
| `seeds/00NN_<slug>_game_engine_reference.sql` | The game type, ruleset version, configuration template |
| `verification/00NN_<slug>_capability_checks.sql` | Its verification script |
| `seeds/0007_ruleset_version_capabilities.sql` | **shared** — the capability rows |
| `verification/0007_capability_seed_checks.sql` | **shared** |

New schema means a new numbered migration; applied migrations (`0001`–`0022`)
are never edited. Full procedure: `05-Database/10-Database-Agent-Guide.md`
§"Add a new game type".

## Two shapes to reuse, and who opts out

### `createPresetSetupController` (`lib/game/setup-controller.ts`)

Four facts and a call:

```ts
export function bobs27Setup() {
  return createPresetSetupController<Bobs27SetupContext>({
    gameTypeKey: "BOBS27",
    rulesetVersionKey: "BOBS27_V1",
    playHref: "/games/bobs27/play",
    label: "Bob's 27",
  });
}
```

One optional seam, `configOverrides(ctx)`, whose return value is spread over
the preset configuration before `toSnapshot` **and** sent as `createSession`'s
`config.overrides`. Singles and Doubles Training use it for `order_mode` /
`target_order`; nothing else needs it.

`label` is copy, not a key — it reads `Bob's 27`, not `BOBS27`.

**Opted out: `501` and Score Training.** Both replace `start` wholesale —
preset selection, leg counts, a custom starting score with clamping. Routing
them through the factory would need one hook per branch, which is the factory
dissolving into its callers. They keep hand-written controllers and
hand-written `*SetupContext` types. This is a decision, not an oversight: do
not migrate them, and do not conclude from them that the factory is optional
for a new preset-driven game.

### `createThreeDartValidator` (`services/rulesets/three-dart.validator.ts`)

Three facts and a call:

```ts
export const bobs27Validator: RulesetValidator = createThreeDartValidator({
  label: "Bob's 27",
  configSchema: Bobs27Config,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Bob's 27 visit is exactly 3 darts, hit or miss, never a dartless total`,
});
```

It asserts what the five three-dart games share: the mode pair is
`RECREATIONAL + DETAILED_DARTS` or `ANALYTICS + VISUAL_BOARD`; every turn
carries at least one dart row; scores are non-negative under keypad capture;
coordinates re-derive under visual board.

`dartlessIssue` is required rather than defaulted because the message is a
fact about the game — Around the Clock's visit can legitimately end early on a
BULL hit, and its message says so.

A game needing more than these assertions **composes**: call the builder, then
wrap the returned method. It does not fork the file.

QUICK_SCORE-shaped games (`501`, `121`, Score Training, TUOD) use
`quick-score.validator.ts` instead.

## What the gate checks, and what it cannot

`scripts/check-game-wiring.sh` walks every key in `registry.ts` and checks the
validator file, the capability declaration, and — for a game that renders a
card — both data files, both pages, and both Alpine registrations. For a game
absent from `games-visibility.ts` it checks the opposite: that none of those
exist, so a half-wired game fails whichever half it fell on.

It cannot check that anyone read this page, that a page renders, or that a
setup form binds the right fields. It catches one specific failure that no
test catches, because every game's tests only ever exercise that game: a
shared registry left half-edited.
````

- [ ] **Step 2: Verify the doc's own path references resolve**

```bash
bash scripts/check-doc-links.sh
```

Expected: `OK: doc links and path-like references resolve (… files scanned)`, exit 0. A failure here names a path in the new doc that does not exist — fix the path, not the gate.

- [ ] **Step 3: Repoint the context-map pack**

In `docs/architecture/00-Context-Map.md`, replace the "New game (full stack)" row's inline fan-out. The row currently reads:

```
| New game (full stack) | `05-Database/10-Database-Agent-Guide.md` §"Add a new game type", `04-Architecture-patterns.md` §Pattern 18, `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/08-Component-Inventory.md`, `app/CLAUDE.md`; plus the per-game fan-out: engine + validator (one commit), seed, `lib/game/<game>-setup.data.ts` / `-play.data.ts`, `components/layout/games/{interfaces,result-modals,setup}/`, `pages/games/<game>/{setup,play}/index.astro`, `lib/client/alpine/register-route-data.ts` | ~12.7k |
```

Replace it with:

```
| New game (full stack) | `07-Frontend/09-Adding-A-Game.md` (the touch list, the two shapes to reuse, the two opt-outs), `05-Database/10-Database-Agent-Guide.md` §"Add a new game type", `04-Architecture-patterns.md` §Pattern 18, `07-Frontend/08-Component-Inventory.md`, `app/CLAUDE.md` | ~12.4k |
```

Then recompute the budget honestly rather than trusting `~12.4k`:

```bash
cd /home/user/dart-analytics && for f in docs/architecture/07-Frontend/09-Adding-A-Game.md docs/architecture/05-Database/10-Database-Agent-Guide.md docs/architecture/04-Architecture-patterns.md docs/architecture/07-Frontend/08-Component-Inventory.md app/CLAUDE.md; do wc -c "$f"; done | awk '{s+=$1} END {printf "~%.1fk\n", s/4/1000}'
```

Put the number that command prints in the row. `04-Architecture-patterns.md` and `10-Database-Agent-Guide.md` are loaded in full by the pack even though only one section each is named, which is how the existing budgets are computed — do not change that convention here.

- [ ] **Step 4: Register the new files in the inventory**

In `docs/architecture/00-File-Inventory.md`, add these rows, each in its existing section (docs rows are sorted by path; script rows sit with the other `scripts/check-*.sh` entries):

```
| `07-Frontend/09-Adding-A-Game.md` | The 26-file fan-out a new game requires, the six shared registries that fail silently, `bobs27` as the reference exemplar, the route-slug/code-slug rule, and the two setup-controller opt-outs (2026-08-19) | canonical | ~2.0k |
```

```
| `app/src/lib/game/setup-controller.ts` | `createPresetSetupController` — the preset setup skeleton six games share; one seam (`configOverrides`) for the two training games' target order; 501 and Score Training deliberately opt out (2026-08-19) | canonical |
| `app/src/services/rulesets/three-dart.validator.ts` | `createThreeDartValidator` — the mode-pair, dartless-turn, negative-score and visual-board assertions five three-dart validators share; `label`, `configSchema` and `dartlessIssue` stay per-game (2026-08-19) | canonical |
| `scripts/check-game-wiring.sh` | Guard: every `registry.ts` key has a validator, a capability declaration, and — unless engine-only — data files, pages and Alpine registrations; engine-only derived from `games-visibility.ts`, both slugs derived, blind spots documented in its header (2026-08-19) | canonical |
```

Replace the `~2.0k` with the measured figure:

```bash
wc -c docs/architecture/07-Frontend/09-Adding-A-Game.md | awk '{printf "~%.1fk\n", $1/4/1000}'
```

- [ ] **Step 5: Run the doc gates**

```bash
cd /home/user/dart-analytics && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh && bash scripts/check-file-locations.sh
```

Expected: `OK:` from all four, exit 0 each. `check-context-budget.sh` is the one that will object if the pack row's stated budget does not match the files it names.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/07-Frontend/09-Adding-A-Game.md docs/architecture/00-Context-Map.md docs/architecture/00-File-Inventory.md
git commit -m "docs(frontend): add the adding-a-game exemplar

The 26-file touch list, bobs27 named as the reference, the slug rule, the two
opt-outs, and what the wiring gate can and cannot prove. The context-map pack
points here instead of carrying a partial fan-out inline."
```

---

## Task 10: Close F2

The one finding this branch touches, and only because the user gave explicit permission (root `CLAUDE.md`: "Acting on a finding requires explicit user permission, always").

**Files:**
- Modify: `CLAUDE.md` — the Knowledge Graph section
- Modify: `FINDINGS.md` — the `F2` block, deleted

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable. Task 11's decision does **not** cover this — F2's closure is recorded by this commit, per D214's lifecycle (a resolved finding leaves no tombstone; the commit is the record).

**What F2 says, so the fix is judged against the claim rather than a memory of it:** root `CLAUDE.md:48` tells every agent to run `graphify query` before broad exploration. `command -v graphify` finds nothing in the session container, so the rule is unfollowable — in the one file that loads every session. The committed `graphify-out/graph.json` *is* readable. The rule names the wrong tool, not the wrong idea.

- [ ] **Step 1: Confirm the finding still describes reality**

```bash
command -v graphify || echo "graphify CLI: absent"
ls -la graphify-out/graph.json
```

Expected: `graphify CLI: absent`, and `graph.json` present. If the CLI *is* present in your container, stop: the finding's premise has changed, and closing it needs a fresh look rather than this edit.

- [ ] **Step 2: Reword the Knowledge Graph section**

In `CLAUDE.md`, replace the first three bullets of the `# Knowledge Graph (graphify)` section. The section currently reads:

```markdown
A committed codebase knowledge graph lives at `graphify-out/graph.json` (AST-only; built with the `graphifyy` CLI — PyPI package `graphifyy`, repo `Graphify-Labs/graphify`).

- **Consult before broad grep/exploration:** `graphify query "<question>"`, `graphify path "<A>" "<B>"`, `graphify explain "<entity>"`. Use it to orient across app code + SQL schema + docs, then read the specific files it points to.
- **The graph is a map, not authority.** On any conflict, the authority order in `00-Context-Map.md` wins; verify a graph answer against the cited file before acting.
- **Freshness is CI-owned**: `.github/workflows/graph.yml` rebuilds the graph on every merge to `main` and opens a PR; it is no longer a local completion-report item. A local CLI install is optional, for querying the graph while working — see `app/CLAUDE.md`.
- **Scope caveat:** `.astro` files are only partially parsed (no tree-sitter grammar); TS/JS/SQL/Markdown are fully covered.
```

Replace it with:

```markdown
A committed codebase knowledge graph lives at `graphify-out/graph.json` (AST-only; built with the `graphifyy` CLI — PyPI package `graphifyy`, repo `Graphify-Labs/graphify`).

- **Consult the committed file before broad grep/exploration.** `graphify-out/graph.json` is in the repo and readable with the tools every session already has — grep it for an entity, or read it directly. Use it to orient across app code + SQL schema + docs, then read the specific files it points to.
- **The CLI is optional.** Where `graphify` is installed, `graphify query "<question>"`, `graphify path "<A>" "<B>"` and `graphify explain "<entity>"` are the nicer interface to the same file. It is not present in the session container, so nothing in this manual depends on it — see `app/CLAUDE.md` for a local install.
- **The graph is a map, not authority.** On any conflict, the authority order in `00-Context-Map.md` wins; verify a graph answer against the cited file before acting.
- **Freshness is CI-owned**: `.github/workflows/graph.yml` rebuilds the graph on every merge to `main` and opens a PR; it is no longer a local completion-report item.
- **Scope caveat:** `.astro` files are only partially parsed (no tree-sitter grammar); TS/JS/SQL/Markdown are fully covered.
```

- [ ] **Step 3: Delete the `F2` block from `FINDINGS.md`**

Delete the whole block — heading line through the `Proposed:` line, plus the blank line that followed it:

```markdown
### F2 — Root `CLAUDE.md` mandates a knowledge-graph CLI that is not installed
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: …
Evidence: …
Impact: …
Proposed: …
```

**Do not** change the front matter's `highest-issued: F6` — the high-water mark never moves backwards; that is the whole reason it exists. **Do not** renumber `F3`–`F6`. **Do not** add a "resolved" note anywhere: a closed finding leaves no tombstone (D214).

- [ ] **Step 4: Verify the log is still well-formed and F1/F3–F6 are untouched**

```bash
bash scripts/check-findings-log.sh
git diff FINDINGS.md | grep '^[+-]' | grep -v '^[+-][+-]'
```

Expected from the gate: `OK: front matter — status: present, high-water mark F6`, `OK: field shape — all 5 block(s)…`, `OK: ids — 5 unique id(s)…`, `OK: evidence — all N cited path(s) resolve`, exit 0.

Expected from the diff: **only `-` lines, all of them from the `F2` block.** A single `+` line, or a `-` line from any other block, means the edit went wider than permission covered.

- [ ] **Step 5: Confirm the always-loaded file did not grow**

```bash
wc -c CLAUDE.md
```

Record the number. The reword should be roughly size-neutral; report the before/after in the completion report, because `CLAUDE.md` is the one file that costs every session.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md FINDINGS.md
git commit -m "docs: consult the committed graph, not an absent CLI (closes F2)

The rule named the wrong tool, not the wrong idea: graphify-out/graph.json is
in the repo and readable; the CLI is not in the session container. Reworded to
point at the file and demote the CLI to an optional local convenience. F2 is
deleted rather than restatused, per the findings lifecycle. Acted on with
explicit user permission; F1 and F3-F6 stay open and untouched."
```

---

## Task 11: Context maintenance and final validation

The context system is part of the deliverable. Run the `context-maintenance` skill; the steps below are what it will demand for this branch specifically.

**Files:**
- Modify: `decisions/frontend/architecture.md` — D215, appended at the **end**
- Modify: `docs/architecture/00-Context-Map-History.md` — version 1.10.0 entry + this spec/plan's task rows
- Modify: `FINDINGS.md` — only if executing this plan turned up something new

**Interfaces:**
- Consumes: everything above.
- Produces: the completion report.

- [ ] **Step 1: Append D215**

At the **end** of `decisions/frontend/architecture.md` (never edit an existing block):

```markdown
### D215 — One shape per game, extracted where measurement found a clone and written down where it did not
Status: Accepted · Date: 2026-08-19
Decision: Two behaviour-preserving extractions plus one exemplar doc and one gate. `lib/game/setup-controller.ts` (`createPresetSetupController`) absorbs the preset setup skeleton six games repeated verbatim — Bob's 27, Shanghai, 121, Around the Clock, Singles Training, Doubles Training — parameterised by four facts (`gameTypeKey`, `rulesetVersionKey`, `playHref`, `label`) and one optional seam (`configOverrides`, used only by the two training games for `order_mode`/`target_order`). `services/rulesets/three-dart.validator.ts` (`createThreeDartValidator`) absorbs the shared assertions five three-dart validators repeated, parameterised by `label`, `configSchema` and a required `dartlessIssue`. `docs/architecture/07-Frontend/09-Adding-A-Game.md` states the 26-file fan-out, names `bobs27` the reference exemplar, and records the route-slug/code-slug split as forced rather than sloppy. `scripts/check-game-wiring.sh` (gate 13 pre-commit, 17 in CI `structure`) holds the six shared registries against each other. `501` and Score Training keep hand-written setup controllers, and `<game>-play.data.ts` is left entirely alone.
Reason: D182 accepted mirrored duplication with two samples and named "a third same-shaped game" as the revisit trigger; D208 and D209 paid down the play-data half of that debt once CI made it a hard failure. The setup half was never revisited, and by the ninth ruleset it had reached six byte-identical files: 961 lines of setup controller and 749 of validator carrying roughly 160 lines of game-specific fact between them. The measurable cost is not the line count but the silence — `bobs27.validator.ts` and `shanghai.validator.ts` differ in 37 lines, of which the only structural difference is that `DEFAULT_MAX_TURN_SCORE` sits at line 19 in one and line 96 in the other, and each validator's doc comment cites a *different* sibling as the file it mirrors. A change to shared behaviour was five or six edits, and an agent making four of them introduced a divergence no test could catch, because each game's suite only ever exercises that game. `play.data.ts` was measured too and deliberately excluded: 189 to 643 lines with no pair closer than 461 differing lines is real per-game rules logic, and extracting from it would invent a shape rather than record one.
Consequences: The 819 existing tests passed unmodified through both extractions, which is the proof that they were behaviour-preserving — a test edited to accommodate an extraction would have been a behaviour change in disguise. Three details of the design spec did not survive the compiler and the plan corrected them: the generic self-typed `PresetSetupContext<Self>` is rejected as a circular type alias (TS2456) so the base type is non-generic and the self-type parameter lives on the factory instead; `overrides` belongs to `createSession`'s `config`, not to `startSessionInput`; and `dartlessIssue` had to become a third required field because the five validators ship three distinct message bodies, two of which a default would have silently reworded. The gate derives both slugs rather than carrying a table — code slug from the validator's directory, route slug from the `href` `games-visibility.ts` already declares — so a ninth game needs no gate edit. What it still cannot prove is that anyone read the exemplar; that boundary is stated in the script's own header.
```

- [ ] **Step 2: Append the 1.10.0 history entry**

At the top of the `# Version History` list in `docs/architecture/00-Context-Map-History.md` (newest first, matching 1.9.0's shape):

```markdown
> **Version:** 1.10.0 (2026-08-19 — consistency: `createPresetSetupController` (`app/src/lib/game/setup-controller.ts`) adopted by six games and `createThreeDartValidator` (`app/src/services/rulesets/three-dart.validator.ts`) adopted by five, both behaviour-preserving with all 819 existing tests passing unmodified; new `docs/architecture/07-Frontend/09-Adding-A-Game.md` carrying the 26-file / 9-tree touch list, `bobs27` as the named reference exemplar, the route-slug/code-slug rule and the two setup-controller opt-outs, with the "New game (full stack)" pack repointed at it instead of carrying a partial fan-out inline; new `scripts/check-game-wiring.sh` as the thirteenth pre-commit gate and seventeenth `quality.yml` structure gate, proven against six break-fixtures before wiring; root `CLAUDE.md`'s Knowledge Graph section reworded to consult the committed `graphify-out/graph.json` rather than an absent CLI, closing and deleting finding `F2` by explicit user permission; D215 recorded)
```

Then add the task rows for this spec and plan in the per-task section, matching the existing row format.

- [ ] **Step 3: Log anything noticed, fix nothing**

While executing this plan you will have noticed things it did not ask you to change. Two are already known and are **candidates, not obligations** — judge them yourself before logging:

- `doubles-training-setup.data.ts` is the one file of the six missing the "V1 seeds exactly one configuration preset" JSDoc line.
- `database/verification/0009_*.sql` and `0010_*.sql` each assert the **complete** capability set, including every earlier game's rows — so game ten appears to require editing every earlier verification script, or leaving them stale.

If you log either, append it to `FINDINGS.md` with the next id from the `highest-issued:` high-water mark (bump the mark), and **do not fix it**. That rule is the point of Spec 2, and this branch is not exempt from it.

- [ ] **Step 4: Run every applicable gate**

Use the `run-all-gates` skill. It will dispatch:

```bash
cd /home/user/dart-analytics
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-findings-log.sh
bash scripts/check-decision-ids.sh
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

State each script's result explicitly in the completion report. Do not summarise as "gates pass".

- [ ] **Step 5: Run `validate:app`**

This branch changes `app/` source, so the full sequence applies (`validate-app` skill):

```bash
cd /home/user/dart-analytics/app && npm run format && npm run format:check && npm run validate:app
```

`validate:app` runs `db:status`, `db:migrate`, `db:introspect`, `npx fallow`, `npm test`, `npm run check`, `bash ../scripts/refresh-graph.sh`. If the database steps cannot reach Neon from this container, say so plainly and report the DB-independent results — do not claim a step ran that did not.

- [ ] **Step 6: Report the measured line-count delta**

```bash
cd /home/user/dart-analytics/app/src
wc -l lib/game/{bobs27,shanghai,around-the-clock,one-twenty-one,singles-training,doubles-training}-setup.data.ts lib/game/setup-controller.ts | tail -1
wc -l services/rulesets/{shanghai/shanghai,bobs27/bobs27,singles-training/singles-training,doubles-training/doubles-training,around-the-clock/around-the-clock}.validator.ts services/rulesets/three-dart.validator.ts | tail -1
```

Compare against Task 0's 961 and 749. **Report what you measure, including the new files' own lines.** If the saving is smaller than the design implied, the figure that ships is the measured one — the point of the extraction was the single edit site, not the byte count.

- [ ] **Step 7: Commit and push**

```bash
cd /home/user/dart-analytics
git add decisions/frontend/architecture.md docs/architecture/00-Context-Map-History.md FINDINGS.md
git commit -m "docs(context): D215, context-map 1.10.0, task records"
git push -u origin claude/consistency-spec3
```

Retry a failed push up to 4 times with exponential backoff (2s, 4s, 8s, 16s) only for network errors. **Do not open a pull request** unless the user asks.

---

## Self-review

Checked against `docs/superpowers/specs/2026-08-19-consistency-design.md`:

| Spec section | Task |
| ------------ | ---- |
| §1 `createPresetSetupController` | 2 (factory), 3 + 4 (six adopters) |
| §2 `PresetSetupContext` | 1 — **non-generic**, see corrections |
| §3 `createThreeDartValidator` | 5 (builder), 6 (five adopters) — **three options**, see corrections |
| §4 `09-Adding-A-Game.md` + pack repoint | 9 |
| §5 `scripts/check-game-wiring.sh` (gate 17) | 7 (write + prove), 8 (wire) |
| §6 F2 closed | 10 |
| Verification §1 baseline + two new test files | 0, 2, 5 |
| Verification §2 gate proven before wiring | 7 Step 3 (six fixtures, one per failure mode) |
| Verification §3 one cluster at a time, suite green after each | 3 → 4 → 6, each with its own run |
| Verification §4 `npm run check`, `format:check`, full gate chain | 11 Steps 4–5 |
| Verification §5 honest line-count delta | 0 Step 2, 6 Step 8, 11 Step 6 |
| Files table (new + modified) | every row appears in a task's Files block |

Four spec details are contradicted on purpose, each with the evidence in "Three corrections" above: the generic self-type (TS2456), the `overrides` call site, the missing `dartlessIssue` option, and the 25-vs-26 touch-list count. Everything else is implemented as specified.

No task depends on a type, function or file that no earlier task creates. Names used across tasks: `PresetSetupContext`, `PresetSetupControllerOptions`, `createPresetSetupController`, `ThreeDartValidatorOptions`, `createThreeDartValidator`, `DETAILED_DARTS_MODES`, `check-game-wiring.sh` — each defined once, spelled the same everywhere.
