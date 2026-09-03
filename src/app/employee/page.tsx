'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { logout as apiLogout, getMemberPermissions } from '@/lib/apiService';
import { useAlert } from '@/components/Alert';
import EmployeeCalendar from '@/components/EmployeeCalendar';
import EmployeeApproval from '@/components/EmployeeApproval';
import NoticeManagement from '@/components/NoticeManagement';
import { ChatManagement } from '@/components/ChatManagement';
import ScheduleCalendar from '@/components/ScheduleCalendar';
import NoticeRollingBanner from '@/components/NoticeRollingBanner';
import { Badge } from '@astryxdesign/core/Badge';
import { ChatRail } from '@/components/ChatRail/ChatRail';
import TodayTaskReminder from '@/components/TodayTaskReminder';
import AdminDashboard from '@/components/AdminDashboard';
import PlazaManagement from '@/components/plaza/PlazaManagement';
import VoiceBoxEmployee from '@/components/VoiceBoxEmployee';
import ExternalLinksNav from '@/components/ExternalLinksNav';
import ApprovalManagement from '@/components/ApprovalManagement';
import ApprovalTemplateManager from '@/components/ApprovalTemplateManager';
import UserManagement from '@/components/UserManagement';
import CompanyLibrary from '@/components/CompanyLibrary';
import DispatchManagement from '@/components/DispatchManagement';
import EmployeeMeetingMinutes from '@/components/meetingMinutes/EmployeeMeetingMinutes';
import AiPostWriter from '@/components/AiPostWriter';
import Image from 'next/image';
import type { Permission } from '@/types/auth';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { useToast } from '@astryxdesign/core/Toast';
import { Icon } from '@astryxdesign/core/Icon';
import type { IconType } from '@astryxdesign/core/Icon';
import {
  IconLayoutDashboard,
  IconApps,
  IconBell,
  IconMessageDots,
  IconCalendar,
  IconCalendarStats,
  IconFileText,
  IconUsers,
  IconLogout,
  IconUser,
  IconUsersGroup,
  IconMailbox,
  IconFolder,
} from '@tabler/icons-react';
import { duration } from '@/theme/motion';
import { Link } from '@astryxdesign/core/Link';

// 탭 구성은 관리자 화면(src/app/admin/page.tsx)과 같은 순서·라벨·아이콘을 따른다.
// 관리자 전용 기능(회원관리·편의기능 등)만 권한으로 항목을 숨긴다.
type MainTab = 'dashboard' | 'notice' | 'chat' | 'schedule' | 'approval' | 'work' | 'members' | 'plaza' | 'voice' | 'tools' | 'library';
type ApprovalSubTab = 'submit' | 'management' | 'templates';
// 배차관리는 편의기능 탭으로 옮겨져 더 이상 일정 서브탭이 아니다.
// 편의기능 탭에 들어가는 부가 도구들. 새 편의기능을 붙일 때 여기에 키를 추가한다.
type ToolKey = 'dispatch' | 'aipost' | 'meetingMinutes';

export default function EmployeePage() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('dashboard');
  const [approvalSubTab, setApprovalSubTab] = useState<ApprovalSubTab>('submit');
  // 편의기능 탭을 처음 열었을 때 보여줄 도구 — 권한을 읽기 전 임시값이며, 아래 effect에서
  // 배차 권한이 있으면 'dispatch'(기존 동작 유지)로, 없으면 'meetingMinutes'로 한 번만 확정한다.
  const [activeTool, setActiveTool] = useState<ToolKey>('meetingMinutes');
  const toolInitializedRef = useRef(false);
  const [userName, setUserName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  /* 오른쪽 채팅 레일 — 관리자 화면에만 있던 것을 직원 화면에도 똑같이 둔다.
     어느 탭을 보고 있든 누가 접속해 있는지가 보여야 한다는 이유는 두 화면이 같다. */
  const [railRoomId, setRailRoomId] = useState<number | null>(null);
  const [activeChatRoomId, setActiveChatRoomId] = useState<number | null>(null);
  const [chatUnread, setChatUnread] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const name = localStorage.getItem('userName') || '직원';
    const company = localStorage.getItem('companyName') || '';
    setUserName(name);
    setCompanyName(company);
    // 배차 권한이 있으면 기존처럼 '배차관리'가 먼저 뜨고, 없는 직원만 '회의록'이 먼저 뜬다.
    // 권한을 아직 모르는 시점에 한 번만 정하고, 이후 권한이 새로고침돼도 사용자가 고른 탭을 덮어쓰지 않는다.
    const initTool = (perms: Permission[]) => {
      if (toolInitializedRef.current) return;
      toolInitializedRef.current = true;
      setActiveTool(perms.includes('SCHEDULE_DISPATCH') ? 'dispatch' : 'meetingMinutes');
    };

    try {
      const storedPerms = localStorage.getItem('permissions');
      if (storedPerms) {
        const parsed = JSON.parse(storedPerms) as Permission[];
        setPermissions(parsed);
        initTool(parsed);
      }
    } catch {
      setPermissions([]);
    }

    // 관리자가 변경한 권한을 재로그인 없이 반영하기 위해 서버에서 최신 권한 재조회
    const userId = localStorage.getItem('userId');
    const loginType = localStorage.getItem('loginType');
    if (userId && loginType === 'employee') {
      getMemberPermissions(userId)
        .then((data) => {
          const freshPerms = (data?.permissions || []) as Permission[];
          setPermissions(freshPerms);
          localStorage.setItem('permissions', JSON.stringify(freshPerms));
          // localStorage에 캐시된 권한이 없어 위에서 못 정했을 경우를 대비한 두 번째 기회
          initTool(freshPerms);
        })
        .catch(() => {
          // 조회 실패 시 로그인 시점에 저장된 권한 유지
        });
    }
  }, [isClient]);

  const hasPermission = (perm: Permission) => permissions.includes(perm);
  const hasAnyPermission = (...perms: Permission[]) => perms.some(p => permissions.includes(p));

  const handleLogout = async () => {
    try {
      await apiLogout();
      router.push('/login');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      showAlert({
        type: 'error',
        title: '로그아웃 실패',
        message: '로그아웃 중 오류가 발생했습니다.',
      });
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    // Astryx Toast는 'info'|'error' 두 타입만 지원한다 — success/info는 info로 매핑.
    toast({ body: message, type: type === 'error' ? 'error' : 'info' });
  };

  if (!isClient) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-background-card)' }}>
        <Loading size="page" height="100vh" label="화면을 준비하는 중..." />
      </div>
    );
  }

  // 편의기능 탭의 도구 목록 — 권한이 있는 도구만 노출한다.
  const toolItems = ([
    ...(hasPermission('SCHEDULE_DISPATCH') ? [
      { key: 'dispatch' as const, label: '배차관리' },
    ] : []),
    // 회의록은 참석자로 지정된 사람만 서버가 걸러 보여주므로 권한 게이팅 없이 항상 노출한다.
    { key: 'meetingMinutes' as const, label: '회의록' },
    // AI 글쓰기 — 사진을 찍는 사람이 선생님이라 직원에게도 열어야 의미가 있는 기능이다.
    // 대응하는 세부 권한이 없고 남의 데이터를 건드리지도 않으므로 회의록과 같이 권한 게이팅 없이 낸다.
    { key: 'aipost' as const, label: 'AI 글쓰기' },
  ] as { key: ToolKey; label: string }[]);

  // 관리자 화면과 같은 순서: 커뮤니티를 맨 위에 두고 그 아래가 기관 업무 메뉴다.
  const TABS = ([
    { key: 'plaza', label: '커뮤니티', icon: IconUsersGroup },
    { key: 'dashboard', label: '대시보드', icon: IconLayoutDashboard },
    { key: 'notice', label: '공지사항', icon: IconBell },
    { key: 'chat', label: '채팅', icon: IconMessageDots },
    { key: 'schedule', label: '일정', icon: IconCalendar },
    { key: 'approval', label: '전자결재', icon: IconFileText },
    { key: 'work', label: '근무조정', icon: IconCalendarStats },
    // 고충·건의함 — 직원 본인이 제출하는 화면이라 관리자 화면과 달리 권한 검사 없이 항상 연다
    { key: 'voice', label: '고충·건의함', icon: IconMailbox },
    // 자료실 — 관리자 화면과 동일하게 열람은 누구나, 업로드·삭제만 별도 권한(canManage)으로 가린다.
    // 전용 권한이 없어 기본적으로 모두에게 연다.
    { key: 'library', label: '자료실', icon: IconFolder },
    // 권한이 있는 경우에만 회원관리 탭 표시
    ...(hasAnyPermission('MEMBER_VIEW', 'MEMBER_MANAGE') ? [
      { key: 'members', label: '회원관리', icon: IconUsers },
    ] : []),
    // 편의기능 — 부가 도구를 모으는 자리. 도구가 하나도 없으면 탭 자체를 숨긴다.
    ...(toolItems.length > 0 ? [
      { key: 'tools', label: '편의기능', icon: IconApps },
    ] : []),
  ] as { key: string; label: string; icon: IconType }[]);

  return (
    <>
      <AlertContainer />
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-background-muted)' }}>
        {/* 사이드바 (데스크탑) */}
        <aside className="carev-emp-sidebar" style={{ flexDirection: 'column', width: 224, background: 'var(--color-background-card)', borderRight: '1px solid var(--color-border)', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 30 }}>
          {/* 로고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', padding: '0 var(--spacing-6)', height: 64, borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
            <Image src="/images/carev-favicon.png" alt="케어브이" width={32} height={32} style={{ borderRadius: 'var(--radius-inner)' }} />
            <div>
              <Text as="p" type="body" weight="bold" color="primary">케어브이</Text>
              {companyName && <Text as="p" type="supporting" color="secondary" maxLines={1}>{companyName}</Text>}
            </div>
          </div>

          {/* 네비게이션 */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-4) var(--spacing-3)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)' }}>
            <Text as="p" type="supporting" weight="semibold" color="secondary">메뉴</Text>
            {TABS.map((tab) => (
              <div key={tab.key}>
                <Button
                  label={tab.label}
                  variant={activeMainTab === tab.key ? 'secondary' : 'ghost'}
                  size="md"
                  onClick={() => setActiveMainTab(tab.key as MainTab)}
                  icon={<Icon icon={tab.icon} size="sm" color={activeMainTab === tab.key ? 'accent' : 'primary'} />}
                  endContent={tab.key === 'chat' && chatUnread > 0 ? <Badge variant="error" label={chatUnread > 99 ? "99+" : String(chatUnread)} /> : undefined}
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                />
              </div>
            ))}
          </nav>

          {/* 사이드바 하단 */}
          <div style={{ borderTop: '1px solid var(--color-border)', padding: 'var(--spacing-3) 0', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', flexShrink: 0 }}>
            <ExternalLinksNav />
            <div style={{ padding: 'var(--spacing-2) var(--spacing-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <Icon icon={IconUser} size="sm" color="secondary" />
                <div style={{ minWidth: 0 }}>
                  <Text as="p" type="supporting" weight="medium" color="primary" maxLines={1}>{userName}</Text>
                  <Text as="p" type="supporting" color="secondary">직원</Text>
                </div>
              </div>
            </div>
            <Button
              label="로그아웃"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              icon={<Icon icon={IconLogout} size="sm" color="secondary" />}
              style={{ width: '100%', justifyContent: 'flex-start' }}
            />
          </div>
        </aside>

        {/* 모바일 헤더 (lg 미만) */}
        <header className="carev-emp-mobile-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30, background: 'var(--color-background-card)', borderBottom: '1px solid var(--color-border)', boxShadow: 'var(--shadow-low)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--spacing-4)', height: 52 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <Image src="/images/carev-favicon.png" alt="케어브이" width={26} height={26} style={{ borderRadius: 'var(--radius-inner)' }} />
              <div>
                <Text as="span" type="body" weight="bold" color="primary">케어브이</Text>
                {companyName && <Text as="p" type="supporting" color="secondary" maxLines={1}>{companyName}</Text>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <IconButton
                label="로그아웃"
                variant="ghost"
                size="sm"
                tooltip="로그아웃"
                onClick={handleLogout}
                icon={<Icon icon={IconLogout} size="sm" color="secondary" />}
              />
            </div>
          </div>
          <nav className="scrollbar-hide" style={{ display: 'flex', overflowX: 'auto', padding: '0 var(--spacing-2)', marginBottom: -1 }}>
            {TABS.map((tab) => (
              <Button
                key={tab.key}
                label={tab.label}
                variant={activeMainTab === tab.key ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveMainTab(tab.key as MainTab)}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              />
            ))}
          </nav>
        </header>

        {/* 메인 콘텐츠 영역 */}
        <div className="carev-emp-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: 0 }}>
          {/* 공지사항 롤링 배너 */}
          <div className="carev-emp-rolling">
            <NoticeRollingBanner
              onNoticeClick={() => setActiveMainTab('notice')}
              autoScrollInterval={5000}
              maxNotices={5}
            />
          </div>

          {/* 메인 콘텐츠 */}
          <div className="carev-emp-body">
          <main style={{ flexGrow: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', width: '100%', padding: 'var(--spacing-4) var(--spacing-3)', display: 'flex', flexDirection: 'column' }}>
            {/* 탭별 콘텐츠 */}
            <AnimatePresence mode="wait">
              {activeMainTab === 'dashboard' ? (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  <AdminDashboard onTabChange={(tab) => setActiveMainTab(tab as MainTab)} isAdmin={false} />
                </motion.div>
              ) : activeMainTab === 'notice' ? (
                <motion.div
                  key="notice"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  {/* 직원은 NOTICE_MANAGE 권한 보유 여부가 공지 관리 권한이다 */}
                  <NoticeManagement canManage={hasPermission('NOTICE_MANAGE')} />
                </motion.div>
              ) : activeMainTab === 'chat' ? (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  {/* ChatManagement의 isAdmin prop은 실제로는 "채팅방 생성·삭제 권한"이다. 전용 채팅 권한이 없어
                      공지 관리 권한(NOTICE_MANAGE)을 대신 기준으로 쓰고 있다 — 기존 동작 유지, 이 컴포넌트는 다른
                      작업자가 수정 중이라 손대지 않는다. */}
                  <ChatManagement onNotification={showNotification} isAdmin={hasPermission('NOTICE_MANAGE')} initialRoomId={railRoomId} onUnreadChange={setChatUnread} onActiveRoomChange={setActiveChatRoomId} />
                </motion.div>
              ) : activeMainTab === 'schedule' ? (
                <motion.div
                  key="schedule"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: duration.mediumMin }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  <ScheduleCalendar isAdmin={hasPermission('SCHEDULE_MANAGE')} mode="schedule" onNotification={showNotification} />
                </motion.div>
              ) : activeMainTab === 'tools' ? (
                <motion.div
                  key={`tools-${activeTool}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: duration.mediumMin }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  {/* 도구가 둘 이상이 되면 전환 바를 띄운다 */}
                  {toolItems.length > 1 && (
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)' }}>
                      {toolItems.map((tool) => (
                        <Button
                          key={tool.key}
                          label={tool.label}
                          variant={activeTool === tool.key ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setActiveTool(tool.key)}
                        />
                      ))}
                    </div>
                  )}
                  {/* 새 편의기능은 여기에 분기를 추가한다 */}
                  {activeTool === 'dispatch' && hasPermission('SCHEDULE_DISPATCH') && (
                    <DispatchManagement onNotification={showNotification} />
                  )}
                  {activeTool === 'meetingMinutes' && (
                    <EmployeeMeetingMinutes onNotification={showNotification} />
                  )}
                  {activeTool === 'aipost' && (
                    <AiPostWriter companyName={companyName} onNotification={showNotification} />
                  )}
                </motion.div>
              ) : activeMainTab === 'approval' ? (
                <motion.div
                  key="approval"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  {/*
                    서브탭은 항상 보인다.
                    결재 권한이 없는 직원도 열람 대상으로 지정된 문서(회의록 등)를 봐야 하므로
                    같은 목록 화면을 '문서함'이라는 이름으로 열어준다 — 목록에 무엇이 담기는지는
                    서버가 열람 권한으로 거른다.
                  */}
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)' }}>
                    <Button
                      label="결재 신청"
                      variant={approvalSubTab === 'submit' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setApprovalSubTab('submit')}
                    />
                    <Button
                      label={hasPermission('APPROVAL_MANAGE') ? '결재 관리' : '문서함'}
                      variant={approvalSubTab === 'management' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setApprovalSubTab('management')}
                    />
                    {hasPermission('APPROVAL_TEMPLATE') && (
                      <Button
                        label="양식 관리"
                        variant={approvalSubTab === 'templates' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setApprovalSubTab('templates')}
                      />
                    )}
                  </div>
                  {approvalSubTab === 'submit' ? (
                    <EmployeeApproval />
                  ) : approvalSubTab === 'management' ? (
                    <ApprovalManagement canManage={hasPermission('APPROVAL_MANAGE')} />
                  ) : approvalSubTab === 'templates' ? (
                    // 이 서브탭 버튼 자체가 APPROVAL_TEMPLATE 권한으로 가려져 있어 항상 true지만, 의도를 명시적으로 남긴다
                    <ApprovalTemplateManager canManage={hasPermission('APPROVAL_TEMPLATE')} />
                  ) : null}
                </motion.div>
              ) : activeMainTab === 'plaza' ? (
                <motion.div
                  key="plaza"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  <PlazaManagement />
                </motion.div>
              ) : activeMainTab === 'voice' ? (
                <motion.div
                  key="voice"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  <VoiceBoxEmployee />
                </motion.div>
              ) : activeMainTab === 'work' ? (
                <motion.div
                  key="work"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  <EmployeeCalendar />
                </motion.div>
              ) : activeMainTab === 'library' ? (
                <motion.div
                  key="library"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  {/* 전용 권한이 없어 열람은 모두 열고, 업로드·삭제만 canManage=false로 막는다(관리자만 자료 관리) */}
                  <CompanyLibrary canManage={false} onNotification={showNotification} />
                </motion.div>
              ) : activeMainTab === 'members' ? (
                <motion.div
                  key="members"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: duration.fast }}
                  style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                  <UserManagement
                    onNotification={showNotification}
                    canManage={hasPermission('MEMBER_MANAGE')}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </main>

          {/* 채팅 탭에서는 레일을 그리지 않는다 — 같은 목록이 화면 안에 이미 있어 중복이다.
              다만 언마운트는 하지 않는다 — 폴링(새 메시지 감지)이 다른 탭에서도 계속 돌아야 한다. */}
          <ChatRail
            hidden={activeMainTab === 'chat'}
            currentRoomId={activeMainTab === 'chat' ? activeChatRoomId : null}
            onOpenRoom={(roomId) => {
              setRailRoomId(roomId);
              setActiveMainTab('chat');
            }}
            onOpenChatTab={() => setActiveMainTab('chat')}
            onUnreadChange={setChatUnread}
            onNewMessage={(room) => {
              showNotification(`${room.name} — 새로운 메시지가 왔습니다`, 'info');
            }}
          />
          </div>

          {/* 푸터 */}
          <footer style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-background-muted)' }}>
            <div style={{ maxWidth: 1600, margin: '0 auto', padding: 'var(--spacing-4) var(--spacing-6)' }}>
              <div className="carev-emp-footer-row">
                <div className="carev-emp-footer-meta">
                  <Text as="span" type="supporting" color="secondary">&copy; 2025 케어브이 (silverithm) 대표: 김준형</Text>
                  <span className="carev-emp-footer-sep" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)' }}>|</span>
                  <Text as="span" type="supporting" color="secondary">사업자등록번호: 107-21-26475</Text>
                  <span className="carev-emp-footer-sep" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)' }}>|</span>
                  <Text as="span" type="supporting" color="secondary">서울특별시 신림동 1547-10</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                  <Link
                    href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)', textDecoration: 'none' }}
                  >
                    개인정보처리방침
                  </Link>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)' }}>|</span>
                  <Link
                    href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)', textDecoration: 'none' }}
                  >
                    이용약관
                  </Link>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)' }}>|</span>
                  <Link href="mailto:ggprgrkjh2@gmail.com" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)', textDecoration: 'none' }}>
                    ggprgrkjh2@gmail.com
                  </Link>
                </div>
              </div>
            </div>
          </footer>
        </div>

        {/* 오늘 담당 일정을 아직 체크하지 않았으면 우측 아래에 알림 */}
        <TodayTaskReminder onOpenSchedule={() => setActiveMainTab('schedule')} />
      </div>
    </>
  );
}
