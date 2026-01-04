// 차량 배차 관련 타입 정의

// 노선 유형
export type RouteType = '등원' | '하원';

// 노선에 배정된 운전자+차량 정보
export interface RouteDriver {
  driverId: string; // 운전자 ID (userId)
  driverName: string; // 운전자 이름
  vehicleName: string; // 차량명 (예: "스타리아", "카니발")
  vehicleCapacity: number; // 탑승 가능 인원
}

// 노선 정보
export interface Route {
  id: string;
  name: string; // 노선명 (예: "스타리아", "카니발")
  type: RouteType; // 등원/하원 구분
  routeDrivers: RouteDriver[]; // [주운전자, 부1, 부2, ...] - 운전자+차량 정보 직접 포함
}

// 어르신 정보
export interface Senior {
  id: string;
  name: string;
  routeId: string; // 배정된 노선 ID (등원/하원 별도)
  boardingOrder: number; // 탑승 순서 (1부터 시작)
}

// 어르신 결석 정보
export interface SeniorAbsence {
  seniorId: string;
  date: string; // yyyy-MM-dd 형식
  reason?: string;
}

// 배차 설정 데이터 (저장용)
export interface DispatchSettings {
  routes: Route[];
  seniors: Senior[];
}

// 운전자 역할
export type DriverRole = '주운전자' | '부1운전자' | '부2운전자' | '부3운전자' | null;

// 배차 상태
export type DispatchStatus = '정상' | '대체' | '운행없음' | '휴일';

// 노선별 배차 결과
export interface RouteDispatch {
  routeId: string;
  routeName: string;
  routeType: RouteType; // 등원/하원 구분
  driver: RouteDriver | null; // 운전자+차량 정보
  driverRole: DriverRole;
  status: DispatchStatus;
  passengers: Senior[]; // 탑승 어르신 목록 (결석자 제외)
  originalMainDriver?: RouteDriver; // 대체 운행 시 원래 주운전자 정보
  reason?: string; // 배차 상태 사유 (예: "주운전자 홍길동 휴무로 부운전자 대체")
}

// 일일 배차 결과
export interface DailyDispatch {
  date: string; // yyyy-MM-dd 형식
  routeDispatches: RouteDispatch[];
}

// 캘린더 셀 요약 정보
export interface DispatchDaySummary {
  date: string;
  normalCount: number; // 정상 운행 노선 수
  substituteCount: number; // 대체 운행 노선 수
  noServiceCount: number; // 운행 없음 노선 수
  totalRoutes: number;
  isHoliday: boolean; // 휴일 여부 (일요일 또는 공휴일)
  holidayName?: string; // 공휴일명 (예: "신정", "설날")
}

// VacationRequest 타입 (API 응답용 - vacation.ts와 호환)
export interface ApprovedVacation {
  id: string;
  userId: string;
  userName: string;
  date: string;
  status: 'approved';
}
