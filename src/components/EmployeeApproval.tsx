'use client';

import { useState, useEffect, useMemo } from 'react';
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
import type { SelectorOptionType } from '@astryxdesign/core/Selector';
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
import { Loading } from '@/components/Loading';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { getActiveApprovalTemplates, getMyApprovalRequests, createApprovalRequest, updateApprovalDraft, submitApprovalDraft, cancelApprovalRequest, updateApprovalAttachment, getApprovalRequesterId, type ApprovalRequestPayload } from '@/lib/apiService';
import { ApprovalRequest, ApprovalStatus, ApproverCandidate } from '@/types/approval';
import { ApprovalTemplate } from '@/types/approvalTemplate';
import { useAlert } from './Alert';
import { useConfirm } from './ConfirmDialog';
import FormRenderer from './approval/FormRenderer';
import OfficialDocument from './approval/OfficialDocument';
import MySignatureCard from './approval/MySignatureCard';
import DocumentViewerModal from './DocumentViewerModal';
import { duration } from '@/theme/motion';
import { UNCATEGORIZED_LABEL } from '@/lib/defaultApprovalTemplates';

type TabType = 'templates' | 'my-approvals';
type ApprovalFilterType = 'all' | 'pending' | 'approved' | 'rejected';

export default function EmployeeApproval() {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>('my-approvals');
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilterType>('all');
  /** 내 결재 내역의 기안 종류 필터 ('' = 전체) */
  const [categoryFilter, setCategoryFilter] = useState('');
  /** 양식 다운로드 탭의 기안 종류 필터 ('' = 전체) */
  const [templateFilter, setTemplateFilter] = useState('');
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
  const [approvalLine, setApprovalLine] = useState<ApproverCandidate[]>([]);
  const [showSignatureManager, setShowSignatureManager] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  /** 올리기 전 완성 모양 확인 */
  const [showPreview, setShowPreview] = useState(false);
  /** 이어쓰는 중인 임시저장 문서 id — 새로 쓰는 중이면 null */
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

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
  const [companyName, setCompanyName] = useState('');

  // 클라이언트에서만 userId를 설정 (SSR 하이드레이션 불일치 방지)
  useEffect(() => {
    setUserId(getApprovalRequesterId());
    setCompanyName(
      localStorage.getItem('companyName') || localStorage.getItem('organizationName') || ''
    );
  }, []);

  // 상세 공문 렌더용 폼 스키마 (선택된 기안의 양식)
  const selectedApprovalSchema = (() => {
    if (!selectedApproval) return undefined;
    const template = templates.find(t => String(t.id) === String(selectedApproval.templateId));
    if (!template?.formSchema) return undefined;
    try {
      return typeof template.formSchema === 'string'
        ? JSON.parse(template.formSchema)
        : template.formSchema;
    } catch {
      return undefined;
    }
  })();

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

  /** 결재 문서의 기안 종류 — 문서에는 templateId만 있어 양식에서 분류를 끌어온다 */
  const categoryOf = (approval: ApprovalRequest) => {
    const template = templates.find((t) => String(t.id) === String(approval.templateId));
    return (template?.category || '').trim() || UNCATEGORIZED_LABEL;
  };

  /** 내 결재 내역에 등장하는 기안 종류 */
  const approvalCategories = useMemo(() => {
    const seen: string[] = [];
    for (const approval of approvals) {
      const category = categoryOf(approval);
      if (!seen.includes(category)) seen.push(category);
    }
    return seen;
  }, [approvals, templates]);

  /** 양식 다운로드 탭에서 쓰는 분류 목록 (활성 양식 기준) */
  const templateCategories = useMemo(() => {
    const seen: string[] = [];
    for (const template of templates) {
      const category = (template.category || '').trim() || UNCATEGORIZED_LABEL;
      if (!seen.includes(category)) seen.push(category);
    }
    return seen;
  }, [templates]);

  // 필터링된 결재 목록
  const filteredApprovals = approvals.filter(approval => {
    if (categoryFilter && categoryOf(approval) !== categoryFilter) return false;
    if (approvalFilter === 'all') return true;
    if (approvalFilter === 'pending') return approval.status === 'PENDING';
    if (approvalFilter === 'approved') return approval.status === 'APPROVED';
    if (approvalFilter === 'rejected') return approval.status === 'REJECTED';
    return true;
  });

  /** 양식 다운로드 탭에서 분류 필터가 적용된 양식 목록 */
  const filteredTemplates = templateFilter
    ? templates.filter((t) => ((t.category || '').trim() || UNCATEGORIZED_LABEL) === templateFilter)
    : templates;

  /**
   * 양식 선택 드롭다운 옵션 — 기안 종류(대분류)별 섹션으로 묶는다.
   * 분류가 하나뿐이면 섹션 머리글이 오히려 방해되므로 평평한 목록으로 둔다.
   */
  const templateSelectorOptions = useMemo((): SelectorOptionType[] => {
    if (templateCategories.length <= 1) {
      return templates.map((t) => ({ value: String(t.id), label: t.name }));
    }
    return templateCategories.map((category) => ({
      type: 'section' as const,
      title: category,
      options: templates
        .filter((t) => ((t.category || '').trim() || UNCATEGORIZED_LABEL) === category)
        .map((t) => ({ value: String(t.id), label: t.name })),
    }));
  }, [templates, templateCategories]);

  // 상태 카운트 — 기안 종류 필터가 걸려 있으면 그 안에서만 센다 (탭 숫자와 목록이 어긋나지 않게)
  const getStatusCount = (status?: ApprovalStatus) => {
    const scoped = categoryFilter ? approvals.filter((a) => categoryOf(a) === categoryFilter) : approvals;
    if (!status) return scoped.length;
    return scoped.filter(a => a.status === status).length;
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
      case 'DRAFT':
        return '임시저장';
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
    if (approvalLine.length === 0) {
      showAlert({
        type: 'error',
        title: '결재선 미지정 양식',
        message: '이 양식에는 결재선이 지정되어 있지 않습니다. 양식 관리에서 결재선을 지정한 후 다시 시도해주세요.',
      });
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

      await saveOrSubmit({
        templateId: Number(approvalForm.templateId),
        title: approvalForm.title,
        ...(formData ? { formData } : {}),
        ...(uploadResult ? {
          attachmentUrl: uploadResult.filePath,
          attachmentFileName: uploadResult.fileName,
          attachmentFileSize: uploadResult.fileSize,
        } : {}),
        approvalLine: buildApprovalLinePayload(),
      });

      showAlert({
        type: 'success',
        title: '제출 완료',
        message: '결재 요청이 성공적으로 제출되었습니다.',
      });

      closeNewApprovalModal();
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
    if (approvalLine.length === 0) {
      showAlert({
        type: 'error',
        title: '결재선 미지정 양식',
        message: '이 양식에는 결재선이 지정되어 있지 않습니다. 양식 관리에서 결재선을 지정한 후 다시 시도해주세요.',
      });
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

      await saveOrSubmit({
        templateId: Number(approvalForm.templateId),
        title: approvalForm.title,
        formData: data,
        ...(uploadResult ? {
          attachmentUrl: uploadResult.filePath,
          attachmentFileName: uploadResult.fileName,
          attachmentFileSize: uploadResult.fileSize,
        } : {}),
        approvalLine: buildApprovalLinePayload(),
      });

      showAlert({
        type: 'success',
        title: '제출 완료',
        message: '결재 요청이 성공적으로 제출되었습니다.',
      });

      closeNewApprovalModal();
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
    setApprovalLine([]);
    setEditingDraftId(null);
  };

  /**
   * 임시저장. 상신과 달리 결재선·첨부가 아직 비어 있어도 저장된다 —
   * 다 갖춰야 저장할 수 있으면 '중간까지 써두기'라는 목적 자체가 사라진다.
   * 제목만 있으면 나중에 목록에서 찾을 수 있으므로 제목만 요구한다.
   */
  const handleSaveDraft = async () => {
    if (!approvalForm.templateId) {
      showAlert({ type: 'error', title: '입력 오류', message: '양식을 선택해주세요.' });
      return;
    }
    if (!approvalForm.title.trim()) {
      showAlert({ type: 'error', title: '입력 오류', message: '나중에 찾을 수 있도록 제목을 입력해주세요.' });
      return;
    }

    setIsSavingDraft(true);
    try {
      // 임시저장에서는 파일을 다시 올리지 않는다 — 저장할 때마다 같은 파일이 쌓인다.
      // 첨부는 상신할 때 확정한다.
      const payload = {
        templateId: Number(approvalForm.templateId),
        title: approvalForm.title,
        ...(formData ? { formData } : {}),
        approvalLine: buildApprovalLinePayload(),
      };

      if (editingDraftId) {
        await updateApprovalDraft(editingDraftId, payload);
      } else {
        const response = await createApprovalRequest({ ...payload, draft: true });
        const createdId = (response?.approval ?? response)?.id;
        if (createdId != null) setEditingDraftId(String(createdId));
      }

      showAlert({
        type: 'success',
        title: '임시저장 완료',
        message: '내 결재함에서 이어서 작성할 수 있습니다.',
      });
      loadApprovals();
    } catch (error) {
      console.error('임시저장 실패:', error);
      showAlert({
        type: 'error',
        title: '임시저장 실패',
        message: error instanceof Error ? error.message : '임시저장에 실패했습니다.',
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  /** 임시저장 문서를 작성 모달로 다시 불러온다 */
  const openDraft = (approval: ApprovalRequest) => {
    setEditingDraftId(String(approval.id));
    setApprovalForm({
      templateId: String(approval.templateId ?? ''),
      title: approval.title ?? '',
      file: null,
    });
    setFormData(parseFormData(approval.formData));
    setApprovalLine(toApproverCandidates(approval));
    setShowNewApproval(true);
  };

  /**
   * 상신. 임시저장에서 이어온 문서면 새로 만들지 않고 그 문서를 상신한다 —
   * 새로 만들면 임시저장본이 그대로 남아 같은 문서가 두 건이 된다.
   */
  const saveOrSubmit = async (payload: ApprovalRequestPayload) => {
    if (editingDraftId) {
      return submitApprovalDraft(editingDraftId, payload);
    }
    return createApprovalRequest(payload);
  };

  /**
   * 지금 작성 중인 내용으로 '올리면 이렇게 보인다'를 만든다.
   *
   * 제출된 기안과 같은 컴포넌트(OfficialDocument)에 먹여야 실제와 어긋나지 않는다.
   * 아직 서버에 없는 문서라 id·문서번호처럼 상신 후에 정해지는 값은 비워 둔다.
   */
  const previewApproval = (): ApprovalRequest | null => {
    if (!selectedTemplateInfo) return null;
    return {
      id: 'preview',
      templateId: String(selectedTemplateInfo.id),
      templateName: selectedTemplateInfo.name,
      title: approvalForm.title || '(제목을 입력하세요)',
      formData: formData || {},
      attachmentUrl: undefined,
      attachmentFileName: approvalForm.file?.name,
      attachmentFileSize: approvalForm.file?.size,
      requesterId: '',
      requesterName: (typeof window !== 'undefined' && localStorage.getItem('userName')) || '기안자',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      hasApprovalLine: approvalLine.length > 0,
      // 아직 아무도 결재하지 않았으므로 전부 대기로 그린다
      approvalLine: approvalLine.map((approver, index) => ({
        id: index,
        stepOrder: index + 1,
        approverType: approver.approverType,
        approverId: String(approver.approverId),
        approverName: approver.name,
        roleLabel: index === approvalLine.length - 1 ? 'FINAL' : 'REVIEWER',
        status: 'PENDING',
      })),
    } as ApprovalRequest;
  };

  /** 저장된 폼 값 — 백엔드가 JSON 문자열로 돌려줄 때가 있어 양쪽을 모두 받는다 */
  const parseFormData = (value: unknown): Record<string, any> | null => {
    if (!value) return null;
    if (typeof value === 'object') return value as Record<string, any>;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return null;
  };

  /**
   * 저장된 결재선(단계)을 다시 고르기 위한 후보 형태로 되돌린다.
   * 단계의 approverId는 'admin_3' 같은 문자열이라 숫자만 떼어내야 한다.
   */
  const toApproverCandidates = (approval: ApprovalRequest): ApproverCandidate[] =>
    (approval.approvalLine ?? [])
      .slice()
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((step) => ({
        approverType: step.approverType,
        approverId: Number(String(step.approverId).replace('admin_', '')),
        name: step.approverName,
      }))
      .filter((candidate) => Number.isFinite(candidate.approverId));

  // 결재선을 생성 payload 형태로 변환
  const buildApprovalLinePayload = () =>
    approvalLine.map((approver) => ({
      approverType: approver.approverType,
      approverId: approver.approverId,
    }));

  const selectedTemplateInfo = templates.find(t => String(t.id) === approvalForm.templateId);

  // 백엔드는 formSchema를 JSON 문자열로 내려준다 — FormRenderer에는 파싱된 객체만 전달
  const selectedTemplateSchema = (() => {
    const raw = selectedTemplateInfo?.formSchema as unknown;
    if (!raw) return undefined;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed && Array.isArray((parsed as { fields?: unknown }).fields) ? parsed : undefined;
    } catch {
      return undefined;
    }
  })();

  const isWideModal = selectedTemplateInfo?.templateType === 'form' || selectedTemplateInfo?.templateType === 'hybrid';

  // 파일 첨부 드롭존 (공용 렌더)
  /**
   * 파일 양식(HWP·워드 등)을 작성 화면에서 바로 여는 버튼들.
   *
   * 전에는 한글 양식에만 '웹에서 바로 작성'이 있었고, 그 외 형식은 양식이 어떻게 생겼는지
   * 보려면 내려받아야 했다. 양식 다운로드 탭이 이미 하는 일이라 같은 뷰어를 여기서도 쓴다.
   * 한글은 편집까지 되므로 '보기'와 '작성'을 나눠 둔다 — 그냥 확인만 하고 싶을 때
   * 편집기가 열리면 부담스럽다.
   */
  const renderTemplateFileActions = () => {
    const fileUrl = selectedTemplateInfo?.fileUrl;
    if (!fileUrl) return null;
    const fileName = selectedTemplateInfo?.fileName;
    const editable = isHwpFile(fileName);

    return (
      <HStack gap={2} wrap="wrap">
        <Button
          label="양식 바로 보기"
          variant="secondary"
          icon={<Icon icon={FiEye} />}
          onClick={() => setViewer({ fileUrl, fileName })}
        />
        {editable && (
          <Button
            label="양식을 웹에서 바로 작성 (다운로드 불필요)"
            variant="primary"
            icon={<Icon icon={FiEdit3} />}
            onClick={() => setViewer({ fileUrl, fileName, authoring: true })}
          />
        )}
        <Button
          label="다운로드"
          variant="ghost"
          icon={<Icon icon={FiDownload} />}
          onClick={() => selectedTemplateInfo && handleDownloadTemplate(selectedTemplateInfo)}
        />
      </HStack>
    );
  };

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
      {/* 셸이 flex 컬럼으로 감싸므로 남은 높이를 모두 차지한다 */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', gap: 'var(--spacing-5)' }}>
        {/* 헤더 */}
        <HStack hAlign="between" vAlign="center">
          <VStack gap={1}>
            <Heading level={2}>전자결재</Heading>
            <Text type="supporting" color="secondary">양식 다운로드 및 결재 신청</Text>
          </VStack>
          <HStack gap={2}>
            <Button
              label="서명 관리"
              variant="secondary"
              icon={<Icon icon={FiEdit3} />}
              onClick={() => setShowSignatureManager(true)}
            />
            <Button
              label="새 기안 작성"
              variant="primary"
              icon={<Icon icon={FiPlus} />}
              onClick={() => setShowNewApproval(true)}
            />
          </HStack>
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
              {/* 기안 종류 필터 — 분류가 둘 이상일 때만 */}
              {templateCategories.length > 1 && (
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Text type="supporting" color="secondary">기안 종류</Text>
                  <Button
                    label={`전체 (${templates.length})`}
                    variant={templateFilter === '' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setTemplateFilter('')}
                  />
                  {templateCategories.map((category) => (
                    <Button
                      key={category}
                      label={`${category} (${templates.filter((t) => ((t.category || '').trim() || UNCATEGORIZED_LABEL) === category).length})`}
                      variant={templateFilter === category ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setTemplateFilter(category)}
                    />
                  ))}
                </HStack>
              )}
              {filteredTemplates.map((template) => (
                <Card key={template.id}>
                  <HStack hAlign="between" vAlign="center" gap={4}>
                    <HStack gap={4} vAlign="start">
                      <Icon icon={FiFileText} color="secondary" size="lg" />
                      <VStack gap={1}>
                        <HStack gap={2} vAlign="center">
                          <Text weight="semibold" color="primary">{template.name}</Text>
                          {(template.category || '').trim() && (
                            <Badge variant="blue" label={(template.category || '').trim()} />
                          )}
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
                    <HStack gap={2} vAlign="center">
                      {/* 온라인 양식은 내려받을 파일이 없다. 화면에서 채우는 것이 이 양식을 쓰는
                          유일한 방법이라 그리로 보낸다 — 전에는 버튼이 하나도 없어서
                          눌러도 아무 일이 없었다. */}
                      {template.templateType === 'form' && (
                        <Button
                          label="이 양식으로 작성"
                          variant="primary"
                          size="sm"
                          icon={<Icon icon={FiEdit3} />}
                          onClick={() => {
                            setApprovalForm(prev => ({ ...prev, templateId: String(template.id) }));
                            setShowNewApproval(true);
                          }}
                        />
                      )}

                      {(template.templateType === 'file' || template.templateType === 'hybrid' || !template.templateType) && (
                        template.fileUrl ? (
                          <>
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
                          </>
                        ) : (
                          // 파일 양식인데 파일이 없는 경우 — 조용히 비워두면 고장으로 보인다
                          <Text type="supporting" color="disabled">첨부된 파일이 없습니다</Text>
                        )
                      )}

                      {/* 혼합 양식은 파일도 있고 화면 입력도 있다 — 둘 다 갈 수 있게 한다 */}
                      {template.templateType === 'hybrid' && (
                        <Button
                          label="화면에서 작성"
                          variant="secondary"
                          size="sm"
                          icon={<Icon icon={FiEdit3} />}
                          onClick={() => {
                            setApprovalForm(prev => ({ ...prev, templateId: String(template.id) }));
                            setShowNewApproval(true);
                          }}
                        />
                      )}
                    </HStack>
                  </HStack>
                </Card>
              ))}
            </VStack>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState
                icon={<Icon icon={FiFileText} size="lg" />}
                title="등록된 양식이 없습니다"
                description="관리자에게 문의하세요"
              />
            </div>
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

            {/* 기안 종류 필터 — 내 문서에 분류가 둘 이상 섞여 있을 때만 */}
            {approvalCategories.length > 1 && (
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text type="supporting" color="secondary">기안 종류</Text>
                <Button
                  label={`전체 (${approvals.length})`}
                  variant={categoryFilter === '' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setCategoryFilter('')}
                />
                {approvalCategories.map((category) => (
                  <Button
                    key={category}
                    label={`${category} (${approvals.filter((a) => categoryOf(a) === category).length})`}
                    variant={categoryFilter === category ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setCategoryFilter(category)}
                  />
                ))}
              </HStack>
            )}

            {/* 결재 목록 */}
            {isLoading ? (
              <Loading label="결재 목록을 불러오는 중..." />
            ) : filteredApprovals.length > 0 ? (
              <VStack gap={3}>
                {filteredApprovals.map((approval) => (
                  <motion.div
                    key={approval.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: duration.fast }}
                  >
                    {/* 임시저장은 상세로 보내지 않고 작성 화면으로 되돌린다 — 이어서 쓰라고 있는 문서다 */}
                    <ClickableCard
                      label={approval.title}
                      onClick={() => (approval.status === 'DRAFT' ? openDraft(approval) : setSelectedApproval(approval))}
                    >
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
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <EmptyState
                  icon={<Icon icon={FiFileText} size="lg" />}
                  title="결재 요청이 없습니다"
                  description="새 기안 작성 버튼을 눌러 결재를 요청하세요"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* 새 기안 작성 모달 */}
      <Dialog
        isOpen={showNewApproval}
        onOpenChange={(open) => { if (!open) closeNewApprovalModal(); }}
        purpose="form"
        width={isWideModal ? 'min(1180px, 92vw)' : 460}
        maxHeight={isWideModal ? '92vh' : undefined}
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
                  options={templateSelectorOptions}
                  hasSearch={templates.length > 8}
                  searchPlaceholder="양식 이름 검색"
                  onChange={(value) => {
                    setApprovalForm(prev => ({ ...prev, templateId: value, file: null }));
                    setFormData(null);
                    // 결재선은 양식에 정의된 기본 결재선을 그대로 따른다 (기안자가 고르지 않음).
                    // 양식에 없으면 빈 결재선(레거시 단일 승인) — 이전 양식 선택이 남지 않게 리셋.
                    const pickedForLine = templates.find(t => String(t.id) === value);
                    try {
                      const line = pickedForLine?.defaultApprovalLine
                        ? JSON.parse(pickedForLine.defaultApprovalLine) : [];
                      setApprovalLine(Array.isArray(line) ? line : []);
                    } catch {
                      setApprovalLine([]);
                    }
                    // HWP 파일 양식을 고르면 웹 에디터를 바로 띄운다 (다운로드 없이 즉시 작성)
                    const picked = templates.find(t => String(t.id) === value);
                    if (picked && (picked.templateType === 'file' || !picked.templateType)
                        && picked.fileUrl && isHwpFile(picked.fileName)) {
                      setViewer({
                        fileUrl: picked.fileUrl,
                        fileName: picked.fileName,
                        authoring: true,
                      });
                    }
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

                {/* 결재선 — 양식에 정의된 기본 결재선을 따른다 (기안자가 임의 지정하지 않음) */}
                {/* 결재선 안내 — 공문형 입력(form·hybrid)은 문서의 결재란이 직접 보여주므로 파일 양식에서만 */}
                {approvalLine.length > 0
                  && (!selectedTemplateInfo || selectedTemplateInfo.templateType === 'file') && (
                  <VStack gap={1}>
                    <Text type="label" weight="medium" color="primary">결재선 (양식에 지정됨)</Text>
                    <Text type="supporting" color="secondary">
                      {approvalLine.map((a, i) => `${i + 1}. ${a.name}${a.position ? ` (${a.position})` : ''}`).join('  →  ')}
                    </Text>
                  </VStack>
                )}

                {/* templateType에 따른 분기 */}
                {(!selectedTemplateInfo || selectedTemplateInfo.templateType === 'file') && (
                  /* 파일 양식: 양식을 먼저 보고, 작성한 파일을 첨부한다 */
                  <VStack gap={2}>
                    {renderTemplateFileActions()}
                    {renderFileDropzone('작성한 양식 첨부')}
                  </VStack>
                )}

                {selectedTemplateInfo?.templateType === 'form' && selectedTemplateSchema && (
                  /* 온라인 양식: 실제 공문 모양 위에서 빈칸을 바로 입력 (자체 제출 버튼 포함) */
                  <FormRenderer
                    // 임시저장을 이어 열면 저장해둔 값으로 시작해야 한다. 이게 없으면 폼이
                    // 빈칸으로 마운트되고, 마운트 직후 onValuesChange(빈 값)가 부모의 복원값까지
                    // 덮어써서 다시 저장하는 순간 내용이 진짜로 지워진다(실제 제보).
                    // key는 다른 임시저장/양식을 열 때 이전 입력이 남지 않게 다시 마운트시킨다.
                    key={`form:${approvalForm.templateId}:${editingDraftId ?? 'new'}`}
                    initialValues={formData ?? undefined}
                    schema={selectedTemplateSchema}
                    onSubmit={handleFormRendererSubmit}
                    // 입력한 값이 미리보기·임시저장에 그대로 담기게 한다 (제출 전에도)
                    onValuesChange={setFormData}
                    submitLabel={isSubmitting ? '제출 중...' : '제출'}
                    documentFrame={{
                      companyName,
                      title: approvalForm.title,
                      requesterName:
                        (typeof window !== 'undefined' && localStorage.getItem('userName')) || '기안자',
                      approvalLine,
                    }}
                  />
                )}

                {selectedTemplateInfo?.templateType === 'hybrid' && selectedTemplateSchema && (
                  /* 혼합 양식: 공문형 입력 + 파일 첨부 */
                  <VStack gap={4}>
                    <VStack gap={3}>
                      <FormRenderer
                        key={`hybrid:${approvalForm.templateId}:${editingDraftId ?? 'new'}`}
                        initialValues={formData ?? undefined}
                        schema={selectedTemplateSchema}
                        onSubmit={(data) => setFormData(data)}
                        onValuesChange={setFormData}
                        submitLabel="양식 확인"
                        documentFrame={{
                          companyName,
                          title: approvalForm.title,
                          requesterName:
                            (typeof window !== 'undefined' && localStorage.getItem('userName')) || '기안자',
                          approvalLine,
                        }}
                      />
                    </VStack>
                    {formData && (
                      <Banner status="success" title="온라인 양식이 확인되었습니다." />
                    )}
                    <VStack gap={2}>
                      {renderTemplateFileActions()}
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
                {/* 올리기 전에 완성된 공문 모양을 확인한다 — 결재선·서명란까지 실제와 같은 화면 */}
                <Button
                  label="미리보기"
                  variant="ghost"
                  icon={<Icon icon={FiEye} />}
                  isDisabled={!approvalForm.templateId}
                  onClick={() => setShowPreview(true)}
                />
                {/* 결재선·첨부가 아직 없어도 저장된다 — 중간까지 써두는 게 목적이다 */}
                <Button
                  label={isSavingDraft ? '저장 중...' : '임시저장'}
                  variant="secondary"
                  isLoading={isSavingDraft}
                  isDisabled={isSavingDraft || isSubmitting || !approvalForm.templateId || !approvalForm.title.trim()}
                  onClick={handleSaveDraft}
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
                      approvalLine.length === 0 ||
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

      {/* 올리기 전 미리보기 — 제출된 기안과 같은 공문 뷰를 쓴다 (여기서 다르면 미리보기가 아니다) */}
      <Dialog
        isOpen={showPreview}
        onOpenChange={(open) => { if (!open) setShowPreview(false); }}
        purpose="info"
        width={880}
      >
        <Layout
          header={<DialogHeader title="미리보기" onOpenChange={(open) => { if (!open) setShowPreview(false); }} />}
          content={
            <LayoutContent>
              {(() => {
                const draft = previewApproval();
                if (!draft) return <Text type="body" color="secondary">양식을 먼저 선택해주세요.</Text>;
                return (
                  <VStack gap={3}>
                    {approvalLine.length === 0 && (
                      <Banner status="info" title="결재선을 아직 지정하지 않았습니다." description="결재란은 결재선을 정하면 채워집니다." />
                    )}
                    <div style={{ background: 'var(--color-background-muted)', padding: 'var(--spacing-4)', borderRadius: 'var(--radius-inner)', overflowX: 'auto' }}>
                      <OfficialDocument
                        approval={draft}
                        schema={selectedTemplateSchema ?? undefined}
                        companyName={companyName}
                      />
                    </div>
                  </VStack>
                );
              })()}
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="닫고 계속 작성" variant="primary" onClick={() => setShowPreview(false)} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 결재 상세 모달 — 공문(표준 기안문) 뷰 */}
      <Dialog
        isOpen={!!selectedApproval}
        onOpenChange={(open) => { if (!open) setSelectedApproval(null); }}
        purpose="info"
        width={880}
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

                  {/* 공문 본문 */}
                  <div style={{ background: 'var(--color-background-muted)', padding: 'var(--spacing-4)', borderRadius: 'var(--radius-inner)', overflowX: 'auto' }}>
                    <OfficialDocument
                      approval={selectedApproval}
                      schema={selectedApprovalSchema}
                      companyName={companyName}
                      onOpenAttachment={
                        selectedApproval.attachmentUrl
                          ? () => {
                              // 내가 올린 기안의 한글 첨부는 편집 모드로 열어 Ctrl+S/저장이 서버에 반영되게 한다
                              const editable = isHwpFile(selectedApproval.attachmentFileName);
                              setViewer({
                                fileUrl: selectedApproval.attachmentUrl!,
                                fileName: selectedApproval.attachmentFileName || '첨부파일',
                                ...(editable ? { authoring: true, approvalId: String(selectedApproval.id) } : {}),
                              });
                            }
                          : undefined
                      }
                    />
                  </div>

                  {/* 첨부 다운로드/수정 보조 액션 */}
                  {selectedApproval.attachmentUrl && (
                    <HStack gap={2} vAlign="center" hAlign="end">
                      <Text type="supporting" color="secondary">
                        {selectedApproval.attachmentFileName || '첨부파일'} ({formatFileSize(selectedApproval.attachmentFileSize || 0)})
                      </Text>
                      {isHwpFile(selectedApproval.attachmentFileName) && (
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
                      )}
                      <IconButton
                        label="첨부파일 다운로드"
                        tooltip="다운로드"
                        variant="ghost"
                        icon={<Icon icon={FiDownload} />}
                        onClick={() => handleDownloadAttachment(selectedApproval.attachmentUrl!, selectedApproval.attachmentFileName || '첨부파일')}
                      />
                    </HStack>
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

      {/* 내 서명 관리 모달 */}
      <Dialog
        isOpen={showSignatureManager}
        onOpenChange={(open) => { if (!open) setShowSignatureManager(false); }}
        purpose="form"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="내 결재 서명"
              onOpenChange={(open) => { if (!open) setShowSignatureManager(false); }}
            />
          }
          content={
            <LayoutContent>
              <MySignatureCard
                onNotification={(message, type) =>
                  showAlert({ type: type === 'info' ? 'success' : type, title: '서명', message })
                }
              />
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="닫기" variant="secondary" onClick={() => setShowSignatureManager(false)} />
              </HStack>
            </LayoutFooter>
          }
        />
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
