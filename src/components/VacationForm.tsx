import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { VacationFormProps, VacationDuration, VACATION_DURATION_OPTIONS } from '@/types/vacation';
import { FiBriefcase, FiCalendar, FiClock } from 'react-icons/fi';
import { useAlert } from './Alert';
import {
  ALL_ROLE_FILTER,
  getRoleBadgeClasses,
  getRoleDisplayName,
  getStoredUserRole,
} from '@/lib/roleUtils';

const VacationForm: React.FC<VacationFormProps> = ({ 
  initialDate, 
  onSubmitSuccess,
  onCancel,
  isSubmitting,
  setIsSubmitting,
  roleFilter = ALL_ROLE_FILTER,
  roleOptions = [],
}) => {
  const { showAlert, AlertContainer } = useAlert();
  const [userName, setUserName] = useState('');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [type, setType] = useState<'regular' | 'mandatory'>('regular');
  const [role, setRole] = useState('');
  const [duration, setDuration] = useState<VacationDuration>('FULL_DAY');
  const [errors, setErrors] = useState({
    userName: '',
    reason: '',
    password: '',
    role: '',
  });

  const selectableRoles = useMemo(() => {
    const resolvedRoles: string[] = [];
    const seen = new Set<string>();

    const addRole = (value?: string | null) => {
      const trimmedValue = value?.trim();
      if (!trimmedValue || trimmedValue === ALL_ROLE_FILTER || seen.has(trimmedValue)) {
        return;
      }

      seen.add(trimmedValue);
      resolvedRoles.push(trimmedValue);
    };

    if (roleFilter !== ALL_ROLE_FILTER) {
      addRole(roleFilter);
    }

    roleOptions.forEach((roleOption) => {
      addRole(roleOption);
    });

    addRole(getStoredUserRole());

    if (resolvedRoles.length === 0) {
      addRole('caregiver');
      addRole('office');
    }

    return resolvedRoles;
  }, [roleFilter, roleOptions]);

  useEffect(() => {
    if (roleFilter !== ALL_ROLE_FILTER) {
      setRole(roleFilter);
      return;
    }

    setRole((currentRole) => {
      if (currentRole && selectableRoles.includes(currentRole)) {
        return currentRole;
      }

      return selectableRoles[0] || '';
    });
  }, [roleFilter, selectableRoles]);

  const validate = (): boolean => {
    const newErrors = {
      userName: '',
      reason: '',
      password: '',
      role: '',
    };
    let isValid = true;

    if (!userName.trim()) {
      newErrors.userName = '이름을 입력해주세요';
      isValid = false;
    }

    if (type === 'mandatory' && !reason.trim()) {
      newErrors.reason = '휴무 사유를 입력해주세요';
      isValid = false;
    }
    
    if (!password.trim()) {
      newErrors.password = '비밀번호를 입력해주세요';
      isValid = false;
    }

    if (!role.trim()) {
      newErrors.role = '역할을 선택해주세요';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validate()) {
      try {
        setIsSubmitting(true);
        
        // 현재 호스트 기반 절대 URL 사용
        const baseUrl = window.location.origin;
        const apiUrl = `${baseUrl}/api/vacation/request`;
        
        // JWT 토큰 가져오기
        const token = localStorage.getItem('authToken');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        // JWT 토큰이 있으면 Authorization 헤더 추가
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        // fetch API를 사용하여 휴무 신청
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            userName: userName.trim(),
            reason: reason.trim(),
            password: password.trim(),
            type,
            role,
            duration,
            date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API 응답 오류: ${response.status}`);
        }
        
        // 성공 콜백 호출
        onSubmitSuccess();
      } catch (error) {
        console.error('휴무 신청 오류:', error);
        
        if (error instanceof Error) {
          console.error('에러 메시지:', error.message);
          console.error('에러 스택:', error.stack);
        }
        
        showAlert({
          type: 'error',
          title: '휴무 신청 실패',
          message: '휴무 신청 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.'
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      <AlertContainer />
      <div className="bg-white rounded-lg shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
      {/* 헤더 */}
      <div className="border-b pb-3 sm:pb-4 mb-4 sm:mb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">
          휴무 신청
        </h2>
        <p className="text-sm sm:text-base text-gray-600">
          {initialDate && (
            <span className="text-teal-600 font-medium">
              {format(initialDate, 'yyyy년 MM월 dd일', { locale: ko })}
            </span>
          )} 휴무를 신청합니다
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <div>
          <label htmlFor="userName" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            이름 *
          </label>
          <input
            type="text"
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base text-gray-900 font-medium ${
              errors.userName ? 'border-red-500' : 'border-gray-200'
            }`}
            placeholder="이름을 입력하세요"
            autoFocus
            disabled={isSubmitting}
          />
          {errors.userName && (
            <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.userName}</p>
          )}
        </div>
        
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
            휴가 기간 *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {VACATION_DURATION_OPTIONS.map((option) => (
              <label 
                key={option.value}
                className={`flex items-center p-3 sm:p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                  duration === option.value ? 'bg-teal-50 border-teal-200 ring-1 ring-teal-300' : ''
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="duration"
                  value={option.value}
                  checked={duration === option.value}
                  onChange={() => setDuration(option.value)}
                  className="hidden"
                  disabled={isSubmitting}
                />
                <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 mr-3 ${
                  duration === option.value ? 'bg-teal-500 border-teal-500' : 'border-gray-300'
                }`}>
                  {duration === option.value && (
                    <div className="w-full h-full rounded-full bg-white scale-50"></div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-gray-700 font-medium text-xs sm:text-sm">
                    {option.displayName}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {option.description} ({option.days}일)
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
        
        <div>
          <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            비밀번호 * <span className="text-xs text-gray-500">(휴가 삭제시 필요)</span>
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base text-gray-900 font-medium ${
              errors.password ? 'border-red-500' : 'border-gray-200'
            }`}
            placeholder="비밀번호를 입력하세요"
            disabled={isSubmitting}
          />
          {errors.password && (
            <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.password}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="reason" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            휴무 사유{type === 'mandatory' && <span className="text-red-500 ml-0.5">*</span>}
            {type === 'regular' && <span className="text-gray-400 ml-1 text-xs">(선택 사항)</span>}
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base text-gray-900 font-medium ${
              errors.reason ? 'border-red-500' : 'border-gray-200'
            }`}
            rows={4}
            placeholder={type === 'mandatory' ? '휴무 사유를 입력하세요' : '휴무 사유를 입력하세요 (선택 사항)'}
            disabled={isSubmitting}
          />
          {errors.reason && (
            <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.reason}</p>
          )}
        </div>
        
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
            휴무 유형 *
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <label className={`flex items-center p-3 sm:p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${type === 'regular' ? 'bg-teal-50 border-teal-200' : ''} ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="vacationType"
                value="regular"
                checked={type === 'regular'}
                onChange={() => setType('regular')}
                className="h-5 w-5 text-teal-500 focus:ring-teal-500 border-gray-300 hidden"
                disabled={isSubmitting}
              />
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full mr-2 sm:mr-3 flex items-center justify-center ${type === 'regular' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <FiCalendar size={16} />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm">일반 휴무</span>
            </label>
            <label className={`flex items-center p-3 sm:p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${type === 'mandatory' ? 'bg-green-50 border-green-200' : ''} ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="vacationType"
                value="mandatory"
                checked={type === 'mandatory'}
                onChange={() => setType('mandatory')}
                className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 hidden"
                disabled={isSubmitting}
              />
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full mr-2 sm:mr-3 flex items-center justify-center ${type === 'mandatory' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <FiClock size={16} />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm">필수 휴무</span>
            </label>
          </div>
        </div>
        
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
            직원 역할 *
          </label>
          {selectableRoles.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {selectableRoles.map((roleOption) => {
                const isSelected = role === roleOption;
                const badgeClasses = getRoleBadgeClasses(roleOption);
                const isLockedRole =
                  roleFilter !== ALL_ROLE_FILTER && roleFilter !== roleOption;

                return (
                  <label
                    key={roleOption}
                    className={`flex flex-col items-center p-2 sm:p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? `${badgeClasses} ring-1 ring-current`
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    } ${isSubmitting || isLockedRole ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="roleType"
                      value={roleOption}
                      checked={isSelected}
                      onChange={() => setRole(roleOption)}
                      className="hidden"
                      disabled={isSubmitting || isLockedRole}
                    />
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1 sm:mb-2 ${
                      isSelected ? 'bg-white/70 text-current' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <FiBriefcase size={20} className="sm:w-5 sm:h-5" />
                    </div>
                    <span className="font-medium text-xs sm:text-sm text-center">
                      {getRoleDisplayName(roleOption)}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs sm:text-sm text-amber-700">
              사용할 역할이 없습니다. 회원관리의 역할관리에서 역할을 먼저 등록해주세요.
            </div>
          )}
          {errors.role && (
            <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.role}</p>
          )}
          </div>

        <div className="flex justify-end space-x-2 sm:space-x-3 pt-4 sm:pt-5 border-t mt-4 sm:mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            className={`px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors shadow-md ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                처리 중...
              </span>
            ) : (
              '신청하기'
            )}
          </button>
        </div>
      </form>
      </div>
    </>
  );
};

export default VacationForm; 
