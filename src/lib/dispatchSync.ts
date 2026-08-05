// 배차 설정 서버 동기화.
//
// 예전에는 zustand persist로 관리자 브라우저 localStorage에만 저장했다. 그래서
// 다른 PC로 로그인하면 설정이 비어 보였고, 직원 앱은 주·부운전자를 알 수 없었다.
// 이제 서버가 원본이고 localStorage는 오프라인 캐시 역할만 한다.
//
// 흐름: 진입 시 서버에서 불러오고(없으면 로컬 설정을 한 번 올려 이전),
// 이후 설정이 바뀔 때마다 잠깐 모았다가 저장한다.

import type { DispatchSettings } from '@/types/dispatch';
import { useDispatchStore } from './dispatchStore';
import type { RemoteDriverRole } from './vacationGuard';

const SAVE_DEBOUNCE_MS = 800;

function getCompanyId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('companyId');
}

function hasToken(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('authToken');
}

function authHeaders(): Record<string, string> {
  const token = typeof window === 'undefined' ? null : localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 서버 저장이 진행 중이거나 방금 서버에서 불러온 직후엔 되돌려 저장하지 않는다 */
let isApplyingRemote = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function isEmpty(settings: DispatchSettings): boolean {
  return (settings.routes?.length ?? 0) === 0 && (settings.seniors?.length ?? 0) === 0;
}

/**
 * 서버에서 배차 설정을 불러와 스토어에 반영한다.
 * 서버가 비어 있고 로컬에만 설정이 있으면 한 번 올려서 이전한다(기존 사용자 보호).
 */
export async function loadDispatchSettings(): Promise<void> {
  const companyId = getCompanyId();
  if (!companyId || !hasToken()) return;

  try {
    const response = await fetch(`/api/v1/dispatch-settings?companyId=${companyId}`, {
      headers: authHeaders(),
    });
    if (!response.ok) return;

    const remote = (await response.json()) as Partial<DispatchSettings>;
    const remoteSettings: DispatchSettings = {
      routes: Array.isArray(remote?.routes) ? remote.routes : [],
      seniors: Array.isArray(remote?.seniors) ? remote.seniors : [],
    };

    const local = useDispatchStore.getState().settings;

    // 서버가 비었는데 이 브라우저에만 설정이 남아 있으면 그대로 올린다
    if (isEmpty(remoteSettings) && !isEmpty(local)) {
      await fetch(`/api/v1/dispatch-settings/migrate?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(local),
      }).catch(() => undefined);
      return;
    }

    isApplyingRemote = true;
    useDispatchStore.getState().setSettings(remoteSettings);
    // setSettings로 발생한 구독 알림이 처리된 뒤 플래그를 내린다
    setTimeout(() => {
      isApplyingRemote = false;
    }, 0);
  } catch (error) {
    // 서버가 잠시 안 되더라도 로컬 캐시로 계속 쓸 수 있어야 한다
    console.error('[배차설정] 서버 조회 실패:', error);
  }
}

/** 설정을 서버에 저장한다 (연속 변경은 모아서 한 번만) */
export function scheduleDispatchSave(settings: DispatchSettings): void {
  if (isApplyingRemote) return;
  const companyId = getCompanyId();
  if (!companyId || !hasToken()) return;

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fetch(`/api/v1/dispatch-settings?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      console.error('[배차설정] 서버 저장 실패:', error);
    }
  }, SAVE_DEBOUNCE_MS);
}

/** 설정 변경을 감지해 서버에 저장한다. 앱에서 한 번만 호출한다. */
export function startDispatchAutoSave(): () => void {
  let prev = useDispatchStore.getState().settings;
  return useDispatchStore.subscribe((state) => {
    if (state.settings === prev) return;
    prev = state.settings;
    scheduleDispatchSave(state.settings);
  });
}

/**
 * 특정 직원이 어느 노선의 무슨 운전자인지 서버에 묻는다.
 * 배차 설정을 통째로 받지 않아도 되므로 휴무 신청 화면에서 쓰기 좋다.
 */
export type { RemoteDriverRole };

export async function fetchDriverRoles(memberName: string): Promise<RemoteDriverRole[]> {
  const companyId = getCompanyId();
  if (!companyId || !memberName.trim()) return [];
  try {
    const response = await fetch(
      `/api/v1/dispatch-settings/driver-roles?companyId=${companyId}&memberName=${encodeURIComponent(memberName.trim())}`,
      { headers: authHeaders() },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as { roles?: RemoteDriverRole[] };
    return Array.isArray(data.roles) ? data.roles : [];
  } catch (error) {
    console.error('[배차설정] 운전자 역할 조회 실패:', error);
    return [];
  }
}
