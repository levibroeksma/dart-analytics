# Graphify Signal Hardening Design

> **Date:** 2026-07-14
> **Status:** proposed design (autonomous architecture review — awaiting user approval)
> **Scope:** small corrections so the committed knowledge graph stays a high-signal map as the codebase grows. The integration itself is sound — this tunes scope and fixes reference/naming defects.
> **Branch:** `claude/darts-analytics-arch-review-nvyboi`

---

## Review findings (what's already right)

- `graphifyy` is a real, current PyPI package (0.9.15); the documented `uv tool install` / `pipx` / `pip` paths are valid.
- `graphify-out/graph.json` is committed, AST-only, and carries `built_at_commit` matching the commit it was built at; the refresh discipline held through the last commits.
- `.graphifyignore` correctly excludes build output, lockfiles, drizzle meta, and graphify's own output.
- The "map, not authority" rule and the completion-gate backstop are documented in the right places.

## Problems

1. **~31% of graph nodes are non-codebase noise.** Of 2,388 nodes: 485 come from `docs/superpowers/**` (historical, "never read by default" per the context map) and 255 from `.claude/skills/**` (agent tooling, not project architecture). A `graphify query` about the domain can surface stale point-in-time plan content — precisely what the historical-status system exists to prevent.
2. **Package/repo naming mismatch.** Root `CLAUDE.md` credits `Graphify-Labs/graphify`; the installable package is `graphifyy` (documented correctly in `app/CLAUDE.md`). An agent grepping for "graphify" install instructions can pick the wrong string.
3. **Environment reality.** Fresh clones (and remote agent sessions) have no graphify CLI and no git hooks; the completion gate covers this ("say so in the report"), but the refresh step is manual until the one-time setup runs. Acceptable — but the validate script integration (see the single-source consolidation spec) should carry the guarded warning so it degrades loudly, not silently.
4. **The documented refresh command cannot reproduce the committed graph** (verified 2026-07-14 in a fresh environment, graphifyy 0.9.15). `graphify extract . --update --code-only` — the exact command in the root `CLAUDE.md` completion gate and `app/CLAUDE.md` — **replaced** the committed 2,388-node graph with a 263-node graph: `--code-only` drops every Markdown doc from extraction, and without the `graphifyy[sql]` extra all 19 SQL files contribute nothing. The committed graph was evidently built with a different flag set and with SQL support installed. Any agent that faithfully runs the gate on a fresh clone destroys the shared map's docs/SQL coverage; the app `CLAUDE.md` marks `graphifyy[sql]` as "optional but recommended" when it is in fact load-bearing for graph parity.

---

## Decision 1 — Scope the graph to the living codebase

Add to `.graphifyignore`:

```
docs/superpowers/
.claude/skills/
```

Rebuild with `graphify extract . --code-only` (full, not `--update`, since scope changed) and commit the smaller graph. The graph keeps: `app/` code, SQL migrations/seeds, canonical architecture docs, root config — the things an agent should orient on.

Alternative considered: keep historical docs in the graph but rely on the "map, not authority" caveat. Rejected — the caveat protects against *wrong* answers, not *stale-context* answers; excluding historical inputs is cheaper than teaching every future query to discount them.

## Decision 2 — Fix the naming reference

Root `CLAUDE.md` knowledge-graph section: "built by `Graphify-Labs/graphify`" → "built with the `graphifyy` CLI (PyPI; repo `Graphify-Labs/graphify`)" so both identifiers appear once, correctly linked.

## Decision 3 — Record the refresh-degradation behaviour

One line in `app/CLAUDE.md` graphify section: the `validate:app` script warns (does not fail) when the CLI is absent; the completion report must state when the graph was not refreshed. (Implementation lands with the single-source consolidation spec's script change.)

## Decision 4 — Make the refresh command reproducible (fixes Problem 4)

Pick **one** canonical build configuration and make gate, hooks, and docs agree on it:

1. Decide the corpus: with Decision 1 the intended corpus is *code + SQL + canonical docs*. If `--code-only` excludes Markdown, the gate command must not use it — replace the gate command with the invocation that actually produces the committed graph (to be determined by rebuilding once and diffing; record the exact command in root `CLAUDE.md`, `app/CLAUDE.md`, and the hook).
2. Promote `graphifyy[sql]` from "optional but recommended" to **required** in `app/CLAUDE.md` setup — SQL migrations are a core part of the graph's value here.
3. Pin the graphifyy version used for the committed graph (e.g. a comment in `app/CLAUDE.md` or a `graphify-out/BUILD.md` one-liner with version + command + flags), so refreshes are comparable.
4. Until 1–3 land, agents in fresh environments must **not** commit a refreshed graph whose node count collapses; the shrink is the signal that their environment doesn't match the canonical build config.

---

## Success criteria

1. Rebuilt `graph.json` contains no `docs/superpowers/` or `.claude/skills/` source files; node count drops accordingly (and only for that reason).
2. Both graphify identifiers (`graphifyy` package, `Graphify-Labs/graphify` repo) are correct in root `CLAUDE.md`.
3. A clone without graphify completes `validate:app` with a visible warning.
4. Running the documented gate command on a fresh clone (with the documented setup) reproduces the committed graph's corpus — same source-file set, comparable node count.
