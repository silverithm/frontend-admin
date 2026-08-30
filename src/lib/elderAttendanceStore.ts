// 어르신 출결 스토어.
//
// 예전에는 결석이 배차설정 JSON(dispatchStore.seniorAbsences)에만 있었고,
// 대시보드 출석통계는 백엔드 elder_attendance 테이블을 따로 봤다. 같은 "결석"이
// 두 군데에 따로 살아서 화면마다 숫자가 달랐다.
//
// 이제 백엔드 elder_attendance가 유일한 원본이다. 개인등원/개인하원도 여기에 있다.
// 배차설정 JSON의 seniorAbsences는 구버전 앱 호환을 위해 필드만 남겨두고 쓰지 않는다.

import { create } from 'zustand';
import type { ElderDayAttendance } from '@/types/attendance';
import type { Senior } from '@/types/dispatch';
import {
  getElderAttendanceRange,
  bulkCheckElderAttendance,
} from './apiService';

/** 백엔드 status 문자열 -> 화면 표기 */
function toStatus(raw: string): '출석' | '결석' {
  return raw === 'ABSENT' ? '결석' : '출석';
}

/** 화면 표기 -> 백엔드 status 문자열 */
export function toBackendStatus(status: '출석' | '결석'): string {
  return status === '결석' ? 'ABSENT' : 'PRESENT';
}

interface RemoteRecord {
  elderlyId: number;
  date?: string;
  status: string;
  personalPickup?: boolean;
  personalDropoff?: boolean;
  note?: string;
}

function normalize(raw: RemoteRecord, fallbackDate: string): ElderDayAttendance {
  return {
    elderlyId: raw.elderlyId,
    date: raw.date || fallbackDate,
    status: toStatus(raw.status),
    personalPickup: !!raw.personalPickup,
    personalDropoff: !!raw.personalDropoff,
    note: raw.note,
  };
}

const keyOf = (a: { elderlyId: number; date: string }) => `${a.elderlyId}@${a.date}`;

interface ElderAttendanceStore {
  records: ElderDayAttendance[];
  loadedRanges: string[]; // "start~end" 형태. 같은 범위를 두 번 받지 않기 위한 표시
  isLoading: boolean;

  loadRange: (startDate: string, endDate: string, force?: boolean) => Promise<void>;
  /** 낙관적 반영 후 서버 저장. 실패하면 이전 상태로 되돌린다. */
  saveRecords: (changes: ElderDayAttendance[]) => Promise<boolean>;
  getForDate: (date: string) => ElderDayAttendance[];
  findRecord: (elderlyId: number, date: string) => ElderDayAttendance | undefined;
}

/** 기존 records에 새 records를 덮어쓰며 합친다 (같은 어르신+날짜는 새 것이 이긴다) */
function merge(prev: ElderDayAttendance[], next: ElderDayAttendance[]): ElderDayAttendance[] {
  const map = new Map(prev.map((r) => [keyOf(r), r]));
  next.forEach((r) => map.set(keyOf(r), r));
  return Array.from(map.values());
}

export const useElderAttendanceStore = create<ElderAttendanceStore>()((set, get) => ({
  records: [],
  loadedRanges: [],
  isLoading: false,

  loadRange: async (startDate, endDate, force = false) => {
    const rangeKey = `${startDate}~${endDate}`;
    if (!force && get().loadedRanges.includes(rangeKey)) return;

    set({ isLoading: true });
    try {
      const data = await getElderAttendanceRange(startDate, endDate);
      const list: RemoteRecord[] = Array.isArray(data)
        ? data
        : (data?.attendances || data?.records || data?.content || []);

      set((state) => ({
        records: merge(
          state.records,
          list.map((raw) => normalize(raw, startDate))
        ),
        loadedRanges: state.loadedRanges.includes(rangeKey)
          ? state.loadedRanges
          : [...state.loadedRanges, rangeKey],
      }));
    } catch (error) {
      console.error('[출결] 기간 조회 실패:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  saveRecords: async (changes) => {
    if (changes.length === 0) return true;

    const before = get().records;
    set({ records: merge(before, changes) });

    try {
      await bulkCheckElderAttendance(
        changes.map((c) => ({
          elderlyId: c.elderlyId,
          date: c.date,
          status: toBackendStatus(c.status),
          personalPickup: c.personalPickup,
          personalDropoff: c.personalDropoff,
          note: c.note,
        }))
      );
      return true;
    } catch (error) {
      console.error('[출결] 저장 실패:', error);
      set({ records: before });
      return false;
    }
  },

  getForDate: (date) => get().records.filter((r) => r.date === date),

  findRecord: (elderlyId, date) =>
    get().records.find((r) => r.elderlyId === elderlyId && r.date === date),
}));

/**
 * 배차설정 JSON에 남아 있던 옛 결석을 백엔드 출결로 한 번만 올린다.
 *
 * elderlyId가 없는 레거시 항목은 이름으로 찾아 붙인다. 그래도 못 찾으면 건너뛴다
 * (지우지는 않는다 - 원본 JSON은 그대로 두고 새 저장소에만 채운다).
 */
const MIGRATION_FLAG = 'elderAttendanceMigratedFromAbsences';

export async function migrateLegacyAbsences(
  legacyAbsences: { seniorId: string; date: string }[],
  seniors: Senior[]
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_FLAG) === 'done') return;
  if (legacyAbsences.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, 'done');
    return;
  }

  const byId = new Map(seniors.map((s) => [s.id, s]));
  const changes: ElderDayAttendance[] = [];
  let skipped = 0;

  legacyAbsences.forEach((absence) => {
    const senior = byId.get(absence.seniorId);
    if (!senior || senior.elderlyId === undefined) {
      skipped += 1;
      return;
    }
    changes.push({
      elderlyId: senior.elderlyId,
      date: absence.date,
      status: '결석',
      personalPickup: false,
      personalDropoff: false,
    });
  });

  if (skipped > 0) {
    console.warn(`[출결] 레거시 결석 ${skipped}건은 어르신 연결이 없어 건너뛴다.`);
  }

  if (changes.length > 0) {
    const ok = await useElderAttendanceStore.getState().saveRecords(changes);
    if (!ok) return; // 실패하면 플래그를 세우지 않고 다음에 다시 시도한다
  }

  localStorage.setItem(MIGRATION_FLAG, 'done');
}
