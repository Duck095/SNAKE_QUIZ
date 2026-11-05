import { describe, expect, it } from 'vitest';
import { canSavePlay, canStartAttempt, countAttempts, expirePlayIfIdle, getLeaderboard, isAbandoned, isLeaderboardEligible, validatePlayResult } from './rules.js';
import { createSerialQueue } from './serial.js';

describe('attempt reservation', () => {
  it('allows only four attempts for one generated player ID', () => {
    expect([0, 1, 2, 3, 4].map(canStartAttempt)).toEqual([true, true, true, true, false]);
  });

  it('runs concurrent updates one at a time', async () => {
    const runExclusive = createSerialQueue();
    const plays: Array<{ playerId: string }> = [];
    const start = () => runExclusive(async () => {
      const snapshot = countAttempts(plays, 'browser-id');
      await Promise.resolve();
      if (!canStartAttempt(snapshot)) return false;
      plays.push({ playerId: 'browser-id' });
      return true;
    });
    expect(await Promise.all([start(), start(), start(), start(), start()])).toEqual([true, true, true, true, false]);
    expect(countAttempts(plays, 'browser-id')).toBe(4);
    expect(countAttempts(plays, 'other-browser')).toBe(0);
  });

  it('keeps the four-attempt quota correct when several devices start at once', async () => {
    const runExclusive = createSerialQueue();
    const plays: Array<{ playerId: string }> = [];
    const start = () => runExclusive(async () => {
      const used = countAttempts(plays, 'shared-browser-id');
      await Promise.resolve();
      if (!canStartAttempt(used)) return false;
      plays.push({ playerId: 'shared-browser-id' });
      return true;
    });

    expect(await Promise.all(Array.from({ length: 8 }, start))).toEqual([true, true, true, true, false, false, false, false]);
    expect(countAttempts(plays, 'shared-browser-id')).toBe(4);
  });

  it('rejects impossible play lengths and accepts valid results', () => {
    expect(validatePlayResult({ length: 6, questions: 2, correct: 2, durationSeconds: 8 })).toBeNull();
    expect(validatePlayResult({ length: 7, questions: 2, correct: 2, durationSeconds: 8 })).toBeTruthy();
  });

  it('expires a playing session after a minute without a heartbeat', () => {
    const now = Date.now();
    expect(isAbandoned(new Date(now - 61_000).toISOString(), now)).toBe(true);
    expect(isAbandoned(new Date(now - 60_000).toISOString(), now)).toBe(true);
    expect(isAbandoned(new Date(now - 59_000).toISOString(), now)).toBe(false);
  });

  it('abandons an expired play inline on request before the periodic sweep runs', () => {
    const now = Date.now();
    const play = { status: 'playing', startedAt: new Date(now - 120_000).toISOString(), lastActiveAt: new Date(now - 60_000).toISOString(), durationSeconds: 0 };
    expect(expirePlayIfIdle(play, now)).toBe(true);
    expect(play.status).toBe('abandoned');
    expect(canSavePlay(play.status)).toBe(false);
    expect(expirePlayIfIdle(play, now)).toBe(false);
  });

  it('excludes abandoned sessions from official leaderboard but still counts the attempt', () => {
    const plays = [{ playerId: 'id-1', status: 'abandoned' }, { playerId: 'id-1', status: 'finished' }];
    expect(isLeaderboardEligible(plays[0].status)).toBe(false);
    expect(isLeaderboardEligible(plays[1].status)).toBe(true);
    expect(countAttempts(plays, 'id-1')).toBe(2);
    expect(canSavePlay(plays[0].status)).toBe(false);
    expect(canSavePlay('playing')).toBe(true);
  });

  it('builds one leaderboard entry per player using their best eligible score', () => {
    const plays = [
      { playerId: 'a', name: 'An', status: 'finished', length: 8, correct: 4, questions: 5, durationSeconds: 30 },
      { playerId: 'a', name: 'An', status: 'game-over', length: 9, correct: 3, questions: 6, durationSeconds: 50 },
      { playerId: 'b', name: 'Bình', status: 'finished', length: 7, correct: 4, questions: 5, durationSeconds: 20 },
      { playerId: 'c', name: 'Chi', status: 'abandoned', length: 20, correct: 20, questions: 20, durationSeconds: 1 },
    ];

    expect(getLeaderboard(plays)).toEqual([
      { name: 'An', length: 9, correct: 3, questions: 6, durationSeconds: 50 },
      { name: 'Bình', length: 7, correct: 4, questions: 5, durationSeconds: 20 },
    ]);
  });
});
