import { describe, expect, it } from 'vitest';
import { BoostAudioController, type LoopAudio } from './boostAudio';

class FakeAudio implements LoopAudio {
  currentTime = 0;
  loop = false;
  paused = true;
  plays = 0;
  pauses = 0;

  play(): Promise<void> { this.plays += 1; this.paused = false; return Promise.resolve(); }
  pause(): void { this.pauses += 1; this.paused = true; }
}

describe('boost audio loop', () => {
  it('loops during boost without restarting when more boost time is added', () => {
    const audio = new FakeAudio();
    const controller = new BoostAudioController(audio);

    controller.sync({ boostSeconds: 5, phase: 'playing', muted: false, playLoaded: true });
    audio.currentTime = 1.25;
    controller.sync({ boostSeconds: 8, phase: 'playing', muted: false, playLoaded: true });

    expect(audio.loop).toBe(true);
    expect(audio.plays).toBe(1);
    expect(audio.currentTime).toBe(1.25);
  });

  it('pauses through quiz, feedback, and countdown and resumes from the same position', () => {
    const audio = new FakeAudio();
    const controller = new BoostAudioController(audio);
    controller.sync({ boostSeconds: 5, phase: 'playing', muted: false, playLoaded: true });
    audio.currentTime = 1.25;

    for (const phase of ['quiz', 'feedback', 'countdown'] as const) {
      controller.sync({ boostSeconds: 5, phase, muted: false, playLoaded: true });
      expect(audio.paused).toBe(true);
      expect(audio.currentTime).toBe(1.25);
      controller.sync({ boostSeconds: 5, phase: 'playing', muted: false, playLoaded: true });
      expect(audio.currentTime).toBe(1.25);
    }

    expect(audio.plays).toBe(4);
  });

  it('stops and resets when boost ends, the game ends, audio is muted, or the game unmounts', () => {
    const audio = new FakeAudio();
    const controller = new BoostAudioController(audio);
    controller.sync({ boostSeconds: 4, phase: 'playing', muted: false, playLoaded: true });
    audio.currentTime = 2;
    controller.sync({ boostSeconds: 0, phase: 'playing', muted: false, playLoaded: true });
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);

    controller.sync({ boostSeconds: 4, phase: 'playing', muted: false, playLoaded: true });
    audio.currentTime = 2;
    controller.sync({ boostSeconds: 4, phase: 'game-over', muted: false, playLoaded: true });
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);

    controller.sync({ boostSeconds: 4, phase: 'playing', muted: false, playLoaded: true });
    audio.currentTime = 2;
    controller.sync({ boostSeconds: 4, phase: 'playing', muted: true, playLoaded: true });
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);

    controller.sync({ boostSeconds: 4, phase: 'playing', muted: false, playLoaded: true });
    audio.currentTime = 2;
    controller.stop();
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);
  });

  it('does not start until the play is loaded and the phase is playing', () => {
    const audio = new FakeAudio();
    const controller = new BoostAudioController(audio);
    controller.sync({ boostSeconds: 4, phase: 'playing', muted: false, playLoaded: false });
    expect(audio.plays).toBe(0);
    controller.sync({ boostSeconds: 4, phase: 'quiz', muted: false, playLoaded: true });
    expect(audio.plays).toBe(0);
  });
});
