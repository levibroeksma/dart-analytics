# Games + Training Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `/games` and `/training` to match `Games.dc.html` / `Training.dc.html` pixel for pixel at 390px, wiring every element existing code backs.

**Architecture:** Pure helpers (grouping, resume pick, week status) carry the logic and are unit-tested; Alpine factories expose them; Astro components render with tokens/classes from `global.css`. No API or schema change.

**Tech Stack:** Astro, Alpine.js, Tailwind v4 (`global.css` tokens), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-07-games-training-redesign-design.md`

## Global Constraints

- Raw oklch only in `app/src/styles/global.css`; components use tokens/classes.
- Never `font-medium` (banned repo-wide); design weight 500 renders as 400.
- Michroma = `font-display`; mono = `font-mono`, only for eyebrows/chips.
- Card glass = `glass shadow-none rounded-2xl` (design cards have no shadow).
- Run commands from `app/`: `npm test`, `npm run check`.
- Commits: conventional, scope `games`/`training`, end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Player in a mode where a whole group has no visible game → group eyebrow and card hidden, not an empty card (Task 3 test `groupVisible`).
- First game of a group hidden by mode → next visible row has no top divider (Task 3 test `isFirstVisible`).
- Active session for a ruleset with no card (training step, `null` key) → no resume card (Task 3 `resumeTarget` test).
- Routine completed today → today shows done, not the glow; counts it done, not to-go (Task 5 test).
- Rest day today → glow, not counted to-go (Task 5 test).

---

### Task 1: Tokens, classes, icons

**Files:**
- Modify: `app/src/styles/global.css`
- Create: `app/src/icons/check-bold.svg`, `app/src/icons/cross-bold.svg`

- [ ] **Step 1: Tokens.** In `:root` after `--success-muted` add:

```css
  --missed: oklch(68% 0.15 30);
  --missed-muted: oklch(68% 0.15 30 / 0.12);
  --chip-foreground: oklch(82% 0 0);
```

In `@theme` after `--color-success-muted` add:

```css
  --color-missed: var(--missed);
  --color-missed-muted: var(--missed-muted);
  --color-chip-foreground: var(--chip-foreground);
```

- [ ] **Step 2: Classes.** Replace `.home-feature-card` block with:

```css
  .feature-card {
    background: linear-gradient(
      138deg,
      color-mix(in oklch, var(--accent) 45%, transparent) 22%,
      var(--accent-deep) 82%
    );
    box-shadow:
      inset 0 1px 0 oklch(100% 0 0 / 0.1),
      0 0 20px 3px color-mix(in oklch, var(--accent) 12%, transparent),
      inset 0 0 0 1px oklch(100% 0 0 / 0.06);
    @apply backdrop-blur-sm;
  }

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

  .mode-pill {
    @apply rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.08em] backdrop-blur-sm;
    color: oklch(92% 0.06 237);
    background: radial-gradient(
      at 50% 0%,
      color-mix(in oklch, var(--accent) 35%, transparent),
      oklch(40% 0.12 240 / 0.55) 85%
    );
    border-top: 1px solid oklch(80% 0.12 237 / 0.5);
    border-bottom: 1px solid color-mix(in oklch, var(--accent) 30%, transparent);
  }

  .section-eyebrow {
    @apply px-1 font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-foreground;
  }
```

(`home-feature-card` keeps its exact current values — home unchanged.)

- [ ] **Step 3: Icons** (design paths, `currentColor`):

`check-bold.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>
```
`cross-bold.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M7 7l10 10M17 7L7 17"/></svg>
```

- [ ] **Step 4:** `npm run check` → 0 errors. Commit `feat(games,training): feature-card, mode-pill, missed tokens, bold icons`.

### Task 2: Game groups

**Files:**
- Modify: `app/src/lib/game/types.ts:678` (`GameCardDescriptor`), `app/src/lib/game/rulesets/games-visibility.ts`
- Test: `app/tests/lib/game/rulesets/games-visibility.test.ts`

**Interfaces:**
- Produces: `type GameGroupKey = "MATCH_PLAY" | "TRAINING" | "CLASSICS"`; `GameCardDescriptor.group: GameGroupKey`; `GAME_GROUPS: readonly { key: GameGroupKey; title: string }[]`; `groupedGames(cards?: readonly GameCardDescriptor[]): { key: GameGroupKey; title: string; games: GameCardDescriptor[] }[]`.

- [ ] **Step 1: Failing tests.** Re-point the display-order assertion (`shows every carded game under recreational`) to the new order: `501_V1, 121_V1, CRICKET_V1, TACTICS_V1, SCORE_TRAINING_V1, SINGLES_V1, DOUBLES_TRAINING_V1, BOBS27_V1, TUOD_V1, SHANGHAI_V1, AROUND_THE_CLOCK_V1` (same guarantee: list is display order). Add:

```ts
describe("groupedGames", () => {
  it("groups every card in design order", () => {
    expect(
      groupedGames().map((g) => [g.title, g.games.map((x) => x.rulesetVersionKey)]),
    ).toEqual([
      ["MATCH PLAY", ["501_V1", "121_V1", "CRICKET_V1", "TACTICS_V1"]],
      ["TRAINING", ["SCORE_TRAINING_V1", "SINGLES_V1", "DOUBLES_TRAINING_V1", "BOBS27_V1", "TUOD_V1"]],
      ["CLASSICS", ["SHANGHAI_V1", "AROUND_THE_CLOCK_V1"]],
    ]);
  });

  it("drops a group with no cards", () => {
    const only501 = GAME_CARDS.filter((g) => g.rulesetVersionKey === "501_V1");
    expect(groupedGames(only501).map((g) => g.key)).toEqual(["MATCH_PLAY"]);
  });

  it("puts every card in a known group", () => {
    const keys = GAME_GROUPS.map((g) => g.key);
    for (const card of GAME_CARDS) expect(keys).toContain(card.group);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/lib/game/rulesets/games-visibility.test.ts` → FAIL (`groupedGames` missing).
- [ ] **Step 3: Implement.** Add `group` to the type; add `GameGroupKey`. Reorder `GAME_CARDS` to the order above, each with its `group`. Add:

```ts
export const GAME_GROUPS: readonly { key: GameGroupKey; title: string }[] = [
  { key: "MATCH_PLAY", title: "MATCH PLAY" },
  { key: "TRAINING", title: "TRAINING" },
  { key: "CLASSICS", title: "CLASSICS" },
];

/** `cards` bucketed by `GAME_GROUPS` order, keeping card order; empty groups dropped. */
export function groupedGames(cards: readonly GameCardDescriptor[] = GAME_CARDS) {
  return GAME_GROUPS.map((group) => ({
    ...group,
    games: cards.filter((card) => card.group === group.key),
  })).filter((group) => group.games.length > 0);
}
```

- [ ] **Step 4:** test → PASS; `npm test` → all pass. Commit `feat(games): group game cards`.

### Task 3: Games index factory

**Files:**
- Modify: `app/src/lib/game/games-index.data.ts`, `app/src/lib/game/types.ts` (`GamesIndexContext`)
- Test: `app/tests/lib/game/games-index.data.test.ts`

**Interfaces:**
- Consumes: `GAME_CARDS`, `GAME_GROUPS`, `GameGroupKey`.
- Produces: `resumeTarget(sessions: SessionActiveData[], cards?: readonly GameCardDescriptor[]): { title: string; href: string } | null`; context fields `activeSession`, `groupVisible(key)`, `isFirstVisible(groupKey, rulesetKey)`.

- [ ] **Step 1: Failing tests** (reuse file's `activeSession`/`trainingStepSession` builders):

```ts
describe("resumeTarget", () => {
  it("picks the most recent session that has a card", () => {
    const older = { ...activeSession("501_V1"), startedAt: "2026-08-08T10:00:00.000Z" };
    const newer = { ...activeSession("CRICKET_V1"), startedAt: "2026-08-09T10:00:00.000Z" };
    expect(resumeTarget([older, newer])).toEqual({
      title: "Cricket",
      href: "/games/cricket/setup",
    });
  });

  it("is null for a training step or no session", () => {
    expect(resumeTarget([trainingStepSession()])).toBeNull();
    expect(resumeTarget([])).toBeNull();
  });
});
```

In `describe("gamesIndex")` add:

```ts
  it("hides a group whose games are all hidden and skips hidden rows for the divider", () => {
    const page = Object.assign(gamesIndex(), { $store: store }) as any;
    page.isVisible = (key: string) => key !== "501_V1";
    expect(page.groupVisible("MATCH_PLAY")).toBe(true);
    expect(page.isFirstVisible("MATCH_PLAY", "121_V1")).toBe(true);
    expect(page.isFirstVisible("MATCH_PLAY", "CRICKET_V1")).toBe(false);
    page.isVisible = () => false;
    expect(page.groupVisible("CLASSICS")).toBe(false);
  });

  it("sets activeSession from the fetched sessions", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([activeSession("501_V1")]);
    const page = Object.assign(gamesIndex(), { $store: store }) as any;
    await page.init();
    expect(page.activeSession).toEqual({ title: "501", href: "/games/501/setup" });
  });

  it("clears activeSession when the fetch fails", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockRejectedValue(new Error("x"));
    const page = Object.assign(gamesIndex(), { $store: store }) as any;
    await page.init();
    expect(page.activeSession).toBeNull();
  });
```

(Match the file's existing construction pattern for `page` if it differs.)

- [ ] **Step 2:** run file → FAIL.
- [ ] **Step 3: Implement** in `games-index.data.ts`:

```ts
/** The most recently started active session that has a game card, as that card's title and setup route (which owns recovery). */
export function resumeTarget(
  sessions: SessionActiveData[],
  cards: readonly GameCardDescriptor[] = GAME_CARDS,
): { title: string; href: string } | null {
  const card = [...sessions]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((s) => cards.find((c) => c.rulesetVersionKey === s.rulesetVersionKey))
    .find((c) => c !== undefined);
  return card ? { title: card.title, href: card.href } : null;
}
```

Factory: add `activeSession: null as { title: string; href: string } | null`; in `init` fetch once into `sessions`, set `activeRulesetKeys` as now and `this.activeSession = resumeTarget(sessions)`; catch sets both empty/null. Add:

```ts
    groupVisible(this: GamesIndexContext, groupKey: GameGroupKey) {
      return GAME_CARDS.some((g) => g.group === groupKey && this.isVisible(g.rulesetVersionKey));
    },

    isFirstVisible(this: GamesIndexContext, groupKey: GameGroupKey, rulesetVersionKey: RulesetVersionKey) {
      const first = GAME_CARDS.find((g) => g.group === groupKey && this.isVisible(g.rulesetVersionKey));
      return first?.rulesetVersionKey === rulesetVersionKey;
    },
```

Extend `GamesIndexContext` with `activeSession`, `groupVisible`, `isFirstVisible`.

- [ ] **Step 4:** tests PASS. Commit `feat(games): resume target and group visibility`.

### Task 4: Games markup

**Files:**
- Create: `app/src/components/layout/games/GameRow.astro`, `app/src/components/layout/games/ResumeSessionCard.astro`
- Modify: `app/src/pages/games/index.astro`

- [ ] **Step 1: `GameRow.astro`**

```astro
---
/**
 * One game row in a `/games` group card: Michroma title, muted caption and
 * the accent dart, linking to the game's setup route. The divider lives
 * on the page's per-row wrapper (it owns `x-show`).
 */
interface Props {
  href: string;
  title: string;
  caption: string;
}
const { href, title, caption }: Props = Astro.props;
import DartIcon from "@icons/dart.svg";
---

<a
  href={href}
  class="flex items-center gap-3.5 py-3.5"
>
  <div class="flex min-w-0 flex-1 flex-col gap-1">
    <span class="font-display text-sm tracking-[0.01em]">{title}</span>
    <span class="text-xs text-muted">{caption}</span>
  </div>
  <DartIcon class="size-6.5 shrink-0 -rotate-45 text-accent" aria-hidden="true" />
</a>
```

- [ ] **Step 2: `ResumeSessionCard.astro`**

```astro
---
/**
 * `/games` in-progress card inside the `gamesIndex()` scope: the most recent
 * active game (`activeSession`) with a Resume link to its setup route. The
 * detail line is static until an active-session progress read exists.
 */
import PlayIcon from "@icons/play-rounded.svg";
---

<section
  class="feature-card flex items-center gap-3 rounded-2xl py-3.5 pr-3.5 pl-4"
  x-show="activeSession"
  x-cloak
>
  <div class="flex min-w-0 flex-1 flex-col gap-1">
    <span class="font-mono text-[10px] font-semibold tracking-[0.14em]">IN PROGRESS</span>
    <span class="font-display text-base" x-text="activeSession?.title"></span>
    <span class="text-xs text-accent-foreground-muted">vs Dartbot · Leg 3 of 5 · 141 to go</span>
  </div>
  <a
    class="glass-button flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold"
    :href="activeSession?.href"
  >
    <PlayIcon class="size-4" aria-hidden="true" />
    Resume
  </a>
</section>
```

- [ ] **Step 3: Page.** Replace content of `games/index.astro` body:

```astro
<AppLayout title="Games">
  <div class="flex flex-col gap-3 px-4 pt-2" x-data="gamesIndex()">
    <div class="flex items-center justify-between px-1 pt-5 pb-3">
      <h1 class="font-display text-[26px] font-normal tracking-[0.02em]">Games</h1>
      <span class="mode-pill" x-show="analyticsMode()" x-cloak>ANALYTICS</span>
    </div>

    <ResumeSessionCard />

    <div class="contents" x-show="!$store.settings.loading" x-cloak>
        {groupedGames().map((group) => (
          <div class="flex flex-col gap-2 pt-2.5" x-show={`groupVisible('${group.key}')`}>
            <span class="section-eyebrow">{group.title}</span>
            <div class="glass shadow-none flex flex-col rounded-2xl px-4">
              {group.games.map((game) => (
                <div x-show={`isVisible('${game.rulesetVersionKey}')`}
                  :class={`isFirstVisible('${group.key}', '${game.rulesetVersionKey}') ? '' : 'border-t border-border'`}>
                  <GameRow href={game.href} title={game.title} caption={game.caption} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <!-- existing no-mode alert, unchanged, x-show="noneVisible()" -->
    </div>

    <!-- skeleton: one glass card, 5 rows -->
    <div class="glass shadow-none flex flex-col rounded-2xl px-4 animate-pulse"
      x-show="$store.settings.loading" x-cloak aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div class:list={["flex items-center gap-3.5 py-3.5", i > 0 && "border-t border-border"]}>
          <div class="flex flex-1 flex-col gap-1">
            <div class="h-4 w-32 rounded bg-surface-raised" />
            <div class="h-3 w-48 rounded bg-surface-raised" />
          </div>
          <DartIcon class="size-6.5 -rotate-45 text-accent" />
        </div>
      ))}
    </div>
  </div>
</AppLayout>
```

Note: `display: contents` wrapper keeps the 12px column gap between groups.

- [ ] **Step 4:** `npm run check`, `bash ../scripts/check-astro-conventions.sh`, `bash ../scripts/check-astro-class-composition.sh` → pass. Commit `feat(games): grouped rows, resume card, header pill`.

### Task 5: Week status helpers

**Files:**
- Modify: `app/src/lib/training/schedules/today.ts`, `app/src/lib/training/schedules/types.ts`
- Test: `app/tests/lib/training/schedules/today.test.ts`

**Interfaces:**
- Produces: `startOfIsoWeek(date: Date): Date`; `type DayStatus = "done" | "missed" | "today" | "scheduled" | "rest"`; `dayStatus(index: number, today: number, schedule: ScheduleData | null, completions: TrainingCompletionListData["items"]): DayStatus`; `weekCounts(today, schedule, completions): { done: number; missed: number; toGo: number }`.

- [ ] **Step 1: Failing tests**

```ts
const schedule = (days: number[]) =>
  ({ scheduleId: "s", name: "n", days: days.map((d) => ({ dayOfWeek: d, routineId: `r${d}`, routineName: "R", routineMinutes: 10 })) }) as any;
const done = (dayOfWeek: number, date: Date) => ({ activityId: "a", routineTemplateId: `r${dayOfWeek}`, routineName: "R", completedAt: date.toISOString() });

describe("startOfIsoWeek", () => {
  it("returns local Monday midnight", () => {
    expect(startOfIsoWeek(new Date(2024, 0, 4, 15))).toEqual(new Date(2024, 0, 1));
    expect(startOfIsoWeek(new Date(2024, 0, 7, 23))).toEqual(new Date(2024, 0, 1));
    expect(startOfIsoWeek(new Date(2024, 0, 1, 0))).toEqual(new Date(2024, 0, 1));
  });
});

describe("dayStatus / weekCounts", () => {
  // week of Mon 2024-01-01; today = Thursday (index 3)
  const s = schedule([1, 2, 4, 6]);
  const c = [done(1, new Date(2024, 0, 1, 19))];
  it("covers every status", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => dayStatus(i, 3, s, c))).toEqual(
      ["done", "missed", "rest", "today", "rest", "scheduled", "rest"]);
  });
  it("counts like the design", () => {
    expect(weekCounts(3, s, c)).toEqual({ done: 1, missed: 1, toGo: 2 });
  });
  it("marks today done once completed", () => {
    const c2 = [...c, done(4, new Date(2024, 0, 4, 9))];
    expect(dayStatus(3, 3, s, c2)).toBe("done");
    expect(weekCounts(3, s, c2)).toEqual({ done: 2, missed: 1, toGo: 1 });
  });
  it("rest day today glows but is not to-go", () => {
    expect(dayStatus(2, 2, s, [])).toBe("today");
    expect(weekCounts(2, s, [])).toEqual({ done: 0, missed: 2, toGo: 2 });
  });
  it("needs the completion on that day", () => {
    const wrongDay = [{ ...done(1, new Date(2024, 0, 2, 9)) }];
    expect(dayStatus(0, 3, s, wrongDay)).toBe("missed");
  });
  it("no schedule: all rest except today", () => {
    expect(dayStatus(0, 3, null, [])).toBe("rest");
    expect(dayStatus(3, 3, null, [])).toBe("today");
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** in `today.ts`:

```ts
/** Local Monday 00:00 of `date`'s ISO week. */
export function startOfIsoWeek(date: Date): Date {
  const day = startOfLocalDay(date);
  day.setDate(day.getDate() - (isoWeekday(date) - 1));
  return day;
}

/**
 * One weekday's state in the current ISO week (`index` 0 Monday..6 Sunday,
 * `today` likewise). Done wins on any day; otherwise today is today; a
 * scheduled day before today without its routine completed that day is missed.
 * `completions` are this week's.
 */
export function dayStatus(index, today, schedule, completions): DayStatus {
  const entry = schedule?.days.find((d) => d.dayOfWeek === index + 1) ?? null;
  const completed = entry !== null && completions.some(
    (c) => c.routineTemplateId === entry.routineId &&
      isoWeekday(new Date(c.completedAt)) - 1 === index);
  if (completed) return "done";
  if (index === today) return "today";
  if (!entry) return "rest";
  return index < today ? "missed" : "scheduled";
}

/** Done/missed/to-go totals for the week; a scheduled, not-done today counts to go. */
export function weekCounts(today, schedule, completions) {
  const counts = { done: 0, missed: 0, toGo: 0 };
  for (let i = 0; i < 7; i++) {
    const status = dayStatus(i, today, schedule, completions);
    if (status === "done") counts.done++;
    else if (status === "missed") counts.missed++;
    else if (status === "scheduled") counts.toGo++;
    else if (status === "today" && schedule?.days.some((d) => d.dayOfWeek === i + 1)) counts.toGo++;
  }
  return counts;
}
```

(Add full param types; `DayStatus` in `types.ts`.)

- [ ] **Step 4:** PASS. Commit `feat(training): week day status helpers`.

### Task 6: `trainingWeek()` factory

**Files:**
- Create: `app/src/lib/training/schedules/training-week.data.ts`
- Modify: `app/src/lib/training/schedules/types.ts` (`TrainingWeekContext`), `app/src/lib/client/alpine/register-route-data.ts`
- Test: `app/tests/lib/training/schedules/training-week.data.test.ts`

**Interfaces:**
- Produces: Alpine data `trainingWeek` with `loading`, `schedule`, `completions`, `today`, `init()`, `status(index): DayStatus`, `counts()`, `hasSchedule()`, `dayLabel(index): string` (`"Monday, done"`), `letter(index): string`.

- [ ] **Step 1: Failing tests** (mock `@client/api/schedules`, `@client/api/training-sessions` as `home-week.data.test.ts` does):

```ts
it("loads schedule and this week's completions", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2024, 0, 4, 12));
  vi.mocked(getActiveSchedule).mockResolvedValue(schedule([1, 2, 4, 6]));
  vi.mocked(listTrainingCompletions).mockResolvedValue({ items: [done(1, new Date(2024, 0, 1, 19))], nextCursor: null });
  const week = trainingWeek() as any;
  await week.init();
  expect(listTrainingCompletions).toHaveBeenCalledWith(new Date(2024, 0, 1).toISOString());
  expect(week.today).toBe(3);
  expect(week.status(0)).toBe("done");
  expect(week.counts()).toEqual({ done: 1, missed: 1, toGo: 2 });
  expect(week.hasSchedule()).toBe(true);
  expect(week.dayLabel(1)).toMatch(/, missed$/);
  vi.useRealTimers();
});

it("falls back to no schedule on failure", async () => {
  vi.mocked(getActiveSchedule).mockRejectedValue(new Error("x"));
  vi.mocked(listTrainingCompletions).mockResolvedValue({ items: [], nextCursor: null });
  const week = trainingWeek() as any;
  await week.init();
  expect(week.hasSchedule()).toBe(false);
  expect(week.loading).toBe(false);
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement**

```ts
/**
 * `/training`'s "My schedule" card: the active schedule and this ISO week's
 * completions, read into a per-day status (done, missed, today, scheduled,
 * rest) and the done/missed/to-go totals.
 */
export function trainingWeek() {
  const now = new Date();
  return {
    loading: true,
    schedule: null as ScheduleData | null,
    completions: [] as TrainingCompletionListData["items"],
    today: isoWeekday(now) - 1,
    async init(this: TrainingWeekContext) {
      this.loading = true;
      try {
        const [schedule, completions] = await Promise.all([
          getActiveSchedule(),
          listTrainingCompletions(startOfIsoWeek(now).toISOString()),
        ]);
        this.schedule = schedule;
        this.completions = completions.items;
      } catch {
        this.schedule = null;
        this.completions = [];
      } finally {
        this.loading = false;
      }
    },
    status(this: TrainingWeekContext, index: number) { return dayStatus(index, this.today, this.schedule, this.completions); },
    counts(this: TrainingWeekContext) { return weekCounts(this.today, this.schedule, this.completions); },
    hasSchedule(this: TrainingWeekContext) { return this.schedule !== null; },
    letter(index: number) { return (WEEKDAYS[index] ?? "").charAt(0).toLowerCase(); },
    dayLabel(this: TrainingWeekContext, index: number) { return `${WEEKDAYS[index]}, ${this.status(index)}`; },
  };
}
```
with `const WEEKDAYS = weekdayNames();`. Register `Alpine.data("trainingWeek", trainingWeek)`.

- [ ] **Step 4:** PASS. Commit `feat(training): trainingWeek factory`.

### Task 7: Training markup

**Files:**
- Create: `app/src/components/layout/training/schedules/TrainingScheduleCard.astro`, `.../schedules/ScheduleStrip.astro`, `.../routines/RoutineRow.astro`
- Modify: `app/src/pages/training/index.astro`
- Delete: `app/src/components/layout/training/routines/RoutineCard.astro` (unused after)

- [ ] **Step 1: `ScheduleStrip.astro`** — `flex h-11 items-center justify-between`; `x-for="index in 7"` (index 1..7 → use `index - 1`), per item `<span>` with `:aria-label="dayLabel(i)"` and class by `status(i)`:
  - `done`: `size-8.5 bg-accent text-foreground` + `<CheckBold class="size-[15px]">` shown via `x-show`
  - `missed`: `size-8.5 border-2 border-dashed border-missed bg-missed-muted text-missed` + `CrossBold size-[13px]`
  - `today`: `home-day-today size-10.5 text-[15px] font-bold text-foreground` + letter
  - `scheduled`: `size-8.5 border-2 border-foreground/50 text-foreground` + letter
  - `rest`: `size-8.5 border-2 border-border text-faint-foreground` + letter
  Base: `flex items-center justify-center rounded-full text-[13px]`.
- [ ] **Step 2: `TrainingScheduleCard.astro`** — `x-data="trainingWeek()"` section `glass shadow-none flex flex-col gap-3.5 rounded-2xl p-4`; row `flex items-center justify-between gap-3`: left `flex flex-col gap-1.5`: `h2 font-display text-[13px] tracking-[0.06em]` "My schedule"; `p text-xs/[1.5] text-muted text-pretty`: with schedule → `<span x-text="`${counts().done} done · `">` + `<span class="text-missed" x-text="`${counts().missed} missed`">` + `<span x-text="` · ${counts().toGo} to go`">`; without → existing intro copy. Right: `button type="button" aria-label="Edit plan" class="glass-button flex size-11 shrink-0 items-center justify-center rounded-full text-foreground" @click="showScheduleModal = true"` with `PencilIcon class="size-4.5"`. Then `<ScheduleStrip />`. (`showScheduleModal` lives on parent `trainingIndex()` scope — Alpine resolves it up the chain.)
- [ ] **Step 3: `RoutineRow.astro`** (inside `x-for` with `routine`, `index`; uses parent `detailHref`, `durationLabel`, `playHref`):

```astro
<div class="flex items-center gap-3 py-3.5" :class="index === 0 ? '' : 'border-t border-border'">
  <div class="flex min-w-0 flex-1 flex-col gap-1.5">
    <a class="font-display text-sm" :href="detailHref(routine)" x-text="routine.routineName"></a>
    <div class="flex flex-wrap gap-1.5">
      <span class="rounded-md bg-white/7 px-[7px] py-0.5 font-mono text-[10px] font-semibold text-chip-foreground"
        x-text="durationLabel(routine).toUpperCase()"></span>
    </div>
  </div>
  <a class="glass-button flex size-10 shrink-0 items-center justify-center rounded-full text-foreground"
    :href="playHref(routine)" :aria-label="`Start ${routine.routineName}`">
    <PlayIcon class="size-4" aria-hidden="true" />
  </a>
</div>
```

Add `playHref(routine) => routinePlayPath(routine.routineId)` to `trainingIndex()` + `TrainingIndexContext`, with a test in `tests/lib/training/routines/training-index.data.test.ts` (create if absent): `expect(trainingIndex().playHref({routineId:"r1"} as any)).toBe(routinePlayPath("r1"))`.

- [ ] **Step 4: Page** `training/index.astro`: wrapper `flex flex-col gap-3 px-4 pt-2` `x-data="trainingIndex()"`; header row `px-1 pt-5 pb-3` h1 as Games; `ErrorAlert`; `TrainingScheduleCard`; `span.section-eyebrow pt-2.5` ROUTINES; card `glass shadow-none flex flex-col rounded-2xl px-4` with `template x-for="(routine, index) in systemRoutines()"` → `RoutineRow`, plus skeleton rows while `loading`; PERSONAL ROUTINES eyebrow; same card when `personalRoutines().length`; else (`!loading`) empty card `glass shadow-none flex items-center justify-between gap-3 rounded-2xl p-4`: `p text-xs/[1.5] text-muted text-pretty` "No custom routines yet. Build one from any game or drill." + 44px `glass-button` plus (`PlusIcon size-4`, `aria-label="Create routine"`, `@click="showModal = true"`); TRIVIA eyebrow; `a href="/training/quick-subtract" class="glass shadow-none flex items-center gap-3 rounded-2xl p-4"` with title `font-display text-[13px] tracking-[0.06em]` "Quick Subtract", caption `text-xs/[1.5] text-muted text-pretty`, `DartIcon size-6.5 -rotate-45 text-accent`. Keep both modals. Delete `RoutineCard.astro`.
- [ ] **Step 5:** `npm test`, `npm run check`, conventions scripts → pass. Commit `feat(training): schedule card, routine rows, trivia card`.

### Task 8: Visual verification

- [ ] Run `npm run dev`; open `/games` and `/training` at 390×844 (headless browser screenshot). Compare against the design frames (render design HTML locally from the fetched copy, or compare values) — header 26px Michroma, row paddings 14px, card radius 20px, gaps 12/8px, icons 26/16/18px, strip 34/42px. Fix any deviation; commit `fix(games,training): visual parity`.

### Task 9: Docs, issues, gates, PR

- [ ] Component Inventory (`docs/architecture/07-Frontend/08-Component-Inventory.md`): add `GameRow`, `ResumeSessionCard`, `TrainingScheduleCard`, `ScheduleStrip`, `RoutineRow`; remove `RoutineCard`.
- [ ] D427 in `decisions/frontend/style.md` (groups on descriptors; week-status helpers; `feature-card`/`mode-pill`/`section-eyebrow`/missed tokens; static resume detail).
- [ ] File 3 `discovered-work` issues (spec list) via `capturing-discovered-work`.
- [ ] Spec status → implemented + implementation notes.
- [ ] `context-maintenance`, `run-all-gates` skills; commit `docs(games,training): inventory, D427`.
- [ ] Push, open PR (`finishing-a-dart-branch`), watch CI to green; fix failures.
