'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getApprovalTemplates, createApprovalTemplate, updateApprovalTemplate, toggleApprovalTemplateActive, deleteApprovalTemplate } from '@/lib/apiService';
import { ApprovalTemplate } from '@/types/approvalTemplate';
import { useAlert } from './Alert';
import { useConfirm } from './ConfirmDialog';
import { FiPlus, FiDownload, FiEdit2, FiTrash2, FiUploadCloud, FiFileText, FiX } from 'react-icons/fi';

export default function ApprovalTemplateManager() {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApprovalTemplate | null>(null);

  // 업로드 폼 상태
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    file: null as File | null,
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 템플릿 로드
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const response = await getApprovalTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('템플릿 로드 실패:', error);
      showAlert({
        type: 'error',
        title: '로드 실패',
        message: '양식 템플릿을 불러오는데 실패했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm(prev => ({ ...prev, file }));
    }
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // 파일 업로드 API 호출
  const uploadFileToServer = async (file: File): Promise<{ filePath: string; fileName: string; fileSize: number } | null> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/v1/files/upload?category=templates', {
      method: 'POST',
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

  // 양식 업로드
  const handleUpload = async () => {
    if (!uploadForm.name.trim()) {
      showAlert({ type: 'error', title: '입력 오류', message: '양식명을 입력해주세요.' });
      return;
    }
    if (!uploadForm.file && !editingTemplate) {
      showAlert({ type: 'error', title: '입력 오류', message: '파일을 선택해주세요.' });
      return;
    }

    setIsUploading(true);
    try {
      let fileUrl = editingTemplate?.fileUrl || '';
      let fileName = editingTemplate?.fileName || '';
      let fileSize = editingTemplate?.fileSize || 0;

      // 새 파일이 있으면 서버에 업로드
      if (uploadForm.file) {
        const uploadResult = await uploadFileToServer(uploadForm.file);
        if (uploadResult) {
          fileUrl = uploadResult.filePath;
          fileName = uploadResult.fileName;
          fileSize = uploadResult.fileSize;
        }
      }

      if (editingTemplate) {
        // 수정
        await updateApprovalTemplate(String(editingTemplate.id), {
          name: uploadForm.name,
          description: uploadForm.description,
          fileUrl: fileUrl,
          fileName: fileName,
          fileSize: fileSize,
        });
        showAlert({ type: 'success', title: '수정 완료', message: '양식이 수정되었습니다.' });
      } else {
        // 생성
        await createApprovalTemplate({
          name: uploadForm.name,
          description: uploadForm.description,
          fileUrl: fileUrl,
          fileName: fileName,
          fileSize: fileSize,
        });
        showAlert({ type: 'success', title: '등록 완료', message: '양식이 등록되었습니다.' });
      }

      setShowUploadModal(false);
      setEditingTemplate(null);
      setUploadForm({ name: '', description: '', file: null });
      loadTemplates();
    } catch (error) {
      console.error('양식 저장 실패:', error);
      showAlert({ type: 'error', title: '저장 실패', message: '양식 저장에 실패했습니다.' });
    } finally {
      setIsUploading(false);
    }
  };

  // 활성화/비활성화 토글
  const handleToggleActive = async (id: string | number) => {
    try {
      await toggleApprovalTemplateActive(String(id));
      loadTemplates();
      showAlert({ type: 'success', title: '상태 변경', message: '양식 상태가 변경되었습니다.' });
    } catch (error) {
      console.error('상태 변경 실패:', error);
      showAlert({ type: 'error', title: '변경 실패', message: '양식 상태 변경에 실패했습니다.' });
    }
  };

  // 템플릿 삭제
  const handleDelete = async (id: string | number, name: string) => {
    const confirmed = await confirm({
      title: '양식 삭제',
      message: `"${name}" 양식을 삭제하시겠습니까?\n관련된 결재 요청도 모두 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`,
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteApprovalTemplate(String(id));
      loadTemplates();
      showAlert({ type: 'success', title: '삭제 완료', message: '양식이 삭제되었습니다.' });
    } catch (error: unknown) {
      console.error('삭제 실패:', error);
      let errorMessage = '양식 삭제에 실패했습니다.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      showAlert({ type: 'error', title: '삭제 실패', message: errorMessage });
    }
  };

  // 편집 모달 열기
  const openEditModal = (template: ApprovalTemplate) => {
    setEditingTemplate(template);
    setUploadForm({
      name: template.name,
      description: template.description,
      file: null,
    });
    setShowUploadModal(true);
  };

  // 모달 닫기
  const closeModal = () => {
    setShowUploadModal(false);
    setEditingTemplate(null);
    setUploadForm({ name: '', description: '', file: null });
  };

  // 파일 다운로드
  const handleDownload = async (template: ApprovalTemplate) => {
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
    } catch (error) {
      console.error('파일 다운로드 실패:', error);
      showAlert({ type: 'error', title: '다운로드 실패', message: '파일 다운로드에 실패했습니다.' });
    }
  };

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">양식 관리</h2>
            <p className="text-gray-500 text-sm mt-1">전자결재 양식 파일을 관리합니다</p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
          >
            <FiPlus className="w-5 h-5" />
            <span>새 양식 등록</span>
          </button>
        </div>

        {/* 템플릿 목록 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : templates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">양식명</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">설명</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">파일</th>
                    <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">상태</th>
                    <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">수정일</th>
                    <th className="text-center px-6 py-4 text-sm font-semibold text-gray-700">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {templates.map((template) => (
                    <motion.tr
                      key={template.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="text-gray-900 font-medium">{template.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600 text-sm">{template.description}</span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDownload(template)}
                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          <FiDownload className="w-4 h-4" />
                          <span className="text-sm">{template.fileName}</span>
                          <span className="text-gray-400 text-xs">({formatFileSize(template.fileSize)})</span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleActive(template.id)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            template.isActive
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {template.isActive ? '활성화' : '비활성화'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-gray-500 text-sm">
                          {format(new Date(template.updatedAt), 'MM.dd HH:mm', { locale: ko })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => openEditModal(template)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="편집"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id, template.name)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">
              <FiFileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">등록된 양식이 없습니다</p>
              <p className="text-sm">새 양식 등록 버튼을 눌러 양식 파일을 업로드하세요</p>
            </div>
          )}
        </div>

      </div>

      {/* 업로드 모달 */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {editingTemplate ? '양식 편집' : '새 양식 등록'}
                    </h2>
                    <p className="text-gray-600 text-sm mt-1">
                      {editingTemplate ? '양식 정보를 수정하고 새 파일을 업로드하세요' : '양식 파일을 업로드하여 등록하세요'}
                    </p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* 양식명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    양식명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadForm.name}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="양식명을 입력하세요"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  />
                </div>

                {/* 설명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    설명
                  </label>
                  <input
                    type="text"
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="양식 설명을 입력하세요"
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  />
                </div>

                {/* 파일 업로드 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    양식 파일 <span className="text-red-500">*</span>
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
                    className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                  >
                    {uploadForm.file ? (
                      <div className="flex items-center justify-center space-x-3">
                        <FiFileText className="w-8 h-8 text-blue-500" />
                        <div className="text-left">
                          <p className="text-gray-900 font-medium">{uploadForm.file.name}</p>
                          <p className="text-gray-500 text-sm">{formatFileSize(uploadForm.file.size)}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <FiUploadCloud className="w-10 h-10 mx-auto text-gray-500 mb-2" />
                        <p className="text-gray-700">클릭하여 파일 선택</p>
                        <p className="text-gray-500 text-sm mt-1">지원 형식: .hwp, .docx, .pdf, .xlsx</p>
                      </>
                    )}
                  </div>
                  {editingTemplate && !uploadForm.file && (
                    <p className="text-gray-500 text-sm mt-2">
                      현재 파일: {editingTemplate.fileName}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading || !uploadForm.name.trim() || (!uploadForm.file && !editingTemplate)}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    editingTemplate ? '저장' : '등록'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
