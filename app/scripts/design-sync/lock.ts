/**
 * Lock model for the Claude Design sync: per-item hashes at the last sync,
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
  projectId: string;
  projectUpdatedAt: string | null;
  pairs: ComponentPair[];
  items: LockEntry[];
}

export type Proposal = "design-to-code" | "code-to-design" | "owner";

export interface Classified extends SyncItem {
  status: "in-sync" | "accepted" | "mismatch";
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
  const designHash = item.design?.hash ?? null;
  const codeHash = item.code?.hash ?? null;
  const unchanged =
    entry !== undefined &&
    entry.designHash === designHash &&
    entry.codeHash === codeHash;
  const sameNow =
    item.comparable && designHash !== null && designHash === codeHash;

  if (
    sameNow ||
    (!item.comparable && unchanged && entry.decision !== "accepted-divergence")
  ) {
    return { ...item, status: "in-sync", proposal: null };
  }
  if (unchanged && entry.decision === "accepted-divergence") {
    return { ...item, status: "accepted", proposal: null };
  }
  if (!entry) return { ...item, status: "mismatch", proposal: "owner" };

  const designChanged = entry.designHash !== designHash;
  const codeChanged = entry.codeHash !== codeHash;
  let proposal: Proposal = "owner";
  if (designChanged && !codeChanged) proposal = "design-to-code";
  if (codeChanged && !designChanged) proposal = "code-to-design";
  return { ...item, status: "mismatch", proposal };
}

/**
 * Read the lock file.
 *
 * @param path - Lock file path.
 * @returns The parsed lock.
 */
export function readLock(path: string): Lock {
  return JSON.parse(readFileSync(path, "utf8")) as Lock;
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
