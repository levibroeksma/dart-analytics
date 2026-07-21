import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnd = vi.fn();
const mockTransaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn({}));

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(),
  neonConfig: {},
  Pool: vi.fn().mockImplementation(function () {
    return { end: mockEnd };
  }),
}));
vi.mock("drizzle-orm/neon-http", () => ({ drizzle: vi.fn() }));
vi.mock("drizzle-orm/neon-serverless", () => ({
  drizzle: vi.fn(() => ({ transaction: mockTransaction })),
}));
vi.mock("@lib/env", () => ({
  env: { postgres: { databaseUrlUnpooled: "postgres://test" } },
}));

import { withTransaction } from "@db/client";

describe("withTransaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs the callback inside a transaction and closes the pool on success", async () => {
    const result = await withTransaction(async () => "done");
    expect(result).toBe("done");
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });

  it("closes the pool even when the callback throws", async () => {
    mockTransaction.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    await expect(withTransaction(async () => "unused")).rejects.toThrow("boom");
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });
});
