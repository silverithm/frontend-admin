'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, addMonths, subMonths, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DayInfo, VacationRequest, VacationLimit } from '@/types/vacation';
import { deleteVacation as apiDeleteVacation, logout as apiLogout } from '@/lib/apiService';
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
  
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [allRequests, setAllRequests] = useState<VacationRequest[]>([]);
  const [roleFilter, setRoleFilter] = useState<'all' | 'caregiver' | 'office'>('all');
  const [nameFilter, setNameFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'vacation-date-asc' | 'vacation-date-desc' | 'name'>('latest');

  const [isClient, setIsClient] = useState(false);

  // 클라이언트 사이드에서만 실행되도록 하는 useEffect
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return; // 클라이언트 사이드가 아니면 실행하지 않음
    
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
  }, [router, isClient]);

  useEffect(() => {
    if (!isClient) return; // 클라이언트 사이드가 아니면 실행하지 않음
    
    if (localStorage.getItem('authToken')) {
      fetchMonthData();
      fetchAllRequests();
    }
  }, [currentDate, isClient]);

  const filteredRequests = useMemo(() => {
    // allRequests가 배열인지 확인
    if (!Array.isArray(allRequests)) {
      console.warn('allRequests가 배열이 아닙니다:', allRequests);
      return [];
    }
    
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
    
    // filtered가 배열인지 다시 확인
    if (!Array.isArray(filtered)) {
      console.warn('filtered가 배열이 아닙니다:', filtered);
      return [];
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
      
      // JWT 토큰 가져오기
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // 캘린더 데이터 조회
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      
      const calendarResponse = await fetch(`/api/vacation/calendar?startDate=${startDateStr}&endDate=${endDateStr}&roleFilter=${roleFilter}`, {
        headers
      });
      
      if (!calendarResponse.ok) {
        throw new Error('휴가 캘린더 데이터를 가져오는데 실패했습니다.');
      }
      
      const calendarData = await calendarResponse.json();
      
      // 휴가 제한 데이터 조회
      const limitsResponse = await fetch(`/api/vacation/limits?start=${startDateStr}&end=${endDateStr}`, {
        headers
      });
      
      if (!limitsResponse.ok) {
        throw new Error('휴가 제한 데이터를 가져오는데 실패했습니다.');
      }
      
      const limitsData = await limitsResponse.json();

      const limitsMap: Record<string, VacationLimit> = {};
      const limits = Array.isArray(limitsData.limits) ? limitsData.limits : [];
      limits.forEach((limit: VacationLimit) => {
        limitsMap[`${limit.date}_${limit.role}`] = limit;
      });
      setVacationLimits(limitsMap);
      
      const days: Record<string, DayInfo> = {};
      const dates = calendarData.dates || {};
      
      // 캘린더 데이터에서 휴가 정보 추출
      Object.keys(dates).forEach(dateKey => {
        const dateData = dates[dateKey];
        if (dateData && dateData.vacations) {
          days[dateKey] = {
            date: dateKey,
            count: dateData.totalVacationers || 0,
            people: Array.isArray(dateData.vacations) ? dateData.vacations.filter((v: VacationRequest) => v.status !== 'rejected') : []
          };
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
      // JWT 토큰 가져오기
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/vacation/requests', {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API 응답 데이터:', data);
      
      // 데이터가 배열인지 확인
      let requestsArray: VacationRequest[] = [];
      if (Array.isArray(data)) {
        requestsArray = data;
      } else if (data && Array.isArray(data.requests)) {
        requestsArray = data.requests;
      } else if (data && Array.isArray(data.data)) {
        requestsArray = data.data;
      } else {
        console.warn('예상하지 못한 API 응답 형태:', data);
        requestsArray = [];
      }
      
      // 첫 번째 요청 객체의 구조 상세 로그
      if (requestsArray.length > 0) {
        const firstRequest = requestsArray[0];
        console.log('첫 번째 요청 객체 상세 구조:', {
          id: firstRequest.id,
          userName: firstRequest.userName,
          date: firstRequest.date,
          dateType: typeof firstRequest.date,
          createdAt: firstRequest.createdAt,
          createdAtType: typeof firstRequest.createdAt,
          status: firstRequest.status,
          role: firstRequest.role,
          fullObject: firstRequest
        });
        
        // 날짜 파싱 테스트
        console.log('날짜 파싱 테스트:');
        console.log('request.date:', firstRequest.date);
        console.log('new Date(request.date):', new Date(firstRequest.date));
        console.log('request.createdAt:', firstRequest.createdAt);
        console.log('new Date(Number(request.createdAt)):', new Date(Number(firstRequest.createdAt)));
        console.log('new Date(request.createdAt):', new Date(firstRequest.createdAt));
      }
      
      setAllRequests(requestsArray); 
      const pendingOnly = requestsArray.filter((req: VacationRequest) => req.status === 'pending');
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
      
      // JWT 토큰 가져오기
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      let url = `/api/vacation/date/${formattedDate}?role=${roleFilter}`;
      if (nameFilter) {
        url += `&nameFilter=${encodeURIComponent(nameFilter)}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('날짜 상세 데이터:', data);
      
      // 데이터에서 휴가 목록 추출
      const vacations = Array.isArray(data.vacations) ? data.vacations : [];
      setDateVacations(vacations);
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
      // JWT 토큰 가져오기
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const formattedDate = format(date, 'yyyy-MM-dd');
      const limits = [{
        date: formattedDate,
        maxPeople,
        role
      }];
      
      const response = await fetch('/api/vacation/limits', {
        method: 'POST',
        headers,
        body: JSON.stringify({ limits }),
      });
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status}`);
      }
      
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
      console.log('휴무 승인 시작:', { vacationId, type: typeof vacationId });
      
      // JWT 토큰 가져오기
      const token = localStorage.getItem('authToken');
      console.log('JWT 토큰 상태:', { hasToken: !!token, tokenLength: token?.length });
      
      if (!token) {
        throw new Error('인증 토큰이 없습니다.');
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
      
      console.log('승인 요청 전송:', { url: `/api/vacation/approve/${vacationId}`, headers });
      
      const response = await fetch(`/api/vacation/approve/${vacationId}`, {
        method: 'PUT',
        headers,
      });
      
      console.log('승인 응답 상태:', { status: response.status, ok: response.ok });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('승인 오류 응답:', errorData);
        throw new Error(`휴무 승인 실패: ${response.status} - ${errorData}`);
      }
      
      const result = await response.json();
      console.log('승인 성공 응답:', result);
      
      showNotification('휴무 요청이 승인되었습니다.', 'success');
      await handleVacationUpdated();
    } catch (error) {
      console.error('휴무 승인 중 상세 오류:', {
        error,
        message: (error as Error).message,
        stack: (error as Error).stack,
        vacationId
      });
      showNotification(`휴무 승인 중 오류가 발생했습니다: ${(error as Error).message}`, 'error');
      if ((error as Error).message.includes('인증')) router.push('/login');
    }
  };

  const handleRejectVacation = async (vacationId: string) => {
    try {
      console.log('휴무 거절 시작:', { vacationId, type: typeof vacationId });
      
      // JWT 토큰 가져오기
      const token = localStorage.getItem('authToken');
      console.log('JWT 토큰 상태:', { hasToken: !!token, tokenLength: token?.length });
      
      if (!token) {
        throw new Error('인증 토큰이 없습니다.');
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
      
      console.log('거절 요청 전송:', { url: `/api/vacation/reject/${vacationId}`, headers });
      
      const response = await fetch(`/api/vacation/reject/${vacationId}`, {
        method: 'PUT',
        headers,
      });
      
      console.log('거절 응답 상태:', { status: response.status, ok: response.ok });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('거절 오류 응답:', errorData);
        throw new Error(`휴무 거절 실패: ${response.status} - ${errorData}`);
      }
      
      const result = await response.json();
      console.log('거절 성공 응답:', result);
      
      showNotification('휴무 요청이 거절되었습니다.', 'success');
      await handleVacationUpdated();
    } catch (error) {
      console.error('휴무 거절 중 상세 오류:', {
        error,
        message: (error as Error).message,
        stack: (error as Error).stack,
        vacationId
      });
      showNotification(`휴무 거절 중 오류가 발생했습니다: ${(error as Error).message}`, 'error');
      if ((error as Error).message.includes('인증')) router.push('/login');
    }
  };
  
  const handleDeleteVacation = async (vacationId: string) => {
    try {
      await apiDeleteVacation(vacationId, { isAdmin: true });
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

  // 날짜를 안전하게 포맷팅하는 함수
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return '';
    
    console.log('포맷팅할 날짜 값:', { dateValue, type: typeof dateValue });
    
    let date: Date;
    
    // 이미 Date 객체인 경우
    if (dateValue instanceof Date) {
      date = dateValue;
    }
    // 문자열인 경우
    else if (typeof dateValue === 'string') {
      // ISO 형식 (YYYY-MM-DD) 체크
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        date = new Date(dateValue + 'T00:00:00.000Z');
      } else {
        date = new Date(dateValue);
      }
    }
    // 숫자인 경우 (타임스탬프)
    else if (typeof dateValue === 'number') {
      // 밀리초 단위가 아닌 초 단위인 경우 (길이가 10자리)
      if (dateValue.toString().length === 10) {
        date = new Date(dateValue * 1000);
      } else {
        date = new Date(dateValue);
      }
    }
    // 그 외의 경우
    else {
      console.warn('알 수 없는 날짜 형식:', dateValue);
      return '';
    }
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      console.warn('유효하지 않은 날짜:', dateValue);
      return '';
    }
    
    console.log('파싱된 날짜:', date);
    return date.toLocaleDateString('ko-KR');
  };

  // 휴무 날짜를 포맷팅하는 함수 (YYYY-MM-DD 형식)
  const formatVacationDate = (dateValue: any): string => {
    if (!dateValue) return '';
    
    // 이미 YYYY-MM-DD 형식인 경우
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      const [year, month, day] = dateValue.split('-');
      return `${year}.${month}.${day}`;
    }
    
    // 다른 형식인 경우 일반 날짜 포맷팅 사용
    const formatted = formatDate(dateValue);
    return formatted;
  };

  // 클라이언트 사이드가 아직 준비되지 않았거나 로딩 중일 때
  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="ml-3 text-lg text-gray-700">
          {!isClient ? '페이지를 준비하는 중...' : '데이터를 불러오는 중...'}
        </p>
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
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-grow max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              {/* 휴무 캘린더와 컨트롤 패널 */}
              <div className="flex flex-col xl:flex-row gap-6">
                {/* 캘린더 영역 */}
                <div className="xl:w-4/5 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
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
                <div className="xl:w-1/5 flex flex-col gap-4">
                  {/* 필터 패널 */}
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-800 mb-3">필터</h3>
                    
                    <div className="space-y-3">
                      {/* 상태 필터 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">상태</label>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            onClick={() => toggleStatusFilter('all')}
                            className={`px-2 py-1 text-[10px] font-medium rounded ${
                              statusFilter === 'all' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            전체
                          </button>
                          <button
                            onClick={() => toggleStatusFilter('pending')}
                            className={`px-2 py-1 text-[10px] font-medium rounded ${
                              statusFilter === 'pending' 
                                ? 'bg-yellow-500 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            대기
                          </button>
                          <button
                            onClick={() => toggleStatusFilter('approved')}
                            className={`px-2 py-1 text-[10px] font-medium rounded ${
                              statusFilter === 'approved' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            승인
                          </button>
                          <button
                            onClick={() => toggleStatusFilter('rejected')}
                            className={`px-2 py-1 text-[10px] font-medium rounded ${
                              statusFilter === 'rejected' 
                                ? 'bg-red-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            거부
                          </button>
                        </div>
                      </div>

                      {/* 직원 유형 필터 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">직원</label>
                        <div className="grid grid-cols-1 gap-1">
                          <button
                            onClick={() => toggleRoleFilter('all')}
                            className={`px-2 py-1 text-[10px] font-medium rounded ${
                              roleFilter === 'all' 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            전체
                          </button>
                          <button
                            onClick={() => toggleRoleFilter('caregiver')}
                            className={`px-2 py-1 text-[10px] font-medium rounded ${
                              roleFilter === 'caregiver' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            요양보호사
                          </button>
                          <button
                            onClick={() => toggleRoleFilter('office')}
                            className={`px-2 py-1 text-[10px] font-medium rounded ${
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
                        <label className="block text-xs font-medium text-gray-700 mb-1">정렬</label>
                        <div className="grid grid-cols-1 gap-1">
                          <button 
                            onClick={() => toggleSortOrder('latest')}
                            className={`px-2 py-1 text-[10px] font-medium rounded ${
                              sortOrder === 'latest' 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            최신순
                          </button>
                          <button 
                            onClick={() => toggleSortOrder('name')}
                            className={`px-2 py-1 text-[10px] font-medium rounded ${
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
                        className="w-full mt-2 px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        초기화
                      </button>
                    </div>
                  </div>
                  
                  {/* 휴무 목록 */}
                  <div className="flex-grow bg-white p-3 rounded-lg shadow-sm border border-gray-200 overflow-auto">
                    <h3 className="text-sm font-medium text-gray-800 mb-3">휴무 목록</h3>
                    
                    {isLoading ? (
                      <div className="flex justify-center items-center h-32">
                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      </div>
                    ) : filteredRequests.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 text-xs">
                        조건에 맞는 휴무 요청이 없습니다.
                      </div>
                    ) : (
                      <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                        {filteredRequests.map(request => (
                          <li key={request.id} className="p-2 bg-gray-50 rounded border border-gray-200 hover:shadow-sm transition-shadow">
                            <div className="flex justify-between items-start mb-1">
                              <div>
                                <div className="font-medium text-gray-900 text-xs truncate">{request.userName}</div>
                                <div className="text-[10px] text-gray-500">{formatVacationDate(request.date)}</div>
                              </div>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                                request.status === 'approved' 
                                  ? 'bg-green-100 text-green-800' 
                                  : request.status === 'pending' 
                                    ? 'bg-yellow-100 text-yellow-800' 
                                    : 'bg-red-100 text-red-800'
                              }`}>
                                {request.status === 'approved' ? '승인' : request.status === 'pending' ? '대기' : '거부'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <span className={`px-1.5 py-0.5 text-[9px] rounded ${
                                  request.role === 'caregiver' 
                                    ? 'bg-blue-50 text-blue-700' 
                                    : 'bg-green-50 text-green-700'
                                }`}>
                                  {request.role === 'caregiver' ? '요양' : '사무'}
                                </span>
                                <span className="text-[9px] text-gray-500">
                                  {formatDate(request.createdAt)}
                                </span>
                              </div>
                              {request.status === 'pending' && (
                                <div className="flex gap-0.5">
                                  <button
                                    onClick={() => handleApproveVacation(request.id)}
                                    className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                                    title="승인"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleRejectVacation(request.id)}
                                    className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                                    title="거부"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteVacation(request.id)}
                                    className="p-0.5 text-gray-600 hover:bg-gray-100 rounded"
                                    title="삭제"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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