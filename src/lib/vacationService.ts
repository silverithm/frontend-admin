import { VacationRequest, VacationLimit, VacationDuration } from '@/types/vacation';
import { format } from 'date-fns';
import { getVacationCalendar, getVacationForDate, getVacationLimits as apiGetVacationLimits, getAllVacationRequests } from './apiService';

// 특정 월의 휴가 신청 데이터 가져오기
export async function getVacationsForMonth(year: number, month: number) {
  try {
    console.log(`getVacationsForMonth 호출: ${year}년 ${month}월`);
    
    // 월의 시작일과 마지막 일을 계산
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // 해당 월의 마지막 날
    
    const response = await getVacationCalendar(startDate, endDate);
    
    // 응답에서 휴가 데이터 추출
    const vacations: VacationRequest[] = [];
    
    if (response.dates) {
      Object.values(response.dates).forEach((dateData: any) => {
        if (dateData.vacations && Array.isArray(dateData.vacations)) {
          vacations.push(...dateData.vacations.map((vacation: any) => ({
            id: vacation.id?.toString(),
            userName: vacation.userName,
            date: vacation.date,
            status: vacation.status,
            role: vacation.role,
            reason: vacation.reason || '(사유 미입력)',
            userId: vacation.userId,
            type: vacation.type || 'regular',
            duration: vacation.duration || 'FULL_DAY',
            createdAt: vacation.createdAt,
            updatedAt: vacation.updatedAt
          })));
        }
      });
    }
    
    console.log(`${year}년 ${month}월 휴가 데이터 ${vacations.length}건 로드 완료`);
    return vacations;
  } catch (error) {
    console.error('월별 휴가 데이터 조회 중 오류:', error);
    throw error;
  }
}

// 날짜 범위별 휴가 신청 데이터 가져오기
export async function getVacationRequestsForDateRange(startDate: string, endDate: string) {
  try {
    console.log(`날짜 범위별 휴가 데이터 조회: ${startDate} ~ ${endDate}`);
    
    const response = await getVacationCalendar(startDate, endDate);
    
    const vacations: VacationRequest[] = [];
    
    if (response.dates) {
      Object.values(response.dates).forEach((dateData: any) => {
        if (dateData.vacations && Array.isArray(dateData.vacations)) {
          vacations.push(...dateData.vacations.map((vacation: any) => ({
            id: vacation.id?.toString(),
            userName: vacation.userName,
            date: vacation.date,
            status: vacation.status,
            role: vacation.role,
            reason: vacation.reason || '(사유 미입력)',
            userId: vacation.userId,
            type: vacation.type || 'regular',
            duration: vacation.duration || 'FULL_DAY',
            createdAt: vacation.createdAt,
            updatedAt: vacation.updatedAt
          })));
        }
      });
    }
    
    console.log(`날짜 범위 휴가 데이터 ${vacations.length}건 로드 완료`);
    return vacations;
  } catch (error) {
    console.error('날짜 범위별 휴가 데이터 조회 중 오류:', error);
    throw error;
  }
}

// 특정 날짜의 휴가 신청 데이터 가져오기
export async function getVacationsForDate(date: Date) {
  try {
    const formattedDate = format(date, 'yyyy-MM-dd');
    console.log(`특정 날짜 휴가 데이터 조회: ${formattedDate}`);
    
    const response = await getVacationForDate(formattedDate, 'all');
    
    console.log('백엔드 응답 데이터:', response);
    console.log('백엔드 응답의 vacations:', response.vacations);
    
    const vacations: VacationRequest[] = response.vacations?.map((vacation: any) => ({
      id: vacation.id?.toString(),
      userName: vacation.userName,
      date: vacation.date,
      status: vacation.status,
      role: vacation.role,
      reason: vacation.reason || '(사유 미입력)',
      userId: vacation.userId,
      type: vacation.type || 'regular',
      duration: vacation.duration || 'FULL_DAY',
      createdAt: vacation.createdAt,
      updatedAt: vacation.updatedAt
    })) || [];
    
    console.log(`${formattedDate} 휴가 데이터 ${vacations.length}건 로드 완료`);
    console.log('변환된 휴가 데이터:', vacations);
    
    return vacations;
  } catch (error) {
    console.error('특정 날짜 휴가 데이터 조회 중 오류:', error);
    throw error;
  }
}

// 특정 월의 휴가 제한 데이터 가져오기
export async function getVacationLimitsForMonth(year: number, month: number) {
  try {
    console.log(`휴가 제한 데이터 조회: ${year}년 ${month}월`);
    
    // 월의 시작일과 마지막 일을 계산
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // 해당 월의 마지막 날
    
    const response = await apiGetVacationLimits(startDate, endDate);
    
    const limits: VacationLimit[] = response.limits?.map((limit: any) => ({
      id: limit.id?.toString(),
      date: limit.date,
      maxPeople: limit.maxPeople,
      role: limit.role
    })) || [];
    
    console.log(`${year}년 ${month}월 휴가 제한 데이터 ${limits.length}건 로드 완료`);
    return limits;
  } catch (error) {
    console.error('월별 휴가 제한 데이터 조회 중 오류:', error);
    throw error;
  }
}

// 날짜 범위별 휴가 제한 데이터 가져오기
export async function getVacationLimitsForMonthRange(startDate: string, endDate: string) {
  try {
    console.log(`날짜 범위별 휴가 제한 데이터 조회: ${startDate} ~ ${endDate}`);
    
    const response = await apiGetVacationLimits(startDate, endDate);
    
    const limits: VacationLimit[] = response.limits?.map((limit: any) => ({
      id: limit.id?.toString(),
      date: limit.date,
      maxPeople: limit.maxPeople,
      role: limit.role
    })) || [];
    
    console.log(`날짜 범위 휴가 제한 데이터 ${limits.length}건 로드 완료`);
    return limits;
  } catch (error) {
    console.error('날짜 범위별 휴가 제한 데이터 조회 중 오류:', error);
    throw error;
  }
}

// 특정 날짜와 역할의 휴가 제한 정보 가져오기
export async function getVacationLimitForDate(date: Date, role: 'caregiver' | 'office') {
  try {
    const formattedDate = format(date, 'yyyy-MM-dd');
    console.log(`특정 날짜 휴가 제한 조회: ${formattedDate}, 역할: ${role}`);
    
    const response = await getVacationForDate(formattedDate, role);
    
    if (response.maxPeople !== undefined) {
      return {
        id: '', // 백엔드에서 제공하지 않는 경우 빈 문자열
        date: formattedDate,
        maxPeople: response.maxPeople,
        role: role
      };
    }
    
    // 기본값 반환
    return {
      id: '',
      date: formattedDate,
      maxPeople: 3,
      role: role
    };
  } catch (error) {
    console.error('특정 날짜 휴가 제한 조회 중 오류:', error);
    // 오류 발생 시 기본값 반환
    return {
      id: '',
      date: format(date, 'yyyy-MM-dd'),
      maxPeople: 3,
      role: role
    };
  }
}

// 휴가 제한 설정
export async function setVacationLimit(date: Date, maxPeople: number, role: 'caregiver' | 'office') {
  try {
    const formattedDate = format(date, 'yyyy-MM-dd');
    console.log(`휴가 제한 설정: ${formattedDate}, 최대인원: ${maxPeople}, 역할: ${role}`);
    
    const limits = [{
      date: formattedDate,
      maxPeople,
      role
    }];
    
    const response = await import('./apiService').then(api => api.saveVacationLimits(limits));
    
    console.log('휴가 제한 설정 완료');
    return response;
  } catch (error) {
    console.error('휴가 제한 설정 중 오류:', error);
    throw error;
  }
}

// 모든 휴가 요청 데이터 가져오기
export async function getAllVacationRequestsData() {
  try {
    console.log('모든 휴가 요청 데이터 조회');
    
    const response = await getAllVacationRequests();
    
    const vacations: VacationRequest[] = response.requests?.map((vacation: any) => ({
      id: vacation.id?.toString(),
      userName: vacation.userName,
      date: vacation.date,
      status: vacation.status,
      role: vacation.role,
      reason: vacation.reason || '(사유 미입력)',
      userId: vacation.userId,
      type: vacation.type || 'regular',
      duration: vacation.duration || 'FULL_DAY',
      createdAt: vacation.createdAt,
      updatedAt: vacation.updatedAt
    })) || [];
    
    console.log(`모든 휴가 요청 데이터 ${vacations.length}건 로드 완료`);
    return vacations;
  } catch (error) {
    console.error('모든 휴가 요청 데이터 조회 중 오류:', error);
    throw error;
  }
}

// 휴가 제한 정보 가져오기 (날짜 범위)
export async function getVacationLimits(startDate: Date, endDate: Date) {
  try {
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    console.log(`휴가 제한 정보 조회: ${startDateStr} ~ ${endDateStr}`);
    
    const response = await apiGetVacationLimits(startDateStr, endDateStr);
    
    const limits: VacationLimit[] = response.limits?.map((limit: any) => ({
      id: limit.id?.toString(),
      date: limit.date,
      maxPeople: limit.maxPeople,
      role: limit.role
    })) || [];
    
    console.log(`휴가 제한 정보 ${limits.length}건 로드 완료`);
    return limits;
  } catch (error) {
    console.error('휴가 제한 정보 조회 중 오류:', error);
    throw error;
  }
}

