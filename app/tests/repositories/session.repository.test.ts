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

describe('findSessionRow', () => {
  it('joins ruleset_versions to expose rulesetVersionKey', async () => {
    const row = { id: 's1', playerId: 'p1', statusId: 1, rulesetVersionKey: 'SCORE_TRAINING_V1' };
    const db = { select: vi.fn(() => fakeSelect([row])) } as any;
    const { findSessionRow } = await import('@repositories/session.repository');
    const result = await findSessionRow(db, 's1');
    expect(result).toEqual(row);
  });
});

describe('countTurnsForSession', () => {
  it('returns the joined count', async () => {
    const db = { select: vi.fn(() => fakeSelect([{ count: 3 }])) } as any;
    const { countTurnsForSession } = await import('@repositories/session.repository');
    const result = await countTurnsForSession(db, 's1');
    expect(result).toBe(3);
  });

  it('returns 0 when no rows exist', async () => {
    const db = { select: vi.fn(() => fakeSelect([])) } as any;
    const { countTurnsForSession } = await import('@repositories/session.repository');
    const result = await countTurnsForSession(db, 's1');
    expect(result).toBe(0);
  });
});

describe('findIdempotencyRecord', () => {
  it('returns the stored record when present', async () => {
    const record = { normalizedPayloadHash: 'abc', result: { created: { stages: 1, turns: 1, darts: 0 } } };
    const db = { select: vi.fn(() => fakeSelect([record])) } as any;
    const { findIdempotencyRecord } = await import('@repositories/session.repository');
    const result = await findIdempotencyRecord(db, 's1', 'key-1');
    expect(result).toEqual(record);
  });
});
