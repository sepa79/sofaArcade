type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle';

interface ToneSpec {
  readonly fromHz: number;
  readonly toHz: number;
  readonly duration: number;
  readonly volume: number;
  readonly wave: WaveType;
}

export class RetroSfx {
  private static readonly MASTER_GAIN = 2.2;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lastPlayedAtByKey = new Map<string, number>();

  unlock(): void {
    const context = this.ensureContext();
    if (context.state === 'suspended') {
      void context.resume();
    }
  }

  playUiMove(): void {
    if (!this.canPlay('ui-move', 25)) {
      return;
    }

    this.playTone({
      fromHz: 540,
      toHz: 680,
      duration: 0.04,
      volume: 0.06,
      wave: 'square'
    });
  }

  playUiConfirm(): void {
    if (!this.canPlay('ui-confirm', 70)) {
      return;
    }

    this.playTone({
      fromHz: 460,
      toHz: 840,
      duration: 0.1,
      volume: 0.085,
      wave: 'triangle'
    });
  }

  playPlayerShot(): void {
    if (!this.canPlay('player-shot', 45)) {
      return;
    }

    this.playTone({
      fromHz: 1280,
      toHz: 540,
      duration: 0.07,
      volume: 0.075,
      wave: 'square'
    });
  }

  playEnemyShot(): void {
    if (!this.canPlay('enemy-shot', 85)) {
      return;
    }

    this.playTone({
      fromHz: 360,
      toHz: 220,
      duration: 0.09,
      volume: 0.06,
      wave: 'sawtooth'
    });
  }

  playExplosion(): void {
    if (!this.canPlay('explosion', 55)) {
      return;
    }

    this.playTone({
      fromHz: 220,
      toHz: 90,
      duration: 0.12,
      volume: 0.085,
      wave: 'triangle'
    });
    this.playTone({
      fromHz: 920,
      toHz: 120,
      duration: 0.09,
      volume: 0.05,
      wave: 'square'
    });
  }

  playPlayerHit(): void {
    if (!this.canPlay('player-hit', 90)) {
      return;
    }

    this.playTone({
      fromHz: 180,
      toHz: 70,
      duration: 0.2,
      volume: 0.11,
      wave: 'sawtooth'
    });
  }

  playWin(): void {
    if (!this.canPlay('win', 300)) {
      return;
    }

    this.playTone({
      fromHz: 520,
      toHz: 980,
      duration: 0.18,
      volume: 0.08,
      wave: 'triangle'
    });
  }

  playLose(): void {
    if (!this.canPlay('lose', 300)) {
      return;
    }

    this.playTone({
      fromHz: 260,
      toHz: 82,
      duration: 0.24,
      volume: 0.09,
      wave: 'triangle'
    });
  }

  private ensureContext(): AudioContext {
    if (this.context !== null && this.masterGain !== null) {
      return this.context;
    }

    if (typeof window === 'undefined' || window.AudioContext === undefined) {
      throw new Error('AudioContext support is required for RetroSfx.');
    }

    const context = new window.AudioContext();
    const masterGain = context.createGain();
    masterGain.gain.value = RetroSfx.MASTER_GAIN;
    masterGain.connect(context.destination);
    this.context = context;
    this.masterGain = masterGain;
    return context;
  }

  private canPlay(key: string, minIntervalMs: number): boolean {
    if (this.context === null || this.masterGain === null || this.context.state !== 'running') {
      return false;
    }

    const now = performance.now();
    const last = this.lastPlayedAtByKey.get(key) ?? -Infinity;
    if (now - last < minIntervalMs) {
      return false;
    }

    this.lastPlayedAtByKey.set(key, now);
    return true;
  }

  private playTone(spec: ToneSpec): void {
    const context = this.context;
    const masterGain = this.masterGain;
    if (context === null || masterGain === null || context.state !== 'running') {
      return;
    }

    const startAt = context.currentTime;
    const endAt = startAt + spec.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = spec.wave;
    oscillator.frequency.setValueAtTime(spec.fromHz, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, spec.toHz), endAt);

    gain.gain.setValueAtTime(spec.volume, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(startAt);
    oscillator.stop(endAt);
  }
}
