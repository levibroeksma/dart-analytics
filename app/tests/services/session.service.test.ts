import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@db/client', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('@lib/id', () => ({ generateId: vi.fn(() => 'generated-id') }));
vi.mock('@repositories/session.repository', () => ({
  findGameTypeAndRuleset: vi.fn(),
  findCaptureModeId: vi.fn(),
  findInputModeId: vi.fn(),
  findGameStatusId: vi.fn(),
  findParticipantTypeId: vi.fn(),
  findPlayerDisplayName: vi.fn(),
  findConfigurationTemplate: vi.fn(),
  insertSessionRecords: vi.fn(),
}));

import * as repo from '@repositories/session.repository';
import { createSession } from '@services/session.service';

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
