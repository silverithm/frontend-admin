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
import { Spinner } from '@astryxdesign/core/Spinner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { getApprovalRequests, approveApprovalRequest, rejectApprovalRequest, bulkApproveApprovalRequests, bulkRejectApprovalRequests, getApprovalTemplateById, cancelApprovalRequest } from '@/lib/apiService';
import { useConfirm } from './ConfirmDialog';
import { ApprovalRequest, ApprovalStatus } from '@/types/approval';
import { FormSchema } from '@/types/formSchema';
import ApprovalDetail from './ApprovalDetail';
import { useAlert } from './Alert';

type TabType = 'all' | 'pending' | 'approved' | 'rejected';

export default function ApprovalManagement() {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [selectedTemplateSchema, setSelectedTemplateSchema] = useState<FormSchema | undefined>(undefined);
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

    if (approval.templateId) {
      try {
        const template = await getApprovalTemplateById(approval.templateId);
        if (template && template.formSchema) {
          const schema: FormSchema = typeof template.formSchema === 'string'
            ? JSON.parse(template.formSchema)
            : template.formSchema;
          setSelectedTemplateSchema(schema);
        }
      } catch (error) {
        // templateId가 없거나 조회 실패 시 schema 없이 진행
        console.error('템플릿 스키마 로드 실패:', error);
      }
    }
  };

  const handleSelectAll = () => {
    const pendingApprovals = approvals.filter(a => a.status === 'PENDING');
    if (selectedIds.size === pendingApprovals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingApprovals.map(a => a.id)));
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

  const handleApprove = async (id: string | number) => {
    setIsProcessing(true);
    try {
      await approveApprovalRequest(String(id));
      showAlert({ type: 'success', title: '승인 완료', message: '결재가 승인되었습니다.' });
      loadApprovals();
      setSelectedApproval(null);
    } catch (error) {
      console.error('승인 실패:', error);
      showAlert({ type: 'error', title: '승인 실패', message: '결재 승인에 실패했습니다.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (id: string | number, reason: string) => {
    if (!reason.trim()) {
      showAlert({ type: 'warning', title: '사유 필요', message: '반려 사유를 입력해주세요.' });
      return;
    }
    setIsProcessing(true);
    try {
      await rejectApprovalRequest(String(id), reason);
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

  const getStatusAvatar = (status: ApprovalStatus): { bg: string; color: 'success' | 'warning' | 'error' | 'secondary' } => {
    switch (status) {
      case 'APPROVED': return { bg: 'var(--color-background-green)', color: 'success' };
      case 'PENDING': return { bg: 'var(--color-background-yellow)', color: 'warning' };
      case 'REJECTED': return { bg: 'var(--color-background-red)', color: 'error' };
      default: return { bg: 'var(--color-background-muted)', color: 'secondary' };
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

  const pendingApprovals = approvals.filter(a => a.status === 'PENDING');

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 256 }}>
        <Spinner label="결재 목록을 불러오는 중..." />
      </div>
    );
  }

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />
      <VStack gap={5}>
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
            {/* 전체 선택 체크박스 (진행중 탭에서만) */}
            {activeTab === 'pending' && pendingApprovals.length > 0 && (
              <HStack vAlign="center">
                <CheckboxInput
                  label="전체 선택"
                  value={pendingApprovals.length > 0 && selectedIds.size === pendingApprovals.length}
                  onChange={handleSelectAll}
                />
              </HStack>
            )}

            {/* 결재 카드 리스트 */}
            {approvals.map((approval) => {
              const avatar = getStatusAvatar(approval.status);
              return (
                <motion.div
                  key={approval.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card>
                    <HStack hAlign="between" vAlign="center" gap={4}>
                      <HStack gap={3} vAlign="start">
                        {approval.status === 'PENDING' && (
                          <div style={{ paddingTop: 'var(--spacing-1)', flexShrink: 0 }}>
                            <CheckboxInput
                              label="선택"
                              isLabelHidden
                              value={selectedIds.has(approval.id)}
                              onChange={() => handleSelectOne(approval.id)}
                            />
                          </div>
                        )}
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 'var(--radius-element)',
                            background: avatar.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon icon={FiFileText} color={avatar.color} />
                        </div>
                        <VStack gap={1}>
                          <HStack gap={2} vAlign="center">
                            <Text weight="bold" color="primary">{approval.title}</Text>
                            <Badge variant={getStatusVariant(approval.status)} label={getStatusText(approval.status)} />
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
                            <Button
                              label="승인"
                              variant="primary"
                              size="sm"
                              icon={<Icon icon={FiCheck} />}
                              isDisabled={isProcessing}
                              onClick={() => handleApprove(approval.id)}
                            />
                            <Button
                              label="반려"
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
          <EmptyState
            icon={<Icon icon={FiFileText} size="lg" />}
            title="결재 요청이 없습니다"
            description="조건에 맞는 결재 요청이 없습니다."
          />
        )}
      </VStack>

      {/* 결재 상세 모달 */}
      <AnimatePresence>
        {selectedApproval && (
          <ApprovalDetail
            approval={selectedApproval}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDelete}
            onClose={() => { setSelectedApproval(null); setSelectedTemplateSchema(undefined); }}
            templateSchema={selectedTemplateSchema}
          />
        )}
      </AnimatePresence>

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
