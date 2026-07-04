import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { VacationFormProps, VacationDuration, VACATION_DURATION_OPTIONS } from '@/types/vacation';
import { FiBriefcase, FiCalendar, FiClock } from 'react-icons/fi';
import { useAlert } from './Alert';
import {
  ALL_ROLE_FILTER,
  getRoleDisplayName,
  getStoredUserRole,
} from '@/lib/roleUtils';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { Banner } from '@astryxdesign/core/Banner';
import { Divider } from '@astryxdesign/core/Divider';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';

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
      <div style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <Card padding={5}>
          <VStack gap={5}>
            {/* 헤더 */}
            <VStack gap={1}>
              <Text type="display-3" weight="bold">휴무 신청</Text>
              <Text type="supporting">
                {initialDate && (
                  <Text as="span" color="accent" weight="medium">
                    {format(initialDate, 'yyyy년 MM월 dd일', { locale: ko })}
                  </Text>
                )}{' '}휴무를 신청합니다
              </Text>
            </VStack>

            <Divider />

            <form onSubmit={handleSubmit}>
              <VStack gap={4}>
                <TextInput
                  label="이름"
                  value={userName}
                  onChange={(value) => setUserName(value)}
                  placeholder="이름을 입력하세요"
                  isRequired
                  hasAutoFocus
                  isDisabled={isSubmitting}
                  status={errors.userName ? { type: 'error', message: errors.userName } : undefined}
                />

                <Selector
                  label="휴가 기간"
                  options={VACATION_DURATION_OPTIONS.map((option) => ({
                    value: option.value,
                    label: `${option.displayName} · ${option.description} (${option.days}일)`,
                  }))}
                  value={duration}
                  onChange={(value) => setDuration(value as VacationDuration)}
                  isRequired
                  isDisabled={isSubmitting}
                />

                <TextInput
                  label="비밀번호"
                  type="password"
                  value={password}
                  onChange={(value) => setPassword(value)}
                  placeholder="비밀번호를 입력하세요"
                  description="휴가 삭제시 필요"
                  isRequired
                  isDisabled={isSubmitting}
                  status={errors.password ? { type: 'error', message: errors.password } : undefined}
                />

                <TextArea
                  label="휴무 사유"
                  value={reason}
                  onChange={(value) => setReason(value)}
                  rows={4}
                  placeholder={type === 'mandatory' ? '휴무 사유를 입력하세요' : '휴무 사유를 입력하세요 (선택 사항)'}
                  isRequired={type === 'mandatory'}
                  isOptional={type === 'regular'}
                  isDisabled={isSubmitting}
                  status={errors.reason ? { type: 'error', message: errors.reason } : undefined}
                />

                <Selector
                  label="휴무 유형"
                  options={[
                    { value: 'regular', label: '일반 휴무', icon: FiCalendar },
                    { value: 'mandatory', label: '필수 휴무', icon: FiClock },
                  ]}
                  value={type}
                  onChange={(value) => setType(value as 'regular' | 'mandatory')}
                  isRequired
                  isDisabled={isSubmitting}
                />

                {selectableRoles.length > 0 ? (
                  <Selector
                    label="직원 역할"
                    options={selectableRoles.map((roleOption) => ({
                      value: roleOption,
                      label: getRoleDisplayName(roleOption),
                      icon: FiBriefcase,
                      disabled:
                        isSubmitting ||
                        (roleFilter !== ALL_ROLE_FILTER && roleFilter !== roleOption),
                    }))}
                    value={role}
                    onChange={(value) => setRole(value)}
                    isRequired
                    isDisabled={isSubmitting}
                    status={errors.role ? { type: 'error', message: errors.role } : undefined}
                  />
                ) : (
                  <Banner
                    status="warning"
                    title="사용할 역할이 없습니다"
                    description="회원관리의 역할관리에서 역할을 먼저 등록해주세요."
                  />
                )}

                <Divider />

                <HStack gap={2} hAlign="end">
                  <Button
                    label="취소"
                    variant="secondary"
                    type="button"
                    onClick={onCancel}
                    isDisabled={isSubmitting}
                  />
                  <Button
                    label={isSubmitting ? '처리 중...' : '신청하기'}
                    variant="primary"
                    type="submit"
                    isLoading={isSubmitting}
                    isDisabled={isSubmitting}
                  />
                </HStack>
              </VStack>
            </form>
          </VStack>
        </Card>
      </div>
    </>
  );
};

export default VacationForm;
