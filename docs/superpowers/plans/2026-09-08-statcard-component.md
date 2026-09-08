# StatCard Component + Statistics Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable `StatCard` component and wire the empty Statistics page to `GET /api/statistics/overview`, showing 17 cards backed by a new `stats` Alpine store.

**Architecture:** Pure-function formatter (`lib/stats/format-statistics-overview.ts`) turns the API DTO into display strings; an Alpine store (`stats.store.ts`, mirroring `profile.store.ts`) fetches + formats once per load; `StatCard`/`StatCardSkeleton` are dumb Astro components bound to the store via Alpine `x-text` expressions, following the `StatRow`/`StatRowSkeleton` pair already in the codebase.

**Tech Stack:** Astro (`.astro` components), Alpine.js v3 (stores, `x-show`/`x-text`/`x-cloak`), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-statcard-component-design.md`

## Global Constraints

- Semantic tokens only — never `bg-bg*`/`text-fg*`/raw palette utilities. Use `bg-surface-raised`, `border-border`, `text-foreground`, `text-muted-foreground`, `rounded-2xl` (07-Frontend/07-Style-Guide.md).
- Class composition via `cn()` only — never `class:list` (`scripts/check-astro-class-composition.sh`).
- Never `font-medium`; large numeric displays use `font-mono font-bold tabular-nums`.
- No exported `type`/`interface` in an implementation `.ts` file — declare in that folder's `types.ts` and raise it into the parent's `types.ts` (`scripts/check-type-barrels.sh`). `.astro` `interface Props` is exempt (never exported).
- A changed runtime `.ts` file under `app/src/` needs a covering test in the same change (`scripts/check-test-coverage.sh`). Type-only files (`types.ts`) are exempt.
- No `//`/`/* */` comments inside function/method bodies; a JSDoc block above the declaration only, for non-obvious rationale.
- `x-init` is forbidden; store hydration goes through the store's own `init()`, called automatically by Alpine on registration.
- Prettier formatting: run `cd app && npm run format` and confirm `npm run format:check` before treating any task's diff as final.
- Work happens directly on the current branch `claude/statcard-component-nlvknl` (already checked out) — no worktrees, no new branch.
- `context-maintenance` skill runs once at the end of the whole plan (not per-task) — this is a mandatory closing step, not optional cleanup.

---

## File Map

| File | Responsibility |
| --- | --- |
| `app/src/components/ui/StatCard.astro` | Display one stat: label + value, optional hint. No width/loading opinion. |
| `app/src/components/ui/StatCardSkeleton.astro` | Loading placeholder pairing with `StatCard`. |
| `app/src/lib/stats/types.ts` | Declares `FormattedStatisticsOverview` (type-barrel rule). |
| `app/src/lib/types.ts` | Raises `./stats/types` (edit — add one line). |
| `app/src/lib/stats/format-statistics-overview.ts` | Pure DTO → display-string formatter. |
| `app/src/lib/client/api/types.ts` | Re-exports `StatisticsOverviewResponseData` for browser code (edit). |
| `app/src/lib/client/api/statistics.ts` | `fetchStatisticsOverview()`, mirrors `profile.ts`. |
| `app/src/stores/stats.store.ts` | Alpine store: loads + formats once, exposes plain string fields. |
| `app/src/lib/client/alpine/register-stores.ts` | Registers the `stats` store (edit). |
| `app/src/pages/statistics/index.astro` | Statistics page: skeleton/real card grids bound to `$store.stats` (edit). |

Test files mirror each new runtime `.ts` under `app/tests/` in the same relative path.

---

### Task 1: StatCard + StatCardSkeleton components

**Files:**
- Create: `app/src/components/ui/StatCard.astro`
- Create: `app/src/components/ui/StatCardSkeleton.astro`

**Interfaces:**
- Produces: `StatCard` props `{ label: string; valueExpr: string; hintExpr?: string; class?: string }`; `StatCardSkeleton` props `{ label: string; class?: string }`. Later tasks (Task 5) pass `valueExpr`/`hintExpr` as strings like `"$store.stats.totalGamesPlayed"`.

No unit test for `.astro` markup (per `app/CLAUDE.md`: component variant logic isn't unit-tested, no Astro test runner exists). Verified via `astro check` (Step 3) and visually in Task 5.

- [ ] **Step 1: Create `StatCard.astro`**

```astro
---
/**
 * Generic stat display tile: label + value, with an optional supporting
 * hint line. Fills its container (`w-full`, no forced height) so a parent
 * grid or flex row decides whether it renders at half or full width.
 * `valueExpr`/`hintExpr` are Alpine expressions (bound via `x-text`), not
 * literal strings — callers load their data asynchronously from a store.
 * @param {string} label
 * @param {string} valueExpr Alpine expression bound to x-text
 * @param {string} [hintExpr] Alpine expression bound to x-text
 * @param {string} [class] Extra classes
 */
interface Props {
  label: string;
  valueExpr: string;
  hintExpr?: string;
  class?: string;
  [key: string]: unknown;
}

// Props
const {
  label,
  valueExpr,
  hintExpr,
  class: classNameProp = "",
  ...props
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn(
  "w-full rounded-2xl border border-border bg-surface-raised p-4",
  classNameProp,
);
---

<div
  class={className}
  {...props}
>
  <p class="text-xs text-muted-foreground">{label}</p>
  <p
    class="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground"
    x-text={valueExpr}
  >
  </p>
  {
    hintExpr && (
      <p
        class="mt-1 text-xs text-muted-foreground"
        x-text={hintExpr}
      >
      </p>
    )
  }
</div>
```

- [ ] **Step 2: Create `StatCardSkeleton.astro`**

```astro
---
/**
 * Loading placeholder for StatCard: same shell, a pulsing bar instead of
 * the value. Pairs with StatCard the way StatRowSkeleton pairs with
 * StatRow.
 * @param {string} label
 * @param {string} [class] Extra classes
 */
interface Props {
  label: string;
  class?: string;
  [key: string]: unknown;
}

// Props
const { label, class: classNameProp = "", ...props }: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn(
  "w-full rounded-2xl border border-border bg-surface-raised p-4",
  classNameProp,
);
---

<div
  class={className}
  {...props}
>
  <p class="text-xs text-muted-foreground">{label}</p>
  <p class="mt-2 h-8 w-16 animate-pulse rounded bg-muted-foreground/80"></p>
</div>
```

- [ ] **Step 3: Type-check**

Run: `cd app && npx astro check`
Expected: `0 errors, 0 warnings, 0 hints` (these two files aren't imported anywhere yet, so this just confirms they parse and type-check standalone).

- [ ] **Step 4: Format and commit**

```bash
cd app && npm run format
git add app/src/components/ui/StatCard.astro app/src/components/ui/StatCardSkeleton.astro
git commit -m "$(cat <<'EOF'
Add StatCard and StatCardSkeleton components

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSstHUg3vgZhVboVPDPw3S
EOF
)"
```

---

### Task 2: `format-statistics-overview.ts` module (TDD)

**Files:**
- Create: `app/src/lib/stats/types.ts`
- Modify: `app/src/lib/types.ts` (add one re-export line)
- Create: `app/src/lib/stats/format-statistics-overview.ts`
- Test: `app/tests/lib/stats/format-statistics-overview.test.ts`

**Interfaces:**
- Consumes: `StatisticsOverviewResponseData` from `@routes/types` (already exists — 18 fields, see `app/src/pages/api/statistics/types.ts`).
- Produces: `FormattedStatisticsOverview` (exported from `app/src/lib/stats/types.ts`, reachable elsewhere via `@lib/types`) with exactly these 19 string fields: `totalGamesPlayed`, `totalPlayTimeSeconds`, `favoriteGameTypeKey`, `currentPlayStreakDays`, `longestStreakHint`, `totalDartsThrown`, `hundredPlusCount`, `oneTwentyPlusCount`, `oneFortyPlusCount`, `oneEightiesCount`, `medianVisitScore`, `highestGameAverage`, `firstNineCareerAverage`, `scoringAverageExcludingDoubles`, `bestLegDarts`, `averageDartsPerLeg`, `doubleAccuracy`, `highestCheckoutValue`, `highestCheckoutHint`. And `formatStatisticsOverview(data: StatisticsOverviewResponseData): FormattedStatisticsOverview`, exported from `app/src/lib/stats/format-statistics-overview.ts`. Task 4 imports both.

- [ ] **Step 1: Declare the type barrel**

Create `app/src/lib/stats/types.ts`:

```ts
export interface FormattedStatisticsOverview {
  totalGamesPlayed: string;
  totalPlayTimeSeconds: string;
  favoriteGameTypeKey: string;
  currentPlayStreakDays: string;
  longestStreakHint: string;
  totalDartsThrown: string;
  hundredPlusCount: string;
  oneTwentyPlusCount: string;
  oneFortyPlusCount: string;
  oneEightiesCount: string;
  medianVisitScore: string;
  highestGameAverage: string;
  firstNineCareerAverage: string;
  scoringAverageExcludingDoubles: string;
  bestLegDarts: string;
  averageDartsPerLeg: string;
  doubleAccuracy: string;
  highestCheckoutValue: string;
  highestCheckoutHint: string;
}
```

- [ ] **Step 2: Raise it into `lib/types.ts`**

Edit `app/src/lib/types.ts` — current content:

```ts
export * from "./auth/types";
export * from "./game/types";
export * from "./utils/types";
```

New content (append one line):

```ts
export * from "./auth/types";
export * from "./game/types";
export * from "./utils/types";
export * from "./stats/types";
```

- [ ] **Step 3: Write the failing test**

Create `app/tests/lib/stats/format-statistics-overview.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatStatisticsOverview } from "@lib/stats/format-statistics-overview";
import type { StatisticsOverviewResponseData } from "@routes/types";

const ZERO: StatisticsOverviewResponseData = {
  totalGamesPlayed: 0,
  totalPlayTimeSeconds: 0,
  favoriteGameTypeKey: null,
  longestPlayStreakDays: 0,
  currentPlayStreakDays: 0,
  totalDartsThrown: 0,
  hundredPlusCount: 0,
  oneTwentyPlusCount: 0,
  oneFortyPlusCount: 0,
  oneEightiesCount: 0,
  medianVisitScore: 0,
  highestGameAverage: 0,
  firstNineCareerAverage: 0,
  scoringAverageExcludingDoubles: 0,
  bestLegDarts: null,
  averageDartsPerLeg: null,
  doubleAccuracy: null,
  highestCheckout: null,
};

describe("formatStatisticsOverview", () => {
  it("formats an all-zero/all-null response with placeholder dashes", () => {
    const result = formatStatisticsOverview(ZERO);
    expect(result.totalGamesPlayed).toBe("0");
    expect(result.totalPlayTimeSeconds).toBe("0m");
    expect(result.favoriteGameTypeKey).toBe("—");
    expect(result.currentPlayStreakDays).toBe("0 days");
    expect(result.longestStreakHint).toBe("Longest: 0 days");
    expect(result.bestLegDarts).toBe("—");
    expect(result.averageDartsPerLeg).toBe("—");
    expect(result.doubleAccuracy).toBe("—");
    expect(result.highestCheckoutValue).toBe("—");
    expect(result.highestCheckoutHint).toBe("");
  });

  it("formats a full response with real history", () => {
    const data: StatisticsOverviewResponseData = {
      totalGamesPlayed: 12,
      totalPlayTimeSeconds: 3600,
      favoriteGameTypeKey: "501",
      longestPlayStreakDays: 3,
      currentPlayStreakDays: 1,
      totalDartsThrown: 300,
      hundredPlusCount: 10,
      oneTwentyPlusCount: 5,
      oneFortyPlusCount: 2,
      oneEightiesCount: 1,
      medianVisitScore: 45,
      highestGameAverage: 65.5,
      firstNineCareerAverage: 50.2,
      scoringAverageExcludingDoubles: 48.1,
      bestLegDarts: 15,
      averageDartsPerLeg: 18.5,
      doubleAccuracy: 0.4,
      highestCheckout: { value: 100, timesHit: 2 },
    };
    const result = formatStatisticsOverview(data);
    expect(result.totalGamesPlayed).toBe("12");
    expect(result.totalPlayTimeSeconds).toBe("1h 0m");
    expect(result.favoriteGameTypeKey).toBe("501");
    expect(result.currentPlayStreakDays).toBe("1 day");
    expect(result.longestStreakHint).toBe("Longest: 3 days");
    expect(result.totalDartsThrown).toBe("300");
    expect(result.hundredPlusCount).toBe("10");
    expect(result.oneTwentyPlusCount).toBe("5");
    expect(result.oneFortyPlusCount).toBe("2");
    expect(result.oneEightiesCount).toBe("1");
    expect(result.medianVisitScore).toBe("45.0");
    expect(result.highestGameAverage).toBe("65.5");
    expect(result.firstNineCareerAverage).toBe("50.2");
    expect(result.scoringAverageExcludingDoubles).toBe("48.1");
    expect(result.bestLegDarts).toBe("15 darts");
    expect(result.averageDartsPerLeg).toBe("18.5");
    expect(result.doubleAccuracy).toBe("40%");
    expect(result.highestCheckoutValue).toBe("100");
    expect(result.highestCheckoutHint).toBe("Hit 2×");
  });

  it("falls back to a dash for an unrecognized game type key", () => {
    const result = formatStatisticsOverview({ ...ZERO, favoriteGameTypeKey: "UNKNOWN" });
    expect(result.favoriteGameTypeKey).toBe("—");
  });

  it("drops the hour segment under one hour of play time", () => {
    const result = formatStatisticsOverview({ ...ZERO, totalPlayTimeSeconds: 125 });
    expect(result.totalPlayTimeSeconds).toBe("2m");
  });

  it("singularizes a one-day streak", () => {
    const result = formatStatisticsOverview({
      ...ZERO,
      longestPlayStreakDays: 1,
    });
    expect(result.longestStreakHint).toBe("Longest: 1 day");
  });

  it("reports a single checkout hit without pluralizing oddly", () => {
    const result = formatStatisticsOverview({
      ...ZERO,
      highestCheckout: { value: 40, timesHit: 1 },
    });
    expect(result.highestCheckoutHint).toBe("Hit 1×");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/stats/format-statistics-overview.test.ts`
Expected: FAIL — `Cannot find module '@lib/stats/format-statistics-overview'`

- [ ] **Step 5: Implement the formatter**

Create `app/src/lib/stats/format-statistics-overview.ts`:

```ts
import type { StatisticsOverviewResponseData } from "@routes/types";
import type { FormattedStatisticsOverview } from "./types";

const GAME_TYPE_TITLES: Record<string, string> = {
  "501": "501",
  "121": "121",
  TUOD: "Ten Up One Down",
  SINGLES_TRAINING: "Singles training",
  SCORE_TRAINING: "Score training",
  BOBS27: "Bob's 27",
  DOUBLES_TRAINING: "Doubles training",
  SHANGHAI: "Shanghai",
  AROUND_THE_CLOCK: "Around the Clock",
};

function formatPlayTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatDays(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Turns the raw statistics overview DTO into display-ready strings for
 * StatCard. Every field is computed once per load — nothing here needs to
 * re-run reactively, so the store just copies these strings onto itself.
 */
export function formatStatisticsOverview(
  data: StatisticsOverviewResponseData,
): FormattedStatisticsOverview {
  return {
    totalGamesPlayed: String(data.totalGamesPlayed),
    totalPlayTimeSeconds: formatPlayTime(data.totalPlayTimeSeconds),
    favoriteGameTypeKey: GAME_TYPE_TITLES[data.favoriteGameTypeKey ?? ""] ?? "—",
    currentPlayStreakDays: formatDays(data.currentPlayStreakDays),
    longestStreakHint: `Longest: ${formatDays(data.longestPlayStreakDays)}`,
    totalDartsThrown: String(data.totalDartsThrown),
    hundredPlusCount: String(data.hundredPlusCount),
    oneTwentyPlusCount: String(data.oneTwentyPlusCount),
    oneFortyPlusCount: String(data.oneFortyPlusCount),
    oneEightiesCount: String(data.oneEightiesCount),
    medianVisitScore: data.medianVisitScore.toFixed(1),
    highestGameAverage: data.highestGameAverage.toFixed(1),
    firstNineCareerAverage: data.firstNineCareerAverage.toFixed(1),
    scoringAverageExcludingDoubles:
      data.scoringAverageExcludingDoubles.toFixed(1),
    bestLegDarts:
      data.bestLegDarts === null ? "—" : `${data.bestLegDarts} darts`,
    averageDartsPerLeg:
      data.averageDartsPerLeg === null
        ? "—"
        : data.averageDartsPerLeg.toFixed(1),
    doubleAccuracy:
      data.doubleAccuracy === null
        ? "—"
        : `${Math.round(data.doubleAccuracy * 100)}%`,
    highestCheckoutValue:
      data.highestCheckout === null
        ? "—"
        : String(data.highestCheckout.value),
    highestCheckoutHint:
      data.highestCheckout === null
        ? ""
        : `Hit ${data.highestCheckout.timesHit}×`,
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/stats/format-statistics-overview.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: Type-check, format, commit**

```bash
cd app && npx astro check && npm run format
git add app/src/lib/stats/types.ts app/src/lib/types.ts app/src/lib/stats/format-statistics-overview.ts app/tests/lib/stats/format-statistics-overview.test.ts
git commit -m "$(cat <<'EOF'
Add format-statistics-overview.ts: DTO to display-string formatter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSstHUg3vgZhVboVPDPw3S
EOF
)"
```

---

### Task 3: `lib/client/api/statistics.ts` (TDD)

**Files:**
- Modify: `app/src/lib/client/api/types.ts`
- Create: `app/src/lib/client/api/statistics.ts`
- Test: `app/tests/lib/client/api/statistics.test.ts`

**Interfaces:**
- Consumes: `apiRequest` from `./client` (existing, `app/src/lib/client/api/client.ts`).
- Produces: `fetchStatisticsOverview(): Promise<StatisticsOverviewResponseData>` and `StatisticsApiError` class, both exported from `app/src/lib/client/api/statistics.ts`. Task 4 imports `fetchStatisticsOverview`.

- [ ] **Step 1: Re-export the DTO type for browser code**

Edit `app/src/lib/client/api/types.ts` — current tail:

```ts
  UpdatePlayerProfileRequest,
  type UpdatePlayerProfileInput,
  type PlayerProfileResponseData,
} from "@routes/types";
```

New tail:

```ts
  UpdatePlayerProfileRequest,
  type UpdatePlayerProfileInput,
  type PlayerProfileResponseData,
  type StatisticsOverviewResponseData,
} from "@routes/types";
```

- [ ] **Step 2: Write the failing test**

Create `app/tests/lib/client/api/statistics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "@client/api/client";
import {
  fetchStatisticsOverview,
  StatisticsApiError,
} from "@client/api/statistics";

const SAMPLE = {
  totalGamesPlayed: 12,
  totalPlayTimeSeconds: 3600,
  favoriteGameTypeKey: "501",
  longestPlayStreakDays: 3,
  currentPlayStreakDays: 1,
  totalDartsThrown: 300,
  hundredPlusCount: 10,
  oneTwentyPlusCount: 5,
  oneFortyPlusCount: 2,
  oneEightiesCount: 1,
  medianVisitScore: 45,
  highestGameAverage: 65.5,
  firstNineCareerAverage: 50.2,
  scoringAverageExcludingDoubles: 48.1,
  bestLegDarts: 15,
  averageDartsPerLeg: 18.5,
  doubleAccuracy: 0.4,
  highestCheckout: { value: 100, timesHit: 2 },
};

describe("fetchStatisticsOverview", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the parsed overview on success", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: SAMPLE,
    });
    const result = await fetchStatisticsOverview();
    expect(result.totalGamesPlayed).toBe(12);
    expect(apiRequest).toHaveBeenCalledWith("/api/statistics/overview");
  });

  it("throws StatisticsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        retryable: false,
      },
    });
    await expect(fetchStatisticsOverview()).rejects.toBeInstanceOf(
      StatisticsApiError,
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/client/api/statistics.test.ts`
Expected: FAIL — `Cannot find module '@client/api/statistics'`

- [ ] **Step 4: Implement the API client**

Create `app/src/lib/client/api/statistics.ts`:

```ts
import { apiRequest } from "./client";
import type { StatisticsOverviewResponseData } from "./types";

export class StatisticsApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StatisticsApiError";
  }
}

export async function fetchStatisticsOverview(): Promise<StatisticsOverviewResponseData> {
  const result = await apiRequest<StatisticsOverviewResponseData>(
    "/api/statistics/overview",
  );
  if (!result.ok)
    throw new StatisticsApiError(result.error.code, result.error.message);
  return result.data;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/client/api/statistics.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Type-check, format, commit**

```bash
cd app && npx astro check && npm run format
git add app/src/lib/client/api/types.ts app/src/lib/client/api/statistics.ts app/tests/lib/client/api/statistics.test.ts
git commit -m "$(cat <<'EOF'
Add fetchStatisticsOverview client API function

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSstHUg3vgZhVboVPDPw3S
EOF
)"
```

---

### Task 4: `stats.store.ts` (TDD)

**Files:**
- Create: `app/src/stores/stats.store.ts`
- Modify: `app/src/lib/client/alpine/register-stores.ts`
- Test: `app/tests/stores/stats.store.test.ts`

**Interfaces:**
- Consumes: `fetchStatisticsOverview` (Task 3, `@client/api/statistics`), `formatStatisticsOverview` (Task 2, `@lib/stats/format-statistics-overview`).
- Produces: `statsStore()` returning an object with the 19 string fields named in Task 2's `FormattedStatisticsOverview`, plus `loading: boolean`, `error: string | null`, `init()`, `load()`. Task 5's page reads these as `$store.stats.<field>`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/stores/stats.store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchStatisticsOverview = vi.fn();

vi.mock("@client/api/statistics", () => ({
  fetchStatisticsOverview: () => fetchStatisticsOverview(),
}));

const { statsStore } = await import("@stores/stats.store");

const SAMPLE = {
  totalGamesPlayed: 12,
  totalPlayTimeSeconds: 3600,
  favoriteGameTypeKey: "501",
  longestPlayStreakDays: 3,
  currentPlayStreakDays: 1,
  totalDartsThrown: 300,
  hundredPlusCount: 10,
  oneTwentyPlusCount: 5,
  oneFortyPlusCount: 2,
  oneEightiesCount: 1,
  medianVisitScore: 45,
  highestGameAverage: 65.5,
  firstNineCareerAverage: 50.2,
  scoringAverageExcludingDoubles: 48.1,
  bestLegDarts: 15,
  averageDartsPerLeg: 18.5,
  doubleAccuracy: 0.4,
  highestCheckout: { value: 100, timesHit: 2 },
};

beforeEach(() => {
  fetchStatisticsOverview.mockReset();
});

describe("statsStore", () => {
  it("loads and formats the overview", async () => {
    fetchStatisticsOverview.mockResolvedValue(SAMPLE);

    const store = statsStore();
    await store.load();

    expect(store.totalGamesPlayed).toBe("12");
    expect(store.totalPlayTimeSeconds).toBe("1h 0m");
    expect(store.favoriteGameTypeKey).toBe("501");
    expect(store.currentPlayStreakDays).toBe("1 day");
    expect(store.longestStreakHint).toBe("Longest: 3 days");
    expect(store.highestCheckoutValue).toBe("100");
    expect(store.highestCheckoutHint).toBe("Hit 2×");
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("loads on init so a registered store hydrates without x-init", async () => {
    fetchStatisticsOverview.mockResolvedValue(SAMPLE);

    const store = statsStore();
    await store.init();

    expect(fetchStatisticsOverview).toHaveBeenCalledTimes(1);
    expect(store.totalGamesPlayed).toBe("12");
  });

  it("keeps blank fields and sets error when the load fails", async () => {
    fetchStatisticsOverview.mockRejectedValue(new Error("offline"));

    const store = statsStore();
    await store.load();

    expect(store.totalGamesPlayed).toBe("");
    expect(store.error).not.toBeNull();
    expect(store.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/stores/stats.store.test.ts`
Expected: FAIL — `Cannot find module '@stores/stats.store'`

- [ ] **Step 3: Implement the store**

Create `app/src/stores/stats.store.ts`:

```ts
import { fetchStatisticsOverview } from "@client/api/statistics";
import { formatStatisticsOverview } from "@lib/stats/format-statistics-overview";

/**
 * Career-wide stat cards for the Statistics page. Every field starts blank
 * so a failed or slow load leaves the page's skeleton-vs-real toggle as the
 * only visible state, never a stale or wrong number.
 *
 * Registered through `Alpine.store("stats", statsStore())`, so Alpine calls
 * `init()` once its interceptors resolve — the sanctioned hydration hook,
 * `x-init` being forbidden repo-wide.
 */
export function statsStore() {
  return {
    totalGamesPlayed: "",
    totalPlayTimeSeconds: "",
    favoriteGameTypeKey: "",
    currentPlayStreakDays: "",
    longestStreakHint: "",
    totalDartsThrown: "",
    hundredPlusCount: "",
    oneTwentyPlusCount: "",
    oneFortyPlusCount: "",
    oneEightiesCount: "",
    medianVisitScore: "",
    highestGameAverage: "",
    firstNineCareerAverage: "",
    scoringAverageExcludingDoubles: "",
    bestLegDarts: "",
    averageDartsPerLeg: "",
    doubleAccuracy: "",
    highestCheckoutValue: "",
    highestCheckoutHint: "",
    loading: false,
    error: null as string | null,

    async init() {
      await this.load();
    },

    async load() {
      this.loading = true;
      this.error = null;
      try {
        const formatted = formatStatisticsOverview(
          await fetchStatisticsOverview(),
        );
        this.totalGamesPlayed = formatted.totalGamesPlayed;
        this.totalPlayTimeSeconds = formatted.totalPlayTimeSeconds;
        this.favoriteGameTypeKey = formatted.favoriteGameTypeKey;
        this.currentPlayStreakDays = formatted.currentPlayStreakDays;
        this.longestStreakHint = formatted.longestStreakHint;
        this.totalDartsThrown = formatted.totalDartsThrown;
        this.hundredPlusCount = formatted.hundredPlusCount;
        this.oneTwentyPlusCount = formatted.oneTwentyPlusCount;
        this.oneFortyPlusCount = formatted.oneFortyPlusCount;
        this.oneEightiesCount = formatted.oneEightiesCount;
        this.medianVisitScore = formatted.medianVisitScore;
        this.highestGameAverage = formatted.highestGameAverage;
        this.firstNineCareerAverage = formatted.firstNineCareerAverage;
        this.scoringAverageExcludingDoubles =
          formatted.scoringAverageExcludingDoubles;
        this.bestLegDarts = formatted.bestLegDarts;
        this.averageDartsPerLeg = formatted.averageDartsPerLeg;
        this.doubleAccuracy = formatted.doubleAccuracy;
        this.highestCheckoutValue = formatted.highestCheckoutValue;
        this.highestCheckoutHint = formatted.highestCheckoutHint;
      } catch (cause) {
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        this.loading = false;
      }
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/stores/stats.store.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Register the store**

Edit `app/src/lib/client/alpine/register-stores.ts` — current content:

```ts
import type { Alpine } from "alpinejs";
import type { Persist } from "@alpinejs/persist";
import { authStore } from "@stores/auth.store";
import { boardInputStore } from "@stores/board-input.store";
import { checkoutHintsStore } from "@stores/checkout-hints.store";
import { gameStore } from "@stores/game.store";
import { profileStore } from "@stores/profile.store";
import { settingsStore } from "@stores/settings.store";

export function registerStores(Alpine: Alpine) {
  Alpine.store("auth", authStore());
  Alpine.store("settings", settingsStore());
  Alpine.store("profile", profileStore());
  /**
   * Alpine's `$persist` getter returns a fresh persist() per access —
   * required so each store field gets its own `.as()` alias closure.
   */
  const persist = () => (Alpine as unknown as { $persist: Persist }).$persist;
  Alpine.store("game", gameStore(persist));
  Alpine.store("boardInput", boardInputStore(persist));
  Alpine.store("checkoutHints", checkoutHintsStore(persist));
}
```

New content:

```ts
import type { Alpine } from "alpinejs";
import type { Persist } from "@alpinejs/persist";
import { authStore } from "@stores/auth.store";
import { boardInputStore } from "@stores/board-input.store";
import { checkoutHintsStore } from "@stores/checkout-hints.store";
import { gameStore } from "@stores/game.store";
import { profileStore } from "@stores/profile.store";
import { settingsStore } from "@stores/settings.store";
import { statsStore } from "@stores/stats.store";

export function registerStores(Alpine: Alpine) {
  Alpine.store("auth", authStore());
  Alpine.store("settings", settingsStore());
  Alpine.store("profile", profileStore());
  Alpine.store("stats", statsStore());
  /**
   * Alpine's `$persist` getter returns a fresh persist() per access —
   * required so each store field gets its own `.as()` alias closure.
   */
  const persist = () => (Alpine as unknown as { $persist: Persist }).$persist;
  Alpine.store("game", gameStore(persist));
  Alpine.store("boardInput", boardInputStore(persist));
  Alpine.store("checkoutHints", checkoutHintsStore(persist));
}
```

- [ ] **Step 6: Type-check, format, commit**

```bash
cd app && npx astro check && npm run format
git add app/src/stores/stats.store.ts app/src/lib/client/alpine/register-stores.ts app/tests/stores/stats.store.test.ts
git commit -m "$(cat <<'EOF'
Add stats store and register it with Alpine

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSstHUg3vgZhVboVPDPw3S
EOF
)"
```

---

### Task 5: Wire the Statistics page

**Files:**
- Modify: `app/src/pages/statistics/index.astro`

**Interfaces:**
- Consumes: `StatCard`/`StatCardSkeleton` (Task 1), `$store.stats.*` fields (Task 4) via Alpine expressions built in this file's frontmatter.

No new runtime `.ts` — no new unit test (`.astro` markup exempt). Verified by running the app.

- [ ] **Step 1: Replace the page**

Edit `app/src/pages/statistics/index.astro` — current content:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
---

<AppLayout title="Statistics">
  <div class="p-4">
    <h1 class="text-xl font-semibold text-foreground">Statistics</h1>
  </div>
</AppLayout>
```

New content:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import StatCard from "@components/ui/StatCard.astro";
import StatCardSkeleton from "@components/ui/StatCardSkeleton.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";

const statCards: readonly {
  label: string;
  key: string;
  hintKey?: string;
  full?: boolean;
}[] = [
  { label: "Favorite game", key: "favoriteGameTypeKey", full: true },
  {
    label: "Play streak",
    key: "currentPlayStreakDays",
    hintKey: "longestStreakHint",
    full: true,
  },
  { label: "Games played", key: "totalGamesPlayed" },
  { label: "Total play time", key: "totalPlayTimeSeconds" },
  { label: "Darts thrown", key: "totalDartsThrown" },
  { label: "100+", key: "hundredPlusCount" },
  { label: "120+", key: "oneTwentyPlusCount" },
  { label: "140+", key: "oneFortyPlusCount" },
  { label: "180s", key: "oneEightiesCount" },
  { label: "Median visit", key: "medianVisitScore" },
  { label: "Highest game avg", key: "highestGameAverage" },
  { label: "First-9 average", key: "firstNineCareerAverage" },
  { label: "Scoring average", key: "scoringAverageExcludingDoubles" },
  { label: "Best leg", key: "bestLegDarts" },
  { label: "Avg darts/leg", key: "averageDartsPerLeg" },
  { label: "Double accuracy", key: "doubleAccuracy" },
  {
    label: "Highest checkout",
    key: "highestCheckoutValue",
    hintKey: "highestCheckoutHint",
  },
];
---

<AppLayout title="Statistics">
  <div class="space-y-4 p-4">
    <h1 class="text-xl font-semibold text-foreground">Statistics</h1>

    <ErrorAlert
      showExpr="$store.stats.error"
      textExpr="$store.stats.error"
    />

    <div
      class="grid grid-cols-2 gap-3"
      x-show="$store.stats.loading"
      x-cloak
    >
      {
        statCards.map((row) => (
          <StatCardSkeleton
            label={row.label}
            class={row.full ? "col-span-2" : undefined}
          />
        ))
      }
    </div>

    <div
      class="grid grid-cols-2 gap-3"
      x-show="!$store.stats.loading"
      x-cloak
    >
      {
        statCards.map((row) => (
          <StatCard
            label={row.label}
            valueExpr={`$store.stats.${row.key}`}
            hintExpr={row.hintKey ? `$store.stats.${row.hintKey}` : undefined}
            class={row.full ? "col-span-2" : undefined}
          />
        ))
      }
    </div>
  </div>
</AppLayout>
```

- [ ] **Step 2: Type-check and format**

```bash
cd app && npx astro check && npm run format && npm run format:check
```

Expected: `astro check` reports 0 errors/warnings/hints; `format:check` clean.

- [ ] **Step 3: Manual verification in the browser**

```bash
cd app && astro dev --background
```

- Log in (or use whatever seeded dev auth the app already provides — `app/README.md`/`app/.env.example` cover local login setup; this task doesn't change auth).
- Navigate to `/statistics`.
- Confirm: the skeleton grid (pulsing bars) shows briefly, then swaps to the real grid with 17 cards; "Favorite game" and "Play streak" span the full row width; every other card sits two-to-a-row; no layout shift/overflow on a narrow (mobile-width) viewport.
- Check the browser console for errors (none expected).

```bash
astro dev stop
```

- [ ] **Step 4: Run the full test suite**

Run: `cd app && npx vitest run`
Expected: all tests pass, including the three new test files from Tasks 2-4.

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/statistics/index.astro
git commit -m "$(cat <<'EOF'
Wire the Statistics page to GET /api/statistics/overview via StatCard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HSstHUg3vgZhVboVPDPw3S
EOF
)"
```

---

### Task 6: Full validation + context maintenance

**Files:** none new — this task runs the mandatory closing procedures over everything Tasks 1-5 touched.

- [ ] **Step 1: Run the full validation chain**

Follow the `validate-app` skill's procedure:

```bash
cd app && npm run validate:app
```

Expected: every step exits zero; the type gate reports 0 errors/warnings/hints.

- [ ] **Step 2: Run the context-maintenance skill**

Invoke the `context-maintenance` skill (per root `CLAUDE.md`, mandatory before any task is done). It will identify which context-map pack rows / file inventory entries need the new files registered (`components/ui/StatCard.astro`, `StatCardSkeleton.astro`, `lib/stats/`, `stores/stats.store.ts`, `lib/client/api/statistics.ts`) and whether any `CLAUDE.md`/decision entry needs updating. Apply whatever it reports, commit separately if it produces file changes.

- [ ] **Step 3: Push**

```bash
git push -u origin claude/statcard-component-nlvknl
```

---

## Self-Review Notes

- **Spec coverage:** component API (Task 1), formatter + game-type lookup (Task 2), API client (Task 3), store (Task 4), page wiring incl. skeleton/real grids, full-width cards, ErrorAlert (Task 5), testing list from the spec (Tasks 2-4's test files), context-maintenance (Task 6). No spec section without a task.
- **Placeholder scan:** no TBD/TODO; every step has literal code or an exact command.
- **Type consistency:** `FormattedStatisticsOverview`'s 19 field names (Task 2) are used verbatim in the store (Task 4) and as `statCards[].key`/`hintKey` values (Task 5) — checked field-by-field across all three tasks.
