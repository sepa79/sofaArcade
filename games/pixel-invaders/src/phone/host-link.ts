import { createPhoneControllerProvider, parsePhoneRelayInputMessage } from '@light80/core';

import { createSignalClient, type SignalClient, type SignalIceCandidate } from './signal-client';

export interface PhoneHostSnapshot {
  readonly status:
    | 'idle'
    | 'creating'
    | 'waiting_offer'
    | 'waiting_answer'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'error';
  readonly message: string;
  readonly sessionId: string | null;
  readonly controllerUrl: string | null;
}

const provider = createPhoneControllerProvider();
let peer: RTCPeerConnection | null = null;
let channel: RTCDataChannel | null = null;
let generation = 0;

let snapshot: PhoneHostSnapshot = {
  status: 'idle',
  message: 'not connected',
  sessionId: null,
  controllerUrl: null
};

function setSnapshot(next: PhoneHostSnapshot): void {
  snapshot = next;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function requireSignalHttpUrl(): string {
  const valueUnknown: unknown = import.meta.env['VITE_SIGNAL_HTTP_URL'];
  const value = typeof valueUnknown === 'string' ? valueUnknown.trim() : '';
  if (value.length === 0) {
    throw new Error('Missing required VITE_SIGNAL_HTTP_URL for phone link.');
  }

  return value;
}

function currentBaseUrl(): URL {
  return new URL(window.location.href);
}

function buildControllerBaseUrl(): URL {
  const url = currentBaseUrl();
  url.search = '';
  url.hash = '';
  return url;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function normalizeSignalUrlForPhone(rawSignalUrl: string, phoneBaseUrl: URL): string {
  const signalUrl = new URL(rawSignalUrl);
  if (signalUrl.protocol !== 'http:' && signalUrl.protocol !== 'https:') {
    throw new Error(`Signal URL must be http/https, got "${signalUrl.protocol}".`);
  }

  if (isLocalHostname(signalUrl.hostname)) {
    signalUrl.hostname = phoneBaseUrl.hostname;
  }

  return signalUrl.toString();
}

function normalizeCandidate(candidate: RTCIceCandidate): SignalIceCandidate {
  const init = candidate.toJSON();
  if (typeof init.candidate !== 'string' || init.candidate.length === 0) {
    throw new Error('ICE candidate string is missing.');
  }

  return {
    candidate: init.candidate,
    sdpMid: init.sdpMid ?? null,
    sdpMLineIndex: init.sdpMLineIndex ?? null,
    usernameFragment: init.usernameFragment ?? null
  };
}

function asSignalDescription(description: RTCSessionDescriptionInit): { type: 'offer' | 'answer'; sdp: string } {
  if (description.type !== 'offer' && description.type !== 'answer') {
    throw new Error(`Unsupported local description type: ${description.type}.`);
  }

  if (typeof description.sdp !== 'string' || description.sdp.length === 0) {
    throw new Error('Local description SDP is missing.');
  }

  return {
    type: description.type,
    sdp: description.sdp
  };
}

function releasePeer(): void {
  generation += 1;
  provider.setConnected(false);
  if (channel !== null) {
    channel.close();
    channel = null;
  }

  if (peer !== null) {
    peer.close();
    peer = null;
  }
}

async function pollAnswer(
  token: number,
  sessionId: string,
  activePeer: RTCPeerConnection,
  signalClient: SignalClient,
  pendingRemoteCandidates: RTCIceCandidateInit[]
): Promise<void> {
  while (token === generation && activePeer.remoteDescription === null) {
    const answer = await signalClient.getAnswer(sessionId);
    if (answer !== null) {
      await activePeer.setRemoteDescription(answer);
      for (const candidate of pendingRemoteCandidates) {
        await activePeer.addIceCandidate(candidate);
      }
      pendingRemoteCandidates.length = 0;
      setSnapshot({
        ...snapshot,
        status: 'connecting',
        message: 'phone answered, establishing link...'
      });
      return;
    }

    await delay(240);
  }
}

async function pollRemoteCandidates(
  token: number,
  sessionId: string,
  activePeer: RTCPeerConnection,
  signalClient: SignalClient,
  pendingRemoteCandidates: RTCIceCandidateInit[]
): Promise<void> {
  let after = 0;

  while (token === generation) {
    const batch = await signalClient.listCandidates(sessionId, 'host', after);
    for (const candidate of batch.candidates) {
      const candidateInit: RTCIceCandidateInit = {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        usernameFragment: candidate.usernameFragment
      };

      if (activePeer.remoteDescription === null) {
        pendingRemoteCandidates.push(candidateInit);
      } else {
        await activePeer.addIceCandidate(candidateInit);
      }
    }

    after = batch.nextAfter;
    await delay(120);
  }
}

export async function startPhoneHostSession(): Promise<PhoneHostSnapshot> {
  releasePeer();
  setSnapshot({
    status: 'creating',
    message: 'creating phone session...',
    sessionId: null,
    controllerUrl: null
  });

  const signalHttpUrl = requireSignalHttpUrl();
  const signalClient = createSignalClient(signalHttpUrl);
  const session = await signalClient.createSession();

  const activePeer = new RTCPeerConnection({ iceServers: [] });
  const activeChannel = activePeer.createDataChannel('light80-input', {
    ordered: false,
    maxRetransmits: 0
  });
  const pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  const token = generation;

  peer = activePeer;
  channel = activeChannel;

  const controllerBaseUrl = buildControllerBaseUrl();
  const phoneSignalUrl = normalizeSignalUrlForPhone(signalHttpUrl, controllerBaseUrl);
  const controllerUrl = new URL(controllerBaseUrl.toString());
  controllerUrl.searchParams.set('controller', '1');
  controllerUrl.searchParams.set('sessionId', session.sessionId);
  controllerUrl.searchParams.set('signal', phoneSignalUrl);

  setSnapshot({
    status: 'waiting_answer',
    message: 'waiting for phone to connect...',
    sessionId: session.sessionId,
    controllerUrl: controllerUrl.toString()
  });

  activeChannel.addEventListener('open', () => {
    if (token !== generation) {
      return;
    }

    provider.setConnected(true);
    setSnapshot({
      ...snapshot,
      status: 'connected',
      message: 'phone connected (p2p)'
    });
  });

  activeChannel.addEventListener('close', () => {
    if (token !== generation) {
      return;
    }

    provider.setConnected(false);
    setSnapshot({
      ...snapshot,
      status: 'disconnected',
      message: 'phone disconnected'
    });
  });

  activeChannel.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') {
      throw new Error('Phone data channel payload must be JSON string.');
    }

    const parsed = parsePhoneRelayInputMessage(JSON.parse(event.data) as unknown);
    provider.ingest(parsed);
  });

  activePeer.addEventListener('connectionstatechange', () => {
    if (token !== generation) {
      return;
    }

    if (activePeer.connectionState === 'failed') {
      setSnapshot({
        ...snapshot,
        status: 'error',
        message: 'p2p connection failed'
      });
    }
  });

  activePeer.addEventListener('icecandidate', (event) => {
    if (event.candidate === null || token !== generation) {
      return;
    }

    void signalClient.pushCandidate(session.sessionId, 'host', normalizeCandidate(event.candidate)).catch((error) => {
      if (token !== generation) {
        return;
      }

      const message = error instanceof Error ? error.message : 'unknown candidate push error';
      setSnapshot({
        ...snapshot,
        status: 'error',
        message
      });
    });
  });

  const offer = await activePeer.createOffer();
  await activePeer.setLocalDescription(offer);
  if (activePeer.localDescription === null) {
    throw new Error('Local offer missing after setLocalDescription.');
  }

  await signalClient.setOffer(session.sessionId, asSignalDescription(activePeer.localDescription));

  void pollAnswer(token, session.sessionId, activePeer, signalClient, pendingRemoteCandidates).catch((error) => {
    if (token !== generation) {
      return;
    }

    const message = error instanceof Error ? error.message : 'unknown answer poll error';
    setSnapshot({
      ...snapshot,
      status: 'error',
      message
    });
  });

  void pollRemoteCandidates(token, session.sessionId, activePeer, signalClient, pendingRemoteCandidates).catch(
    (error) => {
      if (token !== generation) {
        return;
      }

      const message = error instanceof Error ? error.message : 'unknown candidate poll error';
      setSnapshot({
        ...snapshot,
        status: 'error',
        message
      });
    }
  );

  return snapshot;
}

export function currentPhoneHostSnapshot(): PhoneHostSnapshot {
  return snapshot;
}

export function nextPhoneControllerFrame(): {
  readonly connected: boolean;
  readonly moveX: number;
  readonly fire: boolean;
  readonly start: boolean;
} {
  const frame = provider.nextFrame();
  return {
    connected: frame.connected,
    moveX: frame.moveX,
    fire: frame.fire,
    start: frame.start
  };
}
