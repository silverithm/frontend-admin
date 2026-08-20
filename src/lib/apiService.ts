// apiService.ts - Spring Boot 백엔드 API 호출을 위한 서비스

import {VacationRequest, VacationLimit} from '@/types/vacation';
import { ALL_ROLE_FILTER, getStoredUserRole } from '@/lib/roleUtils';
import { getMyChatUserId } from '@/lib/chatIdentity';
import {
    SigninResponseDTO,
    MemberSigninResponseDTO,
    TokenInfo,
    UserDataDTO,
    FindPasswordResponse,
    PasswordChangeRequest,
    UserRole
} from '@/types/auth';
import { ApprovalImportPreview, ApprovalImportRow, ApprovalViewerEntry, ApproverCandidate, ViewerPositionCandidate } from '@/types/approval';

// API 기본 URL (환경에 따라 변경될 수 있음)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';


// 화면 하나가 API를 여러 개 동시에 부르는데(캘린더/제한/직원/직책),
// 토큰이 만료돼 있으면 그 요청들이 한꺼번에 401을 받는다.
// 각자 갱신을 시도하면 같은 refreshToken을 여러 번 쓰게 되고,
// 백엔드가 재사용된 토큰을 거부하면 멀쩡한 세션이 로그아웃되거나 오류 토스트가 뜬다.
// 그래서 갱신은 항상 하나의 프라미스로 묶어 한 번만 돌린다.
let refreshPromise: Promise<string> | null = null;

function refreshAccessTokenOnce(): Promise<string> {
    if (!refreshPromise) {
        refreshPromise = refreshAccessToken().then(
            (token) => {
                refreshPromise = null;
                return token;
            },
            (error) => {
                refreshPromise = null;
                throw error;
            }
        );
    }
    return refreshPromise;
}

// 잠깐 흔들린 것뿐인 실패(네트워크 끊김, 백엔드 일시 오류)는 다시 물어보면 대개 성공한다.
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

interface ApiError extends Error {
    status?: number;
    isTransient?: boolean;
}

function isTransientError(error: unknown): boolean {
    if (!error) return false;
    if ((error as ApiError).isTransient) return true;
    // fetch 자체가 실패하면 TypeError로 온다 (오프라인, 연결 끊김 등)
    return error instanceof TypeError;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// CompanyId 가져오기 헬퍼 함수
function getCompanyId(): string {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('companyId') || '';
    }
    return '';
}

// Refresh Token API 호출
// 갱신이 잠깐 실패했다고 로그아웃시키면 안 된다. 네트워크가 끊겼거나 서버가 잠시 흔들린 것뿐이면
// 몇 번 더 시도하고, 그래도 안 되면 "일시적 실패"로 표시해 세션을 유지한 채 올려보낸다.
// 진짜로 리프레시 토큰이 무효한 경우(4xx)에만 로그아웃 대상이다.
async function refreshAccessToken(): Promise<string> {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
        throw new Error('Refresh token이 없습니다.');
    }

    const maxAttempts = 3;

    for (let attempt = 1; ; attempt++) {
        let response: Response;

        try {
            response = await fetch(`${API_BASE_URL}/api/v1/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({refreshToken}),
            });
        } catch (networkError) {
            console.error('[Token Refresh] 네트워크 오류:', networkError);
            const error: ApiError = new Error('토큰 갱신 중 네트워크 오류가 발생했습니다.');
            error.isTransient = true;
            if (attempt < maxAttempts) {
                await wait(attempt * 400);
                continue;
            }
            throw error;
        }

        if (!response.ok) {
            const error: ApiError = new Error(`Refresh token 갱신 실패: ${response.status}`);
            error.status = response.status;
            error.isTransient = TRANSIENT_STATUSES.has(response.status);

            if (error.isTransient && attempt < maxAttempts) {
                console.warn(`[Token Refresh] ${response.status} 응답, 재시도합니다.`);
                await wait(attempt * 400);
                continue;
            }

            console.error('[Token Refresh] 실패:', error);
            throw error;
        }

        const data = await response.json().catch(() => null);

        // 백엔드에서 TokenInfo 객체를 직접 반환
        if (data && data.accessToken) {
            // 새로운 토큰들 저장
            localStorage.setItem('authToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            localStorage.setItem('tokenExpirationTime', data.accessTokenExpirationTime?.toString() || '');

            return data.accessToken;
        }

        console.error('[Token Refresh] 응답 구조 오류:', data);
        throw new Error('응답에 새로운 토큰이 없습니다.');
    }
}

// 로그아웃 및 리다이렉트 처리
const handleLogout = () => {

    // 모든 토큰 및 사용자 정보 삭제
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpirationTime');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('companyId');
    localStorage.removeItem('companyName');
    localStorage.removeItem('companyAddressName');
    localStorage.removeItem('companyCode');
    localStorage.removeItem('customerKey');
    localStorage.removeItem('organizationName');
    localStorage.removeItem('loginType');
    localStorage.removeItem('lastLoginType');
    localStorage.removeItem('userPosition');
    localStorage.removeItem('isDemoMode');
    localStorage.removeItem('demoStartedAt');

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

// 응답 본문을 JSON으로 읽는다. HTML이 오면 프록시/엔드포인트 설정 문제다.
async function readJsonResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
        const htmlText = await response.text();
        console.error(`[API Error] 성공 응답이지만 HTML 받음:`, htmlText.substring(0, 200));
        throw new Error('서버에서 JSON 대신 HTML을 반환했습니다. ngrok 설정을 확인해주세요.');
    }

    // 삭제 API 등은 본문 없이 204로 답한다. 이때 json()을 부르면 파싱 오류가 나므로 먼저 걸러낸다.
    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    if (!text) {
        return null;
    }

    return JSON.parse(text);
}

// 실패 응답을 Error로 바꾼다. 일시적인 상태 코드면 재시도 대상으로 표시한다.
async function toApiError(response: Response): Promise<ApiError> {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
        const htmlText = await response.text();
        console.error(`[API Error] HTML 응답 받음:`, htmlText.substring(0, 200));
        const htmlError: ApiError = new Error(`서버에서 HTML 페이지를 반환했습니다. API 엔드포인트를 확인해주세요. (${response.status})`);
        htmlError.status = response.status;
        htmlError.isTransient = TRANSIENT_STATUSES.has(response.status);
        return htmlError;
    }

    const errorData = await response.json().catch(() => null);
    const error: ApiError = new Error(
        errorData?.error || errorData?.message || `API 오류: ${response.status} ${response.statusText}`
    );
    error.status = response.status;
    error.isTransient = TRANSIENT_STATUSES.has(response.status);
    return error;
}

// 요청 한 번 보내기 (401이면 토큰을 갱신해 한 번만 재시도)
async function sendAuthedRequest(fullUrl: string, options: RequestInit): Promise<any> {
    const usedToken = localStorage.getItem('authToken');

    const buildHeaders = (token: string | null): Record<string, string> => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options.headers as Record<string, string>,
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    };

    const response = await fetch(fullUrl, { ...options, headers: buildHeaders(usedToken) });

    // 401 Unauthorized - JWT 토큰 만료 또는 무효
    if (response.status === 401) {
        let newToken: string;

        const currentToken = localStorage.getItem('authToken');
        if (currentToken && currentToken !== usedToken) {
            // 이 요청이 나가 있는 사이 다른 요청이 이미 갱신을 끝냈다. 갱신 없이 새 토큰으로 재시도한다.
            newToken = currentToken;
        } else {
            try {
                newToken = await refreshAccessTokenOnce();
            } catch (refreshError) {
                console.error('[API Auth] 토큰 갱신 실패:', refreshError);

                // 서버/네트워크가 잠시 흔들린 것이라면 세션은 멀쩡하다.
                // 여기서 로그아웃시키면 멀쩡한 사용자가 까닭 없이 튕긴다.
                if (isTransientError(refreshError)) {
                    throw refreshError;
                }

                handleLogout();
                throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
            }
        }

        const retryResponse = await fetch(fullUrl, { ...options, headers: buildHeaders(newToken) });

        if (retryResponse.status === 401) {
            console.error('[API Auth] 갱신된 토큰으로도 인증에 실패했습니다.');
            handleLogout();
            throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
        }

        if (!retryResponse.ok) {
            throw await toApiError(retryResponse);
        }

        return readJsonResponse(retryResponse);
    }

    if (!response.ok) {
        throw await toApiError(response);
    }

    return readJsonResponse(response);
}

// JWT 토큰이 포함된 공통 fetch 함수 (토큰 갱신 + 일시적 실패 재시도 포함)
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
    // Next.js API 라우트를 통한 프록시 방식
    const fullUrl = url.startsWith('/api') ? url : `/api${url}`;

    // 조회(GET)만 재시도한다. 쓰기 요청을 다시 보내면 같은 작업이 두 번 처리될 수 있다.
    const method = (options.method || 'GET').toUpperCase();
    const maxAttempts = method === 'GET' ? 3 : 1;

    for (let attempt = 1; ; attempt++) {
        try {
            return await sendAuthedRequest(fullUrl, options);
        } catch (error) {
            if (attempt < maxAttempts && isTransientError(error)) {
                console.warn(`[API Retry] ${method} ${fullUrl} ${attempt}번째 실패, 재시도합니다:`, error);
                await wait(attempt * 400);
                continue;
            }

            console.error(`[API Error] ${method} ${fullUrl}:`, error);

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
}

// 토큰 갱신/재시도가 붙은 요청을 다른 모듈에서도 쓸 수 있게 공개한다.
// 각자 fetch를 직접 부르면 토큰이 만료됐을 때 갱신 없이 그냥 실패한다.
export const authorizedFetch = fetchWithAuth;

// ================== 휴가 관련 API ==================

// 휴가 캘린더 데이터 조회 (companyId 추가)
export async function getVacationCalendar(startDate: string, endDate: string, roleFilter = ALL_ROLE_FILTER, nameFilter?: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }

    let url = `/api/vacation/calendar?startDate=${startDate}&endDate=${endDate}&roleFilter=${encodeURIComponent(roleFilter)}&companyId=${companyId}`;
    if (nameFilter) {
        url += `&nameFilter=${encodeURIComponent(nameFilter)}`;
    }
    return fetchWithAuth(url);
}

// 특정 날짜 휴가 데이터 조회 (companyId 추가)
export async function getVacationForDate(date: string, role = ALL_ROLE_FILTER, nameFilter?: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }

    let url = `/api/vacation/date/${date}?role=${encodeURIComponent(role)}&companyId=${companyId}`;
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

// 휴가 일괄 승인
export async function bulkApproveVacations(vacationIds: string[]) {
    return fetchWithAuth(`/api/vacation/bulk-approve`, {
        method: 'PUT',
        body: JSON.stringify({ vacationIds }),
    });
}

// 휴가 일괄 거부
export async function bulkRejectVacations(vacationIds: string[]) {
    return fetchWithAuth(`/api/vacation/bulk-reject`, {
        method: 'PUT',
        body: JSON.stringify({ vacationIds }),
    });
}

// 휴가 일괄 삭제 — 되돌릴 수 없으므로 호출 전 확인을 받는다
export async function bulkDeleteVacations(vacationIds: string[]) {
    return fetchWithAuth(`/api/vacation/bulk-delete`, {
        method: 'PUT',
        body: JSON.stringify({ vacationIds }),
    });
}

// 직원이 직접 휴무 신청
export async function requestVacation(data: {
    date: string;
    duration: string;
    reason?: string;
    type?: string;
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }

    const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : '';
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';
    const role = getStoredUserRole()
        || (typeof window !== 'undefined' ? localStorage.getItem('userRole') || 'employee' : 'employee');

    return fetchWithAuth(`/api/vacation/submit?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify({
            userName,
            userId,
            role,
            date: data.date,
            duration: data.duration,
            reason: data.reason || '',
            type: data.type || '휴가',
        }),
    });
}

// 관리자가 직원 대신 휴무 신청
export async function adminCreateVacationForMember(data: {
    memberId: string;
    date: string;
    reason?: string;
    duration: string;
    type: 'regular' | 'mandatory' | 'substitute';
    useAnnualLeave: boolean;
    vacationType?: string;
    reasonRequired: boolean;
    companyId: string;
}) {
    return fetchWithAuth(`/api/vacation/admin/submit-for-member`, {
        method: 'POST',
        body: JSON.stringify(data),
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

// 휴무 입력 마감일 설정 조회
export async function getVacationDeadlineSetting() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/vacation/deadline-setting?companyId=${companyId}`);
}

// 휴무 입력 마감일 설정 저장
export async function saveVacationDeadlineSetting(deadlineDay: number, enabled: boolean, nextMonthOnly?: boolean) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/vacation/deadline-setting?companyId=${companyId}`, {
        method: 'POST',
        // nextMonthOnly를 안 보내면 서버가 기존 값을 유지한다
        body: JSON.stringify(nextMonthOnly === undefined
            ? { deadlineDay, enabled }
            : { deadlineDay, enabled, nextMonthOnly }),
    });
}

// 월별 마감일 지정 조회 — { "2026-08": "2026-08-16", ... }
export async function getVacationDeadlineDates(): Promise<Record<string, string>> {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    const data = await fetchWithAuth(`/api/vacation/deadline-dates?companyId=${companyId}`);
    return (data?.dates && typeof data.dates === 'object') ? data.dates : {};
}

/** 특정 달의 마감일 지정. deadlineDate가 null이면 지정을 해제해 매월 고정일로 되돌린다 */
export async function saveVacationDeadlineDate(targetMonth: string, deadlineDate: string | null) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/vacation/deadline-dates?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify({ targetMonth, deadlineDate }),
    });
}

// ================== 근무조정 중요 행사 ==================

export interface VacationEvent {
    id: number;
    title: string;
    description: string | null;
    startDate: string;
    endDate: string;
    warnOnRequest: boolean;
}

export async function getVacationEvents(startDate: string, endDate: string): Promise<VacationEvent[]> {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    const data = await fetchWithAuth(
        `/api/vacation/events?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}`,
    );
    return Array.isArray(data?.events) ? data.events : [];
}

export async function createVacationEvent(input: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    warnOnRequest?: boolean;
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/vacation/events?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export async function updateVacationEvent(eventId: number, input: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    warnOnRequest?: boolean;
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/vacation/events/${eventId}?companyId=${companyId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    });
}

export async function deleteVacationEvent(eventId: number) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/vacation/events/${eventId}?companyId=${companyId}`, { method: 'DELETE' });
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


    const result = await fetchWithAuth(`/api/vacation/limits?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify({limits}),
    });

    return result;
}


// ================== 일정 구분(커스텀 카테고리) API ==================
// 기관이 직접 만드는 일정 구분(이름+색). 서버·구버전 앱과의 호환을 위해 라벨이라는 이름을 유지한다.

// 라벨 목록 조회
export async function getScheduleLabels() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedule-labels?companyId=${companyId}`);
}

// 라벨 생성
export async function createScheduleLabel(data: { name: string; color: string }) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }

    return fetchWithAuth(`/api/v1/schedule-labels?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 라벨 수정
export async function updateScheduleLabel(id: string, data: { name?: string; color?: string }) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedule-labels/${id}?companyId=${companyId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// 라벨 삭제
export async function deleteScheduleLabel(id: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedule-labels/${id}?companyId=${companyId}`, {
        method: 'DELETE',
    });
}

// ================== 기본 일정 구분 설정 API ==================
// 기본 구분(회의·행사·교육·기타)의 기관별 이름·색·숨김. 삭제는 없다(기존 일정이 물고 있음).

// 기본 구분 설정 조회 — 응답: { categories: [{category,name,color,hidden,...}] }
export async function getScheduleCategorySettings() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedule-categories?companyId=${companyId}`);
}

// 기본 구분 이름·색·숨김 변경 (null/undefined 필드는 유지)
export async function updateScheduleCategorySetting(
    category: string,
    data: { name?: string; color?: string; hidden?: boolean },
) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedule-categories/${category}?companyId=${companyId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// 기본 구분 설정을 기본값으로 되돌리기
export async function resetScheduleCategorySetting(category: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedule-categories/${category}?companyId=${companyId}`, {
        method: 'DELETE',
    });
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
        body: JSON.stringify({email, password}),
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

// signin()/startDemo() 공통 응답 형태 (데모 응답은 role 필드가 없을 수 있음)
type AuthSessionResponse = SigninResponseDTO & { role?: string; userEmail?: string };

// 로그인/체험 시작 성공 시 인증 세션 정보를 로컬 스토리지에 저장하는 공통 헬퍼
// (signin()의 기존 저장 로직을 그대로 옮긴 것 — 키/값 동작은 동일하게 유지)
function storeAuthSession(data: AuthSessionResponse, options: { email?: string; isDemo?: boolean } = {}): void {
    // JWT 토큰 저장
    localStorage.setItem('authToken', data.tokenInfo.accessToken);
    localStorage.setItem('refreshToken', data.tokenInfo.refreshToken);
    localStorage.setItem('tokenExpirationTime', data.tokenInfo.accessTokenExpirationTime?.toString() || '');

    // 사용자 정보 저장
    localStorage.setItem('userName', data.userName || '');
    localStorage.setItem('userEmail', data.userEmail || options.email || ''); // 백엔드에서 userEmail을 반환하거나 입력한 email 사용
    localStorage.setItem('userId', data.userId?.toString() || '');
    localStorage.setItem('companyName', data.companyName || '');
    localStorage.setItem('companyAddressName', data.companyAddressName || '');
    localStorage.setItem('companyCode', data.companyCode || '');
    localStorage.setItem('customerKey', data.customerKey || '');

    // companyId 저장 (필수값)
    localStorage.setItem('companyId', data.companyId!.toString());

    // 역할 정보 (데모 응답에는 role이 없을 수 있어 기본값 처리)
    localStorage.setItem('userRole', data.role || 'ROLE_ADMIN');
    localStorage.setItem('loginType', 'admin');

    if (options.isDemo) {
        localStorage.setItem('isDemoMode', 'true');
        localStorage.setItem('demoStartedAt', Date.now().toString());
    } else {
        // 정식 로그인은 이전 세션의 데모 플래그를 지운다
        localStorage.removeItem('isDemoMode');
        localStorage.removeItem('demoStartedAt');
    }
}

// 사용자 로그인 (새로운 API)
export async function signin(email: string, password: string): Promise<SigninResponseDTO> {
    try {

        // 직접 백엔드 ngrok URL로 요청
        const response = await fetch(`${API_BASE_URL}/api/v1/signin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true', // ngrok 브라우저 경고 우회
            },
            body: JSON.stringify({email, password}),
        });


        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error('백엔드 오류 응답:', errorData);
            throw new Error(errorData?.error || `로그인 실패: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // 로그인 성공 시 JWT 토큰과 사용자 정보 저장
        if (data && data.tokenInfo) {
            // companyId 필수 검증
            if (!data.companyId) {
                console.error('백엔드 응답에 companyId가 없습니다:', data);
                throw new Error('로그인 응답에 회사 ID가 포함되어 있지 않습니다. 관리자에게 문의하세요.');
            }

            storeAuthSession(data, { email });
        } else {
            console.error('로그인 응답에 토큰 정보가 없습니다:', data);
            throw new Error('로그인 응답에 토큰 정보가 없습니다.');
        }

        return data;
    } catch (error) {
        console.error('signin 함수 오류:', error);
        throw error;
    }
}

// 체험(데모) 시작 - 인증 불필요, signin과 동일한 응답 형태(SigninResponseDTO)를 받는다
export async function startDemo(): Promise<SigninResponseDTO> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/demo/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true', // ngrok 브라우저 경고 우회
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error('체험 시작 오류 응답:', errorData);
            const error = new Error(errorData?.error || `체험 시작 실패: ${response.status} ${response.statusText}`) as Error & { status?: number };
            error.status = response.status;
            throw error;
        }

        const data = await response.json();

        if (!data || !data.tokenInfo) {
            console.error('체험 시작 응답에 토큰 정보가 없습니다:', data);
            throw new Error('체험 시작 응답에 토큰 정보가 없습니다.');
        }

        storeAuthSession(data, { isDemo: true });

        return data;
    } catch (error) {
        console.error('startDemo 함수 오류:', error);
        throw error;
    }
}

// ==================== 직원 웹 가입 (관리자 승인 대기) ====================
// 아래 세 API는 모두 permitAll — 인증 API와 같은 직접 fetch 패턴을 쓴다.

export interface PublicPosition {
    id: number;
    name: string;
    memberRole?: string;
}

export async function getPublicPositions(companyId: number): Promise<PublicPosition[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/positions?companyId=${companyId}`, {
        headers: { 'Accept': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    });
    if (!response.ok) {
        throw new Error(`직책 목록 조회 실패: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : (data.positions || []);
}

/**
 * 기관 코드 검증 겸 직책 목록 조회 — 코드가 유효하지 않으면 throw.
 * 백엔드 직접 호출 시 PositionController의 수동 CORS 헤더와 Spring CORS 필터가
 * 중복되어 브라우저가 거부하므로, 같은 도메인의 Next 프록시를 경유한다.
 */
export async function getPublicPositionsByCompanyCode(companyCode: string): Promise<PublicPosition[]> {
    const response = await fetch(
        `/api/v1/positions?companyCode=${encodeURIComponent(companyCode)}`,
        { headers: { 'Accept': 'application/json' } },
    );
    if (!response.ok) {
        const error = new Error('기관 코드를 확인해주세요.') as Error & { status?: number };
        error.status = response.status;
        throw error;
    }
    const data = await response.json();
    return Array.isArray(data) ? data : (data.positions || []);
}

export interface MemberJoinRequestPayload {
    username: string;
    password: string;
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;          // CAREGIVER | OFFICE
    position?: string;     // 직책 표시명
    positionId?: number;
    companyId?: number;
    companyCode?: string;  // 기관 프로필에서 발급된 코드
}

export async function submitMemberJoinRequest(payload: MemberJoinRequestPayload): Promise<{ id: number; status?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/v1/members/join-request`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const error = new Error(data?.error || `가입 요청 실패: ${response.status}`) as Error & { status?: number };
        error.status = response.status;
        throw error;
    }
    return data;
}

// 직원 로그인 (Member Sign In)
export async function memberSignin(email: string, password: string): Promise<MemberSigninResponseDTO> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/members/signin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify({ username: email, password }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error('직원 로그인 오류 응답:', errorData);
            throw new Error(errorData?.error || `로그인 실패: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // 로그인 성공 시 JWT 토큰과 사용자 정보 저장
        if (data && data.tokenInfo) {
            // JWT 토큰 저장
            localStorage.setItem('authToken', data.tokenInfo.accessToken);
            localStorage.setItem('refreshToken', data.tokenInfo.refreshToken);
            localStorage.setItem('tokenExpirationTime', data.tokenInfo.accessTokenExpirationTime?.toString() || '');

            // 직원 정보 저장 (백엔드 응답 구조에 맞게 수정)
            localStorage.setItem('userName', data.name || '');
            localStorage.setItem('userEmail', data.email || email);
            localStorage.setItem('userId', data.memberId?.toString() || '');
            // company 객체에서 id와 name 추출
            localStorage.setItem('companyId', data.company?.id?.toString() || '');
            localStorage.setItem('companyName', data.company?.name || '');
            localStorage.setItem('userRole', 'ROLE_EMPLOYEE');
            localStorage.setItem('loginType', 'employee');
            localStorage.setItem('userPosition', data.position || '');
            // 권한 정보 저장
            localStorage.setItem('permissions', JSON.stringify(data.permissions || []));
        } else {
            console.error('직원 로그인 응답에 토큰 정보가 없습니다:', data);
            throw new Error('로그인 응답에 토큰 정보가 없습니다.');
        }

        return data;
    } catch (error) {
        console.error('memberSignin 함수 오류:', error);
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
    const params = new URLSearchParams();
    params.append('email', email);

    return fetchWithoutAuth('/api/v1/find/password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
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

// 관리자 회원탈퇴
export async function deleteAdminUser(): Promise<string> {
    try {
        const response = await fetchWithAuth('/api/v1/users', {
            method: 'DELETE',
        });

        // 탈퇴 성공 시 로컬 스토리지 정리
        localStorage.removeItem('authToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('companyId');
        localStorage.removeItem('userId');
        localStorage.removeItem('role');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('companyName');
        localStorage.removeItem('companyAddressName');
        localStorage.removeItem('companyCode');
        localStorage.removeItem('isDemoMode');
        localStorage.removeItem('demoStartedAt');

        return 'success';
    } catch (error) {
        console.error('회원탈퇴 오류:', error);
        throw new Error('회원탈퇴에 실패했습니다.');
    }
}

// 로그아웃 (업데이트)
export async function logout() {
    try {
        // 서버에 로그아웃 요청 (토큰을 Redis 블랙리스트에 추가)
        const token = localStorage.getItem('authToken');
        if (token) {
            await fetch(`${API_BASE_URL}/api/v1/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
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
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userId');
        localStorage.removeItem('companyId');
        localStorage.removeItem('companyName');
        localStorage.removeItem('companyAddressName');
        localStorage.removeItem('companyCode');
        localStorage.removeItem('customerKey');
        localStorage.removeItem('organizationName');
        localStorage.removeItem('loginType');
        localStorage.removeItem('lastLoginType');
        localStorage.removeItem('userPosition');
        localStorage.removeItem('isDemoMode');
        localStorage.removeItem('demoStartedAt');
    }
}

// FCM 토큰 업데이트
export async function updateFcmToken(memberId: string, fcmToken: string) {
    return fetchWithAuth(`/admin/users/${memberId}/fcm-token`, {
        method: 'PUT',
        body: JSON.stringify({fcmToken}),
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
        body: JSON.stringify({rejectReason}),
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

// ================== 멤버 권한 관리 API ==================

// 멤버 권한 조회
export async function getMemberPermissions(memberId: string) {
    return fetchWithAuth(`/api/v1/members/${memberId}/permissions`);
}

// 멤버 권한 수정
export async function updateMemberPermissions(memberId: string, permissions: string[]) {
    return fetchWithAuth(`/api/v1/members/${memberId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
    });
}

// ================== 직책 관리 API ==================

// 직책 목록 조회
export async function getPositions() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/positions?companyId=${companyId}`);
}

// 직책 생성
export async function createPosition(data: { name: string; description?: string; memberRole?: 'caregiver' | 'office' | null; sortOrder?: number }) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/positions?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 직책 수정
export async function updatePosition(id: number, data: { name?: string; description?: string; memberRole?: 'caregiver' | 'office' | null; sortOrder?: number }) {
    return fetchWithAuth(`/api/v1/positions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// 직책 삭제
export async function deletePosition(id: number) {
    return fetchWithAuth(`/api/v1/positions/${id}`, {
        method: 'DELETE',
    });
}

// 회원에게 직책 배정
export async function assignPositionToMember(memberId: string, positionId: number | null) {
    const url = positionId !== null
        ? `/api/v1/positions/assign?memberId=${memberId}&positionId=${positionId}`
        : `/api/v1/positions/assign?memberId=${memberId}`;
    return fetchWithAuth(url, {
        method: 'PUT',
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

export async function setVacationLimit(date: Date, maxPeople: number, role: string) {
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
        body: JSON.stringify({rejectReason: reason}),
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
        body: JSON.stringify({status}),
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

// ================== 공지사항 API ==================

// 공지사항 목록 조회 (관리자)
export async function getNotices(filter?: {
    status?: string;
    priority?: string;
    searchQuery?: string;
    startDate?: string;
    endDate?: string;
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }

    let url = `/api/v1/notices?companyId=${companyId}`;
    if (filter?.status && filter.status !== 'ALL') url += `&status=${filter.status}`;
    if (filter?.priority && filter.priority !== 'ALL') url += `&priority=${filter.priority}`;
    if (filter?.searchQuery) url += `&searchQuery=${encodeURIComponent(filter.searchQuery)}`;
    if (filter?.startDate) url += `&startDate=${filter.startDate}`;
    if (filter?.endDate) url += `&endDate=${filter.endDate}`;

    return fetchWithAuth(url);
}

// 요양 소식(뉴스) 목록 조회 — 케어브이 커뮤니티
export async function getNews(params?: { category?: string; page?: number; size?: number }) {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    query.set('page', String(params?.page ?? 0));
    query.set('size', String(params?.size ?? 20));
    return fetchWithAuth(`/api/v1/news?${query.toString()}`);
}

// 공지사항 목록 조회 (직원 - 게시된 것만)
export async function getPublishedNotices() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }

    return fetchWithAuth(`/api/v1/notices/published?companyId=${companyId}`);
}

// 공지사항 상세 조회
export async function getNoticeById(id: string) {
    return fetchWithAuth(`/api/v1/notices/${id}`);
}

// 공지사항 등록 (관리자)
export async function createNotice(data: {
    title: string;
    content: string;
    priority: string;
    isPinned: boolean;
    sendPushNotification: boolean;
    attachments?: {
        fileName: string;
        fileUrl: string;
        fileSize: number;
        fileType: 'IMAGE' | 'FILE';
        mimeType: string;
    }[];
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }

    return fetchWithAuth(`/api/v1/notices?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 공지사항 수정 (관리자)
export async function updateNotice(id: string, data: {
    title?: string;
    content?: string;
    priority?: string;
    isPinned?: boolean;
    status?: string;
    attachments?: {
        fileName: string;
        fileUrl: string;
        fileSize: number;
        fileType: 'IMAGE' | 'FILE';
        mimeType: string;
    }[];
}) {
    return fetchWithAuth(`/api/v1/notices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// 공지사항 삭제 (관리자)
export async function deleteNotice(id: string) {
    return fetchWithAuth(`/api/v1/notices/${id}`, {
        method: 'DELETE',
    });
}

// 공지사항 조회수 증가
export async function incrementNoticeViewCount(id: string) {
    return fetchWithAuth(`/api/v1/notices/${id}/view`, {
        method: 'POST',
    });
}

// 공지사항 상세 조회 (댓글, 읽은 사람 포함)
export async function getNoticeDetail(id: string) {
    return fetchWithAuth(`/api/v1/notices/${id}`);
}

// 공지사항 댓글 목록 조회
export async function getNoticeComments(noticeId: string) {
    return fetchWithAuth(`/api/v1/notices/${noticeId}/comments`);
}

// 공지사항 댓글 등록
export async function createNoticeComment(noticeId: string, content: string) {
    return fetchWithAuth(`/api/v1/notices/${noticeId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
    });
}

// 공지사항 댓글 삭제
export async function deleteNoticeComment(noticeId: string, commentId: string) {
    return fetchWithAuth(`/api/v1/notices/${noticeId}/comments/${commentId}`, {
        method: 'DELETE',
    });
}

// 공지사항 읽은 사람 목록 조회
export async function getNoticeReaders(noticeId: string) {
    return fetchWithAuth(`/api/v1/notices/${noticeId}/readers`);
}

// 공지사항 읽음 기록
export async function markNoticeAsRead(noticeId: string) {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';
    const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : '';
    return fetchWithAuth(`/api/v1/notices/${noticeId}/readers`, {
        method: 'POST',
        body: JSON.stringify({ userId, userName }),
    });
}

// ================== 전자결재 양식 API ==================

// 양식 목록 조회 (관리자)
export async function getApprovalTemplates() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/approval-templates?companyId=${companyId}`);
}

// 활성화된 양식 목록 조회 (직원용)
export async function getActiveApprovalTemplates() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/approval-templates/active?companyId=${companyId}`);
}

// 양식 상세 조회
export async function getApprovalTemplateById(id: string) {
    return fetchWithAuth(`/api/v1/approval-templates/${id}`);
}

// 양식 등록 (관리자)
export async function createApprovalTemplate(data: {
    name: string;
    description: string;
    category?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    formSchema?: string;
    templateType?: string;
    defaultApprovalLine?: string;
    defaultViewers?: ApprovalViewerEntry[];
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/approval-templates?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 양식 수정 (관리자)
export async function updateApprovalTemplate(id: string, data: {
    name?: string;
    description?: string;
    category?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    formSchema?: string;
    templateType?: string;
    defaultApprovalLine?: string;
    defaultViewers?: ApprovalViewerEntry[];
}) {
    return fetchWithAuth(`/api/v1/approval-templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// 양식 활성화/비활성화 토글 (관리자)
export async function toggleApprovalTemplateActive(id: string) {
    return fetchWithAuth(`/api/v1/approval-templates/${id}?toggleActive=true`, {
        method: 'PUT',
    });
}

// 양식 삭제 (관리자)
export async function deleteApprovalTemplate(id: string) {
    return fetchWithAuth(`/api/v1/approval-templates/${id}`, {
        method: 'DELETE',
    });
}

// ================== 전자결재 요청 API ==================

// 결재 요청 목록 조회 (관리자)
// 백엔드는 formData를 JSON 문자열로 저장하므로 조회 시 객체로 파싱한다
function normalizeApprovalFormData<T extends { formData?: unknown; approvals?: unknown; approval?: unknown }>(res: T): T {
    const parse = (a: any) => {
        if (a && typeof a.formData === 'string' && a.formData.trim()) {
            try { a.formData = JSON.parse(a.formData); } catch { /* 파싱 불가 시 원본 유지 */ }
        }
        return a;
    };
    const r = res as any;
    if (Array.isArray(r?.approvals)) r.approvals.forEach(parse);
    if (r?.approval) parse(r.approval);
    parse(r);
    return res;
}

export async function getApprovalRequests(filter?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    searchQuery?: string;
    /** 양식별 필터 */
    templateId?: string | number;
    /** 기안 대분류 필터 */
    category?: string;
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }

    let url = `/api/v1/approvals?companyId=${companyId}`;
    if (filter?.status && filter.status !== 'ALL') url += `&status=${filter.status}`;
    if (filter?.startDate) url += `&startDate=${filter.startDate}`;
    if (filter?.endDate) url += `&endDate=${filter.endDate}`;
    if (filter?.searchQuery) url += `&searchQuery=${encodeURIComponent(filter.searchQuery)}`;
    if (filter?.templateId) url += `&templateId=${filter.templateId}`;
    if (filter?.category) url += `&category=${encodeURIComponent(filter.category)}`;

    return normalizeApprovalFormData(await fetchWithAuth(url));
}

// 내 결재 요청 조회 (직원용)
export async function getMyApprovalRequests(requesterId: string) {
    return normalizeApprovalFormData(await fetchWithAuth(`/api/v1/approvals?requesterId=${requesterId}`));
}

// 결재 요청 상세 조회
export async function getApprovalRequestById(id: string) {
    return normalizeApprovalFormData(await fetchWithAuth(`/api/v1/approvals/${id}`));
}

// 결재용 requesterId 반환 (admin은 prefix로 구분하여 memberId 충돌 방지)
export function getApprovalRequesterId(): string {
    if (typeof window === 'undefined') return '';
    const userId = localStorage.getItem('userId') || '';
    const loginType = localStorage.getItem('loginType') || '';
    return loginType === 'admin' ? `admin_${userId}` : userId;
}

/** 결재 작성 내용 — 상신할 때도 임시저장할 때도 같은 모양으로 보낸다 */
export interface ApprovalRequestPayload {
    templateId: number;
    title: string;
    formData?: Record<string, any>;
    attachmentUrl?: string;
    attachmentFileName?: string;
    attachmentFileSize?: number;
    approvalLine?: Array<{ approverType: 'ADMIN' | 'MEMBER'; approverId: number }>;
    /** true면 상신하지 않고 임시저장만 한다 (결재함에 뜨지 않고 알림도 안 나간다) */
    draft?: boolean;
}

// 백엔드 DTO의 formData는 String(JSON) — 객체를 그대로 보내면 역직렬화에 실패한다
function toApprovalBody(data: ApprovalRequestPayload) {
    return JSON.stringify({
        ...data,
        ...(data.formData ? { formData: JSON.stringify(data.formData) } : {}),
    });
}

/** 임시저장 문서 이어쓰기 (기안자 본인) */
export async function updateApprovalDraft(id: string | number, data: ApprovalRequestPayload) {
    return fetchWithAuth(`/api/v1/approvals/${id}/draft`, {
        method: 'PUT',
        body: toApprovalBody({ ...data, draft: true }),
    });
}

/** 임시저장 문서 상신 — 이 시점에 결재선이 검증되고 결재자에게 알림이 간다 */
export async function submitApprovalDraft(id: string | number, data: ApprovalRequestPayload) {
    return fetchWithAuth(`/api/v1/approvals/${id}/submit`, {
        method: 'POST',
        body: toApprovalBody({ ...data, draft: false }),
    });
}

// 결재 요청 생성
export async function createApprovalRequest(data: ApprovalRequestPayload) {
    const companyId = getCompanyId();
    const requesterId = getApprovalRequesterId();
    const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : '';

    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }

    return fetchWithAuth(`/api/v1/approvals?companyId=${companyId}&requesterId=${requesterId}&requesterName=${encodeURIComponent(userName)}`, {
        method: 'POST',
        body: toApprovalBody(data),
    });
}

// 결재 승인 — options.signatureBase64가 있으면 즉석 서명, 없으면 등록 서명 자동 사용
export async function approveApprovalRequest(id: string, options?: { signatureBase64?: string; force?: boolean }) {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';
    const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : '';

    // force: 관리자 직권 승인(전결) — 남은 검토 단계를 건너뛰고 즉시 최종 승인
    return fetchWithAuth(`/api/v1/approvals/${id}?action=approve&processedBy=${userId}&processedByName=${encodeURIComponent(userName)}${options?.force ? '&force=true' : ''}`, {
        method: 'PUT',
        ...(options?.signatureBase64
            ? { body: JSON.stringify({ signatureBase64: options.signatureBase64 }) }
            : {}),
    });
}

// ── 고충·신고 + 건의함 (VoiceBox) ─────────────────────────
export type VoiceMessageItem = {
    id: number;
    type: 'GRIEVANCE' | 'SUGGESTION';
    title: string;
    content: string;
    isAnonymous: boolean;
    authorName: string;
    status: 'RECEIVED' | 'IN_REVIEW' | 'RESOLVED' | 'ON_HOLD';
    adminReply: string | null;
    repliedAt: string | null;
    createdAt: string | null;
};

export async function createVoiceMessage(input: {
    type: 'GRIEVANCE' | 'SUGGESTION';
    title: string;
    content: string;
    isAnonymous: boolean;
}) {
    return fetchWithAuth('/api/v1/voice-box', {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

// scope=admin은 기관 관리자만 (직원은 403), mine은 본인 제출 내역
export async function getVoiceMessages(scope: 'admin' | 'mine', type?: 'GRIEVANCE' | 'SUGGESTION') {
    const query = new URLSearchParams({ scope });
    if (type) query.set('type', type);
    return fetchWithAuth(`/api/v1/voice-box?${query.toString()}`);
}

export async function updateVoiceMessage(id: number, input: { status?: string; adminReply?: string }) {
    return fetchWithAuth(`/api/v1/voice-box/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
    });
}

// 결재선 지정 가능 결재자 후보 목록 (회사 관리자 + 결재 권한 보유 직원)
export async function getApproverCandidates() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/approvals/approver-candidates?companyId=${companyId}`);
}

// 열람 대상 지정 후보 (직책 + 사람)
export async function getViewerCandidates(): Promise<{
    positions: ViewerPositionCandidate[];
    people: ApproverCandidate[];
}> {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    const response = await fetchWithAuth(`/api/v1/approvals/viewer-candidates?companyId=${companyId}`);
    return {
        positions: Array.isArray(response?.positions) ? response.positions : [],
        people: Array.isArray(response?.people) ? response.people : [],
    };
}

// ================== 과거 문서 이관 (관리자) ==================

/** 이관 색인(엑셀)을 읽어본다 — 저장하지 않는다 */
export async function previewApprovalImport(
    file: File,
    uploadedFileNames: string[] = [],
): Promise<ApprovalImportPreview> {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }

    const formData = new FormData();
    formData.append('file', file);
    // 이미 올려둔 파일 이름을 함께 보내면, 색인에 적혔는데 빠진 파일을 미리 짚어준다
    uploadedFileNames.forEach((name) => formData.append('uploadedFileNames', name));

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const response = await fetch(`/api/v1/approvals/import/preview?companyId=${companyId}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || '색인 파일을 읽지 못했습니다.');
    }
    return data.preview;
}

/** 확정 등록 — 문제가 있는 줄은 건너뛰고 나머지가 들어간다 */
export async function importApprovals(payload: {
    templateId?: number;
    source?: string;
    rows: ApprovalImportRow[];
    files: Record<string, { filePath: string; fileSize?: number }>;
    viewers?: ApprovalViewerEntry[];
}): Promise<{ result: ApprovalImportPreview; message: string }> {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }

    return fetchWithAuth(`/api/v1/approvals/import?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

// 로그인 관리자 + 회사 정보 조회 (직인 URL 포함)
export async function getUserInfo() {
    return fetchWithAuth('/api/v1/users/info');
}

// 공용 파일 업로드 헬퍼 (컴포넌트별 중복 제거용)
export async function uploadFileToServer(
    file: File | Blob,
    options: { category?: string; fileName?: string } = {}
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
    const formData = new FormData();
    if (options.fileName) {
        formData.append('file', file, options.fileName);
    } else {
        formData.append('file', file);
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const response = await fetch(`/api/v1/files/upload?category=${options.category ?? 'attachments'}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || '파일 업로드 실패');
    }

    const result = await response.json();
    return {
        filePath: result.filePath,
        fileName: result.fileName,
        fileSize: result.fileSize,
    };
}

// ================== 결재 서명/기관 직인 API ==================

// 내 결재 서명 조회 ({ signatureUrl: string | null })
export async function getMySignature() {
    return fetchWithAuth('/api/v1/signatures/me');
}

// 내 결재 서명 등록 (base64 PNG — data URL 허용)
export async function registerMySignature(imageBase64: string) {
    return fetchWithAuth('/api/v1/signatures', {
        method: 'POST',
        body: JSON.stringify({ imageBase64 }),
    });
}

// 내 결재 서명 삭제
export async function deleteMySignature() {
    return fetchWithAuth('/api/v1/signatures', { method: 'DELETE' });
}

/**
 * 내 직책 변경 (관리자 전용).
 * 기관 직책 목록에서 고른 id를 보낸다. null이면 직책 없음 — 결재선·채팅에 '관리자'로 보인다.
 */
export async function updateMyPosition(positionId: number | null) {
    return fetchWithAuth('/api/v1/users/position', {
        method: 'PUT',
        body: JSON.stringify({ positionId }),
    });
}

/** 내 프로필 사진 등록/교체 (관리자 전용). 직원과 같은 규격 — jpg/png/webp, 5MB 이하 */
export async function uploadMyProfileImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const response = await fetch('/api/v1/users/profile-image', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error || '프로필 사진 업로드에 실패했습니다.');
    }
    return data as { profileImageUrl?: string };
}

/** 내 프로필 사진 삭제 (관리자 전용) */
export async function deleteMyProfileImage() {
    return fetchWithAuth('/api/v1/users/profile-image', { method: 'DELETE' });
}

/** 우리 기관 관리자 계정 목록 — 회원관리에서 직원과 한 표에 놓는다 */
export async function getCompanyAdmins() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/users/admins?companyId=${companyId}`);
}

// 기관명 변경 (관리자 전용)
export async function updateCompanyName(companyName: string) {
    return fetchWithAuth('/api/v1/users/company-name', {
        method: 'PUT',
        body: JSON.stringify({ companyName }),
    });
}

// 기관 주소 변경 (관리자 전용, 백엔드에서 지오코딩)
export async function updateCompanyAddress(companyAddress: string) {
    return fetchWithAuth('/api/v1/users/company-address', {
        method: 'PUT',
        body: JSON.stringify({ companyAddress }),
    });
}

// 기관 직인 등록 (관리자 전용, base64 PNG)
export async function uploadCompanySeal(imageBase64: string) {
    return fetchWithAuth('/api/v1/users/company-seal', {
        method: 'PUT',
        body: JSON.stringify({ imageBase64 }),
    });
}

// 기관 직인 삭제 (관리자 전용)
export async function deleteCompanySeal() {
    return fetchWithAuth('/api/v1/users/company-seal', { method: 'DELETE' });
}

// 내 기관 홈페이지 주소 조회 (관리자·직원 모두)
export async function getCompanyHomepage() {
    return fetchWithAuth('/api/v1/users/company-homepage');
}

// 기관 홈페이지 주소 등록/변경 (관리자 전용, 빈 문자열이면 해제)
/** 기관 홈페이지 목록 저장 (블로그·밴드 등 여러 개, 첫 항목이 대표) */
export async function updateCompanyHomepageLinks(links: { name: string; url: string }[]) {
    return fetchWithAuth('/api/v1/users/company-homepage-links', {
        method: 'PUT',
        body: JSON.stringify({ links }),
    });
}

export async function updateCompanyHomepage(homepageUrl: string) {
    return fetchWithAuth('/api/v1/users/company-homepage', {
        method: 'PUT',
        body: JSON.stringify({ homepageUrl }),
    });
}

// 결재 반려 (관리자)
export async function rejectApprovalRequest(id: string, reason: string, options?: { force?: boolean }) {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';
    const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : '';

    // force: 관리자 직권 반려 — 현재 결재 차례와 무관하게 반려
    return fetchWithAuth(`/api/v1/approvals/${id}?action=reject&processedBy=${userId}&processedByName=${encodeURIComponent(userName)}${options?.force ? '&force=true' : ''}`, {
        method: 'PUT',
        body: JSON.stringify({ reason }),
    });
}

// 일괄 승인 (관리자)
export async function bulkApproveApprovalRequests(ids: string[]) {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';
    const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : '';

    return fetchWithAuth(`/api/v1/approvals?action=bulk-approve&processedBy=${userId}&processedByName=${encodeURIComponent(userName)}`, {
        method: 'PUT',
        body: JSON.stringify({ ids: ids.map(id => parseInt(id)) }),
    });
}

// 일괄 반려 (관리자)
export async function bulkRejectApprovalRequests(ids: string[], reason: string) {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';
    const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : '';

    return fetchWithAuth(`/api/v1/approvals?action=bulk-reject&processedBy=${userId}&processedByName=${encodeURIComponent(userName)}`, {
        method: 'PUT',
        body: JSON.stringify({ ids: ids.map(id => parseInt(id)), reason }),
    });
}

// 결재 요청 취소 (직원)
export async function cancelApprovalRequest(id: string) {
    return fetchWithAuth(`/api/v1/approvals/${id}`, {
        method: 'DELETE',
    });
}

// 진행중 결재의 첨부파일 교체 (기안자 본인)
export async function updateApprovalAttachment(
    id: string,
    requesterId: string,
    attachment: { attachmentUrl: string; attachmentFileName?: string; attachmentFileSize?: number }
) {
    return fetchWithAuth(`/api/v1/approvals/${id}/attachment?requesterId=${encodeURIComponent(requesterId)}`, {
        method: 'PUT',
        body: JSON.stringify(attachment),
    });
}

// ================== 일정 API ==================

// 일정 목록 조회
export async function getSchedules(startDate: string, endDate: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedules?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}`);
}

// 일정 상세 조회
export async function getScheduleById(id: string) {
    return fetchWithAuth(`/api/v1/schedules/${id}`);
}

// 일정 등록
export async function createSchedule(data: {
    title: string;
    content?: string;
    category: string;
    labelId?: string | number | null;
    color?: string;
    location?: string;
    startDate: string;
    startTime?: string;
    endDate: string;
    endTime?: string;
    isAllDay: boolean;
    sendNotification: boolean;
    participantIds?: string[];
    managerId?: string | number | null;
    attachments?: {
        fileName: string;
        fileUrl: string;
        fileSize: number;
        mimeType: string;
    }[];
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }

    return fetchWithAuth(`/api/v1/schedules?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 일정 수정
export async function updateSchedule(id: string, data: {
    title?: string;
    content?: string;
    category?: string;
    labelId?: string | number | null;
    color?: string;
    location?: string;
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    isAllDay?: boolean;
    sendNotification?: boolean;
    participantIds?: string[];
    managerId?: string | number | null;
    attachments?: {
        fileName: string;
        fileUrl: string;
        fileSize: number;
        mimeType: string;
    }[];
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedules/${id}?companyId=${companyId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// 일정 수행완료 상태 변경 (진행도 체크)
export async function updateScheduleCompletion(id: string, completed: boolean) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedules/${id}/completion?companyId=${companyId}`, {
        method: 'PUT',
        body: JSON.stringify({ completed }),
    });
}

// ---------- 일정 할 일(담당자 업무) ----------

// 할 일 목록 조회
export async function getScheduleTasks(scheduleId: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedules/${scheduleId}/tasks?companyId=${companyId}`);
}

// 할 일 추가 (기관 구성원 누구나)
export async function createScheduleTask(
    scheduleId: string,
    data: { content: string; assigneeMemberId?: number | null }
) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedules/${scheduleId}/tasks?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 할 일 내용·담당자 수정
export async function updateScheduleTask(
    scheduleId: string,
    taskId: string,
    data: { content?: string; assigneeMemberId?: number | null }
) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedules/${scheduleId}/tasks/${taskId}?companyId=${companyId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// 할 일 수행완료 토글 (담당자 본인 또는 관리자)
export async function updateScheduleTaskCompletion(
    scheduleId: string,
    taskId: string,
    completed: boolean
) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(
        `/api/v1/schedules/${scheduleId}/tasks/${taskId}/completion?companyId=${companyId}`,
        { method: 'PUT', body: JSON.stringify({ completed }) }
    );
}

// 할 일 삭제
export async function deleteScheduleTask(scheduleId: string, taskId: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedules/${scheduleId}/tasks/${taskId}?companyId=${companyId}`, {
        method: 'DELETE',
    });
}

// 내 할 일 목록 (대시보드 위젯 / 내 업무 필터)
export async function getMyScheduleTasks(startDate?: string, endDate?: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    let url = `/api/v1/schedules/my-tasks?companyId=${companyId}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    return fetchWithAuth(url);
}

// 일정 삭제
export async function deleteSchedule(id: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/schedules/${id}?companyId=${companyId}`, {
        method: 'DELETE',
    });
}

// ================== 어르신 관리 API ==================

// 어르신 목록 조회
export async function getCompanyElders() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/v1/elders/company?companyId=${companyId}`);
}

// 어르신 수 조회 (대시보드용)
export async function getCompanyElderCount() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/v1/elders/company/count?companyId=${companyId}`);
}

// 어르신 추가
export async function addCompanyElder(data: {
    name: string;
    homeAddress?: string;
    requiredFrontSeat?: boolean;
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/v1/elders/company?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify({
            name: data.name,
            homeAddress: data.homeAddress || '',
            requiredFrontSeat: data.requiredFrontSeat || false,
        }),
    });
}

// 어르신 수정
export async function updateCompanyElder(id: string | number, data: {
    name: string;
    homeAddress?: string;
    requiredFrontSeat?: boolean;
}) {
    return fetchWithAuth(`/v1/elders/company/elder/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
            name: data.name,
            homeAddress: data.homeAddress || '',
            requiredFrontSeat: data.requiredFrontSeat || false,
        }),
    });
}

// 어르신 삭제
export async function deleteCompanyElder(id: string | number) {
    return fetchWithAuth(`/v1/elders/company/elder/${id}`, {
        method: 'DELETE',
    });
}

// ================== 출석 관리 API ==================

// 직원 출석 요약 (대시보드용)
export async function getEmployeeAttendanceSummary(date?: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    const d = date || new Date().toISOString().split('T')[0];
    return fetchWithAuth(`/v1/attendance/employee/summary?companyId=${companyId}&date=${d}`);
}

// 어르신 출석 요약 (대시보드용)
export async function getElderAttendanceSummary(date?: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    const d = date || new Date().toISOString().split('T')[0];
    return fetchWithAuth(`/v1/attendance/elder/summary?companyId=${companyId}&date=${d}`);
}

// 직원 출석 상세 목록
export async function getEmployeeAttendanceList(date?: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    const d = date || new Date().toISOString().split('T')[0];
    return fetchWithAuth(`/v1/attendance/employee?companyId=${companyId}&date=${d}`);
}

// 어르신 출석 상세 목록
export async function getElderAttendanceList(date?: string) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    const d = date || new Date().toISOString().split('T')[0];
    return fetchWithAuth(`/v1/attendance/elder?companyId=${companyId}&date=${d}`);
}

// 직원 출석 체크
export async function checkEmployeeAttendance(data: {
    memberId: number;
    status: string;
    note?: string;
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/v1/attendance/employee?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 어르신 출석 체크
export async function checkElderAttendance(data: {
    elderlyId: number;
    status: string;
    note?: string;
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/v1/attendance/elder?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 직원 일괄 출석 체크
export async function bulkCheckEmployeeAttendance(data: Array<{
    memberId: number;
    status: string;
    note?: string;
}>) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/v1/attendance/employee/bulk?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 어르신 일괄 출석 체크
export async function bulkCheckElderAttendance(data: Array<{
    elderlyId: number;
    status: string;
    note?: string;
}>) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/v1/attendance/elder/bulk?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// ================== 채팅 API ==================

// 채팅방 목록 조회
export async function fetchChatRooms() {
    const companyId = getCompanyId();
    // 채팅은 관리자/직원을 접두사로 구분한다 ([[chatIdentity]] 참고)
    const userId = getMyChatUserId() || '';
    return fetchWithAuth(`/api/v1/chat/rooms?companyId=${companyId}&userId=${userId}`);
}

// 채팅 메시지 조회
export async function fetchChatMessages(roomId: number, page = 0, size = 50) {
    const userId = getMyChatUserId() || '';
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (userId) params.append('userId', userId);
    return fetchWithAuth(`/api/v1/chat/rooms/${roomId}/messages?${params.toString()}`);
}

// 채팅 읽음 처리
export async function markChatAsRead(roomId: number, lastMessageId: number) {
    const userId = getMyChatUserId() || '';
    const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : '';
    return fetchWithAuth(`/api/v1/chat/rooms/${roomId}/read`, {
        method: 'POST',
        body: JSON.stringify({ userId, userName, lastMessageId }),
    });
}

// 채팅 메시지 전송
export async function sendChatMessage(roomId: number, data: {
    senderId: string;
    senderName: string;
    type: string;
    content: string;
    replyToId?: number | null;
    // 파일·사진 메시지 (업로드 후 결과를 그대로 실어 보낸다)
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
}) {
    return fetchWithAuth(`/api/v1/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * 채팅 파일·사진 전송 (업로드 + 메시지 생성을 서버가 한 번에 처리)
 *
 * 일반 파일 업로드 API와 달리 서버가 열람 가능한 절대 URL을 만들어 돌려주므로,
 * 웹·앱이 같은 형식의 파일 메시지를 갖게 된다.
 */
export async function uploadChatFile(roomId: number, file: File, senderId: string, senderName: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('senderId', senderId);
    formData.append('senderName', senderName);

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const response = await fetch(`/api/v1/chat/rooms/${roomId}/files`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || '파일 전송에 실패했습니다');
    }
    return response.json();
}

// ================== 기관 전용 자료실 ==================

/** 우리 기관 자료 목록 */
export async function fetchCompanyLibrary() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/company-library?companyId=${companyId}`);
}

/** 자료 등록 — 파일은 공용 업로드 API로 먼저 올리고 그 결과를 실어 보낸다 */
export async function createCompanyLibraryItem(data: {
    title: string;
    description?: string;
    category?: string;
    fileName: string;
    fileSize: number;
    filePath: string;
    uploaderId: string;
    uploaderName: string;
}) {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/company-library?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/** 자료 삭제 */
export async function deleteCompanyLibraryItem(id: number) {
    return fetchWithAuth(`/api/v1/company-library/${id}`, { method: 'DELETE' });
}

/** 지금 접속 중인 사람들의 userId */
export async function fetchOnlineUserIds() {
    const companyId = getCompanyId();
    if (!companyId) {
        throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
    }
    return fetchWithAuth(`/api/v1/presence?companyId=${companyId}`);
}

/** 방에서 주고받은 파일·사진 모아보기 */
export async function fetchChatSharedFiles(roomId: number) {
    return fetchWithAuth(`/api/v1/chat/rooms/${roomId}/files`);
}

/** 방 안 메시지 검색 */
export async function searchChatMessages(roomId: number, keyword: string) {
    return fetchWithAuth(`/api/v1/chat/rooms/${roomId}/messages/search?keyword=${encodeURIComponent(keyword)}`);
}

/**
 * 방 공지 설정/해제 — messageId가 null이면 공지를 내린다.
 * fileMessageId를 함께 주면 그 파일 메시지의 파일명·URL이 공지에 스냅샷된다.
 */
export async function updateChatRoomNotice(roomId: number, messageId: number | null, setByName: string, fileMessageId?: number | null) {
    return fetchWithAuth(`/api/v1/chat/rooms/${roomId}/notice`, {
        method: 'PUT',
        body: JSON.stringify({ messageId, setByName, fileMessageId }),
    });
}

// 채팅 리액션 토글
export async function toggleChatReaction(roomId: number, messageId: number, emoji: string) {
    const userId = getMyChatUserId() || '';
    const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : '';
    return fetchWithAuth(`/api/v1/chat/rooms/${roomId}/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ userId, userName, emoji }),
    });
}

// 채팅 메시지 삭제 — 서버가 지우지 않고 '삭제됨'으로 표시만 한다(소프트 삭제).
// 그래서 삭제 후에도 그 자리에 "삭제된 메시지입니다"가 남아 대화 흐름이 끊기지 않는다.
export async function deleteChatMessage(roomId: number, messageId: number) {
    return fetchWithAuth(`/api/v1/chat/rooms/${roomId}/messages/${messageId}`, {
        method: 'DELETE',
    });
}

// 채팅방 생성
export async function createChatRoom(data: { name: string; description?: string; creatorId: string; creatorName: string; participantIds: string[] }) {
    const companyId = getCompanyId();
    // 백엔드 ChatRoomCreateRequest는 createdBy/createdByName 필드명을 요구한다
    return fetchWithAuth(`/api/v1/chat/rooms?companyId=${companyId}`, {
        method: 'POST',
        body: JSON.stringify({
            name: data.name,
            description: data.description,
            createdBy: data.creatorId,
            createdByName: data.creatorName,
            participantIds: data.participantIds,
        }),
    });
}

// 채팅방 참가자 조회
export async function fetchChatParticipants(roomId: number) {
    return fetchWithAuth(`/api/v1/chat/rooms/${roomId}/participants`);
}

/** 기존 채팅방에 사람 초대. userIds는 채팅 식별자([[chatIdentity]]) */
export async function addChatParticipants(roomId: number, userIds: string[]) {
    return fetchWithAuth(`/api/v1/chat/rooms/${roomId}/participants`, {
        method: 'POST',
        body: JSON.stringify({ userIds }),
    });
}

// 채팅방 삭제
export async function deleteChatRoom(roomId: number) {
    return fetchWithAuth(`/api/v1/chat/rooms/${roomId}`, {
        method: 'DELETE',
    });
}


// ================== 공개 문의 접수 ==================

export interface ContactInquiryPayload {
    name: string;
    email: string;
    organization?: string;
    phone?: string;
    inquiryType?: string;
    message: string;
}

/**
 * 문의하기·제휴 광고 문의를 서버가 바로 메일로 발송한다.
 *
 * 이전에는 `mailto:`로 방문자의 메일 앱을 열어 직접 보내기를 누르게 했다.
 * 메일 앱이 없으면 아예 접수가 안 되고, 접수 여부도 확인할 수 없었다.
 * 비로그인 공개 엔드포인트라 인증 헤더를 붙이지 않는다.
 */
export async function submitContactInquiry(payload: ContactInquiryPayload): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
            data?.message || data?.error || '문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.',
        );
    }
}
