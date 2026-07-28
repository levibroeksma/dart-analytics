#!/usr/bin/env bash
# No-inline-comments gate (app/CLAUDE.md "TypeScript comments"): no `//` or
# non-JSDoc `/* */` comment inside a function/method body under
# app/src/**/*.ts; detail belongs in a JSDoc block (`/** */`) above the
# declaration instead — JSDoc is always exempt, matching that existing rule's
# "prefer names that read naturally; put necessary detail in JSDoc above the
# declaration." Also exempt: `// fallow-ignore-next-line ...` tool
# directives, `///` triple-slash references. Out of scope, per the existing
# rule: app/tests/, app/scripts/.
#
# A `{` counts as opening a function/method body when the buffer of
# non-whitespace text since the last `{`/`}`/`;` ends in `)` or `=>` (arrow
# functions), or in `)` optionally followed by a `:`-led return-type
# annotation (e.g. `(x: number): boolean {`, `(): Promise<Response> {`) —
# this is what tells a function/method/arrow body apart from an interface
# body, a class body, a type literal, or an object literal, all of which
# also use `{}` but are not "function bodies" under this rule. Interface
# method *signatures* (`foo(): void;`) never reach a `{` at all, so they're
# never misclassified.
#
# BLIND SPOT: this is a lexical heuristic, not an AST. A bare block statement
# `{ ... }` at module level (not preceded by `)`/`=>`) is treated as
# non-function, so a top-level scoping block would not be checked; and a
# `switch (x) { ... }` at module level (rare in this codebase) would be
# treated as a function body since its `{` is preceded by `)`. Neither shape
# appears in this codebase's current style. A return type that itself
# contains an object-literal shape with braces, e.g.
# `foo(): { ok: true } | { ok: false } {`, is now correctly handled: braces
# belonging to the return-type annotation are tracked on their own small
# depth counter (entered right after a `)` is immediately followed by `:`)
# and skipped without disturbing the real function-body brace stack or the
# preceding-token buffer, so the real body `{` is still classified
# correctly. Residual gap: a return type containing a generic whose type
# argument itself has braces, e.g. `foo(): Promise<{ a: number }> {`, is
# still misclassified — `<`/`>` are not tracked as brackets by this
# heuristic, so the `{` inside `Promise<...>` is seen at return-type depth 0
# with the "expecting a type" flag already false (having been cleared by the
# preceding `<`), and is incorrectly classified as the real function-body
# open instead of an increment of the return-type depth counter. Not present
# in this codebase's current style as of this writing.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

python3 - <<'PY'
import re
import sys
from pathlib import Path

ROOT = Path("app/src")
EXEMPT_PREFIXES = ("app/tests/", "app/scripts/")

ARROW_OPEN_RE = re.compile(r"=>\s*$")
PAREN_RETURN_OPEN_RE = re.compile(r"\)\s*(:[^{}();]*)?$")


def is_function_open(preceding: str) -> bool:
    return bool(ARROW_OPEN_RE.search(preceding)) or bool(PAREN_RETURN_OPEN_RE.search(preceding))


def _peek_non_ws(text: str, i: int) -> str:
    n = len(text)
    j = i + 1
    while j < n and text[j].isspace():
        j += 1
    return text[j] if j < n else ""


fail = False


def scan(path: Path) -> None:
    global fail
    text = path.read_text(encoding="utf-8")
    stack: list[bool] = []
    i = 0
    n = len(text)
    line = 1
    in_string = None
    preceding_buf = ""
    # Return-type-annotation scanning: entered right after a `)` that is
    # immediately (modulo whitespace) followed by `:`. While active, braces
    # (and brackets/parens) belonging to the return type's own shape are
    # tracked on `return_type_depth` instead of the real `stack`, so they
    # cannot reset `preceding_buf` or be mistaken for a real function body.
    # `return_type_expecting` tracks whether we're at a position where a new
    # type atom (identifier, or an object-literal-shaped `{...}`) is
    # expected — true on entry and right after a `|`/`&` type operator,
    # false once any atom content has been consumed. A `{` seen at depth 0
    # while still "expecting" opens a nested type-literal shape (e.g. a
    # union member); a `{` seen at depth 0 once an atom has already been
    # consumed is the real function body.
    return_type_active = False
    return_type_depth = 0
    return_type_expecting = True

    def in_func() -> bool:
        return any(stack)

    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if ch == "\n":
            line += 1
            i += 1
            continue
        if in_string:
            if ch == "\\":
                i += 2
                continue
            if ch == in_string:
                in_string = None
            i += 1
            continue
        if ch in "\"'`":
            in_string = ch
            i += 1
            continue
        if ch == "/" and nxt == "/":
            end = text.find("\n", i)
            comment = text[i : end if end != -1 else n]
            if in_func() and not comment.startswith("///") and "fallow-ignore-next-line" not in comment:
                print(f"FAIL: {path}:{line}: `//` comment inside a function/method body — move detail to a JSDoc block above the declaration", file=sys.stderr)
                fail = True
            i = end if end != -1 else n
            continue
        if ch == "/" and nxt == "*":
            end = text.find("*/", i + 2)
            comment = text[i : (end + 2) if end != -1 else n]
            is_jsdoc = comment.startswith("/**")
            if in_func() and not is_jsdoc:
                print(f"FAIL: {path}:{line}: `/* */` comment inside a function/method body — use a `/** */` JSDoc block above the declaration instead", file=sys.stderr)
                fail = True
            line += comment.count("\n")
            i = (end + 2) if end != -1 else n
            continue
        if return_type_active:
            handled = True
            if ch in "{[(":
                if ch == "{" and return_type_depth == 0 and not return_type_expecting:
                    stack.append(True)
                    preceding_buf = ""
                    return_type_active = False
                else:
                    return_type_depth += 1
                    return_type_expecting = False
            elif ch in "}])":
                if return_type_depth > 0:
                    return_type_depth -= 1
            elif return_type_depth == 0 and ch in ";,":
                return_type_active = False
                handled = False
            elif return_type_depth == 0 and ch in "|&":
                return_type_expecting = True
            else:
                if return_type_depth == 0 and not ch.isspace() and ch != ":":
                    return_type_expecting = False
            if handled:
                i += 1
                continue
        if ch == ")" and not return_type_active:
            if _peek_non_ws(text, i) == ":":
                return_type_active = True
                return_type_depth = 0
                return_type_expecting = True
            preceding_buf = (preceding_buf + ch)[-500:]
            i += 1
            continue
        if ch == "{":
            stack.append(is_function_open(preceding_buf))
            preceding_buf = ""
            i += 1
            continue
        if ch == "}":
            if stack:
                stack.pop()
            preceding_buf = ""
            i += 1
            continue
        if ch == ";":
            preceding_buf = ""
            i += 1
            continue
        if not ch.isspace():
            preceding_buf = (preceding_buf + ch)[-500:]
        i += 1


files = [
    p
    for p in sorted(ROOT.rglob("*.ts"))
    if not any(str(p).startswith(prefix) for prefix in EXEMPT_PREFIXES)
]
if not files:
    print("FAIL: no .ts files found under app/src", file=sys.stderr)
    sys.exit(1)

for p in files:
    scan(p)

if fail:
    sys.exit(1)

print(f"OK: no inline // or non-JSDoc /* */ comments inside function/method bodies across {len(files)} file(s) under app/src.")
PY
