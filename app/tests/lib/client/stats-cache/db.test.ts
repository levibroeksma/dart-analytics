import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  openStatsDb,
  STATS_DB_NAME,
  STATS_SCHEMA_VERSION,
} from "@client/stats-cache/db";

function deleteStatsDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STATS_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

describe("openStatsDb", () => {
  beforeEach(() => deleteStatsDb());

  it("creates all four stores", async () => {
    const db = await openStatsDb();
    expect(db).not.toBeNull();
    expect(Array.from(db!.objectStoreNames).sort()).toEqual([
      "coverage",
      "meta",
      "sectionResults",
      "sessionLists",
    ]);
    db!.close();
  });

  it("returns null when indexedDB is unavailable", async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error simulating an environment without IndexedDB
    delete globalThis.indexedDB;
    const db = await openStatsDb();
    expect(db).toBeNull();
    globalThis.indexedDB = original;
  });

  it("wipes existing data on a schema version bump", async () => {
    const first = await openStatsDb();
    await new Promise<void>((resolve, reject) => {
      const tx = first!.transaction("meta", "readwrite");
      tx.objectStore("meta").put("value", "key");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    first!.close();

    const bumped = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(STATS_DB_NAME, STATS_SCHEMA_VERSION + 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of Array.from(db.objectStoreNames)) {
          db.deleteObjectStore(name);
        }
        db.createObjectStore("meta");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const value = await new Promise((resolve, reject) => {
      const tx = bumped.transaction("meta", "readonly");
      const req = tx.objectStore("meta").get("key");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(value).toBeUndefined();
    bumped.close();
  });
});
