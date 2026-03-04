import { eventsInRange, sampleCurve, sectionAt } from './query';
import type { SyncFrame, SyncPlaybackState, SyncTrackRuntime } from './types';

const TIME_EPSILON_SEC = 0.000_001;

function emptyFrame(track: SyncTrackRuntime, nowSec: number): SyncFrame {
  return {
    nowSec,
    sectionId: sectionAt(track, nowSec),
    curve: sampleCurve(track, nowSec),
    events: [],
    beats: [],
    bars: [],
    onsets: []
  };
}

export class SyncClock {
  private lastTimeSec: number | null = null;

  constructor(private readonly track: SyncTrackRuntime) {}

  reset(nowSec: number): SyncFrame {
    const frame = emptyFrame(this.track, nowSec);
    this.lastTimeSec = frame.nowSec;
    return frame;
  }

  tick(nowSec: number, playbackState: SyncPlaybackState): SyncFrame {
    if (playbackState !== 'playing' && playbackState !== 'paused' && playbackState !== 'seeked') {
      throw new Error(`Unsupported playbackState: ${String(playbackState)}.`);
    }

    if (this.lastTimeSec === null || playbackState === 'seeked' || playbackState === 'paused') {
      return this.reset(nowSec);
    }

    const currentCurve = sampleCurve(this.track, nowSec);
    const currentSectionId = sectionAt(this.track, nowSec);
    const fromSec = this.lastTimeSec;

    let events: ReadonlyArray<SyncFrame['events'][number]>;
    let beats: ReadonlyArray<SyncFrame['beats'][number]>;
    let bars: ReadonlyArray<SyncFrame['bars'][number]>;
    let onsets: ReadonlyArray<SyncFrame['onsets'][number]>;

    if (nowSec + TIME_EPSILON_SEC < fromSec) {
      const durationSec = this.track.track.track.duration_sec;
      events = eventsInRange(this.track, fromSec, durationSec).concat(eventsInRange(this.track, 0, nowSec));
      beats = eventsInRange(this.track, fromSec, durationSec, 'beat').concat(
        eventsInRange(this.track, 0, nowSec, 'beat')
      );
      bars = eventsInRange(this.track, fromSec, durationSec, 'bar').concat(
        eventsInRange(this.track, 0, nowSec, 'bar')
      );
      onsets = eventsInRange(this.track, fromSec, durationSec, 'onset').concat(
        eventsInRange(this.track, 0, nowSec, 'onset')
      );
    } else {
      events = eventsInRange(this.track, fromSec, nowSec);
      beats = eventsInRange(this.track, fromSec, nowSec, 'beat');
      bars = eventsInRange(this.track, fromSec, nowSec, 'bar');
      onsets = eventsInRange(this.track, fromSec, nowSec, 'onset');
    }

    this.lastTimeSec = nowSec;

    return {
      nowSec,
      sectionId: currentSectionId,
      curve: currentCurve,
      events,
      beats,
      bars,
      onsets
    };
  }
}
