'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiFileText, FiSearch, FiRefreshCw, FiCheck, FiX, FiEye, FiCalendar, FiUser, FiAlertCircle } from 'react-icons/fi';
import { getApprovalRequests, approveApprovalRequest, rejectApprovalRequest, bulkApproveApprovalRequests, bulkRejectApprovalRequests, getApprovalTemplateById } from '@/lib/apiService';
import { ApprovalRequest, ApprovalStatus } from '@/types/approval';
import { FormSchema } from '@/types/formSchema';
import ApprovalDetail from './ApprovalDetail';
import { useAlert } from './Alert';

type TabType = 'all' | 'pending' | 'approved' | 'rejected';

export default function ApprovalManagement() {
  const { showAlert, AlertContainer } = useAlert();
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

  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';
  const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : '';

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

  const getStatusStyle = (status: ApprovalStatus) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
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
      <div className="flex flex-col justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin mb-3"></div>
        <p className="text-sm text-gray-500">결재 목록을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      <AlertContainer />
      <div>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">전자결재 관리</h2>
            <p className="text-xs text-gray-400 mt-1">직원들의 결재 요청을 처리합니다</p>
          </div>
          <button
            onClick={loadApprovals}
            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
            disabled={isProcessing}
          >
            <FiRefreshCw className={isProcessing ? 'animate-spin' : ''} size={18} />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {[
              { key: 'all', label: '전체', count: stats.all },
              { key: 'pending', label: '진행중', count: stats.pending },
              { key: 'approved', label: '승인됨', count: stats.approved },
              { key: 'rejected', label: '반려됨', count: stats.rejected },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-teal-500 text-teal-600 bg-teal-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                  activeTab === tab.key
                    ? 'bg-teal-100 text-teal-600'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* 필터 영역 */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* 기간 필터 */}
            <div className="flex items-center gap-2">
              <FiCalendar className="text-gray-400 flex-shrink-0" size={16} />
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm text-gray-900 bg-white"
              />
              <span className="text-gray-400 text-sm">~</span>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm text-gray-900 bg-white"
              />
            </div>

            {/* 검색 */}
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="제목, 기안자 검색"
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm text-gray-900 bg-white placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        {/* 일괄 액션 */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-teal-50 border-b border-teal-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-teal-700 font-medium">
                {selectedIds.size}건 선택됨
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkApprove}
                  disabled={isProcessing}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-colors"
                >
                  <FiCheck className="mr-1.5" size={16} />
                  일괄 승인
                </button>
                <button
                  onClick={() => setShowBulkRejectModal(true)}
                  disabled={isProcessing}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                >
                  <FiX className="mr-1.5" size={16} />
                  일괄 반려
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 결재 목록 */}
        <div className="p-5">
          {approvals.length > 0 ? (
            <div className="space-y-3">
              {/* 전체 선택 체크박스 (진행중 탭에서만) */}
              {activeTab === 'pending' && pendingApprovals.length > 0 && (
                <div className="flex items-center pb-3 border-b border-gray-200">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pendingApprovals.length > 0 && selectedIds.size === pendingApprovals.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-teal-600 bg-white border-gray-300 rounded focus:ring-teal-500 accent-teal-500"
                    />
                    <span className="ml-2 text-sm text-gray-500">전체 선택</span>
                  </label>
                </div>
              )}

              {/* 결재 카드 리스트 */}
              {approvals.map((approval) => (
                <motion.div
                  key={approval.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4">
                      {approval.status === 'PENDING' && (
                        <div className="flex-shrink-0 pt-1">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(approval.id)}
                            onChange={() => handleSelectOne(approval.id)}
                            className="w-4 h-4 text-teal-600 bg-white border-gray-300 rounded focus:ring-teal-500 accent-teal-500"
                          />
                        </div>
                      )}
                      <div className="flex-shrink-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          approval.status === 'APPROVED' ? 'bg-green-100' :
                          approval.status === 'PENDING' ? 'bg-yellow-100' :
                          'bg-red-100'
                        }`}>
                          <FiFileText className={
                            approval.status === 'APPROVED' ? 'text-green-700' :
                            approval.status === 'PENDING' ? 'text-yellow-700' :
                            'text-red-700'
                          } size={20} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="text-sm font-bold text-gray-900">{approval.title}</h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusStyle(approval.status)}`}>
                            {getStatusText(approval.status)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex items-center">
                            <FiUser className="mr-1.5 text-gray-400" size={13} />
                            {approval.requesterName}
                          </div>
                          <div className="flex items-center">
                            <FiFileText className="mr-1.5 text-gray-400" size={13} />
                            {approval.templateName}
                          </div>
                          <div className="flex items-center">
                            <FiCalendar className="mr-1.5 text-gray-400" size={13} />
                            {format(new Date(approval.createdAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenDetail(approval)}
                        className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                      >
                        <FiEye className="mr-1.5" size={16} />
                        상세보기
                      </button>
                      {approval.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(approval.id)}
                            disabled={isProcessing}
                            className="flex items-center px-3 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-colors"
                          >
                            <FiCheck className="mr-1.5" size={16} />
                            승인
                          </button>
                          <button
                            onClick={() => handleOpenDetail(approval)}
                            disabled={isProcessing}
                            className="flex items-center px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                          >
                            <FiX className="mr-1.5" size={16} />
                            반려
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <FiFileText className="text-gray-400" size={28} />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">결재 요청이 없습니다</h3>
              <p className="text-xs text-gray-400">조건에 맞는 결재 요청이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
      </div>{/* end card wrapper */}

      {/* 결재 상세 모달 */}
      <AnimatePresence>
        {selectedApproval && (
          <ApprovalDetail
            approval={selectedApproval}
            onApprove={handleApprove}
            onReject={handleReject}
            onClose={() => { setSelectedApproval(null); setSelectedTemplateSchema(undefined); }}
            templateSchema={selectedTemplateSchema}
          />
        )}
      </AnimatePresence>

      {/* 일괄 반려 모달 */}
      <AnimatePresence>
        {showBulkRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowBulkRejectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start mb-5">
                <div className="bg-red-100 p-2.5 rounded-xl mr-3 flex-shrink-0">
                  <FiAlertCircle size={20} className="text-red-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">일괄 반려</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {selectedIds.size}건의 결재를 반려합니다.<br />
                    반려 사유를 입력해주세요.
                  </p>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  반려 사유 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="반려 사유를 입력해주세요"
                  rows={4}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none text-sm text-gray-900 placeholder-gray-400"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowBulkRejectModal(false); setRejectReason(''); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                  disabled={isProcessing}
                >
                  취소
                </button>
                <button
                  onClick={handleBulkReject}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-200 border-t-white rounded-full animate-spin mr-2"></div>
                      처리중...
                    </>
                  ) : (
                    <>
                      <FiX className="mr-1.5" size={16} />
                      반려하기
                    </>
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
