'use client';
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { VacationDetailsProps, VacationRequest, VACATION_DURATION_OPTIONS } from '@/types/vacation';
import VacationForm from './VacationForm';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCalendar, FiUsers, FiClock, FiCheck, FiAlertCircle, FiSend, FiUser, FiBriefcase, FiUserPlus, FiTrash2, FiLock } from 'react-icons/fi';

const VacationDetails: React.FC<VacationDetailsProps> = ({
  date,
  vacations = [],
  onClose,
  onApplyVacation,
  isLoading = false,
  maxPeople = 5,
  onVacationUpdated,
  roleFilter,
  isAdmin = false,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [sortedVacations, setSortedVacations] = useState<VacationRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedVacation, setSelectedVacation] = useState<VacationRequest | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // 휴무 요청을 상태별로 정렬 (승인됨 -> 대기중 -> 거부됨)
    const sorted = [...vacations].sort((a, b) => {
      if (a.status === 'approved' && b.status !== 'approved') return -1;
      if (a.status !== 'approved' && b.status === 'approved') return 1;
      if (a.status === 'pending' && b.status === 'rejected') return -1;
      if (a.status === 'rejected' && b.status === 'pending') return 1;
      return 0;
    });
    setSortedVacations(sorted);
  }, [vacations]);

  const handleApplyClick = () => {
    setShowForm(true);
    // VacationCalendar에서 휴무 신청 버튼을 클릭했을 때 호출되는 콜백은 여기서는 호출하지 않음
  };

  const handleFormSuccess = async () => {
    setShowForm(false);
    if (onVacationUpdated) {
      await onVacationUpdated();
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
  };

  const handleDeleteClick = (vacation: VacationRequest) => {
    setSelectedVacation(vacation);
    setShowDeleteModal(true);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleDeleteModalClose = () => {
    setShowDeleteModal(false);
    setSelectedVacation(null);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleDeleteVacation = async () => {
    if (!selectedVacation) return;

    if (!deletePassword.trim()) {
      setDeleteError('비밀번호를 입력해주세요');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      // JWT 토큰 가져오기
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // JWT 토큰이 있으면 Authorization 헤더 추가
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/vacation/delete/${selectedVacation.id}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          password: deletePassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '삭제 중 오류가 발생했습니다');
      }

      // 성공적으로 삭제됨
      setShowDeleteModal(false);
      setSelectedVacation(null);
      setDeletePassword('');
      
      // 데이터 새로고침
      if (onVacationUpdated) {
        await onVacationUpdated();
      }
    } catch (error) {
      console.error('휴가 삭제 중 오류:', error);
      if (error instanceof Error) {
        if (error.message.includes('비밀번호가 일치하지 않습니다')) {
          setDeleteError('비밀번호가 일치하지 않습니다');
        } else {
          setDeleteError(error.message || '삭제 중 오류가 발생했습니다');
        }
      } else {
        setDeleteError('삭제 중 오류가 발생했습니다');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // 휴가 기간 텍스트 가져오기
  const getDurationText = (duration?: string) => {
    const option = VACATION_DURATION_OPTIONS.find(opt => opt.value === duration);
    return option ? option.displayName : '연차';
  };

  // 휴무 유형 한글 변환
  const getVacationTypeText = (type?: string) => {
    switch (type) {
      case 'regular':
        return '일반 휴무';
      case 'mandatory':
        return '필수 휴무';
      case 'personal':
        return '개인 휴무';
      case 'sick':
        return '병가';
      case 'emergency':
        return '긴급 휴무';
      case 'family':
        return '가족 돌봄 휴무';
      default:
        return type || '일반 휴무';
    }
  };

  // 상태 한글 변환
  const getStatusText = (status?: string) => {
    switch (status) {
      case 'approved':
        return '승인됨';
      case 'pending':
        return '대기중';
      case 'rejected':
        return '거부됨';
      default:
        return status || '알 수 없음';
    }
  };

  // 역할 한글 변환
  const getRoleText = (role?: string) => {
    switch (role) {
      case 'caregiver':
        return '요양보호사';
      case 'office':
        return '사무직';
      case 'admin':
        return '관리자';
      default:
        return role || '직원';
    }
  };

  // 유효한(승인됨 또는 대기중) 휴무 수 계산
  const validVacationCount = vacations.filter(v => v.status !== 'rejected').length;
  const remainingSlots = maxPeople - validVacationCount;
  const isFull = remainingSlots <= 0;

  // roleFilter가 'all'인지 확인
  const shouldShowVacationLimit = roleFilter !== 'all';

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl overflow-hidden w-full max-w-md"
      >
        {isLoading ? (
          <div className="p-4 sm:p-8 flex flex-col items-center justify-center h-48 sm:h-64">
            <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3 sm:mb-4"></div>
            <p className="text-gray-600 font-medium text-sm sm:text-base">로딩 중...</p>
          </div>
        ) : showForm ? (
          <VacationForm
            initialDate={date}
            onSubmitSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
            roleFilter={roleFilter}
          />
        ) : (
          <>
            <div className="p-5 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex justify-between items-center">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center">
                  <span className="bg-blue-500 text-white p-1.5 sm:p-2 rounded-md mr-2 sm:mr-3 flex items-center justify-center">
                    <FiCalendar size={18} className="sm:w-5 sm:h-5" />
                  </span>
                  휴무 상세 정보
                </h2>
                <button 
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="닫기"
                >
                  <FiX size={20} className="sm:w-6 sm:h-6" />
                </button>
              </div>
              
              <div className="mt-4 sm:mt-5 flex items-center justify-center p-3 sm:p-4 bg-white rounded-lg shadow-sm border border-blue-100">
                <h3 className="text-blue-800 font-medium text-base sm:text-lg">
                  {date && format(date, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
                </h3>
              </div>
            </div>
            
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <div className="flex items-center text-gray-700">
                  <FiUsers className="mr-2 sm:mr-3" size={18} />
                  <span className="font-medium text-sm sm:text-base">휴무 신청 현황</span>
                </div>
                {shouldShowVacationLimit && (
                  <div className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium flex items-center ${
                    isFull ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-green-100 text-green-600 border border-green-200'
                  }`}>
                    {isFull ? (
                      <FiAlertCircle className="mr-1.5 sm:mr-2 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    ) : (
                      <FiCheck className="mr-1.5 sm:mr-2 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                    {validVacationCount}/{maxPeople}명
                  </div>
                )}
              </div>
              
              {sortedVacations.length > 0 ? (
                <div className="max-h-48 sm:max-h-64 overflow-y-auto mb-4 sm:mb-5 pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  <ul className="space-y-3 sm:space-y-4">
                    {sortedVacations.map((vacation) => (
                      <motion.li 
                        key={vacation.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative"
                      >
                        <div className="flex justify-between items-center mb-2 sm:mb-3">
                          <div className="font-medium text-gray-800 text-sm sm:text-base flex items-center">
                            {vacation.userName}
                            {vacation.status === 'approved' && (
                              <span className="ml-2 text-green-500">
                                <FiCheck size={16} />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-full font-medium flex items-center ${
                              vacation.status === 'approved' 
                                ? 'bg-green-100 text-green-600 border border-green-200' 
                                : vacation.status === 'pending' 
                                  ? 'bg-yellow-100 text-yellow-600 border border-yellow-200'
                                  : 'bg-red-100 text-red-600 border border-red-200'
                            }`}>
                              {getStatusText(vacation.status)}
                            </span>
                            <button 
                              onClick={() => handleDeleteClick(vacation)} 
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                              aria-label="휴가 삭제"
                              title="휴가 삭제"
                            >
                              <FiTrash2 size={16} className="sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mt-2">
                          {/* 휴가 기간 뱃지 */}
                          <div className="inline-flex items-center text-xs sm:text-sm px-2.5 py-1 rounded-md border border-purple-200 bg-purple-50 text-purple-700">
                            <span>{getDurationText(vacation.duration)}</span>
                          </div>
                          
                          {/* 휴무 유형 뱃지 */}
                          <div className="inline-flex items-center text-xs sm:text-sm px-2.5 py-1 rounded-md border border-gray-200 bg-white">
                            <FiClock className="mr-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" />
                            <span className="text-gray-700">{getVacationTypeText(vacation.type)}</span>
                          </div>
                          
                          {/* 직원 유형 뱃지 */}
                          <div className={`inline-flex items-center text-xs sm:text-sm px-2.5 py-1 rounded-md border ${
                            vacation.role === 'caregiver' 
                              ? 'bg-blue-50 text-blue-700 border-blue-100' 
                              : vacation.role === 'office' 
                                ? 'bg-green-50 text-green-700 border-green-100' 
                                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          }`}>
                            {vacation.role === 'caregiver' ? (
                              <FiUser className="mr-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            ) : (
                              <FiBriefcase className="mr-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                            <span>{getRoleText(vacation.role)}</span>
                          </div>
                          
                          {vacation.reason && (
                            <div className="w-full mt-2 text-xs sm:text-sm text-gray-600 bg-white p-2 rounded-md border border-gray-200">
                              <strong className="text-gray-700 mr-1">사유:</strong> {vacation.reason}
                            </div>
                          )}
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 sm:py-8 bg-gray-50 rounded-lg border border-gray-200 mb-4 sm:mb-5">
                  <FiCalendar size={24} className="text-gray-400 mb-2" />
                  <p className="text-gray-500 text-sm sm:text-base">이 날짜에 신청된 휴무가 없습니다.</p>
                </div>
              )}
              
              {!isAdmin && !isFull && (
                <button
                  onClick={handleApplyClick}
                  className="w-full py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center"
                >
                  <FiSend className="mr-2" size={18} />
                  휴무 신청하기
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={handleDeleteModalClose}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start mb-4">
                <div className="bg-red-100 p-2 rounded-full mr-3">
                  <FiLock size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">휴무 삭제 확인</h3>
                  <p className="text-gray-600 text-sm">
                    {selectedVacation?.userName}님의 {selectedVacation?.date} 휴무를 삭제하시려면 비밀번호를 입력해주세요.
                  </p>
                </div>
              </div>
              
              <div className="mb-4">
                <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                <input
                  type="password"
                  id="deletePassword"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password"
                />
                {deleteError && (
                  <p className="mt-1 text-sm text-red-600">{deleteError}</p>
                )}
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleDeleteModalClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  disabled={isDeleting}
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteVacation}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      처리중...
                    </>
                  ) : (
                    <>
                      <FiTrash2 className="mr-1.5" size={16} />
                      삭제하기
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VacationDetails; 