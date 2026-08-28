'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiFileText } from 'react-icons/fi';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Text } from '@astryxdesign/core/Text';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Loading } from '@/components/Loading';
import SignatureCanvas, { SignatureCanvasHandle } from '@/components/approval/SignatureCanvas';
import {
  getMeetingMinutesById,
  getMeetingMinutesList,
  getMySignature,
  signMeetingMinutes,
} from '@/lib/apiService';
import {
  MEETING_MINUTES_STATUS_LABEL,
  MeetingMinutes as MeetingMinutesModel,
  MinutesSectionContent,
} from '@/types/meetingMinutes';

interface EmployeeMeetingMinutesProps {
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

type SignatureMode = 'registered' | 'draw';

function formatWhen(minutes: MeetingMinutesModel): string {
  const start = minutes.meetingStartAt;
  const date = start.slice(0, 10);
  const startTime = start.slice(11, 16);
  const endTime = minutes.meetingEndAt ? minutes.meetingEndAt.slice(11, 16) : '';
  return endTime ? `${date} ${startTime} ~ ${endTime}` : `${date} ${startTime}`;
}

function parseSections(minutes: MeetingMinutesModel): MinutesSectionContent[] {
  if (!minutes.sectionsJson) return [];
  try {
    const parsed = JSON.parse(minutes.sectionsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 내가 서명해야 하는 회의록인지 — 서명 수집 중 + 참석자로 지정됨 + 아직 미서명 */
function needsMySignature(minutes: MeetingMinutesModel): boolean {
  return minutes.status === 'REGISTERED' && minutes.myAttendeeId != null && !minutes.mySignedAt;
}

/**
 * 직원용 회의록 — 열람 + 본인 서명.
 * 관리자용 화면(작성/녹음/AI 정리/양식 설정)은 다루지 않는다. 내가 참석자로 지정된
 * 회의록만 보이며(서버가 필터링), 서명 대기가 맨 위로 온다.
 */
export default function EmployeeMeetingMinutes({ onNotification }: EmployeeMeetingMinutesProps) {
  const [items, setItems] = useState<MeetingMinutesModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<MeetingMinutesModel | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const reload = useCallback(async () => {
    try {
      const list = await getMeetingMinutesList();
      setItems(list);
    } catch (error) {
      console.error('회의록 목록 로드 실패:', error);
      onNotification('회의록을 불러오지 못했어요. 잠시 후 새로고침해 주세요.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onNotification]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aWaiting = needsMySignature(a) ? 1 : 0;
      const bWaiting = needsMySignature(b) ? 1 : 0;
      if (aWaiting !== bWaiting) return bWaiting - aWaiting;
      return b.meetingStartAt.localeCompare(a.meetingStartAt);
    });
  }, [items]);

  const openDetail = async (id: number) => {
    setIsDetailLoading(true);
    try {
      const minutes = await getMeetingMinutesById(id);
      setDetail(minutes);
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '회의록을 열지 못했어요.', 'error');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    void reload();
  };

  if (isLoading) {
    return <Loading size="inline" label="회의록을 불러오는 중..." />;
  }

  return (
    <VStack gap={4}>
      {/* 머리글 */}
      <VStack gap={0.5}>
        <Text type="large" weight="semibold">회의록</Text>
        <Text type="supporting" color="secondary">
          내가 참석한 회의의 기록을 확인하고, 서명이 필요한 회의록에 서명하세요.
        </Text>
      </VStack>

      {/* 목록 */}
      {sortedItems.length === 0 ? (
        <EmptyState
          icon={<Icon icon={FiFileText} size="lg" color="tertiary" />}
          title="확인할 회의록이 없습니다"
          description="참석자로 지정된 회의록이 등록되면 여기에 나타납니다."
        />
      ) : (
        <VStack gap={2}>
          {sortedItems.map((minutes) => {
            const waiting = needsMySignature(minutes);
            return (
              <ClickableCard
                key={minutes.id}
                label={`${minutes.title} 회의록 열기`}
                onClick={() => void openDetail(minutes.id)}
                padding={4}
              >
                <HStack gap={3} vAlign="center" hAlign="between">
                  <VStack gap={0.5}>
                    <HStack gap={2} vAlign="center">
                      {waiting && <Badge variant="warning" label="서명 필요" />}
                      <Badge
                        variant={minutes.status === 'COMPLETED' ? 'green'
                          : minutes.status === 'REGISTERED' ? 'blue' : 'neutral'}
                        label={MEETING_MINUTES_STATUS_LABEL[minutes.status]}
                      />
                      <Text type="body" weight="medium">{minutes.title}</Text>
                    </HStack>
                    <Text type="supporting" color="secondary">
                      {formatWhen(minutes)}{minutes.location ? ` · ${minutes.location}` : ''} · {minutes.authorName}
                    </Text>
                  </VStack>
                  <Badge
                    variant={minutes.attendeeCount > 0 && minutes.signedCount === minutes.attendeeCount
                      ? 'green' : 'neutral'}
                    label={`서명 ${minutes.signedCount}/${minutes.attendeeCount}`}
                  />
                </HStack>
              </ClickableCard>
            );
          })}
        </VStack>
      )}

      {/* 상세 + 서명 */}
      <Dialog
        isOpen={detail !== null || isDetailLoading}
        onOpenChange={(open) => { if (!open) closeDetail(); }}
        purpose="info"
        width={640}
      >
        <Layout
          header={<DialogHeader title="회의록" onOpenChange={(open) => { if (!open) closeDetail(); }} />}
          content={
            <LayoutContent>
              {isDetailLoading || !detail ? (
                <Loading size="inline" label="회의록을 불러오는 중..." />
              ) : (
                <EmployeeMeetingMinutesDetail
                  minutes={detail}
                  onSigned={(next) => setDetail(next)}
                  onNotification={onNotification}
                />
              )}
            </LayoutContent>
          }
        />
      </Dialog>
    </VStack>
  );
}

interface DetailProps {
  minutes: MeetingMinutesModel;
  onSigned: (minutes: MeetingMinutesModel) => void;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

function EmployeeMeetingMinutesDetail({ minutes, onSigned, onNotification }: DetailProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);

  const sections = useMemo(() => parseSections(minutes), [minutes]);
  const attendees = minutes.attendees ?? [];
  const waiting = needsMySignature(minutes);

  return (
    <VStack gap={4}>
      {/* 머리 정보 */}
      <VStack gap={1}>
        <HStack gap={2} vAlign="center">
          <Badge
            variant={minutes.status === 'COMPLETED' ? 'green' : minutes.status === 'REGISTERED' ? 'blue' : 'neutral'}
            label={MEETING_MINUTES_STATUS_LABEL[minutes.status]}
          />
          <Text type="supporting" color="secondary">서명 {minutes.signedCount}/{minutes.attendeeCount}</Text>
        </HStack>
        <Text type="large" weight="semibold">{minutes.title}</Text>
        <Text type="supporting" color="secondary">
          {formatWhen(minutes)}{minutes.location ? ` · ${minutes.location}` : ''} · 작성 {minutes.authorName}
        </Text>
      </VStack>

      {/* 서명 안내/버튼 */}
      {waiting ? (
        <Banner
          status="warning"
          container="section"
          title="이 회의록에 서명이 필요합니다."
          description="회의 내용을 확인한 뒤 아래 버튼으로 서명하세요."
          endContent={<Button label="서명하기" variant="primary" onClick={() => setSignDialogOpen(true)} />}
        />
      ) : minutes.myAttendeeId != null && minutes.mySignedAt ? (
        <Banner
          status="success"
          container="section"
          title="이미 서명했습니다."
          description={`서명 시각 · ${minutes.mySignedAt.slice(0, 16).replace('T', ' ')}`}
        />
      ) : minutes.status === 'COMPLETED' ? (
        <Banner
          status="success"
          container="section"
          title="전자결재 문서함에 등록된 회의록입니다."
          description="전자결재 탭에서 문서로 열람할 수 있습니다."
        />
      ) : null}

      <Divider />

      {/* 회의 내용 (섹션) */}
      {sections.filter((section) => section.content?.trim()).length === 0 ? (
        <Text type="supporting" color="secondary">아직 정리된 내용이 없습니다.</Text>
      ) : (
        <VStack gap={3}>
          {sections.map((section) =>
            section.content?.trim() ? (
              <VStack key={section.key} gap={1}>
                <Text type="label" weight="semibold" color="accent">[{section.label}]</Text>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  <Text type="body">{section.content}</Text>
                </div>
              </VStack>
            ) : null,
          )}
        </VStack>
      )}

      {/* 전사문/메모 원문 */}
      {(minutes.transcript || minutes.rawNotes) && (
        <VStack gap={2}>
          <Button
            label={showTranscript ? '원문 접기' : '원문 보기 (메모·녹음 자막)'}
            variant="ghost"
            size="sm"
            onClick={() => setShowTranscript((prev) => !prev)}
          />
          {showTranscript && (
            <div
              style={{
                maxHeight: 260,
                overflowY: 'auto',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-inner)',
                padding: 'var(--spacing-3)',
                background: 'var(--color-background-muted)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {minutes.rawNotes && (
                <Text type="supporting">{`[회의 메모]\n${minutes.rawNotes}`}</Text>
              )}
              {minutes.rawNotes && minutes.transcript && <Divider />}
              {minutes.transcript && (
                <Text type="supporting">{`[녹음 자막]\n${minutes.transcript}`}</Text>
              )}
            </div>
          )}
        </VStack>
      )}

      <Divider />

      {/* 참석자 서명 현황 */}
      <VStack gap={2}>
        <Text type="label" weight="medium">참석자 서명 ({minutes.signedCount}/{minutes.attendeeCount})</Text>
        <Grid columns={2} gap={2}>
          {attendees.map((attendee) => (
            <Card key={attendee.id} variant={attendee.signedAt ? 'default' : 'muted'} padding={3}>
              <HStack gap={2} vAlign="center" hAlign="between">
                <VStack gap={0.5}>
                  <HStack gap={1} vAlign="center">
                    <Text type="body" weight="medium">{attendee.attendeeName}</Text>
                    {attendee.id === minutes.myAttendeeId && <Badge variant="teal" label="나" />}
                  </HStack>
                  <Text type="supporting" color={attendee.signedAt ? 'accent' : 'secondary'}>
                    {attendee.signedAt
                      ? `서명 완료 · ${attendee.signedAt.slice(5, 16).replace('T', ' ')}`
                      : minutes.status === 'REGISTERED' ? '서명 대기' : '미서명'}
                  </Text>
                </VStack>
                {attendee.signedAt && attendee.signatureUrl && (
                  // 서명 이미지는 투명 PNG — 밝은 바탕 위에 그대로 얹는다
                  <img
                    src={attendee.signatureUrl}
                    alt={`${attendee.attendeeName} 서명`}
                    style={{ height: 36, maxWidth: 96, objectFit: 'contain' }}
                  />
                )}
              </HStack>
            </Card>
          ))}
        </Grid>
      </VStack>

      {/* 서명 다이얼로그 */}
      <SignDialog
        isOpen={signDialogOpen}
        minutesId={minutes.id}
        attendeeId={minutes.myAttendeeId}
        onClose={() => setSignDialogOpen(false)}
        onSigned={(next) => {
          setSignDialogOpen(false);
          onSigned(next);
        }}
        onNotification={onNotification}
      />
    </VStack>
  );
}

interface SignDialogProps {
  isOpen: boolean;
  minutesId: number;
  attendeeId: number | null;
  onClose: () => void;
  onSigned: (minutes: MeetingMinutesModel) => void;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * 회의록 서명 다이얼로그. 결재 승인의 SignatureConfirmDialog와 같은 계약 —
 * 등록된 서명이 있으면 미리보기 후 그대로 날인, 없거나 원하면 즉석에서 그린다.
 */
function SignDialog({ isOpen, minutesId, attendeeId, onClose, onSigned, onNotification }: SignDialogProps) {
  const canvasRef = useRef<SignatureCanvasHandle>(null);
  const [mode, setMode] = useState<SignatureMode>('registered');
  const [registeredUrl, setRegisteredUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canvasEmpty, setCanvasEmpty] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const response = await getMySignature();
        if (cancelled) return;
        const url = response?.signatureUrl ?? null;
        setRegisteredUrl(url);
        setMode(url ? 'registered' : 'draw');
      } catch (error) {
        console.error('등록 서명 조회 실패:', error);
        if (!cancelled) {
          setRegisteredUrl(null);
          setMode('draw');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!attendeeId) {
      onNotification('참석자 정보를 찾을 수 없어요. 새로고침 후 다시 시도해주세요.', 'error');
      return;
    }
    let signatureBase64: string | undefined;
    if (mode === 'draw') {
      const dataUrl = canvasRef.current?.toDataURL();
      if (!dataUrl) return;
      signatureBase64 = dataUrl;
    }
    setIsSaving(true);
    try {
      const next = await signMeetingMinutes(minutesId, attendeeId, signatureBase64);
      onNotification('회의록에 서명했어요.', 'success');
      onSigned(next);
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '서명 저장에 실패했어요.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDisabled =
    isSaving ||
    isLoading ||
    (mode === 'draw' && canvasEmpty) ||
    (mode === 'registered' && !registeredUrl);

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} purpose="form" width={420}>
      <Layout
        header={<DialogHeader title="회의록 서명" onOpenChange={(open) => { if (!open) onClose(); }} />}
        content={
          <LayoutContent>
            {isLoading ? (
              <Loading size="inline" label="서명을 불러오는 중..." />
            ) : (
              <VStack gap={3}>
                <Text type="supporting" color="secondary">
                  서명하면 이 회의록의 내용을 확인했다는 뜻으로 기록됩니다.
                </Text>

                {registeredUrl ? (
                  <SegmentedControl
                    value={mode}
                    onChange={(value) => setMode(value as SignatureMode)}
                    label="서명 방식"
                  >
                    <SegmentedControlItem value="registered" label="등록된 서명 사용" />
                    <SegmentedControlItem value="draw" label="직접 그리기" />
                  </SegmentedControl>
                ) : (
                  <Banner
                    status="info"
                    title="등록된 서명이 없습니다."
                    description="이번에는 직접 그려 서명하세요. 서명을 등록해두면 다음부터 바로 서명할 수 있습니다."
                  />
                )}

                {mode === 'registered' && registeredUrl ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 120,
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-inner)',
                      background: 'var(--color-on-accent)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={registeredUrl}
                      alt="등록된 서명"
                      style={{ maxWidth: '70%', maxHeight: '85%', objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <SignatureCanvas ref={canvasRef} width={340} onChange={(isEmpty) => setCanvasEmpty(isEmpty)} />
                )}
              </VStack>
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="취소" variant="ghost" isDisabled={isSaving} onClick={onClose} />
              <Button
                label={isSaving ? '서명 중...' : '서명하기'}
                variant="primary"
                isLoading={isSaving}
                isDisabled={confirmDisabled}
                onClick={() => void handleConfirm()}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
