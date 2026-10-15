/**
 * 위생·안전·시설 점검 — 점검표 양식과 "주기대로 했는가" 계산.
 *
 * 2026 평가의 안전·위생 지표는 "점검표가 정해진 주기대로 기록되어 있고, 지적된 사항의 조치가 남아 있는가"를 본다.
 * 그래서 양식(무엇을 보는가)과 주기(언제까지 했어야 하는가)를 한곳에 두고, 주기 계산은 운영일 목록을 받아 처리한다 —
 * 공휴일·임시 휴무로 안 연 날은 호출하는 쪽이 목록에서 빼면 "해야 했던 날"이 아니게 된다.
 *
 * 항목 문장은 점검원이 현장에서 보고 "예·아니오"로 답할 수 있게 썼다. 수치 기준(냉장 5℃, 냉동 -18℃, 보존식 144시간 등)은
 * 공개된 식품 위생 지침과 평가 매뉴얼의 요건을 우리 말로 옮긴 것이므로, 기관 규정이나 지자체 지침이 더 엄하면 그쪽을 따른다.
 * 공통 규칙: 모든 날짜는 한국 달력(labDate)이고, 기록이 있어도 "한 항목도 답하지 않은 빈 점검"은 한 것으로 세지 않는다.
 */
import type { SafetyCadence, SafetyCheck, SafetyItem, SafetyKind } from './labTypes.ts';
import { formatYmd, isValidMonth, parseYmd } from './labDate.ts';
import { addDays, mondayOf } from './programRules.ts';
import { weekStartsInMonth } from './mealRules.ts';

export interface SafetyTemplateItem {
  /** 서버 규칙 ^[A-Z0-9_]{2,30}$. 저장된 기록이 이 코드를 가리키므로 한번 정하면 바꾸지 않는다. */
  code: string;
  label: string;
}

export interface SafetyTemplate {
  kind: SafetyKind;
  label: string;
  cadence: SafetyCadence;
  /** 화면 안내(언제·누가·무엇을 근거로) */
  description: string;
  items: SafetyTemplateItem[];
}

export const SAFETY_KINDS: readonly SafetyKind[] = ['KITCHEN', 'HYGIENE', 'FIRE', 'FACILITY', 'VEHICLE', 'INFECTION', 'DRILL'];

export const SAFETY_CADENCE_LABEL: Readonly<Record<SafetyCadence, string>> = {
  DAILY: '운영일마다',
  WEEKLY: '주 1회',
  MONTHLY: '월 1회',
  TWICE_YEARLY: '연 2회(반기마다)',
};

/** 서버 한도 — 점검 한 건의 항목 수 */
export const MAX_SAFETY_ITEMS = 60;
export const MAX_SAFETY_NOTE = 200;
export const MAX_SAFETY_ACTIONS = 2000;

export const SAFETY_TEMPLATES: readonly SafetyTemplate[] = [
  {
    kind: 'KITCHEN',
    label: '급식·주방',
    cadence: 'DAILY',
    description: '조리 시작 전과 배식 후에 조리원이나 담당 직원이 확인합니다. 온도는 온도계에 찍힌 값을 비고에 적어 두면 평가 때 증빙이 됩니다.',
    items: [
      { code: 'FRIDGE_TEMP', label: '냉장고 내부 온도가 5℃ 이하이다 (온도계 값을 비고에 적는다)' },
      { code: 'FREEZER_TEMP', label: '냉동고 내부 온도가 -18℃ 이하이다 (온도계 값을 비고에 적는다)' },
      { code: 'FOOD_DATE', label: '냉장·냉동 식재료에 입고일과 소비기한이 적혀 있고, 기한이 지난 식재료가 없다' },
      { code: 'RAW_COOKED_SPLIT', label: '날 식재료(육류·생선·채소)와 익힌 음식을 칸을 나눠 보관하고, 칼·도마를 구분해 쓴다' },
      { code: 'CORE_TEMP', label: '가열 조리한 음식의 중심온도가 75℃ 이상(1분 이상)임을 온도계로 확인했다' },
      { code: 'UTENSIL_SANITIZE', label: '칼·도마·행주·식기를 사용한 뒤 세척하고 소독(열탕·소독액·자외선 등)했다' },
      { code: 'PRESERVED_FOOD', label: '오늘 조리·배식한 음식을 종류별로 1인분씩 소독한 용기에 담아 -18℃ 이하에 보관했고, 144시간(6일) 이상 보관 중인 지난 보존식에 빠진 날이 없다' },
      { code: 'COOK_HYGIENE', label: '조리원이 위생복·위생모·마스크를 착용하고 손을 씻은 뒤 조리를 시작했다 (손 상처·설사·발열 증상이 있는 조리원은 조리에서 뺐다)' },
      { code: 'HEALTH_CERT', label: '조리원 모두의 건강진단결과서(보건증)가 유효기간 안에 있다' },
      { code: 'LEFTOVER', label: '배식하고 남은 음식은 폐기했고 다시 내놓지 않았다. 음식물 쓰레기통은 뚜껑이 닫혀 있다' },
      { code: 'DIET_FORM_CHECK', label: '배식 전에 다진식·죽식 어르신의 식판이 맞게 준비되었고, 식사 형태가 다른 식판이 바뀌지 않았다' },
    ],
  },
  {
    kind: 'HYGIENE',
    label: '시설 위생·청소',
    cadence: 'DAILY',
    description: '어르신이 오시기 전과 가신 뒤, 담당 직원이 돌며 확인합니다. 소독한 곳은 시간을 비고에 남깁니다.',
    items: [
      { code: 'HAND_SUPPLY', label: '화장실·세면대에 손 씻기용 물비누와 일회용 수건(또는 손 건조기)이 채워져 있다' },
      { code: 'RESTROOM_CLEAN', label: '화장실·목욕실 바닥과 변기를 청소하고 소독했으며 냄새가 나지 않는다' },
      { code: 'TOUCH_DISINFECT', label: '문손잡이·난간·테이블·리모컨 등 손이 자주 닿는 곳을 소독했다' },
      { code: 'VENTILATION', label: '오늘 2회 이상 창문을 열어 환기했다 (환기한 시간을 비고에 적는다)' },
      { code: 'ROOM_TEMP', label: '실내 온도와 습도가 정해 둔 범위 안이다 (예: 겨울 20~24℃, 여름 24~26℃, 습도 40~60%)' },
      { code: 'WASTE_HANDLING', label: '기저귀·오물 등 쓰레기를 뚜껑 있는 용기에 모아 당일 내보냈다' },
      { code: 'LINEN', label: '침구·담요·수건·방석 중 더러워진 것을 교체했고, 쓴 린넨은 따로 모아 세탁했다' },
      { code: 'PEST', label: '바퀴벌레·파리·쥐 등 해충의 흔적이 없다' },
      { code: 'WATER_DISPENSER', label: '정수기 주변이 깨끗하고 필터 교체일이 지나지 않았다. 온수 온도가 화상 위험이 없게 맞춰져 있다' },
    ],
  },
  {
    kind: 'FIRE',
    label: '소방·전기·가스',
    cadence: 'MONTHLY',
    description: '매월 한 번, 소방안전관리자(또는 지정 담당자)가 시설을 돌며 확인합니다. 외부 업체의 법정 소방시설 점검과는 별개로 센터가 스스로 하는 점검입니다.',
    items: [
      { code: 'EXTINGUISHER', label: '소화기가 정해진 위치에 있고 압력 게이지가 정상(녹색) 범위이며 사용기한이 지나지 않았다' },
      { code: 'EXIT_CLEAR', label: '비상구와 피난 통로에 물건이 쌓여 있지 않고, 비상구 문이 잠기지 않은 채 열린다' },
      { code: 'EXIT_LIGHT', label: '유도등과 비상조명이 켜져 있고, 점검 버튼을 눌렀을 때 비상조명이 들어온다' },
      { code: 'ALARM_PANEL', label: '화재 수신반에 고장·경보 표시가 없고 감지기가 가려져 있지 않다' },
      { code: 'HYDRANT', label: '소화전과 스프링클러 헤드 앞을 가리는 물건이 없다' },
      { code: 'ELECTRIC', label: '멀티탭 과부하(한 구에 여러 개 연결)와 피복이 벗겨지거나 눌린 전선이 없고, 분전반 앞이 비어 있다' },
      { code: 'GAS_VALVE', label: '가스 밸브가 잠겨 있고(조리 시간 외), 가스 누설 경보기가 정상이며 호스에 갈라짐이 없다' },
      { code: 'EVAC_MAP', label: '대피도가 눈에 띄는 곳에 게시되어 있고 현재 방 배치와 일치한다' },
      { code: 'FIRE_OFFICER', label: '소방안전관리자 지정과 비상연락망이 게시되어 있고 최근 외부 소방시설 점검 결과서가 보관되어 있다' },
    ],
  },
  {
    kind: 'FACILITY',
    label: '안전환경·시설',
    cadence: 'MONTHLY',
    description: '매월 한 번, 어르신 동선을 따라 걸으며 낙상·화상·끼임 위험을 확인합니다. 고장 난 곳은 부적합으로 표시하고 조치를 남깁니다.',
    items: [
      { code: 'FLOOR_SLIP', label: '복도·화장실·목욕실 바닥이 젖어 있지 않고 미끄럼 방지 매트·테이프가 떨어지지 않았다' },
      { code: 'HANDRAIL', label: '복도·계단·화장실 손잡이가 흔들리지 않고 단단히 고정되어 있다' },
      { code: 'LIGHTING', label: '복도·계단·화장실의 조명이 모두 켜지고 어둡지 않다 (꺼진 등을 비고에 적는다)' },
      { code: 'CLEAR_PATH', label: '이동 동선과 비상 통로에 휠체어·보행기가 지나갈 폭이 있고 걸려 넘어질 물건(전선·턱·박스)이 없다' },
      { code: 'THRESHOLD', label: '문턱 단차와 바닥 파손(들뜬 장판·깨진 타일)이 없다' },
      { code: 'FURNITURE', label: '의자·테이블·침상이 흔들리거나 부러진 곳이 없고 날카로운 모서리에 보호대가 붙어 있다' },
      { code: 'EMERGENCY_BELL', label: '화장실·목욕실 비상벨을 눌러 작동하는지 확인했다' },
      { code: 'BATH_SAFETY', label: '목욕실 온수 온도가 화상 위험이 없는 범위(약 38~40℃)로 맞춰지고 목욕 의자가 안정적이다' },
      { code: 'WINDOW_LOCK', label: '창문 잠금장치와 방충망이 온전하고, 어르신이 떨어질 위험이 있는 열린 창이 없다' },
      { code: 'FIRST_AID_KIT', label: '구급함이 정해진 위치에 있고 소모품과 약품의 사용기한이 지나지 않았다' },
      { code: 'EMERGENCY_CONTACT', label: '응급 연락망(보호자·병원·119)이 사무실과 현관에 게시되어 있고 최신이다' },
    ],
  },
  {
    kind: 'VEHICLE',
    label: '차량 운행',
    cadence: 'DAILY',
    description: '송영 차량을 운행하는 날마다, 첫 운행 전에 운전자와 동승자가 확인합니다. 이상이 있으면 운행하지 않고 부적합으로 기록합니다.',
    items: [
      { code: 'PRE_TRIP', label: '운행 전에 타이어 공기압·마모, 계기판 경고등, 연료, 전조등·방향지시등·브레이크등을 점검했다' },
      { code: 'SEATBELT', label: '모든 좌석 안전벨트가 잘 잠기고 풀리며, 탑승 어르신이 전원 착용했다' },
      { code: 'CAR_EXTINGUISHER', label: '차량에 소화기가 비치되어 있고 압력 게이지가 정상이다' },
      { code: 'FIRST_AID_KIT', label: '차량 응급키트(소독제·거즈·붕대·장갑 등)가 비치되어 있고 사용기한이 지나지 않았다' },
      { code: 'LIFT', label: '휠체어 리프트·경사판·휠체어 고정 장치가 정상 작동하고 미끄럼 방지가 되어 있다' },
      { code: 'DRIVER_ALCOHOL', label: '운전자가 음주하지 않았음을 확인했다 (음주 측정 또는 대면 확인)' },
      { code: 'DRIVER_FATIGUE', label: '운전자의 피로·수면 부족·졸음이 오는 약 복용 여부를 확인했고 운행에 지장이 없다' },
      { code: 'ESCORT', label: '동승 직원이 탑승했고, 승하차 때 어르신 인원과 이름을 확인했다' },
      { code: 'CABIN_CLEAN', label: '차량 내부(좌석·손잡이)를 청소·소독했고 바닥에 걸림 물건이 없다' },
      { code: 'LEFT_BEHIND', label: '하차를 마친 뒤 차량 안에 남은 어르신이나 소지품이 없는지 끝까지 확인했다' },
    ],
  },
  {
    kind: 'INFECTION',
    label: '감염 관리',
    cadence: 'WEEKLY',
    description: '운영하는 주마다 한 번, 감염관리 담당자가 확인합니다. 감염병 유행 시기에는 같은 표를 더 자주 써도 됩니다.',
    items: [
      { code: 'SANITIZER_STOCK', label: '입구·식당·화장실의 손소독제가 비치되어 있고 잔량이 충분하다' },
      { code: 'PPE_STOCK', label: '마스크·장갑·가운·보안경 등 개인보호장비 비축량이 충분하고 사용기한이 지나지 않았다' },
      { code: 'DISINFECTANT', label: '소독제(락스 희석액 등)가 희석 농도·제조일을 적은 용기에 담겨 있고 유효기간 안이다' },
      { code: 'SYMPTOM_LOG', label: '이번 주 어르신·직원의 발열·기침·설사 등 증상 확인표가 매일 기록되어 있다' },
      { code: 'ISOLATION_ROOM', label: '증상이 있는 분을 보호자가 올 때까지 분리해 둘 공간이 정해져 있고 바로 쓸 수 있다' },
      { code: 'STAFF_RESTRICT', label: '증상이 있는 직원은 정해진 기준대로 출근을 제한했거나 마스크를 착용하고 근무했다' },
      { code: 'VACCINE_LIST', label: '어르신·직원의 독감 등 예방접종 현황 명단이 최신으로 갱신되어 있다' },
      { code: 'WASTE_SPLIT', label: '오염된 린넨과 감염 우려 쓰레기를 일반 쓰레기와 분리해 처리하고 있다' },
      { code: 'CONTACT_LIST', label: '보건소·관할 지자체 담당자 연락처가 최신으로 게시되어 있다' },
    ],
  },
  {
    kind: 'DRILL',
    label: '재난 대응 훈련',
    cadence: 'TWICE_YEARLY',
    description: '상반기·하반기에 각각 한 번, 화재나 지진을 가정해 실제로 대피해 보고 남깁니다. 훈련을 한 날 바로 이 표를 채웁니다.',
    items: [
      { code: 'SCENARIO', label: '훈련 상황(화재·지진 등)과 일시를 정했고 비고에 적었다' },
      { code: 'ALARM_CALL', label: '경보를 울리고 119에 신고하는 절차를 실제 순서대로 해 보았다' },
      { code: 'ROUTE', label: '대피 경로(복도·비상구·계단)를 실제로 걸어 보았고 막히거나 좁은 곳이 없었다' },
      { code: 'ROLES', label: '역할 분담(총괄·대피 유도·인명 확인·응급처치·신고)이 정해진 대로 수행되었다' },
      { code: 'MOBILITY_AID', label: '휠체어·보행기를 쓰는 어르신을 어떻게 대피시킬지 정해 두었고 이번에 해 보았다' },
      { code: 'HEADCOUNT', label: '집결지에서 어르신과 직원 인원을 명단과 대조해 확인했다' },
      { code: 'TIME_TAKEN', label: '경보부터 전원 대피까지 걸린 시간을 쟀다 (비고에 분·초를 적는다)' },
      { code: 'EXTINGUISHER_USE', label: '직원이 소화기 사용법을 실제로 익혔다 (핀 뽑기·조준·분사)' },
      { code: 'ATTENDANCE', label: '훈련에 참여한 직원 명단에 서명을 받았다' },
      { code: 'IMPROVEMENT', label: '훈련에서 드러난 문제와 보완할 점을 적었고, 조치 내용에 반영했다' },
    ],
  },
];

const TEMPLATE_BY_KIND: ReadonlyMap<SafetyKind, SafetyTemplate> = new Map(SAFETY_TEMPLATES.map((t) => [t.kind, t]));

export function isSafetyKind(value: unknown): value is SafetyKind {
  return typeof value === 'string' && TEMPLATE_BY_KIND.has(value as SafetyKind);
}

export function templateFor(kind: SafetyKind): SafetyTemplate {
  return TEMPLATE_BY_KIND.get(kind) as SafetyTemplate;
}

export function safetyKindLabel(kind: string): string {
  return isSafetyKind(kind) ? templateFor(kind).label : kind;
}

export function cadenceOf(kind: SafetyKind): SafetyCadence {
  return templateFor(kind).cadence;
}

/** 새 점검을 시작할 때의 항목들 — 전부 "아직 안 봄"(null)이다. */
export function blankItems(kind: SafetyKind): SafetyItem[] {
  return templateFor(kind).items.map((i) => ({ code: i.code, ok: null, note: '' }));
}

/** 항목 코드로 점검표 문장을 찾는다. 양식에서 빠진 옛 코드는 코드 그대로 돌려준다. */
export function itemLabel(kind: SafetyKind, code: string): string {
  return TEMPLATE_BY_KIND.get(kind)?.items.find((i) => i.code === code)?.label ?? code;
}

// ---------- 점검 결과 읽기 ----------

type CheckLike = Pick<SafetyCheck, 'items'> & Partial<Pick<SafetyCheck, 'kind' | 'checkDate'>>;

/** ok === false(부적합)인 항목만. true·null(아직 안 봄)은 빠진다. */
export function failedItems(check: CheckLike): SafetyItem[] {
  return (check?.items ?? []).filter((i) => i?.ok === false);
}

/** 부적합 항목을 점검표 문장과 함께 — AI 조치 제안의 입력(failed)과 같은 모양이다. */
export function failedWithLabels(check: CheckLike & { kind: SafetyKind }): Array<{ code: string; label: string; note: string }> {
  return failedItems(check).map((i) => ({ code: i.code, label: itemLabel(check.kind, i.code), note: typeof i.note === 'string' ? i.note : '' }));
}

/** 점검표에서 답한(적합·부적합) 항목 수 */
export function answeredCount(check: CheckLike): number {
  return (check?.items ?? []).filter((i) => i?.ok === true || i?.ok === false).length;
}

/** 양식 항목 중 아직 답하지 않은 것(양식에 없는 코드는 세지 않는다) */
export function unansweredCodes(check: CheckLike & { kind: SafetyKind }): string[] {
  const answered = new Set((check.items ?? []).filter((i) => i?.ok === true || i?.ok === false).map((i) => i.code));
  return (TEMPLATE_BY_KIND.get(check.kind)?.items ?? []).filter((i) => !answered.has(i.code)).map((i) => i.code);
}

/**
 * 점검을 "했다"고 세는 기준 — 적어도 한 항목에는 답이 있어야 한다.
 * 저장만 눌러 항목이 전부 비어 있는 기록이 평가용 점검 횟수를 채우면 안 되기 때문이다.
 */
export function isPerformed(check: CheckLike): boolean {
  return answeredCount(check) > 0;
}

// ---------- 주기 계산 ----------

export type SafetyPeriod = { month: string; operatingDays?: ReadonlyArray<string> } | { year: number };

export interface SafetyCoverage {
  /** 해낸 횟수(필요한 횟수 중 채운 것만 센다) */
  done: number;
  required: number;
  /**
   * 비어 있는 곳. DAILY는 날짜('YYYY-MM-DD'), WEEKLY는 그 주 월요일, MONTHLY는 'YYYY-MM',
   * TWICE_YEARLY는 'YYYY-H1'(상반기)·'YYYY-H2'(하반기).
   */
  missing: string[];
}

const EMPTY: SafetyCoverage = { done: 0, required: 0, missing: [] };

function dateKey(value: unknown): string | null {
  const p = parseYmd(typeof value === 'string' ? value : null);
  return p ? formatYmd(p.year, p.month, p.day) : null;
}

/** 그 종류의 "했다고 세는" 점검 날짜들(중복 제거, 형식이 잘못된 날짜 제외) */
function performedDates(checks: ReadonlyArray<Pick<SafetyCheck, 'kind' | 'checkDate' | 'items'>>, kind: SafetyKind): Set<string> {
  const out = new Set<string>();
  for (const c of checks ?? []) {
    if (c?.kind !== kind || !isPerformed(c)) continue;
    const d = dateKey(c.checkDate);
    if (d) out.add(d);
  }
  return out;
}

function operatingInMonth(month: string, operatingDays: ReadonlyArray<string> | undefined): string[] {
  const set = new Set<string>();
  for (const raw of operatingDays ?? []) {
    const d = dateKey(raw);
    if (d && d.startsWith(`${month}-`)) set.add(d);
  }
  return [...set].sort();
}

/**
 * 점검을 주기대로 했는가.
 *  · DAILY — 그 달 운영일마다 하나(운영일이 아닌 날의 점검은 필요한 횟수를 채우지 않는다)
 *  · WEEKLY — 그 달에 걸친 주(월~일)마다 하나. 그 달 운영일이 하나도 없는 주는 필요한 횟수에서 뺀다. 점검일은 그 주 안이면 달이 달라도 인정한다
 *  · MONTHLY — 그 달에 하나
 *  · TWICE_YEARLY — 그 해 상반기(1~6월)·하반기(7~12월) 각각 하나. 같은 반기에 두 번 해도 한 번으로 센다
 * 기간 모양이 종류와 맞지 않거나(DRILL에 운영일 없는 월만, DAILY에 year만 등 해석할 수 없을 때) 월이 잘못되면 필요 0으로 돌려준다.
 * DRILL에 {month}가 오면 그 달이 속한 해로 본다.
 */
export function safetyCoverage(checks: ReadonlyArray<Pick<SafetyCheck, 'kind' | 'checkDate' | 'items'>>, kind: SafetyKind, period: SafetyPeriod): SafetyCoverage {
  if (!isSafetyKind(kind) || !period) return { ...EMPTY, missing: [] };
  const cadence = cadenceOf(kind);
  const performed = performedDates(checks, kind);

  if (cadence === 'TWICE_YEARLY') {
    const year = 'year' in period ? period.year : Number(String(period.month).slice(0, 4));
    if (!Number.isInteger(year) || year < 1000 || year > 9999 || ('month' in period && !isValidMonth(period.month))) return { ...EMPTY, missing: [] };
    const halves = new Set<1 | 2>();
    for (const d of performed) {
      const p = parseYmd(d);
      if (p && p.year === year) halves.add(p.month <= 6 ? 1 : 2);
    }
    const missing = ([1, 2] as const).filter((h) => !halves.has(h)).map((h) => `${year}-H${h}`);
    return { done: halves.size, required: 2, missing };
  }

  if (!('month' in period) || !isValidMonth(period.month)) return { ...EMPTY, missing: [] };
  const month = period.month;

  if (cadence === 'MONTHLY') {
    const has = [...performed].some((d) => d.startsWith(`${month}-`));
    return { done: has ? 1 : 0, required: 1, missing: has ? [] : [month] };
  }

  const operating = operatingInMonth(month, period.operatingDays);

  if (cadence === 'DAILY') {
    const missing = operating.filter((d) => !performed.has(d));
    return { done: operating.length - missing.length, required: operating.length, missing };
  }

  // WEEKLY
  const weeks = weekStartsInMonth(month).filter((start) => operating.some((d) => mondayOf(d) === start));
  const missing = weeks.filter((start) => {
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(start, i);
      if (d && performed.has(d)) return false;
    }
    return true;
  });
  return { done: weeks.length - missing.length, required: weeks.length, missing };
}

export interface MonthlySafetySummary {
  done: number;
  required: number;
  /** 0~100. 필요한 점검이 없으면 100(해야 할 것이 없다) */
  percent: number;
  perKind: Array<{ kind: SafetyKind; label: string } & SafetyCoverage>;
}

/**
 * 이번 달 필수 점검 완료율 — 한 달 단위 종류(연 2회 DRILL 제외)의 필요 횟수를 모두 더한 것 대비 한 횟수.
 * 평가 준비 점검표의 SAFETY_CHECKS 자동 근거가 이 값을 쓴다. kinds를 주면 그 종류만 센다.
 */
export function monthlySafetySummary(
  checks: ReadonlyArray<Pick<SafetyCheck, 'kind' | 'checkDate' | 'items'>>,
  month: string,
  operatingDays: ReadonlyArray<string>,
  kinds?: ReadonlyArray<SafetyKind>,
): MonthlySafetySummary {
  const target = (kinds ?? SAFETY_KINDS).filter((k) => isSafetyKind(k) && cadenceOf(k) !== 'TWICE_YEARLY');
  const perKind = target.map((kind) => ({ kind, label: safetyKindLabel(kind), ...safetyCoverage(checks, kind, { month, operatingDays }) }));
  const done = perKind.reduce((n, k) => n + k.done, 0);
  const required = perKind.reduce((n, k) => n + k.required, 0);
  return { done, required, percent: required === 0 ? 100 : Math.floor((done / required) * 100), perKind };
}

/** 부적합 항목이 있는데 조치 내용이 비어 있는 점검 — "지적 사항에 조치를 했는가"를 평가가 본다 */
export function checksNeedingActions<T extends Pick<SafetyCheck, 'items' | 'actions'>>(checks: ReadonlyArray<T>): T[] {
  return checks.filter((c) => failedItems(c).length > 0 && (c.actions ?? '').trim() === '');
}

/**
 * 평가 지표별로 어떤 점검 종류가 근거인지. 평가 준비 화면이 SAFETY_CHECKS 자동 근거를 지표마다 따로 보여 줄 때 쓴다.
 * SAFE-07(재난 대응과 소방 안전)의 재난훈련은 DRILL_TWICE가 맡으므로 월 점검 종류에는 넣지 않았다.
 * [12차] SAFE-04는 autoSource가 INFECTION_CONTROL이 되었지만 감염 일상 점검 줄은 이 표의 INFECTION을 그대로 쓴다(분기 전문소독은 시설 관리 대장).
 */
export const EVAL_SAFETY_KINDS: Readonly<Record<string, readonly SafetyKind[]>> = {
  'SAFE-02': ['HYGIENE'],
  'SAFE-03': ['KITCHEN'],
  'SAFE-04': ['INFECTION'],
  'SAFE-06': ['FACILITY', 'FIRE', 'VEHICLE'],
};
