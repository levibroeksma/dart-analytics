---
id: D0416
status: accepted
date: 2026-10-05
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, glass, safe-area]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Bottom nav is a floating glass pill

## Context and Problem Statement
matches the requested hovering-glass reference; content scrolls under the blur.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`BottomNav` is `fixed` above the content, a `rounded-full` pill using the new `glass-nav` utility (translucent white fill, blur + saturate, inset highlight, drop shadow). The active tab gets `.nav-active` (dark inner pill) with `text-accent`; inactive tabs use `text-foreground`. `AppLayout`'s `main` pads its bottom so the last content clears the pill.", because matches the requested hovering-glass reference; content scrolls under the blur.

### Consequences
the nav sits `max(0.5rem, safe-area-inset-bottom - 0.5rem)` above the screen edge. `GameLayout` has no nav and is unaffected. `.astro`/CSS carry no unit test (D101).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-05
Referenced by D0419's `Supersedes:` line.
