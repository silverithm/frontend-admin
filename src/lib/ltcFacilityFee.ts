/**
 * 2026년 요양원(노인요양시설)·노인요양공동생활가정 급여비용(수가) — /ltc/nursing-home-fee-2026 페이지의 원장.
 *
 * 금액 하나가 틀리면 입소 상담·청구를 잘못 안내하게 된다. 값을 고칠 때는 반드시 아래 원문을 다시 열어 대조한다.
 * - 「장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시」(보건복지부고시 제2026-189호, 2026.10.1. 시행)
 *   제44조제1항제1호 표(그림 flSeq=169768535), 제2호 표(169768217), 제44조제2항 표(169768539),
 *   제74조제2항 표(169768599) — 국가법령정보센터 본문에 그림(GIF)으로만 실려 있다.
 *   2026-11-28에 그림을 내려받아 3배 확대해 칸마다 읽고, 국민건강보험공단 건강Law의 제2025-247호
 *   (2025.12.30. 발령, 2026.1.1. 시행) 개정전문 PDF의 같은 표(글자)와 15칸 모두 일치함을 확인했다.
 *   고시 부칙 목록에서 제2025-247호 다음 개정이 제2026-189호이고, 그 개정이유(제4조·제11조의8·별표 2·제22조)에
 *   시설급여 표가 없으므로 2026년 1월 1일부터 같은 금액이다.
 * - 산정 규칙: 제2조제2항(3~5등급은 등급판정위원회 인정 시), 제44조제1항 본문(2.1명당 반올림)·제3호·제3항,
 *   제45조(제38조 준용·외박 50%·동일부지), 제38조제1항·제2항·제4항, 제46조(외박 10일·특례입소),
 *   제71조(치매전담형 이용대상자), 제75조제1항(90%)·제4항(1·2등급 변경 시 바-1·바-2·바-7·바-8), 제66조제4항.
 * - 본인부담률: 노인장기요양보험법 시행령 제15조의8제2호(시설급여 100분의 20), 법 제40조.
 * - 비급여대상: 노인장기요양보험법 시행규칙 제14조제1항, 게시 의무 제15조.
 * - 시설급여 월 한도액: 시행규칙 제22조제2항(1일당 급여비용 × 월간 일수), 법 제28조.
 *
 * 금액은 원 단위 정수로 셈한다. 표의 금액이 모두 10원 단위라 20%·50%를 곱해도 원 미만이 생기지 않는다
 * (예외가 생기면 테스트가 잡는다). 비율은 정수 퍼센트로 들고 있다가 /100 한다.
 */

/** 원문을 마지막으로 대조한 날. 페이지의 "원문 대조"와 구조화 데이터 dateModified로 쓴다. */
export const FACILITY_FEE_VERIFIED_AT = '2026-11-28';

/** 표의 '분류' — 1등급, 2등급, 3~5등급(노인요양시설·공동생활가정은 제2조제2항 단서에 따른 3~5등급) */
export type FacilityGradeGroup = '1' | '2' | '3-5';

export type FacilityFeeCode = '바-1' | '바-2' | '바-3' | '바-4' | '바-5' | '바-6' | '바-7' | '바-8' | '바-9';

export interface FacilityFeeRow {
  code: FacilityFeeCode;
  grade: FacilityGradeGroup;
  /** 1일당 급여비용(원) */
  fee: number;
}

export type FacilityTableId = 'nursingHome1' | 'nursingHome2' | 'groupHome';

export interface FacilityFeeTable {
  id: FacilityTableId;
  /** 화면 제목 */
  label: string;
  /** 표가 적용되는 조건(원문 문장 그대로) */
  condition: string;
  basis: string;
  rows: ReadonlyArray<FacilityFeeRow>;
}

/** 고시 제44조 — 원문 순서 그대로. */
export const FACILITY_FEE_TABLES_2026: ReadonlyArray<FacilityFeeTable> = [
  {
    id: 'nursingHome1',
    label: '노인요양시설 — 요양보호사 입소자 2.1명당 1명 이상',
    condition: '노인요양시설에서 배치한 요양보호사 수가 입소자 2.1명당 1명 이상인 경우',
    basis: '제44조제1항제1호',
    rows: [
      { code: '바-1', grade: '1', fee: 93070 },
      { code: '바-2', grade: '2', fee: 86340 },
      { code: '바-3', grade: '3-5', fee: 81540 },
    ],
  },
  {
    id: 'nursingHome2',
    label: '노인요양시설 — 요양보호사 입소자 2.1명당 1명 미만',
    condition: '노인요양시설에서 배치한 요양보호사 수가 입소자 2.1명당 1명 미만인 경우',
    basis: '제44조제1항제2호',
    rows: [
      { code: '바-4', grade: '1', fee: 88520 },
      { code: '바-5', grade: '2', fee: 82120 },
      { code: '바-6', grade: '3-5', fee: 77540 },
    ],
  },
  {
    id: 'groupHome',
    label: '노인요양공동생활가정',
    condition: '노인요양공동생활가정의 1일당 급여비용',
    basis: '제44조제2항',
    rows: [
      { code: '바-7', grade: '1', fee: 74590 },
      { code: '바-8', grade: '2', fee: 69210 },
      { code: '바-9', grade: '3-5', fee: 63800 },
    ],
  },
];

export function facilityFeeTable(id: FacilityTableId): FacilityFeeTable {
  const table = FACILITY_FEE_TABLES_2026.find((t) => t.id === id);
  if (!table) throw new RangeError(`없는 표: ${id}`);
  return table;
}

export function facilityFee(code: FacilityFeeCode): number {
  for (const table of FACILITY_FEE_TABLES_2026) {
    const row = table.rows.find((r) => r.code === code);
    if (row) return row.fee;
  }
  throw new RangeError(`없는 분류번호: ${code}`);
}

export function facilityGradeLabel(grade: FacilityGradeGroup): string {
  return grade === '3-5' ? '3~5등급' : `${grade}등급`;
}

/** 고시 제74조제2항 — 치매전담실 가형·나형, 치매전담형 노인요양공동생활가정. 1등급 행은 표에 없다. */
export interface DementiaFacilityFeeRow {
  code: '아-1' | '아-2';
  place: string;
  grade: Exclude<FacilityGradeGroup, '1'>;
  /** 아-1은 가형·나형 금액이 다르고, 아-2는 한 칸(형 구분 없음) */
  typeA: number;
  typeB: number | null;
}

/** place는 그림의 '분류' 칸 글자 그대로(노인요양시설 = 그 안의 치매전담실, 노인요양공동생활가정 = 치매전담형 — 제74조제2항 본문). */
export const DEMENTIA_FACILITY_FEES_2026: ReadonlyArray<DementiaFacilityFeeRow> = [
  { code: '아-1', place: '노인요양시설', grade: '2', typeA: 96950, typeB: 90160 },
  { code: '아-1', place: '노인요양시설', grade: '3-5', typeA: 89400, typeB: 83140 },
  { code: '아-2', place: '노인요양공동생활가정', grade: '2', typeA: 85790, typeB: null },
  { code: '아-2', place: '노인요양공동생활가정', grade: '3-5', typeA: 79100, typeB: null },
];

/** 시설급여 본인부담률(%) — 시행령 제15조의8제2호 */
export const FACILITY_COPAY_PERCENT = 20;

/** 제45조제2항제1호 — 의료기관 입원·시설장 허가 외박은 급여비용의 50%, 1회 최대 10일, 1개월 15일까지 */
export const OVERNIGHT = { percent: 50, maxDaysPerStay: 10, maxDaysPerMonth: 15 } as const;

/** 제45조제1항 → 제38조제2항 — 입·퇴소 당일 급여제공 12시간 이상 100%, 미만 50% */
export const ADMISSION_DAY = { fullHours: 12, shortPercent: 50 } as const;

/** 제75조제1항 — 치매전문교육 이수 시설장·프로그램관리자가 없거나 제72조제2항 업무를 하지 않으면 90% */
export const DEMENTIA_NO_TRAINING_PERCENT = 90;

/** 제71조제2항 — 치매전담실 입소 중 1등급 등으로 바뀌면 바뀐 날부터 90일까지 이용 */
export const DEMENTIA_GRADE_CHANGE_DAYS = 90;

/** 1일 급여비용의 n% (원). 원 미만이 생기면 단수 처리 규정을 확인하지 않은 값이므로 멈춘다. */
export function percentOf(amount: number, percent: number): number {
  const scaled = amount * percent;
  if (scaled % 100 !== 0) throw new RangeError(`원 미만 단수 발생: ${amount} × ${percent}%`);
  return scaled / 100;
}

export interface FacilityMonthInput {
  /** 1일당 급여비용(원) */
  dailyFee: number;
  /** 1일 급여비용을 다 산정하는 날 수 */
  fullDays: number;
  /** 외박비용(50%)을 산정하는 날 수 */
  overnightDays?: number;
  /** 입·퇴소 당일 12시간 미만이라 50%를 산정하는 날 수 */
  shortDays?: number;
}

export interface FacilityMonth {
  totalFee: number;
  copay: number;
  insurerShare: number;
}

/** 한 달 급여비용과 본인부담금(20%). 가산·감액·비급여는 넣지 않는다. */
export function facilityMonth({ dailyFee, fullDays, overnightDays = 0, shortDays = 0 }: FacilityMonthInput): FacilityMonth {
  for (const n of [fullDays, overnightDays, shortDays]) {
    if (!Number.isInteger(n) || n < 0) throw new RangeError(`날 수는 0 이상의 정수여야 한다: ${n}`);
  }
  if (overnightDays > OVERNIGHT.maxDaysPerMonth) throw new RangeError(`외박비용은 1개월 ${OVERNIGHT.maxDaysPerMonth}일까지`);
  const totalFee =
    dailyFee * fullDays +
    percentOf(dailyFee, OVERNIGHT.percent) * overnightDays +
    percentOf(dailyFee, ADMISSION_DAY.shortPercent) * shortDays;
  const copay = percentOf(totalFee, FACILITY_COPAY_PERCENT);
  return { totalFee, copay, insurerShare: totalFee - copay };
}

/** 원문 출처. 페이지 하단 출처 목록과 구조화 데이터 isBasedOn이 같은 값을 쓴다. */
export const FACILITY_FEE_SOURCES: ReadonlyArray<{ name: string; url: string }> = [
  {
    name: '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 (보건복지부고시 제2026-189호, 2026.10.1. 시행) 제2조·제32조·제38조·제44조~제46조·제56조의2·제66조·제71조·제72조·제74조·제75조, 부칙',
    url: 'https://www.law.go.kr/행정규칙/장기요양급여제공기준및급여비용산정방법등에관한고시',
  },
  {
    name: '국민건강보험공단 건강Law — 같은 고시 제2025-247호(2026.1.1. 시행) 개정전문(제44조·제74조 표 대조)',
    url: 'https://www.nhis.or.kr/lm/lmxsrv/law/lawDetail.do?SEQ=1637',
  },
  {
    name: '노인장기요양보험법 시행령 제15조의8(본인부담금)·제6조(의사소견서 제출 제외자)',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법시행령/제15조의8',
  },
  {
    name: '노인장기요양보험법 제40조(본인부담금)·제28조(장기요양급여의 월 한도액)',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법/제40조',
  },
  {
    name: '노인장기요양보험법 시행규칙 제14조(장기요양급여의 범위 등)·제15조(수급자에 대한 안내)·제22조(장기요양급여의 월 한도액)',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법시행규칙',
  },
  {
    name: '노인복지법 시행규칙 별표 4 제4호가목(치매전담실 가형·나형 침실면적)',
    url: 'https://www.law.go.kr/법령/노인복지법시행규칙',
  },
];
