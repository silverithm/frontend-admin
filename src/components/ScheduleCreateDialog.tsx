'use client';

import React, { CSSProperties, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { MultiSelector } from '@astryxdesign/core/MultiSelector';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import type { ISOTimeString } from '@astryxdesign/core/TimeInput';
import MemberItem from '@/components/MemberItem';
import { useAlert } from '@/components/Alert';
import {
  createSchedule,
  getAllMembers,
  getScheduleCategorySettings,
  getScheduleLabels,
  getScheduleManagerCandidates,
} from '@/lib/apiService';
import { getMemberRoleName, getRoleDisplayName } from '@/lib/roleUtils';
import {
  DEFAULT_CATEGORY_SETTINGS,
  SCHEDULE_COLORS,
  ScheduleCategory,
  ScheduleCategorySetting,
  ScheduleLabel,
} from '@/types/schedule';

interface ScheduleCreateDialogProps {
  isOpen: boolean;
  /** 이 날짜로 시작·종료일이 채워진 채 열린다 */
  initialDate: Date;
  onClose: () => void;
  /** 등록에 성공하면 호출 — 부모가 달력을 다시 읽는다 */
  onCreated?: () => void;
  /** 제목 초기값 — 채팅 메시지에서 바로 일정을 등록할 때처럼, 열릴 때 채워두되 자유롭게 수정 가능하다 */
  initialTitle?: string;
}

interface MemberLike {
  id?: number;
  name?: string;
  role?: string | null;
  position?: string | null;
  profileImageUrl?: string | null;
}

/** 관리자(시설장) 계정 구분자. MemberDTO.fromAppUser가 내려주는 값과 일치해야 한다. */
const ADMIN_ROLE = 'facility_admin';

/**
 * 담당자 Selector는 members.id/app_user.id가 우연히 겹칠 수 있어 값만으로 구분할 수 없다.
 * "MEMBER:9" / "ADMIN:3"처럼 종류를 값에 함께 인코딩해 옵션을 유일하게 만들고,
 * 제출 시 이 값에서 managerId/managerType을 다시 뽑아낸다.
 */
const managerOptionValue = (member: MemberLike) => (
  `${member.role === ADMIN_ROLE ? 'ADMIN' : 'MEMBER'}:${member.id}`
);

const managerOptionLabel = (member: MemberLike) => {
  const roleText = member.position || (member.role === ADMIN_ROLE ? '관리자' : undefined);
  return `${member.name}${roleText ? ` (${roleText})` : ''}`;
};

const colorSwatchStyle = (selected: boolean, value: string): CSSProperties => ({
  height: 28,
  borderRadius: 'var(--radius-inner)',
  border: selected ? '2px solid var(--color-border-focus, var(--color-accent))' : '1px solid var(--color-border)',
  background: value,
  cursor: 'pointer',
  padding: 0,
});

/**
 * 일정 등록 다이얼로그 — 월간일정 탭의 등록 폼과 같은 구성을 어디서든 띄운다.
 *
 * 대시보드 달력에서 날짜를 누르면 탭 이동 없이 이 다이얼로그가 바로 열린다.
 * 직원·구분 목록은 스스로 불러오므로 부모는 날짜와 성공 콜백만 넘기면 된다.
 * (월간일정 탭의 폼과 항목이 같아야 한다 — 필드를 바꿀 땐 ScheduleCalendar 쪽도 함께.)
 */
export default function ScheduleCreateDialog({ isOpen, initialDate, onClose, onCreated, initialTitle }: ScheduleCreateDialogProps) {
  const { showAlert, AlertContainer } = useAlert();

  const [members, setMembers] = useState<MemberLike[]>([]);
  /** 담당자 후보 — 직원 + 관리자(시설장). 참석자 후보(members)와 달리 관리자가 섞여 있다. */
  const [managerCandidates, setManagerCandidates] = useState<MemberLike[]>([]);
  const [customCategories, setCustomCategories] = useState<ScheduleLabel[]>([]);
  const [baseCategories, setBaseCategories] = useState<ScheduleCategorySetting[]>(DEFAULT_CATEGORY_SETTINGS);
  const [participantRoleFilter, setParticipantRoleFilter] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dateStr = format(initialDate, 'yyyy-MM-dd');
  const [formData, setFormData] = useState({
    title: initialTitle || '',
    category: 'MEETING' as ScheduleCategory,
    color: '',
    location: '',
    startDate: dateStr,
    startTime: '09:00',
    endDate: dateStr,
    endTime: '10:00',
    isAllDay: false,
    sendNotification: true,
    participantIds: [] as string[],
    managerId: '',
    labelId: '',
  });

  // 열 때마다 그 날짜로 초기화된 빈 폼에서 시작한다
  useEffect(() => {
    if (!isOpen) return;
    const nextDate = format(initialDate, 'yyyy-MM-dd');
    setFormData({
      title: initialTitle || '', category: 'MEETING', color: '', location: '',
      startDate: nextDate, startTime: '09:00', endDate: nextDate, endTime: '10:00',
      isAllDay: false, sendNotification: true, participantIds: [], managerId: '', labelId: '',
    });
    setParticipantRoleFilter([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialDate]);

  // 직원·구분 목록 — 다이얼로그가 처음 열릴 때 한 번
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const [memberData, managerData, labelData, categoryData] = await Promise.allSettled([
          getAllMembers(),
          getScheduleManagerCandidates(),
          getScheduleLabels(),
          getScheduleCategorySettings(),
        ]);

        if (cancelled) return;

        if (memberData.status === 'fulfilled') {
          const raw = memberData.value;
          const list = Array.isArray(raw) ? raw : (raw?.members || raw?.content || raw?.data || []);
          setMembers((list as MemberLike[]).filter((m) => m.id != null && m.name));
        }
        if (managerData.status === 'fulfilled') {
          const raw = managerData.value;
          const list = Array.isArray(raw) ? raw : (raw?.members || raw?.content || raw?.data || []);
          setManagerCandidates((list as MemberLike[]).filter((m) => m.id != null && m.name));
        } else if (memberData.status === 'fulfilled') {
          // 관리자 포함 조회가 실패해도 담당자 지정 자체는 직원만으로 계속 동작해야 한다
          const raw = memberData.value;
          const list = Array.isArray(raw) ? raw : (raw?.members || raw?.content || raw?.data || []);
          setManagerCandidates((list as MemberLike[]).filter((m) => m.id != null && m.name));
        }
        if (labelData.status === 'fulfilled') {
          const raw = labelData.value;
          const list = Array.isArray(raw) ? raw : (raw?.labels || raw?.content || raw?.data || []);
          setCustomCategories((list as { id: string | number; name: string; color?: string }[]).map((l) => ({
            id: String(l.id),
            name: l.name,
            color: l.color || SCHEDULE_COLORS[0].value,
          })));
        }
        if (categoryData.status === 'fulfilled') {
          const list = categoryData.value?.categories;
          if (Array.isArray(list) && list.length > 0) {
            setBaseCategories(list as ScheduleCategorySetting[]);
          }
        }
      } catch (error) {
        console.error('일정 등록 폼 데이터 로드 실패:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const memberRoleOptions = useMemo(() => {
    const seen = new Set<string>();
    members.forEach((m) => {
      const role = getMemberRoleName(m);
      if (role) seen.add(role);
    });
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [members]);

  const participantCandidates = useMemo(() => (
    participantRoleFilter.length === 0
      ? members
      : members.filter((m) => participantRoleFilter.includes(getMemberRoleName(m)))
  ), [members, participantRoleFilter]);

  const getMemberRoleText = (member?: MemberLike) => {
    const resolved = getMemberRoleName(member);
    return resolved ? getRoleDisplayName(resolved) : undefined;
  };

  const toggleRoleParticipants = (role: string) => {
    const ids = members.filter((m) => getMemberRoleName(m) === role).map((m) => String(m.id));
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => formData.participantIds.includes(id));
    setFormData((prev) => ({
      ...prev,
      participantIds: allSelected
        ? prev.participantIds.filter((id) => !ids.includes(id))
        : Array.from(new Set([...prev.participantIds, ...ids])),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      showAlert({ type: 'error', title: '입력 오류', message: '제목을 입력해주세요.' });
      return;
    }

    // 담당자 값은 "MEMBER:9" / "ADMIN:3"처럼 종류가 인코딩돼 있다 — id 공간이 서로 달라
    // (members.id와 app_user.id) 종류 없이 숫자만 보내면 엉뚱한 사람이 저장될 수 있다.
    const [managerType, managerIdRaw] = formData.managerId ? formData.managerId.split(':') : [undefined, undefined];

    setIsSubmitting(true);
    try {
      await createSchedule({
        title: formData.title,
        category: formData.category,
        labelId: formData.labelId ? formData.labelId : null,
        color: formData.color,
        location: formData.location || undefined,
        startDate: formData.startDate,
        startTime: formData.isAllDay ? undefined : formData.startTime,
        endDate: formData.endDate,
        endTime: formData.isAllDay ? undefined : formData.endTime,
        isAllDay: formData.isAllDay,
        sendNotification: formData.sendNotification,
        participantIds: formData.participantIds.length > 0 ? formData.participantIds : undefined,
        managerId: managerIdRaw ? Number(managerIdRaw) : null,
        managerType: managerType || null,
      });

      showAlert({ type: 'success', title: '생성 완료', message: '일정이 등록되었습니다.' });
      onCreated?.();
      onClose();
    } catch (error) {
      console.error('일정 생성 실패:', error);
      showAlert({ type: 'error', title: '생성 실패', message: '일정 생성에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AlertContainer />
      <Dialog isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} purpose="form" width={640}>
        <Layout
          header={
            <DialogHeader
              title="일정 추가"
              subtitle="일정 정보를 입력해주세요"
              onOpenChange={(open) => { if (!open) onClose(); }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <TextInput
                  label="제목"
                  isRequired
                  value={formData.title}
                  onChange={(value) => setFormData(prev => ({ ...prev, title: value }))}
                  placeholder="일정 제목을 입력하세요"
                />

                {/* 일정 구분 — 기본 구분 + 기관이 직접 만든 구분(색 자동 적용) */}
                <HStack gap={2} vAlign="end">
                  <StackItem size="fill">
                    <Selector
                      label="일정 구분"
                      width="100%"
                      value={formData.labelId ? `label:${formData.labelId}` : formData.category}
                      options={[
                        ...baseCategories
                          .filter((c) => !c.hidden)
                          .map((c) => ({ value: c.category, label: c.name })),
                        ...customCategories.map((c) => ({ value: `label:${c.id}`, label: c.name })),
                      ]}
                      onChange={(value) => {
                        const v = String(value);
                        if (v.startsWith('label:')) {
                          const id = v.slice('label:'.length);
                          const picked = customCategories.find((c) => c.id === id);
                          setFormData(prev => ({
                            ...prev, labelId: id, category: 'OTHER', color: picked?.color || prev.color,
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev, category: v as ScheduleCategory, labelId: '', color: prev.labelId ? '' : prev.color,
                          }));
                        }
                      }}
                    />
                  </StackItem>
                </HStack>

                {/* 색상 — 기본 구분일 때만 (커스텀 구분은 자기 색을 쓴다) */}
                {!formData.labelId && (
                  <VStack gap={1.5}>
                    <Text type="label" weight="medium">색상</Text>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${SCHEDULE_COLORS.length + 1}, minmax(0, 1fr))`,
                        gap: 'var(--spacing-2)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, color: '' }))}
                        style={{
                          ...colorSwatchStyle(formData.color === '', 'var(--color-background-muted)'),
                          backgroundImage: 'linear-gradient(to top right, transparent calc(50% - 1px), var(--color-border-emphasized) calc(50% - 1px), var(--color-border-emphasized) calc(50% + 1px), transparent calc(50% + 1px))',
                        }}
                        title="색상 없음"
                        aria-label="색상 없음 (카테고리 기본색 사용)"
                      />
                      {SCHEDULE_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                          style={colorSwatchStyle(formData.color === color.value, color.value)}
                          title={color.label}
                          aria-label={color.label}
                        />
                      ))}
                    </div>
                  </VStack>
                )}

                <TextInput
                  label="장소"
                  value={formData.location}
                  onChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
                  placeholder="장소를 입력하세요"
                />

                {/* 날짜/시간 */}
                <VStack gap={2}>
                  <HStack hAlign="between" vAlign="center">
                    <Text type="label" weight="medium">날짜/시간</Text>
                    <CheckboxInput
                      label="종일"
                      value={formData.isAllDay}
                      onChange={(checked) => setFormData(prev => ({ ...prev, isAllDay: checked }))}
                    />
                  </HStack>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
                    <DateInput
                      label="시작일"
                      value={formData.startDate ? (formData.startDate as ISODateString) : undefined}
                      onChange={(value) => setFormData(prev => ({ ...prev, startDate: value || '' }))}
                    />
                    {!formData.isAllDay && (
                      <TimeInput
                        label="시작 시간"
                        hourFormat="24h"
                        value={formData.startTime ? (formData.startTime as ISOTimeString) : undefined}
                        onChange={(value) => setFormData(prev => ({ ...prev, startTime: value || '' }))}
                      />
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
                    <DateInput
                      label="종료일"
                      value={formData.endDate ? (formData.endDate as ISODateString) : undefined}
                      onChange={(value) => setFormData(prev => ({ ...prev, endDate: value || '' }))}
                    />
                    {!formData.isAllDay && (
                      <TimeInput
                        label="종료 시간"
                        hourFormat="24h"
                        value={formData.endTime ? (formData.endTime as ISOTimeString) : undefined}
                        onChange={(value) => setFormData(prev => ({ ...prev, endTime: value || '' }))}
                      />
                    )}
                  </div>
                </VStack>

                <CheckboxInput
                  label="참석자에게 알림 전송"
                  value={formData.sendNotification}
                  onChange={(checked) => setFormData(prev => ({ ...prev, sendNotification: checked }))}
                />

                <Selector
                  label="담당자"
                  placeholder="담당자 미지정"
                  hasClear
                  value={formData.managerId || null}
                  onChange={(value) => setFormData(prev => ({ ...prev, managerId: value || '' }))}
                  options={managerCandidates.map((m) => ({ value: managerOptionValue(m), label: managerOptionLabel(m) }))}
                />

                {/* 참석자 선택 — 직종으로 좁혀 보고, 직종 단위로 한꺼번에 고를 수 있다 */}
                <VStack gap={2}>
                  <HStack hAlign="between" vAlign="center">
                    <Text type="label" weight="medium">참석자</Text>
                    {formData.participantIds.length > 0 && (
                      <HStack gap={2} vAlign="center">
                        <Text type="supporting" color="accent">{formData.participantIds.length}명 선택됨</Text>
                        <Button
                          label="선택 해제"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormData((prev) => ({ ...prev, participantIds: [] }))}
                        />
                      </HStack>
                    )}
                  </HStack>

                  {memberRoleOptions.length > 0 && (
                    <>
                      <MultiSelector
                        label="직종으로 조회"
                        isLabelHidden
                        size="sm"
                        placeholder="전체 직종"
                        options={memberRoleOptions.map((role) => ({ value: role, label: getRoleDisplayName(role) }))}
                        value={participantRoleFilter}
                        onChange={(values) => setParticipantRoleFilter(values)}
                        triggerDisplay="badges"
                        hasSelectAll
                        selectAllLabel="전체 직종"
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)' }}>
                        {memberRoleOptions.map((role) => {
                          const ids = members.filter((m) => getMemberRoleName(m) === role).map((m) => String(m.id));
                          const allSelected = ids.length > 0 && ids.every((id) => formData.participantIds.includes(id));
                          return (
                            <Button
                              key={role}
                              label={`${getRoleDisplayName(role)} ${ids.length}명`}
                              variant={allSelected ? 'primary' : 'secondary'}
                              size="sm"
                              onClick={() => toggleRoleParticipants(role)}
                            />
                          );
                        })}
                      </div>
                    </>
                  )}

                  <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--color-border-emphasized)', borderRadius: 'var(--radius-inner)', padding: 'var(--spacing-2)' }}>
                    {participantCandidates.length === 0 ? (
                      <EmptyState title={members.length === 0 ? '직원이 없습니다' : '이 직종에 해당하는 직원이 없습니다'} />
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--spacing-1)' }}>
                        {participantCandidates.map((member) => {
                          const memberId = String(member.id);
                          const isPicked = formData.participantIds.includes(memberId);
                          return (
                            <MemberItem
                              key={memberId}
                              name={member.name || ''}
                              role={getMemberRoleText(member)}
                              imageUrl={member.profileImageUrl}
                              isSelected={isPicked}
                              density="compact"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  participantIds: isPicked
                                    ? prev.participantIds.filter((id) => id !== memberId)
                                    : [...prev.participantIds, memberId],
                                }));
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </VStack>
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="취소" variant="ghost" onClick={onClose} isDisabled={isSubmitting} />
                <Button
                  label="등록"
                  variant="primary"
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  isDisabled={isSubmitting}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
