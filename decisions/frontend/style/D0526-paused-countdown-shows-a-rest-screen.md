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

# Paused countdown shows a rest screen with a glass play symbol and rotating tips

## Context and Problem Statement
the owner wants a calm pause with no numbers on screen and a short tip that helps the player train.

## Decision Drivers
* The owner wants a calm rest screen on pause: only a large play symbol and a short tip, no numbers on screen (spec "Intent").
* The play button must stay at the exact viewport centre whatever the tip length (spec "Goals", "Anti-goals").
* The look rejected by the owner: a circle behind the symbol and any blue on it (spec "Anti-goals").

## Considered Options
* A fixed full-viewport overlay that paints the screen background over the title bar and score (chosen; the spec offers it as one way).
* Hide the title bar and scoreboard through the shared paused flag. The spec names this as another valid way (spec "Left to the builder").
* Keep the 6rem raised glass circle with a blue play icon that replaced the input area (status quo, spec "Intent").

## Decision Outcome
Chosen option: "`CountdownResumePrompt` becomes a full-viewport rest screen (#1210). It covers the title bar and the score with `bg-surface`. A 7rem glass play symbol sits at the viewport centre: the `play.svg` path with `--play-glass-*` tokens, no circle, no blue. A `glass` tip card sits centred between the page top and the button top. Tips are a fixed list in `lib/training/tips/`, matched by family: the key without `GAME:` and `_V<n>`. A pick takes a key tip in 2 of 3 draws and never repeats the previous tip. The tip changes after 2.5 s plus 60 ms per character, clamped to 5–12 s. `check-style-tokens.sh` allows `fixed inset-0` in this file, never `role="dialog"`.", because the owner wants a calm pause with no numbers on screen and a short tip that helps the player train.

### Consequences
to leave a paused game, the player resumes first, because the rest screen covers the exit button. New tokens: `--play-glass-fill-top`, `--play-glass-fill-bottom`, `--play-glass-edge-top`, `--play-glass-edge-mid`, `--play-glass-edge-bottom`, `--play-glass-shadow`; the Design System artifact does not hold them yet. Statistics-based tips are a follow-up issue.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Spec "Acceptance" lists unit tests for the 2-in-3 preference, the no-repeat rule, the 120-character limit and the display-time formula. Commit `75cac06a` added `app/tests/lib/training/tips/tip-pick.test.ts`, `app/tests/lib/ui/paused-tips.data.test.ts` and `app/tests/components/layout/games/countdown-resume-prompt.test.ts`; all three exist today. `scripts/check-style-tokens.sh` names the file as `OVERLAY_REST_SCREEN`.

## Pros and Cons of the Options
* Overlay covering the title bar and score, credited to the chosen option: the player sees only the tip and the play button, and one tap resumes (spec "Intent", "Acceptance").
* Tip list matched by family, credited to the chosen option: a new ruleset version keeps its tips (spec "Tips content").
* Pick with a no-repeat rule, credited to the chosen option: the tip differs between pauses (spec "Intent", "Tips content").

## Evidence / More Information
Decided: 2026-11-05
Supersedes: D429 in part (the `fixed inset-0` allow-list gains the rest screen).
Referenced by D0533's `Supersedes:` line.
* `docs/superpowers/specs/2026-11-05-paused-resume-tips-design.md`: rebuilt Decision Drivers, Considered Options, Pros and Cons, Confirmation ("Intent", "Goals", "Anti-goals", "Tips content", "Left to the builder", "Acceptance").
* Commit `75cac06a` (2026-11-05, "feat(play): glass paused screen with rotating tips (#1210) (#1229)"): adds the row as D525; commit `93c18e06` renumbers it to D526. Its text is the existing Context, Decision Outcome and Consequences; rebuilt Confirmation (tests).
