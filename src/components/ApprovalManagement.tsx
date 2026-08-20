'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiFileText, FiSearch, FiRefreshCw, FiCheck, FiX, FiEye, FiCalendar, FiUser, FiAlertCircle, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Badge } from '@astryxdesign/core/Badge';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import ApprovalImportDialog from '@/components/approval/ApprovalImportDialog';
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
import { getApprovalRequests, approveApprovalRequest, rejectApprovalRequest, bulkApproveApprovalRequests, bulkRejectApprovalRequests, getApprovalTemplateById, getApprovalTemplates, cancelApprovalRequest, getApprovalRequesterId } from '@/lib/apiService';
import { UNCATEGORIZED_LABEL } from '@/lib/defaultApprovalTemplates';

/** 서버가 "분류가 비어 있는 문서"로 알아듣는 값 (ApprovalRequestService.UNCATEGORIZED_FILTER) */
const UNCATEGORIZED_QUERY = '__NONE__';
import { useConfirm } from './ConfirmDialog';
import { ApprovalRequest, ApprovalStatus } from '@/types/approval';
import { FormSchema } from '@/types/formSchema';
import ApprovalDetail from './ApprovalDetail';
import SignatureConfirmDialog from './approval/SignatureConfirmDialog';
import { useAlert } from './Alert';
import { duration } from '@/theme/motion';

type TabType = 'all' | 'pending' | 'approved' | 'rejected';

interface ApprovalManagementProps {
  /**
   * 결재를 처리할 수 있는 사람인지 (관리자 또는 APPROVAL_MANAGE 보유 직원).
   *
   * false면 같은 목록이 '문서함'으로 열린다 — 열람 권한으로 공유된 문서를 보고 검색만 하며,
   * 직권 처리·삭제 버튼은 나오지 않는다. (내 결재 차례인 문서는 그대로 승인·반려할 수 있다)
   */
  canManage?: boolean;
}

export default function ApprovalManagement({ canManage = true }: ApprovalManagementProps) {
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
  /** 양식 목록 (양식별 필터 + 대분류 목록에 쓴다) */
  const [templates, setTemplates] = useState<{ id: string; name: string; category: string }[]>([]);
  /** 대분류 필터 ('' = 전체) */
  const [categoryFilter, setCategoryFilter] = useState('');
  /** 양식 필터 ('' = 전체) */
  const [templateFilter, setTemplateFilter] = useState('');
  const [dateFilter, setDateFilter] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  /** 과거 문서 이관 마법사 */
  const [showImport, setShowImport] = useState(false);
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

  // 결재선이 있으면 내 차례일 때만, 없으면(legacy) canManage(관리자 또는 APPROVAL_MANAGE 보유)일 때만 처리 가능
  // — 열람만 가능한 직원에게 legacy 문서의 승인/반려 버튼이 노출되던 문제 수정
  const isActionable = (approval: ApprovalRequest) => {
    if (approval.status !== 'PENDING') return false;
    if (!approval.approvalLine || approval.approvalLine.length === 0) return canManage;
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
  }, [activeTab, dateFilter, searchQuery, categoryFilter, templateFilter]);

  // 대분류 필터용 — 결재 문서에는 templateId만 있어 양식 목록에서 분류를 끌어온다
  useEffect(() => {
    (async () => {
      try {
        const response = await getApprovalTemplates();
        const list = (response.templates || []) as { id: string | number; name: string; category?: string | null }[];
        setTemplates(list.map((template) => ({
          id: String(template.id),
          name: template.name,
          category: (template.category || '').trim() || UNCATEGORIZED_LABEL,
        })));
      } catch (error) {
        // 분류를 못 불러와도 결재 처리는 그대로 되어야 하므로 조용히 넘어간다
        console.error('양식 분류 로드 실패:', error);
      }
    })();
  }, []);

  /** 등록된 양식에 쓰이는 대분류 (양식 등록 순서를 따름) */
  const visibleCategories = useMemo(() => {
    const seen: string[] = [];
    for (const template of templates) {
      if (!seen.includes(template.category)) seen.push(template.category);
    }
    return seen;
  }, [templates]);

  /** 대분류를 고르면 그 분류의 양식만 고를 수 있게 좁힌다 */
  const templateOptions = useMemo(
    () => templates
      .filter((template) => !categoryFilter || template.category === categoryFilter)
      .map((template) => ({ value: template.id, label: template.name })),
    [templates, categoryFilter],
  );

  // 걸러내기는 서버가 한다 — 기간 밖이나 다른 분류의 문서는 애초에 내려오지 않는다
  const visibleApprovals = approvals;

  // 전체 선택 체크박스가 렌더마다 같은 필터를 3번 반복 계산하던 것을 한 번으로 줄인다
  const selectableApprovals = useMemo(
    () => visibleApprovals.filter(isActionable),
    [visibleApprovals, myApproverId],
  );

  const loadApprovals = async () => {
    setIsLoading(true);
    try {
      const response = await getApprovalRequests({
        status: activeTab === 'all' ? 'ALL' : activeTab.toUpperCase(),
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        searchQuery: searchQuery || undefined,
        templateId: templateFilter || undefined,
        // 미분류는 "분류가 비어 있는 문서"라 서버가 알아듣는 약속된 값으로 바꿔 보낸다
        category: categoryFilter
          ? (categoryFilter === UNCATEGORIZED_LABEL ? UNCATEGORIZED_QUERY : categoryFilter)
          : undefined,
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
    // 화면에 보이는 것만 선택한다 — 대분류로 걸러낸 문서까지 일괄 처리되면 안 된다
    const actionableApprovals = visibleApprovals.filter(isActionable);
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
      <ApprovalImportDialog
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImported={loadApprovals}
      />
      {/* 셸이 flex 컬럼으로 감싸므로 남은 높이를 모두 차지한다 */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', gap: 'var(--spacing-5)' }}>
        {/* 헤더 */}
        <HStack hAlign="between" vAlign="center">
          <VStack gap={1}>
            <Heading level={2}>{canManage ? '전자결재 관리' : '문서함'}</Heading>
            <Text type="supporting" color="secondary">
              {canManage
                ? '직원들의 결재 요청을 처리합니다'
                : '열람 권한이 있는 결재 문서를 보고 검색합니다'}
            </Text>
          </VStack>
          <HStack gap={2} vAlign="center">
          {canManage && (
            <Button
              label="과거 문서 이관"
              variant="secondary"
              size="sm"
              icon={<Icon icon={FiUploadCloud} size="sm" />}
              onClick={() => setShowImport(true)}
            />
          )}
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
          {/* 좁은 화면에서 날짜 필터+검색이 가로로 넘치지 않도록 줄바꿈 허용 (밀도는 유지, 넘칠 때만 다음 줄로) */}
          <HStack gap={3} vAlign="end" hAlign="between" wrap="wrap">
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
                placeholder="제목, 기안자, 양식, 결재자, 열람자, 첨부파일, 내용 검색"
              />
            </div>
          </HStack>
        </Card>

        {/* 기안 종류(대분류) 필터 — 분류가 둘 이상일 때만 노출 */}
        {visibleCategories.length > 1 && (
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="supporting" color="secondary">기안 종류</Text>
            <Button
              label="전체"
              variant={categoryFilter === '' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => { setCategoryFilter(''); setTemplateFilter(''); }}
            />
            {visibleCategories.map((category) => (
              <Button
                key={category}
                label={category}
                variant={categoryFilter === category ? 'secondary' : 'ghost'}
                size="sm"
                // 분류를 바꾸면 그 분류에 없는 양식이 선택된 채로 남지 않게 양식 필터를 푼다
                onClick={() => { setCategoryFilter(category); setTemplateFilter(''); }}
              />
            ))}
          </HStack>
        )}

        {/* 양식별 필터 */}
        {templateOptions.length > 1 && (
          <div style={{ maxWidth: 320 }}>
            <Selector
              label="양식"
              placeholder="양식 전체"
              value={templateFilter}
              options={templateOptions}
              hasClear
              hasSearch={templateOptions.length > 8}
              searchPlaceholder="양식 이름 검색"
              onChange={(value) => setTemplateFilter(value || '')}
            />
          </div>
        )}

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
        {visibleApprovals.length > 0 ? (
          <VStack gap={3}>
            {/* 전체 선택 체크박스 (진행중 탭, 처리 가능한 건만) */}
            {activeTab === 'pending' && selectableApprovals.length > 0 && (
              <HStack vAlign="center">
                <CheckboxInput
                  label="전체 선택"
                  value={selectedIds.size === selectableApprovals.length}
                  onChange={handleSelectAll}
                />
              </HStack>
            )}

            {/* 결재 카드 리스트 */}
            {visibleApprovals.map((approval) => {
              return (
                <motion.div
                  key={approval.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: duration.fast }}
                >
                  <Card>
                    {/* 좁은 화면에서 정보/버튼 행이 가로로 넘치지 않도록 줄바꿈 허용 + 정보 블록이 실제로 줄어들 수 있게 minWidth 0 */}
                    <HStack hAlign="between" vAlign="center" gap={4} wrap="wrap">
                      <HStack gap={3} vAlign="start" style={{ minWidth: 0, flex: 1 }}>
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
                        <VStack gap={1} style={{ minWidth: 0 }}>
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
                              {approval.isImported && (
                                <Badge variant="purple" label={approval.externalDocNumber
                                  ? `이관 · ${approval.externalDocNumber}`
                                  : '이관'} />
                              )}
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
                        {approval.status === 'PENDING' && (canManage || isActionable(approval)) && (
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
                        {canManage && (
                          <IconButton
                            label="삭제"
                            tooltip="삭제"
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon={FiTrash2} />}
                            isDisabled={isProcessing}
                            onClick={() => handleDelete(approval.id)}
                          />
                        )}
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
              description={
                categoryFilter
                  ? `'${categoryFilter}' 종류의 결재 요청이 없습니다.`
                  : '조건에 맞는 결재 요청이 없습니다.'
              }
              actions={
                categoryFilter
                  ? <Button label="전체 보기" variant="secondary" size="sm" onClick={() => setCategoryFilter('')} />
                  : undefined
              }
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
            canManage={canManage}
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
