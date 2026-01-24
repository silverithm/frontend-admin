'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ApprovalRequest, ApprovalStatus } from '@/types/approval';
import { FiX, FiPaperclip, FiCheck, FiXCircle, FiAlertCircle, FiDownload } from 'react-icons/fi';

interface ApprovalDetailProps {
  approval: ApprovalRequest;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onClose: () => void;
}

export default function ApprovalDetail({
  approval,
  onApprove,
  onReject,
  onClose,
}: ApprovalDetailProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const getStatusStyle = (status: ApprovalStatus) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    onReject(approval.id, rejectReason);
  };

  // 첨부파일 다운로드
  const handleDownloadAttachment = async (fileUrl: string, fileName: string) => {
    try {
      const downloadUrl = `/api/v1/files/download?path=${encodeURIComponent(fileUrl)}&fileName=${encodeURIComponent(fileName)}`;
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
      alert('파일 다운로드에 실패했습니다.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold border ${getStatusStyle(approval.status)}`}>
                {getStatusText(approval.status)}
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-3">{approval.title}</h2>
              <p className="text-gray-600 text-sm mt-1">{approval.templateName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 내용 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* 기안 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <span className="text-gray-500 text-sm">기안자</span>
              <p className="text-gray-900 font-semibold mt-1">{approval.requesterName}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <span className="text-gray-500 text-sm">기안일시</span>
              <p className="text-gray-900 font-semibold mt-1">
                {format(new Date(approval.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
              </p>
            </div>
            {approval.processedAt && (
              <>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <span className="text-gray-500 text-sm">처리자</span>
                  <p className="text-gray-900 font-semibold mt-1">{approval.processedByName || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <span className="text-gray-500 text-sm">처리일시</span>
                  <p className="text-gray-900 font-semibold mt-1">
                    {format(new Date(approval.processedAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* 기안 내용 */}
          {approval.formData && Object.keys(approval.formData).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4">
                기안 내용
              </h4>
              <div className="space-y-3">
                {Object.entries(approval.formData).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <span className="text-gray-500 text-sm">{key}</span>
                    <p className="text-gray-900 mt-1 whitespace-pre-wrap">{value as string}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 첨부파일 - 단일 필드 (백엔드 구조에 맞춤) */}
          {approval.attachmentUrl && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4">
                첨부파일
              </h4>
              <button
                onClick={() => handleDownloadAttachment(approval.attachmentUrl!, approval.attachmentFileName || '첨부파일')}
                className="w-full flex items-center space-x-3 bg-gray-50 rounded-lg p-4 border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left"
              >
                <FiDownload className="w-5 h-5 text-blue-500" />
                <span className="text-gray-900 flex-1 font-medium">{approval.attachmentFileName || '첨부파일'}</span>
                <span className="text-gray-500 text-sm">
                  {((approval.attachmentFileSize || 0) / 1024).toFixed(1)}KB
                </span>
              </button>
            </div>
          )}

          {/* 반려 사유 */}
          {approval.status === 'REJECTED' && approval.rejectReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <FiAlertCircle className="w-5 h-5 text-red-500" />
                <h4 className="text-sm font-semibold text-red-700">반려 사유</h4>
              </div>
              <p className="text-red-700 whitespace-pre-wrap">{approval.rejectReason}</p>
            </div>
          )}

          {/* 반려 사유 입력 폼 */}
          {showRejectForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border border-red-200 rounded-lg p-4 bg-red-50"
            >
              <h4 className="text-sm font-semibold text-red-700 mb-3">반려 사유 입력</h4>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="반려 사유를 입력해주세요"
                rows={3}
                className="w-full px-4 py-3 bg-white border border-red-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-red-400 focus:border-red-400 resize-none"
              />
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                  className="px-4 py-2 text-gray-600 font-semibold hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className="px-5 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  반려 확정
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* 버튼 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex-shrink-0">
          {approval.status === 'PENDING' && !showRejectForm ? (
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRejectForm(true)}
                className="px-5 py-2 text-red-600 font-semibold hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
              >
                <span className="flex items-center space-x-1">
                  <FiXCircle className="w-4 h-4" />
                  <span>반려</span>
                </span>
              </button>
              <button
                onClick={() => onApprove(approval.id)}
                className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-all duration-200 shadow-sm"
              >
                <span className="flex items-center space-x-1">
                  <FiCheck className="w-4 h-4" />
                  <span>승인</span>
                </span>
              </button>
            </div>
          ) : (
            !showRejectForm && (
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-blue-500 text-white font-semibold hover:bg-blue-600 rounded-lg transition-colors shadow-sm"
                >
                  닫기
                </button>
              </div>
            )
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
