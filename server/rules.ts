export function canStartAttempt(used: number): boolean {
  return used < 4;
}

export function countAttempts(plays: Array<{ playerId: string }>, playerId: string): number {
  const normalized = playerId.trim();
  return plays.filter((play) => play.playerId.trim() === normalized).length;
}

export function isLeaderboardEligible(status: string): boolean {
  return status === 'finished' || status === 'game-over';
}

export type LeaderboardPlay = { playerId: string; name: string; status: string; length: number; correct: number; questions: number; durationSeconds: number };
export type LeaderboardScore = Pick<LeaderboardPlay, 'name' | 'length' | 'correct' | 'questions' | 'durationSeconds'>;

export function getLeaderboard(plays: LeaderboardPlay[], limit = 20): LeaderboardScore[] {
  const best = new Map<string, LeaderboardPlay>();
  for (const play of plays.filter((item) => isLeaderboardEligible(item.status))) {
    const current = best.get(play.playerId);
    if (!current || play.length > current.length || (play.length === current.length && play.correct > current.correct)) best.set(play.playerId, play);
  }
  return [...best.values()]
    .sort((a, b) => b.length - a.length || b.correct - a.correct || a.durationSeconds - b.durationSeconds)
    .slice(0, limit)
    .map(({ name, length, correct, questions, durationSeconds }) => ({ name, length, correct, questions, durationSeconds }));
}

export function canSavePlay(status: string): boolean {
  return status === 'playing';
}

export type PlayResult = { length: number; questions: number; correct: number; durationSeconds: number };

export function validatePlayResult(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Kết quả không hợp lệ.';
  const result = value as Record<string, unknown>;
  const values = [result.length, result.questions, result.correct, result.durationSeconds];
  if (values.some((entry) => typeof entry !== 'number' || !Number.isSafeInteger(entry) || entry < 0)) return 'Các số liệu phải là số nguyên không âm.';
  const { length, questions, correct } = result as PlayResult;
  if (correct > questions) return 'Số câu đúng không thể lớn hơn số câu đã trả lời.';
  if (length > 4 + correct) return 'Chiều dài vượt quá chiều dài ban đầu cộng số câu đúng.';
  return null;
}

export function isAbandoned(lastActiveAt: string | undefined, now = Date.now(), timeoutMs = 60_000): boolean {
  const lastActive = Date.parse(lastActiveAt ?? '');
  return !Number.isFinite(lastActive) || now - lastActive >= timeoutMs;
}

export type IdlePlay = { status: string; startedAt: string; lastActiveAt?: string; finishedAt?: string; durationSeconds: number };

export function expirePlayIfIdle(play: IdlePlay, now = Date.now()): boolean {
  if (play.status !== 'playing' || !isAbandoned(play.lastActiveAt ?? play.startedAt, now)) return false;
  play.status = 'abandoned';
  play.finishedAt = new Date(now).toISOString();
  play.durationSeconds = Math.max(0, Math.floor((now - Date.parse(play.startedAt)) / 1000));
  return true;
}
