// apiService.ts - Spring Boot 백엔드 API 호출을 위한 서비스

import { VacationRequest, VacationLimit } from '@/types/vacation';

// API 기본 URL (환경에 따라 변경될 수 있음)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// 공통 fetch 함수 (인증 헤더 등 추가)
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // 로컬 스토리지에서 토큰 가져오기
  const token = localStorage.getItem('authToken');
  
  // 기본 헤더 설정
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };
  
  // 토큰이 있으면 Authorization 헤더 추가
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
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
  }
  
  // 응답이 OK가 아닌 경우 에러 처리
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `API 오류: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// 인증 관련 함수들
export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || '로그인에 실패했습니다.');
  }
  
  const data = await response.json();
  
  // 토큰 및 사용자 정보를 로컬 스토리지에 저장
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    // 사용자 정보도 저장 (필요에 따라 선택적으로 저장)
    localStorage.setItem('userName', data.name || '');
    localStorage.setItem('userEmail', data.email || '');
    localStorage.setItem('userRole', data.role || '');
    localStorage.setItem('organizationName', data.organizationName || ''); // 회사 이름 저장
  }
  
  return data;
}

export async function register(userData: {
  name: string;
  email: string;
  password: string;
  role: string;
  phone: string;
  organization: string;
}) {
  return fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  }).then(response => {
    if (!response.ok) {
      return response.json().then(errorData => {
        throw new Error(errorData.message || '회원가입에 실패했습니다.');
      });
    }
    return response.json();
  });
}

export async function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userRole');
  localStorage.removeItem('organizationName'); // 로그아웃 시 회사 이름도 삭제
}

// 휴무 관련 API 함수들
export async function getVacationsForMonth(year: number, month: number) {
  return fetchWithAuth(`/vacations/month?year=${year}&month=${month}`);
}

export async function getVacationLimitsForMonth(year: number, month: number) {
  return fetchWithAuth(`/vacations/limits/month?year=${year}&month=${month}`);
}

export async function getVacationsForDate(date: string) {
  return fetchWithAuth(`/vacations/date/${date}`);
}

export async function getVacationLimitForDate(date: string, role: string) {
  return fetchWithAuth(`/vacations/limits/date?date=${date}&role=${role}`);
}

export async function createVacationRequest(vacationData: Omit<VacationRequest, 'id' | 'status' | 'createdAt'>) {
  return fetchWithAuth('/vacations', {
    method: 'POST',
    body: JSON.stringify(vacationData),
  });
}

export async function updateVacationStatus(id: string, status: 'pending' | 'approved' | 'rejected') {
  return fetchWithAuth(`/vacations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteVacation(id: string) {
  return fetchWithAuth(`/vacations/${id}`, {
    method: 'DELETE',
  });
}

export async function setVacationLimit(date: Date, maxPeople: number, role: 'caregiver' | 'office') {
  const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD 형식
  
  return fetchWithAuth('/vacations/limits', {
    method: 'POST',
    body: JSON.stringify({
      date: formattedDate,
      maxPeople,
      role,
    }),
  });
}

export async function getAllVacationRequests() {
  return fetchWithAuth('/vacations/all');
}

// 회사(조직) 정보 관련 API 함수들
export async function getOrganizationProfile() {
  return fetchWithAuth('/organization/profile');
}

export async function updateOrganizationProfile(profileData: any) { // 타입은 실제 데이터 구조에 맞게 정의
  return fetchWithAuth('/organization/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
}

// 직원(사용자) 가입 승인 관련 API 함수들
export interface PendingUser {
  id: string;
  name: string;
  email: string;
  role: string; // 요청된 역할
  requestedAt: string; // 가입 요청 시간
  // 기타 필요한 정보
}

export async function getPendingUsers(): Promise<PendingUser[]> {
  return fetchWithAuth('/admin/pending-users');
}

export async function approveUser(userId: string) {
  return fetchWithAuth(`/admin/users/${userId}/approve`, {
    method: 'POST',
  });
}

export async function rejectUser(userId: string) {
  return fetchWithAuth(`/admin/users/${userId}/reject`, {
    method: 'POST',
  });
}

// 회원 관리 관련 API 함수들
export async function getAllUsers() {
  return fetchWithAuth('/admin/users');
}

export async function getMemberUsers() {
  return fetchWithAuth('/admin/users/members');
}

export async function deleteUser(userId: string) {
  return fetchWithAuth(`/admin/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function updateUserStatus(userId: string, status: 'active' | 'inactive') {
  return fetchWithAuth(`/admin/users/${userId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function updateUserRole(userId: string, role: 'caregiver' | 'office' | 'admin') {
  return fetchWithAuth(`/admin/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

// 사용자 관련 API 함수들
export async function getUserById(id: string) {
  return fetchWithAuth(`/users/${id}`);
}

export async function deactivateUser(id: string) {
  return fetchWithAuth(`/users/${id}/deactivate`, {
    method: 'PATCH',
  });
} 