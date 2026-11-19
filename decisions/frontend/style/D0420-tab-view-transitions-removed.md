---
id: D0420
status: accepted
date: 2026-10-06
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, glass]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0418
superseded-by:
---
<!-- backfill: pending -->

# Tab view transitions removed

## Context and Problem Statement
the transitions looked poor and were buggy. Their `view-transition-name`s also made `main` and the nav backdrop roots in Chromium, so glass inside them could not blur the page background.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the D418 cross-document view transitions are removed in full: the `@view-transition` opt-in in `AppLayout`, `BaseLayout`'s `data-tab` attribute and `pagereveal` script, `onTabReveal` and its types, `navTabIndex`, the `vt-page`/`bottom-nav`/`nav-indicator` transition CSS, its keyframes and `--duration-tab`. `NavBtn` marks the active tab with a class again (`glass-tinted-raised`, D419); `NAV_TABS` and `navTabMatchPrefix` stay.", because the transitions looked poor and were buggy. Their `view-transition-name`s also made `main` and the nav backdrop roots in Chromium, so glass inside them could not blur the page background.

### Consequences
tab navigation is instant in every browser.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-06
