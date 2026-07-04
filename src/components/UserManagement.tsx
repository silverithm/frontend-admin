'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiUsers, FiUserPlus, FiUserX, FiUserCheck, FiTrash2, FiSearch, FiRefreshCw, FiMail, FiShield, FiHeart, FiPlus, FiEdit2, FiBriefcase, FiCheck } from 'react-icons/fi';
import { getPendingUsers, getMemberUsers, approveUser, rejectUser, deleteUser, updateUserStatus, getCompanyElders, addCompanyElder, updateCompanyElder, deleteCompanyElder, getPositions, createPosition, updatePosition, deletePosition, assignPositionToMember, getMemberPermissions, updateMemberPermissions, type PendingUser } from '@/lib/apiService';
import type { ElderlyInfo } from '@/types/elderly';
import type { Position } from '@/types/position';
import { ALL_PERMISSIONS, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS, type Permission } from '@/types/auth';
import PositionManagement from '@/components/PositionManagement';
import {
  ALL_ROLE_FILTER,
  buildRoleNames,
  getMemberRoleName,
  getRoleDisplayName,
} from '@/lib/roleUtils';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Switch } from '@astryxdesign/core/Switch';
import { Selector } from '@astryxdesign/core/Selector';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Table } from '@astryxdesign/core/Table';
import { Badge } from '@astryxdesign/core/Badge';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { VStack, HStack, StackItem } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive';
  requestedAt?: number;
  approvedAt?: number;
  lastLoginAt?: number;
  organizationId?: string;
  position?: string;
  positionId?: number;
}

// Table 행 타입 (Astryx Table의 T는 Record<string, unknown>를 만족해야 함)
interface UserRow extends User, Record<string, unknown> {}
interface SeniorRow extends ElderlyInfo, Record<string, unknown> {}

interface UserManagementProps {
  organizationName?: string;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  isAdmin?: boolean;
}

const UserManagement: React.FC<UserManagementProps> = ({ organizationName, onNotification, isAdmin = true }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'members' | 'roles' | 'seniors'>('pending');
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLE_FILTER);
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

  // 권한 설정 상태
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionUser, setPermissionUser] = useState<User | null>(null);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<Permission>>(new Set());

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
        role: user.role,
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

  const availableRoles = buildRoleNames({
    positions,
    members,
    includeAdmin: true,
  });

  // ==================== 직책 관리 핸들러 ====================

  const handleCreatePosition = async () => {
    if (!positionForm.name.trim()) {
      onNotification('역할명을 입력해주세요.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      await createPosition({ name: positionForm.name.trim(), description: positionForm.description.trim() || undefined });
      await fetchUsers();
      setShowPositionModal(false);
      setPositionForm({ name: '', description: '' });
      onNotification('역할이 등록되었습니다.', 'success');
    } catch (error) {
      onNotification('역할 등록에 실패했습니다.', 'error');
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
      onNotification('역할이 수정되었습니다.', 'success');
    } catch (error) {
      onNotification('역할 수정에 실패했습니다.', 'error');
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
      onNotification('역할이 삭제되었습니다.', 'success');
    } catch (error) {
      onNotification('역할 삭제에 실패했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignPosition = async (memberId: string, positionId: number | null) => {
    setIsProcessing(true);
    try {
      await assignPositionToMember(memberId, positionId);
      await fetchUsers();
      onNotification('역할이 변경되었습니다.', 'success');
    } catch (error) {
      onNotification('역할 변경에 실패했습니다.', 'error');
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

  // 권한 설정 모달 열기
  const openPermissionModal = async (user: User) => {
    setPermissionUser(user);
    setPermissionLoading(true);
    setShowPermissionModal(true);
    try {
      const data = await getMemberPermissions(user.id);
      const perms = data.permissions || [];
      setSelectedPermissions(new Set(perms as Permission[]));
    } catch (error) {
      console.error('권한 조회 오류:', error);
      setSelectedPermissions(new Set());
    } finally {
      setPermissionLoading(false);
    }
  };

  // 권한 토글
  const togglePermission = (perm: Permission) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(perm)) {
        next.delete(perm);
      } else {
        next.add(perm);
      }
      return next;
    });
  };

  // 권한 저장
  const handleSavePermissions = async () => {
    if (!permissionUser) return;
    setPermissionLoading(true);
    try {
      await updateMemberPermissions(permissionUser.id, Array.from(selectedPermissions));
      onNotification(`${permissionUser.name}님의 권한이 저장되었습니다.`, 'success');
      setShowPermissionModal(false);
      setPermissionUser(null);
    } catch (error) {
      console.error('권한 저장 오류:', error);
      onNotification('권한 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setPermissionLoading(false);
    }
  };

  const filteredMembers = members.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === ALL_ROLE_FILTER || getMemberRoleName(user) === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredPendingUsers = pendingUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getRoleLabel = (role: string) => {
    return getRoleDisplayName(role);
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

  const statusVariant = (status: string): 'warning' | 'success' | 'error' | 'neutral' => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved':
      case 'active': return 'success';
      case 'rejected': return 'error';
      case 'inactive':
      default: return 'neutral';
    }
  };

  if (isLoading) {
    return (
      <HStack height={256} hAlign="center" vAlign="center">
        <Spinner label="사용자 목록을 불러오는 중..." />
      </HStack>
    );
  }

  return (
    <VStack gap={4}>
      {/* 헤더 */}
      <HStack hAlign="between" vAlign="center">
        <VStack gap={0}>
          <Heading level={2}>회원 관리</Heading>
          {organizationName && <Text type="supporting">{organizationName}</Text>}
        </VStack>
        <IconButton
          label="새로고침"
          variant="ghost"
          icon={<Icon icon={FiRefreshCw} />}
          onClick={fetchUsers}
          isLoading={isProcessing}
        />
      </HStack>

      {/* 탭 + 필터 + 콘텐츠 카드 */}
      <Card width="100%" padding={0}>
        <VStack gap={0}>
          {/* 탭 네비게이션 */}
          <div style={{ padding: 16, overflowX: 'auto' }}>
            <SegmentedControl
              value={activeTab}
              onChange={(v) => setActiveTab(v as 'pending' | 'members' | 'roles' | 'seniors')}
              label="회원 관리 탭"
            >
              <SegmentedControlItem value="pending" label={`가입 신청 (${pendingUsers.length})`} icon={<Icon icon={FiUserPlus} size="sm" />} />
              <SegmentedControlItem value="members" label={`기존 회원 (${members.length})`} icon={<Icon icon={FiUsers} size="sm" />} />
              {isAdmin && <SegmentedControlItem value="roles" label="역할 관리" icon={<Icon icon={FiBriefcase} size="sm" />} />}
              <SegmentedControlItem value="seniors" label={`어르신 관리 (${seniors.length})`} icon={<Icon icon={FiHeart} size="sm" />} />
            </SegmentedControl>
          </div>

          <Divider />

          {/* 검색 및 필터 */}
          {activeTab !== 'roles' && (
            <>
              <div style={{ padding: 16 }}>
                {activeTab === 'seniors' ? (
                  <HStack gap={2} vAlign="end">
                    <StackItem size="fill">
                      <TextInput
                        label="어르신 검색"
                        isLabelHidden
                        placeholder="어르신 이름으로 검색..."
                        value={seniorSearchTerm}
                        onChange={(v) => setSeniorSearchTerm(v)}
                        startIcon={FiSearch}
                        hasClear
                      />
                    </StackItem>
                    {isAdmin && (
                      <Button
                        label="어르신 추가"
                        variant="primary"
                        icon={<Icon icon={FiPlus} size="sm" />}
                        onClick={openAddSeniorModal}
                      />
                    )}
                  </HStack>
                ) : (
                  <HStack gap={2} vAlign="end">
                    <StackItem size="fill">
                      <TextInput
                        label="검색"
                        isLabelHidden
                        placeholder="이름 또는 이메일로 검색..."
                        value={searchTerm}
                        onChange={(v) => setSearchTerm(v)}
                        startIcon={FiSearch}
                        hasClear
                      />
                    </StackItem>
                    {activeTab === 'members' && (
                      <>
                        <Selector
                          label="역할 필터"
                          isLabelHidden
                          placeholder="모든 역할"
                          value={roleFilter}
                          options={[
                            { value: ALL_ROLE_FILTER, label: '모든 역할' },
                            ...availableRoles.map((roleName) => ({ value: roleName, label: getRoleDisplayName(roleName) })),
                          ]}
                          onChange={(v) => setRoleFilter(v)}
                        />
                        <Selector
                          label="상태 필터"
                          isLabelHidden
                          placeholder="모든 상태"
                          value={statusFilter}
                          options={[
                            { value: 'all', label: '모든 상태' },
                            { value: 'active', label: '활성화' },
                            { value: 'inactive', label: '비활성화' },
                          ]}
                          onChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}
                        />
                      </>
                    )}
                  </HStack>
                )}
              </div>
              <Divider />
            </>
          )}

          {/* 컨텐츠 영역 */}
          <div style={{ padding: 24 }}>
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
                    <EmptyState
                      icon={<Icon icon={FiHeart} size="lg" color="disabled" />}
                      title="등록된 어르신이 없습니다"
                      description="어르신을 추가하여 관리를 시작하세요."
                      actions={isAdmin ? (
                        <Button
                          label="어르신 추가"
                          variant="primary"
                          icon={<Icon icon={FiPlus} size="sm" />}
                          onClick={openAddSeniorModal}
                        />
                      ) : undefined}
                    />
                  ) : (
                    <Table
                      data={filteredSeniors as SeniorRow[]}
                      idKey={(s) => String(s.id)}
                      hasHover
                      columns={[
                        {
                          key: 'name',
                          header: '어르신',
                          renderCell: (s) => (
                            <HStack gap={2} vAlign="center">
                              <Icon icon={FiHeart} size="sm" color="accent" />
                              <Text weight="semibold">{s.name}</Text>
                              {s.requiredFrontSeat && <Badge variant="orange" label="앞좌석 필요" />}
                            </HStack>
                          ),
                        },
                        {
                          key: 'address',
                          header: '주소',
                          renderCell: (s) => (
                            s.homeAddressName
                              ? <Text type="supporting">{s.homeAddressName}</Text>
                              : <Text type="supporting" color="disabled">주소 미등록</Text>
                          ),
                        },
                        ...(isAdmin ? [{
                          key: 'actions',
                          header: '',
                          renderCell: (s: SeniorRow) => (
                            <HStack gap={2} hAlign="end">
                              <Button label="수정" size="sm" variant="secondary" icon={<Icon icon={FiEdit2} size="sm" />} onClick={() => openEditSeniorModal(s)} isDisabled={isProcessing} />
                              <Button label="삭제" size="sm" variant="destructive" icon={<Icon icon={FiTrash2} size="sm" />} onClick={() => { setSelectedSenior(s); setShowDeleteSeniorModal(true); }} isDisabled={isProcessing} />
                            </HStack>
                          ),
                        }] : []),
                      ]}
                    />
                  )}
                </motion.div>
              ) : activeTab === 'roles' ? (
                <motion.div
                  key="roles"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <PositionManagement
                    organizationName={organizationName}
                    onNotification={onNotification}
                    isAdmin={isAdmin}
                  />
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
                    <EmptyState
                      icon={<Icon icon={FiUserPlus} size="lg" color="disabled" />}
                      title="가입 신청이 없습니다"
                      description="현재 승인 대기 중인 사용자가 없습니다."
                    />
                  ) : (
                    <Table
                      data={filteredPendingUsers as UserRow[]}
                      idKey="id"
                      hasHover
                      columns={[
                        {
                          key: 'name',
                          header: '회원',
                          renderCell: (u) => (
                            <HStack gap={2} vAlign="center" wrap="wrap">
                              <Text weight="semibold">{u.name}</Text>
                              <Badge variant={statusVariant(u.status)} label={getStatusLabel(u.status)} />
                            </HStack>
                          ),
                        },
                        {
                          key: 'email',
                          header: '이메일',
                          renderCell: (u) => (
                            <HStack gap={1} vAlign="center">
                              <Icon icon={FiMail} size="sm" color="secondary" />
                              <Text type="supporting">{u.email}</Text>
                            </HStack>
                          ),
                        },
                        {
                          key: 'role',
                          header: '역할',
                          renderCell: (u) => <Text type="body">{getRoleLabel(u.role)}</Text>,
                        },
                        {
                          key: 'requestedAt',
                          header: '신청일',
                          renderCell: (u) => (
                            u.requestedAt
                              ? <Text type="supporting">{format(new Date(u.requestedAt), 'yyyy-MM-dd HH:mm', { locale: ko })}</Text>
                              : <Text type="supporting" color="disabled">-</Text>
                          ),
                        },
                        ...(isAdmin ? [{
                          key: 'actions',
                          header: '',
                          renderCell: (u: UserRow) => (
                            <HStack gap={2} hAlign="end">
                              <Button label="승인" size="sm" variant="primary" icon={<Icon icon={FiUserCheck} size="sm" />} onClick={() => handleApproveUser(u.id)} isDisabled={isProcessing} />
                              <Button label="거절" size="sm" variant="destructive" icon={<Icon icon={FiUserX} size="sm" />} onClick={() => handleRejectUser(u.id)} isDisabled={isProcessing} />
                            </HStack>
                          ),
                        }] : []),
                      ]}
                    />
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
                    <EmptyState
                      icon={<Icon icon={FiUsers} size="lg" color="disabled" />}
                      title="회원이 없습니다"
                      description="현재 등록된 회원이 없습니다."
                    />
                  ) : (
                    <Table
                      data={filteredMembers as UserRow[]}
                      idKey="id"
                      hasHover
                      columns={[
                        {
                          key: 'name',
                          header: '회원',
                          renderCell: (u) => {
                            const resolvedRole = getMemberRoleName(u);
                            return (
                              <HStack gap={2} vAlign="center" wrap="wrap">
                                <Text weight="semibold">{u.name}</Text>
                                <Badge variant={statusVariant(u.status)} label={getStatusLabel(u.status)} />
                                <Badge variant={u.role === 'admin' ? 'purple' : 'blue'} label={getRoleLabel(resolvedRole)} />
                              </HStack>
                            );
                          },
                        },
                        {
                          key: 'email',
                          header: '이메일',
                          renderCell: (u) => (
                            <HStack gap={1} vAlign="center">
                              <Icon icon={FiMail} size="sm" color="secondary" />
                              <Text type="supporting">{u.email}</Text>
                            </HStack>
                          ),
                        },
                        {
                          key: 'position',
                          header: '직책',
                          renderCell: (u) => (
                            isAdmin ? (
                              <Selector
                                label="역할 배정"
                                isLabelHidden
                                size="sm"
                                placeholder="역할 미배정"
                                value={u.positionId?.toString() || ''}
                                options={[
                                  { value: '', label: '역할 미배정' },
                                  ...positions.map((pos) => ({ value: pos.id.toString(), label: pos.name })),
                                ]}
                                onChange={(val) => handleAssignPosition(u.id, val ? parseInt(val) : null)}
                                isDisabled={isProcessing}
                              />
                            ) : u.position ? (
                              <Badge variant="orange" label={u.position} />
                            ) : (
                              <Text type="supporting" color="disabled">-</Text>
                            )
                          ),
                        },
                        {
                          key: 'joined',
                          header: '가입/로그인',
                          renderCell: (u) => (
                            <VStack gap={0.5}>
                              {u.approvedAt && <Text type="supporting">가입: {format(new Date(u.approvedAt), 'yyyy-MM-dd', { locale: ko })}</Text>}
                              {u.lastLoginAt && <Text type="supporting">로그인: {format(new Date(u.lastLoginAt), 'yyyy-MM-dd HH:mm', { locale: ko })}</Text>}
                              {!u.approvedAt && !u.lastLoginAt && <Text type="supporting" color="disabled">-</Text>}
                            </VStack>
                          ),
                        },
                        ...(isAdmin ? [{
                          key: 'actions',
                          header: '',
                          renderCell: (u: UserRow) => (
                            <HStack gap={2} hAlign="end">
                              {u.role !== 'admin' && (
                                <Button label="권한" size="sm" variant="secondary" icon={<Icon icon={FiShield} size="sm" />} onClick={() => openPermissionModal(u)} isDisabled={isProcessing} />
                              )}
                              <Button
                                label={u.status === 'active' ? '비활성화' : '활성화'}
                                size="sm"
                                variant="secondary"
                                onClick={() => handleToggleUserStatus(u.id, u.status)}
                                isDisabled={isProcessing || u.role === 'admin'}
                              />
                              <Button
                                label="삭제"
                                size="sm"
                                variant="destructive"
                                icon={<Icon icon={FiTrash2} size="sm" />}
                                onClick={() => { setSelectedUser(u); setShowDeleteModal(true); }}
                                isDisabled={isProcessing || u.role === 'admin'}
                              />
                            </HStack>
                          ),
                        }] : []),
                      ]}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </VStack>
      </Card>

      {/* 삭제 확인 모달 */}
      {selectedUser && (
        <Dialog
          isOpen={showDeleteModal}
          onOpenChange={(o) => { if (!o) setShowDeleteModal(false); }}
          purpose="form"
          width={440}
        >
          <Layout
            header={<DialogHeader title="회원 삭제 확인" onOpenChange={(o) => { if (!o) setShowDeleteModal(false); }} />}
            content={
              <LayoutContent>
                <HStack gap={3} vAlign="start">
                  <Icon icon="error" color="error" size="lg" />
                  <Text type="body" color="secondary">
                    <Text as="span" weight="bold" color="primary">{selectedUser.name}</Text>님을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                  </Text>
                </HStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button label="취소" variant="ghost" onClick={() => setShowDeleteModal(false)} isDisabled={isProcessing} />
                  <Button label="삭제하기" variant="destructive" icon={<Icon icon={FiTrash2} size="sm" />} onClick={handleDeleteUser} isLoading={isProcessing} isDisabled={isProcessing} />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      {/* 직책 관리 모달 */}
      <Dialog
        isOpen={showPositionModal}
        onOpenChange={(o) => { if (!o) setShowPositionModal(false); }}
        purpose="form"
        width={560}
      >
        <Layout
          header={<DialogHeader title="역할 관리" onOpenChange={(o) => { if (!o) setShowPositionModal(false); }} />}
          content={
            <LayoutContent>
              <VStack gap={4}>
                {/* 직책 추가 폼 */}
                <VStack gap={3}>
                  <Text type="label">{editingPosition ? '역할 수정' : '새 역할 추가'}</Text>
                  <TextInput
                    label="역할명"
                    isLabelHidden
                    placeholder="역할명 (예: 팀장, 사회복지사)"
                    value={positionForm.name}
                    onChange={(v) => setPositionForm(prev => ({ ...prev, name: v }))}
                  />
                  <TextInput
                    label="설명"
                    isLabelHidden
                    placeholder="설명 (선택사항)"
                    value={positionForm.description}
                    onChange={(v) => setPositionForm(prev => ({ ...prev, description: v }))}
                  />
                  <HStack gap={2}>
                    <Button
                      label={editingPosition ? '수정' : '추가'}
                      variant="primary"
                      onClick={editingPosition ? handleUpdatePosition : handleCreatePosition}
                      isLoading={isProcessing}
                      isDisabled={isProcessing || !positionForm.name.trim()}
                    />
                    {editingPosition && (
                      <Button
                        label="취소"
                        variant="ghost"
                        onClick={() => {
                          setEditingPosition(null);
                          setPositionForm({ name: '', description: '' });
                        }}
                      />
                    )}
                  </HStack>
                </VStack>

                <Divider />

                {/* 직책 목록 */}
                <VStack gap={2}>
                  {positions.length === 0 ? (
                    <Text type="supporting" color="disabled">등록된 역할이 없습니다.</Text>
                  ) : (
                    positions.map((pos) => (
                      <HStack key={pos.id} gap={2} hAlign="between" vAlign="center">
                        <VStack gap={0}>
                          <Text weight="medium">{pos.name}</Text>
                          {pos.description && <Text type="supporting">{pos.description}</Text>}
                        </VStack>
                        <HStack gap={1}>
                          <IconButton
                            label="역할 수정"
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon={FiEdit2} size="sm" />}
                            onClick={() => {
                              setEditingPosition(pos);
                              setPositionForm({ name: pos.name, description: pos.description || '' });
                            }}
                          />
                          <IconButton
                            label="역할 삭제"
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon={FiTrash2} size="sm" />}
                            onClick={() => {
                              setSelectedPosition(pos);
                              setShowDeletePositionModal(true);
                            }}
                          />
                        </HStack>
                      </HStack>
                    ))
                  )}
                </VStack>
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="닫기" variant="secondary" onClick={() => setShowPositionModal(false)} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 직책 삭제 확인 모달 */}
      {selectedPosition && (
        <Dialog
          isOpen={showDeletePositionModal}
          onOpenChange={(o) => { if (!o) setShowDeletePositionModal(false); }}
          purpose="form"
          width={400}
        >
          <Layout
            header={<DialogHeader title="역할 삭제" onOpenChange={(o) => { if (!o) setShowDeletePositionModal(false); }} />}
            content={
              <LayoutContent>
                <HStack gap={3} vAlign="start">
                  <Icon icon="error" color="error" size="lg" />
                  <Text type="body" color="secondary">
                    <Text as="span" weight="bold" color="primary">{selectedPosition.name}</Text> 역할을 삭제하시겠습니까?
                  </Text>
                </HStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button label="취소" variant="ghost" onClick={() => setShowDeletePositionModal(false)} isDisabled={isProcessing} />
                  <Button label="삭제" variant="destructive" onClick={handleDeletePositionConfirm} isLoading={isProcessing} isDisabled={isProcessing} />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      {/* 어르신 추가/수정 모달 */}
      <Dialog
        isOpen={showSeniorModal}
        onOpenChange={(o) => { if (!o) { setShowSeniorModal(false); setEditingSenior(null); } }}
        purpose="form"
        width={460}
      >
        <Layout
          header={<DialogHeader title={editingSenior ? '어르신 정보 수정' : '어르신 추가'} onOpenChange={(o) => { if (!o) { setShowSeniorModal(false); setEditingSenior(null); } }} />}
          content={
            <LayoutContent>
              <VStack gap={4}>
                <TextInput
                  label="이름"
                  isRequired
                  placeholder="어르신 이름"
                  value={seniorForm.name}
                  onChange={(v) => setSeniorForm(prev => ({ ...prev, name: v }))}
                />
                <TextInput
                  label="주소"
                  isOptional
                  placeholder="주소 입력 (선택사항)"
                  value={seniorForm.homeAddress}
                  onChange={(v) => setSeniorForm(prev => ({ ...prev, homeAddress: v }))}
                />
                <CheckboxInput
                  label="앞좌석 필요"
                  value={seniorForm.requiredFrontSeat}
                  onChange={(checked) => setSeniorForm(prev => ({ ...prev, requiredFrontSeat: checked }))}
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
                  onClick={() => { setShowSeniorModal(false); setEditingSenior(null); }}
                  isDisabled={isProcessing}
                />
                <Button
                  label={editingSenior ? '수정하기' : '추가하기'}
                  variant="primary"
                  onClick={editingSenior ? handleUpdateSenior : handleAddSenior}
                  isLoading={isProcessing}
                  isDisabled={isProcessing || !seniorForm.name.trim()}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 어르신 삭제 확인 모달 */}
      {selectedSenior && (
        <Dialog
          isOpen={showDeleteSeniorModal}
          onOpenChange={(o) => { if (!o) setShowDeleteSeniorModal(false); }}
          purpose="form"
          width={440}
        >
          <Layout
            header={<DialogHeader title="어르신 삭제 확인" onOpenChange={(o) => { if (!o) setShowDeleteSeniorModal(false); }} />}
            content={
              <LayoutContent>
                <HStack gap={3} vAlign="start">
                  <Icon icon="error" color="error" size="lg" />
                  <Text type="body" color="secondary">
                    <Text as="span" weight="bold" color="primary">{selectedSenior.name}</Text>님을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                  </Text>
                </HStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button label="취소" variant="ghost" onClick={() => setShowDeleteSeniorModal(false)} isDisabled={isProcessing} />
                  <Button label="삭제하기" variant="destructive" icon={<Icon icon={FiTrash2} size="sm" />} onClick={handleDeleteSenior} isLoading={isProcessing} isDisabled={isProcessing} />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      {/* 권한 설정 모달 */}
      {permissionUser && (
        <Dialog
          isOpen={showPermissionModal}
          onOpenChange={(o) => { if (!o) { setShowPermissionModal(false); setPermissionUser(null); } }}
          purpose="form"
          width={520}
        >
          <Layout
            header={<DialogHeader title="권한 설정" onOpenChange={(o) => { if (!o) { setShowPermissionModal(false); setPermissionUser(null); } }} />}
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <Text type="supporting">{permissionUser.name}님의 관리 권한</Text>
                  {permissionLoading ? (
                    <HStack gap={2} vAlign="center" hAlign="center">
                      <Spinner size="sm" label="권한 정보 로딩 중..." />
                    </HStack>
                  ) : (
                    <VStack gap={3}>
                      <HStack hAlign="between" vAlign="center">
                        <Text type="supporting">부여할 권한을 선택하세요</Text>
                        <HStack gap={1}>
                          <Button label="전체 선택" variant="ghost" size="sm" onClick={() => setSelectedPermissions(new Set(ALL_PERMISSIONS))} />
                          <Button label="전체 해제" variant="ghost" size="sm" onClick={() => setSelectedPermissions(new Set())} />
                        </HStack>
                      </HStack>
                      <VStack gap={2}>
                        {ALL_PERMISSIONS.map((perm) => (
                          <Switch
                            key={perm}
                            label={PERMISSION_LABELS[perm]}
                            description={PERMISSION_DESCRIPTIONS[perm]}
                            labelSpacing="spread"
                            value={selectedPermissions.has(perm)}
                            onChange={() => togglePermission(perm)}
                          />
                        ))}
                      </VStack>
                    </VStack>
                  )}
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button label="취소" variant="ghost" onClick={() => { setShowPermissionModal(false); setPermissionUser(null); }} />
                  <Button label="저장" variant="primary" icon={<Icon icon={FiCheck} size="sm" />} onClick={handleSavePermissions} isLoading={permissionLoading} isDisabled={permissionLoading} />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}
    </VStack>
  );
};

export default UserManagement;
