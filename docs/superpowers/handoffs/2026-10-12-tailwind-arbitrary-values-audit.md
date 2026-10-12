# Tailwind arbitrary-value audit — `app/src/**/*.astro`

> 2026-10-12. Non-canonical working material. Tailwind `4.3.2`.
> Scope: every `prop-[…]` arbitrary value in `.astro` class strings. 190 hits in 72 files. No `<style>` blocks exist; the 22 `:style=` bindings are all runtime-computed (Alpine) and out of scope.

## Rule being applied

- Style guide (`docs/architecture/07-Frontend/07-Style-Guide.md` L22, L34, L93): tokens and primitives are defined once in `app/src/styles/global.css`; "a new value enters `global.css` as a token before any component uses it" (D428); reusable class contracts go in `@utility` / `@layer components`.
- So an arbitrary value is a violation when (A) a stock v4 utility already expresses it, (B) a project token in `@theme` already expresses it, (C) it is a design value with no token yet, or (D) it is a repeated composite that should be one `@utility`.

## How equivalents were verified

Each proposed replacement was compiled against the real `global.css` with Tailwind's own `compile()` (`node_modules/tailwindcss`). `OK` = class generated. Notable results:

| Candidate | Result | Note |
| --------- | ------ | ---- |
| `h-lh`, `min-h-lh` | OK | replaces `h-[1lh]` / `min-h-[1lh]` |
| `size-110`, `h-4.5`, `gap-0.75`, `w-27.5`, `size-12.5` | OK | v4 spacing accepts any 0.25 step |
| `scale-106`, `flex-2`, `group-has-focus:` | OK | |
| `border-1.5` | **NO** | border width takes integers only |
| `text-xs/normal` | OK but **≠ `/[normal]`** | `/normal` emits `var(--leading-normal)` = 1.5, not CSS `normal` |

Correction to the premise: spacing/sizing values all have v4 classes, but **font sizes (9/10/11/13/15/17/22/26/32px), most tracking values and `leading-[1.55]` have no stock v4 class**. Those need `@theme` tokens (C), not a rename.

---

## A. Stock v4 utility exists — rename only

| Location | Now | Use |
| -------- | --- | --- |
| `components/ui/BoardMagnifier.astro:122` | `h-[440px] w-[440px]` | `size-110` |
| `components/ui/Modal.astro:69` | `h-[5px]` | `h-1.25` |
| `components/ui/InlayRow.astro:40,64`, `layout/games/RouteChips.astro:26` | `size-[3px]` | `size-0.75` |
| `components/forms/SettingRow.astro:81`, `layout/profile/ProfileIdentity.astro:17` | `h-[1lh]` | `h-lh` |
| `layout/profile/ProfileIdentity.astro:45,58` | `min-h-[1lh]` | `min-h-lh` |
| `components/forms/RangeSlider.astro:59` | `h-[30px]` | `h-7.5` |
| `components/forms/RangeSlider.astro:75`, `forms/Switch.astro:31` | `h-[22px]` | `h-5.5` |
| `components/forms/Switch.astro:31` | `w-[38px]`, `after:size-[18px]` | `w-9.5`, `after:size-4.5` |
| `components/forms/SlideToStart.astro:68` | `top-[5px]`, `size-[50px]` | `top-1.25`, `size-12.5` |
| `components/forms/SlideToStart.astro:69` | `scale-[1.06]` | `scale-106` |
| `layout/training/schedules/ScheduleStrip.astro:26` / `:32` | `size-[15px]` / `size-[13px]` | `size-3.75` / `size-3.25` |
| `layout/training/schedules/TrainingScheduleCard.astro:24`, `layout/games/VisitPreview.astro:31`, `pages/training/index.astro:64` | `h-[18px]` | `h-4.5` |
| `layouts/GameLayout.astro:72` | `size-[18px]` | `size-4.5` |
| `ScheduleFormModal.astro:60`, `RoutineStepRow.astro:46`, `ExercisePicker.astro:46`, `ComparisonSummary.astro:78` | `gap-[3px]` | `gap-0.75` |
| `layout/games/ComparisonSummary.astro:44,45` | `gap-[7px]` | `gap-1.75` |
| `layout/games/setup/UserSection.astro:38` | `gap-[18px]` | `gap-4.5` |
| `layout/training/routines/RoutineRow.astro:26` | `px-[7px]` | `px-1.75` |
| `layout/games/SplitScoreboardHalf.astro:52`, `layout/games/VisitPreview.astro:22` | `px-[18px]` | `px-4.5` |
| `layout/games/ScoreInput.astro:68` | `py-[5px] pr-[5px]` | `py-1.25 pr-1.25` |
| `layout/games/ScoreInput.astro:79` | `w-[110px]` | `w-27.5` |
| `layout/games/PlayStatTile.astro:27` | `h-[76px]` | `h-19` |
| `CricketRecreationalInput.astro:24`, `TacticsRecreationalInput.astro:27` | `flex-[2]` | `flex-2` |
| `pages/login/index.astro:13` | `group-has-[:focus]` | `group-has-focus` |
| `ResumeSessionDeck.astro:129`, `SplitScoreboardHalf.astro:114`, `PlayStatTile.astro:30`, `interfaces/FiveOhOne.astro:46`, `setup/UserSection.astro:34` | `tracking-[0.1em]` | `tracking-widest` (0.1em) |

Near-equivalent (superset of properties; minor behaviour change — confirm visually):

| Location | Now | Use |
| -------- | --- | --- |
| `ui/Link.astro:48`, `forms/IconBtn.astro:43`, `forms/Button.astro:74` | `transition-[transform,color,background-color,border-color,box-shadow]` | `transition` |
| `forms/Input.astro:56` | `transition-[border-color,box-shadow,background-color]` | `transition` |
| `ScheduleFormModal.astro:60`, `games/CheckoutConfirm.astro:44` | `transition-[color,background-color]` | `transition-colors` |

## B. Project `@theme` token already exists — use it

Radius (`--radius-*`, `global.css:206-208`):

| Location | Now | Use |
| -------- | --- | --- |
| `SplitScoreboardHalf.astro:52,84`, `ScoreInput.astro:68`, `VisitPreview.astro:22` | `rounded-[22px]` | `rounded-key` |
| `SplitScoreboardHalf.astro:107`, `PlayStatTile.astro:26` | `rounded-[14px]` | `rounded-row` |
| `layout/games/setup/Toggle.astro:55` | `rounded-[26px]` | `rounded-switch` |

Typography (`--text-*` bundle size + line-height + tracking, `global.css:121-145`). Each token also sets line-height, so the `/[normal]` suffixes disappear — **line-height will change**; verify visually.

| Token | Bundles | Matching hand-rolled pairs |
| ----- | ------- | -------------------------- |
| `text-hero` | 4.5rem / lh 1 / -0.02em | `home/HomeHero.astro:15` (`text-7xl leading-none tracking-[-0.02em]`) |
| `text-title` | 26px / 0.02em | `pages/training/index.astro:25`, `pages/profile/index.astro:16`, `pages/games/index.astro:19` |
| `text-card-title` | 13px / 0.06em | `forms/PlayerSettingsCard.astro:37`, `forms/AppModeForm.astro:51`, `home/DailyAverageCard.astro:11`, `home/LandingHeatmapCard.astro:13`, `schedules/TrainingScheduleCard.astro:20`, `setup/SettingSectionShell.astro:17`, `setup/UserSection.astro:32`, `pages/training/index.astro:125` |
| `text-eyebrow` | 10px / 0.12em | `forms/SettingRow.astro:78`, `forms/PlayerSettingsCard.astro:30`, `forms/AppModeForm.astro:37`, `setup/SettingLabel.astro:27` |
| `text-value` | 30px / lh 1 / 0 | `games/ScoreInput.astro:71` (`text-[30px]`; or stock `text-3xl`) |
| `text-button` | 15px / lh 1.3 | size match only — `SettingRow.astro:147,175`, `ResumeSessionDeck.astro:137`, `BoardInputPanel.astro:107`, `login/index.astro:16`; use only where the text is button-role, else a new token (C) |

Near misses (do not swap blindly): `ResumeSessionDeck.astro:55` `text-[11px] tracking-[0.14em]` vs `text-eyebrow-lg` (12px/0.14em); `games/ResumeSessionCard.astro:20` `text-[10px]/[normal] tracking-[0.14em]`.

## C. No v4 or project equivalent — add `@theme` token in `global.css`

Ranked by repetition.

| Value | Hits | Locations | Suggested token |
| ----- | ---- | --------- | --------------- |
| `text-[13px]` (not paired with 0.06em) | 17 | `InfoSection.astro:31,50`, `ScheduleStrip.astro:21`, `RoutineStepRow.astro:48,64`, `ProfileIdentity.astro:58`, `HandednessForm.astro:37`, `AppModeForm.astro:40`, `ResumeSessionDeck.astro:62,109,113`, `SplitScoreboardHalf.astro:110`, `RouteChips.astro:32`, `MarkRows.astro:21`, `CountdownPauseControl.astro:29`, `ToggleListItem.astro:36`, `login/index.astro:82` | `--text-body-sm` (0.8125rem) |
| `text-[11px]` | 12 | `BoardMagnifier.astro:112`, `DeckPager.astro:46`, `RangeSlider.astro:89`, `DailyAverageCard.astro:13,32`, `LandingHeatmapCard.astro:15`, `CareerTiles.astro:23`, `RoutineStepRow.astro:52,72`, `ResumeSessionDeck.astro:55,82` | `--text-caption` (0.6875rem) |
| `text-[10px]` (not paired with 0.12em) | 5 | `RoutineRow.astro:26`, `ResumeSessionDeck.astro:129`, `LegBars.astro:42`, `CareerTiles.astro:15`, `UserSection.astro:34` | reuse `text-eyebrow` if tracking may change, else `--text-micro` |
| `text-[9px] tracking-[0.1em]` | 3 | `SplitScoreboardHalf.astro:114`, `PlayStatTile.astro:30`, `FiveOhOne.astro:46` | `--text-tag` + `--letter-spacing` 0.1em |
| `tracking-[-0.02em]` (display numerals) | 2 (+HomeHero in B) | `SplitScoreboardHalf.astro:70`, `SinglePlayerDisplay.astro:53` | `--tracking-display`; style guide L127 currently prescribes the literal — update it too |
| `tracking-[0.02em]` (unpaired) | 2 | `SlideToStart.astro:63`, `SetupShell.astro:41` | `--tracking-*` |
| `tracking-[0.01em]` | 2 | `RoutineStepRow.astro:48`, `GameRow.astro:35` | `--tracking-*` |
| `tracking-[0.14em]` (unpaired) | 2 | `HomeHero.astro:11`, `ResumeSessionDeck.astro:84` | likely `text-eyebrow-lg` |
| `tracking-[0.06em]` with `text-sm` | 1 | `layouts/GameLayout.astro:47` | |
| `text-[22px] tracking-[0.08em]` | 2 | `SinglesRecreationalInput.astro:78`, `DoublesPathRecreationalInput.astro:34` | one `--text-*` bundle |
| `text-[17px]` / `text-[1.0625rem]` | 2 | `PlayStatTile.astro:35`, `TargetGrid.astro:43` | same value, two spellings → one token |
| `text-[2.5rem]` | 2 | `ComparisonSummary.astro:91`, `SinglePlayerSummary.astro:41` | `--text-*` |
| `text-[3.25rem]`, `text-[26px]`, `text-[32px]` | 1 each | `SinglePlayerSummary.astro:41`, `InputButton.astro:48`, `Stepper.astro:68` | `--text-*` (or `text-title` size for 26px) |
| `tracking-[0.08em]` | 1 | `CareerTiles.astro:15` | |
| `leading-[1.55]` | 2 | `InfoSection.astro:35,64` | `--leading-*`, or `leading-relaxed` (1.625) if acceptable |
| `rounded-b-[18px]` / `rounded-b-[19px]` | 2 | `ui/CardStack.astro:38,48` | `--radius-*` (two values one px apart — likely one) |
| `rounded-[17px]` | 1 | `ScoreInput.astro:79` | `--radius-*` (inner of a 22px key) |
| `rounded-[1px]` | 1 | `StatsHeatmap.astro:33` | stock `rounded-xs` is 2px |
| `border-[1.5px]` | 2 | `ScheduleFormModal.astro:114`, `AddGuestButton.astro:34` | `border-1.5` does not compile → `@utility` |
| `backdrop-blur-[2px]` | 1 | `forms/Select.astro:60` | `--blur-2xs`; stock `backdrop-blur-xs` is 4px |
| `shadow-[inset_0_-1px_0_oklch(100%_0_0/0.12)]` / `…/0.15` | 2 | `ui/CardStack.astro:38,48` | `--shadow-*`; also a raw colour in markup |

### `/[normal]` line-height suffix — 14 hits

`text-[N]/[normal]` in `SettingRow.astro:78,147`, `PlayerSettingsCard.astro:30,37`, `HandednessForm.astro:37`, `AppModeForm.astro:37,40,51`, `TrainingScheduleCard.astro:20`, `RoutineStepRow.astro:48,52`, `RoutineRow.astro:26`, `ProfileIdentity.astro:58`, `ResumeSessionCard.astro:20`, `pages/*/index.astro` (3). Not replaceable by `/normal` (= 1.5). Resolves itself once each size becomes a `--text-*` token with its own `--line-height`.

## D. Repeated composites — one `@utility` in `global.css`

| Pattern | Hits | Locations |
| ------- | ---- | --------- |
| `grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]` | 3 | `StatRowComparison.astro:23`, `ComparisonSummary.astro:66,100` |
| `grid-cols-[1.3fr_1fr]` | 2 | `SplitScoreboardHalf.astro:52`, `SinglePlayerDisplay.astro:42` |
| `pt-[calc(env(safe-area-inset-top)+1rem)]` | 2 | `ui/Modal.astro:60`, `ui/ExpandingModal.astro:62` |
| `pb-[calc(env(safe-area-inset-bottom)+1rem)]` | 1 | `ui/Modal.astro:60` (pair with the above) |
| bottom-nav offset `max(0.5rem,calc(env(safe-area-inset-bottom)-0.5rem))` and `+5.5rem` | 3 | `layout/BottomNav.astro:27`, `forms/SlideToStart.astro:35`, `layouts/AppLayout.astro:16` — same magic number in three files; a `--nav-offset` var in `:root` would couple them explicitly |
| `transition-[transform,color,…]` | 3 | see A; if `transition` is rejected, make it an `@utility` |

One-off grid templates (`FiveOhOneSetupForm.astro:88,117`, `SinglePlayerSummary.astro:62`, `SetupShell.astro:30`): acceptable as-is; tokenise only if reused.

## E. Legitimate arbitrary use — keep

No stock or sensible token form; single use.

| Location | Value | Why keep |
| -------- | ----- | -------- |
| `ui/GrowingCard.astro:25` | `transition-[top,left,width,height]` | layout-property animation, no stock group |
| `forms/Select.astro:98` | `grid-rows-[0fr]` → `group-data-open:grid-rows-[1fr]` + `transition-[grid-template-rows]` | CSS accordion idiom; `grid-rows-N` means `repeat(N,…)`. Candidate `@utility` if a second accordion appears |
| `forms/SlideToStart.astro:69` | `motion-safe:transition-[left,scale]` | `left` not in any stock group |
| `games/BoardInputPanel.astro:67` | `transition-[filter]` | could be `transition` (superset); fine as-is |
| `ui/Modal.astro:47` | `max-h-[calc(100dvh-2rem)]` | viewport calc |
| `forms/Select.astro:107` | `max-h-[60dvh]` | no stock dvh fraction |

---

## Suggested order

1. A + B: pure renames, no `global.css` change. ~75 hits. Lowest risk except the typography swaps in B (line-height shifts).
2. C font sizes 13px / 11px: two tokens remove ~29 hits.
3. D `@utility` set.
4. Optional: extend `scripts/check-style-tokens.sh` to flag `-\[[0-9.]+(px|rem|em)\]` on spacing/size/radius/text/tracking props so new ones cannot land. Would need a D-entry and a Style Guide line.

Not verified: rendered output. All B/near-equivalent swaps change computed CSS and need a visual check on device.
