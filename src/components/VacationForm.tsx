import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { VacationFormProps, VacationKind, VACATION_KIND_OPTIONS, toVacationRequestFields } from '@/types/vacation';
import { FiBriefcase } from 'react-icons/fi';
import { useAlert } from './Alert';
import {
  ALL_ROLE_FILTER,
  getRoleDisplayName,
  getStoredUserRole,
  normalizeRoleKey,
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
import { getVacationCalendar } from '@/lib/apiService';
import { fetchDriverRoles } from '@/lib/dispatchSync';
import {
  VACATION_NOTICES,
  VACATION_NOTICE_LIST_CLASS,
  VACATION_NOTICE_LIST_STYLE,
  VACATION_NOTICE_TITLE,
  describeDriverConflicts,
  findConflictsFromRoles,
} from '@/lib/vacationGuard';

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
  const [kind, setKind] = useState<VacationKind>('regular');
  const [role, setRole] = useState('');
  const [errors, setErrors] = useState({
    userName: '',
    reason: '',
    password: '',
    role: '',
  });
  /** 운행 공백 경고 — 막지 않고 한 번 확인만 받는다 */
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false);

  /**
   * 그날 이미 휴무인 사람 중 같은 노선의 다른 운전자가 있는지 확인한다.
   * 배차 설정은 회사 공용이라 서버에 묻는다. 배정되지 않은 직원이면 바로 통과.
   */
  const checkDriverConflicts = async (name: string, date: string) => {
    const roles = await fetchDriverRoles(name);
    if (roles.length === 0) return [];
    try {
      const data = await getVacationCalendar(date, date);
      const list: unknown[] = Array.isArray(data) ? data : (data?.vacations ?? data?.content ?? data?.data ?? []);
      const names = list
        .map((raw) => {
          const v = raw as { userName?: string; memberName?: string; name?: string; status?: string };
          if (v.status && v.status.toUpperCase() === 'REJECTED') return '';
          return v.userName || v.memberName || v.name || '';
        })
        .filter(Boolean);
      return findConflictsFromRoles(roles, names);
    } catch (err) {
      // 조회 실패로 신청 자체를 막지는 않는다 (배차는 보조 규칙)
      console.error('[휴무] 배차 충돌 확인 실패:', err);
      return [];
    }
  };

  const selectableRoles = useMemo(() => {
    const resolvedRoles: string[] = [];
    const seen = new Set<string>();

    const addRole = (value?: string | null) => {
      const trimmedValue = normalizeRoleKey(value);
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

    if (kind === 'mandatory' && !reason.trim()) {
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

        // 그날 그 노선을 몰 사람이 없어지면 알린다. 막지는 않고 한 번 확인만 받는다
        // (사정이 있을 수 있어 최종 판단은 관리자가 승인 단계에서 한다)
        const vacationDate = initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        if (!conflictAcknowledged) {
          const conflicts = await checkDriverConflicts(userName.trim(), vacationDate);
          if (conflicts.length > 0) {
            setConflictWarning(describeDriverConflicts(userName.trim(), conflicts));
            setConflictAcknowledged(true);
            setIsSubmitting(false);
            return;
          }
        }

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

        // 고른 종류 하나를 서버가 쓰는 type/duration으로 편다
        const { type, duration } = toVacationRequestFields(kind);

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

        // 서버가 알려준 사유(제한 인원 초과 등)를 그대로 보여준다 — 일반 문구로 덮으면
        // 왜 안 되는지 모른 채 반복 시도하게 된다
        const serverReason =
          error instanceof Error && error.message && !error.message.startsWith('API 응답 오류')
            ? error.message
            : null;
        showAlert({
          type: 'error',
          title: '휴무 신청 실패',
          message: serverReason ?? '휴무 신청 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.'
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

            {/* 신청 전 필수 숙지 — 배차·최소 인원처럼 시스템이 다 막지 못하는 부분이라 강한 색으로 강조 */}
            <Banner status="error" container="card" title={VACATION_NOTICE_TITLE} defaultIsExpanded>
              <ul className={VACATION_NOTICE_LIST_CLASS} style={VACATION_NOTICE_LIST_STYLE}>
                {VACATION_NOTICES.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
            </Banner>

            {conflictWarning && (
              <Banner
                status="error"
                container="card"
                title="이 날 운행할 운전자가 없습니다"
                description={conflictWarning}
              />
            )}

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

                {/* 휴무 종류 — 종류와 종일·반일 구분을 이 하나로 고른다 */}
                <Selector
                  label="휴무 종류"
                  options={VACATION_KIND_OPTIONS.map((option) => ({
                    value: option.value,
                    label: `${option.label} · ${option.description}`,
                  }))}
                  value={kind}
                  onChange={(value) => setKind(value as VacationKind)}
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
                  placeholder={kind === 'mandatory' ? '휴무 사유를 입력하세요' : '휴무 사유를 입력하세요 (선택 사항)'}
                  isRequired={kind === 'mandatory'}
                  isOptional={kind !== 'mandatory'}
                  isDisabled={isSubmitting}
                  status={errors.reason ? { type: 'error', message: errors.reason } : undefined}
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
                    label={isSubmitting ? '처리 중...' : conflictWarning ? '그래도 신청' : '신청하기'}
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
