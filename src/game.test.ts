import { describe, expect, it } from 'vitest';
import { getPenalty, getSpeedSeconds, getBoostGain, getComboBonus, getAnswerSoundSequence, canAdvanceGame, moveSnake, isCollision, formatElapsed, getMoveIntervalMs, applyAnswer, randomApple, getBoardCells, isNextMoveSafe, type Point } from './game';

describe('snake quiz rules', () => {
  it('applies score-based penalties and speed tiers', () => {
    expect([1, 9, 10, 19, 20].map(getPenalty)).toEqual([1, 1, 2, 2, 4]);
  });
  it('maps question totals 1, 5, 9, 10, 19, 20 and 21 to the requested boost durations', () => {
    expect([1, 5, 9, 10, 19, 20, 21].map(getSpeedSeconds)).toEqual([5, 5, 5, 3, 3, 1.5, 1.5]);
  });
  it('uses a separate normal and boost movement interval', () => {
    expect(getMoveIntervalMs(false)).toBe(260);
    expect(getMoveIntervalMs(true)).toBe(175);
  });
  it('awards a time bonus only at 5, 10 and 20 consecutive correct answers', () => {
    expect([4, 5, 9, 10, 15, 19, 20, 21].map(getComboBonus)).toEqual([0, 1.5, 0, 3, 0, 0, 5, 0]);
  });
  it('adds the question-tier boost and streak bonus to the current boost', () => {
    expect(7 + getBoostGain(5, 5)).toBe(13.5);
    expect(2 + getBoostGain(10, 10)).toBe(8);
    expect(1 + getBoostGain(20, 20)).toBe(7.5);
  });
  it('keeps combo audio out of one-shot cues because combo audio is the boost loop', () => {
    expect(getAnswerSoundSequence()).toEqual(['correct', 'speed']);
  });
  it('pauses movement and boost advancement while a quiz or resume prompt is visible', () => {
    expect(canAdvanceGame({ quizOpen: true, gameOver: false, playLoaded: true, appleReady: true })).toBe(false);
    expect(canAdvanceGame({ quizOpen: false, gameOver: true, playLoaded: true, appleReady: true })).toBe(false);
    expect(canAdvanceGame({ quizOpen: false, gameOver: false, playLoaded: true, appleReady: true })).toBe(true);
    expect(canAdvanceGame({ quizOpen: false, paused: true, gameOver: false, playLoaded: true, appleReady: true })).toBe(false);
  });
  it('moves the head forward and trims the tail unless an apple is eaten', () => {
    const snake = [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 1, y: 4 }];
    expect(moveSnake(snake, { x: 1, y: 0 }, false)).toHaveLength(4);
    expect(moveSnake(snake, { x: 1, y: 0 }, true)).toHaveLength(5);
    expect(moveSnake(snake, { x: 1, y: 0 }, false)[0]).toEqual({ x: 5, y: 4 });
  });
  it('adds one segment on a correct answer and lets a wrong answer reduce length to zero', () => {
    const snake = [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 1, y: 4 }];
    const grown = applyAnswer(snake, true, 1);
    expect(grown).toHaveLength(5);
    expect(new Set(grown.map((part) => `${part.x},${part.y}`)).size).toBe(5);
    expect(applyAnswer(snake, false, 4)).toHaveLength(0);
  });
  it('spawns the apple in a free cell of the latest snake state', () => {
    expect(randomApple([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], 2)).toEqual({ x: 1, y: 1 });
  });
  it('prefers apple cells at least two spaces from each board edge and safely falls back', () => {
    const apple = randomApple([], 20);
    expect(apple.x).toBeGreaterThanOrEqual(2); expect(apple.x).toBeLessThanOrEqual(17);
    expect(apple.y).toBeGreaterThanOrEqual(2); expect(apple.y).toBeLessThanOrEqual(17);
    const onlyInterior = Array.from({ length: 400 }, (_, i) => ({ x: i % 20, y: Math.floor(i / 20) })).filter((p) => p.x < 2 || p.x > 17 || p.y < 2 || p.y > 17);
    expect(randomApple(onlyInterior, 20)).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });
  it('builds a 20 by 20 board with each snake segment in one unique cell', () => {
    const snake: Point[] = [{x: 3, y: 4}, {x: 2, y: 4}, {x: 1, y: 4}];
    const cells = getBoardCells(snake, {x: 5, y: 5});
    expect(cells).toHaveLength(400);
    expect(cells.filter((c) => c.snakeIndex !== -1)).toHaveLength(3);
    expect(cells.filter((c) => c.apple)).toHaveLength(1);
    expect(cells.find((c) => c.x === 2 && c.y === 4)?.snakeIndex).toBe(1);
  });
  it('checks the next cell before resuming', () => {
    const snake: Point[] = [{x: 1, y: 1}, {x: 0, y: 1}, {x: 0, y: 2}, {x: 1, y: 2}];
    expect(isNextMoveSafe(snake, {x: 0, y: -1})).toBe(true);
    expect(isNextMoveSafe(snake, {x: -1, y: 0})).toBe(false);
  });
  it('detects walls and self collision but allows moving into the vacating tail', () => {
    expect(isCollision([{ x: -1, y: 4 }], 20, 20)).toBe(true);
    const overlapping = [{ x: 4, y: 4 }, { x: 4, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 4 }];
    expect(isCollision(overlapping, 20, 20)).toBe(true);
    expect(isCollision(overlapping, 20, 20, false, overlapping[3])).toBe(false);
  });
  it('formats seconds as a padded timer', () => expect(formatElapsed(68)).toBe('01:08'));
});
