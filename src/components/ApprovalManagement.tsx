'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiFileText, FiSearch, FiRefreshCw, FiCheck, FiX, FiEye, FiCalendar, FiUser, FiAlertCircle } from 'react-icons/fi';
import { getApprovalRequests, approveApprovalRequest, rejectApprovalRequest, bulkApproveApprovalRequests, bulkRejectApprovalRequests } from '@/lib/apiService';
import { ApprovalRequest, ApprovalStatus } from '@/types/approval';
import ApprovalDetail from './ApprovalDetail';
import { useAlert } from './Alert';

type TabType = 'all' | 'pending' | 'approved' | 'rejected';

export default function ApprovalManagement() {
  const { showAlert, AlertContainer } = useAlert();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
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

  const pendingApprovals = approvals.filter(a => a.status === 'PENDING');

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mr-3"></div>
        <p className="text-gray-600">결재 목록을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      <AlertContainer />
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FiFileText className="text-blue-600 mr-3" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-900">전자결재 관리</h2>
                <p className="text-gray-600 text-sm mt-1">직원들의 결재 요청을 처리합니다</p>
              </div>
            </div>
            <button
              onClick={loadApprovals}
              className="p-2 text-gray-600 hover:bg-white hover:text-blue-600 rounded-full transition-colors"
              disabled={isProcessing}
            >
              <FiRefreshCw className={isProcessing ? 'animate-spin' : ''} size={20} />
            </button>
          </div>
        </div>

        {/* 탭 네비게이션 */}
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
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                  activeTab === tab.key
                    ? 'bg-blue-100 text-blue-600'
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
          <div className="flex flex-col sm:flex-row gap-4">
            {/* 기간 필터 */}
            <div className="flex items-center space-x-2">
              <FiCalendar className="text-gray-400" size={16} />
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
              />
              <span className="text-gray-500">~</span>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-500"
              />
            </div>
          </div>
        </div>

        {/* 일괄 액션 */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-blue-50 border-b border-blue-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-blue-700 font-medium">
                {selectedIds.size}건 선택됨
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleBulkApprove}
                  disabled={isProcessing}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <FiCheck className="mr-1.5" size={16} />
                  일괄 승인
                </button>
                <button
                  onClick={() => setShowBulkRejectModal(true)}
                  disabled={isProcessing}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  <FiX className="mr-1.5" size={16} />
                  일괄 반려
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 결재 목록 */}
        <div className="p-6">
          {approvals.length > 0 ? (
            <div className="space-y-4">
              {/* 전체 선택 체크박스 (진행중 탭에서만) */}
              {activeTab === 'pending' && pendingApprovals.length > 0 && (
                <div className="flex items-center pb-4 border-b border-gray-200">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pendingApprovals.length > 0 && selectedIds.size === pendingApprovals.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-600">전체 선택</span>
                  </label>
                </div>
              )}

              {/* 결재 카드 리스트 */}
              {approvals.map((approval) => (
                <motion.div
                  key={approval.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4">
                      {approval.status === 'PENDING' && (
                        <div className="flex-shrink-0 pt-1">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(approval.id)}
                            onChange={() => handleSelectOne(approval.id)}
                            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                          />
                        </div>
                      )}
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          approval.status === 'APPROVED' ? 'bg-green-100' :
                          approval.status === 'PENDING' ? 'bg-yellow-100' :
                          'bg-red-100'
                        }`}>
                          <FiFileText className={
                            approval.status === 'APPROVED' ? 'text-green-600' :
                            approval.status === 'PENDING' ? 'text-yellow-600' :
                            'text-red-600'
                          } size={24} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-medium text-gray-900">{approval.title}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusStyle(approval.status)}`}>
                            {getStatusText(approval.status)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex items-center">
                            <FiUser className="mr-2" size={14} />
                            {approval.requesterName}
                          </div>
                          <div className="flex items-center">
                            <FiFileText className="mr-2" size={14} />
                            {approval.templateName}
                          </div>
                          <div className="flex items-center">
                            <FiCalendar className="mr-2" size={14} />
                            {format(new Date(approval.createdAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedApproval(approval)}
                        className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <FiEye className="mr-1.5" size={16} />
                        상세보기
                      </button>
                      {approval.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(approval.id)}
                            disabled={isProcessing}
                            className="flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                          >
                            <FiCheck className="mr-1.5" size={16} />
                            승인
                          </button>
                          <button
                            onClick={() => setSelectedApproval(approval)}
                            disabled={isProcessing}
                            className="flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
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
            <div className="text-center py-12">
              <FiFileText className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-medium text-gray-900 mb-2">결재 요청이 없습니다</h3>
              <p className="text-gray-500">조건에 맞는 결재 요청이 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 결재 상세 모달 */}
      <AnimatePresence>
        {selectedApproval && (
          <ApprovalDetail
            approval={selectedApproval}
            onApprove={handleApprove}
            onReject={handleReject}
            onClose={() => setSelectedApproval(null)}
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowBulkRejectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start mb-4">
                <div className="bg-red-100 p-2 rounded-full mr-3">
                  <FiAlertCircle size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">일괄 반려</h3>
                  <p className="text-gray-600 text-sm">
                    {selectedIds.size}건의 결재를 반려합니다.<br />
                    반려 사유를 입력해주세요.
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  반려 사유 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="반려 사유를 입력해주세요"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none text-gray-900 placeholder-gray-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowBulkRejectModal(false); setRejectReason(''); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  disabled={isProcessing}
                >
                  취소
                </button>
                <button
                  onClick={handleBulkReject}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
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
