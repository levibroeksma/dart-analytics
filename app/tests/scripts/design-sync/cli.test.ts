import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { main, runDiff, runRecord } from "../../../scripts/design-sync/cli";
import { readLock, writeLock } from "../../../scripts/design-sync/lock";

const put = (root: string, rel: string, text: string): void => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

const TOKENS = JSON.stringify({
  color: {
    themes: [{ id: "dark" }],
    tokens: [
      { name: "accent", value: "#0EA5E9" },
      { name: "bg", value: "#000" },
    ],
  },
});

const setup = (paths: string[] = ["tokens.json"]) => {
  const mirror = mkdtempSync(join(tmpdir(), "ds-mirror-"));
  const repo = mkdtempSync(join(tmpdir(), "ds-repo-"));
  const lockPath = join(repo, "lock.json");
  put(mirror, "_paths.json", JSON.stringify(paths));
  put(mirror, "tokens.json", TOKENS);
  put(
    repo,
    "app/src/styles/global.css",
    ":root { --accent: #38bdf8; --bg: #000000; }",
  );
  writeLock(lockPath, {
    artifactUrl: "https://claude.ai/artifact/x",
    lastChangeAt: null,
    pairs: [],
    items: [],
  });
  return { mirror, repoRoot: repo, lockPath };
};

describe("design-sync cli", () => {
  it("mirror check uses the artifact layout", () => {
    const opts = setup();
    rmSync(join(opts.mirror, "tokens.json"));
    expect(() => runDiff({ area: "tokens", ...opts })).toThrow(
      "mirror incomplete: tokens.json",
    );
  });

  it("record --last-change-at stores lastChangeAt", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const opts = setup();
    const code = main([
      "record",
      "--area",
      "tokens",
      "--mirror",
      opts.mirror,
      "--lock",
      opts.lockPath,
      "--ids",
      "var:--accent",
      "--decision",
      "code-wins",
      "--last-change-at",
      "2026-11-04T10:00:00Z",
    ]);
    log.mockRestore();
    expect(code).toBe(0);
    expect(readLock(opts.lockPath).lastChangeAt).toBe("2026-11-04T10:00:00Z");
  });

  it("aborts when the mirror holds an in-scope file the project no longer lists", () => {
    const opts = setup();
    put(opts.mirror, "assets/icons/old.svg", "<svg/>");
    expect(() => runDiff({ area: "assets", ...opts })).toThrow(
      "mirror stale: assets/icons/old.svg",
    );
  });

  it("does not require out-of-scope files", () => {
    const opts = setup([
      "tokens.json",
      "tokens/colors.css",
      "Brand Style.dc.html",
      "app/src/icons/x.svg",
      "assets/icons/x.svg",
    ]);
    expect(() => runDiff({ area: "tokens", ...opts })).not.toThrow();
  });

  it("treats listed directory paths as directories, not missing files", () => {
    const opts = setup([
      "assets/icons",
      "assets/icons/nav",
      "assets/icons/nav/a.svg",
    ]);
    put(opts.mirror, "assets/icons/nav/a.svg", "<svg/>");
    expect(() => runDiff({ area: "assets", ...opts })).not.toThrow();
    put(
      opts.mirror,
      "_paths.json",
      JSON.stringify(["assets/icons/nav", "assets/icons/nav/b.svg"]),
    );
    expect(() => runDiff({ area: "assets", ...opts })).toThrow(
      "mirror incomplete: assets/icons/nav/b.svg",
    );
  });

  it("reports a differing token as mismatch/owner on an empty lock", () => {
    const report = runDiff({ area: "tokens", ...setup() });
    const accent = report.items.find((i) => i.id === "var:--accent");
    expect(accent).toMatchObject({ status: "mismatch", proposal: "owner" });
    expect(accent?.design?.path).toBe("tokens.json");
    expect(accent?.code?.path).toBe("app/src/styles/global.css");
    expect(report.values["var:--accent"]).toEqual({
      design: "#0ea5e9",
      code: "#38bdf8",
    });
    expect(report.items.find((i) => i.id === "var:--bg")?.status).toBe(
      "mismatch",
    );
  });

  it("record stores hashes that a following diff accepts", () => {
    const opts = setup();
    runRecord({
      area: "tokens",
      ...opts,
      ids: ["var:--accent"],
      decision: "accepted-divergence",
      lastChangeAt: "2026-11-04T10:00:00Z",
    });
    const lock = readLock(opts.lockPath);
    expect(lock.lastChangeAt).toBe("2026-11-04T10:00:00Z");
    expect(lock.items[0]).toMatchObject({
      id: "var:--accent",
      area: "tokens",
      decision: "accepted-divergence",
    });
    const accent = runDiff({ area: "tokens", ...opts }).items.find(
      (i) => i.id === "var:--accent",
    );
    expect(accent?.status).toBe("accepted");
  });

  it("record rejects an id the area does not have", () => {
    const opts = setup();
    expect(() =>
      runRecord({
        area: "tokens",
        ...opts,
        ids: ["var:--nope"],
        decision: "code-wins",
      }),
    ).toThrow("unknown id: var:--nope");
  });

  it("marks unrepresentable code values code-only", () => {
    const opts = setup();
    put(
      opts.repoRoot,
      "app/src/styles/global.css",
      ":root { --accent: #0ea5e9; --bg: #000; --vignette: radial-gradient(circle, color-mix(in oklch, var(--bg) 40%, transparent), transparent); }",
    );
    const v = runDiff({ area: "tokens", ...opts }).items.find(
      (i) => i.id === "var:--vignette",
    );
    expect(v).toMatchObject({ status: "code-only", proposal: null });
  });

  it("drops rule and keyframes from the tokens area", () => {
    const opts = setup();
    put(
      opts.repoRoot,
      "app/src/styles/global.css",
      ":root { --accent: #0ea5e9; --bg: #000; } @utility glass { color: red; } @keyframes skpulse { to { opacity: 1; } }",
    );
    const ids = runDiff({ area: "tokens", ...opts }).items.map((i) => i.id);
    expect(ids).toEqual(["var:--accent", "var:--bg"]);
  });

  it("exits non-zero on an unknown area", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const opts = setup();
    expect(
      main([
        "diff",
        "--area",
        "pages",
        "--mirror",
        opts.mirror,
        "--lock",
        opts.lockPath,
      ]),
    ).not.toBe(0);
    err.mockRestore();
  });
});
