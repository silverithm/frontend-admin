import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Route,
  Senior,
  SeniorAbsence,
  DispatchSettings,
} from '@/types/dispatch';

// 스토어 인터페이스
interface DispatchStore {
  // 상태
  settings: DispatchSettings;
  seniorAbsences: SeniorAbsence[];
  isHydrated: boolean;

  // 설정 전체 관리
  setSettings: (settings: DispatchSettings) => void;
  resetSettings: () => void;

  // 노선 관리
  addRoute: (route: Route) => void;
  updateRoute: (id: string, route: Partial<Route>) => void;
  deleteRoute: (id: string) => void;

  // 어르신 관리
  addSenior: (senior: Senior) => void;
  updateSenior: (id: string, senior: Partial<Senior>) => void;
  deleteSenior: (id: string) => void;
  updateSeniorOrder: (routeId: string, seniorIds: string[]) => void;

  // 어르신 결석 관리
  setSeniorAbsences: (absences: SeniorAbsence[]) => void;
  addSeniorAbsence: (absence: SeniorAbsence) => void;
  removeSeniorAbsence: (seniorId: string, date: string) => void;
  getSeniorAbsencesForDate: (date: string) => SeniorAbsence[];

  // Hydration
  setHydrated: (state: boolean) => void;
}

// 기본 설정 값
const defaultSettings: DispatchSettings = {
  routes: [],
  seniors: [],
};

// Zustand 스토어 생성 (persist 미들웨어로 localStorage 저장)
export const useDispatchStore = create<DispatchStore>()(
  persist(
    (set, get) => ({
      // 초기 상태
      settings: defaultSettings,
      seniorAbsences: [],
      isHydrated: false,

      // 설정 전체 관리
      setSettings: (settings) => set({ settings }),
      resetSettings: () => set({ settings: defaultSettings, seniorAbsences: [] }),

      // 노선 관리
      addRoute: (route) =>
        set((state) => ({
          settings: {
            ...state.settings,
            routes: [...state.settings.routes, route],
          },
        })),

      updateRoute: (id, routeUpdate) =>
        set((state) => ({
          settings: {
            ...state.settings,
            routes: state.settings.routes.map((r) =>
              r.id === id ? { ...r, ...routeUpdate } : r
            ),
          },
        })),

      deleteRoute: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            routes: state.settings.routes.filter((r) => r.id !== id),
            // 노선 삭제 시 해당 노선의 어르신들도 노선 배정 해제
            seniors: state.settings.seniors.map((s) =>
              s.routeId === id ? { ...s, routeId: '' } : s
            ),
          },
        })),

      // 어르신 관리
      addSenior: (senior) =>
        set((state) => ({
          settings: {
            ...state.settings,
            seniors: [...state.settings.seniors, senior],
          },
        })),

      updateSenior: (id, seniorUpdate) =>
        set((state) => ({
          settings: {
            ...state.settings,
            seniors: state.settings.seniors.map((s) =>
              s.id === id ? { ...s, ...seniorUpdate } : s
            ),
          },
        })),

      deleteSenior: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            seniors: state.settings.seniors.filter((s) => s.id !== id),
          },
          // 어르신 결석 정보도 삭제
          seniorAbsences: state.seniorAbsences.filter((a) => a.seniorId !== id),
        })),

      updateSeniorOrder: (routeId, seniorIds) =>
        set((state) => ({
          settings: {
            ...state.settings,
            seniors: state.settings.seniors.map((s) => {
              if (s.routeId === routeId) {
                const newOrder = seniorIds.indexOf(s.id);
                return newOrder >= 0 ? { ...s, boardingOrder: newOrder + 1 } : s;
              }
              return s;
            }),
          },
        })),

      // 어르신 결석 관리
      setSeniorAbsences: (absences) => set({ seniorAbsences: absences }),

      addSeniorAbsence: (absence) =>
        set((state) => {
          // 중복 체크
          const exists = state.seniorAbsences.some(
            (a) => a.seniorId === absence.seniorId && a.date === absence.date
          );
          if (exists) return state;
          return { seniorAbsences: [...state.seniorAbsences, absence] };
        }),

      removeSeniorAbsence: (seniorId, date) =>
        set((state) => ({
          seniorAbsences: state.seniorAbsences.filter(
            (a) => !(a.seniorId === seniorId && a.date === date)
          ),
        })),

      getSeniorAbsencesForDate: (date) => {
        return get().seniorAbsences.filter((a) => a.date === date);
      },

      // Hydration
      setHydrated: (state) => set({ isHydrated: state }),
    }),
    {
      name: 'dispatch-storage', // localStorage 키
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

// ID 생성 헬퍼 함수
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
