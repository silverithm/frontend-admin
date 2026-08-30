export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  vacation: number;
}

export interface ElderAttendanceSummary {
  total: number;
  present: number;
  absent: number;
  personalPickup?: number;
  personalDropoff?: number;
}

export interface EmployeeAttendanceRecord {
  id: number;
  memberId: number;
  memberName: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  note?: string;
}

export interface ElderAttendanceRecord {
  id: number;
  elderlyId: number;
  elderlyName: string;
  date?: string; // yyyy-MM-dd (구버전 응답에는 없다)
  status: string;
  personalPickup?: boolean;
  personalDropoff?: boolean;
  note?: string;
}

// ===== 어르신 출결 (백엔드 ElderAttendance 통합) =====

export type ElderAttendanceStatusValue = '출석' | '결석';

/** 백엔드 status 문자열 ↔ 화면 표기 */
export const ELDER_ATTENDANCE_STATUS = {
  PRESENT: '출석',
  ABSENT: '결석',
} as const;

/**
 * 어르신 하루치 출결.
 * 결석(status)과 개인등하원(personalPickup/personalDropoff)은 별개다.
 * "개인등원하고 차량으로 하원" 같은 조합이 실제로 존재하기 때문.
 */
export interface ElderDayAttendance {
  elderlyId: number;
  date: string; // yyyy-MM-dd
  status: ElderAttendanceStatusValue;
  personalPickup: boolean;
  personalDropoff: boolean;
  note?: string;
}
