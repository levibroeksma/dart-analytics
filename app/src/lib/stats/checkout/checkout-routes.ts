import type { CheckoutPathMetrics } from "@modules/types";

/** The exact `startingRemaining` values a `checkout-path` series holds data for, highest first. */
export function pathRemainings(metrics: CheckoutPathMetrics): number[] {
  return Object.keys(metrics)
    .map(Number)
    .sort((a, b) => b - a);
}

/** The routes thrown at `remaining`, most-used first, each with its own finish rate. */
export function routesFor(
  metrics: CheckoutPathMetrics,
  remaining: number,
): { route: string; visits: number; finished: number; finishRate: number }[] {
  const routes = metrics[String(remaining)] ?? {};
  return Object.entries(routes)
    .map(([route, m]) => ({
      route,
      visits: m.visits,
      finished: m.finished,
      finishRate: m.visits === 0 ? 0 : m.finished / m.visits,
    }))
    .sort((a, b) => b.visits - a.visits);
}
