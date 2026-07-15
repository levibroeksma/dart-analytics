<!--
status: canonical
scope: architecture/process
read-when: process and change-lifecycle questions
updated: 2026-07-15
-->

# Engineering Workflow

> **Version:** 1.1.0
>
> This document defines the mandatory engineering workflow for all contributors, including human developers and AI assistants.
>
> The purpose of this workflow is to preserve architectural consistency, maintain high engineering quality, and prevent architectural drift over the lifetime of the project.

---

# Purpose

This project follows an **architecture-first engineering process**.

Every change, regardless of size, follows a structured workflow.

The objective is not only to produce working software, but to produce software that remains maintainable, scalable and understandable for many years.

Consistency is considered more valuable than implementation speed.

---

# Engineering Philosophy

Every contribution should improve the project.

Engineering decisions should be:

- deliberate
- documented
- reviewable
- reproducible

Shortcuts that compromise architecture are discouraged, even when they appear to save time.

---

# The Engineering Lifecycle

Every feature progresses through the same lifecycle.

```
Request
    ↓
Discovery
    ↓
Analysis
    ↓
Architecture
    ↓
Design
    ↓
Review
    ↓
Implementation
    ↓
Validation
    ↓
Documentation
    ↓
Release
```

No phase should be skipped.

---

# Phase 1 — Request

A feature request should clearly describe:

- the problem
- the desired outcome
- any known constraints
- expected users
- expected business value

Solutions should not be proposed before the problem is understood.

---

# Phase 2 — Discovery

Gather sufficient information before designing a solution.

Examples include:

- current architecture
- existing functionality
- database model
- API contracts
- frontend behaviour
- previous DECISIONS.md entries

The objective is to understand the existing system before introducing changes.

---

# Phase 3 — Analysis

Determine:

- what changes are required
- which architectural layers are affected
- whether existing functionality can be reused
- possible alternatives
- risks
- edge cases

At least one alternative solution should be considered before implementation begins.

---

# Phase 4 — Architecture

Evaluate whether the requested change affects:

- architectural principles
- ownership boundaries
- database schema
- API contracts
- frontend responsibilities
- replayability
- historical correctness

If architecture changes are required, they should be documented before implementation begins.

Major architectural changes require a dated `DECISIONS.md` entry (one line + rationale — the project's ADR mechanism).

---

# Phase 5 — Design

Design should include, where applicable:

- ERD updates
- sequence diagrams
- API contracts
- state transitions
- validation strategy
- database migrations
- UI changes

Design should be reviewed before implementation.

---

# Phase 6 — Review

Before implementation, confirm that the proposed design:

- follows project principles
- preserves consistency
- minimizes complexity
- minimizes coupling
- maximizes cohesion
- preserves replayability
- maintains historical correctness

If significant concerns remain unresolved, redesign before implementation.

---

# Phase 7 — Implementation

Implementation should follow existing project conventions.

Implementation should:

- be deterministic
- be testable
- follow naming conventions
- avoid duplication
- remain modular
- preserve architecture

Implementation should not introduce undocumented behaviour.

---

# Phase 8 — Validation

Every completed feature should be validated.

Validation includes:

- **test-driven development (mandatory for `app/`)** — red → green → refactor; `npm test` (Vitest) must pass before claiming completion (`app/CLAUDE.md` sole definition)
- functional testing
- edge case testing
- replay verification
- API verification
- SQL verification
- stale type validation (`npx fallow`) for `app/` changes
- performance considerations

Validation should confirm that the implementation satisfies the original requirements.

---

# Phase 9 — Documentation

Documentation is part of the implementation.

Documentation should be updated whenever:

- architecture changes
- APIs change
- workflows change
- migrations change
- behaviour changes

Outdated documentation is considered a defect.

---

# Phase 10 — Release

Before release, verify:

- migrations execute successfully
- tests pass
- documentation is complete
- no architectural principles have been violated
- implementation is reviewed

---

# Decision Framework

Before implementing any change, answer the following questions.

## Problem

- Is the problem clearly understood?
- Are the requirements complete?
- Is additional information required?

---

## Existing Functionality

- Does this already exist?
- Can an existing pattern be reused?
- Can an existing component be extended?

Prefer extension over duplication.

---

## Architecture

- Which architectural layer owns this responsibility?
- Does ownership change?
- Does this require a `DECISIONS.md` entry?
- Does the ERD change?

---

## Database

- Does the schema change?
- Are migrations required?
- Does replay remain possible?
- Is runtime data still immutable?
- Can statistics still be derived?

---

## API

- Does the API contract change?
- Does validation change?
- Does identity verification logic change?
- Does domain authorization logic change?
- Does authentication-provider integration change (Neon Auth boundary)?
- Can existing endpoints be reused?

---

## Frontend

- Does the UI change?
- Does state ownership change?
- Is temporary state handled correctly?

---

## Documentation

- Which documents must be updated?
- Should a new architectural pattern be documented?
- Is a `DECISIONS.md` entry required?

---

# AI Engineering Workflow

AI assistants are expected to follow exactly the same engineering workflow as human contributors.

AI should assist engineering decisions, not replace them.

---

## Before Answering

AI should determine:

1. Is sufficient context available?
2. Is the architecture understood?
3. Does documentation already define this?
4. Can an existing pattern be reused?
5. Is additional clarification required?

If context is insufficient, clarification should be requested before proposing implementation.

---

## Before Suggesting Code

AI should evaluate:

- architecture
- ownership
- coupling
- cohesion
- replayability
- maintainability
- consistency

Implementation should only be proposed after these considerations.

---

## During Code Review

AI should verify:

- correctness
- readability
- consistency
- naming conventions
- architectural compliance
- database integrity
- replay preservation

AI should explain _why_ changes are recommended rather than only _what_ should change.

---

# Review Checklist

Every implementation should answer the following questions.

## Architecture

- Does this preserve architectural principles?
- Does it maintain clear ownership?
- Does it introduce unnecessary complexity?

---

## Database

- Is the data model normalized?
- Are constraints sufficient?
- Are indexes still appropriate?
- Is historical data immutable?

---

## API

- Does the endpoint have a single responsibility?
- Is validation complete?
- Is identity verification boundary correct (Neon Auth vs Worker)?
- Is domain authorization enforced at the Worker/API boundary?
- Is the transaction boundary correct?

---

## Frontend

- Is persistent state avoided?
- Is temporary state localized?
- Does the UI remain responsive?

---

## Documentation

- Has every affected document been updated?
- Are new patterns documented?
- Are architectural decisions recorded?

---

# Definition of Done

A feature is complete only when:

- requirements are satisfied
- architecture remains consistent
- implementation is complete
- validation succeeds
- documentation is updated
- migrations are reviewed
- API contracts are verified
- performance has been considered

Working code alone is not considered complete.

---

# Continuous Improvement

Engineering is an iterative process.

Every contribution should improve one or more of the following:

- correctness
- maintainability
- readability
- performance
- consistency
- documentation

The project should become easier to maintain with every release.

---

# Final Principle

Good engineering is not measured by how quickly software is written.

It is measured by how confidently the software can evolve.

Every contribution should reduce uncertainty for future contributors.
