'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiUsers, FiUserPlus, FiUserX, FiUserCheck, FiTrash2, FiSearch, FiRefreshCw, FiMail, FiShield, FiHeart, FiPlus, FiEdit2, FiBriefcase, FiCheck, FiCamera, FiUpload } from 'react-icons/fi';
import { getPendingUsers, getMemberUsers, approveUser, rejectUser, deleteUser, updateUserStatus, getCompanyElders, addCompanyElder, updateCompanyElder, deleteCompanyElder, getPositions, assignPositionToMember, getMemberPermissions, updateMemberPermissions, getCompanyAdmins, updateMyPosition, uploadMyProfileImage, deleteMyProfileImage, type PendingUser } from '@/lib/apiService';
import { uploadMemberProfileImage, deleteMemberProfileImage } from '@/lib/memberProfileApi';
import type { ElderlyInfo } from '@/types/elderly';
import type { Position } from '@/types/position';
import { ALL_PERMISSIONS, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS, type Permission } from '@/types/auth';
import PositionManagement from '@/components/PositionManagement';
import ElderBulkUploadDialog from '@/components/ElderBulkUploadDialog';
import {
  ALL_ROLE_FILTER,
  buildRoleNames,
  getMemberRoleName,
  getRoleDisplayName,
} from '@/lib/roleUtils';
import { useOrgPresenceStore } from '@/lib/orgPresenceStore';
import { isAdminSession } from '@/lib/chatIdentity';
import { useVisiblePolling } from '@/lib/useVisiblePolling';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import { FileInput } from '@astryxdesign/core/FileInput';
import { Avatar } from '@astryxdesign/core/Avatar';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Switch } from '@astryxdesign/core/Switch';
import { Selector } from '@astryxdesign/core/Selector';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Table } from '@astryxdesign/core/Table';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Loading } from '@/components/Loading';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { VStack, HStack, StackItem } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { duration } from '@/theme/motion';

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
  profileImageUrl?: string | null;
  /**
   * 관리자 계정(app_user) 행. 직원(members)과 다른 테이블이라 상태·권한·가입일 같은
   * 직원 전용 값이 없고, 여기서는 사진·직책만 손댈 수 있다.
   */
  isAdminAccount?: boolean;
}

// Table 행 타입 (Astryx Table의 T는 Record<string, unknown>를 만족해야 함)
interface UserRow extends User, Record<string, unknown> {}

/** /api/v1/users/admins 응답 한 건 */
interface AdminSummary {
  id: number | string;
  name: string;
  email?: string;
  position?: string | null;
  positionId?: number | null;
  profileImageUrl?: string | null;
}
interface SeniorRow extends ElderlyInfo, Record<string, unknown> {}

interface UserManagementProps {
  organizationName?: string;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  isAdmin?: boolean;
  /** 가입 승인 대기 수를 셸에 알린다 — 사이드바 회원관리 탭 배지가 이 값을 쓴다 */
  onPendingCountChange?: (count: number) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ organizationName, onNotification, isAdmin = true, onPendingCountChange }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'members' | 'roles' | 'seniors'>('pending');
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);

  // 승인·거절·폴링으로 대기 목록이 바뀔 때마다 셸 배지도 같은 숫자를 보게 한다.
  // 첫 조회가 끝나기 전의 빈 목록은 보고하지 않는다 — 셸이 이미 세어 둔 값을 0으로 지우게 된다.
  useEffect(() => {
    if (!hasLoadedUsersRef.current) return;
    onPendingCountChange?.(pendingUsers.length);
  }, [pendingUsers, onPendingCountChange]);
  const [members, setMembers] = useState<User[]>([]);
  /** 기관 관리자 계정 — 직원과 한 표에 놓되 맨 위에 고정한다 */
  const [adminAccounts, setAdminAccounts] = useState<User[]>([]);
  /** 지금 로그인한 관리자 — 사진·직책은 본인 것만 바꿀 수 있다 */
  const [myUserId] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('userId') : null));
  const [isAdminLogin] = useState(() => isAdminSession());
  /**
   * 이 행이 '나'인지.
   *
   * 관리자 계정(app_user)과 직원(members)은 id가 겹칠 수 있어 번호만 맞춰보면 안 된다 —
   * 직원으로 로그인한 사람에게 같은 번호 관리자의 편집 칸이 열려 보인다.
   */
  const isMyAdminRow = (u: User) => u.isAdminAccount === true && isAdminLogin && u.id === myUserId;
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLE_FILTER);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  // 처리 중인 대상의 id. 전역 boolean이던 시절엔 한 사람을 승인하는 동안
  // 다른 탭·다른 행의 무관한 버튼까지 전부 잠겼다 — 이제 해당 행만 잠근다.
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 어르신 관리 상태
  const [seniors, setSeniors] = useState<ElderlyInfo[]>([]);
  const [seniorSearchTerm, setSeniorSearchTerm] = useState('');
  const [showSeniorModal, setShowSeniorModal] = useState(false);
  const [editingSenior, setEditingSenior] = useState<ElderlyInfo | null>(null);
  const [seniorForm, setSeniorForm] = useState({ name: '', homeAddress: '', requiredFrontSeat: false });
  const [showDeleteSeniorModal, setShowDeleteSeniorModal] = useState(false);
  const [selectedSenior, setSelectedSenior] = useState<ElderlyInfo | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // 권한 설정 상태
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionUser, setPermissionUser] = useState<User | null>(null);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<Permission>>(new Set());

  // 프로필 사진 상태
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [isProfileSaving, setIsProfileSaving] = useState(false);

  // 직책 목록 (역할 배정 Selector, 역할 관리 탭에서 사용)
  const [positions, setPositions] = useState<Position[]>([]);

  // 채팅 초대 후보 목록(직원 명단 스토어) — 승인 직후 최신 상태로 강제 갱신할 때 쓴다
  const loadOrgPresence = useOrgPresenceStore(s => s.load);
  // isLoading은 화면 전체를 스피너로 덮으므로 최초 진입 때만 쓴다 — 이후 주기적 갱신은 조용히 반영한다
  const hasLoadedUsersRef = useRef(false);

  useEffect(() => {
    fetchSeniors();
  }, []);

  const fetchUsers = async () => {
    const isInitialLoad = !hasLoadedUsersRef.current;
    if (isInitialLoad) setIsLoading(true);
    try {
      // 가입 대기 중인 사용자 가져오기
      const [pendingData, membersData, posData, adminData]: any[] = await Promise.all([
        getPendingUsers(),
        getMemberUsers(),
        getPositions().catch(() => ({ positions: [] })),
        // 관리자 명단을 못 받아도 직원 목록은 보여준다
        getCompanyAdmins().catch(() => ({ admins: [] })),
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

      // 관리자 계정을 직원과 같은 행 모양으로 맞춘다 (상태·가입일은 관리자에게 없는 개념)
      const adminArray = adminData?.admins || [];
      setAdminAccounts(adminArray.map((a: AdminSummary) => ({
        id: String(a.id),
        email: a.email || '',
        name: a.name || '',
        role: 'admin',
        status: 'active' as const,
        position: a.position || undefined,
        positionId: a.positionId ?? undefined,
        profileImageUrl: a.profileImageUrl ?? null,
        isAdminAccount: true,
      })));
    } catch (error) {
      console.error('사용자 목록 로드 오류:', error);
      onNotification('사용자 목록을 불러오는데 실패했습니다.', 'error');
      // 오류 발생 시 빈 배열로 초기화
      setPendingUsers([]);
      setMembers([]);
      setPositions([]);
      setAdminAccounts([]);
    } finally {
      hasLoadedUsersRef.current = true;
      if (isInitialLoad) setIsLoading(false);
    }
  };

  // 화면을 보고 있는 동안 가입 신청·회원 목록을 주기적으로 최신화한다
  // (다른 관리자의 승인이나 새 가입 신청이 새로고침 없이 반영되게 — 채팅방 목록과 같은 패턴)
  useVisiblePolling(fetchUsers, 30000);

  /**
   * 가입 대기 목록만 다시 불러온다.
   * 행 하나(거절 등)만 바뀌었는데 fetchUsers()로 4개 엔드포인트를 전부 다시 부르지 않기 위한 좁은 재조회.
   */
  const fetchPendingUsers = async () => {
    try {
      const pendingData: any = await getPendingUsers();
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
    } catch (error) {
      console.error('가입 신청 목록 로드 오류:', error);
      onNotification('가입 신청 목록을 불러오는데 실패했습니다.', 'error');
    }
  };

  /**
   * 회원 목록만 다시 불러온다.
   * 상태 변경·직책 배정·삭제처럼 회원 한 명만 바뀌는 작업 뒤에 positions·admins까지 함께 재조회하지 않기 위한 좁은 재조회.
   */
  const fetchMembers = async () => {
    try {
      const membersData: any = await getMemberUsers();
      const membersArray = membersData?.members || [];
      setMembers(membersArray);
    } catch (error) {
      console.error('회원 목록 로드 오류:', error);
      onNotification('회원 목록을 불러오는데 실패했습니다.', 'error');
    }
  };

  /**
   * 직원 명단(orgPresenceStore)을 강제로 다시 받는다.
   *
   * 이 스토어는 기관별로 한 번만 받아 캐시하고 우측 레일·플로팅 채팅·초대 목록이 함께 쓴다.
   * 사람이 늘거나 줄었는데 갱신하지 않으면, 지운 직원이 새로고침할 때까지 목록에 남는다.
   */
  const refreshChatCandidates = () => {
    const companyId = typeof window !== 'undefined' ? localStorage.getItem('companyId') : null;
    if (companyId) loadOrgPresence(companyId, { force: true });
  };

  const handleApproveUser = async (userId: string) => {
    setProcessingId(userId); // 이 사용자 행만 잠근다
    try {
      await approveUser(userId);
      // 승인은 대기 목록에서 회원 목록으로 옮기는 작업이라 이 둘만 다시 불러온다 (positions·admins는 그대로)
      await Promise.all([fetchPendingUsers(), fetchMembers()]);
      refreshChatCandidates();
      onNotification('사용자 가입을 승인했습니다.', 'success');
    } catch (error) {
      console.error('사용자 승인 오류:', error);
      onNotification(error instanceof Error ? error.message : '승인 중 오류가 발생했습니다.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    setProcessingId(userId);
    try {
      await rejectUser(userId);
      await fetchPendingUsers(); // 거절은 대기 목록만 바뀐다
      refreshChatCandidates();
      onNotification('사용자 가입을 거절했습니다.', 'info');
    } catch (error) {
      console.error('사용자 거절 오류:', error);
      onNotification(error instanceof Error ? error.message : '거절 중 오류가 발생했습니다.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setProcessingId(selectedUser.id);
    try {
      await deleteUser(selectedUser.id);
      await fetchMembers(); // 삭제는 회원 목록에만 영향을 준다
      refreshChatCandidates();
      setShowDeleteModal(false);
      setSelectedUser(null);
      onNotification('사용자를 삭제했습니다.', 'success');
    } catch (error) {
      console.error('사용자 삭제 오류:', error);
      onNotification(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setProcessingId(null);
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

  // 신규 어르신 추가는 아직 행 id가 없어 processingId로 쓸 고정 키가 필요하다
  const NEW_SENIOR_KEY = 'senior:new';

  const handleAddSenior = async () => {
    if (!seniorForm.name.trim()) {
      onNotification('이름을 입력해주세요.', 'error');
      return;
    }
    setProcessingId(NEW_SENIOR_KEY);
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
      setProcessingId(null);
    }
  };

  const handleUpdateSenior = async () => {
    if (!editingSenior || !seniorForm.name.trim()) return;
    setProcessingId(String(editingSenior.id));
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
      setProcessingId(null);
    }
  };

  const handleDeleteSenior = async () => {
    if (!selectedSenior) return;
    setProcessingId(String(selectedSenior.id));
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
      setProcessingId(null);
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
  // (역할 생성/수정/삭제 모달은 죽은 코드라 제거했다 — '역할 관리' 탭은 PositionManagement 컴포넌트를 쓴다)

  const handleAssignPosition = async (memberId: string, positionId: number | null) => {
    setProcessingId(memberId);
    try {
      await assignPositionToMember(memberId, positionId);
      await fetchMembers(); // 직책 배정은 회원 목록에만 영향을 준다 (positions 자체는 안 바뀜)
      refreshChatCandidates();
      onNotification('역할이 변경되었습니다.', 'success');
    } catch (error) {
      // 다른 핸들러와 같은 방식으로: 콘솔에 원인을 남기고 실제 에러 메시지를 사용자에게 보여준다
      console.error('역할 배정 오류:', error);
      onNotification(error instanceof Error ? error.message : '역할 변경에 실패했습니다.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    setProcessingId(userId);

    try {
      await updateUserStatus(userId, newStatus as 'active' | 'inactive');
      await fetchMembers(); // 상태 변경은 회원 목록에만 영향을 준다
      // 재직 중인 사람만 채팅 명단에 오르므로 상태가 바뀌면 목록도 달라진다
      refreshChatCandidates();
      onNotification(`사용자 상태를 ${newStatus === 'active' ? '활성화' : '비활성화'}했습니다.`, 'success');
    } catch (error) {
      console.error('사용자 상태 변경 오류:', error);
      onNotification(error instanceof Error ? error.message : '상태 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setProcessingId(null);
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

  // 프로필 사진 모달 열기
  const openProfileModal = (user: User) => {
    setProfileUser(user);
    setProfileFile(null);
    setShowProfileModal(true);
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    setProfileUser(null);
    setProfileFile(null);
  };

  /** 열려 있는 프로필 모달의 사진을 목록에도 반영한다 (관리자/직원은 서로 다른 배열에 있다) */
  const applyProfileImage = (user: User, nextUrl: string | null) => {
    if (user.isAdminAccount) {
      setAdminAccounts(prev => prev.map(u => (u.id === user.id ? { ...u, profileImageUrl: nextUrl } : u)));
    } else {
      setMembers(prev => prev.map(u => (u.id === user.id ? { ...u, profileImageUrl: nextUrl } : u)));
    }
    setProfileUser(prev => (prev ? { ...prev, profileImageUrl: nextUrl } : prev));
  };

  /** 관리자 본인 직책 변경 — 직원과 API가 다르다 */
  const handleChangeMyPosition = async (positionId: number | null) => {
    // 관리자 본인 행의 id(myUserId)로 잠근다 — isMyAdminRow(u)가 true인 행은 u.id === myUserId다
    setProcessingId(myUserId ?? 'me');
    try {
      const result = await updateMyPosition(positionId);
      setAdminAccounts(prev => prev.map(u => (
        u.id === myUserId ? { ...u, positionId: positionId ?? undefined, position: result?.position ?? undefined } : u
      )));
      refreshChatCandidates();
      onNotification(positionId ? '직책이 변경되었습니다.' : '직책을 해제했습니다.', 'success');
    } catch (error) {
      console.error('관리자 직책 변경 오류:', error);
      onNotification(error instanceof Error ? error.message : '직책 변경에 실패했습니다.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUploadProfileImage = async () => {
    if (!profileUser || !profileFile) return;
    setIsProfileSaving(true);
    try {
      const result = profileUser.isAdminAccount
        ? await uploadMyProfileImage(profileFile)
        : await uploadMemberProfileImage(profileUser.id, profileFile);
      const nextUrl = result?.profileImageUrl ?? null;
      applyProfileImage(profileUser, nextUrl);
      setProfileFile(null);
      refreshChatCandidates();
      onNotification('프로필 사진을 등록했습니다.', 'success');
    } catch (error) {
      console.error('프로필 사진 업로드 오류:', error);
      onNotification(error instanceof Error ? error.message : '프로필 사진 업로드에 실패했습니다.', 'error');
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleDeleteProfileImage = async () => {
    if (!profileUser) return;
    setIsProfileSaving(true);
    try {
      if (profileUser.isAdminAccount) await deleteMyProfileImage();
      else await deleteMemberProfileImage(profileUser.id);
      applyProfileImage(profileUser, null);
      refreshChatCandidates();
      onNotification('프로필 사진을 삭제했습니다.', 'success');
    } catch (error) {
      console.error('프로필 사진 삭제 오류:', error);
      onNotification(error instanceof Error ? error.message : '프로필 사진 삭제에 실패했습니다.', 'error');
    } finally {
      setIsProfileSaving(false);
    }
  };

  /**
   * 관리자 + 직원을 한 명단으로.
   *
   * 관리자는 항상 맨 위에 둔다 — 기관에서 한두 명뿐이고 기준이 되는 사람이라, 이름순에
   * 섞여 중간에 파묻히면 찾기 어렵다. 정렬만 손대고 검색·필터는 직원과 똑같이 먹인다.
   */
  const allPeople: User[] = [...adminAccounts, ...members];

  const filteredMembers = allPeople.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === ALL_ROLE_FILTER || getMemberRoleName(user) === roleFilter;
    // 관리자에게는 재직 상태 개념이 없어 상태 필터에서 빼지 않는다 (걸면 통째로 사라진다)
    const matchesStatus = statusFilter === 'all' || user.isAdminAccount || user.status === statusFilter;

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
      <Loading label="사용자 목록을 불러오는 중..." />
    );
  }

  return (
    // 셸이 flex 컬럼으로 감싸주므로 flex:1로 남은 높이를 모두 차지한다.
    // (내용이 적어도 카드 골격이 화면을 채워야 한다)
    <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', gap: 'var(--spacing-4)' }}>
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
          isLoading={processingId !== null}
        />
      </HStack>

      {/* 탭 + 필터 + 콘텐츠 카드 — 남은 높이를 모두 채운다 */}
      <Card width="100%" padding={0} height="100%">
        <VStack gap={0} height="100%">
          {/* 탭 네비게이션 */}
          <HStack style={{ padding: 'var(--spacing-4)', overflowX: 'auto' }}>
            <SegmentedControl
              value={activeTab}
              onChange={(v) => setActiveTab(v as 'pending' | 'members' | 'roles' | 'seniors')}
              label="회원 관리 탭"
            >
              <SegmentedControlItem value="pending" label={`가입 신청 (${pendingUsers.length})`} icon={<Icon icon={FiUserPlus} size="sm" />} />
              <SegmentedControlItem value="members" label={`기존 회원 (${members.length + adminAccounts.length})`} icon={<Icon icon={FiUsers} size="sm" />} />
              {isAdmin && <SegmentedControlItem value="roles" label="역할 관리" icon={<Icon icon={FiBriefcase} size="sm" />} />}
              <SegmentedControlItem value="seniors" label={`어르신 관리 (${seniors.length})`} icon={<Icon icon={FiHeart} size="sm" />} />
            </SegmentedControl>
          </HStack>

          <Divider />

          {/* 검색 및 필터 */}
          {activeTab !== 'roles' && (
            <>
              <VStack style={{ padding: 'var(--spacing-4)' }}>
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
                      <>
                        <Button
                          label="엑셀 등록"
                          variant="secondary"
                          icon={<Icon icon={FiUpload} size="sm" />}
                          onClick={() => setShowBulkUpload(true)}
                        />
                        <Button
                          label="어르신 추가"
                          variant="primary"
                          icon={<Icon icon={FiPlus} size="sm" />}
                          onClick={openAddSeniorModal}
                        />
                      </>
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
              </VStack>
              <Divider />
            </>
          )}

          {/* 컨텐츠 영역 — 남은 높이를 채우고 여기서만 스크롤한다 */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--spacing-6)', display: 'flex', flexDirection: 'column' }}>
            <AnimatePresence mode="wait">
              {activeTab === 'seniors' ? (
                <motion.div
                  key="seniors"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  {filteredSeniors.length === 0 ? (
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                    </div>
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
                              <Icon icon={FiHeart} size="sm" color="secondary" />
                              <Text weight="semibold">{s.name}</Text>
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
                              <Button label="수정" size="sm" variant="secondary" icon={<Icon icon={FiEdit2} size="sm" />} onClick={() => openEditSeniorModal(s)} isDisabled={processingId === String(s.id)} />
                              <Button label="삭제" size="sm" variant="destructive" icon={<Icon icon={FiTrash2} size="sm" />} onClick={() => { setSelectedSenior(s); setShowDeleteSeniorModal(true); }} isDisabled={processingId === String(s.id)} />
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
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
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
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  {filteredPendingUsers.length === 0 ? (
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <EmptyState
                        icon={<Icon icon={FiUserPlus} size="lg" color="disabled" />}
                        title="가입 신청이 없습니다"
                        description="현재 승인 대기 중인 사용자가 없습니다."
                      />
                    </div>
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
                              <Button label="승인" size="sm" variant="primary" icon={<Icon icon={FiUserCheck} size="sm" />} onClick={() => handleApproveUser(u.id)} isDisabled={processingId === u.id} />
                              <Button label="거절" size="sm" variant="destructive" icon={<Icon icon={FiUserX} size="sm" />} onClick={() => handleRejectUser(u.id)} isDisabled={processingId === u.id} />
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
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  {filteredMembers.length === 0 ? (
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <EmptyState
                        icon={<Icon icon={FiUsers} size="lg" color="disabled" />}
                        title="회원이 없습니다"
                        description="현재 등록된 회원이 없습니다."
                      />
                    </div>
                  ) : (
                    <Table
                      data={filteredMembers as UserRow[]}
                      idKey="id"
                      hasHover
                      columns={[
                        {
                          key: 'avatar',
                          header: '',
                          // 관리자 사진은 백엔드가 본인 것만 바꾸게 하므로, 남의 관리자 행은 누를 수 없다
                          renderCell: (u) => (
                            u.isAdminAccount && !isMyAdminRow(u) ? (
                              <Avatar src={u.profileImageUrl || undefined} name={u.name} size="medium" />
                            ) : (
                              <button
                                type="button"
                                onClick={() => openProfileModal(u)}
                                title={`${u.name} 프로필 설정`}
                                aria-label={`${u.name} 프로필 설정`}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                              >
                                <Avatar src={u.profileImageUrl || undefined} name={u.name} size="medium" />
                              </button>
                            )
                          ),
                        },
                        {
                          key: 'name',
                          header: '회원',
                          renderCell: (u) => {
                            if (u.isAdminAccount) {
                              // 관리자에겐 재직 상태가 없다 — 직원 뱃지를 그대로 붙이면 없는 개념이 생긴다
                              return (
                                <HStack gap={2} vAlign="center" wrap="wrap">
                                  <Text weight="semibold">{u.name}</Text>
                                  <Badge variant="purple" label="관리자" />
                                  {isMyAdminRow(u) && <Badge variant="green" label="나" />}
                                </HStack>
                              );
                            }
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
                          renderCell: (u) => {
                            // 관리자 직책은 본인만 바꿀 수 있다 (백엔드가 '내 직책' API만 연다)
                            const canEdit = u.isAdminAccount ? isMyAdminRow(u) : isAdmin;
                            if (!canEdit) {
                              return u.position ? (
                                <Badge variant="orange" label={u.position} />
                              ) : (
                                <Text type="supporting" color="disabled">-</Text>
                              );
                            }
                            return (
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
                                onChange={(val) => {
                                  const positionId = val ? parseInt(val) : null;
                                  if (u.isAdminAccount) handleChangeMyPosition(positionId);
                                  else handleAssignPosition(u.id, positionId);
                                }}
                                isDisabled={processingId === u.id}
                              />
                            );
                          },
                        },
                        {
                          key: 'joined',
                          header: '가입/로그인',
                          renderCell: (u) => (
                            u.isAdminAccount ? (
                              <Text type="supporting" color="disabled">-</Text>
                            ) : (
                              <VStack gap={0.5}>
                                {u.approvedAt && <Text type="supporting">가입: {format(new Date(u.approvedAt), 'yyyy-MM-dd', { locale: ko })}</Text>}
                                {u.lastLoginAt && <Text type="supporting">로그인: {format(new Date(u.lastLoginAt), 'yyyy-MM-dd HH:mm', { locale: ko })}</Text>}
                                {!u.approvedAt && !u.lastLoginAt && <Text type="supporting" color="disabled">-</Text>}
                              </VStack>
                            )
                          ),
                        },
                        ...(isAdmin ? [{
                          key: 'actions',
                          header: '',
                          renderCell: (u: UserRow) => (
                            // 관리자 계정은 여기서 지우거나 재우지 않는다 — 계정 자체는 정보관리에서 다룬다
                            u.isAdminAccount ? (
                              <HStack gap={2} hAlign="end">
                                <Text type="supporting" color="disabled">관리자 계정</Text>
                              </HStack>
                            ) : (
                            <HStack gap={2} hAlign="end">
                              {u.role !== 'admin' && (
                                <Button label="권한" size="sm" variant="secondary" icon={<Icon icon={FiShield} size="sm" />} onClick={() => openPermissionModal(u)} isDisabled={processingId === u.id} />
                              )}
                              <Button
                                label={u.status === 'active' ? '비활성화' : '활성화'}
                                size="sm"
                                variant="secondary"
                                onClick={() => handleToggleUserStatus(u.id, u.status)}
                                isDisabled={processingId === u.id || u.role === 'admin'}
                              />
                              <Button
                                label="삭제"
                                size="sm"
                                variant="destructive"
                                icon={<Icon icon={FiTrash2} size="sm" />}
                                onClick={() => { setSelectedUser(u); setShowDeleteModal(true); }}
                                isDisabled={processingId === u.id || u.role === 'admin'}
                              />
                            </HStack>
                            )
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
                  <Button label="취소" variant="ghost" onClick={() => setShowDeleteModal(false)} isDisabled={processingId === selectedUser.id} />
                  <Button label="삭제하기" variant="destructive" icon={<Icon icon={FiTrash2} size="sm" />} onClick={handleDeleteUser} isLoading={processingId === selectedUser.id} isDisabled={processingId === selectedUser.id} />
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
                {/* 앞좌석 필요는 배차 서비스 종료로 남은 레거시 항목 — 입력받지 않고 기존 값만 보존한다 */}
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
                  isDisabled={processingId === (editingSenior ? String(editingSenior.id) : NEW_SENIOR_KEY)}
                />
                <Button
                  label={editingSenior ? '수정하기' : '추가하기'}
                  variant="primary"
                  onClick={editingSenior ? handleUpdateSenior : handleAddSenior}
                  isLoading={processingId === (editingSenior ? String(editingSenior.id) : NEW_SENIOR_KEY)}
                  isDisabled={processingId === (editingSenior ? String(editingSenior.id) : NEW_SENIOR_KEY) || !seniorForm.name.trim()}
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
                  <Button label="취소" variant="ghost" onClick={() => setShowDeleteSeniorModal(false)} isDisabled={processingId === String(selectedSenior.id)} />
                  <Button label="삭제하기" variant="destructive" icon={<Icon icon={FiTrash2} size="sm" />} onClick={handleDeleteSenior} isLoading={processingId === String(selectedSenior.id)} isDisabled={processingId === String(selectedSenior.id)} />
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
                      <Loading size="inline" label="권한 정보를 불러오는 중..." />
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
                            labelPosition="start"
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

      {/* 프로필 사진 설정 모달 */}
      {profileUser && (
        <Dialog
          isOpen={showProfileModal}
          onOpenChange={(o) => { if (!o) closeProfileModal(); }}
          purpose="form"
          width={440}
        >
          <Layout
            header={<DialogHeader title="프로필 설정" onOpenChange={(o) => { if (!o) closeProfileModal(); }} />}
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <HStack gap={3} vAlign="center">
                    <Avatar src={profileUser.profileImageUrl || undefined} name={profileUser.name} size="large" />
                    <VStack gap={0}>
                      <Text weight="semibold">{profileUser.name}</Text>
                      <Text type="supporting" color="secondary">{profileUser.email}</Text>
                    </VStack>
                  </HStack>

                  <Banner
                    status="info"
                    title="증명사진 안내"
                    description="입사 후 증명사진 위주로 등록해주세요."
                    container="section"
                  />

                  <FileInput
                    label="프로필 사진 선택"
                    isLabelHidden
                    value={profileFile}
                    onChange={(f) => setProfileFile(f as File | null)}
                    accept="image/jpeg,image/png,image/webp"
                    maxSize={5 * 1024 * 1024}
                    placeholder="사진 선택 (jpg, png, webp / 최대 5MB)"
                    isDisabled={isProfileSaving}
                  />
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="between" style={{ width: '100%' }}>
                  <Button
                    label="사진 삭제"
                    variant="destructive"
                    icon={<Icon icon={FiTrash2} size="sm" />}
                    onClick={handleDeleteProfileImage}
                    isDisabled={isProfileSaving || !profileUser.profileImageUrl}
                    isLoading={isProfileSaving}
                  />
                  <HStack gap={2}>
                    <Button label="닫기" variant="ghost" onClick={closeProfileModal} isDisabled={isProfileSaving} />
                    <Button
                      label="업로드"
                      variant="primary"
                      icon={<Icon icon={FiCamera} size="sm" />}
                      onClick={handleUploadProfileImage}
                      isLoading={isProfileSaving}
                      isDisabled={isProfileSaving || !profileFile}
                    />
                  </HStack>
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      {/* 어르신 엑셀 대량 등록 */}
      <ElderBulkUploadDialog
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        existingSeniors={seniors}
        onComplete={fetchSeniors}
        onNotification={onNotification}
      />
    </div>
  );
};

export default UserManagement;
