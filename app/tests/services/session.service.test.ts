import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@db/client', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('@lib/id', () => ({ generateId: vi.fn(() => 'generated-id') }));
vi.mock('@repositories/session.repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repositories/session.repository')>();
  return {
    ...actual,
    findGameTypeAndRuleset: vi.fn(),
    findCaptureModeId: vi.fn(),
    findInputModeId: vi.fn(),
    findGameStatusId: vi.fn(),
    findParticipantTypeId: vi.fn(),
    findPlayerDisplayName: vi.fn(),
    findConfigurationTemplate: vi.fn(),
    insertSessionRecords: vi.fn(),
    findSessionRow: vi.fn(),
    findSessionConfiguration: vi.fn(),
    findSessionParticipantIds: vi.fn(),
    countTurnsForSession: vi.fn(),
    findIdempotencyRecord: vi.fn(),
    findStageTypeIdMap: vi.fn(),
    findDartZoneIdMap: vi.fn(),
    insertBatchRecords: vi.fn(),
    findActiveSessions: vi.fn(),
    findConfigurationPresets: vi.fn(),
    updateSessionStatusRecord: vi.fn(),
  };
});

import * as repo from '@repositories/session.repository';
import { appendBatch, canonicalize, hashBatchPayload, createSession, updateSessionStatus, listActiveSessions, listConfigurationPresets } from '@services/session.service';

const inlineRequest = {
  gameTypeKey: 'SCORE_TRAINING',
  rulesetVersionKey: 'SCORE_TRAINING_V1',
  captureModeKey: 'RECREATIONAL',
  inputModeKey: 'QUICK_SCORE',
  config: { source: 'inline' as const, config: { duration_type: 'ROUNDS', duration_value: 10, max_darts_per_turn: 3 } },
};

describe('createSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.findGameTypeAndRuleset).mockResolvedValue({ gameTypeId: 'gt1', rulesetVersionId: 'rv1' });
    vi.mocked(repo.findCaptureModeId).mockResolvedValue(1);
    vi.mocked(repo.findInputModeId).mockResolvedValue(1);
    vi.mocked(repo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(repo.findParticipantTypeId).mockResolvedValue(1);
    vi.mocked(repo.findPlayerDisplayName).mockResolvedValue('Levi');
    vi.mocked(repo.insertSessionRecords).mockResolvedValue({ sessionId: 'generated-id', participantId: 'generated-id' });
  });

  it('creates a session from inline config', async () => {
    const result = await createSession('player-1', inlineRequest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sessionId).toBe('generated-id');
      expect(result.data.participants).toEqual([
        { ref: 'generated-id', participantTypeKey: 'PLAYER', displayName: 'Levi' },
      ]);
    }
  });

  it('rejects an unknown gameTypeKey/rulesetVersionKey combination', async () => {
    vi.mocked(repo.findGameTypeAndRuleset).mockResolvedValue(undefined);
    const result = await createSession('player-1', inlineRequest);
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
  });

  it('rejects an invalid inline config via the ruleset validator', async () => {
    const result = await createSession('player-1', {
      ...inlineRequest,
      config: { source: 'inline', config: { duration_type: 'ROUNDS', duration_value: 999, max_darts_per_turn: 3 } },
    });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
  });

  it('resolves a template config, merging overrides', async () => {
    vi.mocked(repo.findConfigurationTemplate).mockResolvedValue({
      id: 'tmpl-1',
      configuration: { duration_type: 'ROUNDS', duration_value: 10, max_darts_per_turn: 3 },
    });
    const result = await createSession('player-1', {
      ...inlineRequest,
      config: { source: 'template', templateRef: 'tmpl-1', overrides: { duration_value: 20 } },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown templateRef', async () => {
    vi.mocked(repo.findConfigurationTemplate).mockResolvedValue(undefined);
    const result = await createSession('player-1', {
      ...inlineRequest,
      config: { source: 'template', templateRef: 'missing' },
    });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
  });
});

function sampleBatch(overrides: Partial<{ participantRef: string; darts: unknown[] }> = {}) {
  return {
    stages: [
      {
        clientKey: 's1',
        stageTypeKey: 'EXERCISE_BLOCK',
        parentClientKey: null,
        sequence: 1,
        turns: [
          {
            clientKey: 't1',
            participantRef: overrides.participantRef ?? 'participant-1',
            sequence: 1,
            totalScore: 45,
            completedAt: null,
            darts: overrides.darts ?? [],
          },
        ],
      },
    ],
  };
}

describe('canonicalize / hashBatchPayload', () => {
  it('produces the same hash regardless of key order', async () => {
    const a = await hashBatchPayload({ stages: [{ b: 1, a: 2 }] } as never);
    const b = await hashBatchPayload({ stages: [{ a: 2, b: 1 }] } as never);
    expect(a).toBe(b);
  });

  it('produces different hashes for different payloads', async () => {
    const a = await hashBatchPayload(sampleBatch());
    const b = await hashBatchPayload(sampleBatch({ participantRef: 'participant-2' }));
    expect(a).not.toBe(b);
  });
});

describe('appendBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.findSessionRow).mockResolvedValue({
      id: 'session-1',
      playerId: 'player-1',
      statusId: 1,
      rulesetVersionKey: 'SCORE_TRAINING_V1',
    });
    vi.mocked(repo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(repo.findIdempotencyRecord).mockResolvedValue(undefined);
    vi.mocked(repo.findSessionParticipantIds).mockResolvedValue(['participant-1']);
    vi.mocked(repo.findSessionConfiguration).mockResolvedValue({
      duration_type: 'ROUNDS',
      duration_value: 10,
      max_darts_per_turn: 3,
    });
    vi.mocked(repo.countTurnsForSession).mockResolvedValue(0);
    vi.mocked(repo.findStageTypeIdMap).mockResolvedValue(new Map([['EXERCISE_BLOCK', 5]]));
    vi.mocked(repo.findDartZoneIdMap).mockResolvedValue(new Map());
    vi.mocked(repo.insertBatchRecords).mockResolvedValue({ stages: 1, turns: 1, darts: 0 });
  });

  it('inserts a valid batch', async () => {
    const result = await appendBatch('player-1', 'session-1', 'idem-1', sampleBatch());
    expect(result).toEqual({ ok: true, data: { created: { stages: 1, turns: 1, darts: 0 } } });
  });

  it('returns NOT_FOUND for an unknown session', async () => {
    vi.mocked(repo.findSessionRow).mockResolvedValue(undefined);
    const result = await appendBatch('player-1', 'missing', 'idem-1', sampleBatch());
    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('returns SESSION_OWNERSHIP_MISMATCH for a different player', async () => {
    const result = await appendBatch('someone-else', 'session-1', 'idem-1', sampleBatch());
    expect(result).toMatchObject({ ok: false, code: 'SESSION_OWNERSHIP_MISMATCH' });
  });

  it('returns SESSION_ALREADY_COMPLETED for a non-active session', async () => {
    vi.mocked(repo.findSessionRow).mockResolvedValue({
      id: 'session-1',
      playerId: 'player-1',
      statusId: 2,
      rulesetVersionKey: 'SCORE_TRAINING_V1',
    });
    const result = await appendBatch('player-1', 'session-1', 'idem-1', sampleBatch());
    expect(result).toMatchObject({ ok: false, code: 'SESSION_ALREADY_COMPLETED' });
  });

  it('returns BATCH_REFERENCE_MISSING for an unknown participantRef', async () => {
    const result = await appendBatch('player-1', 'session-1', 'idem-1', sampleBatch({ participantRef: 'ghost' }));
    expect(result).toMatchObject({ ok: false, code: 'BATCH_REFERENCE_MISSING' });
  });

  it('returns BATCH_INCONSISTENT_ORDERING for a duplicate turn sequence', async () => {
    const batch = sampleBatch();
    batch.stages[0].turns.push({ ...batch.stages[0].turns[0], clientKey: 't2' });
    const result = await appendBatch('player-1', 'session-1', 'idem-1', batch);
    expect(result).toMatchObject({ ok: false, code: 'BATCH_INCONSISTENT_ORDERING' });
  });

  it('returns VALIDATION_FAILED for an unknown stageTypeKey', async () => {
    const batch = sampleBatch();
    batch.stages[0].stageTypeKey = 'NOT_A_STAGE_TYPE';
    const result = await appendBatch('player-1', 'session-1', 'idem-1', batch);
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
  });

  it('rejects a batch the ruleset validator rejects (dart rows present)', async () => {
    const result = await appendBatch(
      'player-1',
      'session-1',
      'idem-1',
      sampleBatch({ darts: [{ sequence: 1, intendedTargetNumber: null, intendedZoneKey: null, hitTargetNumber: 20, hitZoneKey: 'SINGLE', score: 20 }] }),
    );
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
  });

  it('returns the stored result on idempotent retry with the same payload', async () => {
    const batch = sampleBatch();
    const hash = await hashBatchPayload(batch);
    vi.mocked(repo.findIdempotencyRecord).mockResolvedValue({
      normalizedPayloadHash: hash,
      result: { created: { stages: 1, turns: 1, darts: 0 } },
    });
    const result = await appendBatch('player-1', 'session-1', 'idem-1', batch);
    expect(result).toEqual({ ok: true, data: { created: { stages: 1, turns: 1, darts: 0 } } });
    expect(repo.insertBatchRecords).not.toHaveBeenCalled();
  });

  it('rejects idempotency key reuse with a different payload', async () => {
    vi.mocked(repo.findIdempotencyRecord).mockResolvedValue({ normalizedPayloadHash: 'different-hash', result: {} });
    const result = await appendBatch('player-1', 'session-1', 'idem-1', sampleBatch());
    expect(result).toMatchObject({ ok: false, code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' });
  });
});

describe('updateSessionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.findSessionRow).mockResolvedValue({
      id: 'session-1',
      playerId: 'player-1',
      statusId: 1,
      rulesetVersionKey: 'SCORE_TRAINING_V1',
    });
    vi.mocked(repo.findGameStatusId).mockImplementation(async (_db, key) => ({ ACTIVE: 1, COMPLETED: 2, ABANDONED: 3 }[key]));
    vi.mocked(repo.updateSessionStatusRecord).mockResolvedValue(undefined);
  });

  it('completes an active session', async () => {
    const result = await updateSessionStatus('player-1', 'session-1', { status: 'COMPLETED' });
    expect(result.ok).toBe(true);
    expect(repo.updateSessionStatusRecord).toHaveBeenCalledWith(expect.anything(), 'session-1', 2, expect.any(String));
  });

  it('returns NOT_FOUND for an unknown session', async () => {
    vi.mocked(repo.findSessionRow).mockResolvedValue(undefined);
    const result = await updateSessionStatus('player-1', 'missing', { status: 'COMPLETED' });
    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('returns SESSION_OWNERSHIP_MISMATCH for a different player', async () => {
    const result = await updateSessionStatus('someone-else', 'session-1', { status: 'COMPLETED' });
    expect(result).toMatchObject({ ok: false, code: 'SESSION_OWNERSHIP_MISMATCH' });
  });

  it('returns INVALID_STATUS_TRANSITION for an unsupported target', async () => {
    const result = await updateSessionStatus('player-1', 'session-1', { status: 'ACTIVE' });
    expect(result).toMatchObject({ ok: false, code: 'INVALID_STATUS_TRANSITION' });
  });

  it('returns SESSION_ALREADY_COMPLETED for a non-active session', async () => {
    vi.mocked(repo.findSessionRow).mockResolvedValue({
      id: 'session-1',
      playerId: 'player-1',
      statusId: 2,
      rulesetVersionKey: 'SCORE_TRAINING_V1',
    });
    const result = await updateSessionStatus('player-1', 'session-1', { status: 'COMPLETED' });
    expect(result).toMatchObject({ ok: false, code: 'SESSION_ALREADY_COMPLETED' });
  });
});

describe('listActiveSessions / listConfigurationPresets', () => {
  it('returns rows from the repository as-is', async () => {
    vi.mocked(repo.findActiveSessions).mockResolvedValue([{ sessionId: 's1', playerId: 'p1' } as never]);
    const rows = await listActiveSessions('p1');
    expect(rows).toHaveLength(1);
  });

  it('returns preset rows from the repository as-is', async () => {
    vi.mocked(repo.findConfigurationPresets).mockResolvedValue([{ configurationTemplateId: 'c1' } as never]);
    const rows = await listConfigurationPresets('p1', 'SCORE_TRAINING');
    expect(rows).toHaveLength(1);
  });
});
