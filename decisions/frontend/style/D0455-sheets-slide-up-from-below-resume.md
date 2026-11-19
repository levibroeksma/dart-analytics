---
id: D0455
status: accepted
date: 2026-10-13
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, colour, motion]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Sheets slide up from below; resume deck renders only after load; rules fold animates

## Context and Problem Statement
reported on production — modals read as appearing, not sliding in (#886); the skeleton flashed for players with no open games (#902); the redesign dropped the rules fold transition (#901); browser autofill could paint login fields pale (#835).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`sheet-in` is a 300ms `--ease-out` slide from fully below the viewport edge (was a 200ms fade plus 1.5rem rise); reduced motion still skips it. `resumeDeck().visible()` is false while loading, so `ResumeSessionDeck` renders its `CardStack` under `x-if="visible()"` and the pulse skeleton is removed. `InfoSection`'s description regains `x-collapse`. `.field-inset:-webkit-autofill` sets `-webkit-text-fill-color: var(--foreground)` and delays the UA fill colour with a long `background-color` transition.".

### Consequences
the homepage shows nothing in the deck slot until sessions load, then the deck pops in. Markup/CSS only beyond `visible()`; `.astro`/CSS carry no unit test (D101). The autofill rule is unverified on a real iPhone. #902's second report (sessions vanishing on iOS) is not addressed.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-13
Supersedes: D442 (loading skeleton clause only); D429 (`sheet-in` motion clause only).
