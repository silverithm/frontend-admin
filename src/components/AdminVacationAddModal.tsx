"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import MemberSelector from './MemberSelector';
import { FiX, FiCalendar, FiClock, FiAlertCircle } from 'react-icons/fi';
import { VacationDuration, VACATION_DURATION_OPTIONS } from '@/types/vacation';

interface Member {
  id: string;
  name: string;
  email: string;
  role: 'caregiver' | 'office' | 'admin';
  status: string;
}

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

    // 필수 휴무이거나 연차 사용 시 사유 필수
    if ((vacationKind === 'mandatory' || useAnnualLeave) && !reason.trim()) {
      setError('휴무 사유를 입력해주세요.');
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
        memberId: selectedMember!.id,
        date: vacationDate,
        reason: reason.trim() || undefined,
        duration: useAnnualLeave ? duration : 'UNUSED',
        type: vacationKind,
        useAnnualLeave,
        vacationType: !useAnnualLeave ? vacationType : undefined,
        reasonRequired: vacationKind === 'mandatory',
      };

      const response = await fetch('/api/vacation/admin/submit-for-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          ...requestBody,
          companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '휴무 신청에 실패했습니다.');
      }

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {step === 'member' ? '직원 선택' : '휴무 정보 입력'}
                </h2>
                <button
                  onClick={handleClose}
                  className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
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
                    className="space-y-6"
                  >
                    {/* 선택된 직원 정보 */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">선택된 직원:</span> {selectedMember?.name}
                      </p>
                    </div>

                    {/* 날짜 선택 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FiCalendar className="inline-block w-4 h-4 mr-1" />
                        휴무 날짜
                      </label>
                      <input
                        type="date"
                        value={vacationDate}
                        onChange={(e) => setVacationDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* 휴무 종류 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        휴무 종류
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="regular"
                            checked={vacationKind === 'regular'}
                            onChange={(e) => setVacationKind(e.target.value as 'regular' | 'mandatory')}
                            className="mr-2"
                          />
                          <span>일반 휴무</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="mandatory"
                            checked={vacationKind === 'mandatory'}
                            onChange={(e) => setVacationKind(e.target.value as 'regular' | 'mandatory')}
                            className="mr-2"
                          />
                          <span>필수 휴무</span>
                        </label>
                      </div>
                    </div>

                    {/* 연차 사용 여부 */}
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={useAnnualLeave}
                          onChange={(e) => setUseAnnualLeave(e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium text-gray-700">연차 사용</span>
                      </label>
                    </div>

                    {/* 연차 사용 시 */}
                    {useAnnualLeave && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <FiClock className="inline-block w-4 h-4 mr-1" />
                          연차 유형
                        </label>
                        <div className="space-y-2">
                          {VACATION_DURATION_OPTIONS.map((option) => (
                            <label key={option.value} className="flex items-center">
                              <input
                                type="radio"
                                value={option.value}
                                checked={duration === option.value}
                                onChange={(e) => setDuration(e.target.value as VacationDuration)}
                                className="mr-2"
                              />
                              <span>{option.displayName} - {option.description}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 연차 미사용 시 */}
                    {!useAnnualLeave && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          휴무 유형
                        </label>
                        <select
                          value={vacationType}
                          onChange={(e) => setVacationType(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {vacationTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 휴무 사유 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        휴무 사유
                        {(vacationKind === 'mandatory' || useAnnualLeave) && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={
                          vacationKind === 'mandatory' || useAnnualLeave
                            ? '휴무 사유를 입력해주세요 (필수)'
                            : '휴무 사유를 입력해주세요 (선택)'
                        }
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    {/* 에러 메시지 */}
                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                        <FiAlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-2" />
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between">
                {step === 'details' && (
                  <button
                    onClick={handlePreviousStep}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    이전
                  </button>
                )}
                <div className={`flex gap-2 ${step === 'member' ? 'ml-auto' : ''}`}>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  {step === 'member' ? (
                    <button
                      onClick={handleNextStep}
                      disabled={!selectedMember}
                      className={`px-4 py-2 font-medium text-white rounded-lg transition-colors ${
                        selectedMember
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-gray-400 cursor-not-allowed'
                      }`}
                    >
                      다음
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={`px-6 py-2 font-medium text-white rounded-lg transition-colors ${
                        isSubmitting
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {isSubmitting ? '신청 중...' : '휴무 신청'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AdminVacationAddModal;