import type { GamePhase } from './gameFlow';

export interface LoopAudio {
  currentTime: number;
  loop: boolean;
  paused: boolean;
  play(): Promise<void>;
  pause(): void;
}

export class BoostAudioController {
  private mode: 'stopped' | 'paused' | 'playing' = 'stopped';

  constructor(private readonly audio: LoopAudio) {
    audio.loop = true;
  }

  sync(state: { boostSeconds: number; phase: GamePhase; muted: boolean; playLoaded: boolean }): void {
    if (state.boostSeconds <= 0 || state.muted || state.phase === 'game-over' || !state.playLoaded) {
      this.stop();
      return;
    }

    if (state.phase !== 'playing') {
      if (this.mode === 'playing') this.audio.pause();
      this.mode = 'paused';
      return;
    }

    if (this.mode !== 'playing') {
      this.mode = 'playing';
      void this.audio.play().catch(() => { this.mode = 'paused'; });
    }
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.mode = 'stopped';
  }
}
