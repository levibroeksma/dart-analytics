---
id: D0093
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, knowledge graph]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Adopt graphify for a committed AST-only codebase knowledge graph

## Context and Problem Statement
Early, low-cost shared code map before the codebase grows

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Adopt graphify for a committed AST-only codebase knowledge graph (`graphify-out/graph.json`); consumed via `graphify` CLI documented in `CLAUDE.md`; auto-rebuilt by local git hooks (`graphify extract . --code-only`); no LLM backend (no API cost); semantic/docs extraction and MCP deferred", because Early, low-cost shared code map before the codebase grows.

### Consequences
* Neutral, because `graphify-out/graph.json` is committed, while `graph.html`, `GRAPH_REPORT.md`, `cache/` and other regenerable local artifacts are gitignored.
* Neutral, because `app/README.md` documents the install (`uv tool install graphifyy`, `graphify hook install`) as optional but recommended.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-14

* Commit `429879b8` (2026-07-14; adds the D93 row, the `.gitignore` entries and the `app/README.md` section): rebuilt Consequences.
