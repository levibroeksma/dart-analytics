---
name: graph-lookup
description: Use to locate a named entity in THIS repository — which file defines a symbol, what calls or imports it, how app code, SQL migrations and docs connect — when you would otherwise start a broad grep or directory sweep. Queries the committed graphify-out/graph.json. Not for building, rebuilding or exporting the graph.
---

# Graph Lookup

`graphify-out/graph.json` is a committed AST-only knowledge graph over this repo's TypeScript, SQL and Markdown. Use it to find where something lives, then read that file. The graph is a map, not authority: on any conflict the authority order in `docs/architecture/00-Context-Map.md` wins, so verify what the graph says against the file it names.

## Never read the file whole

It is 7.7 MB — roughly 1.9M tokens. `Read` on it is denied in `.claude/settings.json` (D314). Query it instead; the queries below return a handful of lines.

## Find a symbol and everything that touches it

```bash
python3 - <<'PY'
import json
NAME = "resolveCheckoutAttempt"   # substitute the symbol you are looking for
g = json.load(open("graphify-out/graph.json"))
hits = [n for n in g["nodes"] if NAME.lower() in n["norm_label"]]
for n in hits:
    print(f'{n["label"]:40} {n["source_file"]}:{n["source_location"]}')
ids = {n["id"] for n in hits}
for l in g["links"]:
    if l["source"] in ids or l["target"] in ids:
        print(f'  {l["relation"]:12} {l["source_file"]}:{l["source_location"]}')
PY
```

Widen by substring, not by exact name — `norm_label` is lowercased. A search for a common fragment returns a lot; narrow it before widening it.

## Scope caveats

- `.astro` files are only partially parsed (no tree-sitter grammar). TypeScript, JavaScript, SQL and Markdown are fully covered.
- The graph lags `main` by at most one merge — CI rebuilds it on every merge and opens a PR with the delta.
- Nothing about a `.astro` component's markup is in here. For frontend work, the context pack in `00-Context-Map.md` is the right starting point, not this skill.

## Building or refreshing the graph

Not this skill's job, and not a local task — freshness is CI-owned. See `references/building.md`.
