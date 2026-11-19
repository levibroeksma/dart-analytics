---
id: D0315
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, skill, gate, knowledge graph, CI]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The knowledge-graph skill is a lookup skill, and the graph is never read whole

## Context and Problem Statement
a skill's `description:` is its trigger, and this one — "any question about a codebase, its architecture, file relationships, or project content" — was the broadest in the repo, so a nine-step build pipeline loaded on routine questions. It was also unused: `.github/workflows/graph.yml` installs `graphifyy[sql]` and runs `scripts/refresh-graph.sh`, which hardcodes `graphify update .`; no path in this repo reads the skill. The deleted text described the upstream tool's full surface — chunked subagent extraction, Neo4j/FalkorDB/GraphML exports, Obsidian vaults, video transcription — none of which this repo runs. Separately, "or read it directly" invited a whole-file read of 7.7 MB, roughly 1.9M tokens; grep and the Python recipe return a handful of lines from the same file, which is what the instruction was always reaching for.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`.claude/skills/graphify/SKILL.md` (678 lines) is deleted and replaced by `.claude/skills/graph-lookup/SKILL.md` (~40 lines, one tested query recipe) plus `.claude/skills/graph-lookup/references/building.md`. The new `description:` triggers only on locating a named entity in this repository and explicitly excludes building. Root `CLAUDE.md`'s "or read it directly" clause is removed and its install pointer moves from `app/CLAUDE.md` to `references/building.md`; `app/CLAUDE.md`'s §Knowledge Graph becomes a two-line pointer, 145 lines → 133. `check-doc-links.sh` gains `.claude/skills/**/*.md`.".

### Consequences
the skill no longer documents how to *build* a graph from scratch, only how to query the one that exists — correct here, where builds are CI's, and a real loss for anyone wanting to point graphify at an unrelated folder, who should install the upstream plugin rather than read a repo skill. The rename shadows nothing: `graphify` the CLI, `graphifyy` the package, `graphify-out/` the directory, `scripts/refresh-graph.sh` and `.github/workflows/graph.yml` all keep their names, and only the skill moved. Mentions of the old skill path inside `docs/superpowers/**`, `docs/braindump/`, `00-Context-Map-History.md` and `decisions/**` are left as written, being provenance rather than live pointers — the same carve-out D311 made. Deleting the file also unblocked `check-doc-links.sh` over `.claude/skills/**`: its 8 `references/*.md` pointers named files this repo never had, inherited from a fork that copied `SKILL.md` without upstream's `references/` directory, and they were the only thing the widened gate failed on.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-18
