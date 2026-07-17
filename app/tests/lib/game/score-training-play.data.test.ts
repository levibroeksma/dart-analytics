import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@client/api/sessions', () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
  createSession: vi.fn(),
}));

const segmentTimerInstances: Array<{
  options: Record<string, unknown>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('@modules/ui/segment-timer.module', () => ({
  SegmentTimer: vi.fn().mockImplementation(function (options: Record<string, unknown>) {
    const instance = { options, start: vi.fn(), stop: vi.fn() };
    segmentTimerInstances.push(instance);
    return instance;
  }),
}));

import { appendBatch, completeSession, createSession, fetchActiveSessions } from '@client/api/sessions';
import { SegmentTimer } from '@modules/ui/segment-timer.module';
import { scoreTrainingPlay } from '@lib/game/score-training-play.data';
import type { RecordedTurn } from '@stores/types';

type GameStub = {
  sessionId: string | null;
  participantRef: string | null;
  configSnapshot: { durationType: 'ROUNDS' | 'MINUTES'; durationValue: number; maxDartsPerTurn: number } | null;
  turns: RecordedTurn[];
  timerRemainingMs: number | null;
  timerExpired: boolean;
  idempotencyKey: string | null;
  recordTurn: (turn: RecordedTurn) => void;
  reset: () => void;
};

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    sessionId: 's1',
    participantRef: 'p1',
    configSnapshot: { durationType: 'ROUNDS' as const, durationValue: 2, maxDartsPerTurn: 3 },
    turns: [] as RecordedTurn[],
    timerRemainingMs: null,
    timerExpired: false,
    idempotencyKey: null,
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
    segmentTimerInstances.length = 0;
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
    expect(component.finished).toBe(true);
    expect(component.completionStatus).toBe('succeeded');
    expect(store.reset).not.toHaveBeenCalled();
  });

  describe('reconciliation on init', () => {
    it('resumes silently on "match" — no modal, hasActiveSession = true', async () => {
      const store = gameStub({
        sessionId: 'match-id',
        configSnapshot: { durationType: 'ROUNDS', durationValue: 20, maxDartsPerTurn: 3 },
      });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { sessionId: 'match-id', gameTypeKey: 'SCORE_TRAINING', gameTypeName: 'Score Training', captureModeKey: 'RECREATIONAL', inputModeKey: 'QUICK_SCORE', rulesetVersionKey: 'SCORE_TRAINING_V1', startedAt: 'now' },
      ]);
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);

      expect(component.hasActiveSession).toBe(true);
      expect(store.reset).not.toHaveBeenCalled();
      expect(component.reconciliationFailed).toBe(false);
    });

    it('shows no-active-session view on "no_active" (mismatch auto-abandoned)', async () => {
      const store = gameStub({ sessionId: 'different-id' });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { sessionId: 'server-id', gameTypeKey: 'SCORE_TRAINING', gameTypeName: 'Score Training', captureModeKey: 'RECREATIONAL', inputModeKey: 'QUICK_SCORE', rulesetVersionKey: 'SCORE_TRAINING_V1', startedAt: 'now' },
      ]);
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: 'server-id', statusKey: 'ABANDONED', completedAt: '2026-07-17T10:00:00Z',
      });
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);

      expect(completeSession).toHaveBeenCalledWith('server-id', 'ABANDONED');
      expect(store.reset).toHaveBeenCalled();
      expect(component.hasActiveSession).toBe(false);
    });

    it('blocks with reconciliationFailed on "abandon_failed" — does not flip to no-active-session as if cleaned', async () => {
      const store = gameStub({ sessionId: 'different-id' });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { sessionId: 'server-id', gameTypeKey: 'SCORE_TRAINING', gameTypeName: 'Score Training', captureModeKey: 'RECREATIONAL', inputModeKey: 'QUICK_SCORE', rulesetVersionKey: 'SCORE_TRAINING_V1', startedAt: 'now' },
      ]);
      vi.mocked(completeSession).mockRejectedValue(new Error('Network error'));
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);

      expect(component.reconciliationFailed).toBe(true);
      expect(store.reset).not.toHaveBeenCalled();
      expect(component.hasActiveSession).toBe(false);
    });

    it('preserves turns array on resume (no clear)', async () => {
      const store = gameStub({
        sessionId: 'match-id',
        configSnapshot: { durationType: 'ROUNDS', durationValue: 20, maxDartsPerTurn: 3 },
        turns: [{ clientKey: 't1', sequence: 1, totalScore: 50, completedAt: '2026-07-17T10:00:00Z' }],
      });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { sessionId: 'match-id', gameTypeKey: 'SCORE_TRAINING', gameTypeName: 'Score Training', captureModeKey: 'RECREATIONAL', inputModeKey: 'QUICK_SCORE', rulesetVersionKey: 'SCORE_TRAINING_V1', startedAt: 'now' },
      ]);
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);

      expect(component.hasActiveSession).toBe(true);
      expect(store.turns.length).toBe(1);
    });

    it('D88: clears local state when the server has no matching active session', async () => {
      vi.mocked(fetchActiveSessions).mockResolvedValue([]);
      const store = gameStub();
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);
      expect(store.reset).toHaveBeenCalledTimes(1);
      expect(component.hasActiveSession).toBe(false);
    });

    it('D88: mismatch against first SCORE_TRAINING session auto-abandons and resets', async () => {
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { sessionId: 'other-session', gameTypeKey: 'SCORE_TRAINING', gameTypeName: 'Score Training', captureModeKey: 'RECREATIONAL', inputModeKey: 'QUICK_SCORE', rulesetVersionKey: 'SCORE_TRAINING_V1', startedAt: 'now' },
      ]);
      vi.mocked(completeSession).mockResolvedValue({ sessionId: 'other-session', statusKey: 'ABANDONED', completedAt: 'now' });
      const store = gameStub({ sessionId: 's1' });
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);
      expect(completeSession).toHaveBeenCalledWith('other-session', 'ABANDONED');
      expect(store.reset).toHaveBeenCalledTimes(1);
      expect(component.hasActiveSession).toBe(false);
    });

    it('D88: abandons an orphaned server session with no local state', async () => {
      const store = gameStub({ sessionId: null, configSnapshot: null });
      vi.mocked(completeSession).mockResolvedValue({ sessionId: 's1', statusKey: 'ABANDONED', completedAt: 'now' });
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);
      expect(completeSession).toHaveBeenCalledWith('s1', 'ABANDONED');
      expect(component.hasActiveSession).toBe(false);
    });

    it('sets hasActiveSession to false and does not crash on submitVisit when no session matches', async () => {
      vi.mocked(fetchActiveSessions).mockResolvedValue([]);
      const store = gameStub({ sessionId: null, configSnapshot: null });
      const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '45' };
      await component.init.call(component);
      expect(component.hasActiveSession).toBe(false);

      await expect(component.submitVisit.call(component)).resolves.not.toThrow();
      expect(appendBatch).not.toHaveBeenCalled();
      expect(completeSession).not.toHaveBeenCalled();
    });
  });

  describe('MINUTES duration mode timer wiring', () => {
    it('instantiates and starts a SegmentTimer whose onComplete sets store.timerExpired', async () => {
      const store = gameStub({
        configSnapshot: { durationType: 'MINUTES', durationValue: 15, maxDartsPerTurn: 3 },
      });
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);

      expect(SegmentTimer).toHaveBeenCalledTimes(1);
      const instance = segmentTimerInstances[0];
      expect(instance.options.totalMinutes).toBe(15);
      expect(instance.options.intervalMinutes).toBe(15);
      expect(instance.start).toHaveBeenCalledTimes(1);

      expect(store.timerExpired).toBe(false);
      (instance.options.onComplete as () => void)();
      expect(store.timerExpired).toBe(true);
    });

    it('updates store.timerRemainingMs from onTick (seconds -> ms)', async () => {
      const store = gameStub({
        configSnapshot: { durationType: 'MINUTES', durationValue: 15, maxDartsPerTurn: 3 },
      });
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);

      const instance = segmentTimerInstances[0];
      (instance.options.onTick as (s: number) => void)(59);
      expect(store.timerRemainingMs).toBe(59000);
    });

    it('does not instantiate a SegmentTimer in ROUNDS mode', async () => {
      const store = gameStub();
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);
      expect(SegmentTimer).not.toHaveBeenCalled();
    });

    it('destroy() stops the timer', async () => {
      const store = gameStub({
        configSnapshot: { durationType: 'MINUTES', durationValue: 15, maxDartsPerTurn: 3 },
      });
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);
      const instance = segmentTimerInstances[0];
      component.destroy.call(component);
      expect(instance.stop).toHaveBeenCalledTimes(1);
    });

    it('destroy() does not throw when no timer was ever started (ROUNDS mode)', async () => {
      const store = gameStub();
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);
      expect(() => component.destroy.call(component)).not.toThrow();
    });

    it('sets store.timerRemainingMs to the full duration synchronously on a fresh session, before any onTick fires', async () => {
      const store = gameStub({
        configSnapshot: { durationType: 'MINUTES', durationValue: 15, maxDartsPerTurn: 3 },
      });
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);

      // No onTick invocation here — timerRemainingMs must already be correct.
      expect(store.timerRemainingMs).toBe(15 * 60 * 1000);
    });

    it('resumes from the persisted timerRemainingMs instead of the full configured duration when a prior session left one set', async () => {
      const store = gameStub({
        configSnapshot: { durationType: 'MINUTES', durationValue: 15, maxDartsPerTurn: 3 },
        timerRemainingMs: 5 * 60 * 1000, // 5 minutes left from a prior session
        timerExpired: false,
      });
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);

      expect(SegmentTimer).toHaveBeenCalledTimes(1);
      const instance = segmentTimerInstances[0];
      expect(instance.options.totalMinutes).toBe(5);
      expect(instance.options.intervalMinutes).toBe(5);
      expect(instance.start).toHaveBeenCalledTimes(1);
      // Still set synchronously, from the resumed value, not the full duration.
      expect(store.timerRemainingMs).toBe(5 * 60 * 1000);
    });

    it('does not restart a new timer when timerExpired is already true on init', async () => {
      const store = gameStub({
        configSnapshot: { durationType: 'MINUTES', durationValue: 15, maxDartsPerTurn: 3 },
        timerRemainingMs: 0,
        timerExpired: true,
      });
      const component = { ...scoreTrainingPlay(), $store: { game: store } };
      await component.init.call(component);

      expect(SegmentTimer).not.toHaveBeenCalled();
    });
  });

  describe('resume: startingSequence continuity', () => {
    it('passes the current persisted turn count as startingSequence so a resumed session does not collide sequences', async () => {
      const existingTurns: RecordedTurn[] = [
        { clientKey: 't1', sequence: 1, totalScore: 45, completedAt: 'x' },
      ];
      const store = gameStub({
        configSnapshot: { durationType: 'ROUNDS', durationValue: 3, maxDartsPerTurn: 3 },
        turns: existingTurns,
      });
      const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '30' };
      await component.init.call(component);
      await component.submitVisit.call(component);
      const lastTurn = store.turns[store.turns.length - 1];
      expect(lastTurn.sequence).toBe(2);
    });
  });

  describe('Completion sequence', () => {
    function makeStore(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        game: {
          sessionId: 'session-1',
          participantRef: 'participant-1',
          configSnapshot: { durationType: 'ROUNDS', durationValue: 20, maxDartsPerTurn: 3 },
          turns: [{ totalScore: 50, completedAt: '2026-07-17T10:00:00Z' }],
          idempotencyKey: null,
          reset: vi.fn(),
          ...overrides,
        },
      };
    }

    it('sets completionStatus = "pending" synchronously when finished flips true, before the async sequence resolves', async () => {
      const play = scoreTrainingPlay();
      play.$store = makeStore() as typeof play.$store;

      let sawPendingBeforeResolve = false;
      vi.mocked(appendBatch).mockImplementation(async () => {
        sawPendingBeforeResolve = play.completionStatus === 'saving' || play.completionStatus === 'pending';
        return { created: { stages: 1, turns: 1, darts: 3 } };
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: 'session-1', statusKey: 'COMPLETED', completedAt: '2026-07-17T10:00:00Z',
      });

      const promise = play.uploadAndCompleteSession();
      expect(play.completionStatus === 'pending' || play.completionStatus === 'saving').toBe(true);
      await promise;

      expect(sawPendingBeforeResolve).toBe(true);
      expect(play.completionStatus).toBe('succeeded');
    });

    it('mints idempotencyKey once and reuses on retry', async () => {
      const play = scoreTrainingPlay();
      play.$store = makeStore() as typeof play.$store;

      vi.mocked(appendBatch).mockResolvedValue({ created: { stages: 1, turns: 1, darts: 3 } });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: 'session-1', statusKey: 'COMPLETED', completedAt: '2026-07-17T10:00:00Z',
      });

      await play.uploadAndCompleteSession();

      const firstKey = play.$store.game.idempotencyKey;
      expect(firstKey).toBeTruthy();
      expect(play.completionStatus).toBe('succeeded');
      expect(play.completionError).toBe('');

      vi.mocked(appendBatch).mockClear();
      await play.uploadAndCompleteSession();

      expect(play.$store.game.idempotencyKey).toBe(firstKey);
    });

    it('copies stats into resultsSnapshot on success and does not depend on turns surviving afterward', async () => {
      const play = scoreTrainingPlay();
      play.$store = makeStore() as typeof play.$store;

      vi.mocked(appendBatch).mockResolvedValue({ created: { stages: 1, turns: 1, darts: 3 } });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: 'session-1', statusKey: 'COMPLETED', completedAt: '2026-07-17T10:00:00Z',
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot).toEqual({ total: 50, visits: 1, average: 50 });
    });

    it('treats SESSION_ALREADY_COMPLETED as success on the completion path', async () => {
      const play = scoreTrainingPlay();
      play.$store = makeStore() as typeof play.$store;

      const error = new Error('SESSION_ALREADY_COMPLETED');
      (error as { code?: string }).code = 'SESSION_ALREADY_COMPLETED';
      vi.mocked(completeSession).mockRejectedValue(error);
      vi.mocked(appendBatch).mockResolvedValue({ created: { stages: 1, turns: 1, darts: 3 } });

      await play.uploadAndCompleteSession();

      expect(play.completionError).toBe('');
      expect(play.completionStatus).toBe('succeeded');
    });

    it('sets completionStatus = "failed" and keeps buttons disabled on error', async () => {
      const play = scoreTrainingPlay();
      play.$store = makeStore() as typeof play.$store;

      vi.mocked(appendBatch).mockRejectedValue(new Error('Network error'));

      await play.uploadAndCompleteSession();

      expect(play.completionError).toContain('connection');
      expect(play.completionStatus).toBe('failed');
    });

    it('playAgain failure sets playAgainError only, leaves completionStatus untouched', async () => {
      const play = scoreTrainingPlay();
      play.$store = makeStore() as typeof play.$store;
      play.completionStatus = 'succeeded';

      vi.mocked(createSession).mockRejectedValue(new Error('Network error'));

      await play.playAgain();

      expect(play.playAgainError).toBeTruthy();
      expect(play.completionStatus).toBe('succeeded');
      expect(play.$store.game.turns.length).toBe(1);
    });

    it('sets finished and completionStatus pending on final visit before upload settles', async () => {
      const store = gameStub();
      const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '30' };
      let statusDuringUpload: string | null = null;
      vi.mocked(appendBatch).mockImplementation(async () => {
        statusDuringUpload = component.completionStatus;
        return { created: { stages: 1, turns: 2, darts: 0 } };
      });
      vi.mocked(completeSession).mockResolvedValue({ sessionId: 's1', statusKey: 'COMPLETED', completedAt: 'now' });
      await component.init.call(component);
      await component.submitVisit.call(component);
      component.visitInput = '30';
      await component.submitVisit.call(component);

      expect(component.finished).toBe(true);
      expect(statusDuringUpload === 'pending' || statusDuringUpload === 'saving').toBe(true);
      expect(component.completionStatus).toBe('succeeded');
      expect(component.resultsSnapshot).toEqual({ total: 60, visits: 2, average: 30 });
    });

    it('retries uploadAndCompleteSession without recording a new turn', async () => {
      vi.mocked(appendBatch).mockRejectedValueOnce(new Error('network blip'));
      vi.mocked(appendBatch).mockResolvedValueOnce({ created: { stages: 1, turns: 2, darts: 0 } });
      vi.mocked(completeSession).mockResolvedValue({ sessionId: 's1', statusKey: 'COMPLETED', completedAt: 'now' });
      const store = gameStub();
      const component = { ...scoreTrainingPlay(), $store: { game: store }, visitInput: '30' };
      await component.init.call(component);
      await component.submitVisit.call(component);
      component.visitInput = '30';
      await component.submitVisit.call(component);
      expect(component.completionStatus).toBe('failed');
      expect(component.finished).toBe(true);
      const turnCountBeforeRetry = store.turns.length;
      const keyAfterFailure = store.idempotencyKey;

      await component.uploadAndCompleteSession.call(component);

      expect(store.turns).toHaveLength(turnCountBeforeRetry);
      expect(store.idempotencyKey).toBe(keyAfterFailure);
      expect(component.completionStatus).toBe('succeeded');
      expect(store.reset).not.toHaveBeenCalled();
    });
  });
});
