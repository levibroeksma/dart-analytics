import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@services/session.service', () => ({ appendBatch: vi.fn() }));

import { appendBatch } from '@services/session.service';
import { POST } from '@routes/sessions/[sessionId]/events/batch';

function makeContext(body: unknown, headers: Record<string, string> = { 'idempotency-key': 'idem-1' }) {
  return {
    locals: { requestId: 'req-1', auth: { authUserId: 'auth-1', playerId: 'player-1' } },
    params: { sessionId: 'session-1' },
    request: new Request('http://localhost/api/sessions/session-1/events/batch', {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    }),
  } as never;
}

const validBatch = {
  stages: [
    {
      clientKey: 's1',
      stageTypeKey: 'EXERCISE_BLOCK',
      parentClientKey: null,
      sequence: 1,
      turns: [
        { clientKey: 't1', participantRef: 'p1', sequence: 1, totalScore: 45, completedAt: null, darts: [] },
      ],
    },
  ],
};

describe('POST /api/sessions/:sessionId/events/batch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the created counts on success', async () => {
    vi.mocked(appendBatch).mockResolvedValue({ ok: true, data: { created: { stages: 1, turns: 1, darts: 0 } } });
    const response = await POST(makeContext(validBatch));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.created.turns).toBe(1);
  });

  it('returns 422 when the Idempotency-Key header is missing', async () => {
    const response = await POST(makeContext(validBatch, {}));
    expect(response.status).toBe(422);
    expect(appendBatch).not.toHaveBeenCalled();
  });

  it('maps SESSION_ALREADY_COMPLETED to 409', async () => {
    vi.mocked(appendBatch).mockResolvedValue({ ok: false, code: 'SESSION_ALREADY_COMPLETED' });
    const response = await POST(makeContext(validBatch));
    expect(response.status).toBe(409);
  });
});
