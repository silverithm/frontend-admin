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

// 회차 (한 차량이 하루에 두 번 도는 경우 1차/2차로 나눈다)
export type TripOrder = 1 | 2;

// 어르신 정보
export interface Senior {
  id: string;
  name: string;
  routeId: string; // 배정된 노선 ID (등원/하원 별도)
  boardingOrder: number; // 탑승 순서 (1부터 시작)
  elderlyId?: number; // 백엔드 Elderly 엔티티 ID (회원관리 연동)
  tripOrder?: TripOrder; // 회차. 비어 있으면 회차 구분 없는 노선
  personalPickup?: boolean; // 고정 설정: 항상 개인등원(보호자가 데려옴)
  personalDropoff?: boolean; // 고정 설정: 항상 개인하원(보호자가 데려감)
}

/**
 * @deprecated 출결은 백엔드 ElderAttendance로 통합됐다(ElderDayAttendance).
 * 구버전 앱이 배차설정 JSON의 seniorAbsences를 아직 읽고 있어 타입만 남겨둔다.
 */
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
  driver: RouteDriver | null; // 그날 운전대를 잡는 사람 (주운전자 또는 대체 부운전자)
  crew: RouteDriver[]; // 그날 그 차에 함께 타는 배정 인력 전원 (휴무자 제외). 공지 헤드라인용
  driverRole: DriverRole;
  status: DispatchStatus;
  passengers: Senior[]; // 탑승 어르신 목록 (결석·개인등하원 제외)
  tripGroups: TripGroup[]; // 회차별 탑승 명단. 회차 미사용 노선은 tripOrder 없는 그룹 1개
  originalMainDriver?: RouteDriver; // 대체 운행 시 원래 주운전자 정보
  reason?: string; // 배차 상태 사유 (예: "주운전자 홍길동 휴무로 부운전자 대체")
}

// 회차별 탑승 명단
export interface TripGroup {
  tripOrder?: TripOrder; // 없으면 회차 구분 없는 노선
  seniors: Senior[];
}

// 일일 배차 결과
export interface DailyDispatch {
  date: string; // yyyy-MM-dd 형식
  routeDispatches: RouteDispatch[];
  personalPickupSeniors: Senior[]; // 그날 개인등원인 어르신 (등원 배차표 헤더용)
  personalDropoffSeniors: Senior[]; // 그날 개인하원인 어르신 (하원 배차표 헤더용)
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
