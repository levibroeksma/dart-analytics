---
id: D0526
status: accepted
date: 2026-11-05
origin: contemporaneous
original-date:
tags: [frontend/style, style, glass, surface]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Paused countdown shows a rest screen with a glass play symbol and rotating tips

## Context and Problem Statement
the owner wants a calm pause with no numbers on screen and a short tip that helps the player train.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`CountdownResumePrompt` becomes a full-viewport rest screen (#1210). It covers the title bar and the score with `bg-surface`. A 7rem glass play symbol sits at the viewport centre: the `play.svg` path with `--play-glass-*` tokens, no circle, no blue. A `glass` tip card sits centred between the page top and the button top. Tips are a fixed list in `lib/training/tips/`, matched by family: the key without `GAME:` and `_V<n>`. A pick takes a key tip in 2 of 3 draws and never repeats the previous tip. The tip changes after 2.5 s plus 60 ms per character, clamped to 5–12 s. `check-style-tokens.sh` allows `fixed inset-0` in this file, never `role="dialog"`.", because the owner wants a calm pause with no numbers on screen and a short tip that helps the player train.

### Consequences
to leave a paused game, the player resumes first, because the rest screen covers the exit button. New tokens: `--play-glass-fill-top`, `--play-glass-fill-bottom`, `--play-glass-edge-top`, `--play-glass-edge-mid`, `--play-glass-edge-bottom`, `--play-glass-shadow`; the Design System artifact does not hold them yet. Statistics-based tips are a follow-up issue.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-05
Supersedes: D429 in part (the `fixed inset-0` allow-list gains the rest screen).
Referenced by D0533's `Supersedes:` line.
