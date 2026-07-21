import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@services/session.service', () => ({ listActiveSessions: vi.fn() }));

import { listActiveSessions } from '@services/session.service';
import { GET } from '@routes/sessions/active';

describe('GET /api/sessions/active', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the active sessions for the caller', async () => {
    vi.mocked(listActiveSessions).mockResolvedValue([{ sessionId: 's1' } as never]);
    const response = await GET({
      locals: { requestId: 'req-1', auth: { authUserId: 'auth-1', playerId: 'player-1' } },
    } as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
  });
});
