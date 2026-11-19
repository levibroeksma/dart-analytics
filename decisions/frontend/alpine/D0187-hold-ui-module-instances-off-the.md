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

# Hold UI module instances off the Alpine reactive object

## Context and Problem Statement
Alpine deep-proxies reactive state, and an ES private field throws when read through a Proxy, so `mount()` / `layout()` never ran and the Toggle pill stayed 0×0. A mismatched registration name fails the same way, silently. The setup-toggle design routes the Score Training duration toggle through `lib/ui/toggle.data.ts`, whose factory holds the `Toggle` instance in its closure. The spec's Data flow section says never to assign the class instance to `this.*`. A revision note moves the factory from `lib/client/alpine/` to `lib/ui/` under the `02-Folder-Structure.md` colocation rule.

## Decision Drivers
* Alpine deep-proxies reactive state, which breaks ES private fields such as `#ro` and `#pill`, so `mount` and `layout` never run (spec, Data flow).
* The registered `Alpine.data()` name must match the factory call in markup (spec, Architecture table).
* `lib/client/alpine/` holds only the entry factory and registrars (spec, revision note).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "An Alpine factory that drives a `modules/ui/*` class keeps the instance in the factory closure, never on `this.*`. The registered `Alpine.data()` name matches the factory call in markup (`toggle`), and the factory file lives under `lib/<domain>/` (`lib/ui/toggle.data.ts`), not in `lib/client/alpine/` which holds only the entry factory and registrars.".

### Consequences
`modules/ui` classes are unit-tested with an explicit Proxy guard that documents the hazard. `x-modelable` still exposes scalar reactive fields (`activeTab`), so parent `x-model` binding is unaffected. The Toggle's paired `.astro` deliberately sits in `components/layout/games/setup/` rather than `components/ui/` because it uses app `tab-*` tokens — the same one-directional reading of the pairing rule that `segment-timer.module.ts` already relies on.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's Testing plan includes a Vitest Proxy private-field guard in `tests/modules/ui/toggle.module.test.ts`. That test exists today and throws when the methods run through a Proxy.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-07

* `docs/superpowers/specs/2026-08-07-setup-toggle-integration-design.md` (Context, Architecture, Data flow, Testing, revision note): rebuilt Context, Decision Drivers and Confirmation.
* Commit `0be20c60` (2026-08-07; adds the D187 row and `03-Alpine-Patterns.md` anti-pattern row): confirmed the Decision Outcome. No section rebuilt.
* Applied in: `docs/superpowers/plans/2026-08-07-setup-toggle-integration.md`.
