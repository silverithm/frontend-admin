'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MultiSelector } from '@astryxdesign/core/MultiSelector';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Slider } from '@astryxdesign/core/Slider';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import type { DirectChatMember } from '@/lib/directChat';
import { createWorkTask, deleteWorkTask, updateWorkTask } from '@/lib/apiService';
import { IMPORTANCE_META, IMPORTANCE_ORDER, PROGRESS_STEP, type WorkTask, type WorkTaskImportance, type WorkTaskInput } from '@/lib/workTasks';

interface Props {
  isOpen: boolean;
  /** 고칠 업무. 없으면 새로 등록한다 */
  task: WorkTask | null;
  /** 담당자로 고를 수 있는 기관 사람들 (나 포함) */
  members: DirectChatMember[];
  /** 나 — 새 업무의 기본 담당자 */
  meId: string | null;
  onClose: () => void;
  onSaved: (task: WorkTask) => void;
  onDeleted: (id: number) => void;
}

const CONTENT_MAX = 300;

function emptyInput(meId: string | null): WorkTaskInput {
  return { content: '', importance: 'NORMAL', progress: 0, dueDate: null, assigneeIds: meId ? [meId] : [] };
}

function inputOf(task: WorkTask): WorkTaskInput {
  return {
    content: task.content,
    importance: task.importance,
    progress: task.progress,
    dueDate: task.dueDate,
    assigneeIds: task.assignees.map((a) => a.id),
  };
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * 업무 등록·수정 — 담당자, 기한, 업무 내용, 중요도, 수행도(원장 그림의 "등록 시 기본정보 입력").
 * 고칠 수 없는 사람(관리자·등록한 사람·담당자가 아님)에게는 같은 창을 읽기 전용으로 보여 준다.
 */
export default function WorkTaskDialog({ isOpen, task, members, meId, onClose, onSaved, onDeleted }: Props) {
  const [form, setForm] = useState<WorkTaskInput>(() => (task ? inputOf(task) : emptyInput(meId)));
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 창을 열 때마다 그 업무(또는 빈 칸)로 다시 채운다
  useEffect(() => {
    if (!isOpen) return;
    setForm(task ? inputOf(task) : emptyInput(meId));
    setError(null);
    setIsConfirmingDelete(false);
  }, [isOpen, task, meId]);

  const isNew = task == null;
  const readOnly = !isNew && !task.canEdit;

  // 지금 명단에 없는 사람(퇴사 등)이 담당자로 남아 있어도 칸에서 사라지지 않게 한다
  const options = useMemo(() => {
    const list = members.map((m) => ({
      value: m.id,
      label: m.id === meId ? `${m.name} (나)` : m.position ? `${m.name} · ${m.position}` : m.name,
    }));
    for (const a of task?.assignees ?? []) {
      if (!list.some((o) => o.value === a.id)) list.push({ value: a.id, label: a.name ?? '알 수 없는 사람' });
    }
    return list;
  }, [members, meId, task]);

  const canSubmit = !readOnly && form.content.trim().length > 0 && form.assigneeIds.length > 0 && !isSaving;

  const submit = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    setError(null);
    try {
      const body: WorkTaskInput = { ...form, content: form.content.trim() };
      const saved = isNew ? await createWorkTask(body) : await updateWorkTask(task.id, body);
      onSaved(saved);
    } catch (e) {
      setError(errorText(e, isNew ? '업무를 등록하지 못했습니다' : '업무를 저장하지 못했습니다'));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!task) return;
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await deleteWorkTask(task.id);
      onDeleted(task.id);
    } catch (e) {
      setError(errorText(e, '업무를 지우지 못했습니다'));
      setIsConfirmingDelete(false);
    } finally {
      setIsSaving(false);
    }
  };

  const title = isNew ? '업무 등록' : readOnly ? '업무 보기' : '업무 수정';
  const subtitle = isNew
    ? '담당자에게 알림이 가고, 다 끝날 때까지 매일 아침 알려 줍니다'
    : `등록 ${task.createdBy.name ?? ''} · ${task.createdAt.slice(5, 10).replace('-', '/')}`;

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} purpose="form" width={520}>
      <Layout
        header={<DialogHeader title={title} subtitle={subtitle} onOpenChange={(open) => { if (!open) onClose(); }} />}
        content={
          <LayoutContent>
            <VStack gap={4}>
              {error && <Banner status="error" title={error} isDismissable onDismiss={() => setError(null)} />}
              {readOnly && (
                <Banner status="info" title="관리자·등록한 사람·담당자만 고칠 수 있습니다" />
              )}

              <TextArea
                label="업무 내용"
                value={form.content}
                onChange={(value) => setForm((prev) => ({ ...prev, content: value.slice(0, CONTENT_MAX) }))}
                placeholder="예: 10월 사업계획서 작성"
                rows={3}
                maxLength={CONTENT_MAX}
                isDisabled={readOnly}
                hasAutoFocus={isNew}
              />

              <MultiSelector
                label="담당자"
                placeholder="담당자를 골라 주세요"
                options={options}
                value={form.assigneeIds}
                onChange={(values) => setForm((prev) => ({ ...prev, assigneeIds: values.map(String) }))}
                triggerDisplay="badges"
                isDisabled={readOnly}
              />

              <HStack gap={3} vAlign="start">
                <StackItem size="fill">
                  <DateInput
                    label="기한 (선택)"
                    placeholder="날짜 고르기"
                    hasClear
                    value={form.dueDate ? (form.dueDate as ISODateString) : undefined}
                    onChange={(value) => setForm((prev) => ({ ...prev, dueDate: value || null }))}
                    isDisabled={readOnly}
                  />
                </StackItem>
                <StackItem size="fill">
                  <VStack gap={1.5}>
                    <Text type="label" weight="semibold">중요도</Text>
                    <SegmentedControl
                      label="중요도"
                      value={form.importance}
                      onChange={(value) => setForm((prev) => ({ ...prev, importance: value as WorkTaskImportance }))}
                      isDisabled={readOnly}
                    >
                      {IMPORTANCE_ORDER.map((imp) => (
                        <SegmentedControlItem key={imp} value={imp} label={IMPORTANCE_META[imp].label} />
                      ))}
                    </SegmentedControl>
                  </VStack>
                </StackItem>
              </HStack>

              {/* 눈금 글자(0%·50%·완료)가 창 아래 구분선에 잘리지 않게 아래를 띄운다 */}
              <div style={{ paddingBottom: 'var(--spacing-4)' }}>
              <Slider
                label="수행도"
                min={0}
                max={100}
                step={PROGRESS_STEP}
                value={form.progress}
                onChange={(value: number) => setForm((prev) => ({ ...prev, progress: value }))}
                formatValue={(value) => `${value}%`}
                valueDisplay="text"
                marks={[{ value: 0, label: '0%' }, { value: 50, label: '50%' }, { value: 100, label: '완료' }]}
                isDisabled={readOnly}
              />
              </div>
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} vAlign="center">
              {!isNew && task.canDelete && (
                <Button
                  label={isConfirmingDelete ? '정말 지우기' : '지우기'}
                  variant={isConfirmingDelete ? 'destructive' : 'ghost'}
                  onClick={remove}
                  isDisabled={isSaving}
                />
              )}
              <StackItem size="fill"><span /></StackItem>
              <Button label={readOnly ? '닫기' : '취소'} variant="ghost" onClick={onClose} isDisabled={isSaving} />
              {!readOnly && (
                <Button
                  label={isNew ? '등록' : '저장'}
                  variant="primary"
                  onClick={submit}
                  isLoading={isSaving}
                  isDisabled={!canSubmit}
                />
              )}
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
