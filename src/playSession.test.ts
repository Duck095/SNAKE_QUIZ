import { describe, expect, it } from 'vitest';
import { endPlaySnapshot, getOrCreatePlayerId, parsePlaySnapshot, playPath, serializePlaySnapshot, type PlaySnapshot } from './playSession';

const snapshot: PlaySnapshot = {
  snake: [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 7 }],
  apple: { x: 2, y: 2 }, direction: { x: 0, y: -1 }, questionIndex: 3,
  boostSeconds: 4.5, correct: 3, streak: 2, startedAt: 12345, gameOver: false, paused: true,
  phase: 'feedback', result: 'correct', feedbackStartedAt: 12400, countdownStartedAt: undefined,
};

describe('play session state', () => {
  it('restores the current snake and question after page reload', () => {
    expect(parsePlaySnapshot(serializePlaySnapshot(snapshot))).toEqual(snapshot);
  });

  it('returns a fresh URL for replay rather than reusing the ended play ID', () => {
    expect(playPath('new/id')).toBe('/play?id=new%2Fid');
    expect(playPath('old')).not.toBe(playPath('new'));
  });

  it('marks an exited game terminal so reload does not resume movement', () => {
    expect(endPlaySnapshot(snapshot).gameOver).toBe(true);
  });
  it('persists one hidden player identity across refreshes', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    expect(getOrCreatePlayerId(storage, () => 'player-1')).toBe('player-1');
    expect(getOrCreatePlayerId(storage, () => 'player-2')).toBe('player-1');
  });
});
