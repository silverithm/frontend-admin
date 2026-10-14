/**
 * 욕창(Braden)·낙상(Morse) 위험도 점수 — 서버가 최종 판정을 하고, 이 파일은 화면에서 미리 보여주려고 같은 규칙을 거울처럼 가진다.
 * 구간·허용값은 PLAN 계약(Scoring rules)과 글자 그대로 같아야 한다. 한쪽만 고치면 "화면은 중간, 저장하면 높음"이 된다.
 *
 * 근거: 2026 주야간보호 평가 '위험도평가' 지표는 2026.1월부터 모든 수급자를 반기(1~6월/7~12월)마다 1회 이상 평가하게 한다.
 * 항목 문구는 도구의 공개된 원 취지를 풀어 쓴 것이며, 현장 도구 원문과 대조해 쓰는 것이 안전하다.
 */
import type { CognitiveJudgment, CognitiveScores, CognitiveTool, RiskKind, RiskLatest, RiskLatestEntry, RiskLevel, ScaleKind } from './labTypes.ts';
import { formatYmd, parseYmd, seoulDateString } from './labDate.ts';

export interface RiskOption {
  value: number;
  label: string;
  hint: string;
}

export interface RiskItem {
  key: string;
  label: string;
  /** 직원이 보는 한 줄 질문 */
  question: string;
  options: RiskOption[];
}

const BRADEN_ITEMS: RiskItem[] = [
  {
    key: 'sensory',
    label: '지각 반응',
    question: '압박으로 인한 불편을 느끼고 표현할 수 있나요?',
    options: [
      { value: 1, label: '완전 제한', hint: '통증 자극에도 반응이 없거나, 몸 대부분이 통증을 느끼지 못함' },
      { value: 2, label: '매우 제한', hint: '통증에만 반응하고 불편을 말로 표현하기 어려움' },
      { value: 3, label: '약간 제한', hint: '말로 지시하면 반응하나 불편함을 항상 표현하지는 못함' },
      { value: 4, label: '장애 없음', hint: '말로 지시에 반응하고 불편함을 표현함' },
    ],
  },
  {
    key: 'moisture',
    label: '습기',
    question: '피부가 땀·소변·대변 등으로 얼마나 젖어 있나요?',
    options: [
      { value: 1, label: '항상 젖어 있음', hint: '움직이거나 돌려 눕힐 때마다 젖은 것이 확인됨' },
      { value: 2, label: '자주 젖어 있음', hint: '근무조(8시간)마다 한 번 이상 시트를 갈아야 함' },
      { value: 3, label: '가끔 젖어 있음', hint: '하루 한 번쯤 시트를 추가로 갈아야 함' },
      { value: 4, label: '거의 젖지 않음', hint: '피부가 대체로 마른 상태' },
    ],
  },
  {
    key: 'activity',
    label: '활동 상태',
    question: '신체 활동 정도는 어떤가요?',
    options: [
      { value: 1, label: '침상 안정', hint: '침대에서 벗어나지 못함' },
      { value: 2, label: '의자에 앉음', hint: '걷지 못하거나 체중을 거의 지탱하지 못해 의자·휠체어에 의지' },
      { value: 3, label: '가끔 걸음', hint: '낮에 가까운 거리를 걷지만 대부분 침대·의자에서 지냄' },
      { value: 4, label: '자주 걸음', hint: '깨어 있는 동안 적어도 2시간마다 걷는다' },
    ],
  },
  {
    key: 'mobility',
    label: '가동성',
    question: '체위를 스스로 바꾸거나 조절할 수 있나요?',
    options: [
      { value: 1, label: '전혀 움직이지 못함', hint: '도움 없이는 몸이나 팔다리 위치를 조금도 바꾸지 못함' },
      { value: 2, label: '매우 제한', hint: '가끔 조금씩 바꾸나 자주 또는 크게 바꾸지는 못함' },
      { value: 3, label: '약간 제한', hint: '스스로 자주 조금씩 몸의 위치를 바꿈' },
      { value: 4, label: '제한 없음', hint: '도움 없이 자주 큰 폭으로 체위를 바꿈' },
    ],
  },
  {
    key: 'nutrition',
    label: '영양',
    question: '평소 식사 섭취는 어느 정도인가요?',
    options: [
      { value: 1, label: '매우 불량', hint: '식사의 1/3 이하를 드시거나 금식·유동식 위주' },
      { value: 2, label: '부족', hint: '식사의 절반 정도, 또는 유동식·경관영양이 필요량에 못 미침' },
      { value: 3, label: '적절', hint: '식사의 절반을 넘게 드심' },
      { value: 4, label: '우수', hint: '대부분의 식사를 드시고 간식도 드심' },
    ],
  },
  {
    key: 'friction',
    label: '마찰과 전단력',
    question: '이동·자세 유지 중 피부가 끌리거나 미끄러지나요?',
    options: [
      { value: 1, label: '문제 있음', hint: '이동 시 상당한 도움이 필요하고 자주 침대·의자에서 미끄러짐' },
      { value: 2, label: '잠재적 문제', hint: '약한 도움이 필요하며 이동 중 피부가 끌릴 수 있음' },
      { value: 3, label: '문제 없음', hint: '스스로 움직이고 자세를 유지함' },
    ],
  },
];

const MORSE_ITEMS: RiskItem[] = [
  {
    key: 'history',
    label: '낙상 경험',
    question: '최근 3개월 안에 넘어진 적이 있거나 입원 중 낙상한 적이 있나요?',
    options: [
      { value: 0, label: '없음', hint: '최근 낙상 경험이 없음' },
      { value: 25, label: '있음', hint: '최근 3개월 안에 낙상한 적이 있음' },
    ],
  },
  {
    key: 'secondaryDiagnosis',
    label: '2개 이상의 진단명',
    question: '의무기록상 진단명이 2개 이상인가요?',
    options: [
      { value: 0, label: '아니오', hint: '진단명이 1개 이하' },
      { value: 15, label: '예', hint: '진단명이 2개 이상' },
    ],
  },
  {
    key: 'ambulatoryAid',
    label: '보행 보조',
    question: '걸을 때 무엇에 의지하나요?',
    options: [
      { value: 0, label: '없음·와상·간호사 도움', hint: '보조 도구 없이 걷거나, 침상 안정, 직원이 부축' },
      { value: 15, label: '지팡이·보행기', hint: '지팡이, 목발, 보행기 사용' },
      { value: 30, label: '가구를 짚고 걸음', hint: '걸을 때 가구(책상·의자·벽)를 의지함' },
    ],
  },
  {
    key: 'ivTherapy',
    label: '정맥 주입',
    question: '정맥 주사 또는 헤파린 락이 연결되어 있나요?',
    options: [
      { value: 0, label: '아니오', hint: '해당 없음' },
      { value: 20, label: '예', hint: '정맥 주입 중이거나 주입 라인 유지' },
    ],
  },
  {
    key: 'gait',
    label: '걸음걸이',
    question: '걷는 모습은 어떤가요?',
    options: [
      { value: 0, label: '정상·와상·휠체어', hint: '고개를 들고 팔을 자연스럽게 흔들며 걷거나, 걷지 않음' },
      { value: 10, label: '허약함', hint: '구부정하나 고개를 들 수 있고, 짚으면 균형을 잡음' },
      { value: 20, label: '장애 있음', hint: '일어서기 어렵고 가구를 짚어도 균형을 잃으며 고개를 숙이고 걸음' },
    ],
  },
  {
    key: 'mentalStatus',
    label: '인지 상태',
    question: '자신의 신체 능력과 한계를 알고 있나요?',
    options: [
      { value: 0, label: '인지함', hint: '스스로 할 수 있는 일과 못하는 일을 앎' },
      { value: 15, label: '과대평가·망각', hint: '자신의 능력을 과대평가하거나 한계를 잊음' },
    ],
  },
];

/**
 * 항목별 점수 도구의 항목. 인지기능(COGNITIVE)은 항목 점수가 아니라 도구·점수·판정 한 벌이라 항목이 없다
 * (그래서 RiskKind 전체로 색인해도 깨지지 않게 빈 목록을 둔다 — 인지 입력은 COGNITIVE_TOOLS·scoreAssessment가 맡는다).
 */
export const RISK_ITEMS: Readonly<Record<RiskKind, readonly RiskItem[]>> = {
  BRADEN: BRADEN_ITEMS,
  MORSE: MORSE_ITEMS,
  COGNITIVE: [],
};

/** 항목 점수를 합산하는 두 도구. 인지기능까지 합친 목록은 ALL_RISK_KINDS. */
export const RISK_KINDS: ReadonlyArray<{ id: ScaleKind; label: string; short: string }> = [
  { id: 'BRADEN', label: '욕창 위험도 (Braden)', short: '욕창' },
  { id: 'MORSE', label: '낙상 위험도 (Morse)', short: '낙상' },
];

/** 2026 매뉴얼 위험도평가의 세 기준: 욕창·낙상·인지기능 */
export const ALL_RISK_KINDS: ReadonlyArray<{ id: RiskKind; label: string; short: string }> = [
  ...RISK_KINDS,
  { id: 'COGNITIVE', label: '인지기능 평가', short: '인지' },
];

export function riskKindLabel(kind: RiskKind): string {
  return ALL_RISK_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

/** 세 평가 종류 중 하나인가 */
export function isRiskKind(value: unknown): value is RiskKind {
  return value === 'BRADEN' || value === 'MORSE' || value === 'COGNITIVE';
}

/** 항목 점수 도구(욕창·낙상)인가 — AI 점수 제안은 이 두 도구만 받는다. */
export function isScaleKind(value: unknown): value is ScaleKind {
  return value === 'BRADEN' || value === 'MORSE';
}

export function riskItemKeys(kind: RiskKind): string[] {
  return RISK_ITEMS[kind].map((i) => i.key);
}

export function allowedValues(kind: RiskKind, key: string): number[] {
  return RISK_ITEMS[kind].find((i) => i.key === key)?.options.map((o) => o.value) ?? [];
}

export type ScoreResult = { total: number; riskLevel: RiskLevel; error?: undefined } | { error: string };

// ---------- 인지기능 평가 ----------

export interface CognitiveToolInfo {
  id: CognitiveTool;
  label: string;
  /** 점수가 필수인 도구(KMMSE·CIST) */
  scoreRequired: boolean;
  /** 외부기관명이 필수인 도구 */
  institutionRequired: boolean;
  hint: string;
}

export const COGNITIVE_SCORE_MAX = 30;
export const COGNITIVE_INSTITUTION_MAX = 50;

/**
 * 인지기능 평가 도구 — 센터가 직접 하는 선별검사(K-MMSE·CIST)와, 기관 밖에서 받은 결과(외부 검사·치매 진단)를 같은 칸에 기록한다.
 * 선별검사는 진단이 아니다. 점수 기준은 교육 수준·연령에 따라 달라질 수 있어 판정은 직원이 확정한다.
 */
export const COGNITIVE_TOOLS: readonly CognitiveToolInfo[] = [
  { id: 'KMMSE', label: 'K-MMSE (한국판 간이정신상태검사)', scoreRequired: true, institutionRequired: false, hint: '30점 만점. 24점 이상 정상, 18~23점 의심, 17점 이하 인지저하가 기본 기준입니다.' },
  { id: 'CIST', label: 'CIST (치매선별검사)', scoreRequired: true, institutionRequired: false, hint: '30점 만점. 연령·교육 수준별 기준이 달라 판정은 직접 고릅니다.' },
  { id: 'EXTERNAL', label: '외부기관 검사', scoreRequired: false, institutionRequired: true, hint: '보건소·치매안심센터·병원 등에서 받은 검사 결과. 기관 이름을 적어 주세요.' },
  { id: 'DIAGNOSIS', label: '치매 진단 (진단서·소견서)', scoreRequired: false, institutionRequired: false, hint: '의사 진단서나 소견서로 확인된 경우. 기본 판정은 인지저하입니다.' },
];

export const COGNITIVE_JUDGMENTS: ReadonlyArray<{ id: CognitiveJudgment; label: string; hint: string }> = [
  { id: 'NORMAL', label: '정상', hint: '인지기능 저하가 의심되지 않음' },
  { id: 'SUSPECTED', label: '의심', hint: '저하가 의심되어 추적 관찰이 필요함' },
  { id: 'IMPAIRED', label: '인지저하', hint: '인지기능 저하가 확인됨' },
];

export function isCognitiveTool(value: unknown): value is CognitiveTool {
  return COGNITIVE_TOOLS.some((t) => t.id === value);
}

export function isCognitiveJudgment(value: unknown): value is CognitiveJudgment {
  return COGNITIVE_JUDGMENTS.some((j) => j.id === value);
}

export function cognitiveToolLabel(tool: CognitiveTool): string {
  return COGNITIVE_TOOLS.find((t) => t.id === tool)?.label ?? tool;
}

function isCognitiveScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= COGNITIVE_SCORE_MAX;
}

/**
 * 도구와 점수로 판정을 "제안"한다. 직원이 바꿀 수 있다.
 * K-MMSE: 24 이상 정상, 18~23 의심, 17 이하 인지저하 / CIST·외부기관은 제안하지 않음(null) / 치매 진단은 인지저하.
 * 점수가 없거나 0~30의 정수가 아니면 K-MMSE도 null — 잘못 입력한 점수로 판정을 만들지 않는다.
 */
export function suggestCognitiveJudgment(tool: CognitiveTool, score?: number | null): CognitiveJudgment | null {
  if (tool === 'DIAGNOSIS') return 'IMPAIRED';
  if (tool !== 'KMMSE') return null;
  if (!isCognitiveScore(score)) return null;
  if (score >= 24) return 'NORMAL';
  if (score >= 18) return 'SUSPECTED';
  return 'IMPAIRED';
}

/** 서버 규칙과 같은 인지기능 입력 검사. total은 점수(없으면 0), riskLevel은 판정 그대로. */
function scoreCognitive(scores: unknown): ScoreResult {
  if (typeof scores !== 'object' || scores === null || Array.isArray(scores)) return { error: '인지기능 평가 내용이 필요합니다' };
  const input = scores as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (key !== 'tool' && key !== 'score' && key !== 'judgment' && key !== 'institution') return { error: `알 수 없는 항목입니다: ${key}` };
  }
  if (!isCognitiveTool(input.tool)) return { error: '평가 도구를 선택해 주세요' };
  const info = COGNITIVE_TOOLS.find((t) => t.id === input.tool) as CognitiveToolInfo;
  const hasScore = input.score !== undefined && input.score !== null && input.score !== '';
  if (info.scoreRequired && !hasScore) return { error: `${info.id === 'KMMSE' ? 'K-MMSE' : 'CIST'} 점수를 입력해 주세요` };
  if (hasScore && !isCognitiveScore(input.score)) return { error: `점수는 0~${COGNITIVE_SCORE_MAX}점 사이의 정수여야 합니다` };
  if (!isCognitiveJudgment(input.judgment)) return { error: '판정(정상·의심·인지저하)을 선택해 주세요' };
  const institution = typeof input.institution === 'string' ? input.institution.trim() : '';
  if (info.institutionRequired && institution === '') return { error: '검사를 한 외부기관 이름을 적어 주세요' };
  if (Array.from(institution).length > COGNITIVE_INSTITUTION_MAX) return { error: `기관 이름은 ${COGNITIVE_INSTITUTION_MAX}자까지 적을 수 있습니다` };
  return { total: hasScore ? (input.score as number) : 0, riskLevel: input.judgment };
}

/** 화면에서 저장할 인지기능 scores를 정리한다(필요 없는 칸은 뺀다). 검증은 scoreAssessment로 따로 한다. */
export function cleanCognitiveScores(scores: CognitiveScores): CognitiveScores {
  const out: CognitiveScores = { tool: scores.tool, judgment: scores.judgment };
  if (scores.score !== undefined && scores.score !== null) out.score = scores.score;
  const institution = typeof scores.institution === 'string' ? scores.institution.trim() : '';
  if (scores.tool === 'EXTERNAL' && institution !== '') out.institution = institution;
  return out;
}

/** Braden: 점수가 낮을수록 위험하다(6~23). */
export function bradenLevel(total: number): RiskLevel {
  if (total <= 9) return 'VERY_HIGH';
  if (total <= 12) return 'HIGH';
  if (total <= 14) return 'MODERATE';
  if (total <= 18) return 'MILD';
  return 'NONE';
}

/** Morse: 점수가 높을수록 위험하다(0~125). */
export function morseLevel(total: number): RiskLevel {
  if (total <= 24) return 'LOW';
  if (total <= 44) return 'MODERATE';
  return 'HIGH';
}

/**
 * 항목별 점수를 합산해 위험 등급을 낸다.
 * 항목 누락·모르는 항목·허용값 밖 점수는 모두 오류다 — 조용히 보정하면 직원이 고르지 않은 점수가 기록에 남는다.
 */
export function scoreAssessment(kind: RiskKind, scores: unknown): ScoreResult {
  if (!isRiskKind(kind)) return { error: '평가 도구를 알 수 없습니다' };
  if (kind === 'COGNITIVE') return scoreCognitive(scores);
  if (typeof scores !== 'object' || scores === null || Array.isArray(scores)) return { error: '점수 항목이 필요합니다' };
  const input = scores as Record<string, unknown>;
  const items = RISK_ITEMS[kind];

  for (const key of Object.keys(input)) {
    if (!items.some((i) => i.key === key)) return { error: `알 수 없는 항목입니다: ${key}` };
  }
  let total = 0;
  for (const item of items) {
    const value = input[item.key];
    if (value === undefined || value === null) return { error: `'${item.label}' 항목을 선택해 주세요` };
    if (typeof value !== 'number' || !item.options.some((o) => o.value === value)) {
      return { error: `'${item.label}' 점수가 허용된 값이 아닙니다` };
    }
    total += value;
  }
  return { total, riskLevel: kind === 'BRADEN' ? bradenLevel(total) : morseLevel(total) };
}

const LEVEL_LABEL: Record<RiskLevel, string> = {
  NORMAL: '정상',
  SUSPECTED: '의심',
  IMPAIRED: '인지저하',
  VERY_HIGH: '매우 높음',
  HIGH: '높음',
  MODERATE: '중간',
  MILD: '약간 있음',
  NONE: '위험 낮음',
  LOW: '낮음',
};

export function riskLevelLabel(level: RiskLevel): string {
  return LEVEL_LABEL[level] ?? level;
}

/** 화면 색을 고르는 단계. 토큰 이름은 화면 쪽에서 정한다. */
export function riskLevelTone(level: RiskLevel): 'danger' | 'warning' | 'caution' | 'ok' {
  if (level === 'VERY_HIGH' || level === 'HIGH' || level === 'IMPAIRED') return 'danger';
  if (level === 'MODERATE') return 'warning';
  if (level === 'MILD' || level === 'SUSPECTED') return 'caution';
  return 'ok';
}

// ---------- 반기 점검 ----------

/** 한국 달력 기준 연도·반기(1 = 1~6월, 2 = 7~12월). */
function halfOf(ymd: { year: number; month: number }): { year: number; half: 1 | 2 } {
  return { year: ymd.year, half: ymd.month <= 6 ? 1 : 2 };
}

function todayYmd(today: Date) {
  const parsed = parseYmd(seoulDateString(today));
  if (!parsed) throw new RangeError('오늘 날짜를 읽을 수 없습니다');
  return parsed;
}

/**
 * 마지막 평가일이 "지금 반기" 안이면 DONE, 이전 반기면 DUE, 기록이 없으면 NEVER.
 * today는 어느 시간대의 Date든 한국 날짜로 바꿔 본다(6/30 23:30 KST와 7/1 00:10 KST가 다른 반기).
 */
export function halfYearStatus(lastAssessedOn: string | null | undefined, today: Date = new Date()): 'DONE' | 'DUE' | 'NEVER' {
  const last = parseYmd(lastAssessedOn ?? null);
  if (!last) return 'NEVER';
  const now = halfOf(todayYmd(today));
  const then = halfOf(last);
  // 미래 날짜(시계 오차·미리 입력)도 이번 반기 이상이면 끝난 것으로 본다.
  const nowIndex = now.year * 2 + now.half;
  const thenIndex = then.year * 2 + then.half;
  return thenIndex >= nowIndex ? 'DONE' : 'DUE';
}

/** 예: "2026년 하반기" */
export function currentHalfLabel(today: Date = new Date()): string {
  const now = halfOf(todayYmd(today));
  return `${now.year}년 ${now.half === 1 ? '상반기' : '하반기'}`;
}

/** 이번 반기의 마지막 날(6/30 또는 12/31). */
export function halfYearEnd(today: Date = new Date()): string {
  const now = halfOf(todayYmd(today));
  return now.half === 1 ? formatYmd(now.year, 6, 30) : formatYmd(now.year, 12, 31);
}

/** 이번 반기가 끝나기까지 남은 날수(오늘 포함하지 않음). 마지막 날이면 0. */
export function daysUntilHalfEnd(today: Date = new Date()): number {
  const t = todayYmd(today);
  const end = parseYmd(halfYearEnd(today));
  if (!end) return 0;
  const diff = Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(t.year, t.month - 1, t.day);
  return Math.round(diff / 86_400_000);
}

/** 한 어르신의 세 평가(욕창·낙상·인지)가 이번 반기에 각각 끝났는지. 인지 기록이 없는 옛 응답은 NEVER. */
export function elderHalfYearStatus(
  latest: Pick<RiskLatest, 'braden' | 'morse'> & { cognitive?: RiskLatestEntry | null },
  today: Date = new Date(),
): Record<RiskKind, 'DONE' | 'DUE' | 'NEVER'> {
  return {
    BRADEN: halfYearStatus(latest.braden?.assessedOn, today),
    MORSE: halfYearStatus(latest.morse?.assessedOn, today),
    COGNITIVE: halfYearStatus(latest.cognitive?.assessedOn, today),
  };
}

export interface HalfYearSummary {
  /** 어르신 수 */
  total: number;
  /** 종류별로 이번 반기에 평가를 마친 어르신 수 */
  done: Record<RiskKind, number>;
  /** 세 가지를 모두 마친 어르신 수 */
  allDone: number;
  /** 하나라도 남은 어르신의 elderlyId와 남은 종류 — 센터장이 "누가 빠졌나"를 바로 보게 */
  pending: Array<{ elderlyId: number; missing: RiskKind[] }>;
}

/**
 * 반기 점검 집계. 2026 평가는 욕창·낙상·인지기능 세 기준을 모든 수급자에게 반기마다 요구하므로
 * 한 가지라도 빠지면 그 어르신은 "남음"이다.
 */
export function halfYearSummary(
  list: ReadonlyArray<Pick<RiskLatest, 'elderlyId' | 'braden' | 'morse'> & { cognitive?: RiskLatestEntry | null }>,
  today: Date = new Date(),
): HalfYearSummary {
  const done: Record<RiskKind, number> = { BRADEN: 0, MORSE: 0, COGNITIVE: 0 };
  const pending: HalfYearSummary['pending'] = [];
  let allDone = 0;
  for (const elder of list) {
    const status = elderHalfYearStatus(elder, today);
    const missing: RiskKind[] = [];
    for (const kind of ['BRADEN', 'MORSE', 'COGNITIVE'] as const) {
      if (status[kind] === 'DONE') done[kind] += 1;
      else missing.push(kind);
    }
    if (missing.length === 0) allDone += 1;
    else pending.push({ elderlyId: elder.elderlyId, missing });
  }
  return { total: list.length, done, allDone, pending };
}
