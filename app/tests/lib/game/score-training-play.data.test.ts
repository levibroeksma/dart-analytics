import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@client/api/sessions', () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
}));

import { appendBatch, completeSession, fetchActiveSessions } from '@client/api/sessions';
import { scoreTrainingPlay } from '@lib/game/score-training-play.data';
import type { RecordedTurn } from '@stores/game.store';

type GameStub = {
  sessionId: string | null;
  participantRef: string | null;
  configSnapshot: { durationType: 'ROUNDS'; durationValue: number; maxDartsPerTurn: number } | null;
  turns: RecordedTurn[];
  recordTurn: (turn: RecordedTurn) => void;
  reset: () => void;
};

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    sessionId: 's1',
    participantRef: 'p1',
    configSnapshot: { durationType: 'ROUNDS' as const, durationValue: 2, maxDartsPerTurn: 3 },
    turns: [] as RecordedTurn[],
    recordTurn: vi.fn(function (this: { turns: RecordedTurn[] }, turn: RecordedTurn) {
      this.turns.push(turn);
    }),
    reset: vi.fn(),
    ...overrides,
  };
}

describe('scoreTrainingPlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { sessionId: 's1', gameTypeKey: 'SCORE_TRAINING', gameTypeName: 'Score Training', captureModeKey: 'RECREATIONAL', inputModeKey: 'QUICK_SCORE', rulesetVersionKey: 'SCORE_TRAINING_V1', startedAt: 'now' },
    ]);
  });

  it('records a visit and does not complete before durationValue visits', async () => {
    const store = gameStub();
    const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '45' };
    await component.init.call(component);
    await component.submitVisit.call(component);
    expect(store.recordTurn).toHaveBeenCalledTimes(1);
    expect(appendBatch).not.toHaveBeenCalled();
  });

  it('uploads the batch and completes the session on the final visit', async () => {
    const store = gameStub();
    vi.mocked(appendBatch).mockResolvedValue({ created: { stages: 1, turns: 2, darts: 0 } });
    vi.mocked(completeSession).mockResolvedValue({ sessionId: 's1', statusKey: 'COMPLETED', completedAt: 'now' });
    const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '30' };
    await component.init.call(component);
    await component.submitVisit.call(component); // visit 1
    component.visitInput = '30';
    await component.submitVisit.call(component); // visit 2 — completes
    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith('s1', 'COMPLETED');
    expect(store.reset).toHaveBeenCalledTimes(1);
  });

  it('D88: clears local state when the server has no matching active session', async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([]);
    const store = gameStub();
    const component = { ...scoreTrainingPlay(), $store: { game: store } };
    await component.init.call(component);
    expect(store.reset).toHaveBeenCalledTimes(1);
  });

  it('D88: abandons an orphaned server session with no local state', async () => {
    const store = gameStub({ sessionId: null, configSnapshot: null });
    vi.mocked(completeSession).mockResolvedValue({ sessionId: 's1', statusKey: 'ABANDONED', completedAt: 'now' });
    const component = { ...scoreTrainingPlay(), $store: { game: store } };
    await component.init.call(component);
    expect(completeSession).toHaveBeenCalledWith('s1', 'ABANDONED');
  });
});
