'use client';
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { FiX, FiCalendar, FiUsers, FiSend, FiBriefcase, FiTrash2, FiLock } from 'react-icons/fi';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Icon } from '@astryxdesign/core/Icon';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { TextInput } from '@astryxdesign/core/TextInput';
import { VacationDetailsProps, VacationRequest, VACATION_DURATION_OPTIONS } from '@/types/vacation';
import VacationForm from './VacationForm';
import {
  ALL_ROLE_FILTER,
  getRoleDisplayName,
  getVacationRequestRole,
  type RoleLookup,
} from '@/lib/roleUtils';
import { deleteVacation as apiDeleteVacation } from '@/lib/apiService';

type VacationDetailsComponentProps = VacationDetailsProps & {
  roleOptions?: string[];
  memberRoleLookup?: RoleLookup;
};

type BadgeColorVariant =
  | 'neutral'
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'pink'
  | 'cyan';

// 직원 유형 뱃지의 Astryx 색상 변형 매핑 (표현용, roleUtils의 색상 의도를 반영)
const getRoleBadgeVariant = (role?: string | null): BadgeColorVariant => {
  const normalized = (role ?? '').trim();
  if (!normalized) return 'neutral';
  if (normalized === 'admin') return 'purple';
  if (normalized === 'caregiver') return 'blue';
  if (normalized === 'office') return 'green';

  const palette: BadgeColorVariant[] = ['blue', 'green', 'orange', 'purple', 'pink', 'cyan'];
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(index);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
};

const VacationDetails: React.FC<VacationDetailsComponentProps> = ({
  date,
  vacations = [],
  onClose,
  onApplyVacation,
  isLoading = false,
  maxPeople = 5,
  onVacationUpdated,
  roleFilter = ALL_ROLE_FILTER,
  isAdmin = false,
  roleOptions = [],
  memberRoleLookup,
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
      await apiDeleteVacation(selectedVacation.id, {
        isAdmin: true,
        password: deletePassword,
      });

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

  // 휴가 기간이 유효한지 확인하는 함수
  const isValidDuration = (duration?: string) => {
    return duration && VACATION_DURATION_OPTIONS.find(opt => opt.value === duration);
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

  // 상태별 Astryx Badge 색상 변형
  const getStatusBadgeVariant = (status?: string): BadgeColorVariant | 'yellow' | 'red' => {
    switch (status) {
      case 'approved':
        return 'green';
      case 'pending':
        return 'yellow';
      case 'rejected':
        return 'red';
      default:
        return 'neutral';
    }
  };

  // 유효한(승인됨 또는 대기중) 휴무 수 계산
  const validVacationCount = vacations.filter(v => v.status !== 'rejected').length;
  const remainingSlots = maxPeople - validVacationCount;
  const isFull = remainingSlots <= 0;

  // roleFilter가 'all'인지 확인
  const shouldShowVacationLimit = roleFilter !== ALL_ROLE_FILTER;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          width: '100%',
          maxWidth: 448,
          borderRadius: 16,
          overflow: 'hidden',
          background: 'var(--color-background-card)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        }}
      >
        {isLoading ? (
          <div
            style={{
              minHeight: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
            }}
          >
            <Spinner size="lg" label="로딩 중..." />
          </div>
        ) : showForm ? (
          <VacationForm
            initialDate={date}
            onSubmitSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
            roleFilter={roleFilter}
            roleOptions={roleOptions}
          />
        ) : (
          <>
            {/* 헤더 (브랜드 그라데이션) */}
            <div
              style={{
                padding: 24,
                background: 'linear-gradient(to right, #14b8a6, #0d9488)',
                color: '#ffffff',
              }}
            >
              <HStack hAlign="between" vAlign="center">
                <HStack gap={2} vAlign="center">
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      padding: 8,
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FiCalendar size={18} />
                  </span>
                  <Text type="large" weight="bold" color="inherit">휴무 상세 정보</Text>
                </HStack>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="닫기"
                  className="carev-vacdetails-icon-btn"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'rgba(255, 255, 255, 0.8)',
                    padding: 8,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FiX size={20} />
                </button>
              </HStack>

              <div
                style={{
                  marginTop: 20,
                  padding: 16,
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  textAlign: 'center',
                }}
              >
                <Text type="large" weight="medium" color="inherit">
                  {date && format(date, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
                </Text>
              </div>
            </div>

            {/* 본문 */}
            <div style={{ padding: 24 }}>
              <VStack gap={5}>
                <HStack hAlign="between" vAlign="center">
                  <HStack gap={2} vAlign="center">
                    <Icon icon={FiUsers} size="sm" color="secondary" />
                    <Text type="body" weight="medium">휴무 신청 현황</Text>
                  </HStack>
                  {shouldShowVacationLimit && (
                    <Badge
                      variant={isFull ? 'red' : 'green'}
                      icon={<Icon icon={isFull ? 'error' : 'check'} size="sm" />}
                      label={`${validVacationCount}/${maxPeople}명`}
                    />
                  )}
                </HStack>

                {sortedVacations.length > 0 ? (
                  <div style={{ maxHeight: 256, overflowY: 'auto', paddingRight: 4 }}>
                    <VStack gap={3}>
                      {sortedVacations.map((vacation) => {
                        const resolvedRole = getVacationRequestRole(vacation, memberRoleLookup);

                        return (
                          <motion.div
                            key={vacation.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <Card variant="muted" padding={3} width="100%">
                              <VStack gap={2}>
                                <HStack hAlign="between" vAlign="center">
                                  <HStack gap={1} vAlign="center">
                                    <Text type="body" weight="medium">{vacation.userName}</Text>
                                    {vacation.status === 'approved' && (
                                      <Icon icon="check" size="sm" color="success" />
                                    )}
                                  </HStack>
                                  <HStack gap={2} vAlign="center">
                                    <Badge
                                      variant={getStatusBadgeVariant(vacation.status)}
                                      label={getStatusText(vacation.status)}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteClick(vacation)}
                                      aria-label="휴가 삭제"
                                      title="휴가 삭제"
                                      className="carev-vacdetails-delete-btn"
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--color-text-gray)',
                                        padding: 6,
                                        borderRadius: '50%',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <FiTrash2 size={16} />
                                    </button>
                                  </HStack>
                                </HStack>

                                <HStack gap={2} wrap="wrap" vAlign="center">
                                  {/* 휴가 기간 뱃지 - 유효한 duration일 때만 표시 */}
                                  {isValidDuration(vacation.duration) && (
                                    <Badge variant="teal" label={getDurationText(vacation.duration)} />
                                  )}

                                  {/* 휴무 유형 뱃지 */}
                                  <Badge
                                    variant="neutral"
                                    icon={<Icon icon="clock" size="sm" />}
                                    label={getVacationTypeText(vacation.type)}
                                  />

                                  {/* 직원 유형 뱃지 */}
                                  <Badge
                                    variant={getRoleBadgeVariant(resolvedRole)}
                                    icon={<Icon icon={FiBriefcase} size="sm" />}
                                    label={getRoleDisplayName(resolvedRole)}
                                  />
                                </HStack>

                                {vacation.reason && (
                                  <div
                                    style={{
                                      background: 'var(--color-background-card)',
                                      padding: 8,
                                      borderRadius: 6,
                                      border: '1px solid var(--color-border)',
                                    }}
                                  >
                                    <Text type="supporting" color="secondary">
                                      <Text as="span" type="supporting" weight="semibold" color="primary">사유: </Text>
                                      {vacation.reason}
                                    </Text>
                                  </div>
                                )}
                              </VStack>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </VStack>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: 32,
                      background: 'var(--color-background-muted)',
                      borderRadius: 8,
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <VStack gap={2} hAlign="center">
                      <Icon icon={FiCalendar} size="lg" color="disabled" />
                      <Text type="body" color="secondary">이 날짜에 신청된 휴무가 없습니다.</Text>
                    </VStack>
                  </div>
                )}

                {!isAdmin && !isFull && (
                  <Button
                    label="휴무 신청하기"
                    variant="primary"
                    size="md"
                    onClick={handleApplyClick}
                    icon={<FiSend size={18} />}
                  />
                )}
              </VStack>
            </div>
          </>
        )}
      </motion.div>

      {/* 삭제 확인 모달 */}
      <Dialog
        isOpen={showDeleteModal}
        onOpenChange={(open) => {
          if (!open) handleDeleteModalClose();
        }}
        purpose="form"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="휴무 삭제 확인"
              onOpenChange={(open) => {
                if (!open) handleDeleteModalClose();
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <HStack gap={2} vAlign="start">
                  <span
                    style={{
                      background: 'var(--color-background-red)',
                      padding: 10,
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon icon={FiLock} size="md" color="error" />
                  </span>
                  <Text type="body" color="secondary">
                    {selectedVacation?.userName}님의 {selectedVacation?.date} 휴무를 삭제하시려면 비밀번호를 입력해주세요.
                  </Text>
                </HStack>

                <TextInput
                  label="비밀번호"
                  type="password"
                  value={deletePassword}
                  onChange={(value) => setDeletePassword(value)}
                  placeholder="비밀번호를 입력하세요"
                  htmlName="deletePassword"
                  status={deleteError ? { type: 'error', message: deleteError } : undefined}
                />
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button
                  label="취소"
                  variant="ghost"
                  onClick={handleDeleteModalClose}
                  isDisabled={isDeleting}
                />
                <Button
                  label="삭제하기"
                  variant="destructive"
                  onClick={handleDeleteVacation}
                  isLoading={isDeleting}
                  icon={<FiTrash2 size={16} />}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
};

export default VacationDetails;
