'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiUsers, FiUserPlus, FiUserX, FiUserCheck, FiTrash2, FiSearch, FiFilter, FiRefreshCw, FiMail, FiCalendar, FiShield, FiAlertCircle } from 'react-icons/fi';
import { getPendingUsers, getMemberUsers, approveUser, rejectUser, deleteUser, updateUserStatus, type PendingUser } from '@/lib/apiService';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'caregiver' | 'office' | 'admin';
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive';
  requestedAt?: number;
  approvedAt?: number;
  lastLoginAt?: number;
  organizationId?: string;
}

interface UserManagementProps {
  organizationName?: string;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ organizationName, onNotification }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'members'>('pending');
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'caregiver' | 'office' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // 가입 대기 중인 사용자 가져오기
      const pendingData = await getPendingUsers();
      const formattedPendingUsers = (pendingData || []).map((user: PendingUser) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'caregiver' | 'office' | 'admin',
        status: 'pending' as const,
        requestedAt: user.requestedAt ? new Date(user.requestedAt).getTime() : undefined,
      }));
      setPendingUsers(formattedPendingUsers);

      // 기존 회원 목록 가져오기
      const membersData = await getMemberUsers();
      setMembers(membersData.users || []);
    } catch (error) {
      console.error('사용자 목록 로드 오류:', error);
      onNotification('사용자 목록을 불러오는데 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    setIsProcessing(true);
    try {
      await approveUser(userId);
      await fetchUsers();
      onNotification('사용자 가입을 승인했습니다.', 'success');
    } catch (error) {
      console.error('사용자 승인 오류:', error);
      onNotification(error instanceof Error ? error.message : '승인 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectUser = async (userId: string) => {
    setIsProcessing(true);
    try {
      await rejectUser(userId);
      await fetchUsers();
      onNotification('사용자 가입을 거절했습니다.', 'info');
    } catch (error) {
      console.error('사용자 거절 오류:', error);
      onNotification(error instanceof Error ? error.message : '거절 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsProcessing(true);
    try {
      await deleteUser(selectedUser.id);
      await fetchUsers();
      setShowDeleteModal(false);
      setSelectedUser(null);
      onNotification('사용자를 삭제했습니다.', 'success');
    } catch (error) {
      console.error('사용자 삭제 오류:', error);
      onNotification(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    setIsProcessing(true);
    
    try {
      await updateUserStatus(userId, newStatus as 'active' | 'inactive');
      await fetchUsers();
      onNotification(`사용자 상태를 ${newStatus === 'active' ? '활성화' : '비활성화'}했습니다.`, 'success');
    } catch (error) {
      console.error('사용자 상태 변경 오류:', error);
      onNotification(error instanceof Error ? error.message : '상태 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredMembers = members.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredPendingUsers = pendingUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'caregiver': return '요양보호사';
      case 'office': return '사무직';
      case 'admin': return '관리자';
      default: return role;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '승인 대기';
      case 'approved': return '승인됨';
      case 'rejected': return '거절됨';
      case 'active': return '활성화';
      case 'inactive': return '비활성화';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mr-3"></div>
        <p className="text-gray-600">사용자 목록을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 헤더 */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FiUsers className="text-blue-600 mr-3" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900">회원 관리</h2>
              <p className="text-gray-600 text-sm mt-1">
                {organizationName ? `${organizationName} 회원 관리` : '회원 가입 승인 및 회원 관리'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchUsers}
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
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FiUserPlus className="inline mr-2" size={16} />
            가입 신청 ({pendingUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FiUsers className="inline mr-2" size={16} />
            기존 회원 ({members.length})
          </button>
        </nav>
      </div>

      {/* 검색 및 필터 */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 검색 */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="이름 또는 이메일로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 필터 (기존 회원 탭에서만 표시) */}
          {activeTab === 'members' && (
            <>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">모든 역할</option>
                <option value="caregiver">요양보호사</option>
                <option value="office">사무직</option>
                <option value="admin">관리자</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">모든 상태</option>
                <option value="active">활성화</option>
                <option value="inactive">비활성화</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'pending' ? (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {filteredPendingUsers.length === 0 ? (
                <div className="text-center py-12">
                  <FiUserPlus className="mx-auto text-gray-400 mb-4" size={48} />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">가입 신청이 없습니다</h3>
                  <p className="text-gray-500">현재 승인 대기 중인 사용자가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPendingUsers.map((user) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                              <FiUserPlus className="text-yellow-600" size={24} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-medium text-gray-900">{user.name}</h3>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(user.status)}`}>
                                {getStatusLabel(user.status)}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center">
                                <FiMail className="mr-2" size={14} />
                                {user.email}
                              </div>
                              <div className="flex items-center">
                                <FiShield className="mr-2" size={14} />
                                {getRoleLabel(user.role)}
                              </div>
                              {user.requestedAt && (
                                <div className="flex items-center">
                                  <FiCalendar className="mr-2" size={14} />
                                  신청일: {format(new Date(user.requestedAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApproveUser(user.id)}
                            disabled={isProcessing}
                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                          >
                            <FiUserCheck className="mr-1.5" size={16} />
                            승인
                          </button>
                          <button
                            onClick={() => handleRejectUser(user.id)}
                            disabled={isProcessing}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                          >
                            <FiUserX className="mr-1.5" size={16} />
                            거절
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="members"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {filteredMembers.length === 0 ? (
                <div className="text-center py-12">
                  <FiUsers className="mx-auto text-gray-400 mb-4" size={48} />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">회원이 없습니다</h3>
                  <p className="text-gray-500">현재 등록된 회원이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredMembers.map((user) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              user.status === 'active' ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              <FiUsers className={user.status === 'active' ? 'text-green-600' : 'text-gray-600'} size={24} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-medium text-gray-900">{user.name}</h3>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(user.status)}`}>
                                {getStatusLabel(user.status)}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                                user.role === 'admin' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                user.role === 'caregiver' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                'bg-green-100 text-green-800 border-green-200'
                              }`}>
                                {getRoleLabel(user.role)}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center">
                                <FiMail className="mr-2" size={14} />
                                {user.email}
                              </div>
                              {user.approvedAt && (
                                <div className="flex items-center">
                                  <FiCalendar className="mr-2" size={14} />
                                  가입일: {format(new Date(user.approvedAt), 'yyyy년 MM월 dd일', { locale: ko })}
                                </div>
                              )}
                              {user.lastLoginAt && (
                                <div className="flex items-center">
                                  <FiCalendar className="mr-2" size={14} />
                                  최근 로그인: {format(new Date(user.lastLoginAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleToggleUserStatus(user.id, user.status)}
                            disabled={isProcessing || user.role === 'admin'}
                            className={`px-3 py-2 text-sm font-medium border rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                              user.status === 'active'
                                ? 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 focus:ring-gray-500'
                                : 'text-green-700 bg-green-50 border-green-300 hover:bg-green-100 focus:ring-green-500'
                            }`}
                          >
                            {user.status === 'active' ? '비활성화' : '활성화'}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteModal(true);
                            }}
                            disabled={isProcessing || user.role === 'admin'}
                            className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-300 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                          >
                            <FiTrash2 className="mr-1" size={14} />
                            삭제
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {showDeleteModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteModal(false)}
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
                  <h3 className="text-lg font-bold text-gray-900 mb-1">회원 삭제 확인</h3>
                  <p className="text-gray-600 text-sm">
                    <strong>{selectedUser.name}</strong>님을 삭제하시겠습니까?<br />
                    이 작업은 되돌릴 수 없습니다.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  disabled={isProcessing}
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      처리중...
                    </>
                  ) : (
                    <>
                      <FiTrash2 className="mr-1.5" size={16} />
                      삭제하기
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement; 