// apiService.ts - Spring Boot 백엔드 API 호출을 위한 서비스

import { VacationRequest, VacationLimit } from '@/types/vacation';
import { SigninResponseDTO, TokenInfo, UserDataDTO, FindPasswordResponse, PasswordChangeRequest, UserRole } from '@/types/auth';

// API 기본 URL (환경에 따라 변경될 수 있음)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://69af-211-177-230-196.ngrok-free.app';

console.log('[API Service] 사용 중인 API_BASE_URL:', API_BASE_URL);

// 토큰 갱신 중복 방지를 위한 플래그
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

// 큐에 있는 모든 요청 처리
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  
  failedQueue = [];
};

// CompanyId 가져오기 헬퍼 함수
function getCompanyId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('companyId') || '';
  }
  return '';
}

// Refresh Token API 호출
async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    throw new Error('Refresh token이 없습니다.');
  }

  try {
    console.log('[Token Refresh] Refresh token 요청 시작');
    
    const response = await fetch(`${API_BASE_URL}/api/v1/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Refresh token 갱신 실패: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Token Refresh] 백엔드 응답:', data);
    
    // 백엔드에서 TokenInfo 객체를 직접 반환
    if (data && data.accessToken) {
      // 새로운 토큰들 저장
      localStorage.setItem('authToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('tokenExpirationTime', data.accessTokenExpirationTime?.toString() || '');
      
      console.log('[Token Refresh] 새로운 토큰 저장 완료');
      return data.accessToken;
    } else {
      console.error('[Token Refresh] 응답 구조 오류:', data);
      throw new Error('응답에 새로운 토큰이 없습니다.');
    }
  } catch (error) {
    console.error('[Token Refresh] 실패:', error);
    throw error;
  }
}

// 로그아웃 및 리다이렉트 처리
const handleLogout = () => {
  console.log('[Auth] 토큰 갱신 실패 - 로그아웃 처리');
  
  // 모든 토큰 및 사용자 정보 삭제
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('tokenExpirationTime');
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userId');
  localStorage.removeItem('companyId');
  localStorage.removeItem('companyName');
  localStorage.removeItem('companyAddressName');
  localStorage.removeItem('customerKey');
  localStorage.removeItem('organizationName');
  
  // 로그인 페이지로 리다이렉트
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

// JWT 토큰이 필요하지 않은 공통 fetch 함수 (로그인용)
async function fetchWithoutAuth(url: string, options: RequestInit = {}) {
  // 기본 헤더 설정
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // ngrok 브라우저 경고 우회
    ...options.headers as Record<string, string>,
  };
  
  // fetch 요청 실행
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });
  
  // 응답이 OK가 아닌 경우 에러 처리
  if (!response.ok) {
    // HTML 응답인지 확인
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      const htmlText = await response.text();
      console.error(`[API Error] HTML 응답 받음:`, htmlText.substring(0, 200));
      throw new Error(`서버에서 HTML 페이지를 반환했습니다. API 엔드포인트를 확인해주세요. (${response.status})`);
    }
    
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || errorData?.message || `API 오류: ${response.status} ${response.statusText}`);
  }
  
  // JSON 응답인지 확인
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/html')) {
    const htmlText = await response.text();
    console.error(`[API Error] 성공 응답이지만 HTML 받음:`, htmlText.substring(0, 200));
    throw new Error('서버에서 JSON 대신 HTML을 반환했습니다. ngrok 설정을 확인해주세요.');
  }
  
  return response.json();
}

// JWT 토큰이 포함된 공통 fetch 함수 (토큰 갱신 로직 포함)
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
  // 로컬 스토리지에서 JWT 토큰 가져오기
  let token = localStorage.getItem('authToken');
  
  // 기본 헤더 설정
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };
  
  // JWT 토큰이 있으면 Authorization 헤더 추가
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Next.js API 라우트를 통한 프록시 방식
  const fullUrl = url.startsWith('/api') ? url : `/api${url}`;
  
  console.log(`[API Request] ${options.method || 'GET'} ${fullUrl}`);
  console.log(`[API Mode] Using Next.js proxy`);

  try {
    // fetch 요청 실행
    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });

    // 401 Unauthorized - JWT 토큰 만료 또는 무효
    if (response.status === 401) {
      console.log('[API Auth] 401 응답 - 토큰 갱신 시도');
      
      try {
        // 토큰 갱신 시도
        const newToken = await refreshAccessToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        
        console.log('[API Auth] 토큰 갱신 성공 - 요청 재시도');
        
        // 갱신된 토큰으로 요청 재시도
        const retryResponse = await fetch(fullUrl, {
          ...options,
          headers,
        });
        
        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => null);
          throw new Error(errorData?.error || errorData?.message || `API 오류: ${retryResponse.status} ${retryResponse.statusText}`);
        }
        
        const result = await retryResponse.json();
        console.log(`[API Success] ${options.method || 'GET'} ${url} - 재시도 성공`);
        return result;
        
      } catch (refreshError) {
        console.error('[API Auth] 토큰 갱신 실패:', refreshError);
        handleLogout();
        throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
      }
    }

    // 응답이 OK가 아닌 경우 에러 처리
    if (!response.ok) {
      // HTML 응답인지 확인
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const htmlText = await response.text();
        console.error(`[API Error] HTML 응답 받음:`, htmlText.substring(0, 200));
        throw new Error(`서버에서 HTML 페이지를 반환했습니다. API 엔드포인트를 확인해주세요. (${response.status})`);
      }
      
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || errorData?.message || `API 오류: ${response.status} ${response.statusText}`);
    }

    // JSON 응답인지 확인
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      const htmlText = await response.text();
      console.error(`[API Error] 성공 응답이지만 HTML 받음:`, htmlText.substring(0, 200));
      throw new Error('서버에서 JSON 대신 HTML을 반환했습니다. ngrok 설정을 확인해주세요.');
    }
    
    const result = await response.json();
    console.log(`[API Success] ${options.method || 'GET'} ${url} - 응답 완료`);
    return result;
  } catch (error) {
    console.error(`[API Error] ${options.method || 'GET'} ${fullUrl}:`, error);
    
    // JSON 파싱 오류 처리
    if (error instanceof SyntaxError && error.message.includes('Unexpected token')) {
      console.error('[JSON Parse Error] 서버에서 HTML 응답을 받았습니다. API 라우트 설정 확인이 필요합니다.');
      throw new Error('서버 응답이 올바르지 않습니다. API 라우트 설정을 확인해주세요.');
    }
    
    // 네트워크 오류 등 fetch 자체가 실패한 경우
    if (error instanceof TypeError) {
      console.error('[Network Error] Details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        url: fullUrl
      });
      
      if (error.message.includes('fetch') || error.message.includes('CORS')) {
        throw new Error(`네트워크 오류가 발생했습니다. API 라우트 설정을 확인해주세요.`);
      }
      
      throw new Error(`네트워크 오류: ${error.message}`);
    }
    
    // 다른 오류는 그대로 전파
    throw error;
  }
}

// ================== 휴가 관련 API ==================

// 휴가 캘린더 데이터 조회 (companyId 추가)
export async function getVacationCalendar(startDate: string, endDate: string, roleFilter = 'all', nameFilter?: string) {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }
  
  let url = `/api/vacation/calendar?startDate=${startDate}&endDate=${endDate}&roleFilter=${roleFilter}&companyId=${companyId}`;
  if (nameFilter) {
    url += `&nameFilter=${encodeURIComponent(nameFilter)}`;
  }
  return fetchWithAuth(url);
}

// 특정 날짜 휴가 데이터 조회 (companyId 추가)
export async function getVacationForDate(date: string, role = 'caregiver', nameFilter?: string) {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }
  
  let url = `/api/vacation/date/${date}?role=${role}&companyId=${companyId}`;
  if (nameFilter) {
    url += `&nameFilter=${encodeURIComponent(nameFilter)}`;
  }
  return fetchWithAuth(url);
}

// 휴가 신청 생성 (companyId 추가)
export async function createVacationRequest(vacationData: {
  userName: string;
  date: string;
  role: string;
  reason: string;
  userId: string;
  type: string;
  duration: string;
}) {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }
  
  return fetchWithAuth(`/api/vacation/submit?companyId=${companyId}`, {
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

// 모든 휴가 요청 조회 (companyId 추가)
export async function getAllVacationRequests() {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }
  
  return fetchWithAuth(`/api/vacation/requests?companyId=${companyId}`);
}

// 휴가 제한 조회 (companyId 추가)
export async function getVacationLimits(startDate: string, endDate: string) {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }
  
  return fetchWithAuth(`/api/vacation/limits?start=${startDate}&end=${endDate}&companyId=${companyId}`);
}

// 휴가 제한 저장 (companyId 추가)
export async function saveVacationLimits(limits: Array<{
  date: string;
  maxPeople: number;
  role: string;
}>) {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }
  
  console.log('[saveVacationLimits] 휴가 제한 저장 시작:', { limits, companyId });
  
  const result = await fetchWithAuth(`/api/vacation/limits?companyId=${companyId}`, {
    method: 'POST',
    body: JSON.stringify({ limits }),
  });
  
  console.log('[saveVacationLimits] 휴가 제한 저장 완료:', result);
  return result;
}

// ================== 멤버 관련 API ==================

// 멤버 로그인 (기존 - 호환성을 위해 유지)
export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true', // ngrok 브라우저 경고 우회
    },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `로그인 실패: ${response.status} ${response.statusText}`);
  }
  
  const responseData = await response.json();
  
  // 로그인 성공 시 JWT 토큰과 사용자 정보 저장
  if (responseData.success && responseData.data) {
    // JWT 토큰 저장 (백엔드에서 token 필드로 반환한다고 가정)
    if (responseData.token || responseData.data.token) {
      localStorage.setItem('authToken', responseData.token || responseData.data.token);
    }
    
    // 사용자 정보 저장
    localStorage.setItem('userName', responseData.data.name || '');
    localStorage.setItem('userRole', responseData.data.role || '');
    localStorage.setItem('userId', responseData.data.id?.toString() || '');
  }
  
  return responseData;
}

// ================== 새로운 사용자 인증 API ==================

// 사용자 로그인 (새로운 API)
export async function signin(email: string, password: string): Promise<SigninResponseDTO> {
  try {
    console.log('로그인 시도:', { email });
    
    // 직접 백엔드 ngrok URL로 요청
    const response = await fetch(`${API_BASE_URL}/api/v1/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true', // ngrok 브라우저 경고 우회
      },
      body: JSON.stringify({ email, password }),
    });

    console.log('백엔드 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('백엔드 오류 응답:', errorData);
      throw new Error(errorData?.error || `로그인 실패: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('로그인 응답 데이터:', data);
    
    // 로그인 성공 시 JWT 토큰과 사용자 정보 저장
    if (data && data.tokenInfo) {
      // JWT 토큰 저장
      localStorage.setItem('authToken', data.tokenInfo.accessToken);
      localStorage.setItem('refreshToken', data.tokenInfo.refreshToken);
      localStorage.setItem('tokenExpirationTime', data.tokenInfo.accessTokenExpirationTime?.toString() || '');
      
      // companyId 필수 검증
      if (!data.companyId) {
        console.error('백엔드 응답에 companyId가 없습니다:', data);
        throw new Error('로그인 응답에 회사 ID가 포함되어 있지 않습니다. 관리자에게 문의하세요.');
      }
      
      // 사용자 정보 저장
      localStorage.setItem('userName', data.userName || '');
      localStorage.setItem('userId', data.userId?.toString() || '');
      localStorage.setItem('companyName', data.companyName || '');
      localStorage.setItem('companyAddressName', data.companyAddressName || '');
      localStorage.setItem('customerKey', data.customerKey || '');
      
      // companyId 저장 (필수값)
      localStorage.setItem('companyId', data.companyId.toString());
      
      console.log('로그인 정보 저장 완료, companyId:', data.companyId);
    } else {
      console.warn('토큰 정보가 없는 응답:', data);
      throw new Error('로그인 응답에 토큰 정보가 없습니다.');
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
  try {
    // 서버에 로그아웃 요청 (선택사항)
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      await fetchWithoutAuth('/api/v1/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {
        // 로그아웃 API 실패해도 클라이언트 정리는 계속 진행
        console.warn('서버 로그아웃 요청 실패 - 클라이언트 정리 계속 진행');
      });
    }
  } catch (error) {
    console.warn('로그아웃 API 호출 중 오류:', error);
  } finally {
    // 로컬 스토리지 정리
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpirationTime');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('companyId');
    localStorage.removeItem('companyName');
    localStorage.removeItem('companyAddressName');
    localStorage.removeItem('customerKey');
    localStorage.removeItem('organizationName'); // 이전 버전 호환성
  }
}

// FCM 토큰 업데이트
export async function updateFcmToken(memberId: string, fcmToken: string) {
  return fetchWithAuth(`/admin/users/${memberId}/fcm-token`, {
    method: 'PUT',
    body: JSON.stringify({ fcmToken }),
  });
}

// 회사 목록 조회
export async function getAllCompanies() {
  return fetchWithAuth('/admin/companies');
}

// 회원가입 요청 (JWT 토큰 없이 요청) - companyId 필요
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
  return fetchWithoutAuth('/admin/join-request', {
    method: 'POST',
    body: JSON.stringify(requestData),
  });
}

// 모든 가입 요청 조회 (companyId 추가)
export async function getAllJoinRequests() {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }
  
  return fetchWithAuth(`/admin/join-requests?companyId=${companyId}`);
}

// 대기중인 가입 요청 조회 (companyId 추가)
export async function getPendingJoinRequests() {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }
  
  return fetchWithAuth(`/admin/users/pending?companyId=${companyId}`);
}

// 가입 요청 승인
export async function approveJoinRequest(requestId: string, adminId: string) {
  return fetchWithAuth(`/admin/users/${requestId}?action=approve&adminId=${adminId}`, {
    method: 'PUT',
  });
}

// 가입 요청 거부
export async function rejectJoinRequest(requestId: string, adminId: string, rejectReason: string) {
  return fetchWithAuth(`/admin/users/${requestId}?action=reject&adminId=${adminId}`, {
    method: 'PUT',
    body: JSON.stringify({ rejectReason }),
  });
}

// 회원 목록 조회 (companyId 추가)
export async function getAllMembers() {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }
  
  return fetchWithAuth(`/admin/users/members?companyId=${companyId}`);
}

// 역할별 회원 조회 (companyId 추가)
export async function getMembersByRole(role: string) {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }
  
  return fetchWithAuth(`/admin/users/members?companyId=${companyId}&role=${role}`);
}

// 상태별 회원 조회 (companyId 추가)
export async function getMembersByStatus(status: string) {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }
  
  return fetchWithAuth(`/admin/users/members?companyId=${companyId}&status=${status}`);
}

// 특정 회원 조회
export async function getMemberById(id: string) {
  return fetchWithAuth(`/admin/users/${id}/profile`);
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
  return fetchWithAuth(`/admin/users/${id}/update`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
}

// 회원 삭제
export async function deleteMember(id: string) {
  return fetchWithAuth(`/admin/users/${id}`, {
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
  const dateString = date.toISOString().split('T')[0];
  return saveVacationLimits([{
    date: dateString,
    maxPeople,
    role
  }]);
}

// ================== 사용자 관리 인터페이스 ==================

export interface PendingUser {
  id: string;
  name: string;
  email: string;
  role: string;
  requestedAt: string;
}

// 대기중인 사용자 조회 (기존 코드 호환용)
export async function getPendingUsers(): Promise<PendingUser[]> {
  try {
    const companyId = getCompanyId();
    if (!companyId) {
      throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    
    return await fetchWithAuth(`/admin/users/pending?companyId=${companyId}`);
  } catch (error) {
    console.error('대기중인 사용자 조회 오류:', error);
    throw error;
  }
}

// 사용자 승인 (기존 코드 호환용)
export async function approveUser(userId: string) {
  // 현재 로그인한 사용자의 ID 가져오기
  const adminId = localStorage.getItem('userId') || 'admin';
  
  return await fetchWithAuth(`/admin/users/${userId}?action=approve&adminId=${adminId}`, {
    method: 'PUT',
  });
}

// 사용자 거부 (기존 코드 호환용)
export async function rejectUser(userId: string, reason = '승인 기준에 부합하지 않음') {
  // 현재 로그인한 사용자의 ID 가져오기
  const adminId = localStorage.getItem('userId') || 'admin';
  
  return await fetchWithAuth(`/admin/users/${userId}?action=reject&adminId=${adminId}`, {
    method: 'PUT',
    body: JSON.stringify({ rejectReason: reason }),
  });
}

// 모든 사용자 조회 (기존 코드 호환용)
export async function getAllUsers() {
  return getMemberUsers();
}

// 멤버 사용자 조회 (기존 코드 호환용)
export async function getMemberUsers() {
  try {
    const companyId = getCompanyId();
    if (!companyId) {
      throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    
    return await fetchWithAuth(`/admin/users/members?companyId=${companyId}`);
  } catch (error) {
    console.error('회원 목록 조회 오류:', error);
    throw error;
  }
}

// 사용자 삭제 (기존 코드 호환용)
export async function deleteUser(userId: string) {
  return await fetchWithAuth(`/admin/users/${userId}`, {
    method: 'DELETE',
  });
}

// 사용자 상태 업데이트 (기존 코드 호환용)
export async function updateUserStatus(userId: string, status: 'active' | 'inactive') {
  return await fetchWithAuth(`/admin/users/${userId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// ================== 조직 관리 API ==================

// 조직 프로필 조회
export async function getOrganizationProfile() {
  return fetchWithAuth('/api/v1/organization/profile');
}

// 조직 프로필 업데이트
export async function updateOrganizationProfile(profileData: {
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
}) {
  return fetchWithAuth('/api/v1/organization/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
} 