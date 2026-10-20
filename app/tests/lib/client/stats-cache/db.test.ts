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

  it("bumps the schema version so caches keyed to erased types are discarded", () => {
    expect(STATS_SCHEMA_VERSION).toBe(5);
  });

  it("wipes every store on upgrade rather than merging", async () => {
    const stores = [
      "sectionResults",
      "coverage",
      "sessionLists",
      "meta",
      "replayPages",
    ] as const;
    const stale = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(STATS_DB_NAME, STATS_SCHEMA_VERSION - 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of Array.from(db.objectStoreNames)) {
          db.deleteObjectStore(name);
        }
        db.createObjectStore("erasedTypeStore");
        for (const store of stores) db.createObjectStore(store);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = stale.transaction(["erasedTypeStore", ...stores], "readwrite");
      tx.objectStore("erasedTypeStore").put("stale", "key");
      for (const store of stores) tx.objectStore(store).put("stale", "key");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    stale.close();

    const db = await openStatsDb();

    expect(Array.from(db!.objectStoreNames).sort()).toEqual([
      "coverage",
      "meta",
      "replayPages",
      "sectionResults",
      "sessionLists",
    ]);
    const values = await new Promise<unknown[]>((resolve, reject) => {
      const tx = db!.transaction(stores, "readonly");
      const requests = stores.map((store) => tx.objectStore(store).get("key"));
      tx.oncomplete = () => resolve(requests.map((request) => request.result));
      tx.onerror = () => reject(tx.error);
    });
    expect(values).toEqual(stores.map(() => undefined));
    db!.close();
  });

  it("creates all five stores", async () => {
    const db = await openStatsDb();
    expect(db).not.toBeNull();
    expect(Array.from(db!.objectStoreNames).sort()).toEqual([
      "coverage",
      "meta",
      "replayPages",
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

  it("wipes a database left at the previous schema version and adds replayPages", async () => {
    const previous = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(STATS_DB_NAME, STATS_SCHEMA_VERSION - 1);
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
    await new Promise<void>((resolve, reject) => {
      const tx = previous.transaction("meta", "readwrite");
      tx.objectStore("meta").put("value", "key");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    previous.close();

    const db = await openStatsDb();

    expect(Array.from(db!.objectStoreNames).sort()).toEqual([
      "coverage",
      "meta",
      "replayPages",
      "sectionResults",
      "sessionLists",
    ]);
    const value = await new Promise((resolve, reject) => {
      const tx = db!.transaction("meta", "readonly");
      const req = tx.objectStore("meta").get("key");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(value).toBeUndefined();
    db!.close();
  });

  it("wipes coverage, replayPages and sectionResults records from a v3 database, landing at the current schema version", async () => {
    const v3 = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(STATS_DB_NAME, 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of Array.from(db.objectStoreNames)) {
          db.deleteObjectStore(name);
        }
        db.createObjectStore("sectionResults");
        db.createObjectStore("coverage");
        db.createObjectStore("replayPages");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = v3.transaction(
        ["sectionResults", "coverage", "replayPages"],
        "readwrite",
      );
      tx.objectStore("sectionResults").put("value", "key");
      tx.objectStore("coverage").put("value", "key");
      tx.objectStore("replayPages").put("value", "key");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    v3.close();

    const db = await openStatsDb();

    expect(db!.version).toBe(STATS_SCHEMA_VERSION);
    const [sectionResultsValue, coverageValue, replayPagesValue] =
      await new Promise<[unknown, unknown, unknown]>((resolve, reject) => {
        const tx = db!.transaction(
          ["sectionResults", "coverage", "replayPages"],
          "readonly",
        );
        const sectionResultsReq = tx.objectStore("sectionResults").get("key");
        const coverageReq = tx.objectStore("coverage").get("key");
        const replayPagesReq = tx.objectStore("replayPages").get("key");
        tx.oncomplete = () =>
          resolve([
            sectionResultsReq.result,
            coverageReq.result,
            replayPagesReq.result,
          ]);
        tx.onerror = () => reject(tx.error);
      });
    expect(sectionResultsValue).toBeUndefined();
    expect(coverageValue).toBeUndefined();
    expect(replayPagesValue).toBeUndefined();
    db!.close();
  });
});
