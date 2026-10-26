/**
 * Claude Design sync CLI: compare one area of a mirrored design system with
 * the codebase (`diff`) and record the owner's decisions in the lock (`record`).
 * The mirror is filled by Claude via DesignSync; this script never calls it.
 * Spec: docs/superpowers/specs/2026-10-26-design-system-sync-design.md
 * Decision: D498
 *
 * Run (from app/):
 *   npm run design:sync -- diff --area tokens --mirror <dir>
 *   npm run design:sync -- record --area tokens --mirror <dir> --ids a,b --decision code-wins [--updated-at <iso>]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assetItems } from "./assets";
import { componentItems } from "./components";
import { listFiles } from "./files";
import {
  AREAS,
  DECISIONS,
  classify,
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const LOCK_PATH = join(REPO_ROOT, "docs/design-system/design-sync.lock.json");
const CODE_CSS = "app/src/styles/global.css";

const IN_SCOPE: Record<Area, RegExp> = {
  tokens: /^(tokens\/[^/]+\.css|styles\.css)$/,
  assets: /^assets\/(brand\/[^/]+|icons\/.+)$/,
  components: /^components\/.+\.(jsx|d\.ts|prompt\.md|card\.html)$/,
};

export interface AreaOptions {
  area: Area;
  mirror: string;
  repoRoot: string;
  lockPath: string;
}

export interface RecordOptions extends AreaOptions {
  ids: string[];
  decision: Decision;
  updatedAt?: string;
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
}

function tokensBySource(
  root: string,
  files: string[],
): Map<string, { file: string; token: ParsedToken }> {
  const out = new Map<string, { file: string; token: ParsedToken }>();
  for (const file of files) {
    for (const token of parseTokens(readFileSync(join(root, file), "utf8"))) {
      out.set(token.id, { file, token });
    }
  }
  return out;
}

function tokenItems(
  mirror: string,
  repoRoot: string,
): { items: SyncItem[]; values: DiffReport["values"] } {
  const designFiles = [
    ...listFiles(join(mirror, "tokens"), false)
      .filter((f) => f.endsWith(".css"))
      .map((f) => `tokens/${f}`),
    ...(existsSync(join(mirror, "styles.css")) ? ["styles.css"] : []),
  ];
  const design = tokensBySource(mirror, designFiles);
  const code = tokensBySource(repoRoot, [CODE_CSS]);
  const ids = [...new Set([...design.keys(), ...code.keys()])].sort();
  const values: DiffReport["values"] = {};
  const items = ids.map((id): SyncItem => {
    const d = design.get(id);
    const c = code.get(id);
    values[id] = {
      design: d?.token.value ?? null,
      code: c?.token.value ?? null,
    };
    return {
      id,
      area: "tokens",
      design: d ? { path: d.file, hash: sha256(d.token.value) } : null,
      code: c ? { path: c.file, hash: sha256(c.token.value) } : null,
      comparable: true,
    };
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
 * @param opts - Area options plus ids, decision and optional project updatedAt.
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
  if (opts.updatedAt) lock.projectUpdatedAt = opts.updatedAt;
  writeLock(opts.lockPath, lock);
  return entries;
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
    const area = f.get("area") as Area;
    if (!AREAS.includes(area)) throw new Error(`unknown --area: ${area}`);
    const mirror = f.get("mirror");
    if (!mirror) throw new Error("--mirror is required");
    const opts: AreaOptions = {
      area,
      mirror: resolve(mirror),
      repoRoot: REPO_ROOT,
      lockPath: f.get("lock") ?? LOCK_PATH,
    };
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
        updatedAt: f.get("updated-at"),
      });
      console.log(JSON.stringify(entries, null, 2));
      return 0;
    }
    throw new Error(
      `unknown command: ${command ?? "(none)"} (use diff or record)`,
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
