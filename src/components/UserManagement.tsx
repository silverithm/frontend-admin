'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiUsers, FiUserPlus, FiUserX, FiUserCheck, FiTrash2, FiSearch, FiFilter, FiRefreshCw, FiMail, FiCalendar, FiShield, FiAlertCircle, FiHeart, FiPlus, FiEdit2, FiBriefcase, FiCheck, FiX } from 'react-icons/fi';
import { getPendingUsers, getMemberUsers, approveUser, rejectUser, deleteUser, updateUserStatus, getCompanyElders, addCompanyElder, updateCompanyElder, deleteCompanyElder, getPositions, createPosition, updatePosition, deletePosition, assignPositionToMember, type PendingUser } from '@/lib/apiService';
import type { ElderlyInfo } from '@/types/elderly';
import type { Position } from '@/types/position';

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
  position?: string;
  positionId?: number;
}

interface UserManagementProps {
  organizationName?: string;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  isAdmin?: boolean;
}

const UserManagement: React.FC<UserManagementProps> = ({ organizationName, onNotification, isAdmin = true }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'members' | 'seniors'>('pending');
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'caregiver' | 'office' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 어르신 관리 상태
  const [seniors, setSeniors] = useState<ElderlyInfo[]>([]);
  const [seniorSearchTerm, setSeniorSearchTerm] = useState('');
  const [showSeniorModal, setShowSeniorModal] = useState(false);
  const [editingSenior, setEditingSenior] = useState<ElderlyInfo | null>(null);
  const [seniorForm, setSeniorForm] = useState({ name: '', homeAddress: '', requiredFrontSeat: false });
  const [showDeleteSeniorModal, setShowDeleteSeniorModal] = useState(false);
  const [selectedSenior, setSelectedSenior] = useState<ElderlyInfo | null>(null);

  // 직책 관리 상태
  const [positions, setPositions] = useState<Position[]>([]);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionForm, setPositionForm] = useState({ name: '', description: '' });
  const [showDeletePositionModal, setShowDeletePositionModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchSeniors();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // 가입 대기 중인 사용자 가져오기
      const [pendingData, membersData, posData]: any[] = await Promise.all([
        getPendingUsers(),
        getMemberUsers(),
        getPositions().catch(() => ({ positions: [] })),
      ]);

      // 백엔드에서 {requests: [...]} 구조로 응답
      const pendingArray = pendingData?.requests || [];

      const formattedPendingUsers = pendingArray.map((user: PendingUser) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'caregiver' | 'office' | 'admin',
        status: 'pending' as const,
        requestedAt: user.requestedAt ? new Date(user.requestedAt).getTime() : undefined,
      }));
      setPendingUsers(formattedPendingUsers);

      // 백엔드에서 {members: [...]} 구조로 응답
      const membersArray = membersData?.members || [];
      setMembers(membersArray);

      // 직책 목록
      const posArray = posData?.positions || [];
      setPositions(posArray);
    } catch (error) {
      console.error('사용자 목록 로드 오류:', error);
      onNotification('사용자 목록을 불러오는데 실패했습니다.', 'error');
      // 오류 발생 시 빈 배열로 초기화
      setPendingUsers([]);
      setMembers([]);
      setPositions([]);
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

  const fetchSeniors = async () => {
    try {
      const data: any = await getCompanyElders();
      const eldersArray = data?.elders || [];
      setSeniors(eldersArray);
    } catch (error) {
      console.error('어르신 목록 로드 오류:', error);
      setSeniors([]);
    }
  };

  const handleAddSenior = async () => {
    if (!seniorForm.name.trim()) {
      onNotification('이름을 입력해주세요.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      await addCompanyElder({
        name: seniorForm.name.trim(),
        homeAddress: seniorForm.homeAddress.trim() || undefined,
        requiredFrontSeat: seniorForm.requiredFrontSeat,
      });
      await fetchSeniors();
      setShowSeniorModal(false);
      setSeniorForm({ name: '', homeAddress: '', requiredFrontSeat: false });
      onNotification('어르신이 등록되었습니다.', 'success');
    } catch (error) {
      console.error('어르신 등록 오류:', error);
      onNotification('어르신 등록에 실패했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateSenior = async () => {
    if (!editingSenior || !seniorForm.name.trim()) return;
    setIsProcessing(true);
    try {
      await updateCompanyElder(editingSenior.id, {
        name: seniorForm.name.trim(),
        homeAddress: seniorForm.homeAddress.trim() || undefined,
        requiredFrontSeat: seniorForm.requiredFrontSeat,
      });
      await fetchSeniors();
      setShowSeniorModal(false);
      setEditingSenior(null);
      setSeniorForm({ name: '', homeAddress: '', requiredFrontSeat: false });
      onNotification('어르신 정보가 수정되었습니다.', 'success');
    } catch (error) {
      console.error('어르신 수정 오류:', error);
      onNotification('어르신 수정에 실패했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSenior = async () => {
    if (!selectedSenior) return;
    setIsProcessing(true);
    try {
      await deleteCompanyElder(selectedSenior.id);
      await fetchSeniors();
      setShowDeleteSeniorModal(false);
      setSelectedSenior(null);
      onNotification('어르신이 삭제되었습니다.', 'success');
    } catch (error) {
      console.error('어르신 삭제 오류:', error);
      onNotification('어르신 삭제에 실패했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const openEditSeniorModal = (senior: ElderlyInfo) => {
    setEditingSenior(senior);
    setSeniorForm({
      name: senior.name,
      homeAddress: senior.homeAddressName || '',
      requiredFrontSeat: senior.requiredFrontSeat,
    });
    setShowSeniorModal(true);
  };

  const openAddSeniorModal = () => {
    setEditingSenior(null);
    setSeniorForm({ name: '', homeAddress: '', requiredFrontSeat: false });
    setShowSeniorModal(true);
  };

  const filteredSeniors = seniors.filter(s =>
    s.name.toLowerCase().includes(seniorSearchTerm.toLowerCase())
  );

  // ==================== 직책 관리 핸들러 ====================

  const handleCreatePosition = async () => {
    if (!positionForm.name.trim()) {
      onNotification('직책명을 입력해주세요.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      await createPosition({ name: positionForm.name.trim(), description: positionForm.description.trim() || undefined });
      await fetchUsers();
      setShowPositionModal(false);
      setPositionForm({ name: '', description: '' });
      onNotification('직책이 등록되었습니다.', 'success');
    } catch (error) {
      onNotification('직책 등록에 실패했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdatePosition = async () => {
    if (!editingPosition || !positionForm.name.trim()) return;
    setIsProcessing(true);
    try {
      await updatePosition(editingPosition.id, { name: positionForm.name.trim(), description: positionForm.description.trim() || undefined });
      await fetchUsers();
      setShowPositionModal(false);
      setEditingPosition(null);
      setPositionForm({ name: '', description: '' });
      onNotification('직책이 수정되었습니다.', 'success');
    } catch (error) {
      onNotification('직책 수정에 실패했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePositionConfirm = async () => {
    if (!selectedPosition) return;
    setIsProcessing(true);
    try {
      await deletePosition(selectedPosition.id);
      await fetchUsers();
      setShowDeletePositionModal(false);
      setSelectedPosition(null);
      onNotification('직책이 삭제되었습니다.', 'success');
    } catch (error) {
      onNotification('직책 삭제에 실패했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignPosition = async (memberId: string, positionId: number | null) => {
    setIsProcessing(true);
    try {
      await assignPositionToMember(memberId, positionId);
      await fetchUsers();
      onNotification('직책이 변경되었습니다.', 'success');
    } catch (error) {
      onNotification('직책 변경에 실패했습니다.', 'error');
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
        <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin mr-3"></div>
        <p className="text-gray-600">사용자 목록을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">회원 관리</h2>
          {organizationName && (
            <p className="text-gray-400 text-sm mt-0.5">{organizationName}</p>
          )}
        </div>
        <button
          onClick={fetchUsers}
          className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
          disabled={isProcessing}
        >
          <FiRefreshCw className={isProcessing ? 'animate-spin' : ''} size={18} />
        </button>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-teal-500 text-teal-700 bg-teal-50'
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
                ? 'border-teal-500 text-teal-700 bg-teal-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FiUsers className="inline mr-2" size={16} />
            기존 회원 ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('seniors')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'seniors'
                ? 'border-teal-500 text-teal-700 bg-teal-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FiHeart className="inline mr-2" size={16} />
            어르신 관리 ({seniors.length})
          </button>
        </nav>
      </div>

      {/* 검색 및 필터 */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 검색 */}
          {activeTab === 'seniors' ? (
            <>
              <div className="flex-1 relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="어르신 이름으로 검색..."
                  value={seniorSearchTerm}
                  onChange={(e) => setSeniorSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              {isAdmin && (
                <button
                  onClick={openAddSeniorModal}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-500 border border-transparent rounded-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 flex items-center whitespace-nowrap"
                >
                  <FiPlus className="mr-1.5" size={16} />
                  어르신 추가
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex-1 relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="이름 또는 이메일로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* 필터 (기존 회원 탭에서만 표시) */}
              {activeTab === 'members' && (
                <>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                  >
                    <option value="all">모든 역할</option>
                    <option value="caregiver">요양보호사</option>
                    <option value="office">사무직</option>
                    <option value="admin">관리자</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                  >
                    <option value="all">모든 상태</option>
                    <option value="active">활성화</option>
                    <option value="inactive">비활성화</option>
                  </select>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setEditingPosition(null);
                        setPositionForm({ name: '', description: '' });
                        setShowPositionModal(true);
                      }}
                      className="px-3 py-2 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-300 rounded-md hover:bg-teal-100 flex items-center whitespace-nowrap"
                    >
                      <FiBriefcase className="mr-1" size={14} />
                      직책 관리
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'seniors' ? (
            <motion.div
              key="seniors"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {filteredSeniors.length === 0 ? (
                <div className="text-center py-12">
                  <FiHeart className="mx-auto text-gray-300 mb-4" size={48} />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">등록된 어르신이 없습니다</h3>
                  <p className="text-gray-400 mb-4">어르신을 추가하여 관리를 시작하세요.</p>
                  {isAdmin && (
                    <button
                      onClick={openAddSeniorModal}
                      className="px-4 py-2 text-sm font-medium text-white bg-teal-500 border border-transparent rounded-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                    >
                      <FiPlus className="inline mr-1.5" size={16} />
                      어르신 추가
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSeniors.map((senior) => (
                    <motion.div
                      key={senior.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                              <FiHeart className="text-teal-600" size={24} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-medium text-gray-900">{senior.name}</h3>
                              {senior.requiredFrontSeat && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full border bg-orange-100 text-orange-800 border-orange-200">
                                  앞좌석 필요
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              {senior.homeAddressName ? (
                                <span>주소: {senior.homeAddressName}</span>
                              ) : (
                                <span className="text-gray-400">주소 미등록</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openEditSeniorModal(senior)}
                              disabled={isProcessing}
                              className="px-3 py-2 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                              <FiEdit2 className="mr-1" size={14} />
                              수정
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSenior(senior);
                                setShowDeleteSeniorModal(true);
                              }}
                              disabled={isProcessing}
                              className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                              <FiTrash2 className="mr-1" size={14} />
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : activeTab === 'pending' ? (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {filteredPendingUsers.length === 0 ? (
                <div className="text-center py-12">
                  <FiUserPlus className="mx-auto text-gray-300 mb-4" size={48} />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">가입 신청이 없습니다</h3>
                  <p className="text-gray-400">현재 승인 대기 중인 사용자가 없습니다.</p>
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
                        {isAdmin && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApproveUser(user.id)}
                              disabled={isProcessing}
                              className="px-4 py-2 text-sm font-medium text-white bg-teal-500 border border-transparent rounded-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                              <FiUserCheck className="mr-1.5" size={16} />
                              승인
                            </button>
                            <button
                              onClick={() => handleRejectUser(user.id)}
                              disabled={isProcessing}
                              className="px-4 py-2 text-sm font-medium text-white bg-red-500 border border-transparent rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                              <FiUserX className="mr-1.5" size={16} />
                              거절
                            </button>
                          </div>
                        )}
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
                  <FiUsers className="mx-auto text-gray-300 mb-4" size={48} />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">회원이 없습니다</h3>
                  <p className="text-gray-400">현재 등록된 회원이 없습니다.</p>
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
                                user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                user.role === 'caregiver' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-green-50 text-green-700 border-green-200'
                              }`}>
                                {getRoleLabel(user.role)}
                              </span>
                              {isAdmin ? (
                                <select
                                  value={(user as any).positionId?.toString() || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleAssignPosition(user.id, val ? parseInt(val) : null);
                                  }}
                                  disabled={isProcessing}
                                  className={`px-2 py-1 text-xs font-medium rounded-full border focus:outline-none focus:ring-1 focus:ring-teal-500 ${
                                    (user as any).position
                                      ? 'bg-orange-100 text-orange-800 border-orange-200'
                                      : 'bg-gray-100 text-gray-500 border-gray-200'
                                  }`}
                                >
                                  <option value="">직책 미배정</option>
                                  {positions.map(pos => (
                                    <option key={pos.id} value={pos.id.toString()}>{pos.name}</option>
                                  ))}
                                </select>
                              ) : (user as any).position ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full border bg-orange-100 text-orange-800 border-orange-200">
                                  {(user as any).position}
                                </span>
                              ) : null}
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
                        {isAdmin && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleToggleUserStatus(user.id, user.status)}
                              disabled={isProcessing || user.role === 'admin'}
                              className={`px-3 py-2 text-sm font-medium border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                user.status === 'active'
                                  ? 'text-gray-700 bg-gray-100 border-gray-200 hover:bg-gray-200 focus:ring-gray-500'
                                  : 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100 focus:ring-teal-500'
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
                              className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                              <FiTrash2 className="mr-1" size={14} />
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>{/* end card wrapper */}

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {showDeleteModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white">회원 삭제 확인</h3>
              </div>
              <div className="p-6">
                <div className="flex items-start mb-4">
                  <div className="bg-red-100 p-2 rounded-full mr-3">
                    <FiAlertCircle size={20} className="text-red-600" />
                  </div>
                  <p className="text-gray-700 text-sm pt-1">
                    <strong>{selectedUser.name}</strong>님을 삭제하시겠습니까?<br />
                    이 작업은 되돌릴 수 없습니다.
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200"
                  disabled={isProcessing}
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 border border-transparent rounded-lg hover:bg-red-600 flex items-center"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-200 border-t-white rounded-full animate-spin mr-2"></div>
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
      {/* 직책 관리 모달 */}
      <AnimatePresence>
        {showPositionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowPositionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FiBriefcase size={20} />
                  직책 관리
                </h3>
              </div>

              <div className="p-6">
                {/* 직책 추가 폼 */}
                <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
                  <label className="block text-sm font-bold text-gray-900">
                    {editingPosition ? '직책 수정' : '새 직책 추가'}
                  </label>
                  <input
                    type="text"
                    value={positionForm.name}
                    onChange={(e) => setPositionForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="직책명 (예: 요양보호사, 간호사)"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <input
                    type="text"
                    value={positionForm.description}
                    onChange={(e) => setPositionForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="설명 (선택사항)"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={editingPosition ? handleUpdatePosition : handleCreatePosition}
                      disabled={isProcessing || !positionForm.name.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 disabled:opacity-50"
                    >
                      {isProcessing ? '처리중...' : editingPosition ? '수정' : '추가'}
                    </button>
                    {editingPosition && (
                      <button
                        onClick={() => {
                          setEditingPosition(null);
                          setPositionForm({ name: '', description: '' });
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        취소
                      </button>
                    )}
                  </div>
                </div>

                {/* 직책 목록 */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {positions.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">등록된 직책이 없습니다.</p>
                  ) : (
                    positions.map((pos) => (
                      <div
                        key={pos.id}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <span className="text-sm font-medium text-gray-900">{pos.name}</span>
                          {pos.description && (
                            <p className="text-xs text-gray-400">{pos.description}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingPosition(pos);
                              setPositionForm({ name: pos.name, description: pos.description || '' });
                            }}
                            className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          >
                            <FiEdit2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPosition(pos);
                              setShowDeletePositionModal(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex justify-end">
                <button
                  onClick={() => setShowPositionModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 직책 삭제 확인 모달 */}
      <AnimatePresence>
        {showDeletePositionModal && selectedPosition && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
            onClick={() => setShowDeletePositionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white">직책 삭제</h3>
              </div>
              <div className="p-6">
                <div className="flex items-start">
                  <div className="bg-red-100 p-2 rounded-full mr-3">
                    <FiAlertCircle size={20} className="text-red-600" />
                  </div>
                  <p className="text-gray-700 text-sm pt-1">
                    <strong>{selectedPosition.name}</strong> 직책을 삭제하시겠습니까?
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex justify-end gap-2">
                <button
                  onClick={() => setShowDeletePositionModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200"
                  disabled={isProcessing}
                >
                  취소
                </button>
                <button
                  onClick={handleDeletePositionConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 flex items-center"
                  disabled={isProcessing}
                >
                  {isProcessing ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 어르신 추가/수정 모달 */}
      <AnimatePresence>
        {showSeniorModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowSeniorModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white">
                  {editingSenior ? '어르신 정보 수정' : '어르신 추가'}
                </h3>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={seniorForm.name}
                    onChange={(e) => setSeniorForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="어르신 이름"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    주소 <span className="text-gray-400">(선택)</span>
                  </label>
                  <input
                    type="text"
                    value={seniorForm.homeAddress}
                    onChange={(e) => setSeniorForm(prev => ({ ...prev, homeAddress: e.target.value }))}
                    placeholder="주소 입력 (선택사항)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="requiredFrontSeat"
                    checked={seniorForm.requiredFrontSeat}
                    onChange={(e) => setSeniorForm(prev => ({ ...prev, requiredFrontSeat: e.target.checked }))}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-200 rounded"
                  />
                  <label htmlFor="requiredFrontSeat" className="ml-2 block text-sm text-gray-700">
                    앞좌석 필요
                  </label>
                </div>
              </div>

              <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowSeniorModal(false);
                    setEditingSenior(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200"
                  disabled={isProcessing}
                >
                  취소
                </button>
                <button
                  onClick={editingSenior ? handleUpdateSenior : handleAddSenior}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-500 border border-transparent rounded-lg hover:bg-teal-600 flex items-center"
                  disabled={isProcessing || !seniorForm.name.trim()}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-teal-200 border-t-white rounded-full animate-spin mr-2"></div>
                      처리중...
                    </>
                  ) : (
                    editingSenior ? '수정하기' : '추가하기'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 어르신 삭제 확인 모달 */}
      <AnimatePresence>
        {showDeleteSeniorModal && selectedSenior && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteSeniorModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white">어르신 삭제 확인</h3>
              </div>
              <div className="p-6">
                <div className="flex items-start">
                  <div className="bg-red-100 p-2 rounded-full mr-3">
                    <FiAlertCircle size={20} className="text-red-600" />
                  </div>
                  <p className="text-gray-700 text-sm pt-1">
                    <strong>{selectedSenior.name}</strong>님을 삭제하시겠습니까?<br />
                    이 작업은 되돌릴 수 없습니다.
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteSeniorModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200"
                  disabled={isProcessing}
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteSenior}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 border border-transparent rounded-lg hover:bg-red-600 flex items-center"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-200 border-t-white rounded-full animate-spin mr-2"></div>
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