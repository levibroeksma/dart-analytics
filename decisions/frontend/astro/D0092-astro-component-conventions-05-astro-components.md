---
id: D0092
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [frontend/astro, .astro, component, cn(), frontmatter]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `.astro` component conventions (`05-Astro-Components.md`)

## Context and Problem Statement
One canonical component shape; minimal variation
The chapter `05-Astro-Components.md` defines how a single `.astro` component is written. Its goal is one canonical shape with minimum variation. Where a choice exists, an objective trigger decides it, not per-author taste.

## Decision Drivers
* One canonical component shape, minimal variation.
* An objective trigger, not author preference, decides where a class lives.
* A caller-passed `class` must override a conflicting base utility, which `twMerge` does and a manual join cannot.

## Considered Options
* Fixed frontmatter order, trigger-based class placement and `cn()` as the sole helper (chosen).
* Hand-rolled class merging with `[...].filter(Boolean).join(" ")`. The chapter lists it as an anti-pattern.

## Decision Outcome
Chosen option: "`.astro` component conventions (`05-Astro-Components.md`): fixed frontmatter order; class placement decided by change-trigger (static→`class`, build-time→frontmatter, runtime→`:class`, recurring→`@layer components`); `cn()` = `twMerge(clsx())` is the sole class-composition helper", because One canonical component shape; minimal variation.

### Consequences
* Good, because the chapter fixes one frontmatter order: `Props`, imports, `Data`, `Styles`.
* Neutral, because `cn()` needs `clsx` and `tailwind-merge`. When the chapter was written, neither was in `app/package.json`, and the chapter defers adding them until the first component needs composition.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Review applies `docs/architecture/07-Frontend/05-Astro-Components.md` and its anti-pattern table.

## Pros and Cons of the Options
### Trigger-based placement with `cn()`
* Good, because a caller-passed `class` overrides a conflicting base utility.
* Good, because the trigger removes per-author choice.

### Manual `.filter(Boolean).join(" ")`
* Bad, because it gives no Tailwind conflict resolution (chapter anti-pattern table).

## Evidence / More Information
Decided: 2026-07-14

* Commit `7a40577e` (2026-07-14; the `05-Astro-Components.md` chapter and the D92 row): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Applied in: `docs/superpowers/specs/2026-07-16-frontend-conventions-hardening-design.md` (keeps `interface Props` inline in `.astro` frontmatter per D92).
* Related: D127 (`cn()` gate).
