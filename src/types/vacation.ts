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

export interface VacationRequest {
  id: string;
  userId: string;
  userName: string;
  date: string; // yyyy-MM-dd 형식
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'canceled';
  type: 'regular' | 'mandatory' | 'sick' | 'other';
  role: 'caregiver' | 'office' | 'all';  // 요양보호사, 사무실, 전체
  duration: VacationDuration; // 휴가 기간 (연차/반차)
  createdAt: string;
  updatedAt: string;
  password?: string;  // 등록 시 입력한 비밀번호 (삭제 시 확인용)
}

export interface VacationLimit {
  id?: string;
  date: string; // yyyy-MM-dd 형식
  maxPeople: number;
  role: 'caregiver' | 'office'; // 카테고리별 제한 추가
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
  roleFilter?: 'all' | 'caregiver' | 'office';
  isAdmin?: boolean;
}

export interface VacationFormProps {
  initialDate: Date | null;
  onSubmitSuccess: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  roleFilter?: 'all' | 'caregiver' | 'office';
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