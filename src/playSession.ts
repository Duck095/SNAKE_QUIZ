import type { Direction, Point } from './game';
import type { GamePhase } from './gameFlow';

export type PlaySnapshot = {
  snake: Point[];
  apple: Point | null;
  direction: Direction;
  questionIndex: number;
  boostSeconds: number;
  correct: number;
  streak: number;
  startedAt: number;
  gameOver: boolean;
  paused?: boolean;
  phase?: GamePhase;
  result?: 'correct' | 'wrong' | null;
  feedbackStartedAt?: number;
  countdownStartedAt?: number;
};

export function playPath(id: string): string {
  return `/play?id=${encodeURIComponent(id)}`;
}

export function snapshotKey(id: string): string {
  return `snakeQuiz.play.${id}`;
}

export function getOrCreatePlayerId(storage: Pick<Storage, 'getItem' | 'setItem'>, createId: () => string): string {
  const existing = storage.getItem('snakeQuiz.playerId');
  if (existing) return existing;
  const id = createId();
  storage.setItem('snakeQuiz.playerId', id);
  return id;
}

export function serializePlaySnapshot(snapshot: PlaySnapshot): string {
  return JSON.stringify(snapshot);
}

export function endPlaySnapshot(snapshot: PlaySnapshot): PlaySnapshot {
  return { ...snapshot, gameOver: true };
}

export function parsePlaySnapshot(raw: string | null): PlaySnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PlaySnapshot>;
    const validPoint = (point: unknown): point is Point => Boolean(point && typeof point === 'object' && Number.isInteger((point as Point).x) && Number.isInteger((point as Point).y));
    if (!Array.isArray(value.snake) || value.snake.length === 0 || !value.snake.every(validPoint)) return null;
    if (value.apple !== null && !validPoint(value.apple)) return null;
    if (!validPoint(value.direction)) return null;
    for (const number of [value.questionIndex, value.boostSeconds, value.correct, value.streak, value.startedAt]) {
      if (typeof number !== 'number' || !Number.isFinite(number) || number < 0) return null;
    }
    if (typeof value.gameOver !== 'boolean') return null;
    if (value.phase !== undefined && !['playing', 'quiz', 'feedback', 'countdown', 'game-over'].includes(value.phase)) return null;
    if (value.result !== undefined && value.result !== null && value.result !== 'correct' && value.result !== 'wrong') return null;
    for (const time of [value.feedbackStartedAt, value.countdownStartedAt]) {
      if (time !== undefined && (typeof time !== 'number' || !Number.isFinite(time) || time < 0)) return null;
    }
    return value as PlaySnapshot;
  } catch {
    return null;
  }
}
