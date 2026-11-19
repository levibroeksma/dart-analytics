---
id: D0450
status: accepted
date: 2026-10-11
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, glass]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Mono eyebrow labels use the eyebrow tokens; 9px gets `text-eyebrow-sm`

## Context and Problem Statement
one eyebrow style was spelled five ways (tracking 0.08–0.14em), so a style change meant editing 30+ sites.

## Decision Drivers
* Replace `text-[Npx]` and `tracking-[…]` literals on mono eyebrow labels with tokens (commit message, #920).
* Add a `text-eyebrow-sm` token for the 9px labels (commit message).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "semibold mono tracked labels no longer carry `text-[Npx]` + `tracking-[…]` literals (#920). The 10px ones use `text-eyebrow` (0.12em); the 9px play-stat, scoreboard, 501 and `.chip` labels use a new `text-eyebrow-sm` (0.5625rem, 0.1em, line-height 1.2) in `global.css`. Left as literals: the 11px tracked labels (`ResumeSessionDeck`, `.glass-pill`-style rules in `global.css`), untracked 10/11px captions and chips (`RoutineRow`, `LegBars`, `DailyAverageCard`, `RangeSlider`), none of which is an eyebrow.", because one eyebrow style was spelled five ways (tracking 0.08–0.14em), so a style change meant editing 30+ sites.

### Consequences
tracking on affected 10px labels moves to 0.12em and `.chip` and the 9px play labels to 0.1em; visual check per screen, not byte-verifiable. No API, schema or test change (D101).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-11

* Commit `50f08cef` (PR #920, 2026-10-11): origin of the existing Context, Decision Outcome and Consequences text; its message says "Add text-eyebrow-sm (9px); replace text-[9px]/[10px] + tracking literals. D450." It rebuilt no section here.
* Applied in: `docs/superpowers/specs/2026-10-12-tailwind-arbitrary-values-design.md` (row 18) notes `text-eyebrow-sm` already exists and that D450 moved the 9px and tracked 10px labels.
