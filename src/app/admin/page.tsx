'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, addMonths, subMonths, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DayInfo, VacationRequest, VacationLimit } from '@/types/vacation';
import { getAllVacationRequests, getVacationsForMonth, getVacationLimitsForMonth, setVacationLimit as apiSetVacationLimit, updateVacationStatus, deleteVacation as apiDeleteVacation, logout as apiLogout } from '@/lib/apiService';
import { motion, AnimatePresence } from 'framer-motion';
import VacationCalendar from '@/components/VacationCalendar';
import AdminPanel from '@/components/AdminPanel';
import VacationDetails from '@/components/VacationDetails';

export default function AdminPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateVacations, setDateVacations] = useState<VacationRequest[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [showLimitPanel, setShowLimitPanel] = useState(false);
  const [vacationDays, setVacationDays] = useState<Record<string, DayInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [vacationLimits, setVacationLimits] = useState<Record<string, VacationLimit>>({});
  const [pendingRequests, setPendingRequests] = useState<VacationRequest[]>([]);
  
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [allRequests, setAllRequests] = useState<VacationRequest[]>([]);
  const [roleFilter, setRoleFilter] = useState<'all' | 'caregiver' | 'office'>('all');
  const [nameFilter, setNameFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'vacation-date-asc' | 'vacation-date-desc' | 'name'>('latest');

  useEffect(() => {
    const token = localStorage.getItem('authToken');
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

  const showNotification = (message: string, type: string) => {
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
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <header className="mb-6 flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-blue-700">관리자 대시보드</h1>
        <button
          onClick={handleLogout}
          className="mt-4 sm:mt-0 px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow transition duration-300"
        >
          로그아웃
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-700">
              {format(currentDate, 'yyyy년 MM월', { locale: ko })}
            </h2>
            <div className="flex gap-2">
              <button onClick={handlePrevMonth} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">이전달</button>
              <button onClick={handleNextMonth} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">다음달</button>
            </div>
          </div>
          <VacationCalendar
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            // vacationDays={vacationDays as any}
            onDateSelect={handleDateSelect} 
            roleFilter={roleFilter}
            onRequestSelect={(date) => handleDateSelect(date)} 
          />
          <div className="mt-6 flex flex-col sm:flex-row justify-end items-center gap-4">
            <p className="text-sm text-gray-600">휴무 인원 제한 설정:</p>
            <button 
              onClick={handleShowLimitPanel}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm"
            >
              일별/역할별 제한 설정
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">승인 대기중인 휴무 ({pendingRequests.length}건)</h2>
          {pendingRequests.length > 0 ? (
            <ul className="space-y-3 max-h-96 overflow-y-auto">
              {pendingRequests.map(req => (
                <li key={req.id} className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                  <p className="font-semibold text-yellow-800">{req.userName} ({req.role})</p>
                  <p className="text-sm text-yellow-700">{format(new Date(req.date), 'MM월 dd일')} - {req.reason}</p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => handleApproveVacation(req.id)} className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">승인</button>
                    <button onClick={() => handleRejectVacation(req.id)} className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600">거절</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">승인 대기중인 요청이 없습니다.</p>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-semibold text-gray-700 mb-6">전체 휴무 요청 관리</h2>
        
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select id="statusFilter" value={statusFilter} onChange={e => toggleStatusFilter(e.target.value as any)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm">
              <option value="all">전체</option>
              <option value="pending">승인대기</option>
              <option value="approved">승인됨</option>
              <option value="rejected">반려됨</option>
            </select>
          </div>
          <div>
            <label htmlFor="roleFilterInput" className="block text-sm font-medium text-gray-700 mb-1">직원 유형</label>
            <select id="roleFilterInput" value={roleFilter} onChange={e => toggleRoleFilter(e.target.value as any)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm">
              <option value="all">전체</option>
              <option value="caregiver">요양보호사</option>
              <option value="office">사무직</option>
            </select>
          </div>
          <div>
            <label htmlFor="nameFilterInput" className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input type="text" id="nameFilterInput" placeholder="이름으로 검색" value={nameFilter || ''} onChange={e => toggleNameFilter(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm" />
          </div>
          <div>
            <label htmlFor="sortOrderSelect" className="block text-sm font-medium text-gray-700 mb-1">정렬</label>
            <select id="sortOrderSelect" value={sortOrder} onChange={e => toggleSortOrder(e.target.value as any)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm">
              <option value="latest">신청일 최신순</option>
              <option value="oldest">신청일 오래된순</option>
              <option value="vacation-date-asc">휴무일 빠른순</option>
              <option value="vacation-date-desc">휴무일 느린순</option>
              <option value="name">이름순</option>
            </select>
          </div>
          <button onClick={resetFilter} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm">필터 초기화</button>
        </div>

        <div className="overflow-x-auto">
          {filteredRequests.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">신청자</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">직원 유형</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">휴무일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사유</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">신청일시</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map(req => (
                  <tr key={req.id} className={`${req.status === 'rejected' ? 'bg-red-50' : req.status === 'approved' ? 'bg-green-50' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{req.userName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{req.role === 'caregiver' ? '요양보호사' : '사무직'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{format(new Date(req.date), 'yyyy-MM-dd')}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={req.reason}>{req.reason}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${req.status === 'approved' ? 'bg-green-100 text-green-800' : 
                          req.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                          'bg-yellow-100 text-yellow-800'}
                      `}>
                        {req.status === 'pending' ? '승인대기' : req.status === 'approved' ? '승인됨' : '반려됨'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {req.createdAt ? format(new Date(req.createdAt), 'yyyy-MM-dd HH:mm') : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium flex gap-2">
                      {req.status === 'pending' && (
                        <>
                          <button onClick={() => handleApproveVacation(req.id)} className="text-green-600 hover:text-green-800">승인</button>
                          <button onClick={() => handleRejectVacation(req.id)} className="text-orange-600 hover:text-orange-800">반려</button>
                        </>
                      )}
                      <button onClick={() => handleDeleteVacation(req.id)} className="text-red-600 hover:text-red-800">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center py-8 text-gray-500">표시할 휴무 요청이 없습니다.</p>
          )}
        </div> 
      </div>

      <AnimatePresence>
        {showDetails && selectedDate && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
          >
            <VacationDetails
              date={selectedDate}
              vacations={dateVacations}
              onClose={handleCloseDetails}
              isLoading={isLoading}
              maxPeople={Number(vacationDays[format(selectedDate, 'yyyy-MM-dd')]?.limit ?? 3)}
              onVacationUpdated={handleVacationUpdated}
              onApplyVacation={handleVacationUpdated}
              isAdmin={true}
              roleFilter={roleFilter}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLimitPanel && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
          >
            <AdminPanel
              currentDate={currentDate}
              onClose={handleCloseLimitPanel}
              onUpdateSuccess={async () => {
                await fetchMonthData();
                handleCloseLimitPanel();
              }} 
              vacationLimits={vacationLimits}
              onLimitSet={handleLimitSet}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification.show && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-xl text-white text-sm font-semibold 
              ${notification.type === 'success' ? 'bg-green-500' : notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}
            `}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
} 