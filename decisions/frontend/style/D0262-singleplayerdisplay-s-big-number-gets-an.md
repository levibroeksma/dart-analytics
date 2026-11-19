---
id: D0262
status: accepted
date: 2026-09-09
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, Tailwind, font]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `SinglePlayerDisplay`'s big number gets an opt-in `fluid` mode using Tailwind v4 container queries

## Context and Problem Statement
at the default `text-7xl` step the trivia expression wrapped onto two lines on a phone-width card (reported with a screenshot: `209 - 27` split across two lines). The other 11 `SinglePlayerDisplay` consumers all display short numeric scores (≤3 digits) that already fit `text-7xl`/`text-4xl` on one line, so changing the shared default would have re-sized every existing game's score for no reason and risked a regression nobody asked for. An opt-in prop keeps the fix scoped to the one caller whose content length actually varies, while still reusing the shared component rather than hand-rolling markup (`app/CLAUDE.md` Style non-negotiables). `cqw`/`clamp()` was chosen over a Tailwind breakpoint (`@sm:text-xl`, …) because breakpoints react to discrete container-width steps, not to how much text needs to fit — a continuous, container-relative unit is the only way to keep arbitrary-length content on one line without guessing thresholds.

## Decision Drivers
* At the default `text-7xl` step the trivia expression wrapped onto 2 lines on a phone-width card (reported with a screenshot: `209 - 27`).
* The other 11 `SinglePlayerDisplay` consumers show short numeric scores (3 digits or fewer) that fit on one line.
* The fix should reuse the shared component, not hand-roll markup (`app/CLAUDE.md` Style non-negotiables).

## Considered Options
* An opt-in `fluid` prop using a container-query font size (chosen).
* Change the shared default size (rejected: it would resize every game's score for no reason).
* A Tailwind breakpoint such as `@sm:text-xl` (rejected: breakpoints react to discrete container widths, not to how much text must fit).
* Hand-rolled markup in `QuickSubtract.astro` (rejected).

## Decision Outcome
Chosen option: "`SinglePlayerDisplay.astro` gains a `fluid?: boolean` prop (default `false`, no change to any existing caller). When true, its card div adds `@container` and the big-number `<h1>` swaps the fixed `size`-step class (`text-4xl`/`text-7xl`) for `whitespace-nowrap text-[clamp(1.75rem,13cqw,3rem)]` — a font size expressed as a clamped fraction of the card's own inline width via the native `cqw` unit, rather than a fixed `rem` breakpoint. Quick Subtract (`QuickSubtract.astro`) passes `fluid` on its running-state `SinglePlayerDisplay`, whose score is an arithmetic expression (`"209 - 27"`, up to `"501 - 60"`) instead of a short fixed-width number.".

### Consequences
`fluid` is additive — every other `SinglePlayerDisplay` caller is byte-for-byte unchanged. Verified against the project's own compiled `global.css` (not a hand-approximation): the exact rendered markup for `current?.expression` fits on one line with no `scrollWidth` overflow at 390px and 320px viewports, for both the widest possible expression (`"501 - 60"`, bounded by `start` ≤ 501 and one dart's max score of 60 in `quick-subtract.module.ts`) and the narrowest (`"2 - 1"`). This is the first use of Tailwind v4 container queries (`@container`, `cq*` units) in the codebase — a reusable pattern for any future big-number display whose content length isn't fixed.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The commit rendered the expression once against the project's compiled `global.css`. D432 later removed `fluid`, which `bigValueSize` replaces, so no standing check covers it.

## Pros and Cons of the Options
### Opt-in `fluid` prop with `cqw`/`clamp()`
* Good, because the fix stays scoped to the one caller whose content length varies.
* Good, because a continuous container-relative unit keeps content of any length on one line without guessed thresholds.

### Change the shared default
* Bad, because it re-sizes every existing game's score and risks a regression nobody asked for.

### Tailwind breakpoint
* Bad, because breakpoints react to discrete container-width steps, not to how much text needs to fit.

## Evidence / More Information
Decided: 2026-09-09
Referenced by D0432's `Supersedes:` line.

* Commit `1af0bb8a` (2026-09-09; `decisions/frontend/style.md` row D262 and commit message): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Partly superseded by D432 (`fluid` replaced by `bigValueSize`), per `docs/superpowers/plans/2026-10-08-game-play-redesign.md` (Task 11, D432 decision text) and commit `d658a0d0`.
