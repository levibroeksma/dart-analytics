/**
 * Lock model for the design-system sync: per-item hashes at the last sync,
 * the owner's decision, and the classifier that turns a fresh comparison into
 * a status plus a proposed direction. The lock is a direction hint only;
 * comparable items are matched by comparing the two sides directly.
 * Spec: docs/superpowers/specs/2026-10-26-design-system-sync-design.md
 * Decision: D499
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

export type Area = "tokens" | "assets" | "components";

export const AREAS: readonly Area[] = ["tokens", "assets", "components"];

export interface Side {
  path: string;
  hash: string;
}

export interface SyncItem {
  id: string;
  area: Area;
  design: Side | null;
  code: Side | null;
  comparable: boolean;
  codeOnly?: true;
}

export type Decision = "code-wins" | "design-wins" | "accepted-divergence";

export const DECISIONS: readonly Decision[] = [
  "code-wins",
  "design-wins",
  "accepted-divergence",
];

export interface LockEntry {
  id: string;
  area: Area;
  designHash: string | null;
  codeHash: string | null;
  decision: Decision;
  date: string;
}

export interface ComponentPair {
  design: string | null;
  code: string[];
}

export interface Lock {
  artifactUrl: string;
  lastChangeAt: string | null;
  pairs: ComponentPair[];
  items: LockEntry[];
}

export type Proposal = "design-to-code" | "code-to-design" | "owner";

export interface Classified extends SyncItem {
  status: "in-sync" | "accepted" | "mismatch" | "code-only";
  proposal: Proposal | null;
}

/**
 * Hash content for change detection.
 *
 * @param text - Normalised text or raw bytes.
 * @returns Hex sha256 digest.
 */
export function sha256(text: string | Buffer): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Classify one item against its lock entry (spec direction table).
 *
 * @param item - Both sides as they are now.
 * @param entry - The item's lock entry, if it was ever synced.
 * @returns The item with its status and proposed direction.
 */
export function classify(
  item: SyncItem,
  entry: LockEntry | undefined,
): Classified {
  if (item.codeOnly) return { ...item, status: "code-only", proposal: null };
  const status = settledStatus(item, entry);
  if (status) return { ...item, status, proposal: null };
  return { ...item, status: "mismatch", proposal: direction(item, entry) };
}

/** `in-sync` or `accepted` when nothing needs deciding, else null. */
function settledStatus(
  item: SyncItem,
  entry: LockEntry | undefined,
): "in-sync" | "accepted" | null {
  const [designHash, codeHash] = hashes(item);
  if (item.comparable && designHash !== null && designHash === codeHash) {
    return "in-sync";
  }
  if (!entry) return null;
  if (entry.designHash !== designHash || entry.codeHash !== codeHash) {
    return null;
  }
  if (entry.decision === "accepted-divergence") return "accepted";
  return item.comparable ? null : "in-sync";
}

function hashes(item: SyncItem): [string | null, string | null] {
  return [item.design?.hash ?? null, item.code?.hash ?? null];
}

/** Which side changed since the lock; `owner` when both or no entry. */
function direction(item: SyncItem, entry: LockEntry | undefined): Proposal {
  if (!entry) return "owner";
  const [designHash, codeHash] = hashes(item);
  const designChanged = entry.designHash !== designHash;
  const codeChanged = entry.codeHash !== codeHash;
  if (designChanged === codeChanged) return "owner";
  return designChanged ? "design-to-code" : "code-to-design";
}

/**
 * Read the lock file.
 *
 * @param path - Lock file path.
 * @returns The parsed lock.
 */
export function readLock(path: string): Lock {
  const lock = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  if ("projectId" in lock) throw new Error("lock: run migrate-lock");
  return lock as unknown as Lock;
}

/**
 * Convert a Claude Design lock to the artifact layout: artifact keys instead
 * of project keys, no `rule:`/`keyframes:` entries (code-owned now), and
 * component pairs pointing at `components/<Name>/<Name>`.
 *
 * @param old - The parsed old lock.
 * @param artifactUrl - The Design System artifact's URL.
 * @returns The migrated lock plus counts of what changed.
 */
export function migrateLock(
  old: unknown,
  artifactUrl: string,
): { lock: Lock; removed: number; pairsRewritten: number } {
  const src = old as { pairs?: ComponentPair[]; items?: LockEntry[] };
  const items = (src.items ?? []).filter(
    (e) => !/^(rule|keyframes):/.test(e.id),
  );
  let pairsRewritten = 0;
  const pairs = (src.pairs ?? []).map((p) => {
    const m = p.design && /^components\/[^/]+\/([^/]+)$/.exec(p.design);
    const design = m ? `components/${m[1]}/${m[1]}` : p.design;
    if (design === p.design) return p;
    pairsRewritten++;
    return { ...p, design };
  });
  return {
    lock: { artifactUrl, lastChangeAt: null, pairs, items },
    removed: (src.items ?? []).length - items.length,
    pairsRewritten,
  };
}

/**
 * Write the lock with entries sorted by id, 2-space JSON, trailing newline.
 *
 * @param path - Lock file path.
 * @param lock - Lock to persist.
 */
export function writeLock(path: string, lock: Lock): void {
  const items = [...lock.items].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(path, `${JSON.stringify({ ...lock, items }, null, 2)}\n`);
}

/**
 * Insert or replace entries by id.
 *
 * @param lock - Current lock.
 * @param entries - Entries to upsert.
 * @returns A new lock; the input is not mutated.
 */
export function upsertEntries(lock: Lock, entries: LockEntry[]): Lock {
  const byId = new Map(lock.items.map((e) => [e.id, e]));
  for (const e of entries) byId.set(e.id, e);
  return { ...lock, items: [...byId.values()] };
}
