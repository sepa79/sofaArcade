export type SyncEventType = 'beat' | 'bar' | 'onset';
export type SyncOnsetBand = 'low' | 'mid' | 'high';

export interface SyncEvent {
  readonly t: number;
  readonly type: SyncEventType;
  readonly i?: number;
  readonly strength: number;
  readonly band?: SyncOnsetBand;
}

export interface SyncCurveSample {
  readonly t: number;
  readonly low: number;
  readonly mid: number;
  readonly high: number;
  readonly rms: number;
}

export interface SyncSection {
  readonly t: number;
  readonly id: number;
}

export interface SyncTrack {
  readonly schema_version: '1.0';
  readonly track: {
    readonly source_file: string;
    readonly duration_sec: number;
    readonly sample_rate_hz: number;
  };
  readonly timing: {
    readonly bpm: number;
    readonly time_signature: string;
    readonly beat_offset_sec: number;
  };
  readonly events: ReadonlyArray<SyncEvent>;
  readonly curves: {
    readonly fps: number;
    readonly samples: ReadonlyArray<SyncCurveSample>;
  };
  readonly sections: ReadonlyArray<SyncSection>;
}

export interface SyncTrackRuntime {
  readonly track: SyncTrack;
  readonly beats: ReadonlyArray<SyncEvent>;
  readonly bars: ReadonlyArray<SyncEvent>;
  readonly onsets: ReadonlyArray<SyncEvent>;
}

export interface SyncFrame {
  readonly nowSec: number;
  readonly sectionId: number;
  readonly curve: SyncCurveSample;
  readonly events: ReadonlyArray<SyncEvent>;
  readonly beats: ReadonlyArray<SyncEvent>;
  readonly bars: ReadonlyArray<SyncEvent>;
  readonly onsets: ReadonlyArray<SyncEvent>;
}

export type SyncPlaybackState = 'playing' | 'paused' | 'seeked';
