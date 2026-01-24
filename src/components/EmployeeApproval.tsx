'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getActiveApprovalTemplates, getMyApprovalRequests, createApprovalRequest, cancelApprovalRequest } from '@/lib/apiService';
import { ApprovalRequest, ApprovalStatus } from '@/types/approval';
import { ApprovalTemplate } from '@/types/approvalTemplate';
import { useAlert } from './Alert';
import { useConfirm } from './ConfirmDialog';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';

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

  // 상태 스타일
  const getStatusStyle = (status: ApprovalStatus) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      const token = localStorage.getItem('memberToken');

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
      const token = localStorage.getItem('memberToken');

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

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setApprovalForm(prev => ({ ...prev, file }));
    }
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

  // 결재 신청 제출
  const handleSubmitApproval = async () => {
    if (!approvalForm.templateId) {
      showAlert({ type: 'error', title: '입력 오류', message: '양식을 선택해주세요.' });
      return;
    }
    if (!approvalForm.title.trim()) {
      showAlert({ type: 'error', title: '입력 오류', message: '제목을 입력해주세요.' });
      return;
    }
    if (!approvalForm.file) {
      showAlert({ type: 'error', title: '입력 오류', message: '작성한 양식 파일을 첨부해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      // 파일을 서버에 업로드
      const uploadResult = await uploadFileToServer(approvalForm.file);
      if (!uploadResult) {
        throw new Error('파일 업로드 실패');
      }

      await createApprovalRequest({
        templateId: Number(approvalForm.templateId),
        title: approvalForm.title,
        attachmentUrl: uploadResult.filePath,
        attachmentFileName: uploadResult.fileName,
        attachmentFileSize: uploadResult.fileSize,
      });

      showAlert({
        type: 'success',
        title: '제출 완료',
        message: '결재 요청이 성공적으로 제출되었습니다.',
      });

      setShowNewApproval(false);
      setApprovalForm({ templateId: '', title: '', file: null });
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
  };

  const selectedTemplateInfo = templates.find(t => String(t.id) === approvalForm.templateId);

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">전자결재</h2>
            <p className="text-gray-500 text-sm mt-1">양식 다운로드 및 결재 신청</p>
          </div>
          <button
            onClick={() => setShowNewApproval(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>새 기안 작성</span>
          </button>
        </div>

        {/* 탭 */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('my-approvals')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center space-x-2 ${
                activeTab === 'my-approvals'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>내 결재 내역</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'my-approvals' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
              }`}>
                {approvals.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'templates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              양식 다운로드
            </button>
          </nav>
        </div>

        {/* 양식 다운로드 탭 */}
        {activeTab === 'templates' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            {templates.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-gray-900 font-semibold">{template.name}</h4>
                          <p className="text-gray-500 text-sm mt-1">{template.description}</p>
                          <p className="text-gray-400 text-xs mt-2">
                            {template.fileName} ({formatFileSize(template.fileSize)})
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadTemplate(template)}
                        className="flex items-center space-x-1.5 px-4 py-2 text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>다운로드</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="text-gray-500 font-medium">등록된 양식이 없습니다</p>
                <p className="text-gray-400 text-sm mt-1">관리자에게 문의하세요</p>
              </div>
            )}
          </div>
        )}

        {/* 내 결재 내역 탭 */}
        {activeTab === 'my-approvals' && (
          <>
            {/* 상태 필터 */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: '전체', count: getStatusCount() },
                { key: 'pending', label: '진행중', count: getStatusCount('PENDING') },
                { key: 'approved', label: '승인됨', count: getStatusCount('APPROVED') },
                { key: 'rejected', label: '반려됨', count: getStatusCount('REJECTED') },
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setApprovalFilter(filter.key as ApprovalFilterType)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    approvalFilter === filter.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {filter.label}
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                    approvalFilter === filter.key ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>

            {/* 결재 목록 */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <svg className="animate-spin h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : filteredApprovals.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {filteredApprovals.map((approval) => (
                    <div
                      key={approval.id}
                      className="p-5 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedApproval(approval)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusStyle(approval.status)}`}>
                              {getStatusText(approval.status)}
                            </span>
                            <span className="text-gray-400 text-sm">{approval.templateName}</span>
                          </div>
                          <h3 className="text-gray-900 font-semibold">{approval.title}</h3>
                          <p className="text-gray-500 text-sm mt-1">
                            {format(new Date(approval.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 font-medium">결재 요청이 없습니다</p>
                  <p className="text-gray-400 text-sm mt-1">새 기안 작성 버튼을 눌러 결재를 요청하세요</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 새 기안 작성 모달 */}
      <AnimatePresence>
        {showNewApproval && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeNewApprovalModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">새 기안 작성</h2>
                    <p className="text-gray-500 text-sm mt-1">양식을 선택하고 작성한 파일을 첨부하세요</p>
                  </div>
                  <button
                    onClick={closeNewApprovalModal}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* 양식 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    양식 선택 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={approvalForm.templateId}
                    onChange={(e) => setApprovalForm(prev => ({ ...prev, templateId: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">양식을 선택하세요</option>
                    {templates.map((template) => (
                      <option key={template.id} value={String(template.id)}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {selectedTemplateInfo && (
                    <p className="text-gray-500 text-sm mt-2">{selectedTemplateInfo.description}</p>
                  )}
                </div>

                {/* 제목 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제목 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={approvalForm.title}
                    onChange={(e) => setApprovalForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="예: 2026년 1월 휴가 신청"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* 파일 첨부 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    작성한 양식 첨부 <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept=".hwp,.hwpx,.doc,.docx,.pdf,.xls,.xlsx"
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-6 border-2 border-dashed border-gray-300 rounded-xl text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                  >
                    {approvalForm.file ? (
                      <div className="flex items-center justify-center space-x-3">
                        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="text-left">
                          <p className="text-gray-900 font-medium">{approvalForm.file.name}</p>
                          <p className="text-gray-500 text-sm">{formatFileSize(approvalForm.file.size)}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-gray-600">클릭하여 작성한 파일 첨부</p>
                        <p className="text-gray-400 text-sm mt-1">.hwp, .docx, .pdf 등</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                <button
                  onClick={closeNewApprovalModal}
                  className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmitApproval}
                  disabled={isSubmitting || !approvalForm.templateId || !approvalForm.title.trim() || !approvalForm.file}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    '제출'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 결재 상세 모달 */}
      <AnimatePresence>
        {selectedApproval && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedApproval(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusStyle(selectedApproval.status)}`}>
                      {getStatusText(selectedApproval.status)}
                    </span>
                    <h2 className="text-xl font-bold text-gray-900 mt-2">{selectedApproval.title}</h2>
                    <p className="text-gray-500 text-sm mt-1">{selectedApproval.templateName}</p>
                  </div>
                  <button
                    onClick={() => setSelectedApproval(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 max-h-96 overflow-y-auto space-y-4">
                {/* 기안 정보 */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <span className="text-gray-500">기안일시</span>
                    <p className="text-gray-900 font-medium mt-1">
                      {format(new Date(selectedApproval.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                    </p>
                  </div>
                  {selectedApproval.processedAt && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <span className="text-gray-500">처리일시</span>
                      <p className="text-gray-900 font-medium mt-1">
                        {format(new Date(selectedApproval.processedAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                      </p>
                    </div>
                  )}
                </div>

                {/* 첨부파일 - 단일 필드 (백엔드 구조에 맞춤) */}
                {selectedApproval.attachmentUrl && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">첨부파일</h4>
                    <button
                      onClick={() => handleDownloadAttachment(selectedApproval.attachmentUrl!, selectedApproval.attachmentFileName || '첨부파일')}
                      className="w-full flex items-center space-x-3 bg-gray-50 rounded-lg p-3 hover:bg-blue-50 transition-colors text-left"
                    >
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span className="text-gray-900 flex-1">{selectedApproval.attachmentFileName || '첨부파일'}</span>
                      <span className="text-gray-500 text-sm">
                        {formatFileSize(selectedApproval.attachmentFileSize || 0)}
                      </span>
                    </button>
                  </div>
                )}

                {/* 반려 사유 */}
                {selectedApproval.status === 'REJECTED' && selectedApproval.rejectReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h4 className="text-sm font-medium text-red-700">반려 사유</h4>
                    </div>
                    <p className="text-red-700">{selectedApproval.rejectReason}</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                {selectedApproval.status === 'PENDING' && (
                  <button
                    onClick={() => handleCancelApproval(selectedApproval.id)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors font-medium"
                  >
                    기안 취소
                  </button>
                )}
                <button
                  onClick={() => setSelectedApproval(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
