'use client';

import React, { useMemo, useRef, useState } from 'react';
import { FiBell, FiCheckCircle, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Divider } from '@astryxdesign/core/Divider';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import SignatureCanvas, { SignatureCanvasHandle } from '@/components/approval/SignatureCanvas';
import { useConfirm } from '@/components/ConfirmDialog';
import {
  completeMeetingMinutes,
  deleteMeetingMinutes,
  guestSignMeetingMinutes,
  remindMeetingMinutes,
} from '@/lib/apiService';
import {
  MEETING_MINUTES_STATUS_LABEL,
  MeetingMinutes,
  MeetingMinutesAttendee,
  MinutesSectionContent,
} from '@/types/meetingMinutes';

interface MeetingMinutesDetailProps {
  minutes: MeetingMinutes;
  onChanged: (minutes: MeetingMinutes) => void;
  onEdit: () => void;
  onDeleted: () => void;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

function formatWhen(minutes: MeetingMinutes): string {
  const start = minutes.meetingStartAt;
  const date = start.slice(0, 10);
  const startTime = start.slice(11, 16);
  const endTime = minutes.meetingEndAt ? minutes.meetingEndAt.slice(11, 16) : '';
  return endTime ? `${date} ${startTime} ~ ${endTime}` : `${date} ${startTime}`;
}

function parseSections(minutes: MeetingMinutes): MinutesSectionContent[] {
  if (!minutes.sectionsJson) return [];
  try {
    const parsed = JSON.parse(minutes.sectionsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 회의록 상세 — 내용 열람 + 참석자 서명 현황.
 * 앱이 없는 참석자(외부인 등)는 여기서 "현장 서명"으로 그 자리에서 서명을 받는다.
 */
export default function MeetingMinutesDetail({
  minutes,
  onChanged,
  onEdit,
  onDeleted,
  onNotification,
}: MeetingMinutesDetailProps) {
  const { confirm, ConfirmContainer } = useConfirm();
  const [signTarget, setSignTarget] = useState<MeetingMinutesAttendee | null>(null);
  const [canvasEmpty, setCanvasEmpty] = useState(true);
  const [signSaving, setSignSaving] = useState(false);
  const [busy, setBusy] = useState<'remind' | 'complete' | 'delete' | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const canvasRef = useRef<SignatureCanvasHandle>(null);

  const sections = useMemo(() => parseSections(minutes), [minutes]);
  const attendees = minutes.attendees ?? [];
  const audioChunks = minutes.audioChunks ?? [];
  const audioMinutes = Math.round(
    audioChunks.reduce((sum, chunk) => sum + (chunk.durationSec ?? 0), 0) / 60,
  );

  const runRemind = async () => {
    setBusy('remind');
    try {
      onChanged(await remindMeetingMinutes(minutes.id));
      onNotification('아직 서명하지 않은 참석자에게 다시 알렸어요.', 'success');
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '재알림에 실패했어요.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const runComplete = async () => {
    const unsigned = attendees.filter((attendee) => !attendee.signedAt).length;
    const ok = await confirm({
      title: '회의록을 완료할까요?',
      message: unsigned > 0
        ? `아직 ${unsigned}명이 서명하지 않았습니다. 완료하면 전자결재 문서함에 지금 상태로 등록되고 더 고칠 수 없습니다.`
        : '완료하면 전자결재 문서함에 완결 문서로 등록되고 더 고칠 수 없습니다.',
      confirmText: '완료하고 문서함에 등록',
    });
    if (!ok) return;

    setBusy('complete');
    try {
      onChanged(await completeMeetingMinutes(minutes.id));
      onNotification('회의록이 완료되어 전자결재 문서함에 등록됐어요.', 'success');
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '완료 처리에 실패했어요.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const runDelete = async () => {
    const ok = await confirm({
      title: '회의록을 삭제할까요?',
      message: '녹음·전사문을 포함해 이 회의록이 삭제됩니다. 되돌릴 수 없습니다.',
      confirmText: '삭제',
      type: 'danger',
    });
    if (!ok) return;

    setBusy('delete');
    try {
      await deleteMeetingMinutes(minutes.id);
      onNotification('회의록을 삭제했어요.', 'success');
      onDeleted();
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '삭제에 실패했어요.', 'error');
      setBusy(null);
    }
  };

  const runGuestSign = async () => {
    if (!signTarget) return;
    const dataUrl = canvasRef.current?.toDataURL();
    if (!dataUrl) {
      onNotification('서명란에 직접 그려주세요.', 'error');
      return;
    }
    setSignSaving(true);
    try {
      onChanged(await guestSignMeetingMinutes(minutes.id, signTarget.id, dataUrl));
      onNotification(`${signTarget.attendeeName}님의 서명을 받았어요.`, 'success');
      setSignTarget(null);
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '서명 저장에 실패했어요.', 'error');
    } finally {
      setSignSaving(false);
    }
  };

  const statusVariant = minutes.status === 'COMPLETED' ? 'green'
    : minutes.status === 'REGISTERED' ? 'blue' : 'neutral';

  return (
    <VStack gap={4}>
      <ConfirmContainer />
      {/* 머리 정보 */}
      <VStack gap={1}>
        <HStack gap={2} vAlign="center">
          <Badge variant={statusVariant} label={MEETING_MINUTES_STATUS_LABEL[minutes.status]} />
          <Text type="supporting" color="secondary">서명 {minutes.signedCount}/{minutes.attendeeCount}</Text>
        </HStack>
        <Text type="large" weight="semibold">{minutes.title}</Text>
        <Text type="supporting" color="secondary">
          {formatWhen(minutes)}{minutes.location ? ` · ${minutes.location}` : ''} · 작성 {minutes.authorName}
        </Text>
        {audioChunks.length > 0 && (
          <Text type="supporting" color="secondary">
            녹음 {audioChunks.length}조각{audioMinutes > 0 ? ` · 약 ${audioMinutes}분` : ''} 보관됨
          </Text>
        )}
      </VStack>

      {minutes.status === 'COMPLETED' && (
        <Banner
          status="success"
          container="section"
          title="전자결재 문서함에 등록된 회의록입니다."
          description="전자결재 탭에서 문서로 열람·검색·출력할 수 있습니다."
        />
      )}

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

      {/* 첨부 */}
      {(minutes.attachments?.length ?? 0) > 0 && (
        <VStack gap={1}>
          <Text type="label" weight="medium">자료 첨부</Text>
          {minutes.attachments!.map((attachment) => (
            <Text key={attachment.id} type="supporting" color="secondary">{attachment.fileName}</Text>
          ))}
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
                    {attendee.attendeeType === 'EXTERNAL' && <Badge variant="yellow" label="외부" />}
                  </HStack>
                  <Text type="supporting" color={attendee.signedAt ? 'accent' : 'secondary'}>
                    {attendee.signedAt
                      ? `서명 완료 · ${attendee.signedAt.slice(5, 16).replace('T', ' ')}`
                      : minutes.status === 'REGISTERED' ? '서명 대기' : '미서명'}
                  </Text>
                </VStack>
                {attendee.signedAt && attendee.signatureUrl ? (
                  // 서명 이미지는 투명 PNG — 밝은 바탕 위에 그대로 얹는다
                  <img
                    src={attendee.signatureUrl}
                    alt={`${attendee.attendeeName} 서명`}
                    style={{ height: 36, maxWidth: 96, objectFit: 'contain' }}
                  />
                ) : minutes.status === 'REGISTERED' ? (
                  <Button
                    label="현장 서명"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setCanvasEmpty(true);
                      setSignTarget(attendee);
                    }}
                  />
                ) : null}
              </HStack>
            </Card>
          ))}
        </Grid>
        {minutes.status === 'REGISTERED' && (
          <Banner
            status="info"
            container="card"
            title="참석자는 어디서 서명하나요?"
            description="직원은 케어브이 앱 알림을 받고 앱의 '회의록'에서 서명하거나, 웹에서는 좌측 '편의기능 > 회의록'에서 서명할 수 있습니다. 앱·웹이 없는 참석자(외부인 등)는 이 화면의 '현장 서명'으로 그 자리에서 받아주세요."
          />
        )}
      </VStack>

      {/* 동작 */}
      {minutes.status !== 'COMPLETED' && (
        <>
          <Divider />
          <HStack gap={2} hAlign="between">
            <HStack gap={2}>
              <Button
                label="삭제"
                variant="destructive"
                icon={<FiTrash2 />}
                isLoading={busy === 'delete'}
                onClick={() => void runDelete()}
              />
            </HStack>
            <HStack gap={2}>
              <Button label="수정" variant="secondary" icon={<FiEdit2 />} onClick={onEdit} />
              {minutes.status === 'REGISTERED' && (
                <>
                  <Button
                    label="미서명자 재알림"
                    variant="secondary"
                    icon={<FiBell />}
                    isLoading={busy === 'remind'}
                    onClick={() => void runRemind()}
                  />
                  <Button
                    label="완료하고 문서함에 등록"
                    variant="primary"
                    icon={<FiCheckCircle />}
                    isLoading={busy === 'complete'}
                    onClick={() => void runComplete()}
                  />
                </>
              )}
            </HStack>
          </HStack>
        </>
      )}

      {/* 현장 서명 다이얼로그 */}
      <Dialog
        isOpen={signTarget !== null}
        onOpenChange={(open) => { if (!open) setSignTarget(null); }}
        purpose="form"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title={`${signTarget?.attendeeName ?? ''}님 현장 서명`}
              onOpenChange={(open) => { if (!open) setSignTarget(null); }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={3}>
                <Text type="supporting" color="secondary">
                  회의 내용을 확인하셨다면 아래에 서명해 주세요.
                </Text>
                <SignatureCanvas ref={canvasRef} height={180} onChange={(empty) => setCanvasEmpty(empty)} />
                <Button
                  label="다시 그리기"
                  variant="ghost"
                  size="sm"
                  onClick={() => canvasRef.current?.clear()}
                />
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="취소" variant="secondary" onClick={() => setSignTarget(null)} />
                <Button
                  label="서명 저장"
                  variant="primary"
                  isDisabled={canvasEmpty}
                  isLoading={signSaving}
                  onClick={() => void runGuestSign()}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </VStack>
  );
}
