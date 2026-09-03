"use client";
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import MemberSelector from './MemberSelector';
import { VacationKind, VACATION_KIND_OPTIONS, toVacationRequestFields } from '@/types/vacation';
import { adminCreateVacationForMember, getVacationCalendar, getVacationEvents, type VacationEvent } from '@/lib/apiService';
import { fetchDriverRoles } from '@/lib/dispatchSync';
import {
  VACATION_NOTICES,
  VACATION_NOTICE_LIST_CLASS,
  VACATION_NOTICE_LIST_STYLE,
  VACATION_NOTICE_TITLE,
  describeDriverConflicts,
  findConflictsFromRoles,
  type RemoteDriverRole,
} from '@/lib/vacationGuard';
import type { Member } from './MemberSelector';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Avatar } from '@astryxdesign/core/Avatar';
import { DateInput } from '@astryxdesign/core/DateInput';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Banner } from '@astryxdesign/core/Banner';
import type { ISODateString } from '@astryxdesign/core/Calendar';

interface AdminVacationAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDate: Date | null;
}

const AdminVacationAddModal: React.FC<AdminVacationAddModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedDate
}) => {
  const [step, setStep] = useState<'member' | 'details'>('member');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [vacationDate, setVacationDate] = useState(
    selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [vacationKind, setVacationKind] = useState<VacationKind>('regular');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 선택된 직원의 배차 배정 — 서버에서 조회한다(배차 설정은 회사 공용)
  const [driverRoles, setDriverRoles] = useState<RemoteDriverRole[]>([]);
  /** 운행 공백 경고 — 막지 않고 한 번 확인만 받는다 */
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false);

  // 고른 날짜에 걸친 중요 행사 — 관리자도 행사일을 알고 등록하도록
  const [dateEvents, setDateEvents] = useState<VacationEvent[]>([]);
  useEffect(() => {
    if (!vacationDate) {
      setDateEvents([]);
      return;
    }
    let cancelled = false;
    getVacationEvents(vacationDate, vacationDate)
      .then((list) => {
        if (!cancelled) setDateEvents(list);
      })
      .catch(() => {
        if (!cancelled) setDateEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [vacationDate]);

  useEffect(() => {
    // 대상이나 날짜가 바뀌면 경고를 새로 판정한다
    setConflictWarning(null);
    setConflictAcknowledged(false);
  }, [selectedMember?.name, vacationDate]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedMember?.name) {
      setDriverRoles([]);
      return;
    }
    fetchDriverRoles(selectedMember.name).then((roles) => {
      if (!cancelled) setDriverRoles(roles);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedMember?.name]);

  /**
   * 그날 이미 휴무인 사람 중 같은 노선의 다른 운전자가 있는지 확인한다.
   * 배차에 배정되지 않은 직원이면 조회 없이 통과시킨다.
   */
  const checkDriverConflicts = async (memberName: string, date: string) => {
    const roles = driverRoles.length > 0 ? driverRoles : await fetchDriverRoles(memberName);
    if (roles.length === 0) return [];
    try {
      const data = await getVacationCalendar(date, date);
      const list: unknown[] = Array.isArray(data) ? data : (data?.vacations ?? data?.content ?? data?.data ?? []);
      const names = list
        .map((raw) => {
          const v = raw as { userName?: string; memberName?: string; name?: string; status?: string };
          // 반려된 건은 그날 쉬는 게 아니므로 제외
          if (v.status && v.status.toUpperCase() === 'REJECTED') return '';
          return v.userName || v.memberName || v.name || '';
        })
        .filter(Boolean);
      return findConflictsFromRoles(roles, names);
    } catch (err) {
      // 조회 실패로 등록 자체를 막지는 않는다 (배차는 보조 규칙)
      console.error('[휴무] 배차 충돌 확인 실패:', err);
      return [];
    }
  };

  /** 선택된 직원이 어느 노선의 무슨 운전자인지 — 등록 전에 알려준다 */
  const driverRoleSummary = driverRoles
    .map((r) => `· ${r.routeName}(${r.routeType}) ${r.roleLabel}`)
    .join('\n');

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member);
  };

  const handleNextStep = () => {
    if (!selectedMember) {
      setError('직원을 선택해주세요.');
      return;
    }
    setError(null);
    setStep('details');
  };

  const handlePreviousStep = () => {
    setStep('member');
    setError(null);
  };

  const validateForm = () => {
    if (!selectedMember) {
      setError('직원을 선택해주세요.');
      return false;
    }

    if (!vacationDate) {
      setError('휴무 날짜를 선택해주세요.');
      return false;
    }

    // 필수 휴무일 때만 사유 필수
    if (vacationKind === 'mandatory' && !reason.trim()) {
      setError('필수 휴무는 사유를 입력해주세요.');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 그날 그 노선을 몰 사람이 없어지면 알린다. 사정이 있을 수 있어 막지는 않고
      // 한 번 확인만 받는다 (이미 확인했으면 그대로 진행).
      if (!conflictAcknowledged) {
        const conflicts = await checkDriverConflicts(selectedMember!.name, vacationDate);
        if (conflicts.length > 0) {
          setConflictWarning(describeDriverConflicts(selectedMember!.name, conflicts));
          setConflictAcknowledged(true);
          setIsSubmitting(false);
          return;
        }
      }

      const companyId = localStorage.getItem('companyId');

      if (!companyId) {
        throw new Error('회사 ID를 찾을 수 없습니다.');
      }

      // 고른 종류 하나를 서버가 쓰는 type/duration/연차사용 여부로 편다
      const { type, duration, useAnnualLeave } = toVacationRequestFields(vacationKind);

      await adminCreateVacationForMember({
        memberId: parseInt(selectedMember!.id, 10).toString(),
        date: vacationDate,
        reason: reason.trim() || undefined,
        duration,
        type,
        useAnnualLeave,
        reasonRequired: vacationKind === 'mandatory',
        companyId,
      });

      onSuccess();
      handleClose();
    } catch (err) {
      console.error('휴무 신청 오류:', err);
      setError(err instanceof Error ? err.message : '휴무 신청 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('member');
    setSelectedMember(null);
    setVacationDate(selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    setVacationKind('regular');
    setReason('');
    setError(null);
    setConflictWarning(null);
    setConflictAcknowledged(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) handleClose(); }}
      purpose="form"
      width={640}
    >
      <Layout
        header={
          <DialogHeader
            title={step === 'member' ? '직원 선택' : '휴무 정보 입력'}
            subtitle={step === 'member' ? '휴무를 신청할 직원을 선택해주세요' : '휴무 상세 정보를 입력해주세요'}
            onOpenChange={(open) => { if (!open) handleClose(); }}
          />
        }
        content={
          <LayoutContent>
            <AnimatePresence mode="wait">
              {step === 'member' ? (
                <motion.div
                  key="member"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <MemberSelector
                    onSelect={handleMemberSelect}
                    selectedMember={selectedMember}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <VStack gap={4}>
                    {/* 선택된 직원 정보 */}
                    <Card variant="muted" padding={3}>
                      <HStack gap={3} vAlign="center">
                        <Avatar
                          name={selectedMember?.name}
                          src={selectedMember?.profileImageUrl || undefined}
                        />
                        <VStack gap={0.5}>
                          <Text type="body" weight="medium">{selectedMember?.name}</Text>
                          <Text type="supporting" color="secondary">{selectedMember?.email}</Text>
                        </VStack>
                      </HStack>
                    </Card>

                    {/* 등록 전 필수 숙지 — 배차·최소 인원처럼 시스템이 다 막지 못하는 부분이라 강한 색으로 강조 */}
                    <Banner status="error" container="card" title={VACATION_NOTICE_TITLE} defaultIsExpanded>
                      <ul className={VACATION_NOTICE_LIST_CLASS} style={VACATION_NOTICE_LIST_STYLE}>
                        {VACATION_NOTICES.map((notice) => (
                          <li key={notice}>{notice}</li>
                        ))}
                      </ul>
                    </Banner>

                    {/* 이 직원이 운전자로 배정돼 있으면 미리 알려준다 */}
                    {driverRoleSummary && (
                      <Banner
                        status="info"
                        container="card"
                        title="배차 운전자로 배정된 직원입니다"
                        description={driverRoleSummary}
                      />
                    )}

                    {/* 날짜 선택 */}
                    <DateInput
                      label="휴무 날짜"
                      value={vacationDate ? (vacationDate as ISODateString) : undefined}
                      onChange={(value) => setVacationDate(value || '')}
                    />

                    {/* 고른 날짜에 기관 행사가 있으면 알려준다 (막지는 않는다) */}
                    {dateEvents.length > 0 && (
                      <Banner
                        status="warning"
                        container="card"
                        title="이 날은 기관 행사가 있습니다"
                        description={dateEvents
                          .map((e) => `· ${e.title}${e.description ? ` — ${e.description}` : ''}`)
                          .join('\n')}
                      />
                    )}

                    {/* 휴무 종류 — 종류와 종일·반일 구분을 이 하나로 고른다 */}
                    <RadioList
                      label="휴무 종류"
                      value={vacationKind}
                      onChange={(value) => setVacationKind(value as VacationKind)}
                    >
                      {VACATION_KIND_OPTIONS.map((option) => (
                        <RadioListItem
                          key={option.value}
                          value={option.value}
                          label={option.label}
                          description={option.description}
                        />
                      ))}
                    </RadioList>

                    {/* 휴무 사유 */}
                    <TextArea
                      label="휴무 사유"
                      isRequired={vacationKind === 'mandatory'}
                      value={reason}
                      onChange={(value) => setReason(value)}
                      placeholder={
                        vacationKind === 'mandatory'
                          ? '휴무 사유를 입력해주세요 (필수)'
                          : '휴무 사유를 입력해주세요 (선택)'
                      }
                      rows={3}
                    />

                    {/* 운행 공백 경고 — 막지 않고, 한 번 더 누르면 그대로 등록된다 */}
                    {conflictWarning && (
                      <Banner
                        status="error"
                        title="이 날 운행할 운전자가 없습니다"
                        description={conflictWarning}
                      />
                    )}

                    {/* 에러 메시지 */}
                    {error && (
                      <Banner status="error" title={error} />
                    )}
                  </VStack>
                </motion.div>
              )}
            </AnimatePresence>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign={step === 'details' ? 'between' : 'end'}>
              {step === 'details' && (
                <Button label="이전" variant="ghost" onClick={handlePreviousStep} />
              )}
              <HStack gap={2}>
                <Button label="취소" variant="ghost" onClick={handleClose} />
                {step === 'member' ? (
                  <Button
                    label="다음 단계"
                    variant="primary"
                    isDisabled={!selectedMember}
                    onClick={handleNextStep}
                  />
                ) : (
                  <Button
                    label={conflictWarning ? '그래도 등록' : '휴무 신청 완료'}
                    variant={conflictWarning ? 'destructive' : 'primary'}
                    isLoading={isSubmitting}
                    isDisabled={isSubmitting}
                    onClick={handleSubmit}
                  />
                )}
              </HStack>
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
};

export default AdminVacationAddModal;
