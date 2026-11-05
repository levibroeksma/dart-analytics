/**
 * Design-system sync CLI: compare one area of a mirrored design system with
 * the codebase (`diff`) and record the owner's decisions in the lock (`record`).
 * The mirror is the Design System artifact's `project/` folder, saved by
 * Claude with the Artifact tool; this script never calls it.
 * Spec: docs/superpowers/specs/2026-11-04-design-system-artifact-sync-design.md
 * Decision: D499
 *
 * Run (from app/):
 *   npm run design:sync -- diff --area tokens --mirror <dir>
 *   npm run design:sync -- ready --mirror <dir>
 *   npm run design:sync -- publish-plan --mirror <dir>
 *   npm run design:sync -- write-tokens --mirror <dir> --ids var:--a,var:--b
 *   npm run design:sync -- migrate-lock --artifact-url <url>
 *   npm run design:sync -- record --area tokens --mirror <dir> --ids a,b --decision code-wins [--last-change-at <iso>]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assetItems } from "./assets";
import { componentItems } from "./components";
import { listFiles } from "./files";
import {
  AREAS,
  DECISIONS,
  classify,
  migrateLock,
  readLock,
  sha256,
  upsertEntries,
  writeLock,
  type Area,
  type Classified,
  type Decision,
  type LockEntry,
  type SyncItem,
} from "./lock";
import { parseTokens, type ParsedToken } from "./tokens";
import { parseTokensJson, representable, writeTokensJson } from "./tokens-json";
import { publishPlan, type PublishPlan } from "./publish";
import { readMarks, readyPlan, type ReadyPlan } from "./ready";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const LOCK_PATH = join(REPO_ROOT, "docs/design-system/design-sync.lock.json");
const CODE_CSS = "app/src/styles/global.css";
const DESIGN_TOKENS = "tokens.json";

const IN_SCOPE: Record<Area, RegExp> = {
  tokens: /^tokens\.json$/,
  assets: /^assets\/(brand\/[^/]+|icons\/.+)\.svg$/i,
  components: /^components\/[A-Z][^/]*\/.+\.(jsx|d\.ts|md|html)$/,
};

export interface MirrorOptions {
  mirror: string;
  repoRoot: string;
  lockPath: string;
}

export interface AreaOptions extends MirrorOptions {
  area: Area;
}

export interface RecordOptions extends AreaOptions {
  ids: string[];
  decision: Decision;
  lastChangeAt?: string;
}

export interface DiffReport {
  area: Area;
  items: Classified[];
  values: Record<string, { design: string | null; code: string | null }>;
}

function assertMirror(area: Area, mirror: string): void {
  const listed = JSON.parse(
    readFileSync(join(mirror, "_paths.json"), "utf8"),
  ) as string[];
  for (const path of listed) {
    if (IN_SCOPE[area].test(path) && !existsSync(join(mirror, path))) {
      throw new Error(`mirror incomplete: ${path}`);
    }
  }
  const known = new Set(listed);
  const stale = listFiles(mirror).find(
    (path) => IN_SCOPE[area].test(path) && !known.has(path),
  );
  if (stale) throw new Error(`mirror stale: ${stale}`);
}

function byId(tokens: ParsedToken[]): Map<string, ParsedToken> {
  return new Map(tokens.map((t) => [t.id, t]));
}

function tokenItems(
  mirror: string,
  repoRoot: string,
): { items: SyncItem[]; values: DiffReport["values"] } {
  const design = byId(
    parseTokensJson(readFileSync(join(mirror, DESIGN_TOKENS), "utf8")),
  );
  const code = byId(
    parseTokens(readFileSync(join(repoRoot, CODE_CSS), "utf8")).filter(
      (t) => t.kind === "var",
    ),
  );
  const ids = [...new Set([...design.keys(), ...code.keys()])].sort();
  const values: DiffReport["values"] = {};
  const items = ids.map((id): SyncItem => {
    const d = design.get(id);
    const c = code.get(id);
    values[id] = { design: d?.value ?? null, code: c?.value ?? null };
    const item: SyncItem = {
      id,
      area: "tokens",
      design: d ? { path: DESIGN_TOKENS, hash: sha256(d.value) } : null,
      code: c ? { path: CODE_CSS, hash: sha256(c.value) } : null,
      comparable: true,
    };
    if (c && !representable(c.value)) item.codeOnly = true;
    return item;
  });
  return { items, values };
}

function buildItems(opts: AreaOptions): {
  items: SyncItem[];
  values: DiffReport["values"];
} {
  assertMirror(opts.area, opts.mirror);
  if (opts.area === "tokens") return tokenItems(opts.mirror, opts.repoRoot);
  if (opts.area === "assets") {
    return { items: assetItems(opts.mirror, opts.repoRoot), values: {} };
  }
  const pairs = readLock(opts.lockPath).pairs;
  return {
    items: componentItems(opts.mirror, opts.repoRoot, pairs),
    values: {},
  };
}

/**
 * Compare one area and classify every item against the lock.
 *
 * @param opts - Area, mirror directory, repo root and lock path.
 * @returns Classified items plus the normalised token values for display.
 */
export function runDiff(opts: AreaOptions): DiffReport {
  const lock = readLock(opts.lockPath);
  const entries = new Map(lock.items.map((e) => [e.id, e]));
  const { items, values } = buildItems(opts);
  return {
    area: opts.area,
    items: items.map((item) => classify(item, entries.get(item.id))),
    values,
  };
}

/**
 * Record the owner's decision for ids, using their hashes as they are now.
 *
 * @param opts - Area options plus ids, decision and optional artifact lastChange.at.
 * @returns The lock entries written.
 */
export function runRecord(opts: RecordOptions): LockEntry[] {
  const { items } = buildItems(opts);
  const byId = new Map(items.map((i) => [i.id, i]));
  const date = new Date().toISOString().slice(0, 10);
  const entries = opts.ids.map((id): LockEntry => {
    const item = byId.get(id);
    if (!item) throw new Error(`unknown id: ${id}`);
    return {
      id,
      area: opts.area,
      designHash: item.design?.hash ?? null,
      codeHash: item.code?.hash ?? null,
      decision: opts.decision,
      date,
    };
  });
  const lock = upsertEntries(readLock(opts.lockPath), entries);
  if (opts.lastChangeAt) lock.lastChangeAt = opts.lastChangeAt;
  writeLock(opts.lockPath, lock);
  return entries;
}

/**
 * Diff every area and sort the mirror's ready marks into a work list.
 *
 * @param opts - Mirror directory, repo root and lock path.
 * @returns The ready plan.
 */
export function runReady(opts: MirrorOptions): ReadyPlan {
  const reports = AREAS.map((area) => runDiff({ ...opts, area }));
  return readyPlan(readMarks(opts.mirror), reports);
}

/**
 * Diff tokens and assets against the checked-out code and list what changed
 * on it since the lock (run on a checkout of `origin/main`).
 *
 * @param opts - Mirror directory, repo root and lock path.
 * @returns The after-merge publish plan.
 */
export function runPublishPlan(opts: MirrorOptions): PublishPlan {
  const items = readLock(opts.lockPath).items;
  const accepted = new Set(
    items.filter((e) => e.decision === "accepted-divergence").map((e) => e.id),
  );
  const reports = (["tokens", "assets"] as const).map((area) => {
    const report = runDiff({ ...opts, area });
    return {
      ...report,
      items: report.items.filter((i) => !accepted.has(i.id)),
    };
  });
  return publishPlan(
    reports,
    readMarks(opts.mirror),
    items.map((e) => e.id),
  );
}

/**
 * Write the code's values for token ids into the mirror's `tokens.json`.
 *
 * @param opts - Mirror directory, repo root and lock path.
 * @param ids - `var:` ids to write.
 */
export function runWriteTokens(opts: MirrorOptions, ids: string[]): void {
  const code = byId(
    parseTokens(readFileSync(join(opts.repoRoot, CODE_CSS), "utf8")),
  );
  const updates: Record<string, string> = {};
  for (const id of ids) {
    if (!id.startsWith("var:")) throw new Error(`not a token: ${id}`);
    const raw = code.get(id)?.raw;
    if (raw === undefined) throw new Error(`no code value for ${id}`);
    updates[id.slice(4)] = raw;
  }
  const path = join(opts.mirror, DESIGN_TOKENS);
  writeFileSync(path, writeTokensJson(readFileSync(path, "utf8"), updates));
}

function flags(argv: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--"))
      throw new Error(`unexpected argument: ${argv[i]}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`missing value for ${argv[i]}`);
    }
    out.set(argv[i].slice(2), value);
    i++;
  }
  return out;
}

/**
 * CLI entry point.
 *
 * @param argv - Arguments after the script name.
 * @returns Process exit code.
 */
export function main(argv: string[]): number {
  try {
    const [command, ...rest] = argv;
    const f = flags(rest);
    if (command === "migrate-lock") {
      const url = f.get("artifact-url");
      if (!url) throw new Error("--artifact-url is required");
      const lockPath = f.get("lock") ?? LOCK_PATH;
      const { lock, removed, pairsRewritten } = migrateLock(
        JSON.parse(readFileSync(lockPath, "utf8")),
        url,
      );
      writeLock(lockPath, lock);
      console.log(JSON.stringify({ removed, pairsRewritten }));
      return 0;
    }
    const mirror = f.get("mirror");
    if (!mirror) throw new Error("--mirror is required");
    const base: MirrorOptions = {
      mirror: resolve(mirror),
      repoRoot: REPO_ROOT,
      lockPath: f.get("lock") ?? LOCK_PATH,
    };
    if (command === "ready") {
      console.log(JSON.stringify(runReady(base), null, 2));
      return 0;
    }
    if (command === "publish-plan") {
      console.log(JSON.stringify(runPublishPlan(base), null, 2));
      return 0;
    }
    if (command === "write-tokens") {
      const ids = (f.get("ids") ?? "").split(",").filter(Boolean);
      if (ids.length === 0) throw new Error("--ids is required");
      runWriteTokens(base, ids);
      return 0;
    }
    const area = f.get("area") as Area;
    if (!AREAS.includes(area)) throw new Error(`unknown --area: ${area}`);
    const opts: AreaOptions = { ...base, area };
    if (command === "diff") {
      console.log(JSON.stringify(runDiff(opts), null, 2));
      return 0;
    }
    if (command === "record") {
      const decision = f.get("decision") as Decision;
      if (!DECISIONS.includes(decision)) {
        throw new Error(`unknown --decision: ${decision}`);
      }
      const ids = (f.get("ids") ?? "").split(",").filter(Boolean);
      if (ids.length === 0) throw new Error("--ids is required");
      const entries = runRecord({
        ...opts,
        ids,
        decision,
        lastChangeAt: f.get("last-change-at"),
      });
      console.log(JSON.stringify(entries, null, 2));
      return 0;
    }
    throw new Error(
      `unknown command: ${command ?? "(none)"} (use diff, record, ready, publish-plan, write-tokens or migrate-lock)`,
    );
  } catch (error) {
    console.error(`design-sync: ${(error as Error).message}`);
    return 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(main(process.argv.slice(2)));
}
