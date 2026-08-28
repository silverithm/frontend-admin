'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiMic, FiPause, FiPlay, FiSquare } from 'react-icons/fi';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import {
  addMeetingMinutesAudioChunk,
  getSttToken,
  saveMeetingMinutesTranscript,
  uploadFileToServer,
} from '@/lib/apiService';

// Deepgram 실시간 전사 파라미터 — nova-3(multi)는 한국어가 무너져서 nova-2/ko로 고정 (실측 검증)
const DEEPGRAM_WSS =
  'wss://api.deepgram.com/v1/listen?model=nova-2&language=ko&punctuate=true&smart_format=true&interim_results=true';

/** 원본 보존용 조각 길이 — 브라우저가 죽어도 마지막 조각만 유실된다 */
const CHUNK_MS = 60_000;
/** 전사문 서버 저장 주기 */
const TRANSCRIPT_SAVE_MS = 30_000;
/** 말이 없을 때 Deepgram 연결이 끊기지 않게 보내는 킵얼라이브 주기 */
const KEEPALIVE_MS = 8_000;

export type RecorderPhase = 'idle' | 'recording' | 'paused' | 'stopping';

/** 마이크를 못 쓰는 구체적인 이유 — 뭉뚱그린 토스트 하나로 끝내지 않고 원인별로 다르게 안내한다 */
type MicIssueKind = 'denied' | 'not-found' | 'security' | 'in-use' | 'no-api' | 'unknown';

function classifyMicError(error: unknown): MicIssueKind {
  if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
    return 'no-api';
  }
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'denied';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'not-found';
      case 'SecurityError':
        return 'security';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'in-use';
      default:
        return 'unknown';
    }
  }
  return 'unknown';
}

/** 브라우저별로 차단 해제 방법이 달라서, 대략적인 UA로 골라 안내한다. 모르면 크롬 기준으로 보여준다 */
function detectBrowserHint(): 'safari' | 'chrome' {
  if (typeof navigator === 'undefined') return 'chrome';
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
  return isSafari ? 'safari' : 'chrome';
}

/** 실패 직후 짧게 띄우는 토스트 — 자세한 해결 방법은 아래 배너에 남는다 */
const MIC_ISSUE_TOAST: Record<MicIssueKind, string> = {
  denied: '브라우저가 마이크를 차단해 두었습니다. 아래 안내대로 허용으로 바꿔주세요.',
  'not-found': '이 기기에서 마이크를 찾지 못했습니다.',
  security: '브라우저 보안 정책이 마이크를 막고 있습니다.',
  'in-use': '다른 프로그램이 마이크를 쓰고 있는 것 같습니다.',
  'no-api': '이 브라우저는 녹음 기능을 지원하지 않습니다.',
  unknown: '마이크를 사용할 수 없어요.',
};

/** navigator.permissions로 미리 상태를 읽는다 — 없는 브라우저(Safari 등)는 조용히 'unsupported' */
async function queryMicPermissionState(): Promise<PermissionState | 'unsupported'> {
  try {
    if (!navigator.permissions?.query) return 'unsupported';
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch {
    return 'unsupported';
  }
}

interface MeetingRecorderProps {
  /** 회의록 id — 아직 없으면 녹음 시작 시 만들어 받는다 */
  minutesId: number | null;
  ensureMinutesId: () => Promise<number>;
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
  onPhaseChange?: (phase: RecorderPhase) => void;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * 회의 녹음 위젯.
 * - 마이크 스트림을 Deepgram으로 실시간 전사해 자막처럼 쌓는다 (확정문 검정, 진행중 회색)
 * - 같은 스트림을 60초 조각 파일로 잘라 즉시 서버에 올린다 (원본 보존·유실 방지)
 * - 확정 전사문은 30초마다 서버에 저장된다
 */
export default function MeetingRecorder({
  minutesId,
  ensureMinutesId,
  transcript,
  onTranscriptChange,
  onPhaseChange,
  onNotification,
}: MeetingRecorderProps) {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [interim, setInterim] = useState('');
  const [sttDown, setSttDown] = useState(false);
  /** 버튼을 누르기 전에 미리 읽어두는 권한 상태 — 'unsupported'면 Safari 등 조회 자체를 못 하는 브라우저 */
  const [micPermission, setMicPermission] = useState<PermissionState | 'unsupported'>('unsupported');
  /** getUserMedia가 실제로 실패했을 때의 구체적인 원인 — idle로 돌아가도 안내는 남겨둔다 */
  const [micIssue, setMicIssue] = useState<MicIssueKind | null>(null);

  // 마이크 권한 상태를 미리 읽어 버튼을 누르기 전에 안내한다. 지원 브라우저면 설정 변경도 실시간 반영.
  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    (async () => {
      const state = await queryMicPermissionState();
      if (cancelled) return;
      setMicPermission(state);
      if (state !== 'unsupported' && navigator.permissions?.query) {
        try {
          status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          status.onchange = () => setMicPermission(status!.state);
        } catch { /* 조회 실패 시 무시 — 버튼을 눌렀을 때 실제 결과로 판단한다 */ }
      }
    })();
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkPartsRef = useRef<BlobPart[]>([]);
  const chunkSeqRef = useRef(0);
  const chunkStartedAtRef = useRef(0);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepAliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minutesIdRef = useRef<number | null>(minutesId);
  const transcriptRef = useRef(transcript);
  const lastSavedTranscriptRef = useRef(transcript);
  const phaseRef = useRef<RecorderPhase>('idle');
  const transcriptBoxRef = useRef<HTMLDivElement | null>(null);

  minutesIdRef.current = minutesId ?? minutesIdRef.current;
  transcriptRef.current = transcript;

  const changePhase = useCallback((next: RecorderPhase) => {
    phaseRef.current = next;
    setPhase(next);
    onPhaseChange?.(next);
  }, [onPhaseChange]);

  // 새 확정 자막이 오면 아래로 따라 내려간다
  useEffect(() => {
    const box = transcriptBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [transcript, interim]);

  const clearTimers = () => {
    for (const ref of [chunkTimerRef, elapsedTimerRef, saveTimerRef, keepAliveTimerRef]) {
      if (ref.current) {
        clearInterval(ref.current);
        ref.current = null;
      }
    }
  };

  const persistTranscript = useCallback(async () => {
    const id = minutesIdRef.current;
    const text = transcriptRef.current;
    if (!id || text === lastSavedTranscriptRef.current) return;
    try {
      await saveMeetingMinutesTranscript(id, text);
      lastSavedTranscriptRef.current = text;
    } catch (error) {
      console.error('전사문 저장 실패:', error);
    }
  }, []);

  /** 60초 조각을 파일로 만들어 올린다 — 실패해도 녹음은 계속 */
  const uploadChunk = useCallback(async (parts: BlobPart[], durationSec: number) => {
    const id = minutesIdRef.current;
    if (!id || parts.length === 0) return;
    const seq = ++chunkSeqRef.current;
    try {
      const blob = new Blob(parts, { type: 'audio/webm' });
      if (blob.size === 0) return;
      const file = new File([blob], `회의녹음-${id}-${String(seq).padStart(3, '0')}.webm`, {
        type: 'audio/webm',
      });
      const uploaded = await uploadFileToServer(file, { category: 'meetings' });
      await addMeetingMinutesAudioChunk(id, {
        seq,
        filePath: uploaded.filePath,
        durationSec: Math.round(durationSec),
      });
    } catch (error) {
      console.error(`녹음 조각 업로드 실패 (seq=${seq}):`, error);
    }
  }, []);

  /** 조각 레코더를 멈추고(업로드) 필요하면 다시 시작한다 */
  const rotateChunkRecorder = useCallback((restart: boolean) => {
    const recorder = chunkRecorderRef.current;
    const stream = streamRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    const durationSec = (Date.now() - chunkStartedAtRef.current) / 1000;
    recorder.onstop = () => {
      const parts = chunkPartsRef.current;
      chunkPartsRef.current = [];
      void uploadChunk(parts, durationSec);

      if (restart && stream && phaseRef.current === 'recording') {
        const next = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32_000 });
        next.ondataavailable = (event) => {
          if (event.data.size > 0) chunkPartsRef.current.push(event.data);
        };
        chunkRecorderRef.current = next;
        chunkStartedAtRef.current = Date.now();
        next.start();
      }
    };
    recorder.stop();
  }, [uploadChunk]);

  /** Deepgram 실시간 연결 (끊기면 새 토큰으로 재접속) */
  const connectStt = useCallback(async () => {
    try {
      const { accessToken } = await getSttToken();
      const ws = new WebSocket(DEEPGRAM_WSS, ['bearer', accessToken]);
      wsRef.current = ws;

      ws.onopen = () => setSttDown(false);
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string);
          if (message.type !== 'Results') return;
          const text: string = message.channel?.alternatives?.[0]?.transcript ?? '';
          if (message.is_final) {
            setInterim('');
            if (text.trim()) {
              const current = transcriptRef.current;
              onTranscriptChange(current ? `${current}\n${text.trim()}` : text.trim());
            }
          } else {
            setInterim(text);
          }
        } catch { /* 전사 외 메시지는 무시 */ }
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (phaseRef.current === 'recording' || phaseRef.current === 'paused') {
          // 회의 중 연결이 끊겼다 — 녹음은 계속되므로 자막만 잠시 멈추고 재접속한다
          setSttDown(true);
          setTimeout(() => {
            if (phaseRef.current === 'recording' || phaseRef.current === 'paused') void connectStt();
          }, 2_000);
        }
      };
      ws.onerror = () => ws.close();
    } catch (error) {
      console.error('실시간 전사 연결 실패:', error);
      setSttDown(true);
    }
  }, [onTranscriptChange]);

  const start = useCallback(async () => {
    try {
      const id = await ensureMinutesId();
      minutesIdRef.current = id;
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '회의록을 만들지 못했습니다.', 'error');
      return;
    }

    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia unsupported');
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      const kind = classifyMicError(error);
      setMicIssue(kind);
      // 원인별로 다른 안내를 배너로 남기고(아래 렌더링), 토스트는 짧게만
      onNotification(MIC_ISSUE_TOAST[kind], 'error');
      return;
    }
    setMicIssue(null);
    streamRef.current = stream;

    await connectStt();

    // 스트리밍용 — 250ms 조각을 Deepgram으로 흘려보낸다 (첫 조각에 webm 헤더가 있어야 하므로 재시작하지 않는다)
    const streamRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32_000 });
    streamRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(event.data);
      }
    };
    streamRecorderRef.current = streamRecorder;
    streamRecorder.start(250);

    // 원본 보존용 — 60초마다 독립 파일로 잘라 올린다
    const chunkRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32_000 });
    chunkRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunkPartsRef.current.push(event.data);
    };
    chunkRecorderRef.current = chunkRecorder;
    chunkStartedAtRef.current = Date.now();
    chunkRecorder.start();

    setElapsedSec(0);
    changePhase('recording');

    chunkTimerRef.current = setInterval(() => {
      if (phaseRef.current === 'recording') rotateChunkRecorder(true);
    }, CHUNK_MS);
    elapsedTimerRef.current = setInterval(() => {
      if (phaseRef.current === 'recording') setElapsedSec((sec) => sec + 1);
    }, 1_000);
    saveTimerRef.current = setInterval(() => void persistTranscript(), TRANSCRIPT_SAVE_MS);
    keepAliveTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, KEEPALIVE_MS);
  }, [ensureMinutesId, connectStt, rotateChunkRecorder, persistTranscript, changePhase, onNotification]);

  const pause = useCallback(() => {
    streamRecorderRef.current?.pause();
    chunkRecorderRef.current?.pause();
    changePhase('paused');
  }, [changePhase]);

  const resume = useCallback(() => {
    streamRecorderRef.current?.resume();
    chunkRecorderRef.current?.resume();
    changePhase('recording');
  }, [changePhase]);

  const stop = useCallback(async () => {
    changePhase('stopping');
    clearTimers();

    try {
      streamRecorderRef.current?.stop();
    } catch { /* 이미 멈춘 경우 */ }
    streamRecorderRef.current = null;

    rotateChunkRecorder(false);
    chunkRecorderRef.current = null;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
      wsRef.current.close();
    }
    wsRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    setInterim('');
    await persistTranscript();
    changePhase('idle');
    onNotification('녹음이 끝났어요. AI 자동 정리를 눌러 회의록으로 정리하세요.', 'success');
  }, [changePhase, rotateChunkRecorder, persistTranscript, onNotification]);

  // 화면을 떠나면 녹음을 정리한다
  useEffect(() => {
    return () => {
      clearTimers();
      try { streamRecorderRef.current?.stop(); } catch { /* noop */ }
      try { chunkRecorderRef.current?.stop(); } catch { /* noop */ }
      wsRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;
  const elapsedLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="center">
        {phase === 'idle' && (
          <Button label="회의 녹음 시작" variant="secondary" icon={<FiMic />} onClick={() => void start()} />
        )}
        {phase === 'recording' && (
          <>
            <Button label="일시정지" variant="secondary" icon={<FiPause />} onClick={pause} />
            <Button label="녹음 종료" variant="destructive" icon={<FiSquare />} onClick={() => void stop()} />
          </>
        )}
        {phase === 'paused' && (
          <>
            <Button label="다시 녹음" variant="secondary" icon={<FiPlay />} onClick={resume} />
            <Button label="녹음 종료" variant="destructive" icon={<FiSquare />} onClick={() => void stop()} />
          </>
        )}
        {phase === 'stopping' && <Button label="정리 중..." variant="secondary" isLoading onClick={() => {}} />}

        {phase !== 'idle' && (
          <HStack gap={1} vAlign="center">
            {phase === 'recording' && (
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--color-error)',
                }}
              />
            )}
            <Text type="label" weight="semibold">{elapsedLabel}</Text>
            {phase === 'paused' && <Badge variant="yellow" label="일시정지" />}
          </HStack>
        )}
      </HStack>

      <MicGuidanceBanner phase={phase} micPermission={micPermission} micIssue={micIssue} />

      {sttDown && phase !== 'idle' && (
        <Banner
          status="warning"
          container="section"
          title="실시간 자막 연결이 끊겨 다시 잇는 중입니다."
          description="녹음 자체는 계속되고 있어요 — 원본은 1분 단위로 저장됩니다."
        />
      )}

      {(phase !== 'idle' || transcript) && (
        <div
          ref={transcriptBoxRef}
          style={{
            maxHeight: 220,
            overflowY: 'auto',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-inner)',
            padding: 'var(--spacing-3)',
            background: 'var(--color-background-muted)',
            whiteSpace: 'pre-wrap',
            fontSize: 'var(--font-size-sm)',
            lineHeight: 1.6,
          }}
        >
          {transcript || (phase !== 'idle' ? '말씀하시면 자막이 여기에 쌓입니다...' : '')}
          {interim && (
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {transcript ? '\n' : ''}{interim}
            </span>
          )}
        </div>
      )}
    </VStack>
  );
}

interface MicGuidanceBannerProps {
  phase: RecorderPhase;
  micPermission: PermissionState | 'unsupported';
  micIssue: MicIssueKind | null;
}

/**
 * 마이크를 못 쓰는 이유를 하나로 뭉뚱그리지 않고 상황별로 안내한다.
 * 실제 실패(micIssue)가 있으면 그걸 우선하고, 없으면 미리 읽어둔 권한 상태(micPermission)로
 * 아직 시작 전인 사용자에게 무엇이 뜰지 미리 알려준다.
 */
function MicGuidanceBanner({ phase, micPermission, micIssue }: MicGuidanceBannerProps) {
  const browser = detectBrowserHint();

  if (micIssue === 'denied' || (!micIssue && micPermission === 'denied' && phase === 'idle')) {
    return (
      <Banner
        status="warning"
        container="section"
        title="브라우저가 마이크를 차단해 두었습니다."
        description="버튼을 눌러도 허용 팝업이 뜨지 않는다면, 이미 '차단'으로 저장돼 있는 경우입니다. 아래 순서대로 직접 풀어주세요."
        defaultIsExpanded
      >
        {browser === 'safari' ? (
          <VStack gap={1}>
            <Text type="supporting">1. 주소창 왼쪽의 "aA" 아이콘(또는 Safari 메뉴 &gt; 이 웹 사이트 설정)을 누르세요.</Text>
            <Text type="supporting">2. "마이크"를 "허용"으로 바꾸세요.</Text>
            <Text type="supporting">3. 페이지를 새로고침한 뒤 다시 "회의 녹음 시작"을 눌러주세요.</Text>
          </VStack>
        ) : (
          <VStack gap={1}>
            <Text type="supporting">1. 주소창 왼쪽의 자물쇠(또는 정보 ⓘ) 아이콘을 누르세요.</Text>
            <Text type="supporting">2. "마이크" 항목을 찾아 "차단"을 "허용"으로 바꾸세요.</Text>
            <Text type="supporting">3. 페이지를 새로고침한 뒤 다시 "회의 녹음 시작"을 눌러주세요.</Text>
          </VStack>
        )}
      </Banner>
    );
  }

  if (micIssue === 'not-found') {
    return (
      <Banner
        status="error"
        container="section"
        title="이 기기에서 마이크를 찾지 못했습니다."
        description="마이크가 연결돼 있는지, 이 컴퓨터/기기에 내장 마이크가 있는지 확인한 뒤 다시 시도해주세요."
      />
    );
  }

  if (micIssue === 'security') {
    return (
      <Banner
        status="error"
        container="section"
        title="브라우저 보안 정책이 마이크를 막고 있습니다."
        description="이 문제는 직접 해결할 수 없는 설정입니다 — 관리자에게 알려주세요."
      />
    );
  }

  if (micIssue === 'in-use') {
    return (
      <Banner
        status="warning"
        container="section"
        title="다른 프로그램이 마이크를 사용 중인 것 같습니다."
        description="화상회의 앱 등 마이크를 쓰는 다른 프로그램·탭을 닫은 뒤 다시 시도해주세요."
      />
    );
  }

  if (micIssue === 'no-api') {
    return (
      <Banner
        status="error"
        container="section"
        title="이 브라우저에서는 녹음 기능을 지원하지 않습니다."
        description="최신 Chrome, Edge, Safari로 다시 시도해주세요."
      />
    );
  }

  if (micIssue === 'unknown') {
    return (
      <Banner
        status="error"
        container="section"
        title="마이크를 사용할 수 없습니다."
        description="잠시 후 다시 시도해주세요. 계속되면 관리자에게 알려주세요."
      />
    );
  }

  // 아직 실패한 적은 없지만, 처음이라 브라우저가 허용을 물어볼 거라는 걸 미리 알려준다
  if (!micIssue && micPermission === 'prompt' && phase === 'idle') {
    return (
      <Banner
        status="info"
        container="section"
        title="버튼을 누르면 마이크 허용 팝업이 뜹니다."
        description="처음 한 번만 물어봐요 — 팝업에서 '허용'을 눌러야 녹음을 시작할 수 있어요."
      />
    );
  }

  return null;
}
