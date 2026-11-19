---
id: D0110
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [context-system, context map, CLAUDE.md, CI, PR, AGENT.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `CLAUDE.md`/`AGENT.md` mirroring, previously a documented-but-unenforced fact (Context

## Context and Problem Statement
User-directed: mirror drift should never be possible to land silently, matching the D105 precedent of converting discipline-only rules into enforced ones

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`CLAUDE.md`/`AGENT.md` mirroring, previously a documented-but-unenforced fact (Context Map, 2026-07-15), made an explicit Context Maintenance protocol step and mechanically enforced via new `scripts/check-agent-mirrors.sh` (local + CI, alongside `check-context-map.sh`/`check-file-locations.sh`); the new script immediately caught a real pre-existing drift (`app/AGENT.md` had fallen behind `app/CLAUDE.md` since PR #25), fixed in the same change", because User-directed: mirror drift should never be possible to land silently, matching the D105 precedent of converting discipline-only rules into enforced ones.

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-16
