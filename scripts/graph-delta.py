#!/usr/bin/env python3
"""Compare two graphify graph.json files and report the node/link delta.

`built_at_commit` records the HEAD a graph was built from, so it changes on
every commit and makes raw byte comparison useless. By never reading
`built_at_commit` and sorting nodes/links consistently, two rebuilds of the
same tree compare identically (verified 2026-08-03). This script exists so
both CI jobs and a human use the same normalisation rather than three
subtly different ones.

Usage: graph-delta.py OLD.json NEW.json
Exit code is always 0 — this reports, it does not judge.
"""
import json
import sys

SAMPLE_CAP = 5


def load(path):
    """Load a graphify graph.json. Missing, unparseable, or wrong type ->
    treated as an empty graph (a fresh clone may not have a prior graph.json yet)."""
    try:
        with open(path) as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"note: {path} not found — treating as empty graph")
        return {"nodes": [], "links": []}
    except (json.JSONDecodeError, OSError) as e:
        print(f"note: {path} unparseable ({e}) — treating as empty graph")
        return {"nodes": [], "links": []}

    if not isinstance(data, dict):
        print(f"note: {path} is {type(data).__name__}, not a JSON object — treating as empty graph")
        return {"nodes": [], "links": []}

    for key in ("nodes", "links"):
        value = data.get(key, [])
        if not isinstance(value, list):
            print(f"note: {path} {key!r} is {type(value).__name__}, not a list — treating as empty {key}")
            data[key] = []
            continue
        clean = [item for item in value if isinstance(item, dict)]
        dropped = len(value) - len(clean)
        if dropped:
            print(f"note: {path} {key!r} had {dropped} non-object entr{'y' if dropped == 1 else 'ies'} — dropped")
        data[key] = clean

    return data


def normalise(nodes, links):
    """Sort nodes/links so two rebuilds of the same tree compare byte-identical.
    Never reads built_at_commit, so it cannot affect the comparison."""
    norm_nodes = sorted(
        (json.dumps(n, sort_keys=True) for n in nodes)
    )
    norm_links = sorted(
        (json.dumps(l, sort_keys=True) for l in links)
    )
    return norm_nodes, norm_links


def node_ids(nodes):
    """Set of node ids, independent of any other field (community, etc.)."""
    return {n.get("id", "?") for n in nodes}


def main():
    if len(sys.argv) != 3:
        print("Usage: graph-delta.py OLD.json NEW.json", file=sys.stderr)
        return 0

    old_path, new_path = sys.argv[1], sys.argv[2]
    old = load(old_path)
    new = load(new_path)

    old_nodes_raw = old.get("nodes", [])
    old_links_raw = old.get("links", [])
    new_nodes_raw = new.get("nodes", [])
    new_links_raw = new.get("links", [])
    old_nodes, old_links = normalise(old_nodes_raw, old_links_raw)
    new_nodes, new_links = normalise(new_nodes_raw, new_links_raw)

    old_node_count, new_node_count = len(old_nodes), len(new_nodes)
    old_link_count, new_link_count = len(old_links), len(new_links)
    node_delta = new_node_count - old_node_count
    link_delta = new_link_count - old_link_count

    print(f"nodes: old={old_node_count} new={new_node_count} delta={node_delta:+d}")
    print(f"links: old={old_link_count} new={new_link_count} delta={link_delta:+d}")

    if old_nodes == new_nodes and old_links == new_links:
        print("identical")
        return 0

    # Sample by node identity (id), not by full-record equality — a node
    # whose only change is e.g. a reassigned community is neither truly
    # added nor removed, and showing it as both would mislead the reader.
    old_ids = node_ids(old_nodes_raw)
    new_ids = node_ids(new_nodes_raw)
    added_ids = sorted(new_ids - old_ids)[:SAMPLE_CAP]
    removed_ids = sorted(old_ids - new_ids)[:SAMPLE_CAP]

    print(f"nodes added (sample, cap {SAMPLE_CAP}): {added_ids}")
    print(f"nodes removed (sample, cap {SAMPLE_CAP}): {removed_ids}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
