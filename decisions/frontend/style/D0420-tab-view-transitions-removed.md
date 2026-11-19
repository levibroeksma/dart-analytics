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

# Tab view transitions removed

## Context and Problem Statement
the transitions looked poor and were buggy. Their `view-transition-name`s also made `main` and the nav backdrop roots in Chromium, so glass inside them could not blur the page background.

## Decision Drivers
* The transitions looked poor and were buggy.
* Their `view-transition-name`s made `main` and the nav backdrop roots in Chromium, so glass inside them could not blur the page background.

## Considered Options
* Remove the D418 transitions in full (chosen).
* Keep the D418 transitions.

## Decision Outcome
Chosen option: "the D418 cross-document view transitions are removed in full: the `@view-transition` opt-in in `AppLayout`, `BaseLayout`'s `data-tab` attribute and `pagereveal` script, `onTabReveal` and its types, `navTabIndex`, the `vt-page`/`bottom-nav`/`nav-indicator` transition CSS, its keyframes and `--duration-tab`. `NavBtn` marks the active tab with a class again (`glass-tinted-raised`, D419); `NAV_TABS` and `navTabMatchPrefix` stay.", because the transitions looked poor and were buggy. Their `view-transition-name`s also made `main` and the nav backdrop roots in Chromium, so glass inside them could not blur the page background.

### Consequences
tab navigation is instant in every browser.

* Good, because glass inside `main` and the nav can blur the page background again.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Remove the transitions
* Good, because the poor-looking, buggy animation goes away and glass can blur the page background.

### Keep the D418 transitions
* Bad, because the `view-transition-name`s made `main` and the nav backdrop roots in Chromium, which stopped glass blurring the page background.

## Evidence / More Information
Decided: 2026-10-06

* Commit `02fb0458` (2026-10-06; commit message and `decisions/frontend/style.md` diff): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Supersedes D418, which carries `status: superseded`.
