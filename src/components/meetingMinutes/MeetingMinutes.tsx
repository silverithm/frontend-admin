'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FiFileText, FiPlus, FiSettings } from 'react-icons/fi';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Loading } from '@/components/Loading';
import MeetingMinutesDetail from '@/components/meetingMinutes/MeetingMinutesDetail';
import MeetingMinutesForm from '@/components/meetingMinutes/MeetingMinutesForm';
import MeetingMinutesTemplateSettings from '@/components/meetingMinutes/MeetingMinutesTemplateSettings';
import {
  getMeetingMinutesById,
  getMeetingMinutesList,
  getMeetingMinutesTemplate,
} from '@/lib/apiService';
import {
  MEETING_MINUTES_STATUS_LABEL,
  MeetingMinutes as MeetingMinutesModel,
  MinutesSection,
} from '@/types/meetingMinutes';

interface MeetingMinutesProps {
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

type DialogMode =
  | { kind: 'closed' }
  | { kind: 'form'; initial: MeetingMinutesModel | null }
  | { kind: 'detail'; minutes: MeetingMinutesModel }
  | { kind: 'template' };

function formatWhen(minutes: MeetingMinutesModel): string {
  const date = minutes.meetingStartAt.slice(0, 10);
  const time = minutes.meetingStartAt.slice(11, 16);
  return `${date} ${time}`;
}

/**
 * 편의기능 > 회의록.
 * 회의를 녹음·기록하고 AI로 정리한 뒤, 참석자들에게 알림을 보내 서명을 모은다.
 * 완료된 회의록은 전자결재 문서함에 완결 문서로 들어간다.
 */
export default function MeetingMinutes({ onNotification }: MeetingMinutesProps) {
  const [items, setItems] = useState<MeetingMinutesModel[]>([]);
  const [sections, setSections] = useState<MinutesSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogMode>({ kind: 'closed' });

  const reload = useCallback(async () => {
    try {
      const [list, template] = await Promise.all([
        getMeetingMinutesList(),
        getMeetingMinutesTemplate(),
      ]);
      setItems(list);
      setSections(template);
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

  const openDetail = async (id: number) => {
    try {
      const minutes = await getMeetingMinutesById(id);
      setDialog({ kind: 'detail', minutes });
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '회의록을 열지 못했어요.', 'error');
    }
  };

  const closeAndReload = () => {
    setDialog({ kind: 'closed' });
    void reload();
  };

  if (isLoading) {
    return <Loading size="inline" label="회의록을 불러오는 중..." />;
  }

  return (
    <VStack gap={4}>
      {/* 머리글 */}
      <HStack gap={2} hAlign="between" vAlign="center">
        <VStack gap={0.5}>
          <Text type="large" weight="semibold">회의록</Text>
          <Text type="supporting" color="secondary">
            녹음하며 기록하고, AI로 정리하고, 참석자 서명까지 한 번에.
          </Text>
        </VStack>
        <HStack gap={2}>
          <Button
            label="양식 설정"
            variant="ghost"
            icon={<FiSettings />}
            onClick={() => setDialog({ kind: 'template' })}
          />
          <Button
            label="회의록 작성"
            variant="primary"
            icon={<FiPlus />}
            onClick={() => setDialog({ kind: 'form', initial: null })}
          />
        </HStack>
      </HStack>

      {/* 목록 */}
      {items.length === 0 ? (
        <EmptyState
          icon={<Icon icon={FiFileText} size="lg" color="tertiary" />}
          title="아직 회의록이 없습니다"
          description="회의록 작성을 눌러 첫 회의를 기록해 보세요. 녹음하면 실시간 자막이 쌓이고, AI가 섹션별로 정리해 줍니다."
        />
      ) : (
        <VStack gap={2}>
          {items.map((minutes) => (
            <ClickableCard
              key={minutes.id}
              label={`${minutes.title} 회의록 열기`}
              onClick={() => void openDetail(minutes.id)}
              padding={4}
            >
              <HStack gap={3} vAlign="center" hAlign="between">
                <VStack gap={0.5}>
                  <HStack gap={2} vAlign="center">
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
          ))}
        </VStack>
      )}

      {/* 작성/수정 */}
      <Dialog
        isOpen={dialog.kind === 'form'}
        onOpenChange={(open) => { if (!open) closeAndReload(); }}
        purpose="form"
        width={720}
      >
        <Layout
          header={
            <DialogHeader
              title={dialog.kind === 'form' && dialog.initial ? '회의록 수정' : '회의록 작성'}
              onOpenChange={(open) => { if (!open) closeAndReload(); }}
            />
          }
          content={
            <LayoutContent>
              {dialog.kind === 'form' && (
                <MeetingMinutesForm
                  templateSections={sections}
                  initial={dialog.initial}
                  onDone={() => closeAndReload()}
                  onNotification={onNotification}
                />
              )}
            </LayoutContent>
          }
        />
      </Dialog>

      {/* 상세 */}
      <Dialog
        isOpen={dialog.kind === 'detail'}
        onOpenChange={(open) => { if (!open) closeAndReload(); }}
        purpose="info"
        width={720}
      >
        <Layout
          header={
            <DialogHeader
              title="회의록"
              onOpenChange={(open) => { if (!open) closeAndReload(); }}
            />
          }
          content={
            <LayoutContent>
              {dialog.kind === 'detail' && (
                <MeetingMinutesDetail
                  minutes={dialog.minutes}
                  onChanged={(minutes) => setDialog({ kind: 'detail', minutes })}
                  onEdit={() => setDialog({ kind: 'form', initial: dialog.minutes })}
                  onDeleted={closeAndReload}
                  onNotification={onNotification}
                />
              )}
            </LayoutContent>
          }
        />
      </Dialog>

      {/* 양식 설정 */}
      <Dialog
        isOpen={dialog.kind === 'template'}
        onOpenChange={(open) => { if (!open) setDialog({ kind: 'closed' }); }}
        purpose="form"
        width={480}
      >
        <Layout
          header={
            <DialogHeader
              title="회의록 양식 설정"
              onOpenChange={(open) => { if (!open) setDialog({ kind: 'closed' }); }}
            />
          }
          content={
            <LayoutContent>
              {dialog.kind === 'template' && (
                <MeetingMinutesTemplateSettings
                  sections={sections}
                  onSaved={(next) => {
                    setSections(next);
                    setDialog({ kind: 'closed' });
                  }}
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
