---
id: D0425
status: accepted
date: 2026-10-07
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, token, font]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Homepage redesign, static pass behind `homeSnapshot()`

## Context and Problem Statement
ship the redesign now without blocking on new views. A single factory seam means the data pass swaps internals, not markup.

## Decision Drivers
* Overhaul `app/src/pages/index.astro` to match the new Claude Design homepage (spec, Goal).
* Keep this pass static, so a later data pass swaps the fixture for real reads without touching markup (spec, Goal).
* Keep the live weekly-plan wiring that exists today (spec, Goal).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "the home page follows the Claude Design "Darts Home" mock. It has a hero stat, a resume card, career tiles, a daily-average bar card, the weekly plan and a "Where you land" heatmap. The stat sections bind to `homeSnapshot()` (`lib/home/home-snapshot.data.ts`), a fixture-only Alpine factory whose returned shape is the contract for the later data pass. The weekly plan stays live on `homeWeek()`, restyled. Display values use Michroma (`font-display`), per the design. Bars are plain CSS, not Chart.js. The heatmap reuses `StatsDensityHeatmap` through `heatStamps()`. `LogoutButton` moves to `/profile`. The design's colours that no token covered became `--accent-deep`, `.home-feature-card` and `.home-day-today`.", because ship the redesign now without blocking on new views. A single factory seam means the data pass swaps internals, not markup.

### Consequences
home shows sample numbers and an always-visible resume card linking to `/games` until the data pass. Per-day done/missed markers and the weekly "2 of 4" ring are deferred, because they need weekly completion history. `.astro`/CSS carry no unit test (D101); `homeSnapshot()` derivations are tested.

* Neutral, because the derivations (peak, bar heights) are pure exported functions, so they are testable and survive the data pass (spec, Units § 1).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Spec § Testing: `app/tests/lib/home/home-snapshot.data.test.ts` checks the snapshot shape, the peak derivation, the bar-height clamp and the stamp coordinates. Markup goes through `npm run validate:app`, `scripts/check-astro-conventions.sh` and a visual check at 390px.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-07
Referenced by D0442's `Supersedes:` line.

* Commit `817f3c71` (2026-10-07; adds the row as D424; `7796b066` renumbers it to D425): origin of the existing Context, Decision Outcome and Consequences text. It rebuilt no section here.
* `docs/superpowers/specs/2026-10-07-home-redesign-design.md` (Goal, Units § 1, Testing): rebuilt Decision Drivers, Consequences and Confirmation. A header note dated 2026-10-25 says real data replaces the hero, daily-average and landing fixtures.
