'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card } from '@astryxdesign/core/Card';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack, HStack, StackItem } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import PageHeader from '@/components/PageHeader';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { SegmentedControl } from '@/components/ui/SlidingSegmentedControl';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { FiCheck, FiInbox } from 'react-icons/fi';
import { Loading } from '@/components/Loading';
import { spring } from '@/theme/springs';
import '@/styles/work.css';
import { useAlert } from './Alert';
import {
  createVoiceMessage,
  getVoiceMessages,
  VoiceMessageItem,
} from '@/lib/apiService';
import { formatListDateTime } from '@/lib/formatDate';

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: '접수',
  IN_REVIEW: '확인중',
  RESOLVED: '처리완료',
  ON_HOLD: '보류',
};

const STATUS_VARIANT: Record<string, 'neutral' | 'blue' | 'green' | 'yellow'> = {
  RECEIVED: 'neutral',
  IN_REVIEW: 'blue',
  RESOLVED: 'green',
  ON_HOLD: 'yellow',
};

function statusLabel(item: VoiceMessageItem): string {
  if (item.status === 'RESOLVED') {
    return item.type === 'SUGGESTION' ? '반영됨' : '조치완료';
  }
  return STATUS_LABEL[item.status] ?? item.status;
}

/** 직원용 고충·건의함 — 제출 폼 + 내 제출 내역(상태·답변 확인) */
export default function VoiceBoxEmployee() {
  const { showAlert, AlertContainer } = useAlert();

  const [type, setType] = useState<'SUGGESTION' | 'GRIEVANCE'>('SUGGESTION');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  // 고충·신고는 기본 익명 — 유형 전환 시 그 유형의 기본값으로 되돌린다
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [myMessages, setMyMessages] = useState<VoiceMessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 제출 직후 단추가 잠깐 ✓로 바뀐다
  const [isSubmitDone, setIsSubmitDone] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 방금 생긴 글 카드 — 옅게 한 번 깜빡이고 화면에 들어오게 스크롤한다
  const [flashId, setFlashId] = useState<number | null>(null);
  const cardRefs = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => () => {
    if (doneTimer.current) clearTimeout(doneTimer.current);
  }, []);

  const loadMine = useCallback(async (): Promise<VoiceMessageItem[] | null> => {
    try {
      const data = await getVoiceMessages('mine');
      const list: VoiceMessageItem[] = Array.isArray(data) ? data : (data.messages || []);
      setMyMessages(list);
      return list;
    } catch (error) {
      console.error('[VoiceBox] 내 내역 조회 실패:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  // 새 글이 그려진 다음 프레임에 그 카드로 스크롤 (동작 줄이기면 부드럽게 움직이지 않는다)
  useEffect(() => {
    if (flashId === null) return;
    const el = cardRefs.current.get(flashId);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    const t = setTimeout(() => setFlashId(null), 1600);
    return () => clearTimeout(t);
  }, [flashId]);

  const handleTypeChange = (value: string) => {
    const next = value as 'SUGGESTION' | 'GRIEVANCE';
    setType(next);
    setIsAnonymous(next === 'GRIEVANCE');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '제목과 내용을 입력해주세요.' });
      return;
    }
    setIsSubmitting(true);
    const prevIds = new Set(myMessages.map((m) => m.id));
    try {
      await createVoiceMessage({ type, title: title.trim(), content, isAnonymous });
      showAlert({
        type: 'success',
        title: '접수 완료',
        message: type === 'GRIEVANCE'
          ? '고충·신고가 접수되었습니다. 기관 관리자만 확인할 수 있습니다.'
          : '건의가 접수되었습니다. 검토 후 상태가 업데이트됩니다.',
      });
      setTitle('');
      setContent('');
      setIsAnonymous(type === 'GRIEVANCE');
      setIsSubmitDone(true);
      if (doneTimer.current) clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setIsSubmitDone(false), 1200);
      const list = await loadMine();
      // 새로 생긴 글 = 제출 전 목록에 없던 것 중 가장 최근(id가 큰) 것
      const added = list?.filter((m) => !prevIds.has(m.id)).sort((a, b) => b.id - a.id)[0];
      if (added) setFlashId(added.id);
    } catch (error) {
      console.error('[VoiceBox] 제출 실패:', error);
      const message = error instanceof Error && error.message ? error.message : '접수에 실패했습니다.';
      showAlert({ type: 'error', title: '접수 실패', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <VStack gap={4}>
      <PageHeader
        title="고충·건의함"
        description="기관에 전하고 싶은 목소리를 남겨주세요."
      />

      <Banner
        status="info"
        title="고충·신고는 대표·시설장 등 기관 관리자만 볼 수 있습니다."
        description="팀장·동료에게는 보이지 않으며, 익명으로 제출하면 관리자에게도 이름이 표시되지 않습니다. 건의는 검토 후 반영 여부와 답변을 이곳에서 확인할 수 있습니다."
      />

      <Card>
        <VStack gap={4}>
          <SegmentedControl value={type} onChange={handleTypeChange} label="유형">
            <SegmentedControlItem value="SUGGESTION" label="건의" />
            <SegmentedControlItem value="GRIEVANCE" label="고충·신고" />
          </SegmentedControl>

          <TextInput
            label="제목"
            value={title}
            onChange={(value) => setTitle(value)}
            placeholder={type === 'GRIEVANCE' ? '예: 근무 배정 관련 고충이 있습니다' : '예: 휴게 공간에 정수기가 있으면 좋겠어요'}
            isRequired
          />
          <TextArea
            label="내용"
            value={content}
            onChange={(value) => setContent(value)}
            placeholder="내용을 자세히 적어주세요."
            rows={5}
            isRequired
          />
          <HStack gap={3} hAlign="between" vAlign="center">
            <CheckboxInput
              label="익명으로 제출 (관리자에게도 이름이 보이지 않습니다)"
              value={isAnonymous}
              onChange={(checked) => setIsAnonymous(checked)}
            />
            <Button
              label={isSubmitting ? '접수 중...' : '제출'}
              variant="primary"
              isLoading={isSubmitting}
              icon={
                isSubmitDone ? (
                  <motion.span
                    style={{ display: 'inline-flex' }}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={spring.pop}
                  >
                    <Icon icon={FiCheck} size="sm" />
                  </motion.span>
                ) : undefined
              }
              onClick={handleSubmit}
            />
          </HStack>
        </VStack>
      </Card>

      <VStack gap={2}>
        <Text type="label" weight="semibold">내 제출 내역 ({myMessages.length})</Text>
        {isLoading ? (
          <Loading variant="rows" label="내 제출 내역을 불러오는 중..." />
        ) : myMessages.length === 0 ? (
          <Card padding={8}>
            <EmptyState
              icon={<Icon icon={FiInbox} size="lg" />}
              title="제출한 내역이 없습니다"
              description="건의나 고충을 남기면 처리 상태와 답변을 여기서 확인할 수 있습니다"
            />
          </Card>
        ) : (
          myMessages.map((item) => (
            <div
              key={item.id}
              ref={(el) => {
                if (el) cardRefs.current.set(item.id, el);
                else cardRefs.current.delete(item.id);
              }}
            >
            <Card className={flashId === item.id ? 'carev-flash' : undefined}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" hAlign="between">
                  <HStack gap={2} vAlign="center">
                    <Badge
                      variant="neutral"
                      label={item.type === 'GRIEVANCE' ? '고충·신고' : '건의'}
                    />
                    <Text weight="semibold">{item.title}</Text>
                    {item.isAnonymous && <Badge variant="neutral" label="익명" />}
                  </HStack>
                  <Badge variant={STATUS_VARIANT[item.status] ?? 'neutral'} label={statusLabel(item)} />
                </HStack>
                <Text type="supporting" color="secondary">
                  {item.createdAt ? formatListDateTime(item.createdAt) : ''}
                </Text>
                <Text type="body" color="secondary">{item.content}</Text>
                {item.adminReply && (
                  <Card variant="teal" padding={3}>
                    <VStack gap={1}>
                      <Text type="label" weight="semibold">관리자 답변</Text>
                      <StackItem size="fill">
                        <Text type="body">{item.adminReply}</Text>
                      </StackItem>
                    </VStack>
                  </Card>
                )}
              </VStack>
            </Card>
            </div>
          ))
        )}
      </VStack>

      <AlertContainer />
    </VStack>
  );
}
