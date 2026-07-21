import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@client/api/client', () => ({ apiRequest: vi.fn() }));

import { apiRequest } from '@client/api/client';
import { createSession, appendBatch, completeSession, fetchActiveSessions, SessionApiError } from '@client/api/sessions';

describe('createSession', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns parsed data on success', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: 'r1',
      data: { sessionId: 's1', participants: [] },
    });
    const result = await createSession({
      gameTypeKey: 'SCORE_TRAINING',
      rulesetVersionKey: 'SCORE_TRAINING_V1',
      captureModeKey: 'RECREATIONAL',
      inputModeKey: 'QUICK_SCORE',
      config: { source: 'inline', config: {} },
    });
    expect(result.sessionId).toBe('s1');
  });

  it('throws SessionApiError on failure', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: 'r1',
      error: { code: 'VALIDATION_FAILED', message: 'bad request', retryable: false },
    });
    await expect(
      createSession({
        gameTypeKey: 'x',
        rulesetVersionKey: 'x',
        captureModeKey: 'x',
        inputModeKey: 'x',
        config: { source: 'inline', config: {} },
      }),
    ).rejects.toBeInstanceOf(SessionApiError);
  });
});

describe('appendBatch', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sends the Idempotency-Key header', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: 'r1',
      data: { created: { stages: 1, turns: 1, darts: 0 } },
    });
    await appendBatch('s1', 'idem-1', { stages: [] });
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/sessions/s1/events/batch',
      expect.objectContaining({ headers: { 'Idempotency-Key': 'idem-1' } }),
    );
  });
});

describe('completeSession', () => {
  beforeEach(() => vi.resetAllMocks());

  it('PATCHes the session status', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: 'r1',
      data: { sessionId: 's1', statusKey: 'COMPLETED', completedAt: '2026-07-16T00:00:00.000Z' },
    });
    const result = await completeSession('s1', 'COMPLETED');
    expect(result.statusKey).toBe('COMPLETED');
  });
});

describe('fetchActiveSessions', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns the active session list', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true, requestId: 'r1', data: [] });
    const result = await fetchActiveSessions();
    expect(result).toEqual([]);
  });
});
