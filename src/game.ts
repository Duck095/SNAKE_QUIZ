export type Point = { x: number; y: number };
export type Direction = Point;

export const GRID_SIZE = 20;
export const START_LENGTH = 4;
export const NORMAL_MOVE_MS = 260;
export const BOOST_MOVE_MS = 175;

export function getPenalty(totalQuestions: number): number {
  return totalQuestions >= 20 ? 4 : totalQuestions >= 10 ? 2 : 1;
}

export function getSpeedSeconds(totalQuestions: number): number {
  return totalQuestions >= 20 ? 1.5 : totalQuestions >= 10 ? 3 : 5;
}

export function getMoveIntervalMs(boost: boolean): number {
  return boost ? BOOST_MOVE_MS : NORMAL_MOVE_MS;
}

export function getComboBonus(streak: number): number {
  return streak === 20 ? 5 : streak === 10 ? 3 : streak === 5 ? 1.5 : 0;
}

export function getBoostGain(totalQuestions: number, streak: number): number {
  return getSpeedSeconds(totalQuestions) + getComboBonus(streak);
}

export function getAnswerSoundSequence(streak: number): string[] {
  return ['correct', ...(getComboBonus(streak) > 0 ? ['combo'] : []), 'speed'];
}

export function canAdvanceGame(state: { quizOpen: boolean; paused?: boolean; gameOver: boolean; playLoaded: boolean; appleReady: boolean }): boolean {
  return !state.quizOpen && !state.paused && !state.gameOver && state.playLoaded && state.appleReady;
}

export function moveSnake(snake: Point[], direction: Direction, grow: boolean): Point[] {
  const head = snake[0];
  const next = { x: head.x + direction.x, y: head.y + direction.y };
  return [next, ...snake.slice(0, grow ? undefined : -1)];
}

export function applyAnswer(snake: Point[], correct: boolean, penalty: number): Point[] {
  if (correct) {
    const tail = snake.at(-1);
    if (!tail) return snake;
    const previous = snake.at(-2);
    const occupied = new Set(snake.map(({ x, y }) => `${x},${y}`));
    const candidates = previous
      ? [{ x: tail.x + Math.sign(tail.x - previous.x), y: tail.y + Math.sign(tail.y - previous.y) }]
      : [];
    candidates.push(...[{x: tail.x + 1, y: tail.y}, {x: tail.x - 1, y: tail.y}, {x: tail.x, y: tail.y + 1}, {x: tail.x, y: tail.y - 1}]);
    const extension = candidates.find(({x, y}) => x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE && !occupied.has(`${x},${y}`));
    return extension ? [...snake, extension] : snake;
  }
  return snake.slice(0, Math.max(0, snake.length - penalty));
}

export function isCollision(snake: Point[], width: number, height: number, grow = false, tail?: Point): boolean {
  const head = snake[0];
  if (head.x < 0 || head.y < 0 || head.x >= width || head.y >= height) return true;
  return snake.slice(1).some((part) => !(tail && !grow && part === tail) && part.x === head.x && part.y === head.y);
}

export function formatElapsed(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function randomApple(snake: Point[], size = GRID_SIZE): Point {
  const free: Point[] = [];
  const interior: Point[] = [];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (!snake.some((p) => p.x === x && p.y === y)) {
    const point = { x, y };
    free.push(point);
    if (x >= 2 && x <= size - 3 && y >= 2 && y <= size - 3) interior.push(point);
  }
  if (interior.length) return interior[Math.floor(Math.random() * interior.length)];
  return free[Math.floor(Math.random() * free.length)] ?? { x: -1, y: -1 };
}

export type BoardCell = Point & { snakeIndex: number; apple: boolean };
export function getBoardCells(snake: Point[], apple: Point | null, size = GRID_SIZE): BoardCell[] {
  return Array.from({ length: size * size }, (_, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    return { x, y, snakeIndex: snake.findIndex((part) => part.x === x && part.y === y), apple: apple?.x === x && apple?.y === y };
  });
}

export function isNextMoveSafe(snake: Point[], direction: Direction, width = GRID_SIZE, height = GRID_SIZE): boolean {
  const next = moveSnake(snake, direction, false);
  return !isCollision(next, width, height, false, snake.at(-1));
}
