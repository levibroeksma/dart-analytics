import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcileActiveSession } from '@lib/game/session-recovery';
import * as api from '@client/api/sessions';

vi.mock('@client/api/sessions');

describe('reconcileActiveSession', () => {
  let store: any;

  beforeEach(() => {
    store = { reset: vi.fn() };
  });

  it('returns "match" and does not touch the store when local sessionId matches server ACTIVE', async () => {
    const server = [{ sessionId: 'match-id', gameTypeKey: 'SCORE_TRAINING' }];

    const result = await reconcileActiveSession('match-id', server as any, store);

    expect(result).toEqual({ action: 'match', activeSession: server[0] });
    expect(store.reset).not.toHaveBeenCalled();
  });

  it('auto-abandons the orphan and returns "no_active" on mismatch', async () => {
    const server = [{ sessionId: 'server-id', gameTypeKey: 'SCORE_TRAINING' }];
    vi.mocked(api.completeSession).mockResolvedValue({
      sessionId: 'server-id',
      statusKey: 'ABANDONED',
      completedAt: '2026-07-17T10:00:00Z',
    });

    const result = await reconcileActiveSession('different-local-id', server as any, store);

    expect(api.completeSession).toHaveBeenCalledWith('server-id', 'ABANDONED');
    expect(store.reset).toHaveBeenCalled();
    expect(result).toEqual({ action: 'no_active', activeSession: null });
  });

  it('returns "abandon_failed" and does NOT reset the store when the auto-abandon PATCH fails', async () => {
    const server = [{ sessionId: 'server-id', gameTypeKey: 'SCORE_TRAINING' }];
    vi.mocked(api.completeSession).mockRejectedValue(new Error('Network error'));

    const result = await reconcileActiveSession('different-local-id', server as any, store);

    expect(store.reset).not.toHaveBeenCalled();
    expect(result).toEqual({ action: 'abandon_failed', activeSession: null });
  });

  it('resets and returns "no_active" when local is present but no server ACTIVE exists', async () => {
    const result = await reconcileActiveSession('stale-id', [], store);

    expect(store.reset).toHaveBeenCalled();
    expect(result).toEqual({ action: 'no_active', activeSession: null });
  });

  it('returns "no_active" with no store change when both are empty', async () => {
    const result = await reconcileActiveSession(null, [], store);

    expect(store.reset).not.toHaveBeenCalled();
    expect(result).toEqual({ action: 'no_active', activeSession: null });
  });
});
