<!--
status: design
scope: frontend IA (trivia → training) + first system routine ("Balanced Training")
read-when: implementing the /training page, the routine detail template, or the Switching/Double Pattern/Ladder exercise types
updated: 2026-09-11
-->

# Training Page & Balanced Training — Design

> Documentation only. No code, migration, or seed in this pass. Confirmed with the user across multiple rounds; this is the approved design to hand to `writing-plans`.

---

## 1. Purpose

Two changes, scoped together because the second can't be designed without the first:

1. **IA**: the current `/trivia` page becomes `/training`. Quick Subtract (the only built trivia tool) relocates under it as a flat card — "trivia" stops being a UI category. `09-training-routines.md`'s Training/Routine/`ExerciseEngine` model (schema + engines landed 2026-09-10, Phase 1/Warm-Up only) gets its first frontend surface here.
2. **Content**: the first real system routine, **Balanced Training** — 4 steps, 30 minutes, built from 2 new exercise types (`SWITCHING`, `DOUBLE_PATTERN`) plus the existing `WARM_UP` (generalized) and `GAME` (wrapping the existing TUOD engine, unchanged).

Explicitly **not** in scope: any change to `10-trivia.md` / D261 (Checkout Trivia, Quick Subtract stay outside `ExerciseEngine`, no persistence) — this is a navigation move, not an architecture reversal. No API route, no `TrainingEngine` wiring to a page, no settings/config UI — the routine detail page is read-only explanation plus a `Start` button that does nothing yet.

---

## 2. IA: flat, not nested

```
/training                         — landing: flat card grid
/training/balanced-training       — routine detail page (new template)
/training/quick-subtract          — existing tool, relocated from /trivia/quick-subtract
```

No `/training/trivia` or `/training/routines` intermediate level. Quick Subtract is a card on `/training` itself, same level as Balanced Training — not nested under a trivia or mental-training sub-path.

The landing page reuses the existing `GameCard`/category-landing pattern (`app/src/pages/trivia/index.astro` today) with one addition: an optional duration pill on a card. Only the Balanced Training card uses it (`30 min`); Quick Subtract's card is unchanged (no fixed duration).

`app/src/lib/trivia/` and `app/src/modules/trivia/` keep their current names and contents this pass — the "trivia" internal naming is now a cosmetic mismatch against the new IA label. Log this in `FINDINGS.md` rather than renaming here (renaming is implementation work outside this design's scope, and a finding is never fixed in the same pass per root `CLAUDE.md`).

---

## 3. New template: routine detail page

The first genuinely new page shape this task introduces — modeled on a game's setup page shell, with every settings field removed since nothing is configurable in this version:

```
Balanced Training                         [30 min]

1. Warm-Up — 10 min
   Loosen up through 5 board zones: upper, lower, left, right, bull.

2. Switching: Target — 5 min
   One dart each at 20, 19, 18 per visit. Single = 1, double = 2, treble = 3.

3. Switching: Doubles — 5 min
   Cycle D20→D10→D5, D16→D8→D4, D12→D6→D3. Each hit double = 1 point.

4. Finishing — 10 min
   Ten Up One Down, timed.

[ Start ]
```

One ordered list of steps, each rendering its exercise type's name, duration, and a plain-language explanation (static copy, not derived from any config at runtime this pass). `Start` is the seam for the not-yet-built training-session API — present, but unwired.

This template is reusable: step count and content vary per routine; the shell (title, duration pill, ordered explanation list, single CTA) doesn't. No settings form exists because Balanced Training has nothing to configure; a future routine that needs configuration is a later design, not something this shell needs to anticipate yet.

---

## 4. Balanced Training: the routine

System routine (`is_system_template = TRUE`, `player_id = NULL`), 4 steps, 30 minutes total — well inside the `09-training-routines.md` §7 sixty-minute cap.

| Step | Exercise Type | Duration | Configuration |
|---|---|---|---|
| 1 | `WARM_UP` | 10m | none (template default: 5 equal-weight phases) |
| 2 | `SWITCHING` | 5m | targets `[20, 19, 18]`; scoring `{single: 1, double: 2, treble: 3}` |
| 3 | `DOUBLE_PATTERN` | 5m | patterns `[[20,10,5], [16,8,4], [12,6,3]]` |
| 4 | `GAME` (TUOD) | 10m | `TUOD_V1`, timed, `durationValue: 10` |

Name "Balanced Training" replaces the working title "30 Min Training" everywhere: the routine detail page title, the future seed's `routine_templates.name`, and any doc prose.

---

## 5. Exercise types

### 5.1 `WARM_UP` — generalize to proportional phases (engine change)

Shipped 2026-09-10 with phases at a fixed `durationSeconds: 60` each (5 phases × 60s = 5 min total, hardcoded in `exercise_templates.default_configuration`). Balanced Training needs the same 5 phases stretched to 10 minutes (2 min each) without a second warm-up template.

Change: `default_configuration` phases carry a `weight` instead of `durationSeconds` (equal weights = equal split):

```json
{"phases": [
  {"name": "Upper", "targets": [5, 20, 1], "weight": 1},
  {"name": "Lower", "targets": [19, 3, 17], "weight": 1},
  {"name": "Right", "targets": [13, 6, 10], "weight": 1},
  {"name": "Left", "targets": [8, 11, 14], "weight": 1},
  {"name": "Bull", "targets": [25], "weight": 1}
]}
```

`WarmUpEngine` resolves `phaseDurationSeconds = routineStepDurationSeconds * weight / sum(weights)` at construction, reading the step's actual duration (10 min here, 5 min for the original Phase-1 routine) instead of assuming a fixed 60s. This is a real change to an already-merged engine and config shape — flagged explicitly so the implementation plan doesn't miss it.

### 5.2 `SWITCHING` (new)

One visit = one dart at each of a fixed target list, in order, repeating for the step's full duration (not a sequence the player advances through over time — that was `09-training-routines.md` §17's illustrative phrasing, not this exercise's actual behavior). Scoring by zone: single = 1, double = 2, treble = 3, outside = 0. Tracks a cumulative point total.

```ts
type SwitchingConfig = {
  targets: number[]; // e.g. [20, 19, 18], applied in order each visit
  scoring: { single: number; double: number; treble: number };
};
```

### 5.3 `DOUBLE_PATTERN` (new)

Matches `09-training-routines.md` §17's example as-is: a fixed cycle of visits, each visit one dart at each double in that visit's pattern, repeating the full cycle for the step's duration. Each hit double = 1 point.

```ts
type DoublePatternConfig = {
  patterns: number[][]; // e.g. [[20,10,5],[16,8,4],[12,6,3]], cycled in order
};
```

### 5.4 `GAME` (existing, new usage — no engine change)

The Finishing step wraps `TUOD_V1` in its existing timed mode (`durationType`/`durationValue`, already shipped for 121/TUOD). Zero engine changes: a routine step with `exercise_type_id = GAME`, `game_type_id` = TUOD, step configuration `{ rulesetVersionKey: "TUOD_V1", durationType: "MINUTES", durationValue: 10 }`.

### 5.5 `LADDER` (new, spec'd now, not part of Balanced Training)

Progression-gated, not score-accumulating — a different state shape from `SWITCHING`/`DOUBLE_PATTERN`, which is why it is its own exercise type rather than a config variant of one of them. Start at 20; advance to the next rung (19, 18, 17, 16) only after landing at least `hitsRequired` of `dartsPerRung` darts at the current rung; completing the last rung at the required rate = one completed ladder; restart at 20; count ladders completed in the step's duration.

```ts
type LadderConfig = {
  rungs: number[]; // e.g. [20, 19, 18, 17, 16]
  dartsPerRung: number; // 3
  hitsRequired: number; // 2
};
```

State tracks: current rung index, hits at the current rung, darts thrown at the current rung, ladders completed. Not wired into any routine this pass; documented so a future routine can use it without redesigning it.

---

## 6. Ping sound and Warm-Up visual

### 6.1 Ping sound — reuses existing audio, no new asset

`app/src/modules/ui/segment-timer.module.ts`'s `SegmentTimer.playBeep()` already exists (WebAudio oscillator, synthesized — no sound file) and is used today for timed-game round cues. This is reused, not replaced:

- Fires on every Warm-Up phase change (already anticipated by `09-training-routines.md` §16: "the frontend can respond by playing the configured ping sound").
- Fires on every Training-level step transition (Switching → Doubles → Finishing), generalizing the same cue from inside Warm-Up to the whole routine.

Per the `TrainingEngine`/`ExerciseEngine` rule that neither engine owns a clock (D264), the engine layer never calls `playBeep()` itself — the frontend controller driving `advance()` calls it at each transition, mirroring the existing split between Score Training's engine (no clock) and its controller (owns the clock, `game.store.ts`).

### 6.2 Warm-Up visual — reuses the existing dartboard component; the highlight is a new outline, not the existing hover fill

There is one shared dartboard SVG (`app/src/components/ui/DartBoard.astro` / `app/src/assets/dartboard.svg`), already reused as the bottom-nav icon, the page background, and the gameplay input board — not a separate "blue version." Warm-Up's screen renders only this component — no score panel, no input panel, nothing else, since no dart input is taken. `boardRef` is omitted (nothing is captured).

**Not the existing hover treatment.** `global.css`'s `--dartboard-segment-hover` is a `color-mix` fill applied per sub-segment (`single`/`multiplier` paths individually) on `:hover`, which never fires here since nothing is hovered or tapped during Warm-Up. Reusing it was wrong; the actual requirement is a **border**, not a fill wash.

**The highlight, precisely:**

- One continuous outline around each targeted number's **whole wedge** — single, treble and double combined as one silhouette — never the internal boundaries between those three sub-segments. Radii come from `app/src/lib/game/board/board-geometry.module.ts`'s `BOARD_RADII_MM` (the geometry module is already the authority `DartBoard.astro`'s rendering is drawn to match, per that file's own header comment) — from `trebleInner`'s inner edge outward through `doubleOuter`, spanning that number's angular sector.
- For a Bull phase (`targets: [25]`), the outline is the **outer edge of the single-bull ring only** (`BOARD_RADII_MM.outerBull`) — not the inner bull (`innerBull`), and not drawn as two concentric rings.
- The border sits **outside** the wedge/circle boundary, with a visible gap — a "ring + ring-offset" treatment (Tailwind's `ring`/`ring-offset-1` as the closest analogy), not a stroke centered on or inside the shape's edge.
- Still the app's existing accent color (blue/sky) — a `stroke`, not the `color-mix` fill formula from §6.2's hover treatment.

**Implementation implication, flagged now because it's not a CSS-only change:** none of `DartBoard.astro`'s current paths represent a number's three sub-segments as one combined silhouette — the existing paths are exactly the per-ring pieces this highlight must ignore the seams of. This needs 20 new wedge-outline paths (one per number) plus one bull-outline path, added to `DartBoard.astro` as a new overlay group (e.g. `.wedge-outline`), hidden by default and toggled `.active` by id membership in `WarmUpState.targets` — new geometry, not a class toggle on existing paths. The implementation plan should derive these outline paths from `BOARD_RADII_MM` rather than hand-authoring a second set of magic numbers alongside the existing ones.

---

## 7. Explicitly deferred

- Any schema/migration/seed work for `SWITCHING`, `DOUBLE_PATTERN`, `LADDER`, or the `WARM_UP` weight-based config change — this pass is the spec; implementation is a follow-up task (mirroring `2026-09-10-training-session-phase-1-warmup-design.md`'s plan shape).
- The training-session API route and wiring the routine detail page's `Start` button to it.
- Any routine/exercise configuration UI — Balanced Training has nothing to configure.
- Renaming `lib/trivia/` / `modules/trivia/` to match the new IA (logged in `FINDINGS.md`, not fixed here).
- `LADDER` is specified but not used by any routine yet.

---

## 8. Related documents

| Document | Relationship |
|---|---|
| `docs/architecture/09-training-routines.md` | Canonical Training/Routine/`ExerciseEngine` architecture; gains the real `SWITCHING`/`DOUBLE_PATTERN`/`LADDER` shapes (replacing its illustrative examples) and the Warm-Up weight generalization when implemented. |
| `docs/architecture/10-trivia.md` | Unchanged. Confirms this design does not integrate Quick Subtract with `09`. |
| `docs/superpowers/plans/2026-09-10-training-session-phase-1-warmup.md` | The Phase 1 implementation this design extends (schema + `WarmUpEngine` + `TrainingEngine`). |
| `decisions/frontend/architecture.md` (D261) | Quick Subtract's standalone-tool precedent; still applies after the route move. |
| `app/CLAUDE.md` | `ExerciseEngine`/`TrainingEngine` clockless rule (D264) that shapes §6.1's controller-owns-audio split. |
