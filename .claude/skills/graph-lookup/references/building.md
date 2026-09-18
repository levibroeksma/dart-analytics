# Building and refreshing the knowledge graph

Read this only when the question is about how the graph is produced. Looking something *up* needs none of it — see the sibling `SKILL.md`.

## Freshness is CI-owned

`.github/workflows/graph.yml` installs `graphifyy[sql]`, runs `bash scripts/refresh-graph.sh` with `GRAPH_REFRESH_STRICT=1`, commits the result to `chore/graph-refresh` and opens a PR with the node/link delta. That PR's commit is unsigned and `main`'s ruleset requires verified signatures, so only a bypass actor can merge it — landing a refresh is one deliberate human merge (D289). If the PR cannot be opened at all, the workflow files a `graph: refresh PR could not be opened` issue rather than passing silently (D287).

None of this is a local completion-report item. Do not stage `graphify-out/graph.json` yourself: a local graph commit only creates a conflict against the open refresh PR (D185, D287).

## Optional local install

Only useful for querying with the CLI instead of the Python recipe in `SKILL.md`. Nothing in this repo depends on it.

```
uv tool install graphifyy    # or: pipx install graphifyy
pip install "graphifyy[sql]" # REQUIRED — without it all SQL migrations vanish from the graph
```

With the CLI present, `graphify query "<question>"`, `graphify path "<A>" "<B>"` and `graphify explain "<entity>"` are a nicer interface to the same committed file.

`graphify hook install` adds an AST-only rebuild on commit. If you install it, still do not stage the output — see above.

## Rebuild rules

- Rebuilds go through `scripts/refresh-graph.sh`, which holds the canonical flags. It warns instead of failing when the CLI is absent locally; CI sets `GRAPH_REFRESH_STRICT=1`, where the same conditions are hard failures.
- The canonical command is `graphify update .`, empirically determined — not `graphify extract . --update`, which demands an LLM API key.
- Extraction is AST-only. Never configure an LLM API key for graphify: it keeps the build free and deterministic.
- `graphify-out/graph.json` is committed; `graphify-out/graph.html` and the regenerable report are gitignored.
