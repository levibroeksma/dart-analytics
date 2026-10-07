# Home Redesign (Static Pass) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `app/src/pages/index.astro` to the new homepage design with fixture data, keeping the live weekly plan.

**Architecture:** A fixture-only Alpine factory `homeSnapshot()` is the data seam; five new presentational components under `components/layout/home/` bind to it. The existing `homeWeek()` scope keeps driving the restyled weekly plan. Heatmap reuses `StatsDensityHeatmap` fed through the real `heatStamps()` pipeline.

**Tech Stack:** Astro 5 (prerendered page), Alpine.js, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-07-home-redesign-design.md`

## Global Constraints

- Branch `feat/home-redesign`; commit per task; never push to `main`. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- All commands run from `app/`: `npm test`, `npm run validate:app`, `npm run format`, `bash ../scripts/check-astro-conventions.sh`.
- No `.ts` under `components/` or `pages/` (except `pages/api/`).
- Exported types live in a `types.ts` barrel, re-exported by `src/lib/types.ts`.
- No inline `//` comments inside function bodies; JSDoc only.
- Never `font-medium`, `class:list`, `{...rest}`, important modifier, raw palette utilities (`bg-sky-*`), or raw oklch in components — colours via tokens / `global.css`.
- Every `x-show` paired with `x-cloak`; `x-data="factory()"` always invoked; no `x-init`.
- Astro frontmatter order: `interface Props` → `// Props` → imports (`// Components`, `// Icons`, `// Lib`) → `// Data` → `// Styles`, blank line before each `// Title`.
- Standalone actions render through `components/forms/Button.astro`.
- Design values (2a): hero `FIRST-9 AVERAGE` / `72.4` / delta `1.8` / `last 30 days`; resume `501`, `vs Dartbot · Leg 3 of 5 · 2–0`, `141`, `STARTED 18 MIN AGO`; tiles `BEST AVG 84.6 501 · Sep 12`, `TOP OUT 121 Hit 1×`, `DARTS 18,342 Career`; daily M–S `61.2, 66.8, 58.4, 70.3, 74.1, 68.9, 71.5`.

## Review Focus

- Peak ties (two days share the max): expect every max-valued bar highlighted → `dailyBars` test in Task 1.
- A daily value outside 50–75 (e.g. 45 or 80) must not produce negative or >100% bar heights → clamp test in Task 1.
- Heat cells near the board edge must still map to stamps inside 0–1 → bounds test in Task 1.
- Empty daily list (data pass, no games yet) must give peak `—` rather than `-Infinity` → test in Task 1.
- Resume button must navigate even though `Button` renders a `<button>` (not an anchor) → `resumeGame()` navigation test in Task 1.

---

### Task 1: `homeSnapshot()` fixture factory

**Files:**
- Create: `app/src/lib/home/types.ts`
- Create: `app/src/lib/home/home-snapshot.data.ts`
- Modify: `app/src/lib/types.ts` (add barrel line)
- Modify: `app/src/lib/client/alpine/register-route-data.ts` (import + `Alpine.data`)
- Test: `app/tests/lib/home/home-snapshot.data.test.ts`
- Test: `app/tests/lib/client/alpine/register-route-data.test.ts` (registration case)

**Interfaces:**
- Produces: `homeSnapshot(): HomeSnapshotContext` registered as Alpine `homeSnapshot`; pure `dailyPeak(days: DailyAverage[]): string`, `barHeight(value: number): string`, `dailyBars(days: DailyAverage[]): DailyBar[]`; scope fields `hero`, `resume`, `careerTiles`, `dailyAverage`, `peak`, `bars`, `landing`, methods `navigate(path)`, `resumeGame()`.
- Types: `HomeHero`, `HomeResume`, `CareerTile`, `DailyAverage`, `DailyBar`, `HomeLanding`, `HomeSnapshotContext`.

- [ ] **Step 1: Write the failing test**

`app/tests/lib/home/home-snapshot.data.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import {
  barHeight,
  dailyBars,
  dailyPeak,
  homeSnapshot,
} from "@lib/home/home-snapshot.data";

describe("dailyPeak", () => {
  it("formats the max to two decimals", () => {
    expect(
      dailyPeak([
        { day: "M", value: 61.2 },
        { day: "T", value: 74.1 },
      ]),
    ).toBe("74.10");
  });

  it("is a dash with no days", () => {
    expect(dailyPeak([])).toBe("—");
  });
});

describe("barHeight", () => {
  it("maps 50–75 onto 0–100%", () => {
    expect(barHeight(50)).toBe("0%");
    expect(barHeight(62.5)).toBe("50%");
    expect(barHeight(75)).toBe("100%");
  });

  it("clamps outside the range", () => {
    expect(barHeight(45)).toBe("0%");
    expect(barHeight(80)).toBe("100%");
  });
});

describe("dailyBars", () => {
  it("marks every max-valued day as peak", () => {
    const bars = dailyBars([
      { day: "M", value: 70 },
      { day: "T", value: 74.1 },
      { day: "W", value: 74.1 },
    ]);
    expect(bars.map((b) => b.peak)).toEqual([false, true, true]);
    expect(bars[0].height).toBe("80%");
  });

  it("is empty with no days", () => {
    expect(dailyBars([])).toEqual([]);
  });
});

describe("homeSnapshot", () => {
  it("carries the design fixture", () => {
    const s = homeSnapshot();
    expect(s.hero.value).toBe("72.4");
    expect(s.careerTiles).toHaveLength(3);
    expect(s.dailyAverage.map((d) => d.day).join("")).toBe("MTWTFSS");
    expect(s.peak).toBe("74.10");
  });

  it("highlights Friday in the fixture", () => {
    const s = homeSnapshot();
    const peaks = s.bars.filter((b) => b.peak).map((b) => b.day);
    expect(peaks).toEqual(["F"]);
    expect(s.bars).toHaveLength(7);
  });

  it("keeps every heat stamp inside the board canvas", () => {
    const { stamps } = homeSnapshot().landing;
    expect(stamps.length).toBeGreaterThan(0);
    for (const s of stamps) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
      expect(s.radius).toBeGreaterThan(0);
      expect(s.alpha).toBeGreaterThan(0);
    }
  });

  it("navigates to the resume target", () => {
    const s = homeSnapshot();
    const navigate = vi.fn();
    s.navigate = navigate;
    s.resumeGame();
    expect(navigate).toHaveBeenCalledWith("/games");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/home/home-snapshot.data.test.ts`
Expected: FAIL — cannot resolve `@lib/home/home-snapshot.data`.

- [ ] **Step 3: Write types**

`app/src/lib/home/types.ts`:

```ts
import type { HeatStamp } from "@modules/types";

/** Homepage hero stat: label, headline value and its change over a window. */
export type HomeHero = {
  label: string;
  value: string;
  delta: string;
  window: string;
};

/** The in-progress game the homepage offers to resume. */
export type HomeResume = {
  game: string;
  detail: string;
  remaining: string;
  started: string;
  href: string;
};

/** One career tile: mono key, display value, muted hint. */
export type CareerTile = { key: string; value: string; hint: string };

/** One weekday's average for the daily-average card. */
export type DailyAverage = { day: string; value: number };

/** One rendered bar of the daily-average card. */
export type DailyBar = { day: string; height: string; peak: boolean };

/** The landing heatmap card: its window label and canvas stamps. */
export type HomeLanding = { window: string; stamps: HeatStamp[] };

/** The `homeSnapshot()` Alpine scope. */
export type HomeSnapshotContext = {
  hero: HomeHero;
  resume: HomeResume;
  careerTiles: CareerTile[];
  dailyAverage: DailyAverage[];
  peak: string;
  bars: DailyBar[];
  landing: HomeLanding;
  navigate(path: string): void;
  resumeGame(this: HomeSnapshotContext): void;
};
```

Add to `app/src/lib/types.ts` (alphabetical with siblings):

```ts
export * from "./home/types";
```

- [ ] **Step 4: Write the factory**

`app/src/lib/home/home-snapshot.data.ts`:

```ts
import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import { heatStamps } from "@modules/stats/sections/heatmap-density.module";
import type { HeatmapMetrics } from "@modules/types";
import type {
  CareerTile,
  DailyAverage,
  DailyBar,
  HomeSnapshotContext,
} from "./types";

const BOARD_SPAN_MM = BOARD_RADII_MM.surroundOuter * 2;

const BAR_FLOOR = 50;
const BAR_RANGE = 25;

const DAILY: DailyAverage[] = [
  { day: "M", value: 61.2 },
  { day: "T", value: 66.8 },
  { day: "W", value: 58.4 },
  { day: "T", value: 70.3 },
  { day: "F", value: 74.1 },
  { day: "S", value: 68.9 },
  { day: "S", value: 71.5 },
];

const CAREER: CareerTile[] = [
  { key: "BEST AVG", value: "84.6", hint: "501 · Sep 12" },
  { key: "TOP OUT", value: "121", hint: "Hit 1×" },
  { key: "DARTS", value: "18,342", hint: "Career" },
];

/** Fixture landing cells (4 mm grid, mm from the bull): T20 heaviest, then S20, S1/S5, bull, a few strays. */
const LANDING: HeatmapMetrics = {
  cellMm: 4,
  target: null,
  cells: [
    [-1, -26, 30],
    [0, -26, 38],
    [1, -26, 24],
    [0, -25, 18],
    [0, -27, 14],
    [-1, -34, 10],
    [0, -34, 14],
    [0, -33, 9],
    [1, -35, 6],
    [-7, -23, 8],
    [-8, -24, 5],
    [7, -24, 7],
    [8, -23, 4],
    [0, 0, 6],
    [-1, 0, 4],
    [37, -13, 3],
    [-13, -39, 3],
  ],
};

/** The highest daily average to two decimals, or a dash with no days. */
export function dailyPeak(days: DailyAverage[]): string {
  if (days.length === 0) return "—";
  return Math.max(...days.map((d) => d.value)).toFixed(2);
}

/** A bar's CSS height: `value` mapped from 50–75 onto 0–100%, clamped. */
export function barHeight(value: number): string {
  const pct = ((value - BAR_FLOOR) / BAR_RANGE) * 100;
  return `${Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10}%`;
}

/** One bar per day; every day sharing the highest value is a peak. */
export function dailyBars(days: DailyAverage[]): DailyBar[] {
  const max = Math.max(...days.map((d) => d.value));
  return days.map((d) => ({
    day: d.day,
    height: barHeight(d.value),
    peak: d.value === max,
  }));
}

/**
 * Homepage stat sections. Fixture values from the design until the data
 * pass replaces them with reads; the returned shape is the contract.
 */
export function homeSnapshot(): HomeSnapshotContext {
  return {
    hero: {
      label: "FIRST-9 AVERAGE",
      value: "72.4",
      delta: "1.8",
      window: "last 30 days",
    },
    resume: {
      game: "501",
      detail: "vs Dartbot · Leg 3 of 5 · 2–0",
      remaining: "141",
      started: "STARTED 18 MIN AGO",
      href: "/games",
    },
    careerTiles: CAREER,
    dailyAverage: DAILY,
    peak: dailyPeak(DAILY),
    bars: dailyBars(DAILY),
    landing: {
      window: "LAST 30 DAYS",
      stamps: heatStamps(LANDING, BOARD_SPAN_MM),
    },

    navigate(path: string) {
      globalThis.location.href = path;
    },

    resumeGame(this: HomeSnapshotContext) {
      this.navigate(this.resume.href);
    },
  };
}
```

- [ ] **Step 5: Register the factory**

In `app/src/lib/client/alpine/register-route-data.ts`, next to the `homeWeek` import (line ~41):

```ts
import { homeSnapshot } from "@lib/home/home-snapshot.data";
```

and next to `Alpine.data("homeWeek", homeWeek);` (line ~83):

```ts
  Alpine.data("homeSnapshot", homeSnapshot);
```

Append to `app/tests/lib/client/alpine/register-route-data.test.ts` (import `homeSnapshot` from `@lib/home/home-snapshot.data` beside the `homeWeek` import), inside the `describe`:

```ts
  it("registers homeSnapshot as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("homeSnapshot", homeSnapshot);
  });
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- tests/lib/home tests/lib/client/alpine/register-route-data.test.ts`
Expected: PASS. Then `npm test` — full suite green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/home src/lib/types.ts src/lib/client/alpine/register-route-data.ts tests/lib/home tests/lib/client/alpine/register-route-data.test.ts
git commit -m "feat(home): homeSnapshot fixture factory"
```

---

### Task 2: Icon and home styles

**Files:**
- Create: `app/src/icons/play-rounded.svg`
- Modify: `app/src/styles/global.css` (`:root`, `@theme inline`, `@layer components`)

**Interfaces:**
- Produces: `@icons/play-rounded.svg`; CSS classes `home-feature-card`, `home-day-today`; colour token `accent-deep` (`bg-accent-deep`).

- [ ] **Step 1: Add the icon** (C2PA metadata stripped, `currentColor`)

`app/src/icons/play-rounded.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round" d="M8.5 6.6c0-.8.9-1.3 1.6-.9l8.2 5.4c.6.4.6 1.4 0 1.8l-8.2 5.4c-.7.4-1.6-.1-1.6-.9z"/></svg>
```

- [ ] **Step 2: Add tokens**

In `global.css` `:root`, after `--accent-secondary`:

```css
  --accent-deep: oklch(14% 0.05 245 / 0.9);
```

In `@theme inline`, after `--color-accent-secondary`:

```css
  --color-accent-deep: var(--accent-deep);
```

- [ ] **Step 3: Add component classes**

In `@layer components`, after `.btn-error { … }`:

```css
  .home-feature-card {
    background: linear-gradient(
      138deg,
      color-mix(in oklch, var(--accent) 45%, transparent) 22%,
      var(--accent-deep) 82%
    );
    box-shadow:
      inset 0 1px 0 oklch(100% 0 0 / 0.1),
      0 0 20px 3px color-mix(in oklch, var(--accent) 12%, transparent),
      0 0 40px 20px color-mix(in oklch, var(--accent) 8%, transparent),
      inset 0 0 0 1px oklch(100% 0 0 / 0.06);
  }

  .home-day-today {
    background: linear-gradient(
      180deg,
      color-mix(in oklch, var(--accent) 45%, transparent),
      color-mix(in oklch, var(--accent) 12%, transparent)
    );
    box-shadow:
      inset 0 0 0 2px var(--accent),
      0 0 14px 3px color-mix(in oklch, var(--accent) 60%, transparent),
      0 0 28px 6px color-mix(in oklch, var(--accent) 25%, transparent);
  }
```

- [ ] **Step 4: Verify**

Run: `npm run validate:app`
Expected: 0 errors / warnings / hints.

- [ ] **Step 5: Commit**

```bash
git add src/icons/play-rounded.svg src/styles/global.css
git commit -m "feat(home): play-rounded icon and home card styles"
```

---

### Task 3: Stat sections and page composition

**Files:**
- Create: `app/src/components/layout/home/HomeHero.astro`
- Create: `app/src/components/layout/home/ResumeGameCard.astro`
- Create: `app/src/components/layout/home/CareerTiles.astro`
- Create: `app/src/components/layout/home/DailyAverageCard.astro`
- Create: `app/src/components/layout/home/LandingHeatmapCard.astro`
- Modify: `app/src/pages/index.astro`

**Interfaces:**
- Consumes: `homeSnapshot()` scope (Task 1); `home-feature-card`, `@icons/play-rounded.svg` (Task 2); `StatsDensityHeatmap` (`stampsExpr`); `Button` (`variant`, `loadingExpr`, `iconBefore` slot).

- [ ] **Step 1: `HomeHero.astro`**

```astro
---
/**
 * Homepage hero stat inside the `homeSnapshot()` scope: mono eyebrow,
 * display-size value, and its change over the window with the delta in
 * accent.
 */
---

<div class="flex flex-col gap-2.5 px-1 pt-9 pb-7">
  <span
    class="font-mono text-xs font-semibold tracking-widest text-muted-foreground"
    x-text="hero.label"
  ></span>
  <span
    class="font-display text-7xl leading-none tracking-tight"
    x-text="hero.value"
  ></span>
  <span class="text-sm text-muted">
    Up <span
      class="font-semibold text-accent"
      x-text="hero.delta"
    ></span> in the <span x-text="hero.window"></span>
  </span>
</div>
```

- [ ] **Step 2: `ResumeGameCard.astro`**

```astro
---
/**
 * Homepage card for the in-progress game inside the `homeSnapshot()`
 * scope: game, detail and remaining score, with a Resume button calling
 * `resumeGame()`. Always shown in the static pass.
 */

// Components
import Button from "@components/forms/Button.astro";

// Icons
import PlayIcon from "@icons/play-rounded.svg";
---

<section class="home-feature-card flex flex-col gap-3.5 rounded-2xl p-4 backdrop-blur-sm">
  <div class="flex items-center justify-between font-mono text-xs font-semibold">
    <span class="tracking-widest text-foreground">IN PROGRESS</span>
    <span
      class="text-foreground/90"
      x-text="resume.started"
    ></span>
  </div>
  <div class="flex items-end justify-between gap-3">
    <div class="flex flex-col gap-1.5">
      <span
        class="font-display text-xl"
        x-text="resume.game"
      ></span>
      <span
        class="text-sm font-semibold text-foreground/90"
        x-text="resume.detail"
      ></span>
    </div>
    <div class="flex flex-col items-end gap-0.5">
      <span
        class="font-display text-3xl leading-none"
        x-text="resume.remaining"
      ></span>
      <span class="font-mono text-[10px] font-semibold tracking-widest text-foreground/90">TO GO</span>
    </div>
  </div>
  <Button
    title="Resume game"
    variant="secondary"
    loadingExpr="false"
    class="glass-raised h-12 w-full rounded-lg text-base"
    @click="resumeGame()"
  >
    <PlayIcon
      slot="iconBefore"
      class="size-4.5"
      aria-hidden="true"
    />
  </Button>
</section>
```

- [ ] **Step 3: `CareerTiles.astro`**

```astro
---
/**
 * Homepage row of three career tiles inside the `homeSnapshot()` scope:
 * mono key, display value, muted hint per tile.
 */
---

<div class="grid grid-cols-3 gap-2.5">
  <template
    x-for="tile in careerTiles"
    :key="tile.key"
  >
    <div class="glass flex flex-col gap-1.5 rounded-xl px-3 py-3.5">
      <span
        class="truncate font-mono text-[10px] font-semibold tracking-wider text-muted-foreground"
        x-text="tile.key"
      ></span>
      <span
        class="font-display text-lg"
        x-text="tile.value"
      ></span>
      <span
        class="text-[11px] text-muted"
        x-text="tile.hint"
      ></span>
    </div>
  </template>
</div>
```

- [ ] **Step 4: `DailyAverageCard.astro`**

```astro
---
/**
 * Homepage daily-average card inside the `homeSnapshot()` scope: seven
 * CSS bars sized by `bars[].height`, every peak day in full accent, the
 * rest in muted accent, with the peak value in the header.
 */
---

<section class="glass flex flex-col gap-3.5 rounded-2xl p-4">
  <div class="flex items-baseline justify-between">
    <h2 class="font-display text-[13px] tracking-wide">Daily average</h2>
    <span
      class="font-mono text-[11px] text-muted-foreground"
      x-text="`PEAK ${peak}`"
    ></span>
  </div>
  <div class="grid h-28 grid-cols-7 items-end gap-2">
    <template
      x-for="(bar, index) in bars"
      :key="index"
    >
      <div class="flex h-full flex-col items-center justify-end gap-1.5">
        <div
          class="w-full rounded-lg"
          :class="bar.peak ? 'bg-accent' : 'bg-accent/35'"
          :style="{ height: bar.height }"
        ></div>
        <span
          class="font-mono text-[11px] text-muted-foreground"
          x-text="bar.day"
        ></span>
      </div>
    </template>
  </div>
</section>
```

- [ ] **Step 5: `LandingHeatmapCard.astro`**

```astro
---
/**
 * Homepage "Where you land" card inside the `homeSnapshot()` scope: the
 * density heatmap board fed `landing.stamps`, with the window label.
 */

// Components
import StatsDensityHeatmap from "@components/ui/StatsDensityHeatmap.astro";
---

<section class="glass flex flex-col gap-1.5 rounded-2xl px-3.5 pt-3.5 pb-1.5">
  <div class="flex items-baseline justify-between">
    <h2 class="font-display text-[13px] tracking-wide">Where you land</h2>
    <span
      class="font-mono text-[11px] font-semibold text-muted-foreground"
      x-text="landing.window"
    ></span>
  </div>
  <StatsDensityHeatmap
    stampsExpr="landing.stamps"
    class="mx-auto aspect-square w-full max-w-72"
  />
</section>
```

- [ ] **Step 6: Rewrite `index.astro`**

Weekly plan components are placed here unchanged; Task 4 restyles them.

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import HomeHero from "@components/layout/home/HomeHero.astro";
import ResumeGameCard from "@components/layout/home/ResumeGameCard.astro";
import CareerTiles from "@components/layout/home/CareerTiles.astro";
import DailyAverageCard from "@components/layout/home/DailyAverageCard.astro";
import LandingHeatmapCard from "@components/layout/home/LandingHeatmapCard.astro";
import WeekdayStrip from "@components/layout/home/WeekdayStrip.astro";
import TodayRoutineCard from "@components/layout/home/TodayRoutineCard.astro";
import LogoLockup from "../assets/logo-lockup.svg";
---

<AppLayout title="Home">
  <div class="flex flex-col gap-3 px-4 pt-2">
    <div class="flex items-center px-1 pt-1.5 pb-1">
      <LogoLockup
        aria-label="Darts Analytics"
        class="h-9.5 w-27.5"
      />
    </div>
    <div
      class="flex flex-col gap-3"
      x-data="homeSnapshot()"
    >
      <HomeHero />
      <ResumeGameCard />
      <CareerTiles />
      <DailyAverageCard />
    </div>
    <div x-data="homeWeek()">
      <WeekdayStrip />
      <TodayRoutineCard />
    </div>
    <div x-data="homeSnapshot()">
      <LandingHeatmapCard />
    </div>
  </div>
</AppLayout>
```

- [ ] **Step 7: Verify**

Run: `npm run format && npm run validate:app && bash ../scripts/check-astro-conventions.sh`
Expected: all pass, 0 hints.

Run the app (`run` skill) and open `/` at 390px width. Compare against design 2a: hero, resume card, three tiles, seven bars with Friday highlighted, heatmap hot on T20. `LogoutButton` is gone from home (moved in Task 5).

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/home src/pages/index.astro
git commit -m "feat(home): redesigned stat sections with fixture data"
```

---

### Task 4: Weekly plan restyle (live)

**Files:**
- Modify: `app/src/components/layout/home/TodayRoutineCard.astro`
- Modify: `app/src/components/layout/home/WeekdayStrip.astro`
- Modify: `app/src/pages/index.astro` (weekly block)

**Interfaces:**
- Consumes: `homeWeek()` unchanged — `schedule`, `todayEntry()`, `isRestDay()`, `showStart()`, `showDone()`, `start()`, `isToday(i)`, `hasRoutine(i)`; `home-feature-card`, `home-day-today` (Task 2).
- Produces: `TodayRoutineCard` now owns the card shell and renders `<slot />` (the strip) inside its start state.

- [ ] **Step 1: Rewrite `WeekdayStrip.astro`**

```astro
---
/**
 * Homepage weekday strip: seven day-initial circles in one row. Reads
 * `isToday(index)`/`hasRoutine(index)` from the enclosing `homeWeek()`
 * scope — today larger with the accent glow ring, a day with a scheduled
 * routine in a bright border, a rest day in a faint one.
 */
import { weekdayNames } from "@lib/training/schedules/today";

// Data
const letters = weekdayNames().map((name) => name.charAt(0).toLowerCase());
---

<div class="flex h-11 items-center justify-between">
  <template
    x-for={`(letter, index) in ${JSON.stringify(letters)}`}
    :key="index"
  >
    <span
      class="flex items-center justify-center rounded-full text-[13px] transition-[transform,color,border-color] duration-150"
      :class="isToday(index) ? 'home-day-today size-10.5 text-[15px] font-bold text-foreground' : (hasRoutine(index) ? 'size-8.5 border-2 border-white/50 text-foreground' : 'size-8.5 border-2 border-border text-muted')"
      x-text="letter"
    ></span>
  </template>
</div>
```

- [ ] **Step 2: Rewrite `TodayRoutineCard.astro`**

```astro
---
/**
 * Homepage weekly-plan card inside the `homeWeek()` scope. While today's
 * routine is not done: "Weekly plan" with the routine name and minutes
 * (or "Rest day") and a round play button calling `start()`, then the
 * default slot (the weekday strip). Once done: the accent "COMPLETED"
 * card. Renders nothing without an active schedule.
 */

// Components
import Button from "@components/forms/Button.astro";

// Icons
import PlayIcon from "@icons/play-rounded.svg";
---

<section
  class="glass flex flex-col gap-3.5 rounded-2xl p-4"
  x-show="showStart()"
  x-cloak
>
  <div class="flex items-center justify-between gap-3">
    <div class="flex flex-col gap-1.5">
      <h2 class="font-display text-[13px] tracking-wide">Weekly plan</h2>
      <a
        href="/training/schedules"
        class="text-xs text-muted"
        x-show="!isRestDay()"
        x-cloak
        x-text="`${todayEntry()?.routineName} · ${todayEntry()?.routineMinutes} min`"
      ></a>
      <a
        href="/training/schedules"
        class="text-xs text-muted"
        x-show="isRestDay()"
        x-cloak
      >
        Rest day
      </a>
    </div>
    <Button
      variant="secondary"
      icon
      ariaLabel="Start session"
      loadingExpr="false"
      class="glass-raised size-11 shrink-0 rounded-full"
      x-show="!isRestDay()"
      x-cloak
      @click="start()"
    >
      <PlayIcon
        slot="iconBefore"
        class="size-4.5"
        aria-hidden="true"
      />
    </Button>
  </div>
  <slot />
</section>
<section
  class="home-feature-card flex flex-col gap-2 rounded-2xl p-4"
  x-show="showDone()"
  x-cloak
>
  <div class="flex items-center justify-between">
    <h2 class="font-display text-[13px] tracking-wide">Weekly plan</h2>
    <span class="font-mono text-[11px] font-semibold tracking-widest text-foreground">COMPLETED</span>
  </div>
  <span class="text-base font-bold">You're on fire!</span>
  <span
    class="text-xs font-semibold text-foreground/90"
    x-text="`${todayEntry()?.routineName} done for today.`"
  ></span>
</section>
```

- [ ] **Step 3: Nest the strip in `index.astro`**

Replace the weekly block:

```astro
    <div x-data="homeWeek()">
      <TodayRoutineCard>
        <WeekdayStrip />
      </TodayRoutineCard>
    </div>
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run format && npm run validate:app && bash ../scripts/check-astro-conventions.sh`
Expected: all pass.

In the running app with an active schedule: start state shows the routine line and play button, today's circle glows, and play navigates to the routine. After completing today's routine, the COMPLETED card shows. With no active schedule nothing renders. On a rest day there's no play button. Compare with designs 2a/2b.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/home/TodayRoutineCard.astro src/components/layout/home/WeekdayStrip.astro src/pages/index.astro
git commit -m "feat(home): restyle live weekly plan card"
```

---

### Task 5: Move logout to Profile

**Files:**
- Modify: `app/src/pages/profile/index.astro`

- [ ] **Step 1: Add the button**

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import AppModeForm from "@components/forms/AppModeForm.astro";
import PlayerSettingsCard from "@components/forms/PlayerSettingsCard.astro";
import LogoutButton from "@components/ui/LogoutButton.astro";
---

<AppLayout title="Profile">
  <div class="p-4 space-y-6">
    <h1 class="text-xl font-semibold text-foreground">Profile</h1>
    <PlayerSettingsCard />
    <AppModeForm />
    <LogoutButton />
  </div>
</AppLayout>
```

- [ ] **Step 2: Verify**

Run: `npm run validate:app`. In the app, `/profile` shows logout; clicking it logs out to `/login`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/profile/index.astro
git commit -m "feat(profile): host logout button"
```

---

### Task 6: Docs, context maintenance, gates

**Files:**
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md` (`components/layout/home/` table)
- Modify: `decisions/frontend/style.md` (append D425)
- Modify: `docs/superpowers/specs/2026-10-07-home-redesign-design.md` (Status → implemented)

- [ ] **Step 1: Inventory rows**

Replace the two existing rows and add five, all dated 2026-10-07:

```markdown
| `HomeHero.astro` | Homepage hero stat: mono eyebrow, `font-display text-7xl` value, "Up <delta> in the <window>" with the delta in accent (2026-10-07) | none — reads `homeSnapshot()` from the parent scope |
| `ResumeGameCard.astro` | Accent-gradient (`home-feature-card`) card for the in-progress game: game, detail, remaining "TO GO", a `glass-raised` Resume `Button` with `play-rounded` calling `resumeGame()`. Always shown in the static pass (2026-10-07) | none — reads `homeSnapshot()` from the parent scope |
| `CareerTiles.astro` | Three-column grid of `glass` tiles: mono key, display value, muted hint (2026-10-07) | none — reads `homeSnapshot()` from the parent scope |
| `DailyAverageCard.astro` | `glass` card of seven CSS bars sized by `bars[].height`, peak days in `bg-accent`, others `bg-accent/35`, `PEAK` value in the header; no Chart.js (2026-10-07) | none — reads `homeSnapshot()` from the parent scope |
| `LandingHeatmapCard.astro` | "Where you land" `glass` card around `StatsDensityHeatmap` fed `landing.stamps` (2026-10-07) | none — reads `homeSnapshot()` from the parent scope |
| `WeekdayStrip.astro` | Row of seven day-initial circles inside `TodayRoutineCard`. Today `size-10.5` with the `home-day-today` accent glow ring; a day with a routine `border-white/50`; a rest day `border-border` muted. Letters from `weekdayNames()` (2026-09-22; restyled 2026-10-07) | none — reads `homeWeek()` from the parent scope |
| `TodayRoutineCard.astro` | Homepage "Weekly plan" card: while today's routine is not done, the routine name and minutes (or "Rest day") linking to `/training/schedules`, a round `glass-raised` play `Button` (`start()`), then the default slot (`WeekdayStrip`). Once done, a `home-feature-card` "COMPLETED · You're on fire!" state. Nothing with no active schedule (2026-09-23; restyled 2026-10-07) | default slot (weekday strip) — reads `homeWeek()` from the parent scope |
```

- [ ] **Step 2: Decision D425**

Append to `decisions/frontend/style.md`:

```markdown
### D425 — Homepage redesign, static pass behind `homeSnapshot()`
Status: Accepted · Date: 2026-10-07
Decision: the home page follows the Claude Design "Darts Home" mock. It has a hero stat, a resume card, career tiles, a daily-average bar card, the weekly plan and a "Where you land" heatmap. The stat sections bind to `homeSnapshot()` (`lib/home/home-snapshot.data.ts`), a fixture-only Alpine factory whose returned shape is the contract for the later data pass. The weekly plan stays live on `homeWeek()`, restyled. Display values use Michroma (`font-display`), per the design. Bars are plain CSS, not Chart.js. The heatmap reuses `StatsDensityHeatmap` through `heatStamps()`. `LogoutButton` moves to `/profile`. The design's colours that no token covered became `--accent-deep`, `.home-feature-card` and `.home-day-today`.
Reason: ship the redesign now without blocking on new views. A single factory seam means the data pass swaps internals, not markup.
Consequences: home shows sample numbers and an always-visible resume card linking to `/games` until the data pass. Per-day done/missed markers and the weekly "2 of 4" ring are deferred, because they need weekly completion history. `.astro`/CSS carry no unit test (D101); `homeSnapshot()` derivations are tested.
Supersedes: none.
```

- [ ] **Step 3: Spec status**

In the spec header change `**Status:** approved` → `**Status:** implemented` and `to be recorded in decisions/frontend/ at completion` → `D425 (decisions/frontend/style.md)`.

- [ ] **Step 4: Capture deferred work**

Per `capturing-discovered-work`: open one GitHub issue (`discovered-work` label), "Home: wire homeSnapshot to real data + weekly done/missed markers", citing D425.

- [ ] **Step 5: Run context-maintenance and gates**

Run the `context-maintenance` skill (map, CLAUDE.md, graph), then the `run-all-gates` skill. Expected: every script reports OK/PASS.

- [ ] **Step 6: Commit**

```bash
git add docs decisions
git commit -m "docs(home): inventory, D425, spec status"
```

- [ ] **Step 7: Finish**

`superpowers:finishing-a-development-branch` + `finishing-a-dart-branch`: push, open PR to `main`.
