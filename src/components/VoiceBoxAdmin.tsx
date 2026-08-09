'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card } from '@astryxdesign/core/Card';
import { VStack, HStack, StackItem } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { FiInbox } from 'react-icons/fi';
import { useAlert } from './Alert';
import {
  getVoiceMessages,
  updateVoiceMessage,
  VoiceMessageItem,
} from '@/lib/apiService';

const STATUS_VARIANT: Record<string, 'neutral' | 'blue' | 'green' | 'yellow'> = {
  RECEIVED: 'neutral',
  IN_REVIEW: 'blue',
  RESOLVED: 'green',
  ON_HOLD: 'yellow',
};

function statusOptions(type: VoiceMessageItem['type']) {
  return [
    { value: 'RECEIVED', label: '접수' },
    { value: 'IN_REVIEW', label: '확인중' },
    { value: 'RESOLVED', label: type === 'SUGGESTION' ? '반영됨' : '조치완료' },
    { value: 'ON_HOLD', label: '보류' },
  ];
}

function statusLabel(item: VoiceMessageItem): string {
  const found = statusOptions(item.type).find((o) => o.value === item.status);
  return found ? found.label : item.status;
}

/** 관리자용 고충·건의함 — 접수 목록 열람(기관 관리자 전용)과 상태 변경·답변 */
export default function VoiceBoxAdmin() {
  const { showAlert, AlertContainer } = useAlert();

  const [filter, setFilter] = useState<'all' | 'GRIEVANCE' | 'SUGGESTION'>('all');
  const [messages, setMessages] = useState<VoiceMessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 항목별 편집 상태 (상태·답변 초안)
  const [drafts, setDrafts] = useState<Record<number, { status: string; reply: string }>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getVoiceMessages('admin', filter === 'all' ? undefined : filter);
      setMessages(Array.isArray(data) ? data : (data.messages || []));
      // 서버 최신값으로 갱신됐으므로 로컬 편집 초안은 폐기한다 (stale 값 노출 방지)
      setDrafts({});
      setExpandedId(null);
    } catch (error) {
      console.error('[VoiceBox] 목록 조회 실패:', error);
      const message = error instanceof Error && error.message ? error.message : '목록 조회에 실패했습니다.';
      showAlert({ type: 'error', title: '조회 실패', message });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const draftFor = (item: VoiceMessageItem) =>
    drafts[item.id] ?? { status: item.status, reply: item.adminReply ?? '' };

  const setDraft = (id: number, patch: Partial<{ status: string; reply: string }>) => {
    setDrafts((prev) => {
      const item = messages.find((m) => m.id === id);
      const base = prev[id] ?? { status: item?.status ?? 'RECEIVED', reply: item?.adminReply ?? '' };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  };

  const handleSave = async (item: VoiceMessageItem) => {
    const draft = draftFor(item);
    setSavingId(item.id);
    try {
      await updateVoiceMessage(item.id, { status: draft.status, adminReply: draft.reply });
      showAlert({ type: 'success', title: '저장 완료', message: '처리 내용이 저장되었습니다. 작성자가 상태와 답변을 확인할 수 있습니다.' });
      load();
    } catch (error) {
      console.error('[VoiceBox] 저장 실패:', error);
      showAlert({ type: 'error', title: '저장 실패', message: '처리 내용 저장에 실패했습니다.' });
    } finally {
      setSavingId(null);
    }
  };

  const counts = {
    grievance: messages.filter((m) => m.type === 'GRIEVANCE').length,
    suggestion: messages.filter((m) => m.type === 'SUGGESTION').length,
  };

  return (
    <VStack gap={4} height="100%">
      <VStack gap={1}>
        <Heading level={2}>고충·건의함</Heading>
        <Text type="supporting" color="secondary">직원들이 남긴 고충·신고와 건의를 확인하고 처리합니다.</Text>
      </VStack>

      <SegmentedControl value={filter} onChange={(v) => setFilter(v as typeof filter)} label="유형 필터">
        <SegmentedControlItem value="all" label={filter === 'all' ? `전체 (${messages.length})` : '전체'} />
        <SegmentedControlItem value="GRIEVANCE" label={`고충·신고${filter === 'all' ? ` (${counts.grievance})` : ''}`} />
        <SegmentedControlItem value="SUGGESTION" label={`건의${filter === 'all' ? ` (${counts.suggestion})` : ''}`} />
      </SegmentedControl>

      {isLoading ? null : messages.length === 0 ? (
        <StackItem size="fill">
          <Card variant="muted" height="100%">
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState
                icon={<Icon icon={FiInbox} size="lg" />}
                title="접수된 항목이 없습니다"
                description="직원들이 고충·건의를 남기면 이곳에 표시됩니다."
              />
            </div>
          </Card>
        </StackItem>
      ) : (
        messages.map((item) => {
          const draft = draftFor(item);
          const isExpanded = expandedId === item.id;
          return (
            <Card key={item.id}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" hAlign="between">
                  <HStack gap={2} vAlign="center">
                    <Badge
                      variant={item.type === 'GRIEVANCE' ? 'red' : 'blue'}
                      label={item.type === 'GRIEVANCE' ? '고충·신고' : '건의'}
                    />
                    <Text weight="semibold">{item.title}</Text>
                  </HStack>
                  <HStack gap={2} vAlign="center">
                    <Badge variant={STATUS_VARIANT[item.status] ?? 'neutral'} label={statusLabel(item)} />
                    <Button
                      label={isExpanded ? '접기' : '처리하기'}
                      variant="secondary"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    />
                  </HStack>
                </HStack>
                <Text type="supporting" color="secondary">
                  {item.authorName}
                  {' · '}
                  {item.createdAt ? format(new Date(item.createdAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko }) : ''}
                </Text>
                <Text type="body">{item.content}</Text>

                {isExpanded && (
                  <Card variant="muted" padding={3}>
                    <VStack gap={3}>
                      <Selector
                        label="처리 상태"
                        value={draft.status}
                        onChange={(value) => setDraft(item.id, { status: value || item.status })}
                        options={statusOptions(item.type)}
                      />
                      <TextArea
                        label="답변 (작성자에게 표시됩니다)"
                        value={draft.reply}
                        onChange={(value) => setDraft(item.id, { reply: value })}
                        placeholder="처리 결과나 답변을 남겨주세요."
                        rows={3}
                      />
                      <HStack gap={2} hAlign="end">
                        <Button
                          label={savingId === item.id ? '저장 중...' : '저장'}
                          variant="primary"
                          size="sm"
                          isLoading={savingId === item.id}
                          onClick={() => handleSave(item)}
                        />
                      </HStack>
                    </VStack>
                  </Card>
                )}
              </VStack>
            </Card>
          );
        })
      )}

      <AlertContainer />
    </VStack>
  );
}
