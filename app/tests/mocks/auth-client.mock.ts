import { vi } from "vitest";

export function createAuthClientMock() {
  return {
    getSession: vi.fn(),
    signIn: { email: vi.fn() },
    signOut: vi.fn(),
  };
}
