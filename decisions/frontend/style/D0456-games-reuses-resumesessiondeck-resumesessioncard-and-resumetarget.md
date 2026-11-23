---
id: D0456
status: accepted
date: 2026-10-13
origin: contemporaneous
original-date:
tags: [frontend/style]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `/games` reuses `ResumeSessionDeck`; `ResumeSessionCard` and `resumeTarget()` removed

## Context and Problem Statement
two resume UIs showed different data — `/games` only the newest session with a static detail line, the homepage every open game with progress (#892).

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`/games` renders `ResumeSessionDeck` (own `resumeDeck()` scope) in place of `ResumeSessionCard`. `gamesIndex()` drops `activeSession` and `resumeTarget()`; its sessions fetch still drives card visibility. The `ResumeTarget` type is removed.", because two resume UIs showed different data — `/games` only the newest session with a static detail line, the homepage every open game with progress (#892).

### Consequences
both scopes read the shared `activeSessions` store, one fetch per page (D458). The static detail line D427 described is gone with the card; the deck's progress caveats (D442, #815) now apply on `/games` too. `.astro` carries no unit test (D101).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-13
Supersedes: D427 (in-progress card clause only).
* Commit `ce460a07` (2026-10-13, "fix(training): page long Switching preview and chips six at a time (#954)"): adds the D456 row, whose text is the existing Context, Decision Outcome and Consequences; no section rebuilt here.
