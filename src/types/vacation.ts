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

// 휴무 종류 (백엔드 vacation_requests.type 컬럼에 그대로 저장됨)
export type VacationKind = 'regular' | 'mandatory' | 'substitute';

// 휴무 종류/세부 유형만 뽑아 쓰기 위한 최소 형태 (VacationRequest 및 목록 행 타입 모두 수용)
export interface VacationTypeSource {
  type?: string;
  vacationType?: string;
}

// 대체휴무 여부 판별. 문자열(type)과 레코드 양쪽을 받는다.
export const isSubstituteVacation = (target?: string | VacationTypeSource): boolean => {
  if (!target) {
    return false;
  }

  if (typeof target === 'string') {
    return target === 'substitute';
  }

  return target.type === 'substitute' || target.vacationType === 'substitute';
};

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

// 레코드 기준 표시 라벨. 연차 미사용 휴무의 세부 유형(병가 등)이 있으면 그쪽을 우선 표시한다.
export const getVacationTypeLabelOf = (target: VacationTypeSource): string => {
  if (isSubstituteVacation(target)) {
    return '대체휴무';
  }

  return getVacationTypeLabel(target.vacationType || target.type);
};

export interface VacationRequest {
  id: string;
  userId: string;
  userName: string;
  date: string; // yyyy-MM-dd 형식
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'canceled' | 'unused';
  type: 'regular' | 'mandatory' | 'substitute' | 'sick' | 'other';
  vacationType?: string; // 연차 미사용 휴무의 세부 유형 (personal, sick, emergency, family, other, substitute)
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
