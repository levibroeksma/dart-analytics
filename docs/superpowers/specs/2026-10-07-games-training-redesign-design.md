# Games + Training redesign — design

**Date:** 2026-10-07 · **Status:** implemented · **Branch:** `feat/games-training-redesign` · **Decision:** D427 (`decisions/frontend/style.md`)

Source design: Claude Design project `cdea52ee-4746-4efb-b646-81448a40c033`,
`Games.dc.html` (frame `games`) and `Training.dc.html` (frame `training`,
strip variant `3a`).

## Goal

Restyle `app/src/pages/games/index.astro` and
`app/src/pages/training/index.astro` to match the design pixel for pixel
at 390px. Wire every element backed by existing code; anything the design
shows that has no data source renders static and is filed as a
`discovered-work` issue.

## Scope

- In: both pages; `GameCardDescriptor.group` + grouping helper; new
  `GameRow`, `ResumeSessionCard`, `RoutineRow`, `TrainingScheduleCard`,
  `ScheduleStrip`; `trainingWeek()` factory and pure week-status helpers;
  tokens/classes the design needs.
- Out: `BottomNav` and app-shell backdrop (already match); home page;
  API/view changes; routine step-name chips; resume detail data.

## Games page

### Data: groups

- `GameCardDescriptor` gains `group: GameGroupKey`
  (`"MATCH_PLAY" | "TRAINING" | "CLASSICS"`).
- `GAME_CARDS` reordered to design order:
  - MATCH PLAY: 501, 121, Cricket, Tactics (Cricket/Tactics not in the
    design; placed here by user decision).
  - TRAINING: Score training, Singles training, Doubles training,
    Bob's 27, Ten Up One Down.
  - CLASSICS: Shanghai, Around the Clock.
- `GAME_GROUPS: readonly { key, title }[]` (`MATCH PLAY`, `TRAINING`,
  `CLASSICS`) and pure `groupedGames(cards = GAME_CARDS)` →
  `{ key, title, games }[]` in group order, empty groups dropped.
- Visibility logic (`visibleGames`, `isVisible`) unchanged.

### Data: active session

`gamesIndex()` keeps `activeRulesetKeys` and adds `activeSession`: the
most recent (`startedAt`) active session whose ruleset has a card, as
`{ title, href }` from that card, or `null`. Pure exported
`resumeTarget(sessions, cards)` does the pick. Helpers on the factory:
`groupVisible(key)` (any of its games visible) and
`isFirstVisible(groupKey, rulesetKey)`.

### Games markup

- Wrapper `flex flex-col gap-3 px-4 pt-2` (as home/profile).
- Header row `px-1 pt-5 pb-3`: "Games" (Michroma 26px, `.02em`) and the
  `mode-pill` "ANALYTICS" (`x-show="analyticsMode()"`).
- `ResumeSessionCard` (`x-show="activeSession"`): `feature-card`,
  radius 20px, padding `14px 14px 14px 16px`, gap 12px. Left column gap
  4px: `IN PROGRESS` (mono 600 10px, `.14em`), title (Michroma 16px,
  wired), detail (Montserrat 500 → 400, 12px, `accent-foreground-muted`)
  — **static** `vs Dartbot · Leg 3 of 5 · 141 to go`. Right: `glass-button`
  link 40px high, `px-4`, radius 12px, 16px `play-rounded` icon + "Resume"
  (600 14px), `href` = card setup route (owns recovery).
- Per group (`x-show="groupVisible(key)"`): column gap 8px, `pt-2.5`;
  eyebrow `section-eyebrow` (mono 600 11px, `.14em`, `muted-foreground`,
  `px-1`); card `glass shadow-none rounded-2xl px-4 flex flex-col`.
- `GameRow` (per visible game): link, `flex items-center gap-3.5 py-3.5`,
  divider `border-t border-border` on all but the first visible row;
  title Michroma 14px `.01em`, caption 12px `text-muted`; `dart.svg`
  26px `text-accent -rotate-45`. Rows render with `x-show`, so the divider
  is bound per row: `:class="isFirstVisible(groupKey, rulesetKey) ? '' :
  'border-t border-border'"` (factory helper).
- Skeleton: one grouped glass card of 5 pulse rows with dividers.
- No-mode alert kept as is.

## Training page

### Data: `trainingWeek()`

`app/src/lib/training/schedules/training-week.data.ts`, registered in
`register-route-data.ts`. Loads `getActiveSchedule()` and
`listTrainingCompletions(startOfIsoWeek(now))` in parallel; on failure
`schedule = null`, `completions = []`. Pure helpers in `today.ts`:

- `startOfIsoWeek(date)` → local Monday 00:00.
- `dayStatus(index, today, schedule, completions)` →
  `"done" | "missed" | "today" | "scheduled" | "rest"`:
  - scheduled routine completed on that local day → `done` (any day,
    including today);
  - else `index === today` → `today`;
  - else scheduled and `index < today` → `missed`;
  - else scheduled → `scheduled`; else `rest`.
- `weekCounts(statuses)` → `{ done, missed, toGo }`; `toGo` counts
  `today` (when scheduled) + `scheduled`.

Factory API: `loading`, `schedule`, `completions`, `today`,
`status(index)`, `counts()`, `hasSchedule()`, `dayLabel(index)`.

### Training markup

- Header row: "Training" (as Games, no pill).
- `TrainingScheduleCard` (`x-data="trainingWeek()"`): `glass shadow-none
  rounded-2xl p-4 flex flex-col gap-3.5`. Top row: title "My schedule"
  (Michroma 13px `.06em`) + line (12px/1.5 `text-muted`):
  `N done · <missed>N missed</missed> · N to go` when a schedule exists,
  else the existing intro copy. Right: 44px round `glass-button`, 18px
  `pencil.svg` (`text-soft-foreground` brightened per design), opens
  `ScheduleFormModal` (`showScheduleModal = true`). `aria-label="Edit plan"`.
- `ScheduleStrip`: `flex h-11 items-center justify-between`, 7 items:
  - done: 34px, `bg-accent`, white 15px check (`check.svg`, stroke 3);
  - missed: 34px, `border-2 border-dashed border-missed bg-missed-muted`,
    13px cross (`cross.svg`) in `text-missed`;
  - today: existing `home-day-today` 42px, 15px bold letter;
  - scheduled: 34px `border-2 border-foreground/50`, white letter;
  - rest: 34px `border-2 border-border`, `text-faint-foreground`.
  Letters 500 → 400 13px. Each item has an `aria-label`
  (`Monday, done`).
- Section eyebrows `ROUTINES`, `PERSONAL ROUTINES`, `TRIVIA`
  (`section-eyebrow`, `pt-2.5`).
- Routines card: `glass shadow-none rounded-2xl px-4`, `RoutineRow` per
  system routine: `flex items-center gap-3 py-3.5`, divider on non-first;
  left column gap 6px: name link to detail (Michroma 14px), chip row
  with one `chip` (`25 MIN`, mono 600 10px, `px-[7px] py-0.5 rounded-md
  bg-white/7 text-chip-foreground`). Right: 40px round `glass-button`
  link to `routinePlayPath(id)`, 16px `play-rounded`,
  `aria-label="Start <name>"`. Step-name chips omitted (no data).
- Personal routines: same card of rows when any exist; else empty card
  `glass shadow-none rounded-2xl p-4 flex justify-between gap-3`:
  "No custom routines yet. Build one from any game or drill." + 44px
  `glass-button` with 16px `plus.svg`, `aria-label="Create routine"`,
  opens create modal.
- Trivia: link card `glass shadow-none rounded-2xl p-4 flex gap-3`:
  "Quick Subtract" (Michroma 13px `.06em`) + caption (12px/1.5 muted),
  26px dart icon.
- Loading skeleton (routines), `ErrorAlert`, both modals kept.

## Tokens and classes (`global.css`)

- `--missed: oklch(68% 0.15 30)`, `--missed-muted: oklch(68% 0.15 30 / 0.12)`
  → `--color-missed`, `--color-missed-muted`.
- `--chip-foreground: oklch(82% 0 0)` → `--color-chip-foreground`.
- `.feature-card`: the current `home-feature-card` gradient and shadows
  without the `0 0 40px 20px` halo, plus `backdrop-blur-sm`;
  `.home-feature-card` keeps its halo by adding it on top (no visual
  change on home).
- `.mode-pill`: radial `accent/35 → oklch(40% 0.12 240 / 0.55) 85%`,
  `border-t oklch(80% 0.12 237 / 0.5)`, `border-b accent/30`, blur 8px,
  text `oklch(92% 0.06 237)`, `px-3 py-1 rounded-full` mono 600 11px
  `.08em`.
- `.section-eyebrow`: mono 600 11px, `.14em`, `muted-foreground`, `px-1`.
- Raw oklch only in `global.css`.

## Icons

Design `dart-accent`, `pencil-muted`, `plus-white` match existing
`dart.svg`, `pencil.svg`, `plus.svg` path-for-path; existing
`currentColor` icons are used with text classes. `play-rounded.svg`
already exists.

## Discovered work (issues)

1. Resume card detail (opponent, leg, remaining) needs an active-session
   progress read — static in this pass.
2. Routine list rows need step names (`RoutineSummary` lacks them) for the
   design's step chips.
3. Home `WeekdayStrip` could reuse `dayStatus` for done/missed markers
   (home spec deferred them).

## Testing

- `tests/lib/game/rulesets/games-visibility.test.ts` (extend): every card
  has a group; `groupedGames` order and empty-group drop.
- `tests/lib/game/games-index.data.test.ts` (extend or new):
  `resumeTarget` picks most recent with a card, `null` otherwise.
- `tests/lib/training/schedules/today.test.ts` (extend): `startOfIsoWeek`,
  `dayStatus` all five branches, `weekCounts`.
- Markup: `npm run validate:app`, `scripts/check-astro-conventions.sh`,
  visual check at 390px against both frames.

## Docs

- Component Inventory: add the five new components, update `GameCard`
  (remove if unused).
- D427 in `decisions/frontend/style.md`.
- Context-maintenance skill before completion.

## Implementation notes (2026-10-07)

- `GameCard` stays (still used by `/training/schedules`); `RoutineCard` is removed.
- Strip classes live in `trainingWeek().dayClass(index)`: a multi-line `:class` object breaks the Astro parser.
- Row dividers use `x-bind:class`. Prettier fuses a bare `:class` onto a preceding `x-cloak` inside a JSX map (the same bug exists in `ScoreAverageCard.astro`, #818).
- Anchor titles carry `text-foreground` (global `a` is accent). Design text uses `/[normal]` line-height where Tailwind's arbitrary sizes inherit 1.5.
- `RoutineFormModal` gained a `detached` prop; the corner `+` toggle is hidden on `/training`. With personal routines present, the create row stays below them ("Build another from any game or drill.").
- Pages use `backdrop="home"`, as the frames show.
- Check/cross markers use new `check-bold.svg`/`cross-bold.svg` (design paths, stroke 3).
- Verified in headless Edge at 390×844 against the rendered design frames: measured anchor offsets match within 1px.
- Issues: #815 (resume detail), #816 (step chips), #817 (home strip markers), #818 (`x-cloak:class`).
