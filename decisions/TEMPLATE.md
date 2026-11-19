---
id: pending               # D0532, or pending before the bot runs
status: proposed          # proposed | accepted | rejected | deprecated | superseded
date: YYYY-MM-DD          # date of last status change
origin: contemporaneous   # contemporaneous | backfilled
original-date:            # backfilled only: approximate date the decision took effect
tags: [backend, data]     # free-form subjects; drive the generated index
scope: repository         # repository | package:<name> | organisation
decision-makers: [team-or-role]   # prefer roles/team handles over personal names
consulted: []
informed: []
supersedes:               # e.g. D0007
superseded-by:
---

# {Short title stating problem and chosen solution}

## Context and Problem Statement
{2–4 sentences. What forces are at play? Link to issues/RFCs rather than copying them.}

## Decision Drivers
* {driver}

## Considered Options
* {Option A}
* {Option B}
* {Do nothing / status quo}

## Decision Outcome
Chosen option: "{Option A}", because {justification tied to the drivers}.

### Consequences
* Good, because {…}
* Bad, because {…}   <!-- mandatory: at least one real cost -->
* Neutral, because {…}

### Confidence
{High | Medium | Low} — {why}

### Revisit When
{Concrete triggers}

### Confirmation
{How compliance is checked: code review rule, architecture test, lint rule, dashboard.}

## Pros and Cons of the Options
### {Option A}
* Good, because {…}
* Bad, because {…}

## Evidence / More Information
{Links to design docs, benchmarks, PRs, commits. For backfilled ADRs: the artefacts
the record was reconstructed from, plus "Rationale unknown" where it cannot be verified.}
