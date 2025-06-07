// apiService.ts - Spring Boot 백엔드 API 호출을 위한 서비스

import { VacationRequest, VacationLimit } from '@/types/vacation';

// API 기본 URL (환경에 따라 변경될 수 있음)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// 공통 fetch 함수
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // 기본 헤더 설정
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };
  
  // fetch 요청 실행
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });
  
  // 응답이 OK가 아닌 경우 에러 처리
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || errorData?.message || `API 오류: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ================== 휴가 관련 API ==================

// 휴가 캘린더 데이터 조회
export async function getVacationCalendar(startDate: string, endDate: string, roleFilter = 'all', nameFilter?: string) {
  let url = `/api/vacation/calendar?startDate=${startDate}&endDate=${endDate}&roleFilter=${roleFilter}`;
  if (nameFilter) {
    url += `&nameFilter=${encodeURIComponent(nameFilter)}`;
  }
  return fetchWithAuth(url);
}

// 특정 날짜 휴가 데이터 조회
export async function getVacationForDate(date: string, role = 'caregiver', nameFilter?: string) {
  let url = `/api/vacation/date/${date}?role=${role}`;
  if (nameFilter) {
    url += `&nameFilter=${encodeURIComponent(nameFilter)}`;
  }
  return fetchWithAuth(url);
}

// 휴가 신청 생성
export async function createVacationRequest(vacationData: {
  userName: string;
  date: string;
  role: string;
  reason: string;
  userId: string;
  type: string;
}) {
  return fetchWithAuth('/api/vacation/submit', {
    method: 'POST',
    body: JSON.stringify(vacationData),
  });
}

// 휴가 승인
export async function approveVacation(id: string) {
  return fetchWithAuth(`/api/vacation/approve/${id}`, {
    method: 'PUT',
  });
}

// 휴가 거부
export async function rejectVacation(id: string) {
  return fetchWithAuth(`/api/vacation/reject/${id}`, {
    method: 'PUT',
  });
}

// 휴가 삭제
export async function deleteVacation(id: string, deleteData: { isAdmin: boolean; password?: string }) {
  return fetchWithAuth(`/api/vacation/delete/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(deleteData),
  });
}

// 모든 휴가 요청 조회
export async function getAllVacationRequests() {
  return fetchWithAuth('/api/vacation/requests');
}

// 휴가 제한 조회
export async function getVacationLimits(startDate: string, endDate: string) {
  return fetchWithAuth(`/api/vacation/limits?start=${startDate}&end=${endDate}`);
}

// 휴가 제한 저장
export async function saveVacationLimits(limits: Array<{
  date: string;
  maxPeople: number;
  role: string;
}>) {
  return fetchWithAuth('/api/vacation/limits', {
    method: 'POST',
    body: JSON.stringify({ limits }),
  });
}

// ================== 멤버 관련 API ==================

// 멤버 로그인
export async function login(username: string, password: string) {
  const response = await fetchWithAuth('/api/v1/members/signin', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  
  // 로그인 성공 시 필요한 정보 저장
  if (response.success && response.data) {
    localStorage.setItem('userName', response.data.name || '');
    localStorage.setItem('userRole', response.data.role || '');
    localStorage.setItem('userId', response.data.id?.toString() || '');
  }
  
  return response;
}

// 로그아웃
export async function logout() {
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userId');
}

// FCM 토큰 업데이트
export async function updateFcmToken(memberId: string, fcmToken: string) {
  return fetchWithAuth(`/api/v1/members/${memberId}/fcm-token`, {
    method: 'PUT',
    body: JSON.stringify({ fcmToken }),
  });
}

// 회사 목록 조회
export async function getAllCompanies() {
  return fetchWithAuth('/api/v1/members/companies');
}

// 회원가입 요청
export async function submitJoinRequest(requestData: {
  username: string;
  password: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
  department?: string;
  position?: string;
  companyId: number;
}) {
  return fetchWithAuth('/api/v1/members/join-request', {
    method: 'POST',
    body: JSON.stringify(requestData),
  });
}

// 모든 가입 요청 조회
export async function getAllJoinRequests() {
  return fetchWithAuth('/api/v1/members/join-requests');
}

// 대기중인 가입 요청 조회
export async function getPendingJoinRequests() {
  return fetchWithAuth('/api/v1/members/join-requests/pending');
}

// 가입 요청 승인
export async function approveJoinRequest(requestId: string, adminId: string) {
  return fetchWithAuth(`/api/v1/members/join-requests/${requestId}/approve?adminId=${adminId}`, {
    method: 'PUT',
  });
}

// 가입 요청 거부
export async function rejectJoinRequest(requestId: string, adminId: string, rejectReason: string) {
  return fetchWithAuth(`/api/v1/members/join-requests/${requestId}/reject?adminId=${adminId}`, {
    method: 'PUT',
    body: JSON.stringify({ rejectReason }),
  });
}

// 회원 목록 조회
export async function getAllMembers() {
  return fetchWithAuth('/api/v1/members');
}

// 역할별 회원 조회
export async function getMembersByRole(role: string) {
  return fetchWithAuth(`/api/v1/members?role=${role}`);
}

// 상태별 회원 조회
export async function getMembersByStatus(status: string) {
  return fetchWithAuth(`/api/v1/members?status=${status}`);
}

// 특정 회원 조회
export async function getMemberById(id: string) {
  return fetchWithAuth(`/api/v1/members/${id}`);
}

// 회원 정보 수정
export async function updateMember(id: string, updateData: {
  name?: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
  department?: string;
  position?: string;
  status?: string;
}) {
  return fetchWithAuth(`/api/v1/members/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
}

// 회원 삭제
export async function deleteMember(id: string) {
  return fetchWithAuth(`/api/v1/members/${id}`, {
    method: 'DELETE',
  });
}

// ================== 호환성을 위한 기존 함수들 ==================

// 기존 코드와의 호환성을 위해 유지
export async function getVacationsForMonth(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // 해당 월의 마지막 날
  return getVacationCalendar(startDate, endDate);
}

export async function getVacationLimitsForMonth(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // 해당 월의 마지막 날
  return getVacationLimits(startDate, endDate);
}

export async function getVacationsForDate(date: string) {
  return getVacationForDate(date);
}

export async function getVacationLimitForDate(date: string, role: string) {
  return getVacationForDate(date, role);
}

export async function updateVacationStatus(id: string, status: 'pending' | 'approved' | 'rejected') {
  if (status === 'approved') {
    return approveVacation(id);
  } else if (status === 'rejected') {
    return rejectVacation(id);
  }
  throw new Error('지원하지 않는 상태입니다.');
}

export async function setVacationLimit(date: Date, maxPeople: number, role: 'caregiver' | 'office') {
  const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD 형식
  return saveVacationLimits([{
    date: formattedDate,
    maxPeople,
    role,
  }]);
}

// PendingUser 인터페이스 (호환성을 위해 유지)
export interface PendingUser {
  id: string;
  name: string;
  email: string;
  role: string;
  requestedAt: string;
}

// 기존 함수명과의 호환성
export async function getPendingUsers(): Promise<PendingUser[]> {
  const response = await getPendingJoinRequests();
  return response.requests?.map((req: any) => ({
    id: req.id?.toString(),
    name: req.name,
    email: req.email,
    role: req.requestedRole,
    requestedAt: req.createdAt,
  })) || [];
}

export async function approveUser(userId: string) {
  const adminId = localStorage.getItem('userId') || '1'; // 관리자 ID
  return approveJoinRequest(userId, adminId);
}

export async function rejectUser(userId: string, reason = '승인 기준에 부합하지 않음') {
  const adminId = localStorage.getItem('userId') || '1'; // 관리자 ID
  return rejectJoinRequest(userId, adminId, reason);
}

export async function getAllUsers() {
  return getAllMembers();
}

export async function getMemberUsers() {
  return getMembersByRole('caregiver');
}

export async function deleteUser(userId: string) {
  return deleteMember(userId);
}

export async function updateUserStatus(userId: string, status: 'active' | 'inactive') {
  return updateMember(userId, { status });
}

export async function updateUserRole(userId: string, role: 'caregiver' | 'office' | 'admin') {
  return updateMember(userId, { role });
}

export async function getUserById(id: string) {
  return getMemberById(id);
}

export async function deactivateUser(id: string) {
  return updateUserStatus(id, 'inactive');
} 