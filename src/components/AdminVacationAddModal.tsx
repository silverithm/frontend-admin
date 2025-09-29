"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import MemberSelector from './MemberSelector';
import { FiX, FiCalendar, FiClock, FiAlertCircle, FiCheck } from 'react-icons/fi';
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
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {step === 'member' ? '직원 선택' : '휴무 정보 입력'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {step === 'member' ? '휴무를 신청할 직원을 선택해주세요' : '휴무 상세 정보를 입력해주세요'}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-400" />
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
                    <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-2xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {selectedMember?.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{selectedMember?.name}</p>
                          <p className="text-xs text-gray-500">{selectedMember?.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* 날짜 선택 */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200">
                      <label className="block text-sm font-semibold text-gray-900 mb-3">
                        <FiCalendar className="inline-block w-4 h-4 mr-2 text-blue-600" />
                        휴무 날짜
                      </label>
                      <input
                        type="date"
                        value={vacationDate}
                        onChange={(e) => setVacationDate(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      />
                    </div>

                    {/* 휴무 종류 */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200">
                      <label className="block text-sm font-semibold text-gray-900 mb-3">
                        휴무 종류
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className={`flex items-center justify-center px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                          vacationKind === 'regular'
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <input
                            type="radio"
                            value="regular"
                            checked={vacationKind === 'regular'}
                            onChange={(e) => setVacationKind(e.target.value as 'regular' | 'mandatory')}
                            className="sr-only"
                          />
                          <span className="font-medium">일반 휴무</span>
                        </label>
                        <label className={`flex items-center justify-center px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                          vacationKind === 'mandatory'
                            ? 'border-red-500 bg-red-50 text-red-600'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <input
                            type="radio"
                            value="mandatory"
                            checked={vacationKind === 'mandatory'}
                            onChange={(e) => setVacationKind(e.target.value as 'regular' | 'mandatory')}
                            className="sr-only"
                          />
                          <span className="font-medium">필수 휴무</span>
                        </label>
                      </div>
                    </div>

                    {/* 연차 사용 여부 - 가장 위로 이동 */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm font-semibold text-gray-900">연차 사용 여부</span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={useAnnualLeave}
                            onChange={(e) => setUseAnnualLeave(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-14 h-8 rounded-full transition-colors ${
                            useAnnualLeave ? 'bg-blue-500' : 'bg-gray-300'
                          }`}>
                            <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                              useAnnualLeave ? 'translate-x-6' : 'translate-x-0'
                            }`} />
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* 연차 유형 - 연차 사용 시만 표시 */}
                    {useAnnualLeave && (
                      <div className="bg-white p-5 rounded-2xl border border-gray-200">
                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                          <FiClock className="inline-block w-4 h-4 mr-2 text-blue-600" />
                          연차 유형
                        </label>
                        <div className="space-y-3">
                          {VACATION_DURATION_OPTIONS.map((option) => (
                            <label
                              key={option.value}
                              className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                duration === option.value
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="radio"
                                value={option.value}
                                checked={duration === option.value}
                                onChange={(e) => setDuration(e.target.value as VacationDuration)}
                                className="sr-only"
                              />
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className={`font-medium ${
                                    duration === option.value ? 'text-blue-600' : 'text-gray-900'
                                  }`}>
                                    {option.displayName}
                                  </p>
                                  <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                                </div>
                                {duration === option.value && (
                                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                    <FiCheck className="w-4 h-4 text-white" />
                                  </div>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 휴무 유형 - 연차 미사용 시만 표시 */}
                    {!useAnnualLeave && (
                      <div className="bg-white p-5 rounded-2xl border border-gray-200">
                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                          휴무 유형
                        </label>
                        <select
                          value={vacationType}
                          onChange={(e) => setVacationType(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
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
                    <div className="bg-white p-5 rounded-2xl border border-gray-200">
                      <label className="block text-sm font-semibold text-gray-900 mb-3">
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
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
                      />
                    </div>

                    {/* 에러 메시지 */}
                    {error && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start">
                        <FiAlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/50">
              <div className="flex justify-between items-center">
                {step === 'details' && (
                  <button
                    onClick={handlePreviousStep}
                    className="px-5 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-all hover:shadow-sm"
                  >
                    이전
                  </button>
                )}
                <div className={`flex gap-3 ${step === 'member' ? 'ml-auto' : ''}`}>
                  <button
                    onClick={handleClose}
                    className="px-5 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-all hover:shadow-sm"
                  >
                    취소
                  </button>
                  {step === 'member' ? (
                    <button
                      onClick={handleNextStep}
                      disabled={!selectedMember}
                      className={`px-6 py-2.5 font-medium text-white rounded-xl transition-all ${
                        selectedMember
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-sm hover:shadow-md'
                          : 'bg-gray-300 cursor-not-allowed'
                      }`}
                    >
                      다음 단계
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={`px-8 py-2.5 font-medium text-white rounded-xl transition-all flex items-center gap-2 ${
                        isSubmitting
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-sm hover:shadow-md'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          신청 중...
                        </>
                      ) : (
                        '휴무 신청 완료'
                      )}
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