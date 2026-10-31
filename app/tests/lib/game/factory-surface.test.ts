import { describe, it, expect, vi } from "vitest";

vi.mock("@client/api/sessions", () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
  createSession: vi.fn(),
}));

import { FACTORIES } from "./support/factories";

/** Sorted `key:typeof` over own enumerable keys — the public surface a page binds to. */
function surfaceOf(factory: object): string[] {
  return Object.keys(factory)
    .map((key) => `${key}:${typeof (factory as Record<string, unknown>)[key]}`)
    .sort();
}

describe("factory surface", () => {
  for (const [name, factory] of Object.entries(FACTORIES)) {
    it(name, () => {
      expect(surfaceOf(factory())).toMatchSnapshot();
    });
  }

  it("has no getters", () => {
    for (const factory of Object.values(FACTORIES)) {
      const obj = factory();
      for (const key of Object.keys(obj)) {
        expect(Object.getOwnPropertyDescriptor(obj, key)?.get).toBeUndefined();
      }
    }
  });
});
