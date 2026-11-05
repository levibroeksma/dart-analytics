import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  main,
  runDiff,
  runPublishPlan,
  runReady,
  runRecord,
  runWriteTokens,
} from "../../../scripts/design-sync/cli";
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

  it("does not require non-SVG files in the assets area", () => {
    const opts = setup([
      "assets/icons/README.md",
      "assets/brand/app-icon-512.png",
      "assets/icons/a.svg",
    ]);
    put(opts.mirror, "assets/icons/a.svg", "<svg/>");
    expect(() => runDiff({ area: "assets", ...opts })).not.toThrow();
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

  it("migrate-lock rewrites keys, drops rules, rewrites pairs", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const lockPath = join(mkdtempSync(join(tmpdir(), "ds-lock-")), "l.json");
    const entry = (id: string) => ({
      id,
      area: "tokens",
      designHash: "d",
      codeHash: "c",
      decision: "code-wins",
      date: "2026-10-26",
    });
    writeFileSync(
      lockPath,
      JSON.stringify({
        projectId: "p",
        projectUpdatedAt: "2026-10-26T10:00:00Z",
        pairs: [
          { design: "components/buttons/Button", code: ["a.astro"] },
          { design: null, code: ["b.astro"] },
        ],
        items: [
          entry("var:--accent"),
          entry("rule:glass"),
          entry("keyframes:skpulse"),
        ],
      }),
    );
    const code = main([
      "migrate-lock",
      "--artifact-url",
      "https://claude.ai/artifact/A7QFuSqRwpqyoXUEm7XHsW",
      "--lock",
      lockPath,
    ]);
    expect(code).toBe(0);
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({ removed: 2, pairsRewritten: 1 }),
    );
    log.mockRestore();
    const lock = readLock(lockPath);
    expect(lock).toEqual({
      artifactUrl: "https://claude.ai/artifact/A7QFuSqRwpqyoXUEm7XHsW",
      lastChangeAt: null,
      pairs: [
        { design: "components/Button/Button", code: ["a.astro"] },
        { design: null, code: ["b.astro"] },
      ],
      items: [entry("var:--accent")],
    });
  });

  it("runReady sorts the mirror's marks across every area", () => {
    const opts = setup();
    put(
      opts.mirror,
      "sync-ready.json",
      JSON.stringify({ v: 1, items: [{ id: "var:--accent" }, { id: "x" }] }),
    );
    expect(runReady(opts)).toEqual({
      apply: [],
      conflicts: ["var:--accent"],
      oneSided: [],
      inSync: [],
      unknown: ["x"],
    });
  });

  it("runPublishPlan lists a token changed on main since the lock", () => {
    const opts = setup();
    runRecord({
      area: "tokens",
      ...opts,
      ids: ["var:--accent"],
      decision: "code-wins",
    });
    put(
      opts.repoRoot,
      "app/src/styles/global.css",
      ":root { --accent: #7dd3fc; --bg: #000000; }",
    );
    expect(runPublishPlan(opts)).toEqual({
      publish: ["var:--accent"],
      conflicts: [],
      newOnMain: [],
    });
  });

  it("runPublishPlan never publishes an accepted divergence", () => {
    const opts = setup();
    runRecord({
      area: "tokens",
      ...opts,
      ids: ["var:--accent"],
      decision: "accepted-divergence",
    });
    put(
      opts.repoRoot,
      "app/src/styles/global.css",
      ":root { --accent: #7dd3fc; --bg: #000000; }",
    );
    expect(runPublishPlan(opts)).toEqual({
      publish: [],
      conflicts: [],
      newOnMain: [],
    });
  });

  it("runPublishPlan does not list an accepted code-only token as new", () => {
    const opts = setup();
    const css = (v: string) =>
      `:root { --accent: #0ea5e9; --bg: #000; --extra: ${v}; }`;
    put(opts.repoRoot, "app/src/styles/global.css", css("1rem"));
    runRecord({
      area: "tokens",
      ...opts,
      ids: ["var:--extra"],
      decision: "accepted-divergence",
    });
    put(opts.repoRoot, "app/src/styles/global.css", css("2rem"));
    expect(runPublishPlan(opts).newOnMain).toEqual([]);
  });

  it("marks an unrepresentable code value code-only even with a design twin", () => {
    const opts = setup();
    put(
      opts.repoRoot,
      "app/src/styles/global.css",
      ":root { --accent: color-mix(in oklch, var(--bg) 40%, white); --bg: #000; }",
    );
    const accent = runDiff({ area: "tokens", ...opts }).items.find(
      (i) => i.id === "var:--accent",
    );
    expect(accent).toMatchObject({ status: "code-only", proposal: null });
  });

  it("runWriteTokens takes the :root value, not a scoped override or comment", () => {
    const opts = setup();
    put(
      opts.repoRoot,
      "app/src/styles/global.css",
      ":root { --accent: oklch(70% 0.1 230); --bg: #000; }\n.tab { --accent: var(--sky); }\n/* --accent: red; */",
    );
    runWriteTokens(opts, ["var:--accent"]);
    const doc = JSON.parse(
      readFileSync(join(opts.mirror, "tokens.json"), "utf8"),
    );
    expect(doc.color.tokens[0].value).toBe("oklch(70% 0.1 230)");
  });

  it("runWriteTokens writes the code's raw values into the mirror", () => {
    const opts = setup();
    put(
      opts.repoRoot,
      "app/src/styles/global.css",
      ":root { --accent: oklch(70% 0.1 230); --bg: #000; --bg-accent: #111; }",
    );
    runWriteTokens(opts, ["var:--accent"]);
    const doc = JSON.parse(
      readFileSync(join(opts.mirror, "tokens.json"), "utf8"),
    );
    expect(doc.color.tokens[0]).toEqual({
      name: "accent",
      value: "oklch(70% 0.1 230)",
    });
    expect(() => runWriteTokens(opts, ["icon:x.svg"])).toThrow(
      "not a token: icon:x.svg",
    );
  });

  it.each([["toString"], ["nope"], [undefined]])(
    "exits non-zero on unknown command %s",
    (command) => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(main(command === undefined ? [] : [command])).toBe(1);
      expect(err).toHaveBeenCalledWith(
        expect.stringMatching(/^design-sync: unknown command/),
      );
      err.mockRestore();
    },
  );

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
