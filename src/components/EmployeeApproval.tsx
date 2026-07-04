'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiPlus, FiFileText, FiEye, FiDownload, FiChevronRight, FiEdit3 } from 'react-icons/fi';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Center } from '@astryxdesign/core/Center';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { FileInput } from '@astryxdesign/core/FileInput';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Spinner } from '@astryxdesign/core/Spinner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { getActiveApprovalTemplates, getMyApprovalRequests, createApprovalRequest, cancelApprovalRequest, updateApprovalAttachment, getApprovalRequesterId } from '@/lib/apiService';
import { ApprovalRequest, ApprovalStatus } from '@/types/approval';
import { ApprovalTemplate } from '@/types/approvalTemplate';
import { useAlert } from './Alert';
import { useConfirm } from './ConfirmDialog';
import FormRenderer from './approval/FormRenderer';
import DocumentViewerModal from './DocumentViewerModal';

type TabType = 'templates' | 'my-approvals';
type ApprovalFilterType = 'all' | 'pending' | 'approved' | 'rejected';

export default function EmployeeApproval() {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>('my-approvals');
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilterType>('all');
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewApproval, setShowNewApproval] = useState(false);
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);

  // 기안 작성 폼 상태
  const [approvalForm, setApprovalForm] = useState({
    templateId: '' as string,
    title: '',
    file: null as File | null,
  });
  const [formData, setFormData] = useState<Record<string, any> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 문서 뷰어/웹 작성 모달 상태 — authoring이면 편집 후 저장 시 파일로 첨부,
  // templateId가 있으면 저장 시 해당 양식으로 새 기안 작성 모달을 자동으로 열고,
  // approvalId가 있으면 진행중 기안의 첨부파일을 서버에 바로 교체한다
  const [viewer, setViewer] = useState<{
    fileUrl: string;
    fileName: string;
    authoring?: boolean;
    templateId?: string;
    approvalId?: string;
  } | null>(null);

  const [userId, setUserId] = useState('');

  // 클라이언트에서만 userId를 설정 (SSR 하이드레이션 불일치 방지)
  useEffect(() => {
    setUserId(getApprovalRequesterId());
  }, []);

  // 데이터 로드
  useEffect(() => {
    if (userId) {
      loadApprovals();
      loadTemplates();
    }
  }, [userId]);

  const loadApprovals = async () => {
    setIsLoading(true);
    try {
      const response = await getMyApprovalRequests(userId);
      setApprovals(response.approvals || []);
    } catch (error) {
      console.error('결재 목록 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await getActiveApprovalTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('양식 템플릿 로드 실패:', error);
    }
  };

  // 필터링된 결재 목록
  const filteredApprovals = approvals.filter(approval => {
    if (approvalFilter === 'all') return true;
    if (approvalFilter === 'pending') return approval.status === 'PENDING';
    if (approvalFilter === 'approved') return approval.status === 'APPROVED';
    if (approvalFilter === 'rejected') return approval.status === 'REJECTED';
    return true;
  });

  // 상태 카운트
  const getStatusCount = (status?: ApprovalStatus) => {
    if (!status) return approvals.length;
    return approvals.filter(a => a.status === status).length;
  };

  // 상태 배지 variant
  const getStatusVariant = (status: ApprovalStatus): 'success' | 'warning' | 'error' | 'neutral' => {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'REJECTED':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const getStatusText = (status: ApprovalStatus) => {
    switch (status) {
      case 'APPROVED':
        return '승인됨';
      case 'PENDING':
        return '진행중';
      case 'REJECTED':
        return '반려됨';
      default:
        return status;
    }
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // 양식 다운로드
  const handleDownloadTemplate = async (template: ApprovalTemplate) => {
    try {
      const downloadUrl = `/api/v1/files/download?path=${encodeURIComponent(template.fileUrl)}&fileName=${encodeURIComponent(template.fileName)}`;
      const token = localStorage.getItem('authToken');

      const response = await fetch(downloadUrl, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error('파일 다운로드 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = template.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showAlert({
        type: 'success',
        title: '다운로드 완료',
        message: `${template.fileName} 파일이 다운로드되었습니다.`,
      });
    } catch (error) {
      console.error('파일 다운로드 실패:', error);
      showAlert({
        type: 'error',
        title: '다운로드 실패',
        message: '파일 다운로드에 실패했습니다.',
      });
    }
  };

  // S3 URL에서 상대 경로 추출 (carev/ 이후 부분)
  const extractRelativePath = (url: string): string => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      // https://bucket.s3.region.amazonaws.com/carev/attachments/file.pdf -> attachments/file.pdf
      const match = url.match(/\/carev\/(.+)$/);
      if (match) return match[1];
    }
    return url;
  };

  // 첨부파일 다운로드
  const handleDownloadAttachment = async (fileUrl: string, fileName: string) => {
    try {
      // S3 URL인 경우 상대 경로로 변환
      const relativePath = extractRelativePath(fileUrl);

      const downloadUrl = `/api/v1/files/download?path=${encodeURIComponent(relativePath)}&fileName=${encodeURIComponent(fileName)}`;
      const token = localStorage.getItem('authToken');

      const response = await fetch(downloadUrl, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error('파일 다운로드 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('파일 다운로드 실패:', error);
      showAlert({
        type: 'error',
        title: '다운로드 실패',
        message: '파일 다운로드에 실패했습니다.',
      });
    }
  };

  // HWP/HWPX 파일 여부 (웹에서 바로 작성 가능한 형식)
  const isHwpFile = (name?: string) => !!name && /\.hwpx?$/i.test(name);

  // 진행중 기안의 첨부파일을 서버에 교체 (업로드 → 교체 API)
  const replaceApprovalAttachment = async (approvalId: string, file: File) => {
    const uploaded = await uploadFileToServer(file);
    if (!uploaded) throw new Error('파일 업로드 실패');
    await updateApprovalAttachment(approvalId, userId, {
      attachmentUrl: uploaded.filePath,
      attachmentFileName: uploaded.fileName,
      attachmentFileSize: uploaded.fileSize,
    });
    return uploaded;
  };

  // 웹 에디터에서 작성 완료한 문서를 첨부파일로 등록
  // (양식 탭에서 열었다면 해당 양식으로 새 기안 작성 모달을 자동으로 연다)
  const handleEditorSave = async (file: File) => {
    // 진행중 기안 첨부 수정 모드: 서버에 바로 반영
    if (viewer?.approvalId) {
      const approvalId = viewer.approvalId;
      try {
        await replaceApprovalAttachment(approvalId, file);
        setViewer(null);
        setSelectedApproval(null);
        loadApprovals();
        showAlert({
          type: 'success',
          title: '첨부파일 수정 완료',
          message: `수정한 문서(${file.name})가 결재 요청에 반영되었습니다.`,
        });
      } catch (error) {
        console.error('첨부파일 수정 실패:', error);
        showAlert({
          type: 'error',
          title: '수정 실패',
          message: error instanceof Error ? error.message : '첨부파일 수정에 실패했습니다.',
        });
      }
      return;
    }

    const templateId = viewer?.templateId;
    setApprovalForm(prev => ({
      ...prev,
      ...(templateId ? { templateId } : {}),
      file,
    }));
    setViewer(null);
    if (templateId) {
      setShowNewApproval(true);
      showAlert({
        type: 'success',
        title: '작성 완료',
        message: `작성한 문서(${file.name})가 첨부되었습니다. 제목을 입력하고 제출하면 기안이 완료됩니다.`,
      });
    } else {
      showAlert({
        type: 'success',
        title: '작성 완료',
        message: `작성한 문서(${file.name})가 첨부되었습니다. 제출 버튼을 눌러 기안을 완료하세요.`,
      });
    }
  };

  // Ctrl+S/자동 저장: 조용히 갱신 (모달 전환/알림 없음)
  const handleEditorAutoSave = (file: File) => {
    // 진행중 기안 첨부 수정 모드: 서버에 조용히 반영 (실패해도 닫을 때 재시도됨)
    if (viewer?.approvalId) {
      replaceApprovalAttachment(viewer.approvalId, file)
        .then(() => loadApprovals())
        .catch((error) => console.warn('첨부 자동 저장 실패 (닫을 때 재시도):', error));
      return;
    }

    const templateId = viewer?.templateId;
    setApprovalForm(prev => ({
      ...prev,
      ...(templateId ? { templateId } : {}),
      file,
    }));
  };

  // 파일 업로드 API 호출
  const uploadFileToServer = async (file: File): Promise<{ filePath: string; fileName: string; fileSize: number } | null> => {
    const formData = new FormData();
    formData.append('file', file);

    // 토큰 가져오기
    const token = localStorage.getItem('authToken');

    const response = await fetch('/api/v1/files/upload?category=attachments', {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '파일 업로드 실패');
    }

    const result = await response.json();
    return {
      filePath: result.filePath,
      fileName: result.fileName,
      fileSize: result.fileSize,
    };
  };

  // 결재 신청 제출 (file 타입 또는 hybrid의 파일 파트)
  const handleSubmitApproval = async () => {
    if (!approvalForm.templateId) {
      showAlert({ type: 'error', title: '입력 오류', message: '양식을 선택해주세요.' });
      return;
    }
    if (!approvalForm.title.trim()) {
      showAlert({ type: 'error', title: '입력 오류', message: '제목을 입력해주세요.' });
      return;
    }

    const templateType = selectedTemplateInfo?.templateType ?? 'file';
    const needsFile = templateType === 'file' || templateType === 'hybrid';

    if (needsFile && !approvalForm.file) {
      showAlert({ type: 'error', title: '입력 오류', message: '작성한 양식 파일을 첨부해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let uploadResult: { filePath: string; fileName: string; fileSize: number } | null = null;

      if (needsFile && approvalForm.file) {
        uploadResult = await uploadFileToServer(approvalForm.file);
        if (!uploadResult) {
          throw new Error('파일 업로드 실패');
        }
      }

      await createApprovalRequest({
        templateId: Number(approvalForm.templateId),
        title: approvalForm.title,
        ...(formData ? { formData } : {}),
        ...(uploadResult ? {
          attachmentUrl: uploadResult.filePath,
          attachmentFileName: uploadResult.fileName,
          attachmentFileSize: uploadResult.fileSize,
        } : {}),
      });

      showAlert({
        type: 'success',
        title: '제출 완료',
        message: '결재 요청이 성공적으로 제출되었습니다.',
      });

      setShowNewApproval(false);
      setApprovalForm({ templateId: '', title: '', file: null });
      setFormData(null);
      loadApprovals();
      setActiveTab('my-approvals');
    } catch (error) {
      console.error('결재 요청 제출 실패:', error);
      showAlert({
        type: 'error',
        title: '제출 실패',
        message: '결재 요청 제출에 실패했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // form/hybrid 타입: FormRenderer의 onSubmit 콜백
  const handleFormRendererSubmit = async (data: Record<string, any>) => {
    if (!approvalForm.templateId) {
      showAlert({ type: 'error', title: '입력 오류', message: '양식을 선택해주세요.' });
      return;
    }
    if (!approvalForm.title.trim()) {
      showAlert({ type: 'error', title: '입력 오류', message: '제목을 입력해주세요.' });
      return;
    }

    const templateType = selectedTemplateInfo?.templateType ?? 'file';

    if (templateType === 'hybrid' && !approvalForm.file) {
      showAlert({ type: 'error', title: '입력 오류', message: '혼합 양식은 파일 첨부도 필요합니다.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let uploadResult: { filePath: string; fileName: string; fileSize: number } | null = null;

      if (templateType === 'hybrid' && approvalForm.file) {
        uploadResult = await uploadFileToServer(approvalForm.file);
        if (!uploadResult) {
          throw new Error('파일 업로드 실패');
        }
      }

      await createApprovalRequest({
        templateId: Number(approvalForm.templateId),
        title: approvalForm.title,
        formData: data,
        ...(uploadResult ? {
          attachmentUrl: uploadResult.filePath,
          attachmentFileName: uploadResult.fileName,
          attachmentFileSize: uploadResult.fileSize,
        } : {}),
      });

      showAlert({
        type: 'success',
        title: '제출 완료',
        message: '결재 요청이 성공적으로 제출되었습니다.',
      });

      setShowNewApproval(false);
      setApprovalForm({ templateId: '', title: '', file: null });
      setFormData(null);
      loadApprovals();
      setActiveTab('my-approvals');
    } catch (error) {
      console.error('결재 요청 제출 실패:', error);
      showAlert({
        type: 'error',
        title: '제출 실패',
        message: '결재 요청 제출에 실패했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 결재 취소
  const handleCancelApproval = async (id: string | number) => {
    const confirmed = await confirm({
      title: '기안 취소',
      message: '이 결재 요청을 취소하시겠습니까?\n취소된 기안은 복구할 수 없습니다.',
      confirmText: '취소하기',
      cancelText: '돌아가기',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await cancelApprovalRequest(String(id));
      showAlert({
        type: 'success',
        title: '취소 완료',
        message: '결재 요청이 취소되었습니다.',
      });
      loadApprovals();
      setSelectedApproval(null);
    } catch (error) {
      console.error('결재 취소 실패:', error);
      showAlert({
        type: 'error',
        title: '취소 실패',
        message: '결재 요청 취소에 실패했습니다.',
      });
    }
  };

  // 모달 닫기
  const closeNewApprovalModal = () => {
    setShowNewApproval(false);
    setApprovalForm({ templateId: '', title: '', file: null });
    setFormData(null);
  };

  const selectedTemplateInfo = templates.find(t => String(t.id) === approvalForm.templateId);

  const isWideModal = selectedTemplateInfo?.templateType === 'form' || selectedTemplateInfo?.templateType === 'hybrid';

  // 파일 첨부 드롭존 (공용 렌더)
  const renderFileDropzone = (label: string = '작성한 양식 첨부') => (
    <FileInput
      label={label}
      isRequired
      mode="dropzone"
      value={approvalForm.file}
      onChange={(file) => setApprovalForm(prev => ({ ...prev, file: file as File | null }))}
      accept=".hwp,.hwpx,.doc,.docx,.pdf,.xls,.xlsx"
      placeholder="클릭하여 작성한 파일 첨부 (.hwp, .docx, .pdf 등)"
    />
  );

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />
      <VStack gap={5}>
        {/* 헤더 */}
        <HStack hAlign="between" vAlign="center">
          <VStack gap={1}>
            <Heading level={2}>전자결재</Heading>
            <Text type="supporting" color="secondary">양식 다운로드 및 결재 신청</Text>
          </VStack>
          <Button
            label="새 기안 작성"
            variant="primary"
            icon={<Icon icon={FiPlus} />}
            onClick={() => setShowNewApproval(true)}
          />
        </HStack>

        {/* 탭 */}
        <SegmentedControl
          value={activeTab}
          onChange={(value) => setActiveTab(value as TabType)}
          label="전자결재 탭"
          layout="fill"
        >
          <SegmentedControlItem value="my-approvals" label={`내 결재 내역 (${approvals.length})`} />
          <SegmentedControlItem value="templates" label="양식 다운로드" />
        </SegmentedControl>

        {/* 양식 다운로드 탭 */}
        {activeTab === 'templates' && (
          templates.length > 0 ? (
            <VStack gap={3}>
              {templates.map((template) => (
                <Card key={template.id}>
                  <HStack hAlign="between" vAlign="center" gap={4}>
                    <HStack gap={4} vAlign="start">
                      <Icon icon={FiFileText} color="secondary" size="lg" />
                      <VStack gap={1}>
                        <HStack gap={2} vAlign="center">
                          <Text weight="semibold" color="primary">{template.name}</Text>
                          {(template.templateType === 'file' || !template.templateType) && (
                            <Badge variant="teal" label="파일 양식" />
                          )}
                          {template.templateType === 'form' && (
                            <Badge variant="green" label="온라인 양식" />
                          )}
                          {template.templateType === 'hybrid' && (
                            <Badge variant="yellow" label="혼합 양식" />
                          )}
                        </HStack>
                        <Text type="supporting" color="secondary">{template.description}</Text>
                        {(template.templateType === 'file' || template.templateType === 'hybrid' || !template.templateType) && template.fileName && (
                          <Text type="supporting" color="disabled">
                            {template.fileName} ({formatFileSize(template.fileSize)})
                          </Text>
                        )}
                      </VStack>
                    </HStack>
                    {(template.templateType === 'file' || template.templateType === 'hybrid' || !template.templateType) && template.fileUrl && (
                      <HStack gap={2} vAlign="center">
                        <Button
                          label={isHwpFile(template.fileName) ? '바로 보기 · 작성' : '바로 보기'}
                          variant="primary"
                          size="sm"
                          icon={<Icon icon={FiEye} />}
                          onClick={() => setViewer({
                            fileUrl: template.fileUrl,
                            fileName: template.fileName,
                            authoring: isHwpFile(template.fileName),
                            templateId: String(template.id),
                          })}
                        />
                        <Button
                          label="다운로드"
                          variant="secondary"
                          size="sm"
                          icon={<Icon icon={FiDownload} />}
                          onClick={() => handleDownloadTemplate(template)}
                        />
                      </HStack>
                    )}
                  </HStack>
                </Card>
              ))}
            </VStack>
          ) : (
            <EmptyState
              icon={<Icon icon={FiFileText} size="lg" />}
              title="등록된 양식이 없습니다"
              description="관리자에게 문의하세요"
            />
          )
        )}

        {/* 내 결재 내역 탭 */}
        {activeTab === 'my-approvals' && (
          <>
            {/* 상태 필터 */}
            <SegmentedControl
              value={approvalFilter}
              onChange={(value) => setApprovalFilter(value as ApprovalFilterType)}
              label="결재 상태 필터"
              layout="fill"
            >
              <SegmentedControlItem value="all" label={`전체 (${getStatusCount()})`} />
              <SegmentedControlItem value="pending" label={`진행중 (${getStatusCount('PENDING')})`} />
              <SegmentedControlItem value="approved" label={`승인됨 (${getStatusCount('APPROVED')})`} />
              <SegmentedControlItem value="rejected" label={`반려됨 (${getStatusCount('REJECTED')})`} />
            </SegmentedControl>

            {/* 결재 목록 */}
            {isLoading ? (
              <Center height={256}>
                <Spinner label="결재 목록을 불러오는 중..." />
              </Center>
            ) : filteredApprovals.length > 0 ? (
              <VStack gap={3}>
                {filteredApprovals.map((approval) => (
                  <motion.div
                    key={approval.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ClickableCard label={approval.title} onClick={() => setSelectedApproval(approval)}>
                      <HStack hAlign="between" vAlign="center" gap={4}>
                        <VStack gap={1}>
                          <HStack gap={2} vAlign="center">
                            <Badge variant={getStatusVariant(approval.status)} label={getStatusText(approval.status)} />
                            <Text type="supporting" color="disabled">{approval.templateName}</Text>
                          </HStack>
                          <Text weight="semibold" color="primary">{approval.title}</Text>
                          <Text type="supporting" color="secondary">
                            {format(new Date(approval.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                          </Text>
                        </VStack>
                        <Icon icon={FiChevronRight} color="tertiary" />
                      </HStack>
                    </ClickableCard>
                  </motion.div>
                ))}
              </VStack>
            ) : (
              <EmptyState
                icon={<Icon icon={FiFileText} size="lg" />}
                title="결재 요청이 없습니다"
                description="새 기안 작성 버튼을 눌러 결재를 요청하세요"
              />
            )}
          </>
        )}
      </VStack>

      {/* 새 기안 작성 모달 */}
      <Dialog
        isOpen={showNewApproval}
        onOpenChange={(open) => { if (!open) closeNewApprovalModal(); }}
        purpose="form"
        width={isWideModal ? 680 : 460}
      >
        <Layout
          header={
            <DialogHeader
              title="새 기안 작성"
              onOpenChange={(open) => { if (!open) closeNewApprovalModal(); }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <Text type="supporting" color="secondary">
                  {selectedTemplateInfo?.templateType === 'form'
                    ? '온라인 양식을 작성하세요'
                    : selectedTemplateInfo?.templateType === 'hybrid'
                    ? '온라인 양식 작성 후 파일도 첨부하세요'
                    : '양식을 선택하고 작성한 파일을 첨부하세요'}
                </Text>

                {/* 양식 선택 */}
                <Selector
                  label="양식 선택"
                  isRequired
                  placeholder="양식을 선택하세요"
                  value={approvalForm.templateId}
                  options={templates.map((template) => ({ value: String(template.id), label: template.name }))}
                  onChange={(value) => {
                    setApprovalForm(prev => ({ ...prev, templateId: value, file: null }));
                    setFormData(null);
                  }}
                  description={selectedTemplateInfo?.description}
                />

                {/* 제목 */}
                <TextInput
                  label="제목"
                  isRequired
                  type="text"
                  value={approvalForm.title}
                  onChange={(value) => setApprovalForm(prev => ({ ...prev, title: value }))}
                  placeholder="예: 2026년 1월 휴가 신청"
                />

                {/* templateType에 따른 분기 */}
                {(!selectedTemplateInfo || selectedTemplateInfo.templateType === 'file') && (
                  /* 파일 양식: 기존 파일 업로드 UI */
                  <VStack gap={2}>
                    {selectedTemplateInfo?.fileUrl && isHwpFile(selectedTemplateInfo.fileName) && (
                      <Button
                        label="양식을 웹에서 바로 작성 (다운로드 불필요)"
                        variant="primary"
                        icon={<Icon icon={FiEdit3} />}
                        onClick={() => setViewer({
                          fileUrl: selectedTemplateInfo.fileUrl,
                          fileName: selectedTemplateInfo.fileName,
                          authoring: true,
                        })}
                      />
                    )}
                    {renderFileDropzone('작성한 양식 첨부')}
                  </VStack>
                )}

                {selectedTemplateInfo?.templateType === 'form' && selectedTemplateInfo.formSchema && (
                  /* 온라인 양식: FormRenderer (자체 제출 버튼 포함) */
                  <VStack gap={3}>
                    <Text type="label" weight="medium" color="primary">온라인 양식 작성</Text>
                    <FormRenderer
                      schema={selectedTemplateInfo.formSchema}
                      onSubmit={handleFormRendererSubmit}
                      submitLabel={isSubmitting ? '제출 중...' : '제출'}
                    />
                  </VStack>
                )}

                {selectedTemplateInfo?.templateType === 'hybrid' && selectedTemplateInfo.formSchema && (
                  /* 혼합 양식: FormRenderer + 파일 첨부 */
                  <VStack gap={4}>
                    <VStack gap={3}>
                      <Text type="label" weight="medium" color="primary">온라인 양식 작성</Text>
                      <FormRenderer
                        schema={selectedTemplateInfo.formSchema}
                        onSubmit={(data) => setFormData(data)}
                        submitLabel="양식 확인"
                      />
                    </VStack>
                    {formData && (
                      <Banner status="success" title="온라인 양식이 확인되었습니다." />
                    )}
                    <VStack gap={2}>
                      {selectedTemplateInfo.fileUrl && isHwpFile(selectedTemplateInfo.fileName) && (
                        <Button
                          label="양식을 웹에서 바로 작성 (다운로드 불필요)"
                          variant="primary"
                          icon={<Icon icon={FiEdit3} />}
                          onClick={() => setViewer({
                            fileUrl: selectedTemplateInfo.fileUrl,
                            fileName: selectedTemplateInfo.fileName,
                            authoring: true,
                          })}
                        />
                      )}
                      {renderFileDropzone('추가 파일 첨부')}
                    </VStack>
                  </VStack>
                )}
              </VStack>
            </LayoutContent>
          }
          footer={
            /* 하단 버튼 — form 타입은 FormRenderer 내부 버튼이 처리, file/hybrid/미선택은 여기서 */
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button
                  label="취소"
                  variant="ghost"
                  onClick={closeNewApprovalModal}
                />
                {selectedTemplateInfo?.templateType !== 'form' && (
                  <Button
                    label="제출"
                    variant="primary"
                    isLoading={isSubmitting}
                    isDisabled={
                      isSubmitting ||
                      !approvalForm.templateId ||
                      !approvalForm.title.trim() ||
                      ((!selectedTemplateInfo || selectedTemplateInfo.templateType === 'file') && !approvalForm.file) ||
                      (selectedTemplateInfo?.templateType === 'hybrid' && (!formData || !approvalForm.file))
                    }
                    onClick={handleSubmitApproval}
                  />
                )}
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 결재 상세 모달 */}
      <Dialog
        isOpen={!!selectedApproval}
        onOpenChange={(open) => { if (!open) setSelectedApproval(null); }}
        purpose="info"
        width={520}
      >
        {selectedApproval && (
          <Layout
            header={
              <DialogHeader
                title={selectedApproval.title}
                onOpenChange={(open) => { if (!open) setSelectedApproval(null); }}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  {/* 상태 + 양식명 */}
                  <HStack gap={2} vAlign="center">
                    <Badge variant={getStatusVariant(selectedApproval.status)} label={getStatusText(selectedApproval.status)} />
                    <Text type="supporting" color="secondary">{selectedApproval.templateName}</Text>
                  </HStack>

                  {/* 기안 정보 */}
                  <HStack gap={3} vAlign="stretch">
                    <div style={{ flex: 1 }}>
                      <Card variant="muted" padding={3} width="100%">
                        <VStack gap={1}>
                          <Text type="supporting" color="secondary">기안일시</Text>
                          <Text weight="medium" color="primary">
                            {format(new Date(selectedApproval.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                          </Text>
                        </VStack>
                      </Card>
                    </div>
                    {selectedApproval.processedAt && (
                      <div style={{ flex: 1 }}>
                        <Card variant="muted" padding={3} width="100%">
                          <VStack gap={1}>
                            <Text type="supporting" color="secondary">처리일시</Text>
                            <Text weight="medium" color="primary">
                              {format(new Date(selectedApproval.processedAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                            </Text>
                          </VStack>
                        </Card>
                      </div>
                    )}
                  </HStack>

                  {/* 첨부파일 - 단일 필드 (백엔드 구조에 맞춤) */}
                  {selectedApproval.attachmentUrl && (
                    <VStack gap={2}>
                      <Text type="label" weight="medium" color="primary">첨부파일</Text>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'stretch',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-inner)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          onClick={() => {
                            // 내가 올린 진행중 기안의 한글 첨부는 바로 편집 모드로 열어
                            // Ctrl+S/저장이 서버에 반영되게 한다
                            const editable = selectedApproval.status === 'PENDING' && isHwpFile(selectedApproval.attachmentFileName);
                            setViewer({
                              fileUrl: selectedApproval.attachmentUrl!,
                              fileName: selectedApproval.attachmentFileName || '첨부파일',
                              ...(editable ? { authoring: true, approvalId: String(selectedApproval.id) } : {}),
                            });
                          }}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-3)',
                            padding: 'var(--spacing-3)',
                            cursor: 'pointer',
                            minWidth: 0,
                          }}
                        >
                          <Icon icon={FiEye} color="secondary" />
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Text color="primary">{selectedApproval.attachmentFileName || '첨부파일'}</Text>
                          </span>
                          <Text type="supporting" color="secondary">
                            {formatFileSize(selectedApproval.attachmentFileSize || 0)}
                          </Text>
                        </div>
                        {selectedApproval.status === 'PENDING' && isHwpFile(selectedApproval.attachmentFileName) && (
                          <div style={{ borderLeft: '1px solid var(--color-border)', display: 'flex', alignItems: 'center' }}>
                            <IconButton
                              label="첨부파일 웹에서 수정"
                              tooltip="웹에서 수정"
                              variant="ghost"
                              icon={<Icon icon={FiEdit3} />}
                              onClick={() => setViewer({
                                fileUrl: selectedApproval.attachmentUrl!,
                                fileName: selectedApproval.attachmentFileName || '첨부파일',
                                authoring: true,
                                approvalId: String(selectedApproval.id),
                              })}
                            />
                          </div>
                        )}
                        <div style={{ borderLeft: '1px solid var(--color-border)', display: 'flex', alignItems: 'center' }}>
                          <IconButton
                            label="첨부파일 다운로드"
                            tooltip="다운로드"
                            variant="ghost"
                            icon={<Icon icon={FiDownload} />}
                            onClick={() => handleDownloadAttachment(selectedApproval.attachmentUrl!, selectedApproval.attachmentFileName || '첨부파일')}
                          />
                        </div>
                      </div>
                      {selectedApproval.status === 'PENDING' && isHwpFile(selectedApproval.attachmentFileName) && (
                        <Text type="supporting" color="secondary">
                          클릭하면 웹에서 바로 수정할 수 있고, 저장(Ctrl+S)하면 결재 문서에 반영됩니다 (결재 전까지만)
                        </Text>
                      )}
                    </VStack>
                  )}

                  {/* 반려 사유 */}
                  {selectedApproval.status === 'REJECTED' && selectedApproval.rejectReason && (
                    <Banner status="error" title="반려 사유" description={selectedApproval.rejectReason} />
                  )}
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  {selectedApproval.status === 'PENDING' && (
                    <Button
                      label="기안 취소"
                      variant="destructive"
                      onClick={() => handleCancelApproval(selectedApproval.id)}
                    />
                  )}
                  <Button
                    label="닫기"
                    variant="primary"
                    onClick={() => setSelectedApproval(null)}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        )}
      </Dialog>

      {/* 문서 뷰어 / 웹 작성 모달 */}
      <AnimatePresence>
        {viewer && (
          <DocumentViewerModal
            fileUrl={viewer.fileUrl}
            fileName={viewer.fileName}
            onClose={() => setViewer(null)}
            onSave={viewer.authoring ? handleEditorSave : undefined}
            onAutoSave={viewer.authoring ? handleEditorAutoSave : undefined}
            saveLabel={viewer.approvalId ? '수정 완료 · 반영하기' : '작성 완료 · 첨부하기'}
          />
        )}
      </AnimatePresence>
    </>
  );
}
