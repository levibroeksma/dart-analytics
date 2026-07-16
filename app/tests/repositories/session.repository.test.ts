import { describe, it, expect, vi } from 'vitest';

function fakeSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    then: (resolve: (v: unknown[]) => void) => resolve(rows), // supports `await db.select(...).from(...)` without .limit()
  };
  return chain;
}

describe('findGameTypeAndRuleset', () => {
  it('returns the joined row when found', async () => {
    const row = { gameTypeId: 'gt-1', rulesetVersionId: 'rv-1' };
    const db = { select: vi.fn(() => fakeSelect([row])) } as any;
    const { findGameTypeAndRuleset } = await import('@repositories/session.repository');
    const result = await findGameTypeAndRuleset(db, 'SCORE_TRAINING', 'SCORE_TRAINING_V1');
    expect(result).toEqual(row);
  });

  it('returns undefined when no row matches', async () => {
    const db = { select: vi.fn(() => fakeSelect([])) } as any;
    const { findGameTypeAndRuleset } = await import('@repositories/session.repository');
    const result = await findGameTypeAndRuleset(db, 'UNKNOWN', 'UNKNOWN_V1');
    expect(result).toBeUndefined();
  });
});

describe('findStageTypeIdMap', () => {
  it('builds a key-to-id map', async () => {
    const db = { select: vi.fn(() => fakeSelect([{ id: 5, key: 'EXERCISE_BLOCK' }])) } as any;
    const { findStageTypeIdMap } = await import('@repositories/session.repository');
    const map = await findStageTypeIdMap(db);
    expect(map.get('EXERCISE_BLOCK')).toBe(5);
  });
});
