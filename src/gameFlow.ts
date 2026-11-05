import { isNextMoveSafe, type Direction, type Point } from './game';

export type GamePhase = 'playing' | 'quiz' | 'feedback' | 'countdown' | 'game-over';
export type CountdownLabel = '2' | '1' | 'GO!';
export type QuizKeyAction = { type: 'none' } | { type: 'select'; index: number } | { type: 'answer'; index: number };

export function getCountdownLabel(elapsedMs: number): CountdownLabel | null {
  if (elapsedMs < 667) return '2';
  if (elapsedMs < 1334) return '1';
  if (elapsedMs < 2000) return 'GO!';
  return null;
}

export function isReverseDirection(current: Direction, next: Direction): boolean {
  return next.x === -current.x && next.y === -current.y;
}

export function getSafeDirection(snake: Point[], current: Direction): Direction | null {
  if (isNextMoveSafe(snake, current)) return current;
  const alternatives = current.x !== 0
    ? [{ x: 0, y: -1 }, { x: 0, y: 1 }]
    : [{ x: -1, y: 0 }, { x: 1, y: 0 }];
  return alternatives.find((direction) => !isReverseDirection(current, direction) && isNextMoveSafe(snake, direction)) ?? null;
}

export function getQuizKeyAction(key: string, answerCount: number, selectedIndex: number, locked = false): QuizKeyAction {
  if (locked || answerCount <= 0) return { type: 'none' };
  const normalized = key.length === 1 ? key.toUpperCase() : /^Key[A-D]$/.test(key) ? key.slice(3) : key;
  if (/^[A-D]$/.test(normalized)) {
    const index = normalized.charCodeAt(0) - 65;
    return index < answerCount ? { type: 'answer', index } : { type: 'none' };
  }
  if (normalized === 'ArrowUp' || normalized === 'ArrowDown') {
    const step = normalized === 'ArrowDown' ? 1 : -1;
    return { type: 'select', index: (selectedIndex + step + answerCount) % answerCount };
  }
  if (normalized === 'Enter' && selectedIndex >= 0 && selectedIndex < answerCount) return { type: 'answer', index: selectedIndex };
  return { type: 'none' };
}

export function restoreGamePhase(snapshot: { phase?: GamePhase; gameOver: boolean; apple: Point | null; countdownStartedAt?: number }, now = Date.now()): GamePhase {
  if (snapshot.gameOver || snapshot.phase === 'game-over') return 'game-over';
  if (snapshot.phase === 'countdown' && (typeof snapshot.countdownStartedAt !== 'number' || now - snapshot.countdownStartedAt >= 2000)) return 'playing';
  if (snapshot.phase) return snapshot.phase;
  return snapshot.apple === null ? 'quiz' : 'playing';
}
