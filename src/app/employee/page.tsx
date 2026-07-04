'use client';

import { useState, useEffect } from 'react';
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
import { FloatingChat } from '@/components/FloatingChat/FloatingChat';
import AdminDashboard from '@/components/AdminDashboard';
import ApprovalManagement from '@/components/ApprovalManagement';
import ApprovalTemplateManager from '@/components/ApprovalTemplateManager';
import UserManagement from '@/components/UserManagement';
import DispatchManagement from '@/components/DispatchManagement';
import Image from 'next/image';
import type { Permission } from '@/types/auth';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Text } from '@astryxdesign/core/Text';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Banner } from '@astryxdesign/core/Banner';
import { Icon } from '@astryxdesign/core/Icon';
import type { IconType } from '@astryxdesign/core/Icon';
import {
  IconLayoutDashboard,
  IconBell,
  IconMessageDots,
  IconCalendar,
  IconCalendarStats,
  IconFileText,
  IconUsers,
  IconLogout,
  IconUser,
} from '@tabler/icons-react';

type MainTab = 'dashboard' | 'notice' | 'chat' | 'schedule' | 'approval' | 'work' | 'members';
type ApprovalSubTab = 'submit' | 'management' | 'templates';
type ScheduleSubTab = 'schedule' | 'dispatch';

export default function EmployeePage() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('dashboard');
  const [approvalSubTab, setApprovalSubTab] = useState<ApprovalSubTab>('submit');
  const [scheduleSubTab, setScheduleSubTab] = useState<ScheduleSubTab>('schedule');
  const [userName, setUserName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'success' });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const name = localStorage.getItem('userName') || '직원';
    const company = localStorage.getItem('companyName') || '';
    setUserName(name);
    setCompanyName(company);
    try {
      const storedPerms = localStorage.getItem('permissions');
      if (storedPerms) {
        setPermissions(JSON.parse(storedPerms));
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
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
  };

  if (!isClient) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-card)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-3)' }}>
          <Spinner size="md" label="로딩 중..." />
        </div>
      </div>
    );
  }

  const TABS = ([
    { key: 'dashboard', label: '대시보드', icon: IconLayoutDashboard },
    { key: 'notice', label: '공지사항', icon: IconBell },
    { key: 'chat', label: '채팅', icon: IconMessageDots },
    { key: 'schedule', label: '월간일정', icon: IconCalendar },
    { key: 'approval', label: '전자결재', icon: IconFileText },
    { key: 'work', label: '근무조정', icon: IconCalendarStats },
    // 권한이 있는 경우에만 회원관리 탭 표시
    ...(hasAnyPermission('MEMBER_VIEW', 'MEMBER_MANAGE') ? [
      { key: 'members', label: '회원관리', icon: IconUsers },
    ] : []),
  ] as { key: string; label: string; icon: IconType }[]);

  return (
    <>
      <AlertContainer />
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-background-muted)' }}>
        {/* 사이드바 (데스크탑) */}
        <aside className="carev-emp-sidebar" style={{ flexDirection: 'column', width: 224, background: 'var(--color-background-card)', borderRight: '1px solid var(--color-border)', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 30 }}>
          {/* 로고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', padding: '0 24px', height: 64, borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
            <Image src="/images/carev-favicon.png" alt="케어브이" width={32} height={32} style={{ borderRadius: 'var(--radius-inner)' }} />
            <div>
              <Text as="p" type="body" weight="bold" color="primary">케어브이</Text>
              {companyName && <Text as="p" type="supporting" color="secondary" maxLines={1}>{companyName}</Text>}
            </div>
          </div>

          {/* 네비게이션 */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)' }}>
            <Text as="p" type="supporting" weight="semibold" color="secondary">메뉴</Text>
            {TABS.map((tab) => (
              <div key={tab.key}>
                <Button
                  label={tab.label}
                  variant={activeMainTab === tab.key ? 'secondary' : 'ghost'}
                  size="md"
                  onClick={() => setActiveMainTab(tab.key as MainTab)}
                  icon={<Icon icon={tab.icon} size="sm" color={activeMainTab === tab.key ? 'accent' : 'primary'} />}
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                />
              </div>
            ))}
          </nav>

          {/* 사이드바 하단 */}
          <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px' }}>
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
        <header className="carev-emp-mobile-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30, background: 'var(--color-background-card)', borderBottom: '1px solid var(--color-border)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 52 }}>
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
          <nav className="scrollbar-hide" style={{ display: 'flex', overflowX: 'auto', padding: '0 8px', marginBottom: -1 }}>
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
        <div className="carev-emp-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          {/* 공지사항 롤링 배너 */}
          <div className="carev-emp-rolling">
            <NoticeRollingBanner
              onNoticeClick={() => setActiveMainTab('notice')}
              autoScrollInterval={5000}
              maxNotices={5}
            />
          </div>

          {/* 메인 콘텐츠 */}
          <main style={{ flexGrow: 1, width: '100%', padding: '16px 12px', display: 'flex', flexDirection: 'column' }}>
            {/* 알림 메시지 */}
            <AnimatePresence>
              {notification.show && (
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.95 }}
                  style={{ marginBottom: 'var(--spacing-4)' }}
                >
                  <Banner
                    status={notification.type === 'success' ? 'success' : notification.type === 'error' ? 'error' : 'info'}
                    title={notification.message}
                    isDismissable
                    onDismiss={() => setNotification({ ...notification, show: false })}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 탭별 콘텐츠 */}
            <AnimatePresence mode="wait">
              {activeMainTab === 'dashboard' ? (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <AdminDashboard onTabChange={(tab) => setActiveMainTab(tab as MainTab)} isAdmin={false} />
                </motion.div>
              ) : activeMainTab === 'notice' ? (
                <motion.div
                  key="notice"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <NoticeManagement isAdmin={hasPermission('NOTICE_MANAGE')} />
                </motion.div>
              ) : activeMainTab === 'chat' ? (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <ChatManagement onNotification={showNotification} isAdmin={hasPermission('NOTICE_MANAGE')} />
                </motion.div>
              ) : activeMainTab === 'schedule' ? (
                <motion.div
                  key="schedule"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  {/* 배차관리 권한이 있으면 서브탭 표시 */}
                  {hasPermission('SCHEDULE_DISPATCH') && (
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)' }}>
                      <Button
                        label="일정"
                        variant={scheduleSubTab === 'schedule' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setScheduleSubTab('schedule')}
                      />
                      <Button
                        label="배차관리"
                        variant={scheduleSubTab === 'dispatch' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setScheduleSubTab('dispatch')}
                      />
                    </div>
                  )}
                  {scheduleSubTab === 'schedule' ? (
                    <ScheduleCalendar isAdmin={hasPermission('SCHEDULE_MANAGE')} mode="schedule" onNotification={showNotification} />
                  ) : (
                    <DispatchManagement onNotification={showNotification} />
                  )}
                </motion.div>
              ) : activeMainTab === 'approval' ? (
                <motion.div
                  key="approval"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  {/* 결재 관리/양식 관리 권한이 있으면 서브탭 표시 */}
                  {hasAnyPermission('APPROVAL_MANAGE', 'APPROVAL_TEMPLATE') && (
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)' }}>
                      <Button
                        label="결재 신청"
                        variant={approvalSubTab === 'submit' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setApprovalSubTab('submit')}
                      />
                      {hasPermission('APPROVAL_MANAGE') && (
                        <Button
                          label="결재 관리"
                          variant={approvalSubTab === 'management' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setApprovalSubTab('management')}
                        />
                      )}
                      {hasPermission('APPROVAL_TEMPLATE') && (
                        <Button
                          label="양식 관리"
                          variant={approvalSubTab === 'templates' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setApprovalSubTab('templates')}
                        />
                      )}
                    </div>
                  )}
                  {approvalSubTab === 'submit' ? (
                    <EmployeeApproval />
                  ) : approvalSubTab === 'management' ? (
                    <ApprovalManagement />
                  ) : approvalSubTab === 'templates' ? (
                    <ApprovalTemplateManager />
                  ) : null}
                </motion.div>
              ) : activeMainTab === 'work' ? (
                <motion.div
                  key="work"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <EmployeeCalendar />
                </motion.div>
              ) : activeMainTab === 'members' ? (
                <motion.div
                  key="members"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <UserManagement
                    onNotification={showNotification}
                    isAdmin={hasPermission('MEMBER_MANAGE')}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </main>

          {/* 푸터 */}
          <footer style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-background-muted)' }}>
            <div style={{ maxWidth: 1600, margin: '0 auto', padding: '16px 24px' }}>
              <div className="carev-emp-footer-row">
                <div className="carev-emp-footer-meta">
                  <Text as="span" type="supporting" color="secondary">&copy; 2025 케어브이 (silverithm) 대표: 김준형</Text>
                  <span className="carev-emp-footer-sep" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)' }}>|</span>
                  <Text as="span" type="supporting" color="secondary">사업자등록번호: 107-21-26475</Text>
                  <span className="carev-emp-footer-sep" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)' }}>|</span>
                  <Text as="span" type="supporting" color="secondary">서울특별시 신림동 1547-10</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                  <a
                    href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)', textDecoration: 'none' }}
                  >
                    개인정보처리방침
                  </a>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)' }}>|</span>
                  <a
                    href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)', textDecoration: 'none' }}
                  >
                    이용약관
                  </a>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)' }}>|</span>
                  <a href="mailto:ggprgrkjh@naver.com" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-gray)', textDecoration: 'none' }}>
                    ggprgrkjh@naver.com
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </div>

        {/* 플로팅 채팅 위젯 */}
        <FloatingChat />
      </div>
    </>
  );
}
