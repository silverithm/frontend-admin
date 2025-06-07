// apiService.ts - Spring Boot 백엔드 API 호출을 위한 서비스

import { VacationRequest, VacationLimit } from '@/types/vacation';
import { SigninResponseDTO, TokenInfo, UserDataDTO, FindPasswordResponse, PasswordChangeRequest, UserRole } from '@/types/auth';

// API 기본 URL (환경에 따라 변경될 수 있음)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// JWT 토큰이 필요하지 않은 공통 fetch 함수 (로그인용)
async function fetchWithoutAuth(url: string, options: RequestInit = {}) {
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

// JWT 토큰이 포함된 공통 fetch 함수
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // 로컬 스토리지에서 JWT 토큰 가져오기
  const token = localStorage.getItem('authToken');
  
  // 기본 헤더 설정
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };
  
  // JWT 토큰이 있으면 Authorization 헤더 추가
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // fetch 요청 실행
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });
  
  // 인증 오류 처리 (401 Unauthorized)
  if (response.status === 401) {
    // 토큰 삭제 및 로그인 페이지로 리다이렉트
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
  }
  
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

// 멤버 로그인 (기존 - 호환성을 위해 유지)
export async function login(email: string, password: string) {
  const response = await fetchWithoutAuth('/api/v1/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  
  // 로그인 성공 시 JWT 토큰과 사용자 정보 저장
  if (response.success && response.data) {
    // JWT 토큰 저장 (백엔드에서 token 필드로 반환한다고 가정)
    if (response.token || response.data.token) {
      localStorage.setItem('authToken', response.token || response.data.token);
    }
    
    // 사용자 정보 저장
    localStorage.setItem('userName', response.data.name || '');
    localStorage.setItem('userRole', response.data.role || '');
    localStorage.setItem('userId', response.data.id?.toString() || '');
  }
  
  return response;
}

// ================== 새로운 사용자 인증 API ==================

// 사용자 로그인 (새로운 API)
export async function signin(email: string, password: string): Promise<SigninResponseDTO> {
  try {
    console.log('로그인 시도:', { email });
    
    const response = await fetch(`${API_BASE_URL}/api/v1/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    console.log('백엔드 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('백엔드 오류 응답:', errorText);
      throw new Error(`로그인 실패: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('로그인 응답 데이터:', data);
    
    // 로그인 성공 시 JWT 토큰과 사용자 정보 저장
    if (data && data.tokenInfo) {
      // JWT 토큰 저장
      localStorage.setItem('authToken', data.tokenInfo.accessToken);
      localStorage.setItem('refreshToken', data.tokenInfo.refreshToken);
      localStorage.setItem('tokenExpirationTime', data.tokenInfo.accessTokenExpirationTime?.toString() || '');
      
      // 사용자 정보 저장
      localStorage.setItem('userName', data.userName || '');
      localStorage.setItem('userId', data.userId?.toString() || '');
      localStorage.setItem('companyName', data.companyName || '');
      localStorage.setItem('companyAddressName', data.companyAddressName || '');
      localStorage.setItem('customerKey', data.customerKey || '');
      
      console.log('로그인 정보 저장 완료');
    } else {
      console.warn('토큰 정보가 없는 응답:', data);
    }
    
    return data;
  } catch (error) {
    console.error('signin 함수 오류:', error);
    throw error;
  }
}

// 사용자 회원가입
export async function signup(userData: {
  name: string;
  email: string;
  password: string;
  role: string;
  companyName: string;
  companyAddress: string;
}): Promise<TokenInfo> {
  const response = await fetchWithoutAuth('/api/v1/signup', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  
  // 회원가입 성공 시 JWT 토큰 저장 (자동 로그인)
  if (response && response.accessToken) {
    localStorage.setItem('authToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('tokenExpirationTime', response.accessTokenExpirationTime?.toString() || '');
  }
  
  return response;
}

// 비밀번호 찾기
export async function findPassword(email: string): Promise<FindPasswordResponse> {
  return fetchWithoutAuth(`/api/v1/find/password?email=${encodeURIComponent(email)}`, {
    method: 'POST',
  });
}

// 비밀번호 변경
export async function changePassword(passwordData: PasswordChangeRequest): Promise<string> {
  return fetchWithAuth('/api/v1/change/password', {
    method: 'POST',
    body: JSON.stringify(passwordData),
  });
}

// 호환성을 위한 register 함수 (기존 페이지용)
export async function register(userData: {
  name: string;
  email: string;
  password: string;
  role: string;
  phone?: string;
  organization?: string;
}): Promise<TokenInfo> {
  return signup({
    name: userData.name,
    email: userData.email,
    password: userData.password,
    role: userData.role,
    companyName: userData.organization || '',
    companyAddress: ''
  });
}

// 로그아웃 (업데이트)
export async function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('tokenExpirationTime');
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userId');
  localStorage.removeItem('companyName');
  localStorage.removeItem('companyAddressName');
  localStorage.removeItem('customerKey');
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

// 회원가입 요청 (JWT 토큰 없이 요청)
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
  return fetchWithoutAuth('/api/v1/members/join-request', {
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

// ================== 기관 정보 관련 API ==================

// 기관 프로필 조회
export async function getOrganizationProfile() {
  return fetchWithAuth('/api/v1/company/profile');
}

// 기관 프로필 업데이트
export async function updateOrganizationProfile(profileData: {
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
}) {
  return fetchWithAuth('/api/v1/company/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
} 