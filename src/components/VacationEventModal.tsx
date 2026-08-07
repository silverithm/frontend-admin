'use client';

import { useEffect, useState } from 'react';
import { format, endOfMonth, startOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Switch } from '@astryxdesign/core/Switch';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Badge } from '@astryxdesign/core/Badge';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { IconCalendarStar, IconPencil, IconTrash } from '@tabler/icons-react';
import {
  createVacationEvent,
  deleteVacationEvent,
  getVacationEvents,
  updateVacationEvent,
  type VacationEvent,
} from '@/lib/apiService';
import { useAlert } from './Alert';
import { useConfirm } from './ConfirmDialog';

interface VacationEventModalProps {
  /** 어느 달의 행사를 관리할지 — 이 달 ±1개월 범위를 보여준다 */
  currentDate: Date;
  onClose: () => void;
  /** 저장·삭제로 목록이 바뀌었을 때 (달력 새로고침용) */
  onChanged?: () => void;
}

const emptyForm = { title: '', description: '', startDate: '', endDate: '', warnOnRequest: true };

/**
 * 근무조정 중요 행사 관리 — 관리자가 "이 날은 행사가 있으니 휴무를 피해달라"를 등록한다.
 * 직원 휴무 신청 화면에서 같은 데이터를 읽어 경고로 띄운다.
 */
export default function VacationEventModal({ currentDate, onClose, onChanged }: VacationEventModalProps) {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();

  const [events, setEvents] = useState<VacationEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  // 이 달을 중심으로 앞뒤 한 달까지 — 다음 달 근무표를 짜며 등록하는 흐름을 고려
  const rangeStart = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const rangeEnd = format(endOfMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)), 'yyyy-MM-dd');

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      setEvents(await getVacationEvents(rangeStart, rangeEnd));
    } catch (error) {
      console.error('[VacationEvent] 행사 조회 실패:', error);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  const startEdit = (event: VacationEvent) => {
    setEditingId(event.id);
    setForm({
      title: event.title,
      description: event.description ?? '',
      startDate: event.startDate,
      endDate: event.endDate,
      warnOnRequest: event.warnOnRequest,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '행사명을 입력해주세요.' });
      return;
    }
    if (!form.startDate) {
      showAlert({ type: 'warning', title: '입력 필요', message: '행사 날짜를 선택해주세요.' });
      return;
    }
    // 하루짜리 행사는 종료일을 따로 고르지 않아도 되게 시작일로 채운다
    const endDate = form.endDate || form.startDate;
    if (endDate < form.startDate) {
      showAlert({ type: 'warning', title: '날짜 확인', message: '종료일은 시작일보다 빠를 수 없습니다.' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        startDate: form.startDate,
        endDate,
        warnOnRequest: form.warnOnRequest,
      };
      if (editingId) {
        await updateVacationEvent(editingId, payload);
        showAlert({ type: 'success', title: '수정 완료', message: '행사가 수정되었습니다.' });
      } else {
        await createVacationEvent(payload);
        showAlert({ type: 'success', title: '등록 완료', message: '행사가 등록되었습니다.' });
      }
      resetForm();
      await loadEvents();
      onChanged?.();
    } catch (error) {
      showAlert({
        type: 'error',
        title: '저장 실패',
        message: error instanceof Error ? error.message : '행사 저장에 실패했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (event: VacationEvent) => {
    const ok = await confirm({
      title: '행사 삭제',
      message: `"${event.title}" 행사를 삭제할까요?`,
      type: 'danger',
      confirmText: '삭제',
    });
    if (!ok) return;
    try {
      await deleteVacationEvent(event.id);
      if (editingId === event.id) resetForm();
      await loadEvents();
      onChanged?.();
    } catch (error) {
      showAlert({
        type: 'error',
        title: '삭제 실패',
        message: error instanceof Error ? error.message : '행사 삭제에 실패했습니다.',
      });
    }
  };

  const formatPeriod = (event: VacationEvent) =>
    event.startDate === event.endDate
      ? format(new Date(event.startDate), 'M월 d일 (EEE)', { locale: ko })
      : `${format(new Date(event.startDate), 'M월 d일', { locale: ko })} ~ ${format(new Date(event.endDate), 'M월 d일', { locale: ko })}`;

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />
      <Dialog isOpen onOpenChange={(open) => { if (!open && !isSaving) onClose(); }} purpose="form" width={560}>
        <Layout
          header={<DialogHeader title="중요 행사 관리" onOpenChange={(open) => { if (!open && !isSaving) onClose(); }} />}
          content={
            <LayoutContent>
              <VStack gap={4}>
                <Text type="supporting" color="secondary">
                  등록한 행사는 근무조정 달력에 표시되고, 직원이 그 날짜에 휴무를 신청하면 안내가 나갑니다.
                </Text>

                {/* 등록·수정 폼 */}
                <Card variant="muted" padding={4}>
                  <VStack gap={3}>
                    <Text type="body" weight="semibold" color="primary">
                      {editingId ? '행사 수정' : '새 행사 등록'}
                    </Text>
                    <TextInput
                      label="행사명"
                      isRequired
                      placeholder="예: 어버이날 잔치, 정기평가 실사"
                      value={form.title}
                      onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
                      isDisabled={isSaving}
                    />
                    <HStack gap={3} vAlign="start" wrap="wrap">
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <DateInput
                          label="시작일"
                          isRequired
                          value={form.startDate ? (form.startDate as ISODateString) : undefined}
                          onChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              startDate: value || '',
                              // 종료일이 비었거나 시작일보다 앞서면 같이 맞춘다
                              endDate: !prev.endDate || (value && prev.endDate < value) ? value || '' : prev.endDate,
                            }))
                          }
                          isDisabled={isSaving}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <DateInput
                          label="종료일"
                          isOptional
                          description="하루 행사면 비워두세요"
                          value={form.endDate ? (form.endDate as ISODateString) : undefined}
                          min={form.startDate ? (form.startDate as ISODateString) : undefined}
                          onChange={(value) => setForm((prev) => ({ ...prev, endDate: value || '' }))}
                          isDisabled={isSaving}
                        />
                      </div>
                    </HStack>
                    <TextArea
                      label="설명"
                      isOptional
                      placeholder="직원에게 함께 보여줄 안내가 있으면 적어주세요"
                      value={form.description}
                      onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
                      rows={2}
                      isDisabled={isSaving}
                    />
                    <Switch
                      label="휴무 신청 시 안내 띄우기"
                      value={form.warnOnRequest}
                      onChange={(checked) => setForm((prev) => ({ ...prev, warnOnRequest: checked }))}
                      labelPosition="start"
                      labelSpacing="spread"
                      isDisabled={isSaving}
                    />
                    <HStack gap={2} hAlign="end">
                      {editingId && (
                        <Button label="취소" variant="ghost" size="sm" onClick={resetForm} isDisabled={isSaving} />
                      )}
                      <Button
                        label={editingId ? '수정 저장' : '행사 등록'}
                        variant="primary"
                        size="sm"
                        isLoading={isSaving}
                        onClick={handleSave}
                      />
                    </HStack>
                  </VStack>
                </Card>

                <Divider />

                {/* 등록된 행사 목록 */}
                <VStack gap={2}>
                  <Text type="body" weight="semibold" color="primary">
                    등록된 행사 ({format(currentDate, 'M월', { locale: ko })}~{format(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1), 'M월', { locale: ko })})
                  </Text>
                  {isLoading ? (
                    <Text type="supporting" color="secondary">불러오는 중...</Text>
                  ) : events.length === 0 ? (
                    <EmptyState
                      isCompact
                      title="등록된 행사가 없습니다"
                      description="휴무를 피해야 하는 날이 있으면 등록해보세요."
                      icon={<Icon icon={IconCalendarStar} size="lg" color="secondary" />}
                    />
                  ) : (
                    events.map((event) => (
                      <Card key={event.id} padding={3}>
                        <HStack hAlign="between" vAlign="center" gap={2}>
                          <VStack gap={0.5} align="start">
                            <HStack gap={2} vAlign="center" wrap="wrap">
                              <Text type="body" weight="medium" color="primary">{event.title}</Text>
                              {event.warnOnRequest && <Badge variant="yellow" label="신청 시 안내" />}
                            </HStack>
                            <Text type="supporting" color="secondary">{formatPeriod(event)}</Text>
                            {event.description && (
                              <Text type="supporting" color="secondary">{event.description}</Text>
                            )}
                          </VStack>
                          <HStack gap={1} vAlign="center">
                            <IconButton
                              label="행사 수정"
                              variant="ghost"
                              size="sm"
                              icon={<Icon icon={IconPencil} size="sm" color="secondary" />}
                              onClick={() => startEdit(event)}
                            />
                            <IconButton
                              label="행사 삭제"
                              variant="ghost"
                              size="sm"
                              icon={<Icon icon={IconTrash} size="sm" color="secondary" />}
                              onClick={() => handleDelete(event)}
                            />
                          </HStack>
                        </HStack>
                      </Card>
                    ))
                  )}
                </VStack>
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="닫기" variant="secondary" onClick={onClose} isDisabled={isSaving} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
