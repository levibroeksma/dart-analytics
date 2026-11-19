---
id: D0187
status: accepted
date: 2026-08-07
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine, state]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Hold UI module instances off the Alpine reactive object

## Context and Problem Statement
Alpine deep-proxies reactive state, and an ES private field throws when read through a Proxy, so `mount()` / `layout()` never ran and the Toggle pill stayed 0×0. A mismatched registration name fails the same way, silently.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "An Alpine factory that drives a `modules/ui/*` class keeps the instance in the factory closure, never on `this.*`. The registered `Alpine.data()` name matches the factory call in markup (`toggle`), and the factory file lives under `lib/<domain>/` (`lib/ui/toggle.data.ts`), not in `lib/client/alpine/` which holds only the entry factory and registrars.".

### Consequences
`modules/ui` classes are unit-tested with an explicit Proxy guard that documents the hazard. `x-modelable` still exposes scalar reactive fields (`activeTab`), so parent `x-model` binding is unaffected. The Toggle's paired `.astro` deliberately sits in `components/layout/games/setup/` rather than `components/ui/` because it uses app `tab-*` tokens — the same one-directional reading of the pairing rule that `segment-timer.module.ts` already relies on.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-07
