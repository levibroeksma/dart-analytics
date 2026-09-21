import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@lib/client/alpine/register-stores", () => ({
  registerStores: vi.fn(),
}));
vi.mock("@lib/client/alpine/register-route-data", () => ({
  registerRouteData: vi.fn(),
}));
vi.mock("@lib/client/alpine/register-ui-data", () => ({
  registerUiData: vi.fn(),
}));

import type { Alpine } from "alpinejs";
import persist from "@alpinejs/persist";
import collapse from "@alpinejs/collapse";
import sort from "@alpinejs/sort";
import startAlpine from "@lib/client/alpine/app.factory";
import { registerStores } from "@lib/client/alpine/register-stores";
import { registerRouteData } from "@lib/client/alpine/register-route-data";
import { registerUiData } from "@lib/client/alpine/register-ui-data";

function fakeAlpine() {
  const plugin = vi.fn();
  return { alpine: { plugin } as unknown as Alpine, plugin };
}

beforeEach(() => vi.clearAllMocks());

describe("app.factory", () => {
  it("registers the persist, collapse and sort plugins", () => {
    const { alpine, plugin } = fakeAlpine();
    startAlpine(alpine);
    expect(plugin).toHaveBeenCalledWith(persist);
    expect(plugin).toHaveBeenCalledWith(collapse);
    expect(plugin).toHaveBeenCalledWith(sort);
  });

  it("registers stores, route data and ui data against the same Alpine instance", () => {
    const { alpine } = fakeAlpine();
    startAlpine(alpine);
    expect(registerStores).toHaveBeenCalledWith(alpine);
    expect(registerRouteData).toHaveBeenCalledWith(alpine);
    expect(registerUiData).toHaveBeenCalledWith(alpine);
  });

  it("registers every plugin before any data factory", () => {
    const order: string[] = [];
    const plugin = vi.fn(() => void order.push("plugin"));
    vi.mocked(registerStores).mockImplementation(() => void order.push("data"));
    startAlpine({ plugin } as unknown as Alpine);
    expect(order).toEqual(["plugin", "plugin", "plugin", "data"]);
  });
});
