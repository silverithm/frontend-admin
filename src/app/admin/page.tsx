'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, addMonths, subMonths, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DayInfo, VacationRequest, VacationLimit } from '@/types/vacation';
import { getAllVacationRequests, getVacationsForMonth, getVacationLimitsForMonth, setVacationLimit as apiSetVacationLimit, updateVacationStatus, deleteVacation as apiDeleteVacation, logout as apiLogout, getPendingUsers, approveUser, rejectUser, type PendingUser } from '@/lib/apiService';
import { motion, AnimatePresence } from 'framer-motion';
import VacationCalendar from '@/components/VacationCalendar';
import AdminPanel from '@/components/AdminPanel';
import VacationDetails from '@/components/VacationDetails';
import UserManagement from '@/components/UserManagement';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'vacation' | 'users'>('vacation');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateVacations, setDateVacations] = useState<VacationRequest[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [showLimitPanel, setShowLimitPanel] = useState(false);
  const [vacationDays, setVacationDays] = useState<Record<string, DayInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'success' });
  const [vacationLimits, setVacationLimits] = useState<Record<string, VacationLimit>>({});
  const [pendingRequests, setPendingRequests] = useState<VacationRequest[]>([]);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [allRequests, setAllRequests] = useState<VacationRequest[]>([]);
  const [roleFilter, setRoleFilter] = useState<'all' | 'caregiver' | 'office'>('all');
  const [nameFilter, setNameFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'vacation-date-asc' | 'vacation-date-desc' | 'name'>('latest');

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const orgName = localStorage.getItem('organizationName');
    if (orgName) {
      setOrganizationName(orgName);
    }

    if (!token) {
      router.push('/login');
    } else {
      fetchInitialData();
    }
  }, [router]);

  useEffect(() => {
    if (localStorage.getItem('authToken')) {
      fetchMonthData();
      fetchAllRequests();
        fetchPendingUsers();
    }
  }, [currentDate]);

  const filteredRequests = useMemo(() => {
    let filtered = allRequests;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(request => request.status === statusFilter);
    }
    if (roleFilter !== 'all') {
      filtered = filtered.filter(request => request.role === roleFilter);
    }
    if (nameFilter) {
      filtered = filtered.filter(request => request.userName === nameFilter);
    }
    let sorted = [...filtered];
    switch(sortOrder) {
      case 'latest':
        sorted.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        break;
      case 'oldest':
        sorted.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
        break;
      case 'vacation-date-asc':
        sorted.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        break;
      case 'vacation-date-desc':
        sorted.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        break;
      case 'name':
        sorted.sort((a, b) => (a.userName || '').localeCompare(b.userName || ''));
        break;
    }
    return sorted;
  }, [allRequests, statusFilter, roleFilter, nameFilter, sortOrder]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchMonthData(), fetchAllRequests()]);
    } catch (error) {
        console.error("초기 데이터 로드 실패:", error);
        showNotification('데이터를 불러오는데 실패했습니다. 다시 시도해주세요.', 'error');
        if ((error as Error).message.includes('인증')) {
            router.push('/login');
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
        await apiLogout();
        router.push('/');
    } catch (error) {
        console.error("로그아웃 실패:", error);
        showNotification('로그아웃 중 오류가 발생했습니다.', 'error');
    }
  };

  const fetchMonthData = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const [vacations, limits] = await Promise.all([
        getVacationsForMonth(year, month + 1),
        getVacationLimitsForMonth(year, month + 1)
      ]);

      const limitsMap: Record<string, VacationLimit> = {};
      (limits as VacationLimit[]).forEach(limit => {
        limitsMap[`${limit.date}_${limit.role}`] = limit;
      });
      setVacationLimits(limitsMap);
      
      const days: Record<string, DayInfo> = {};
      (vacations as VacationRequest[]).forEach(vacation => {
        const date = vacation.date;
        if (!days[date]) {
          days[date] = { date, count: 0, people: [] };
        }
        if (vacation.status !== 'rejected') {
          days[date].people.push(vacation);
          days[date].count += 1;
        }
      });
      
      Object.keys(days).forEach(date => {
        const keyBase = date; 
        const officeLimit = limitsMap[`${keyBase}_office`]?.maxPeople ?? 3;
        const caregiverLimit = limitsMap[`${keyBase}_caregiver`]?.maxPeople ?? 3;
        
        let currentLimit = 3;
        if (roleFilter === 'office') currentLimit = officeLimit;
        else if (roleFilter === 'caregiver') currentLimit = caregiverLimit;
        else {
            currentLimit = caregiverLimit; 
        }

        const currentCount = days[date].count;
        days[date].limit = currentLimit;
        if (currentCount < currentLimit) days[date].status = 'available';
        else if (currentCount === currentLimit) days[date].status = 'full';
        else days[date].status = 'over';
      });
      setVacationDays(days);
    } catch (error) {
      console.error('월별 휴무 데이터 로드 중 오류 발생:', error);
      showNotification('월별 휴무 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
      if ((error as Error).message.includes('인증')) router.push('/login');
    }
  };

  const fetchAllRequests = async () => {
    try {
      const data = await getAllVacationRequests();
      setAllRequests(data || []); 
      const pendingOnly = (data || []).filter((req: VacationRequest) => req.status === 'pending');
      setPendingRequests(pendingOnly);
    } catch (error) {
      console.error('전체 휴무 요청을 불러오는 중 오류 발생:', error);
      showNotification('전체 휴무 요청을 불러오는 중 오류가 발생했습니다.', 'error');
      if ((error as Error).message.includes('인증')) router.push('/login');
    }
  };

  const fetchDateDetails = async (date: Date) => {
    setIsLoading(true);
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const allDateVacations = await getVacationsForMonth(date.getFullYear(), date.getMonth() + 1);
      const filtered = (allDateVacations as VacationRequest[]).filter(v => {
          const isSameDate = v.date === formattedDate;
          const roleMatch = roleFilter === 'all' || v.role === roleFilter;
          const nameMatch = !nameFilter || v.userName === nameFilter;
          return isSameDate && roleMatch && nameMatch;
      });
      setDateVacations(filtered);
    } catch (error) {
      console.error('날짜 상세 정보 로드 중 오류 발생:', error);
      setDateVacations([]);
      showNotification('날짜 상세 정보를 불러오는 중 오류가 발생했습니다.', 'error');
      if ((error as Error).message.includes('인증')) router.push('/login');
      } finally {
        setIsLoading(false);
      }
  };

  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));
  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));

  const handleDateSelect = async (date: Date | null) => {
    if (!date) return;
    setSelectedDate(date);
    setShowDetails(true);
      await fetchDateDetails(date);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    document.body.style.overflow = '';
  };

  const handleShowLimitPanel = () => {
    setShowLimitPanel(true);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseLimitPanel = () => {
    setShowLimitPanel(false);
    document.body.style.overflow = '';
  };

  const handleLimitSet = async (date: Date, maxPeople: number, role: 'caregiver' | 'office') => {
    try {
      await apiSetVacationLimit(date, maxPeople, role);
      await fetchMonthData();
      showNotification('휴무 제한 인원이 설정되었습니다.', 'success');
    } catch (error) {
      console.error('휴무 제한 설정 중 오류 발생:', error);
      showNotification('휴무 제한 설정 중 오류가 발생했습니다.', 'error');
      if ((error as Error).message.includes('인증')) router.push('/login');
    }
  };

  const handleVacationUpdated = async () => {
    await fetchInitialData();
    if (selectedDate) {
        await fetchDateDetails(selectedDate);
    }
  };

  const handleApproveVacation = async (vacationId: string) => {
    try {
      await updateVacationStatus(vacationId, 'approved');
      showNotification('휴무 요청이 승인되었습니다.', 'success');
      await handleVacationUpdated();
    } catch (error) {
      console.error('휴무 승인 중 오류 발생:', error);
      showNotification('휴무 승인 중 오류가 발생했습니다.', 'error');
      if ((error as Error).message.includes('인증')) router.push('/login');
    }
  };

  const handleRejectVacation = async (vacationId: string) => {
    try {
      await updateVacationStatus(vacationId, 'rejected');
      showNotification('휴무 요청이 거절되었습니다.', 'success');
      await handleVacationUpdated();
    } catch (error) {
      console.error('휴무 거절 중 오류 발생:', error);
      showNotification('휴무 거절 중 오류가 발생했습니다.', 'error');
      if ((error as Error).message.includes('인증')) router.push('/login');
    }
  };
  
  const handleDeleteVacation = async (vacationId: string) => {
    try {
      await apiDeleteVacation(vacationId);
      showNotification('휴무가 삭제되었습니다.', 'success');
      await handleVacationUpdated();
      if(showDetails) handleCloseDetails();
    } catch (error) {
      console.error('휴무 삭제 중 오류 발생:', error);
      showNotification('휴무 삭제 중 오류가 발생했습니다.', 'error');
      if ((error as Error).message.includes('인증')) router.push('/login');
    }
  };
  
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
  };

  const toggleStatusFilter = (status: 'all' | 'pending' | 'approved' | 'rejected') => setStatusFilter(status);
  const toggleRoleFilter = (role: 'all' | 'caregiver' | 'office') => setRoleFilter(role);
  const toggleNameFilter = (name: string) => setNameFilter(name === '전체' || name === '' ? null : name);
  const toggleSortOrder = (order: 'latest' | 'oldest' | 'vacation-date-asc' | 'vacation-date-desc' | 'name') => setSortOrder(order);

  const resetFilter = async () => {
    setStatusFilter('all');
    setRoleFilter('all');
    setNameFilter(null);
    setSortOrder('latest');
    await fetchAllRequests(); 
  };

  const fetchPendingUsers = async () => {
    try {
      const users = await getPendingUsers();
      setPendingUsers(users || []);
    } catch (error) {
      console.error('가입 대기 직원 목록 로드 오류:', error);
      showNotification('가입 대기 직원 목록을 불러오는데 실패했습니다.', 'error');
      if ((error as Error).message.includes('인증')) router.push('/login');
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      await approveUser(userId);
      showNotification('직원 가입을 승인했습니다.', 'success');
      fetchPendingUsers();
    } catch (error) {
      console.error('직원 가입 승인 오류:', error);
      showNotification('직원 가입 승인에 실패했습니다.', 'error');
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      await rejectUser(userId);
      showNotification('직원 가입을 거절했습니다.', 'info');
      fetchPendingUsers();
    } catch (error) {
      console.error('직원 가입 거절 오류:', error);
      showNotification('직원 가입 거절에 실패했습니다.', 'error');
    }
  };

  if (isLoading && !localStorage.getItem('authToken')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-700">인증 정보를 확인 중입니다...</p>
      </div>
    );
  }
  
  if (isLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
              <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="ml-3 text-lg text-gray-700">데이터를 불러오는 중...</p>
          </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* 헤더 영역 */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                {organizationName ? `${organizationName} 관리자 페이지` : '관리자 페이지'}
              </h1>
              {activeTab === 'vacation' && (
                <span className="ml-4 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  대기 중인 요청: {pendingRequests.length}건
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => router.push('/admin/organization-profile')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                기관 프로필
              </button>
                <button 
                  onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  로그아웃
                </button>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="mt-4 border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('vacation')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'vacation'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                휴무 관리
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                회원 관리
                {pendingUsers.length > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {pendingUsers.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 알림 메시지 */}
        <AnimatePresence>
          {notification.show && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-6 p-4 rounded-md ${
                notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 
                notification.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 
                'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  {notification.type === 'success' && (
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {notification.type === 'error' && (
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  {(!notification.type || notification.type === 'info') && (
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{notification.message}</p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5">
                    <button 
                      onClick={() => setNotification({ ...notification, show: false })}
                      className="inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-50"
                    >
                      <span className="sr-only">닫기</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 탭별 컨텐츠 */}
        <AnimatePresence mode="wait">
          {activeTab === 'vacation' ? (
            <motion.div
              key="vacation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* 대기 중인 사용자 목록 - 휴무 관리 탭에서만 표시 */}
              {pendingUsers.length > 0 && (
                <div className="mb-8 bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:px-6 bg-yellow-50 border-b border-yellow-200">
                    <h3 className="text-lg leading-6 font-medium text-yellow-800">
                      가입 승인 대기 중인 사용자 ({pendingUsers.length}명)
                    </h3>
                  </div>
                  <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                    <dl className="sm:divide-y sm:divide-gray-200">
                      {pendingUsers.map(user => (
                        <div key={user.id} className="py-4 sm:py-5 sm:grid sm:grid-cols-5 sm:gap-4 sm:px-6 hover:bg-gray-50">
                          <dt className="text-sm font-medium text-gray-500">
                            이름
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
                            {user.name}
                          </dd>
                          <dt className="text-sm font-medium text-gray-500 mt-2 sm:mt-0">
                            이메일
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
                            {user.email}
                          </dd>
                          <dd className="mt-2 sm:mt-0 flex justify-end gap-2">
                            <button 
                              onClick={() => handleApproveUser(user.id)}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleRejectUser(user.id)}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              거부
                            </button>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}

              {/* 휴무 캘린더와 컨트롤 패널 */}
              <div className="flex flex-col lg:flex-row gap-8">
                {/* 캘린더 영역 */}
                <div className="lg:w-3/5 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center">
                      <button
                        onClick={handlePrevMonth}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                        disabled={isLoading}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <h2 className="text-xl font-semibold text-gray-800 mx-2">
                        {format(currentDate, 'yyyy년 MM월', { locale: ko })}
                      </h2>
                      <button
                        onClick={handleNextMonth}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                        disabled={isLoading}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleShowLimitPanel}
                        className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      >
                        휴무 제한 설정
                      </button>
                    </div>
                  </div>
                  
                  <VacationCalendar
                    currentDate={currentDate}
                    setCurrentDate={setCurrentDate}
                    onDateSelect={handleDateSelect}
                    isAdmin={true}
                    roleFilter={roleFilter}
                    nameFilter={nameFilter}
                  />
                </div>

                {/* 필터 및 휴무 목록 */}
                <div className="lg:w-2/5 flex flex-col gap-4">
                  {/* 필터 패널 */}
                  <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">필터 및 정렬</h3>
                    
                    <div className="space-y-4">
                      {/* 상태 필터 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">상태별 필터</label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => toggleStatusFilter('all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                              statusFilter === 'all' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            전체
                          </button>
                          <button
                            onClick={() => toggleStatusFilter('pending')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                              statusFilter === 'pending' 
                                ? 'bg-yellow-500 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            대기중
                          </button>
                          <button
                            onClick={() => toggleStatusFilter('approved')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                              statusFilter === 'approved' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            승인됨
                          </button>
                          <button
                            onClick={() => toggleStatusFilter('rejected')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                              statusFilter === 'rejected' 
                                ? 'bg-red-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            거부됨
                          </button>
                        </div>
                      </div>

                      {/* 직원 유형 필터 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">직원 유형</label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => toggleRoleFilter('all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                              roleFilter === 'all' 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            전체
                          </button>
                          <button
                            onClick={() => toggleRoleFilter('caregiver')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                              roleFilter === 'caregiver' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            요양보호사
                          </button>
                          <button
                            onClick={() => toggleRoleFilter('office')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                              roleFilter === 'office' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            사무직
                          </button>
                        </div>
                      </div>
                      
                      {/* 정렬 옵션 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">정렬</label>
                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={() => toggleSortOrder('latest')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                              sortOrder === 'latest' 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            최신순
                          </button>
                          <button 
                            onClick={() => toggleSortOrder('oldest')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                              sortOrder === 'oldest' 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            오래된순
                          </button>
                          <button 
                            onClick={() => toggleSortOrder('vacation-date-asc')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                              sortOrder === 'vacation-date-asc' 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            휴무일 오름차순
                          </button>
                          <button 
                            onClick={() => toggleSortOrder('vacation-date-desc')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                              sortOrder === 'vacation-date-desc' 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            휴무일 내림차순
                          </button>
                          <button 
                            onClick={() => toggleSortOrder('name')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                              sortOrder === 'name' 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            이름순
                          </button>
                        </div>
                      </div>
                      
                      {/* 필터 초기화 버튼 */}
                      <button 
                        onClick={resetFilter}
                        className="w-full mt-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        필터 초기화
                      </button>
                    </div>
                  </div>
                  
                  {/* 휴무 목록 */}
                  <div className="flex-grow bg-white p-5 rounded-lg shadow-sm border border-gray-200 overflow-auto">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">휴무 요청 목록</h3>
                    
                    {isLoading ? (
                      <div className="flex justify-center items-center h-32">
                        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      </div>
                    ) : filteredRequests.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        조건에 맞는 휴무 요청이 없습니다.
                      </div>
                    ) : (
                      <ul className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                        {filteredRequests.map(request => (
                          <li key={request.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-medium text-gray-900">{request.userName}</div>
                                <div className="text-sm text-gray-500">{request.date}</div>
                              </div>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                request.status === 'approved' 
                                  ? 'bg-green-100 text-green-800' 
                                  : request.status === 'pending' 
                                    ? 'bg-yellow-100 text-yellow-800' 
                                    : 'bg-red-100 text-red-800'
                              }`}>
                                {request.status === 'approved' ? '승인됨' : request.status === 'pending' ? '대기중' : '거부됨'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs rounded-md ${
                                  request.role === 'caregiver' 
                                    ? 'bg-blue-50 text-blue-700' 
                                    : 'bg-green-50 text-green-700'
                                }`}>
                                  {request.role === 'caregiver' ? '요양보호사' : '사무직'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {request.createdAt ? new Date(Number(request.createdAt)).toLocaleDateString() : ''}
                                </span>
                              </div>
                              {request.status === 'pending' && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleApproveVacation(request.id)}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded-full"
                                    title="승인"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleRejectVacation(request.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded-full"
                                    title="거부"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteVacation(request.id)}
                                    className="p-1 text-gray-600 hover:bg-gray-100 rounded-full"
                                    title="삭제"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <UserManagement 
                organizationName={organizationName || undefined}
                onNotification={showNotification}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 모달 컴포넌트들 - 휴무 관리 탭에서만 표시 */}
      {activeTab === 'vacation' && (
        <AnimatePresence>
          {showDetails && selectedDate && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black bg-opacity-50"
              onClick={handleCloseDetails}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md"
              >
                <VacationDetails
                  date={selectedDate}
                  vacations={dateVacations}
                  onClose={handleCloseDetails}
                  onApplyVacation={() => {}}
                  onVacationUpdated={handleVacationUpdated}
                  isLoading={isLoading}
                  roleFilter={roleFilter}
                  isAdmin={true}
                />
              </motion.div>
            </motion.div>
          )}

          {showLimitPanel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black bg-opacity-50"
              onClick={handleCloseLimitPanel}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <AdminPanel
                  currentDate={currentDate}
                  onClose={handleCloseLimitPanel}
                  onUpdateSuccess={fetchMonthData}
                  vacationLimits={vacationLimits}
                  onLimitSet={handleLimitSet}
                  vacationDays={vacationDays}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
} 