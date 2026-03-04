import { describe, expect, it } from 'vitest';

import { readTrackHeaderMetadata } from './audio-metadata';

function synchsafe(value: number): readonly [number, number, number, number] {
  return [
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f
  ] as const;
}

function frame(id: string, text: string): Uint8Array {
  const encoder = new TextEncoder();
  const idBytes = encoder.encode(id);
  const valueBytes = encoder.encode(text);
  const payload = new Uint8Array(1 + valueBytes.length);
  payload[0] = 3;
  payload.set(valueBytes, 1);
  const size = payload.length;
  const out = new Uint8Array(10 + size);
  out.set(idBytes, 0);
  out[4] = (size >>> 24) & 0xff;
  out[5] = (size >>> 16) & 0xff;
  out[6] = (size >>> 8) & 0xff;
  out[7] = size & 0xff;
  out[8] = 0;
  out[9] = 0;
  out.set(payload, 10);
  return out;
}

function id3v23WithFrames(frames: ReadonlyArray<Uint8Array>): Uint8Array {
  const tagSize = frames.reduce((acc, item) => acc + item.length, 0);
  const out = new Uint8Array(10 + tagSize);
  out[0] = 0x49;
  out[1] = 0x44;
  out[2] = 0x33;
  out[3] = 3;
  out[4] = 0;
  out[5] = 0;
  const [b0, b1, b2, b3] = synchsafe(tagSize);
  out[6] = b0;
  out[7] = b1;
  out[8] = b2;
  out[9] = b3;
  let cursor = 10;
  for (const current of frames) {
    out.set(current, cursor);
    cursor += current.length;
  }
  return out;
}

function pushUint32LE(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function oggWithVorbisComments(comments: ReadonlyArray<string>): Uint8Array {
  const bytes: number[] = [];
  bytes.push(0x4f, 0x67, 0x67, 0x53);
  bytes.push(0x03, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73);
  const vendor = new TextEncoder().encode('light80-test');
  pushUint32LE(bytes, vendor.length);
  bytes.push(...vendor);
  pushUint32LE(bytes, comments.length);
  for (const comment of comments) {
    const data = new TextEncoder().encode(comment);
    pushUint32LE(bytes, data.length);
    bytes.push(...data);
  }
  return new Uint8Array(bytes);
}

describe('readTrackHeaderMetadata', () => {
  it('parses ID3 title and artist', () => {
    const data = id3v23WithFrames([frame('TIT2', 'Pixel Skyline'), frame('TPE1', 'Light80')]);
    const metadata = readTrackHeaderMetadata(data, 'fixture.mp3');
    expect(metadata).toEqual({
      title: 'Pixel Skyline',
      artist: 'Light80'
    });
  });

  it('throws when ID3 title frame is missing', () => {
    const data = id3v23WithFrames([frame('TPE1', 'Light80')]);
    const metadata = readTrackHeaderMetadata(data, 'missing-title.mp3');
    expect(metadata).toEqual({
      title: 'Missing title',
      artist: 'Light80'
    });
  });

  it('parses Vorbis TITLE and ARTIST comments', () => {
    const data = oggWithVorbisComments(['TITLE=Kosmiczna Podroz', 'ARTIST=MSX Crew']);
    const metadata = readTrackHeaderMetadata(data, 'fixture.ogg');
    expect(metadata).toEqual({
      title: 'Kosmiczna Podroz',
      artist: 'MSX Crew'
    });
  });

  it('throws when Vorbis TITLE comment is missing', () => {
    const data = oggWithVorbisComments(['ARTIST=MSX Crew']);
    const metadata = readTrackHeaderMetadata(data, 'missing-title.ogg');
    expect(metadata).toEqual({
      title: 'Missing title',
      artist: 'MSX Crew'
    });
  });

  it('uses both fallback labels when metadata is missing', () => {
    const data = oggWithVorbisComments(['ALBUM=Light80']);
    const metadata = readTrackHeaderMetadata(data, 'missing-both.ogg');
    expect(metadata).toEqual({
      title: 'Missing title',
      artist: 'Missing author'
    });
  });

  it('throws for unsupported header', () => {
    expect(() => readTrackHeaderMetadata(new Uint8Array([1, 2, 3, 4]), 'bad.bin')).toThrow(
      'bad.bin has unsupported audio container header.'
    );
  });
});
