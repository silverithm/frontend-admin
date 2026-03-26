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
  status: string;
  note?: string;
}
