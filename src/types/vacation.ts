// 휴가 기간 타입
export type VacationDuration = 'FULL_DAY' | 'HALF_DAY_AM' | 'HALF_DAY_PM';

// 휴가 기간 정보
export interface VacationDurationInfo {
  value: VacationDuration;
  displayName: string;
  description: string;
  days: number;
}

// 휴가 기간 옵션들
export const VACATION_DURATION_OPTIONS: VacationDurationInfo[] = [
  {
    value: 'FULL_DAY',
    displayName: '연차',
    description: '하루 종일',
    days: 1.0
  },
  {
    value: 'HALF_DAY_AM',
    displayName: '오전 반차',
    description: '오전 반일',
    days: 0.5
  },
  {
    value: 'HALF_DAY_PM',
    displayName: '오후 반차',
    description: '오후 반일',
    days: 0.5
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 휴무 종류 — 화면에서 고르고 보여주는 값은 아래 6가지가 전부다.
//
// 서버는 여전히 두 컬럼으로 나눠 저장한다.
//   vacation_requests.type      = regular | mandatory | substitute
//   vacation_requests.duration  = UNUSED | FULL_DAY | HALF_DAY_AM | HALF_DAY_PM  (연차 차감 단위)
// 아래 표가 그 두 컬럼과 화면 한 줄을 잇는 유일한 지점이다. 종류가 늘거나 라벨이
// 바뀌면 여기만 고치면 되고, 폼·목록·캘린더는 손대지 않아도 된다.
// ─────────────────────────────────────────────────────────────────────────────
export type VacationKind =
  | 'regular'
  | 'mandatory'
  | 'substitute'
  | 'annual'
  | 'half_am'
  | 'half_pm';

export interface VacationKindInfo {
  value: VacationKind;
  label: string;
  description: string;
  /** 서버 type 컬럼 값 */
  type: 'regular' | 'mandatory' | 'substitute';
  /** 서버 duration 컬럼 값. UNUSED면 연차를 차감하지 않는다 */
  duration: VacationDuration | 'UNUSED';
  /** 차감되는 연차 일수 */
  days: number;
  /** 캘린더 셀의 한 글자 배지 */
  short: string;
  /** 셀 배지 배경색 (CSS 변수) */
  color: string;
  /** Astryx Badge variant */
  badgeVariant: 'neutral' | 'orange' | 'teal' | 'blue' | 'green' | 'purple';
}

export const VACATION_KIND_OPTIONS: VacationKindInfo[] = [
  {
    value: 'regular',
    label: '일반휴무',
    description: '연차를 차감하지 않는 휴무',
    type: 'regular',
    duration: 'UNUSED',
    days: 0,
    short: '일',
    color: 'var(--color-icon-gray)',
    badgeVariant: 'neutral',
  },
  {
    value: 'mandatory',
    label: '필수휴무',
    description: '사유를 반드시 남기는 휴무',
    type: 'mandatory',
    duration: 'UNUSED',
    days: 0,
    short: '필',
    color: 'var(--color-icon-orange)',
    badgeVariant: 'orange',
  },
  {
    value: 'substitute',
    label: '대체휴무',
    description: '근무한 날을 대신 쉬는 휴무',
    type: 'substitute',
    duration: 'UNUSED',
    days: 0,
    short: '대',
    color: 'var(--color-icon-teal)',
    badgeVariant: 'teal',
  },
  {
    value: 'annual',
    label: '연차',
    description: '연차 1일 차감',
    type: 'regular',
    duration: 'FULL_DAY',
    days: 1,
    short: '연',
    color: 'var(--color-icon-blue)',
    badgeVariant: 'blue',
  },
  {
    value: 'half_am',
    label: '오전반차',
    description: '연차 0.5일 차감 · 오전',
    type: 'regular',
    duration: 'HALF_DAY_AM',
    days: 0.5,
    short: '반',
    color: 'var(--color-icon-green)',
    badgeVariant: 'green',
  },
  {
    value: 'half_pm',
    label: '오후반차',
    description: '연차 0.5일 차감 · 오후',
    type: 'regular',
    duration: 'HALF_DAY_PM',
    days: 0.5,
    short: '반',
    color: 'var(--color-icon-purple)',
    badgeVariant: 'purple',
  },
];

const DEFAULT_KIND = VACATION_KIND_OPTIONS[0];

export const getVacationKindInfo = (kind: VacationKind): VacationKindInfo =>
  VACATION_KIND_OPTIONS.find((option) => option.value === kind) ?? DEFAULT_KIND;

/**
 * 저장된 (type, duration)을 화면에서 쓰는 한 가지 종류로 되돌린다.
 *
 * 반차를 가장 먼저 보는 이유: 반차는 연차가 실제로 반일 차감된다는 뜻이라
 * 필수/대체 표시보다 근무·급여에 직접 영향을 준다.
 * 종류를 나누기 전에 만들어진 데이터는 duration이 대부분 FULL_DAY라 '연차'로 보인다.
 */
export const resolveVacationKind = (type?: string, duration?: string): VacationKindInfo => {
  const normalizedType = (type ?? '').trim().toLowerCase();
  const normalizedDuration = (duration ?? '').trim().toUpperCase();

  if (normalizedDuration === 'HALF_DAY_AM') return getVacationKindInfo('half_am');
  if (normalizedDuration === 'HALF_DAY_PM') return getVacationKindInfo('half_pm');
  if (normalizedType === 'substitute') return getVacationKindInfo('substitute');
  if (normalizedType === 'mandatory') return getVacationKindInfo('mandatory');
  if (normalizedDuration === 'FULL_DAY') return getVacationKindInfo('annual');
  return getVacationKindInfo('regular');
};

export const getVacationKindLabel = (type?: string, duration?: string): string =>
  resolveVacationKind(type, duration).label;

/** 폼에서 고른 종류를 서버가 받는 필드로 편다 */
export const toVacationRequestFields = (kind: VacationKind) => {
  const info = getVacationKindInfo(kind);
  return {
    type: info.type,
    duration: info.duration,
    useAnnualLeave: info.duration !== 'UNUSED',
  };
};

// 대체휴무 여부 판별
export const isSubstituteVacation = (type?: string): boolean => type === 'substitute';

// 휴무 유형 한글 라벨 (신청 종류 + 연차 미사용 시 세부 유형 모두 처리)
export const getVacationTypeLabel = (type?: string): string => {
  switch (type) {
    case 'regular':
      return '일반 휴무';
    case 'mandatory':
      return '필수 휴무';
    case 'substitute':
      return '대체휴무';
    case 'personal':
      return '개인 휴무';
    case 'sick':
      return '병가';
    case 'emergency':
      return '긴급 휴무';
    case 'family':
      return '가족 돌봄 휴무';
    default:
      return type || '일반 휴무';
  }
};

export interface VacationRequest {
  id: string;
  userId: string;
  userName: string;
  date: string; // yyyy-MM-dd 형식
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'canceled' | 'unused';
  type: 'regular' | 'mandatory' | 'substitute' | 'sick' | 'other';
  role: string;
  duration: VacationDuration; // 휴가 기간 (연차/반차)
  createdAt: string;
  updatedAt: string;
  password?: string;  // 등록 시 입력한 비밀번호 (삭제 시 확인용)
}

export interface VacationLimit {
  id?: string;
  date: string; // yyyy-MM-dd 형식
  maxPeople: number;
  role: string; // 역할별 제한 추가
  createdAt?: string;
}

export interface DayInfo {
  date: string;
  count: number;
  people: VacationRequest[];
  vacations?: VacationRequest[]; // 캘린더 셀에 표시할 휴가 정보
  limit?: VacationLimit | number;
  status?: 'available' | 'full' | 'over';
}

export interface CalendarProps {
  onDateSelect?: (date: Date | null) => void;
  onRequestSelect?: (date: Date) => Promise<void>;
  isAdmin?: boolean;
  maxPeopleAllowed?: number;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
}

export interface VacationDetailsProps {
  date: Date | null;
  vacations: VacationRequest[];
  isLoading: boolean;
  onApplyVacation: () => void;
  onClose: () => void;
  onVacationUpdated: () => Promise<void>;
  maxPeople?: number;
  roleFilter?: string;
  isAdmin?: boolean;
}

export interface VacationFormProps {
  initialDate: Date | null;
  onSubmitSuccess: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  roleFilter?: string;
  roleOptions?: string[];
}

export interface AdminPanelProps {
  currentDate: Date;
  onClose: () => void;
  onUpdateSuccess: () => void | Promise<void>;
}

// 휴가 데이터 인터페이스
export interface VacationData {
  [date: string]: {
    date: string;
    totalVacationers: number;
    vacations: VacationRequest[];
    people?: VacationRequest[]; // API 응답 구조와의 호환성
    maxPeople?: number; // 각 날짜별 최대 인원 제한
  };
} 
