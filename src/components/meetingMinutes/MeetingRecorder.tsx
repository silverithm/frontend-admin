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
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      onNotification('마이크를 사용할 수 없어요. 브라우저의 마이크 권한을 허용해 주세요.', 'error');
      return;
    }
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
