export function getRoutePath(path: string): string {
  return new URL(path, 'http://snake-quiz.local').pathname;
}
