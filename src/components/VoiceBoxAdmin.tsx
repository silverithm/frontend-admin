'use client';

import { memo, useCallback, useEffect, useState } from 'react';
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
import { Divider } from '@astryxdesign/core/Divider';
import { Spinner } from '@astryxdesign/core/Spinner';
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

interface VoiceBoxItemProps {
  item: VoiceMessageItem;
  isExpanded: boolean;
  draftStatus: string;
  draftReply: string;
  isSaving: boolean;
  onToggleExpand: (id: number) => void;
  onDraftChange: (id: number, next: { status: string; reply: string }) => void;
  onSave: (id: number, status: string, reply: string) => void;
}

// 항목 하나. 다른 항목 편집(drafts 갱신)으로 전체 리스트가 리렌더되지 않도록 memo로 격리한다.
// draftStatus/draftReply를 객체가 아닌 원시값 prop으로 받아야 얕은 비교가 실제로 걸러진다.
function VoiceBoxItemComponent({
  item,
  isExpanded,
  draftStatus,
  draftReply,
  isSaving,
  onToggleExpand,
  onDraftChange,
  onSave,
}: VoiceBoxItemProps) {
  return (
    <Card>
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
              aria-expanded={isExpanded}
              onClick={() => onToggleExpand(item.id)}
            />
          </HStack>
        </HStack>
        <Text type="supporting" color="secondary">
          {item.authorName}
          {' · '}
          {item.createdAt ? format(new Date(item.createdAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko }) : ''}
        </Text>
        {/* 띄어쓰기 없는 긴 토큰(URL 등)도 카드 밖으로 넘치지 않게 줄바꿈 보호 */}
        <Text type="body" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {item.content}
        </Text>

        {isExpanded && (
          <>
            {/* Card 중첩 금지 — 처리 패널은 안쪽 Card 대신 Divider로만 구분 */}
            <Divider />
            <VStack gap={3}>
              <Selector
                label="처리 상태"
                value={draftStatus}
                onChange={(value) => onDraftChange(item.id, { status: value || draftStatus, reply: draftReply })}
                options={statusOptions(item.type)}
              />
              <TextArea
                label="답변 (작성자에게 표시됩니다)"
                value={draftReply}
                onChange={(value) => onDraftChange(item.id, { status: draftStatus, reply: value })}
                placeholder="처리 결과나 답변을 남겨주세요."
                rows={3}
              />
              <HStack gap={2} hAlign="end">
                <Button
                  label={isSaving ? '저장 중...' : '저장'}
                  variant="primary"
                  size="sm"
                  isLoading={isSaving}
                  onClick={() => onSave(item.id, draftStatus, draftReply)}
                />
              </HStack>
            </VStack>
          </>
        )}
      </VStack>
    </Card>
  );
}

const VoiceBoxItem = memo(VoiceBoxItemComponent);

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

  // 항목 컴포넌트에 넘기는 콜백은 참조가 고정돼야 memo가 실제로 리렌더를 막는다.
  // 자식이 이미 현재 draft 값(status/reply)을 함께 넘기므로 여기선 messages를 조회할 필요가 없다.
  const handleToggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleDraftChange = useCallback((id: number, next: { status: string; reply: string }) => {
    setDrafts((prev) => ({ ...prev, [id]: next }));
  }, []);

  const handleSaveDraft = useCallback(async (id: number, status: string, reply: string) => {
    setSavingId(id);
    try {
      await updateVoiceMessage(id, { status, adminReply: reply });
      showAlert({ type: 'success', title: '저장 완료', message: '처리 내용이 저장되었습니다. 작성자가 상태와 답변을 확인할 수 있습니다.' });
      load();
    } catch (error) {
      console.error('[VoiceBox] 저장 실패:', error);
      showAlert({ type: 'error', title: '저장 실패', message: '처리 내용 저장에 실패했습니다.' });
    } finally {
      setSavingId(null);
    }
  }, [load, showAlert]);

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

      {isLoading ? (
        <StackItem size="fill">
          <Card variant="muted" height="100%">
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spinner label="불러오는 중..." />
            </div>
          </Card>
        </StackItem>
      ) : messages.length === 0 ? (
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
          return (
            <VoiceBoxItem
              key={item.id}
              item={item}
              isExpanded={expandedId === item.id}
              draftStatus={draft.status}
              draftReply={draft.reply}
              isSaving={savingId === item.id}
              onToggleExpand={handleToggleExpand}
              onDraftChange={handleDraftChange}
              onSave={handleSaveDraft}
            />
          );
        })
      )}

      <AlertContainer />
    </VStack>
  );
}
