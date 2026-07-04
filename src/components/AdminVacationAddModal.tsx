"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import MemberSelector from './MemberSelector';
import { VacationDuration, VACATION_DURATION_OPTIONS } from '@/types/vacation';
import { adminCreateVacationForMember } from '@/lib/apiService';
import type { Member } from './MemberSelector';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Avatar } from '@astryxdesign/core/Avatar';
import { DateInput } from '@astryxdesign/core/DateInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Switch } from '@astryxdesign/core/Switch';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { Selector } from '@astryxdesign/core/Selector';
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
  const [vacationKind, setVacationKind] = useState<'regular' | 'mandatory'>('regular');
  const [useAnnualLeave, setUseAnnualLeave] = useState(true);
  const [duration, setDuration] = useState<VacationDuration>('FULL_DAY');
  const [vacationType, setVacationType] = useState<string>('personal');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 휴무 유형 옵션들
  const vacationTypes = [
    { value: 'personal', label: '개인 사유' },
    { value: 'sick', label: '병가' },
    { value: 'emergency', label: '긴급 상황' },
    { value: 'family', label: '가족 돌봄' },
    { value: 'other', label: '기타' },
  ];

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
      const token = localStorage.getItem('authToken');
      const companyId = localStorage.getItem('companyId');

      if (!companyId) {
        throw new Error('회사 ID를 찾을 수 없습니다.');
      }

      const requestBody = {
        memberId: parseInt(selectedMember!.id, 10), // Long 타입으로 변환
        date: vacationDate,
        reason: reason.trim() || null,
        duration: useAnnualLeave ? duration : 'UNUSED',
        type: vacationKind,
        useAnnualLeave,
        vacationType: !useAnnualLeave ? vacationType : null,
        reasonRequired: vacationKind === 'mandatory',
      };

      console.log('휴무 신청 요청 데이터:', {
        requestBody,
        companyId, // 별도로 로깅
      });

      await adminCreateVacationForMember({
        memberId: requestBody.memberId.toString(),
        date: requestBody.date,
        reason: requestBody.reason || undefined,
        duration: requestBody.duration,
        type: requestBody.type,
        useAnnualLeave: requestBody.useAnnualLeave,
        vacationType: requestBody.vacationType || undefined,
        reasonRequired: requestBody.reasonRequired,
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
    setUseAnnualLeave(true);
    setDuration('FULL_DAY');
    setVacationType('personal');
    setReason('');
    setError(null);
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
                        <Avatar name={selectedMember?.name} />
                        <VStack gap={0.5}>
                          <Text type="body" weight="medium">{selectedMember?.name}</Text>
                          <Text type="supporting" color="secondary">{selectedMember?.email}</Text>
                        </VStack>
                      </HStack>
                    </Card>

                    {/* 날짜 선택 */}
                    <DateInput
                      label="휴무 날짜"
                      value={vacationDate ? (vacationDate as ISODateString) : undefined}
                      onChange={(value) => setVacationDate(value || '')}
                    />

                    {/* 휴무 종류 */}
                    <VStack gap={1.5}>
                      <Text type="label" weight="medium">휴무 종류</Text>
                      <SegmentedControl
                        label="휴무 종류"
                        layout="fill"
                        value={vacationKind}
                        onChange={(value) => setVacationKind(value as 'regular' | 'mandatory')}
                      >
                        <SegmentedControlItem value="regular" label="일반 휴무" />
                        <SegmentedControlItem value="mandatory" label="필수 휴무" />
                      </SegmentedControl>
                    </VStack>

                    {/* 연차 사용 여부 */}
                    <Switch
                      label="연차 사용 여부"
                      value={useAnnualLeave}
                      onChange={(checked) => setUseAnnualLeave(checked)}
                      labelPosition="start"
                      labelSpacing="spread"
                    />

                    {/* 연차 유형 - 연차 사용 시만 표시 */}
                    {useAnnualLeave && (
                      <RadioList
                        label="연차 유형"
                        value={duration}
                        onChange={(value) => setDuration(value as VacationDuration)}
                      >
                        {VACATION_DURATION_OPTIONS.map((option) => (
                          <RadioListItem
                            key={option.value}
                            value={option.value}
                            label={option.displayName}
                            description={option.description}
                          />
                        ))}
                      </RadioList>
                    )}

                    {/* 휴무 유형 - 연차 미사용 시만 표시 */}
                    {!useAnnualLeave && (
                      <Selector
                        label="휴무 유형"
                        value={vacationType}
                        options={vacationTypes}
                        onChange={(value) => setVacationType(value)}
                      />
                    )}

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
                    label="휴무 신청 완료"
                    variant="primary"
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
