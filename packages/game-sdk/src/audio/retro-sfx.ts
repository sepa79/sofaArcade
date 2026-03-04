type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle';

type OutputBus = 'fx' | 'sub';

interface ToneSpec {
  readonly fromHz: number;
  readonly toHz: number;
  readonly duration: number;
  readonly volume: number;
  readonly wave: WaveType;
  readonly delay?: number;
  readonly attack?: number;
  readonly bus?: OutputBus;
}

interface SpatialSpec {
  readonly pan?: number;
  readonly depth?: number;
}

export interface ExplosionSoundSpec extends SpatialSpec {
  readonly large?: boolean;
}

export interface MotionSoundState {
  readonly theta: number;
  readonly speedUnit: number;
  readonly active: boolean;
}

export type AudioMixProfileId = 'cinema' | 'arcade' | 'late-night';

interface AudioMixProfile {
  readonly programGain: number;
  readonly masterGain: number;
  readonly fxBusGain: number;
  readonly subBusGain: number;
  readonly compressor: {
    readonly threshold: number;
    readonly knee: number;
    readonly ratio: number;
    readonly attack: number;
    readonly release: number;
  };
  readonly limiter: {
    readonly threshold: number;
    readonly knee: number;
    readonly ratio: number;
    readonly attack: number;
    readonly release: number;
  };
  readonly gains: {
    readonly ui: number;
    readonly playerShot: number;
    readonly enemyShot: number;
    readonly explosion: number;
    readonly playerHit: number;
    readonly motionFx: number;
    readonly motionSub: number;
  };
  readonly stereoWidth: number;
  readonly fxDepthFloor: number;
}

export const AUDIO_MIX_PROFILE_IDS = ['cinema', 'arcade', 'late-night'] as const;

const AUDIO_MIX_PROFILES: Readonly<Record<AudioMixProfileId, AudioMixProfile>> = {
  cinema: {
    programGain: 3.2,
    masterGain: 2.2,
    fxBusGain: 1,
    subBusGain: 1.12,
    compressor: {
      threshold: -18,
      knee: 16,
      ratio: 4,
      attack: 0.004,
      release: 0.15
    },
    limiter: {
      threshold: -2,
      knee: 0,
      ratio: 20,
      attack: 0.001,
      release: 0.045
    },
    gains: {
      ui: 1,
      playerShot: 1,
      enemyShot: 1,
      explosion: 1,
      playerHit: 1,
      motionFx: 1,
      motionSub: 1
    },
    stereoWidth: 1,
    fxDepthFloor: 0.48
  },
  arcade: {
    programGain: 3.6,
    masterGain: 2.05,
    fxBusGain: 1.14,
    subBusGain: 0.82,
    compressor: {
      threshold: -20,
      knee: 14,
      ratio: 3.2,
      attack: 0.003,
      release: 0.12
    },
    limiter: {
      threshold: -2.5,
      knee: 0,
      ratio: 18,
      attack: 0.001,
      release: 0.04
    },
    gains: {
      ui: 1.08,
      playerShot: 1.14,
      enemyShot: 1.06,
      explosion: 0.9,
      playerHit: 0.95,
      motionFx: 1.06,
      motionSub: 0.8
    },
    stereoWidth: 1.15,
    fxDepthFloor: 0.42
  },
  'late-night': {
    programGain: 2.2,
    masterGain: 1.45,
    fxBusGain: 0.9,
    subBusGain: 0.55,
    compressor: {
      threshold: -24,
      knee: 12,
      ratio: 5.8,
      attack: 0.003,
      release: 0.18
    },
    limiter: {
      threshold: -4.5,
      knee: 0,
      ratio: 24,
      attack: 0.001,
      release: 0.06
    },
    gains: {
      ui: 0.9,
      playerShot: 0.82,
      enemyShot: 0.8,
      explosion: 0.72,
      playerHit: 0.76,
      motionFx: 0.78,
      motionSub: 0.46
    },
    stereoWidth: 0.62,
    fxDepthFloor: 0.56
  }
};

function requireAudioMixProfile(profileId: AudioMixProfileId): AudioMixProfile {
  const profile = AUDIO_MIX_PROFILES[profileId];
  if (profile === undefined) {
    throw new Error(`Unknown audio mix profile: "${profileId}".`);
  }

  return profile;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class RetroSfx {
  private mixProfileId: AudioMixProfileId = 'cinema';
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private fxBusGain: GainNode | null = null;
  private subBusGain: GainNode | null = null;
  private busCompressor: DynamicsCompressorNode | null = null;
  private busLimiter: DynamicsCompressorNode | null = null;
  private lastPlayedAtByKey = new Map<string, number>();

  private motionPrimaryOsc: OscillatorNode | null = null;
  private motionSecondaryOsc: OscillatorNode | null = null;
  private motionSubOsc: OscillatorNode | null = null;
  private motionGain: GainNode | null = null;
  private motionSubGain: GainNode | null = null;
  private motionFilter: BiquadFilterNode | null = null;
  private motionPan: StereoPannerNode | null = null;

  unlock(): void {
    const context = this.ensureContext();
    if (context.state === 'suspended') {
      void context.resume();
    }
  }

  shutdown(): void {
    this.stopMotionLoop();
  }

  setMixProfile(profileId: AudioMixProfileId): void {
    this.mixProfileId = profileId;
    const profile = requireAudioMixProfile(profileId);
    this.applyMixProfileToNodes(profile);
  }

  getMixProfile(): AudioMixProfileId {
    return this.mixProfileId;
  }

  nextMixProfile(): AudioMixProfileId {
    const profileIds = AUDIO_MIX_PROFILE_IDS;
    const currentIndex = profileIds.indexOf(this.mixProfileId);
    if (currentIndex < 0) {
      throw new Error(`Active audio mix profile is invalid: "${this.mixProfileId}".`);
    }

    const nextIndex = (currentIndex + 1) % profileIds.length;
    const nextProfile = profileIds[nextIndex];
    if (nextProfile === undefined) {
      throw new Error(`Missing audio mix profile at index ${nextIndex}.`);
    }

    this.setMixProfile(nextProfile);
    return nextProfile;
  }

  playUiMove(): void {
    if (!this.canPlay('ui-move', 25)) {
      return;
    }

    const profile = requireAudioMixProfile(this.mixProfileId);
    this.playTone(
      {
        fromHz: 520,
        toHz: 690,
        duration: 0.045,
        volume: 0.05 * profile.gains.ui,
        wave: 'square'
      },
      { pan: 0, depth: 0 }
    );
  }

  playUiConfirm(): void {
    if (!this.canPlay('ui-confirm', 70)) {
      return;
    }

    const profile = requireAudioMixProfile(this.mixProfileId);
    this.playTone(
      {
        fromHz: 430,
        toHz: 930,
        duration: 0.11,
        volume: 0.07 * profile.gains.ui,
        wave: 'triangle'
      },
      { pan: 0, depth: 0 }
    );
  }

  playPlayerShot(spatial: SpatialSpec = {}): void {
    if (!this.canPlay('player-shot', 42)) {
      return;
    }

    const pan = clamp(spatial.pan ?? 0, -1, 1);
    const depth = clamp01(spatial.depth ?? 0);
    const profile = requireAudioMixProfile(this.mixProfileId);

    this.playTone(
      {
        fromHz: 1840,
        toHz: 680,
        duration: 0.078,
        volume: 0.085 * profile.gains.playerShot,
        wave: 'square',
        attack: 0.0015
      },
      { pan, depth }
    );

    this.playTone(
      {
        fromHz: 970,
        toHz: 410,
        duration: 0.108,
        volume: 0.048 * profile.gains.playerShot,
        wave: 'triangle',
        delay: 0.006
      },
      { pan: clamp(pan + 0.1, -1, 1), depth }
    );

    this.playTone(
      {
        fromHz: 1450,
        toHz: 620,
        duration: 0.056,
        volume: 0.043 * profile.gains.playerShot,
        wave: 'sawtooth',
        delay: 0.004
      },
      { pan: clamp(pan - 0.08, -1, 1), depth }
    );
  }

  playEnemyShot(spatial: SpatialSpec = {}): void {
    if (!this.canPlay('enemy-shot', 72)) {
      return;
    }

    const pan = clamp(spatial.pan ?? 0, -1, 1);
    const depth = clamp01(spatial.depth ?? 0.2);
    const profile = requireAudioMixProfile(this.mixProfileId);

    this.playTone(
      {
        fromHz: 780,
        toHz: 250,
        duration: 0.115,
        volume: 0.067 * profile.gains.enemyShot,
        wave: 'sawtooth'
      },
      { pan, depth }
    );

    this.playTone(
      {
        fromHz: 520,
        toHz: 180,
        duration: 0.14,
        volume: 0.037 * profile.gains.enemyShot,
        wave: 'triangle',
        delay: 0.01
      },
      { pan: clamp(pan - 0.06, -1, 1), depth }
    );
  }

  playExplosion(spec: ExplosionSoundSpec = {}): void {
    const isLarge = spec.large ?? false;
    if (!this.canPlay(isLarge ? 'explosion-large' : 'explosion', isLarge ? 85 : 55)) {
      return;
    }

    const pan = clamp(spec.pan ?? 0, -1, 1);
    const depth = clamp01(spec.depth ?? 0);
    const largeMul = isLarge ? 1.35 : 1;
    const profile = requireAudioMixProfile(this.mixProfileId);

    this.playTone(
      {
        fromHz: 210,
        toHz: 62,
        duration: 0.28,
        volume: 0.11 * largeMul * profile.gains.explosion,
        wave: 'triangle',
        attack: 0.0012
      },
      { pan, depth }
    );

    this.playTone(
      {
        fromHz: 1240,
        toHz: 180,
        duration: 0.11,
        volume: 0.06 * profile.gains.explosion,
        wave: 'sawtooth'
      },
      { pan: clamp(pan + 0.1, -1, 1), depth }
    );

    this.playTone(
      {
        fromHz: 52,
        toHz: 39,
        duration: isLarge ? 0.52 : 0.38,
        volume: 0.21 * largeMul * profile.gains.explosion,
        wave: 'sine',
        bus: 'sub'
      },
      { depth }
    );

    if (isLarge) {
      this.playTone(
        {
          fromHz: 95,
          toHz: 43,
          duration: 0.44,
          volume: 0.17 * profile.gains.explosion,
          wave: 'triangle',
          bus: 'sub',
          delay: 0.015
        },
        { depth }
      );
    }
  }

  playPlayerHit(spatial: SpatialSpec = {}): void {
    if (!this.canPlay('player-hit', 90)) {
      return;
    }

    const pan = clamp(spatial.pan ?? 0, -1, 1);
    const profile = requireAudioMixProfile(this.mixProfileId);

    this.playTone(
      {
        fromHz: 260,
        toHz: 74,
        duration: 0.22,
        volume: 0.115 * profile.gains.playerHit,
        wave: 'sawtooth'
      },
      { pan, depth: 0 }
    );

    this.playTone(
      {
        fromHz: 62,
        toHz: 41,
        duration: 0.3,
        volume: 0.17 * profile.gains.playerHit,
        wave: 'sine',
        bus: 'sub',
        delay: 0.012
      },
      { depth: 0 }
    );
  }

  playWin(): void {
    if (!this.canPlay('win', 300)) {
      return;
    }

    const profile = requireAudioMixProfile(this.mixProfileId);
    this.playTone(
      {
        fromHz: 520,
        toHz: 980,
        duration: 0.18,
        volume: 0.08 * profile.gains.ui,
        wave: 'triangle'
      },
      { pan: 0, depth: 0 }
    );
  }

  playLose(): void {
    if (!this.canPlay('lose', 300)) {
      return;
    }

    const profile = requireAudioMixProfile(this.mixProfileId);
    this.playTone(
      {
        fromHz: 260,
        toHz: 82,
        duration: 0.24,
        volume: 0.09 * profile.gains.ui,
        wave: 'triangle'
      },
      { pan: 0, depth: 0 }
    );
  }

  updateTunnelMotion(state: MotionSoundState): void {
    const context = this.context;
    if (context === null || context.state !== 'running') {
      return;
    }

    this.ensureMotionLoop();
    if (
      this.motionGain === null ||
      this.motionSubGain === null ||
      this.motionFilter === null ||
      this.motionPan === null ||
      this.motionPrimaryOsc === null ||
      this.motionSecondaryOsc === null ||
      this.motionSubOsc === null
    ) {
      throw new Error('Motion loop is not initialized.');
    }

    const speed = clamp01(state.speedUnit);
    const active = state.active;
    const now = context.currentTime;
    const profile = requireAudioMixProfile(this.mixProfileId);

    const gainTarget = active ? lerp(0.018, 0.105, speed) * profile.gains.motionFx * profile.programGain : 0;
    const subGainTarget = active ? lerp(0.009, 0.05, speed) * profile.gains.motionSub * profile.programGain : 0;
    const filterTarget = active ? lerp(620, 2200, speed) : 480;
    const primaryHz = lerp(66, 128, speed);
    const secondaryHz = primaryHz * 1.95;
    const subHz = lerp(34, 58, speed);
    const pan = clamp(Math.sin(state.theta) * 0.88 * profile.stereoWidth, -1, 1);

    this.motionGain.gain.setTargetAtTime(gainTarget, now, 0.06);
    this.motionSubGain.gain.setTargetAtTime(subGainTarget, now, 0.08);
    this.motionFilter.frequency.setTargetAtTime(filterTarget, now, 0.08);
    this.motionPan.pan.setTargetAtTime(pan, now, 0.05);
    this.motionPrimaryOsc.frequency.setTargetAtTime(primaryHz, now, 0.06);
    this.motionSecondaryOsc.frequency.setTargetAtTime(secondaryHz, now, 0.06);
    this.motionSubOsc.frequency.setTargetAtTime(subHz, now, 0.08);
  }

  private ensureContext(): AudioContext {
    if (
      this.context !== null &&
      this.masterGain !== null &&
      this.fxBusGain !== null &&
      this.subBusGain !== null &&
      this.busCompressor !== null &&
      this.busLimiter !== null
    ) {
      return this.context;
    }

    if (typeof window === 'undefined' || window.AudioContext === undefined) {
      throw new Error('AudioContext support is required for RetroSfx.');
    }

    const context = new window.AudioContext();
    if (typeof context.createStereoPanner !== 'function') {
      throw new Error('StereoPannerNode support is required for RetroSfx.');
    }

    const masterGain = context.createGain();
    const fxBusGain = context.createGain();
    const subBusGain = context.createGain();
    const subFilter = context.createBiquadFilter();
    const busCompressor = context.createDynamicsCompressor();
    const busLimiter = context.createDynamicsCompressor();

    subFilter.type = 'lowpass';
    subFilter.frequency.value = 122;
    subFilter.Q.value = 0.7;

    fxBusGain.connect(busCompressor);
    subBusGain.connect(subFilter);
    subFilter.connect(busCompressor);
    busCompressor.connect(masterGain);
    masterGain.connect(busLimiter);
    busLimiter.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    this.fxBusGain = fxBusGain;
    this.subBusGain = subBusGain;
    this.busCompressor = busCompressor;
    this.busLimiter = busLimiter;
    this.applyMixProfileToNodes(requireAudioMixProfile(this.mixProfileId));
    return context;
  }

  private ensureMotionLoop(): void {
    if (
      this.motionPrimaryOsc !== null &&
      this.motionSecondaryOsc !== null &&
      this.motionSubOsc !== null &&
      this.motionGain !== null &&
      this.motionSubGain !== null &&
      this.motionFilter !== null &&
      this.motionPan !== null
    ) {
      return;
    }

    const context = this.ensureContext();
    const fxBusGain = this.fxBusGain;
    const subBusGain = this.subBusGain;
    if (fxBusGain === null || subBusGain === null) {
      throw new Error('Audio buses are not initialized.');
    }

    const primaryOsc = context.createOscillator();
    const secondaryOsc = context.createOscillator();
    const subOsc = context.createOscillator();
    const primaryGain = context.createGain();
    const secondaryGain = context.createGain();
    const motionGain = context.createGain();
    const motionSubGain = context.createGain();
    const motionFilter = context.createBiquadFilter();
    const motionPan = context.createStereoPanner();

    primaryOsc.type = 'triangle';
    secondaryOsc.type = 'sawtooth';
    subOsc.type = 'sine';

    primaryOsc.frequency.value = 70;
    secondaryOsc.frequency.value = 138;
    subOsc.frequency.value = 38;

    primaryGain.gain.value = 0.55;
    secondaryGain.gain.value = 0.2;
    motionGain.gain.value = 0;
    motionSubGain.gain.value = 0;

    motionFilter.type = 'lowpass';
    motionFilter.frequency.value = 620;
    motionFilter.Q.value = 0.85;

    motionPan.pan.value = 0;

    primaryOsc.connect(primaryGain);
    secondaryOsc.connect(secondaryGain);
    primaryGain.connect(motionFilter);
    secondaryGain.connect(motionFilter);
    motionFilter.connect(motionPan);
    motionPan.connect(motionGain);
    motionGain.connect(fxBusGain);

    subOsc.connect(motionSubGain);
    motionSubGain.connect(subBusGain);

    primaryOsc.start();
    secondaryOsc.start();
    subOsc.start();

    this.motionPrimaryOsc = primaryOsc;
    this.motionSecondaryOsc = secondaryOsc;
    this.motionSubOsc = subOsc;
    this.motionGain = motionGain;
    this.motionSubGain = motionSubGain;
    this.motionFilter = motionFilter;
    this.motionPan = motionPan;
  }

  private stopMotionLoop(): void {
    if (this.motionPrimaryOsc !== null) {
      this.motionPrimaryOsc.stop();
      this.motionPrimaryOsc.disconnect();
      this.motionPrimaryOsc = null;
    }

    if (this.motionSecondaryOsc !== null) {
      this.motionSecondaryOsc.stop();
      this.motionSecondaryOsc.disconnect();
      this.motionSecondaryOsc = null;
    }

    if (this.motionSubOsc !== null) {
      this.motionSubOsc.stop();
      this.motionSubOsc.disconnect();
      this.motionSubOsc = null;
    }

    if (this.motionGain !== null) {
      this.motionGain.disconnect();
      this.motionGain = null;
    }

    if (this.motionSubGain !== null) {
      this.motionSubGain.disconnect();
      this.motionSubGain = null;
    }

    if (this.motionFilter !== null) {
      this.motionFilter.disconnect();
      this.motionFilter = null;
    }

    if (this.motionPan !== null) {
      this.motionPan.disconnect();
      this.motionPan = null;
    }
  }

  private canPlay(key: string, minIntervalMs: number): boolean {
    if (
      this.context === null ||
      this.masterGain === null ||
      this.fxBusGain === null ||
      this.subBusGain === null ||
      this.context.state !== 'running'
    ) {
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

  private playTone(spec: ToneSpec, spatial: SpatialSpec): void {
    const context = this.context;
    const fxBusGain = this.fxBusGain;
    const subBusGain = this.subBusGain;
    if (context === null || fxBusGain === null || subBusGain === null || context.state !== 'running') {
      return;
    }

    const profile = requireAudioMixProfile(this.mixProfileId);
    const depth = clamp01(spatial.depth ?? 0);
    const pan = clamp((spatial.pan ?? 0) * profile.stereoWidth, -1, 1);
    const isSub = spec.bus === 'sub';
    const delay = spec.delay ?? 0;
    const attack = Math.max(0.001, spec.attack ?? 0.003);

    const startAt = context.currentTime + delay;
    const endAt = startAt + spec.duration;

    const oscillator = context.createOscillator();
    oscillator.type = spec.wave;
    oscillator.frequency.setValueAtTime(spec.fromHz, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, spec.toHz), endAt);

    const gain = context.createGain();
    const depthGain = isSub ? lerp(1, 0.82, depth * 0.5) : lerp(1, profile.fxDepthFloor, depth);
    const targetGain = Math.max(0.0001, spec.volume * depthGain * profile.programGain);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(targetGain, startAt + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    if (isSub) {
      oscillator.connect(gain);
      gain.connect(subBusGain);
    } else {
      const panner = context.createStereoPanner();
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lerp(14000, 2900, depth);
      filter.Q.value = 0.65;
      panner.pan.value = pan;

      oscillator.connect(gain);
      gain.connect(filter);
      filter.connect(panner);
      panner.connect(fxBusGain);
    }

    oscillator.start(startAt);
    oscillator.stop(endAt + 0.03);
  }

  private applyMixProfileToNodes(profile: AudioMixProfile): void {
    if (
      this.masterGain === null ||
      this.fxBusGain === null ||
      this.subBusGain === null ||
      this.busCompressor === null ||
      this.busLimiter === null
    ) {
      return;
    }

    this.masterGain.gain.value = profile.masterGain;
    this.fxBusGain.gain.value = profile.fxBusGain;
    this.subBusGain.gain.value = profile.subBusGain;

    this.busCompressor.threshold.value = profile.compressor.threshold;
    this.busCompressor.knee.value = profile.compressor.knee;
    this.busCompressor.ratio.value = profile.compressor.ratio;
    this.busCompressor.attack.value = profile.compressor.attack;
    this.busCompressor.release.value = profile.compressor.release;

    this.busLimiter.threshold.value = profile.limiter.threshold;
    this.busLimiter.knee.value = profile.limiter.knee;
    this.busLimiter.ratio.value = profile.limiter.ratio;
    this.busLimiter.attack.value = profile.limiter.attack;
    this.busLimiter.release.value = profile.limiter.release;
  }
}
