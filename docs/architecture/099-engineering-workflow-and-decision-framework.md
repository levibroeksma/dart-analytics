<!--
status: canonical
scope: architecture/process-quick-reference
read-when: quick workflow/decision reference
updated: 2026-07-12
-->

# Engineering Workflow & Decision Framework

> Defines the mandatory engineering workflow for all contributors, including AI agents.

---

# Purpose

This document standardizes how new features, improvements and refactorings are introduced into the project.

The goal is not only to produce working software, but to preserve architectural consistency over the lifetime of the project.

Every contribution must follow the workflow described in this document.

---

# Engineering Philosophy

This project follows an architecture-first approach.

Every implementation starts with design.

Every design starts with understanding the problem.

The expected order is:

```
Understand

↓

Design

↓

Review

↓

Implement

↓

Validate

↓

Document
```

Implementation is intentionally not the first step.

---

# Progressive Architecture

Architecture is allowed to evolve.

However:

Architecture may never drift.

Every architectural change must satisfy all of the following:

- solves a measurable problem
- improves maintainability
- does not reduce consistency
- does not introduce unnecessary coupling
- remains backwards compatible where required

If these conditions cannot be met, the architecture should remain unchanged.

---

# Feature Development Workflow

Every feature follows exactly the same process.

```
Problem

↓

Requirements

↓

Architecture Review

↓

Architecture Decision (DECISIONS.md entry if required)

↓

Database Design

↓

API Contract

↓

Frontend Design

↓

Implementation

↓

Testing

↓

Performance Review

↓

Documentation Update

↓

Merge
```

Skipping steps is not permitted.

---

# Decision Framework

Before writing any code, answer the following questions.

## Step 1

Is the problem clearly understood?

If not:

Stop.

Gather more information.

---

## Step 2

Does the feature already exist?

Search:

- architecture
- DECISIONS.md entries
- database
- API
- frontend

Never duplicate existing functionality.

---

## Step 3

Which architectural layer owns the problem?

Possible owners:

- Database
- API
- Frontend

Responsibilities must never overlap.

---

## Step 4

Does the solution introduce duplicated data?

If yes:

Redesign.

---

## Step 5

Does the solution duplicate business logic?

If yes:

Redesign.

---

## Step 6

Does the solution reduce replayability?

If yes:

Reject.

Replayability is a first-class architectural requirement.

---

## Step 7

Does the solution preserve historical truth?

Completed gameplay must remain immutable.

---

## Step 8

Can statistics still be derived?

Statistics should not become stored state unless there is a demonstrated performance requirement.

---

## Step 9

Can the implementation remain loosely coupled?

If not:

Review the design.

---

## Step 10

Is there a simpler solution?

Prefer the simplest architecture that satisfies all requirements.

---

# AI Decision Framework

AI assistants must follow the exact same workflow as human developers.

Before suggesting implementation, an AI agent must determine:

1. Is sufficient architectural information available?
2. Is the requested change consistent with existing architecture?
3. Which layer owns the requested functionality?
4. Does an existing pattern already solve this problem?
5. Can an existing component be reused?
6. Does this require a DECISIONS.md entry?
7. Does the ERD require modification?
8. Does the API contract change?
9. Does the frontend contract change?
10. Are documentation updates required?

If any required information is missing:

The AI agent should request clarification before implementation.

The AI agent must never invent architectural decisions.

---

# AI Implementation Rules

AI-generated code should:

- follow existing conventions
- minimize coupling
- maximize cohesion
- avoid duplication
- prefer composition
- remain deterministic
- preserve replayability
- preserve historical correctness

The AI should prefer extending existing patterns over introducing new ones.

---

# Architectural Escalation

Stop implementation and perform an architecture review whenever:

- new domain entities are introduced
- database relationships change
- API contracts change
- replay behaviour changes
- historical data changes
- statistics change
- ownership changes
- responsibilities move between layers

---

# Pull Request Checklist

Every implementation should answer:

✓ Does this preserve architecture?

✓ Does this introduce duplication?

✓ Does this improve maintainability?

✓ Does this follow naming conventions?

✓ Does this remain replayable?

✓ Is historical data immutable?

✓ Are statistics still derived?

✓ Does this require new documentation?

✓ Does this require a DECISIONS.md entry?

This checklist is rendered as an actionable checkbox list in `.github/pull_request_template.md`, which prefills every pull request. (2026-07-12)

Only after every answer has been reviewed should implementation be merged.

---

# Definition of Done

A feature is complete only when:

- architecture is approved
- implementation is complete
- tests pass
- documentation is updated
- migrations are reviewed
- API contract is verified
- frontend is verified
- performance has been considered

Working code alone is not considered complete.

---

# Final Principle

Consistency is a feature.

Every contributor shares responsibility for maintaining architectural consistency throughout the project.

Long-term maintainability always takes precedence over short-term implementation speed.
