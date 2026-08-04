'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiFileText, FiSearch, FiRefreshCw, FiCheck, FiX, FiEye, FiCalendar, FiUser, FiAlertCircle, FiTrash2 } from 'react-icons/fi';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Badge } from '@astryxdesign/core/Badge';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { DateInput } from '@astryxdesign/core/DateInput';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { getApprovalRequests, approveApprovalRequest, rejectApprovalRequest, bulkApproveApprovalRequests, bulkRejectApprovalRequests, getApprovalTemplateById, cancelApprovalRequest, getApprovalRequesterId } from '@/lib/apiService';
import { useConfirm } from './ConfirmDialog';
import { ApprovalRequest, ApprovalStatus } from '@/types/approval';
import { FormSchema } from '@/types/formSchema';
import ApprovalDetail from './ApprovalDetail';
import SignatureConfirmDialog from './approval/SignatureConfirmDialog';
import { useAlert } from './Alert';
import { duration } from '@/theme/motion';

type TabType = 'all' | 'pending' | 'approved' | 'rejected';

export default function ApprovalManagement() {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [selectedTemplateSchema, setSelectedTemplateSchema] = useState<FormSchema | undefined>(undefined);
  const [selectedTemplateType, setSelectedTemplateType] = useState<string | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [userId] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '');
  const [userName] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : '');

  const [stats, setStats] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });

  // 결재선 차례 판단용 내 결재자 ID (admin_<id> 또는 memberId)
  const [myApproverId, setMyApproverId] = useState('');
  // 목록 퀵 승인 대상 (서명 다이얼로그)
  const [quickApproveTarget, setQuickApproveTarget] = useState<ApprovalRequest | null>(null);

  useEffect(() => {
    setMyApproverId(getApprovalRequesterId());
  }, []);

  // 결재선이 있으면 내 차례일 때만, 없으면(legacy) 기존처럼 처리 가능
  const isActionable = (approval: ApprovalRequest) => {
    if (approval.status !== 'PENDING') return false;
    if (!approval.approvalLine || approval.approvalLine.length === 0) return true;
    const currentStep = approval.approvalLine.find((step) => step.status === 'PENDING');
    return !!currentStep && currentStep.approverId === myApproverId;
  };

  // 직권 승인 전 경고 — 건너뛰게 될 남은 결재 단계를 알려주고 확인받는다
  const confirmForceApprove = async (approval: ApprovalRequest) => {
    const remaining = (approval.approvalLine || [])
      .filter((step) => step.status === 'PENDING' && step.approverId !== myApproverId)
      .map((step) => `${step.roleLabel === 'FINAL' ? '결재' : '검토'} ${step.approverName}`);
    return confirm({
      title: '직권 승인 (전결)',
      message: `아직 처리되지 않은 결재 단계가 남아 있습니다.\n남은 단계: ${remaining.join(' → ')}\n\n남은 단계를 건너뛰고 즉시 최종 승인합니다. 계속하시겠습니까?`,
      confirmText: '직권 승인',
      type: 'warning',
    });
  };

  // 결재선 진행 배지 텍스트 (결재선 없으면 null)
  const getLineProgress = (approval: ApprovalRequest) => {
    if (!approval.approvalLine || approval.approvalLine.length === 0) return null;
    const approved = approval.approvalLine.filter((step) => step.status === 'APPROVED').length;
    return `결재 ${approved}/${approval.approvalLine.length}`;
  };

  useEffect(() => {
    loadApprovals();
  }, [activeTab, dateFilter, searchQuery]);

  const loadApprovals = async () => {
    setIsLoading(true);
    try {
      const response = await getApprovalRequests({
        status: activeTab === 'all' ? 'ALL' : activeTab.toUpperCase(),
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        searchQuery: searchQuery || undefined,
      });
      setApprovals(response.approvals || []);
      if (response.stats) {
        setStats({
          all: (response.stats.pending || 0) + (response.stats.approved || 0) + (response.stats.rejected || 0),
          pending: response.stats.pending || 0,
          approved: response.stats.approved || 0,
          rejected: response.stats.rejected || 0,
        });
      }
      setSelectedIds(new Set());
    } catch (error) {
      console.error('결재 목록 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetail = async (approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    setSelectedTemplateSchema(undefined);
    setSelectedTemplateType(undefined);

    if (approval.templateId) {
      try {
        const response = await getApprovalTemplateById(approval.templateId);
        // 응답은 { template: {...} } 래퍼로 온다 — 직접 읽으면 스키마가 항상 undefined가 되어
        // 폼 문서 상세가 폴백 테이블(영문 필드 id)로 렌더링되는 버그가 있었다.
        const template = response?.template ?? response;
        if (template) {
          // HWP 파일 양식(file)과 폼 양식(form)의 상세보기가 다르다
          setSelectedTemplateType(template.templateType);
          if (template.formSchema) {
            const schema: FormSchema = typeof template.formSchema === 'string'
              ? JSON.parse(template.formSchema)
              : template.formSchema;
            setSelectedTemplateSchema(schema);
          }
        }
      } catch (error) {
        // templateId가 없거나 조회 실패 시 schema 없이 진행
        console.error('템플릿 스키마 로드 실패:', error);
      }
    }
  };

  const handleSelectAll = () => {
    const actionableApprovals = approvals.filter(isActionable);
    if (selectedIds.size === actionableApprovals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(actionableApprovals.map(a => a.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleApprove = async (id: string | number, options?: { signatureBase64?: string; force?: boolean }) => {
    setIsProcessing(true);
    try {
      await approveApprovalRequest(String(id), options);
      showAlert({ type: 'success', title: '승인 완료', message: '결재가 승인되었습니다.' });
      loadApprovals();
      setSelectedApproval(null);
      setQuickApproveTarget(null);
    } catch (error) {
      console.error('승인 실패:', error);
      const message = error instanceof Error && error.message ? error.message : '결재 승인에 실패했습니다.';
      showAlert({ type: 'error', title: '승인 실패', message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (id: string | number, reason: string, options?: { force?: boolean }) => {
    if (!reason.trim()) {
      showAlert({ type: 'warning', title: '사유 필요', message: '반려 사유를 입력해주세요.' });
      return;
    }
    setIsProcessing(true);
    try {
      await rejectApprovalRequest(String(id), reason, options);
      showAlert({ type: 'success', title: '반려 완료', message: '결재가 반려되었습니다.' });
      loadApprovals();
      setSelectedApproval(null);
    } catch (error) {
      console.error('반려 실패:', error);
      showAlert({ type: 'error', title: '반려 실패', message: '결재 반려에 실패했습니다.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) {
      showAlert({ type: 'warning', title: '선택 필요', message: '승인할 결재를 선택해주세요.' });
      return;
    }
    setIsProcessing(true);
    try {
      await bulkApproveApprovalRequests(Array.from(selectedIds));
      showAlert({ type: 'success', title: '일괄 승인 완료', message: `${selectedIds.size}건의 결재가 승인되었습니다.` });
      loadApprovals();
    } catch (error) {
      console.error('일괄 승인 실패:', error);
      showAlert({ type: 'error', title: '일괄 승인 실패', message: '결재 승인에 실패했습니다.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (!rejectReason.trim()) {
      showAlert({ type: 'warning', title: '사유 필요', message: '반려 사유를 입력해주세요.' });
      return;
    }
    setIsProcessing(true);
    try {
      await bulkRejectApprovalRequests(Array.from(selectedIds), rejectReason);
      showAlert({ type: 'success', title: '일괄 반려 완료', message: `${selectedIds.size}건의 결재가 반려되었습니다.` });
      setShowBulkRejectModal(false);
      setRejectReason('');
      loadApprovals();
    } catch (error) {
      console.error('일괄 반려 실패:', error);
      showAlert({ type: 'error', title: '일괄 반려 실패', message: '결재 반려에 실패했습니다.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    const confirmed = await confirm({
      title: '결재 삭제',
      message: '이 결재 요청을 삭제하시겠습니까?\n삭제된 결재는 복구할 수 없습니다.',
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    });
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await cancelApprovalRequest(String(id));
      showAlert({ type: 'success', title: '삭제 완료', message: '결재 요청이 삭제되었습니다.' });
      setSelectedApproval(null);
      loadApprovals();
    } catch (error) {
      console.error('결재 삭제 실패:', error);
      showAlert({ type: 'error', title: '삭제 실패', message: '결재 삭제에 실패했습니다.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusVariant = (status: ApprovalStatus): 'success' | 'warning' | 'error' | 'neutral' => {
    switch (status) {
      case 'APPROVED': return 'success';
      case 'PENDING': return 'warning';
      case 'REJECTED': return 'error';
      default: return 'neutral';
    }
  };

  const getStatusIconColor = (status: ApprovalStatus): 'success' | 'warning' | 'error' | 'secondary' => {
    switch (status) {
      case 'APPROVED': return 'success';
      case 'PENDING': return 'warning';
      case 'REJECTED': return 'error';
      default: return 'secondary';
    }
  };

  const getStatusText = (status: ApprovalStatus) => {
    switch (status) {
      case 'APPROVED': return '승인됨';
      case 'PENDING': return '진행중';
      case 'REJECTED': return '반려됨';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <Loading label="결재 목록을 불러오는 중..." />
    );
  }

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />
      {/* 셸이 flex 컬럼으로 감싸므로 남은 높이를 모두 차지한다 */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', gap: 'var(--spacing-5)' }}>
        {/* 헤더 */}
        <HStack hAlign="between" vAlign="center">
          <VStack gap={1}>
            <Heading level={2}>전자결재 관리</Heading>
            <Text type="supporting" color="secondary">직원들의 결재 요청을 처리합니다</Text>
          </VStack>
          <IconButton
            label="새로고침"
            tooltip="새로고침"
            variant="ghost"
            icon={<Icon icon={FiRefreshCw} />}
            isLoading={isProcessing}
            isDisabled={isProcessing}
            onClick={loadApprovals}
          />
        </HStack>

        {/* 탭 네비게이션 */}
        <SegmentedControl
          value={activeTab}
          onChange={(value) => setActiveTab(value as TabType)}
          label="결재 상태 탭"
          layout="fill"
        >
          <SegmentedControlItem value="all" label={`전체 (${stats.all})`} />
          <SegmentedControlItem value="pending" label={`진행중 (${stats.pending})`} />
          <SegmentedControlItem value="approved" label={`승인됨 (${stats.approved})`} />
          <SegmentedControlItem value="rejected" label={`반려됨 (${stats.rejected})`} />
        </SegmentedControl>

        {/* 필터 영역 */}
        <Card variant="muted" padding={3}>
          <HStack gap={3} vAlign="end" hAlign="between">
            <HStack gap={2} vAlign="end">
              <DateInput
                label="시작일"
                value={dateFilter.startDate as ISODateString}
                onChange={(value) => setDateFilter(prev => ({ ...prev, startDate: value || '' }))}
              />
              <DateInput
                label="종료일"
                value={dateFilter.endDate as ISODateString}
                onChange={(value) => setDateFilter(prev => ({ ...prev, endDate: value || '' }))}
              />
            </HStack>
            <div style={{ flex: 1, minWidth: 200 }}>
              <TextInput
                label="검색"
                isLabelHidden
                startIcon={FiSearch}
                value={searchQuery}
                onChange={(value) => setSearchQuery(value)}
                placeholder="제목, 기안자 검색"
              />
            </div>
          </HStack>
        </Card>

        {/* 일괄 액션 */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card variant="teal" padding={3}>
              <HStack hAlign="between" vAlign="center">
                <Text weight="medium" color="accent">
                  {selectedIds.size}건 선택됨
                </Text>
                <HStack gap={2}>
                  <Button
                    label="일괄 승인"
                    variant="primary"
                    size="sm"
                    icon={<Icon icon={FiCheck} />}
                    isDisabled={isProcessing}
                    onClick={handleBulkApprove}
                  />
                  <Button
                    label="일괄 반려"
                    variant="destructive"
                    size="sm"
                    icon={<Icon icon={FiX} />}
                    isDisabled={isProcessing}
                    onClick={() => setShowBulkRejectModal(true)}
                  />
                </HStack>
              </HStack>
            </Card>
          </motion.div>
        )}

        {/* 결재 목록 */}
        {approvals.length > 0 ? (
          <VStack gap={3}>
            {/* 전체 선택 체크박스 (진행중 탭, 처리 가능한 건만) */}
            {activeTab === 'pending' && approvals.filter(isActionable).length > 0 && (
              <HStack vAlign="center">
                <CheckboxInput
                  label="전체 선택"
                  value={
                    approvals.filter(isActionable).length > 0 &&
                    selectedIds.size === approvals.filter(isActionable).length
                  }
                  onChange={handleSelectAll}
                />
              </HStack>
            )}

            {/* 결재 카드 리스트 */}
            {approvals.map((approval) => {
              return (
                <motion.div
                  key={approval.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: duration.fast }}
                >
                  <Card>
                    <HStack hAlign="between" vAlign="center" gap={4}>
                      <HStack gap={3} vAlign="start">
                        {approval.status === 'PENDING' && isActionable(approval) && (
                          <div style={{ paddingTop: 'var(--spacing-1)', flexShrink: 0 }}>
                            <CheckboxInput
                              label="선택"
                              isLabelHidden
                              value={selectedIds.has(approval.id)}
                              onChange={() => handleSelectOne(approval.id)}
                            />
                          </div>
                        )}
                        <Icon icon={FiFileText} size="md" color={getStatusIconColor(approval.status)} />
                        <VStack gap={1}>
                          <HStack gap={2} vAlign="center">
                            <Text weight="bold" color="primary">{approval.title}</Text>
                            <Badge variant={getStatusVariant(approval.status)} label={getStatusText(approval.status)} />
                            {getLineProgress(approval) && (
                              <Badge variant="neutral" label={getLineProgress(approval)!} />
                            )}
                          </HStack>
                          <VStack gap={0.5}>
                            <HStack gap={1} vAlign="center">
                              <Icon icon={FiUser} size="sm" color="tertiary" />
                              <Text type="supporting" color="secondary">{approval.requesterName}</Text>
                            </HStack>
                            <HStack gap={1} vAlign="center">
                              <Icon icon={FiFileText} size="sm" color="tertiary" />
                              <Text type="supporting" color="secondary">{approval.templateName}</Text>
                            </HStack>
                            <HStack gap={1} vAlign="center">
                              <Icon icon={FiCalendar} size="sm" color="tertiary" />
                              <Text type="supporting" color="secondary">
                                {format(new Date(approval.createdAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                              </Text>
                            </HStack>
                          </VStack>
                        </VStack>
                      </HStack>
                      <HStack gap={2} vAlign="center">
                        <Button
                          label="상세보기"
                          variant="secondary"
                          size="sm"
                          icon={<Icon icon={FiEye} />}
                          onClick={() => handleOpenDetail(approval)}
                        />
                        {approval.status === 'PENDING' && (
                          <>
                            {/* 내 차례가 아니어도 관리자는 직권 승인(전결)·직권 반려 가능 */}
                            <Button
                              label={isActionable(approval) ? '승인' : '직권 승인'}
                              variant="primary"
                              size="sm"
                              icon={<Icon icon={FiCheck} />}
                              isDisabled={isProcessing}
                              onClick={async () => {
                                if (!isActionable(approval) && !(await confirmForceApprove(approval))) return;
                                setQuickApproveTarget(approval);
                              }}
                            />
                            <Button
                              label={isActionable(approval) ? '반려' : '직권 반려'}
                              variant="destructive"
                              size="sm"
                              icon={<Icon icon={FiX} />}
                              isDisabled={isProcessing}
                              onClick={() => handleOpenDetail(approval)}
                            />
                          </>
                        )}
                        <IconButton
                          label="삭제"
                          tooltip="삭제"
                          variant="ghost"
                          size="sm"
                          icon={<Icon icon={FiTrash2} />}
                          isDisabled={isProcessing}
                          onClick={() => handleDelete(approval.id)}
                        />
                      </HStack>
                    </HStack>
                  </Card>
                </motion.div>
              );
            })}
          </VStack>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EmptyState
              icon={<Icon icon={FiFileText} size="lg" />}
              title="결재 요청이 없습니다"
              description="조건에 맞는 결재 요청이 없습니다."
            />
          </div>
        )}
      </div>

      {/* 결재 상세 모달 */}
      <AnimatePresence>
        {selectedApproval && (
          <ApprovalDetail
            approval={selectedApproval}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDelete}
            onClose={() => { setSelectedApproval(null); setSelectedTemplateSchema(undefined); setSelectedTemplateType(undefined); }}
            templateSchema={selectedTemplateSchema}
            templateType={selectedTemplateType}
            isProcessing={isProcessing}
          />
        )}
      </AnimatePresence>

      {/* 목록 퀵 승인 — 서명 확인 */}
      <SignatureConfirmDialog
        isOpen={!!quickApproveTarget}
        isProcessing={isProcessing}
        onClose={() => setQuickApproveTarget(null)}
        onConfirm={(signatureBase64) => {
          if (quickApproveTarget) {
            handleApprove(quickApproveTarget.id, {
              ...(signatureBase64 ? { signatureBase64 } : {}),
              // 내 차례가 아닌 건은 관리자 직권 승인(전결)으로 처리
              ...(isActionable(quickApproveTarget) ? {} : { force: true }),
            });
          }
        }}
      />

      {/* 일괄 반려 모달 */}
      <Dialog
        isOpen={showBulkRejectModal}
        onOpenChange={(open) => { if (!open) { setShowBulkRejectModal(false); setRejectReason(''); } }}
        purpose="required"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="일괄 반려"
              onOpenChange={(open) => { if (!open) { setShowBulkRejectModal(false); setRejectReason(''); } }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <HStack gap={3} vAlign="start">
                  <Icon icon={FiAlertCircle} color="error" size="lg" />
                  <Text type="supporting" color="secondary">
                    {selectedIds.size}건의 결재를 반려합니다. 반려 사유를 입력해주세요.
                  </Text>
                </HStack>
                <TextArea
                  label="반려 사유"
                  isRequired
                  value={rejectReason}
                  onChange={(value) => setRejectReason(value)}
                  placeholder="반려 사유를 입력해주세요"
                  rows={4}
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
                  isDisabled={isProcessing}
                  onClick={() => { setShowBulkRejectModal(false); setRejectReason(''); }}
                />
                <Button
                  label="반려하기"
                  variant="destructive"
                  icon={<Icon icon={FiX} />}
                  isLoading={isProcessing}
                  isDisabled={isProcessing}
                  onClick={handleBulkReject}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
