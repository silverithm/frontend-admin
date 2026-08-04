'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card } from '@astryxdesign/core/Card';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack, HStack, StackItem } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Icon } from '@astryxdesign/core/Icon';
import { FiInbox } from 'react-icons/fi';
import { useAlert } from './Alert';
import {
  createVoiceMessage,
  getVoiceMessages,
  VoiceMessageItem,
} from '@/lib/apiService';

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

  const loadMine = useCallback(async () => {
    try {
      const data = await getVoiceMessages('mine');
      setMyMessages(Array.isArray(data) ? data : (data.messages || []));
    } catch (error) {
      console.error('[VoiceBox] 내 내역 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

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
      loadMine();
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
      <VStack gap={1}>
        <Heading level={2}>고충·건의함</Heading>
        <Text type="supporting" color="secondary">기관에 전하고 싶은 목소리를 남겨주세요.</Text>
      </VStack>

      <Banner
        status="info"
        title="고충·신고는 대표·시설장 등 기관 관리자만 볼 수 있습니다."
        description="팀장·동료에게는 보이지 않으며, 익명으로 제출하면 관리자에게도 이름이 표시되지 않습니다. 건의는 검토 후 반영 여부와 답변을 이곳에서 확인할 수 있습니다."
      />

      <Card>
        <VStack gap={4}>
          <SegmentedControl value={type} onChange={handleTypeChange} label="유형">
            <SegmentedControlItem value="SUGGESTION" label="💡 건의" />
            <SegmentedControlItem value="GRIEVANCE" label="🔒 고충·신고" />
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
              onClick={handleSubmit}
            />
          </HStack>
        </VStack>
      </Card>

      <VStack gap={2}>
        <Text type="label" weight="semibold">내 제출 내역 ({myMessages.length})</Text>
        {isLoading ? null : myMessages.length === 0 ? (
          <Card variant="muted">
            <EmptyState
              icon={<Icon icon={FiInbox} size="lg" />}
              title="제출한 내역이 없습니다"
              description="건의나 고충을 남기면 처리 상태와 답변을 여기서 확인할 수 있습니다."
            />
          </Card>
        ) : (
          myMessages.map((item) => (
            <Card key={item.id}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" hAlign="between">
                  <HStack gap={2} vAlign="center">
                    <Badge
                      variant={item.type === 'GRIEVANCE' ? 'red' : 'blue'}
                      label={item.type === 'GRIEVANCE' ? '고충·신고' : '건의'}
                    />
                    <Text weight="semibold">{item.title}</Text>
                    {item.isAnonymous && <Badge variant="neutral" label="익명" />}
                  </HStack>
                  <Badge variant={STATUS_VARIANT[item.status] ?? 'neutral'} label={statusLabel(item)} />
                </HStack>
                <Text type="supporting" color="secondary">
                  {item.createdAt ? format(new Date(item.createdAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko }) : ''}
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
          ))
        )}
      </VStack>

      <AlertContainer />
    </VStack>
  );
}
