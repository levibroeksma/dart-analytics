---
id: D0533
status: accepted
date: 2026-11-07
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, motion]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Paused-screen tips last 1.5 s longer and slide like the card deck

## Context and Problem Statement
the owner asked for it (#1237): the tips were slightly too short, and the deck's exit motion fits the screen better than a fade.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the tip display time gains 1.5 s: 4 s plus 60 ms per character, clamped to 6.5–13.5 s. The tip card no longer fades. It slides out to the left (`translateX(-130%) rotate(-6deg)`, `--deck-out-*` timing, `TIP_SLIDE_MS` 440 ms), then the next tip slides in from the right (`tip-slide-in`, `--deck-rise-*` timing). The first tip of a pause just appears. Reduced motion swaps the tip in place.", because the owner asked for it (#1237): the tips were slightly too short, and the deck's exit motion fits the screen better than a fade.

### Consequences
new utilities `tip-slide-out`, `tip-slide-in` and keyframes `tip-slide-in` in `global.css`, registered in `merge-tokens.ts`; the Design System artifact does not hold them. Not checked in a browser.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-07
Supersedes: D526 in part (tip timing and its fade).
