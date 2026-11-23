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

# Paused-screen tips last 1.5 s longer and slide like the card deck

## Context and Problem Statement
the owner asked for it (#1237): the tips were slightly too short, and the deck's exit motion fits the screen better than a fade.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Keep the 300 ms opacity cross-fade between tips, which the D526 spec set as a builder's call (spec `2026-11-05-paused-resume-tips-design.md`, "Tips content").
* Slide the tip card out like the card deck's exit, then slide the next tip in (chosen).

## Decision Outcome
Chosen option: "the tip display time gains 1.5 s: 4 s plus 60 ms per character, clamped to 6.5–13.5 s. The tip card no longer fades. It slides out to the left (`translateX(-130%) rotate(-6deg)`, `--deck-out-*` timing, `TIP_SLIDE_MS` 440 ms), then the next tip slides in from the right (`tip-slide-in`, `--deck-rise-*` timing). The first tip of a pause just appears. Reduced motion swaps the tip in place.", because the owner asked for it (#1237): the tips were slightly too short, and the deck's exit motion fits the screen better than a fade.

### Consequences
new utilities `tip-slide-out`, `tip-slide-in` and keyframes `tip-slide-in` in `global.css`, registered in `merge-tokens.ts`; the Design System artifact does not hold them. Not checked in a browser.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `2c7c3adf` changed `app/tests/lib/training/tips/tip-pick.test.ts`, `app/tests/lib/ui/paused-tips.data.test.ts`, `app/tests/components/layout/games/countdown-resume-prompt.test.ts` and `app/tests/lib/client/cn.test.ts`. All four exist today.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-07
Supersedes: D526 in part (tip timing and its fade).
* Commit `2c7c3adf` (2026-11-07, "feat: paused-screen tips last 1.5s longer and slide like the card deck (#1237)"): adds the D533 row, whose text is the existing Context, Decision Outcome and Consequences; rebuilt Considered Options and Confirmation from its diff.
* `docs/superpowers/specs/2026-11-05-paused-resume-tips-design.md`: names the cross-fade this record replaces ("Tips content"); rebuilt Considered Options.
