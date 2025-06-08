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
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyAddressName, setCompanyAddressName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  
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
    const companyNameData = localStorage.getItem('companyName');
    const companyAddressNameData = localStorage.getItem('companyAddressName');
    const userNameData = localStorage.getItem('userName');
    
    if (orgName) {
      setOrganizationName(orgName);
    }
    if (companyNameData) {
      setCompanyName(companyNameData);
    }
    if (companyAddressNameData) {
      setCompanyAddressName(companyAddressNameData);
    }
    if (userNameData) {
      setUserName(userNameData);
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
      
      // JWT 토큰과 companyId 가져오기
      const token = localStorage.getItem('authToken');
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        console.error('CompanyId가 localStorage에 없습니다. 로그인 정보:', {
          token: !!token,
          userName: localStorage.getItem('userName'),
          userId: localStorage.getItem('userId'),
          companyName: localStorage.getItem('companyName')
        });
        throw new Error('회사 ID를 찾을 수 없습니다. 다시 로그인해주세요.');
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // 캘린더 데이터 조회 (companyId 포함)
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      
      const calendarResponse = await fetch(`/api/vacation/calendar?startDate=${startDateStr}&endDate=${endDateStr}&roleFilter=${roleFilter}&companyId=${companyId}`, {
        headers
      });
      
      if (!calendarResponse.ok) {
        throw new Error('휴가 캘린더 데이터를 가져오는데 실패했습니다.');
      }
      
      const calendarData = await calendarResponse.json();
      
      // 휴가 제한 데이터 조회 (companyId 포함)
      const limitsResponse = await fetch(`/api/vacation/limits?start=${startDateStr}&end=${endDateStr}&companyId=${companyId}`, {
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
      if ((error as Error).message.includes('인증') || (error as Error).message.includes('회사 ID')) {
        router.push('/login');
      }
    }
  };

  const fetchAllRequests = async () => {
    try {
      // JWT 토큰과 companyId 가져오기
      const token = localStorage.getItem('authToken');
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/vacation/requests?companyId=${companyId}`, {
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
      if ((error as Error).message.includes('인증') || (error as Error).message.includes('회사 ID')) {
        router.push('/login');
      }
    }
  };

  const fetchDateDetails = async (date: Date) => {
    setIsLoading(true);
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      // JWT 토큰과 companyId 가져오기
      const token = localStorage.getItem('authToken');
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        throw new Error('회사 ID를 찾을 수 없습니다. 다시 로그인해주세요.');
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      let url = `/api/vacation/date/${formattedDate}?role=${roleFilter}&companyId=${companyId}`;
      if (nameFilter) {
        url += `&nameFilter=${encodeURIComponent(nameFilter)}`;
      }
      
      console.log('날짜 상세 조회 요청:', { url, formattedDate, roleFilter, companyId });
      
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
      if ((error as Error).message.includes('인증') || (error as Error).message.includes('회사 ID')) {
        router.push('/login');
      }
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
      // JWT 토큰과 companyId 가져오기
      const token = localStorage.getItem('authToken');
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        console.error('CompanyId가 localStorage에 없습니다. 로그인 정보:', {
          token: !!token,
          userName: localStorage.getItem('userName'),
          userId: localStorage.getItem('userId'),
          companyName: localStorage.getItem('companyName')
        });
        throw new Error('회사 ID를 찾을 수 없습니다. 다시 로그인해주세요.');
      }
      
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
      
      const response = await fetch(`/api/vacation/limits?companyId=${companyId}`, {
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
      if ((error as Error).message.includes('인증') || (error as Error).message.includes('회사 ID')) {
        router.push('/login');
      }
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
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    관리자 페이지
                  </h1>
                  {companyName && (
                    <p className="text-blue-100 text-sm font-medium">
                      {companyName}
                    </p>
                  )}
                </div>
              </div>
              {activeTab === 'vacation' && (
                <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                  <span className="text-white text-sm font-medium flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    대기 중인 요청: {pendingRequests.length}건
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => router.push('/admin/organization-profile')}
                className="px-4 py-2.5 text-sm font-medium text-blue-600 bg-white/90 backdrop-blur-sm border border-white/20 rounded-lg shadow-sm hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200"
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  기관 프로필
                </span>
              </button>
              <button 
                onClick={handleLogout}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white/90 backdrop-blur-sm border border-white/20 rounded-lg shadow-sm hover:bg-white hover:text-gray-900 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200"
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  로그아웃
                </span>
              </button>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="mt-6 border-b border-white/20">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('vacation')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
                  activeTab === 'vacation'
                    ? 'border-white text-white shadow-sm'
                    : 'border-transparent text-blue-200 hover:text-white hover:border-white/50'
                }`}
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  휴무 관리
                </span>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
                  activeTab === 'users'
                    ? 'border-white text-white shadow-sm'
                    : 'border-transparent text-blue-200 hover:text-white hover:border-white/50'
                }`}
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-2a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  회원 관리
                </span>
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
                  <VacationCalendar
                    currentDate={currentDate}
                    setCurrentDate={setCurrentDate}
                    onDateSelect={handleDateSelect}
                    isAdmin={true}
                    roleFilter={roleFilter}
                    nameFilter={nameFilter}
                    onShowLimitPanel={handleShowLimitPanel}
                    onNameFilterChange={setNameFilter}
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

                      {/* 이름 필터 표시 */}
                      {nameFilter && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">선택된 직원</label>
                          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-2 py-1">
                            <span className="text-[10px] font-medium text-blue-800">{nameFilter}</span>
                            <button
                              onClick={() => setNameFilter(null)}
                              className="text-blue-600 hover:text-blue-800 ml-1"
                              title="필터 해제"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                      
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
                                <div 
                                  className={`font-medium text-xs truncate cursor-pointer transition-colors duration-200 ${
                                    nameFilter === request.userName
                                      ? 'text-blue-600 font-bold'
                                      : 'text-gray-900 hover:text-blue-600'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newFilter = nameFilter === request.userName ? null : request.userName;
                                    setNameFilter(newFilter);
                                  }}
                                  title={`${request.userName} ${nameFilter === request.userName ? '필터 해제' : '필터링'}`}
                                >
                                  {request.userName}
                                  {nameFilter === request.userName && (
                                    <span className="ml-1 inline-flex items-center">
                                      <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </span>
                                  )}
                                </div>
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
                organizationName={companyName || undefined}
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

      {/* 푸터 */}
      <footer className="py-10 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0 text-center md:text-left">
              <h3 className="text-2xl font-bold">케어베케이션</h3>
              <p className="text-gray-400 mt-1">효율적인 휴무 관리를 위한 최고의 솔루션</p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400">&copy; {new Date().getFullYear()} 케어베케이션. 모든 권리 보유.</p>
              <p className="text-gray-500 text-sm mt-1">
                <a 
                  href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  개인정보처리방침
                </a> | <a 
                  href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  이용약관
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 