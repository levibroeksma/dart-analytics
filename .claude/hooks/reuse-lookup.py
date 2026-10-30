#!/usr/bin/env python3
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

STOP = {"module", "data", "engine", "types", "type", "astro", "ts", "index"}
CAP = 8
INVENTORY = "docs/architecture/07-Frontend/08-Component-Inventory.md"
GRAPH = "graphify-out/graph.json"
EXPORT_RE = re.compile(r"export\s+(?:const|function|class|type|interface)\s+(\w+)")
ROW_RE = re.compile(r"^\|\s*`([^`]+\.astro)`\s*\|\s*([^|]*)\|")


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def name_tokens(path):
    base = os.path.basename(path)
    tokens = set()
    for part in re.split(r"[-_.]", base):
        for word in re.findall(r"[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+", part):
            word = word.lower()
            if len(word) >= 3 and word not in STOP:
                tokens.add(word)
    return tokens


def export_names(content):
    return EXPORT_RE.findall(content)


def component_path(name, root):
    hits = sorted(glob.glob(os.path.join(root, "app/src/components/**", name), recursive=True))
    if hits:
        return os.path.relpath(hits[0], root).replace(os.sep, "/")
    return INVENTORY


def inventory_matches(tokens, root):
    out = []
    try:
        with open(os.path.join(root, INVENTORY), encoding="utf-8") as fh:
            for line in fh:
                m = ROW_RE.match(line)
                if not m:
                    continue
                name = m.group(1)
                if tokens & name_tokens(name):
                    out.append((name, component_path(name, root)))
    except OSError:
        pass
    return out


def graph_matches(needles, relpath, root):
    needles = {n.lower() for n in needles}
    if not needles:
        return []
    path = os.path.join(root, GRAPH)
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        return []
    lowered = text.lower()
    if not any(n in lowered for n in needles):
        return []
    out = []
    for node in json.loads(text).get("nodes", []):
        src = node.get("source_file") or ""
        norm = node.get("norm_label") or ""
        if src.startswith("app/src/") and src != relpath and any(n in norm for n in needles):
            out.append((node.get("label") or norm, src))
    return out


def grep_matches(names, root):
    out = []
    for name in names:
        proc = subprocess.run(
            ["git", "grep", "-n", "-E", rf"export .*\b{name}\b", "--", "app/src"],
            capture_output=True, text=True, timeout=2, cwd=root,
        )
        for line in proc.stdout.splitlines():
            parts = line.split(":", 2)
            if len(parts) == 3:
                out.append((name, parts[0]))
    return out


def candidates(relpath, content, root):
    tokens = name_tokens(relpath)
    found = []
    if relpath.endswith(".astro"):
        found = inventory_matches(tokens, root)
    elif relpath.endswith(".ts"):
        names = export_names(content)
        found = graph_matches(tokens | set(names), relpath, root) + grep_matches(names, root)
    seen = set()
    result = []
    for name, path in found:
        if path in seen or path == relpath:
            continue
        seen.add(path)
        result.append(f"{name} — {path}")
        if len(result) == CAP:
            break
    return result


def watched(rel):
    dirs = ("components", "lib", "modules", "types")
    return rel.endswith((".astro", ".ts")) and any(rel.startswith(f"app/src/{d}/") for d in dirs)


def main():
    payload = json.load(sys.stdin)
    if payload.get("tool_name") != "Write":
        return
    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path")
    if not file_path:
        return
    root = os.path.realpath(
        os.environ.get("REUSE_ROOT") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    )
    rel = os.path.relpath(os.path.realpath(file_path), root).replace(os.sep, "/")
    if rel.startswith("../") or rel == ".." or not watched(rel):
        return
    if os.path.exists(os.path.join(root, rel)):
        return

    session = re.sub(r"[^\w.-]", "_", str(payload.get("session_id") or "nosession"))
    state = os.path.join(os.environ.get("TMPDIR") or tempfile.gettempdir(), f"reuse-lookup-{session}")
    try:
        with open(state, encoding="utf-8") as fh:
            if rel in fh.read().split("\n"):
                return
    except OSError:
        pass

    found = candidates(rel, tool_input.get("content", ""), root)
    if not found:
        return
    with open(state, "a", encoding="utf-8") as fh:
        fh.write(rel + "\n")
    deny(
        f"New file {rel}: similar existing code found. Reuse or extend before adding:\n"
        + "\n".join(found)
        + "\nReuse one, or retry the same write stating why none fits."
    )


try:
    main()
except Exception:
    sys.exit(0)
