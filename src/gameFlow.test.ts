import { describe, expect, it } from 'vitest';
import { getCountdownLabel, getSafeDirection, getQuizKeyAction, isReverseDirection, restoreGamePhase, type GamePhase } from './gameFlow';

describe('game flow', () => {
  it('runs the 2 second countdown as 2, 1, GO and then finishes', () => {
    expect([0, 666, 667, 1333, 1334, 1999, 2000].map(getCountdownLabel)).toEqual(['2', '2', '1', '1', 'GO!', 'GO!', null]);
  });

  it('automatically selects a safe non-reverse direction when the current direction collides', () => {
    const snake = [{ x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }, { x: 16, y: 10 }];
    const safe = getSafeDirection(snake, { x: 1, y: 0 });
    expect(safe).toEqual({ x: 0, y: -1 });
    expect(isReverseDirection({ x: 1, y: 0 }, safe!)).toBe(false);
    expect(isReverseDirection({ x: 1, y: 0 }, { x: -1, y: 0 })).toBe(true);
    expect(getSafeDirection([{x:5,y:5},{x:5,y:4},{x:6,y:4},{x:6,y:5},{x:7,y:5}], {x:1,y:0})).toEqual({x:0,y:1});
    const blocked = [{x:0,y:5},{x:1,y:5},{x:1,y:4},{x:0,y:4},{x:0,y:3},{x:1,y:3},{x:2,y:3},{x:2,y:4},{x:2,y:5},{x:2,y:6},{x:1,y:6},{x:0,y:6},{x:0,y:7}];
    expect(getSafeDirection(blocked, {x:-1,y:0})).toBeNull();
  });

  it('maps quiz keys to direct answer, selection, and submit actions while locked', () => {
    expect(getQuizKeyAction('KeyC', 4, 1)).toEqual({ type: 'answer', index: 2 });
    expect(getQuizKeyAction('ArrowDown', 4, 1)).toEqual({ type: 'select', index: 2 });
    expect(getQuizKeyAction('Enter', 4, 2)).toEqual({ type: 'answer', index: 2 });
    expect(getQuizKeyAction('ArrowUp', 4, 0)).toEqual({ type: 'select', index: 3 });
    expect(getQuizKeyAction('KeyA', 4, 0, true)).toEqual({ type: 'none' });
  });

  it('restores quiz, feedback, countdown, and terminal phases without restarting an expired countdown', () => {
    const snapshot = { phase: 'feedback' as GamePhase, gameOver: false, apple: {x:2,y:2}, countdownStartedAt: 1000 };
    expect(restoreGamePhase(snapshot, 1200)).toBe('feedback');
    expect(restoreGamePhase({ ...snapshot, phase: 'countdown' }, 1500)).toBe('countdown');
    expect(restoreGamePhase({ ...snapshot, phase: 'countdown' }, 3000)).toBe('playing');
    expect(restoreGamePhase({ ...snapshot, phase: 'countdown', countdownStartedAt: undefined }, 1500)).toBe('playing');
    expect(restoreGamePhase({ ...snapshot, phase: undefined, apple: null }, 1500)).toBe('quiz');
    expect(restoreGamePhase({ ...snapshot, gameOver: true }, 1200)).toBe('game-over');
  });
});
