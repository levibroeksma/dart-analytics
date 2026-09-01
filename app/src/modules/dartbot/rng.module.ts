import type { DartRng } from "./interfaces";

function hashSeed(seed: number, dartIndex: number): number {
  let state = (seed ^ 0x9e3779b9) >>> 0;
  state = Math.imul(state ^ dartIndex, 0x85ebca6b) >>> 0;
  state ^= state >>> 13;
  state = Math.imul(state, 0xc2b2ae35) >>> 0;
  state ^= state >>> 16;
  return state >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDartRng(seed: number, dartIndex: number): DartRng {
  const next = mulberry32(hashSeed(seed, dartIndex));
  return {
    uniform: () => next(),
    gaussianPair: () => {
      const u1 = Math.max(next(), Number.EPSILON);
      const u2 = next();
      const radius = Math.sqrt(-2 * Math.log(u1));
      const angle = 2 * Math.PI * u2;
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    },
  };
}
