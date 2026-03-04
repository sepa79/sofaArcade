export interface TrackHeaderMetadata {
  readonly title: string;
  readonly artist: string;
}

const FALLBACK_TITLE = 'Missing title';
const FALLBACK_ARTIST = 'Missing author';

function decodeLatin1(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function decodeUtf16Le(bytes: Uint8Array): string {
  return new TextDecoder('utf-16le').decode(bytes);
}

function decodeUtf16Be(bytes: Uint8Array): string {
  const swapped = new Uint8Array(bytes.length);
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    swapped[index] = bytes[index + 1];
    swapped[index + 1] = bytes[index];
  }
  return decodeUtf16Le(swapped);
}

function cleanText(value: string): string {
  return value.replaceAll('\u0000', '').trim();
}

function readUint32LE(bytes: Uint8Array, offset: number, source: string): number {
  if (offset + 4 > bytes.length) {
    throw new Error(`${source} is truncated near offset ${offset}.`);
  }
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function readUint32BE(bytes: Uint8Array, offset: number, source: string): number {
  if (offset + 4 > bytes.length) {
    throw new Error(`${source} is truncated near offset ${offset}.`);
  }
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function synchsafeToInt(bytes: Uint8Array, offset: number, source: string): number {
  if (offset + 4 > bytes.length) {
    throw new Error(`${source} is truncated near offset ${offset}.`);
  }
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function decodeId3TextFrame(frameBytes: Uint8Array, source: string, frameId: string): string {
  if (frameBytes.length === 0) {
    throw new Error(`${source} frame ${frameId} is empty.`);
  }
  const encoding = frameBytes[0];
  const payload = frameBytes.subarray(1);
  if (payload.length === 0) {
    throw new Error(`${source} frame ${frameId} has no payload.`);
  }

  if (encoding === 0) {
    return cleanText(decodeLatin1(payload));
  }
  if (encoding === 1) {
    if (payload.length < 2) {
      throw new Error(`${source} frame ${frameId} has invalid UTF-16 payload.`);
    }
    if (payload[0] === 0xff && payload[1] === 0xfe) {
      return cleanText(decodeUtf16Le(payload.subarray(2)));
    }
    if (payload[0] === 0xfe && payload[1] === 0xff) {
      return cleanText(decodeUtf16Be(payload.subarray(2)));
    }
    throw new Error(`${source} frame ${frameId} UTF-16 payload is missing BOM.`);
  }
  if (encoding === 2) {
    return cleanText(decodeUtf16Be(payload));
  }
  if (encoding === 3) {
    return cleanText(decodeUtf8(payload));
  }

  throw new Error(`${source} frame ${frameId} uses unsupported text encoding ${String(encoding)}.`);
}

function parseId3v2Metadata(bytes: Uint8Array, source: string): TrackHeaderMetadata {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    throw new Error(`${source} is missing ID3v2 header.`);
  }

  const majorVersion = bytes[3];
  if (majorVersion !== 3 && majorVersion !== 4) {
    throw new Error(`${source} uses unsupported ID3v2 version ${String(majorVersion)}.`);
  }

  const tagSize = synchsafeToInt(bytes, 6, source);
  const tagEnd = 10 + tagSize;
  if (tagEnd > bytes.length) {
    throw new Error(`${source} ID3v2 tag size exceeds file length.`);
  }

  let cursor = 10;
  let title: string | null = null;
  let artist: string | null = null;
  while (cursor + 10 <= tagEnd) {
    if (
      bytes[cursor] === 0 &&
      bytes[cursor + 1] === 0 &&
      bytes[cursor + 2] === 0 &&
      bytes[cursor + 3] === 0
    ) {
      break;
    }

    const frameId = String.fromCharCode(bytes[cursor], bytes[cursor + 1], bytes[cursor + 2], bytes[cursor + 3]);
    if (!/^[A-Z0-9]{4}$/.test(frameId)) {
      throw new Error(`${source} has invalid ID3 frame id "${frameId}" at offset ${cursor}.`);
    }
    const frameSize =
      majorVersion === 4 ? synchsafeToInt(bytes, cursor + 4, source) : readUint32BE(bytes, cursor + 4, source);
    const frameStart = cursor + 10;
    const frameEnd = frameStart + frameSize;
    if (frameEnd > tagEnd) {
      throw new Error(`${source} frame ${frameId} exceeds ID3v2 tag bounds.`);
    }
    const frameBytes = bytes.subarray(frameStart, frameEnd);
    if (frameId === 'TIT2') {
      title = decodeId3TextFrame(frameBytes, source, frameId);
    } else if (frameId === 'TPE1') {
      artist = decodeId3TextFrame(frameBytes, source, frameId);
    }
    cursor = frameEnd;
  }

  if (title === null) {
    title = FALLBACK_TITLE;
  }
  if (artist === null) {
    artist = FALLBACK_ARTIST;
  }
  return {
    title,
    artist
  };
}

function findVorbisCommentHeaderOffset(bytes: Uint8Array, source: string): number {
  for (let index = 0; index + 7 <= bytes.length; index += 1) {
    if (
      bytes[index] === 0x03 &&
      bytes[index + 1] === 0x76 &&
      bytes[index + 2] === 0x6f &&
      bytes[index + 3] === 0x72 &&
      bytes[index + 4] === 0x62 &&
      bytes[index + 5] === 0x69 &&
      bytes[index + 6] === 0x73
    ) {
      return index;
    }
  }
  throw new Error(`${source} is missing Vorbis comment header.`);
}

function parseVorbisCommentMetadata(bytes: Uint8Array, source: string): TrackHeaderMetadata {
  if (bytes.length < 4 || bytes[0] !== 0x4f || bytes[1] !== 0x67 || bytes[2] !== 0x67 || bytes[3] !== 0x53) {
    throw new Error(`${source} is not an Ogg stream.`);
  }

  const commentHeaderOffset = findVorbisCommentHeaderOffset(bytes, source);
  let cursor = commentHeaderOffset + 7;
  const vendorLength = readUint32LE(bytes, cursor, source);
  cursor += 4;
  const vendorEnd = cursor + vendorLength;
  if (vendorEnd > bytes.length) {
    throw new Error(`${source} Vorbis vendor string exceeds file length.`);
  }
  cursor = vendorEnd;
  const userCommentCount = readUint32LE(bytes, cursor, source);
  cursor += 4;

  let title: string | null = null;
  let artist: string | null = null;
  for (let commentIndex = 0; commentIndex < userCommentCount; commentIndex += 1) {
    const commentLength = readUint32LE(bytes, cursor, source);
    cursor += 4;
    const commentEnd = cursor + commentLength;
    if (commentEnd > bytes.length) {
      throw new Error(`${source} Vorbis comment ${commentIndex} exceeds file length.`);
    }
    const rawComment = cleanText(decodeUtf8(bytes.subarray(cursor, commentEnd)));
    const separatorIndex = rawComment.indexOf('=');
    if (separatorIndex <= 0) {
      throw new Error(`${source} Vorbis comment "${rawComment}" has invalid KEY=VALUE format.`);
    }
    const key = rawComment.slice(0, separatorIndex).toUpperCase();
    const value = cleanText(rawComment.slice(separatorIndex + 1));
    if (key === 'TITLE' && value.length > 0) {
      title = value;
    } else if (key === 'ARTIST' && value.length > 0) {
      artist = value;
    }
    cursor = commentEnd;
  }

  if (title === null) {
    title = FALLBACK_TITLE;
  }
  if (artist === null) {
    artist = FALLBACK_ARTIST;
  }
  return {
    title,
    artist
  };
}

export function readTrackHeaderMetadata(bytes: Uint8Array, source: string): TrackHeaderMetadata {
  if (bytes.length < 4) {
    throw new Error(`${source} is too short to contain audio metadata.`);
  }

  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return parseId3v2Metadata(bytes, source);
  }

  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return parseVorbisCommentMetadata(bytes, source);
  }

  throw new Error(`${source} has unsupported audio container header.`);
}
