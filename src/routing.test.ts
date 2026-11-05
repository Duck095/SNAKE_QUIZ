import { describe, expect, it } from 'vitest';
import { getRoutePath } from './routing';

describe('route matching', () => {
  it('matches the play route when the URL includes its play id query', () => {
    expect(getRoutePath('/play?id=abc-123')).toBe('/play');
  });
});
