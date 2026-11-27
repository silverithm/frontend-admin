/**
 * 장기요양등급 판정기준 — /ltc/ltc-grade-criteria 페이지의 원장.
 *
 * 숫자 하나가 틀리면 페이지 전체의 신뢰가 무너진다. 값을 고칠 때는 반드시 아래 원문을 다시 열어 대조한다.
 * - 등급별 점수 구간·치매 요건: 「노인장기요양보험법 시행령」 제7조제1항 (현행 대통령령 제36325호, 2026.5.12. 시행)
 * - 장기요양인정 유효기간: 같은 시행령 제8조 (제1항은 2025.7.1. 개정, 대통령령 제35626호 부칙 제2조 적용례)
 * - 노인성 질병의 종류: 같은 시행령 별표 1 <개정 2022. 12. 20.> (PDF 글자 + 그림 대조, 2026-11-27)
 * - 장기요양인정 점수 산정 방법(52개 항목·영역별 판단기준·치매 보정): 「장기요양등급판정기준에 관한 고시」
 *   (보건복지부고시 제2018-146호, 2018.8.1. 시행) 제2조 — 항목 표와 점수표는 본문 그림(flSeq 35746907·35746903)을 확대해 읽었다.
 * - 등급별로 이용할 수 있는 급여: 「장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시」(제2026-189호) 제2조 등
 */

/** 원문을 마지막으로 대조한 날. 페이지의 "원문 대조"와 구조화 데이터 dateModified로 쓴다. */
export const GRADE_CRITERIA_VERIFIED_AT = '2026-11-27';

export type LtcGradeId = '1' | '2' | '3' | '4' | '5' | 'cognitive';

export interface GradeCriterion {
  id: LtcGradeId;
  label: string;
  /** 장기요양인정 점수 하한(이상). 인지지원등급은 하한이 없다. */
  minScore: number | null;
  /** 장기요양인정 점수 상한(미만). 1등급은 상한이 없다. */
  belowScore: number | null;
  /** 치매(시행령 제2조에 따른 노인성 질병에 해당하는 치매로 한정)환자여야 하는 등급 — 5등급·인지지원등급 */
  dementiaRequired: boolean;
  /** 시행령 제7조제1항 각 호의 문장에서 점수 앞부분 — 원문 그대로 */
  condition: string;
  /** 갱신된 장기요양인정의 유효기간(년) — 시행령 제8조제1항 각 호 */
  renewedValidityYears: number;
}

const DEMENTIA_CONDITION = '치매(제2조에 따른 노인성 질병에 해당하는 치매로 한정한다)환자';

/** 시행령 제7조제1항 제1호~제6호 — 위에서부터 점수가 높은 등급. */
export const GRADE_CRITERIA: ReadonlyArray<GradeCriterion> = [
  {
    id: '1',
    label: '1등급',
    minScore: 95,
    belowScore: null,
    dementiaRequired: false,
    condition: '심신의 기능상태 장애로 일상생활에서 전적으로 다른 사람의 도움이 필요한 자',
    renewedValidityYears: 5,
  },
  {
    id: '2',
    label: '2등급',
    minScore: 75,
    belowScore: 95,
    dementiaRequired: false,
    condition: '심신의 기능상태 장애로 일상생활에서 상당 부분 다른 사람의 도움이 필요한 자',
    renewedValidityYears: 4,
  },
  {
    id: '3',
    label: '3등급',
    minScore: 60,
    belowScore: 75,
    dementiaRequired: false,
    condition: '심신의 기능상태 장애로 일상생활에서 부분적으로 다른 사람의 도움이 필요한 자',
    renewedValidityYears: 4,
  },
  {
    id: '4',
    label: '4등급',
    minScore: 51,
    belowScore: 60,
    dementiaRequired: false,
    condition: '심신의 기능상태 장애로 일상생활에서 일정부분 다른 사람의 도움이 필요한 자',
    renewedValidityYears: 4,
  },
  {
    id: '5',
    label: '5등급',
    minScore: 45,
    belowScore: 51,
    dementiaRequired: true,
    condition: DEMENTIA_CONDITION,
    renewedValidityYears: 2,
  },
  {
    id: 'cognitive',
    label: '인지지원등급',
    minScore: null,
    belowScore: 45,
    dementiaRequired: true,
    condition: DEMENTIA_CONDITION,
    renewedValidityYears: 2,
  },
];

/** 처음 받은 장기요양인정의 유효기간(년) — 시행령 제8조제1항 본문. */
export const INITIAL_VALIDITY_YEARS = 2;
/** 등급판정위원회가 유효기간을 늘리거나 줄일 수 있는 범위(개월) — 시행령 제8조제2항. */
export const VALIDITY_ADJUST_MONTHS = 6;
/** 갱신 신청 기간 — 유효기간이 끝나기 90일 전부터 30일 전까지(시행규칙 제8조제1항). */
export const RENEWAL_WINDOW_DAYS = { from: 90, until: 30 } as const;
/** 등급판정 기간 — 신청서를 낸 날부터 30일 이내, 부득이하면 30일 이내 범위에서 연장(법 제16조제1항). */
export const DECISION_DAYS = 30;
/** 치매 보정을 받을 수 있는 점수 상한(미만) — 등급판정기준 고시 제2조제5호가목. */
export const DEMENTIA_ADJUST_BELOW = 75;

export function gradeById(id: LtcGradeId): GradeCriterion {
  const grade = GRADE_CRITERIA.find((g) => g.id === id);
  if (!grade) throw new RangeError(`없는 등급: ${id}`);
  return grade;
}

function assertScore(score: number): void {
  if (!Number.isFinite(score) || score < 0) throw new RangeError(`장기요양인정 점수는 0 이상이어야 한다: ${score}`);
}

/**
 * 점수와 치매 여부로 시행령 제7조제1항의 등급을 찾는다. 어느 호에도 해당하지 않으면 null.
 * 1~4등급은 치매 요건이 없다 — 치매가 있어도 51점 이상이면 점수대로 1~4등급이다.
 */
export function gradeFor(score: number, dementia: boolean): LtcGradeId | null {
  assertScore(score);
  for (const grade of GRADE_CRITERIA) {
    if (grade.dementiaRequired && !dementia) continue;
    if (grade.minScore !== null && score < grade.minScore) continue;
    if (grade.belowScore !== null && score >= grade.belowScore) continue;
    return grade.id;
  }
  return null;
}

/** "75점 이상 95점 미만" — 원문 표현 그대로 */
export function scoreRangeLabel(grade: GradeCriterion): string {
  if (grade.minScore !== null && grade.belowScore !== null) return `${grade.minScore}점 이상 ${grade.belowScore}점 미만`;
  if (grade.minScore !== null) return `${grade.minScore}점 이상`;
  return `${grade.belowScore}점 미만`;
}

/**
 * 등급판정기준 고시 제2조제5호 — 요양인정점수가 75점 미만이고 치매 요건(나·다목)을 갖춘 사람에게 회귀모형(별표 2)을
 * 적용한 값이 0.5 이상이면 "개별 요양인정점수는 한 단계 위 등급의 최저점수로 한다".
 * 보정 전 점수로 정해지는 등급(치매가 있으므로 5등급·인지지원등급까지)의 한 단계 위 등급 최저점수를 돌려준다.
 * 75점 이상은 보정 대상이 아니라 null.
 */
export function dementiaAdjustedScore(score: number): number | null {
  assertScore(score);
  if (score >= DEMENTIA_ADJUST_BELOW) return null;
  const current = gradeFor(score, true);
  const index = GRADE_CRITERIA.findIndex((g) => g.id === current);
  const oneUp = GRADE_CRITERIA[index - 1];
  if (!oneUp || oneUp.minScore === null) throw new RangeError(`한 단계 위 등급을 찾지 못했다: ${score}`);
  return oneUp.minScore;
}

/** 장기요양인정조사의 한 판단기준 — 등급판정기준 고시 제2조 '영역별 조사항목 점수표' 한 칸 묶음. */
export interface AssessmentScale {
  /** 판단기준 이름 — 기능자립정도, 증상여부, 증상유무, 운동장애정도, 관절제한정도 */
  criterion: string;
  options: ReadonlyArray<{ label: string; score: number }>;
}

export interface AssessmentGroup {
  /** 재활 영역 안의 묶음 이름(운동장애·관절제한). 다른 영역은 없다. */
  name?: string;
  scale: AssessmentScale;
  items: ReadonlyArray<string>;
}

export interface AssessmentDomain {
  name: string;
  groups: ReadonlyArray<AssessmentGroup>;
}

const FUNCTION_SCALE: AssessmentScale = {
  criterion: '기능자립정도',
  options: [
    { label: '완전자립', score: 1 },
    { label: '부분도움', score: 2 },
    { label: '완전도움', score: 3 },
  ],
};
const YES_NO_SCALE: AssessmentScale = {
  criterion: '증상여부',
  options: [
    { label: '예', score: 1 },
    { label: '아니오', score: 0 },
  ],
};

/** 등급판정기준 고시 제2조 '영역별 심신상태를 나타내는 52개 항목'(그림 flSeq 35746907)과 점수표(그림 35746903). */
export const ASSESSMENT_DOMAINS: ReadonlyArray<AssessmentDomain> = [
  {
    name: '신체기능(기본적 일상생활기능)',
    groups: [
      {
        scale: FUNCTION_SCALE,
        items: [
          '옷 벗고 입기',
          '세수하기',
          '양치질하기',
          '목욕하기',
          '식사하기',
          '체위변경하기',
          '일어나 앉기',
          '옮겨 앉기',
          '방 밖으로 나오기',
          '화장실 사용하기',
          '대변 조절하기',
          '소변 조절하기',
        ],
      },
    ],
  },
  {
    name: '인지기능',
    groups: [
      {
        scale: YES_NO_SCALE,
        items: [
          '단기 기억장애',
          '날짜불인지',
          '장소불인지',
          '나이·생년월일 불인지',
          '지시불인지',
          '상황 판단력 감퇴',
          '의사소통·전달 장애',
        ],
      },
    ],
  },
  {
    name: '행동변화',
    groups: [
      {
        scale: YES_NO_SCALE,
        items: [
          '망상',
          '환각, 환청',
          '슬픈 상태, 울기도 함',
          '불규칙수면, 주야혼돈',
          '도움에 저항',
          '서성거림, 안절부절못함',
          '길을 잃음',
          '폭언, 위협행동',
          '밖으로 나가려함',
          '물건 망가트리기',
          '의미 없거나 부적절한 행동',
          '돈·물건 감추기',
          '부적절한 옷 입기',
          '대소변 불결행위',
        ],
      },
    ],
  },
  {
    name: '간호처치',
    groups: [
      {
        scale: {
          criterion: '증상유무',
          options: [
            { label: '있다', score: 1 },
            { label: '없다', score: 0 },
          ],
        },
        items: ['기관지 절개관 간호', '흡인', '산소요법', '욕창간호', '경관 영양', '암성통증간호', '도뇨관리', '장루간호', '투석간호'],
      },
    ],
  },
  {
    name: '재활',
    groups: [
      {
        name: '운동장애',
        scale: {
          criterion: '운동장애정도',
          options: [
            { label: '운동장애없음', score: 1 },
            { label: '불완전운동장애', score: 2 },
            { label: '완전운동장애', score: 3 },
          ],
        },
        items: ['우측상지', '우측하지', '좌측상지', '좌측하지'],
      },
      {
        name: '관절제한',
        scale: {
          criterion: '관절제한정도',
          options: [
            { label: '제한없음', score: 1 },
            { label: '한쪽관절제한', score: 2 },
            { label: '양관절제한', score: 3 },
          ],
        },
        items: ['어깨관절', '팔꿈치관절', '손목 및 수지관절', '고관절', '무릎관절', '발목관절'],
      },
    ],
  },
];

export function domainItemCount(domain: AssessmentDomain): number {
  return domain.groups.reduce((sum, group) => sum + group.items.length, 0);
}

export function totalItemCount(): number {
  return ASSESSMENT_DOMAINS.reduce((sum, domain) => sum + domainItemCount(domain), 0);
}

/** 영역별 원점수가 가질 수 있는 범위 — 항목 수 × 판단기준의 최저·최고 점수(제2조제1호 '해당 항목 점수의 합'). */
export function rawScoreRange(domain: AssessmentDomain): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const group of domain.groups) {
    const scores = group.scale.options.map((option) => option.score);
    min += group.items.length * Math.min(...scores);
    max += group.items.length * Math.max(...scores);
  }
  return { min, max };
}

/** 노인성 질병의 종류 — 시행령 별표 1 <개정 2022. 12. 20.> (한국표준질병·사인분류). */
export interface GeriatricDisease {
  mark: string;
  name: string;
  code: string;
}

export const GERIATRIC_DISEASES: ReadonlyArray<GeriatricDisease> = [
  { mark: '가', name: '알츠하이머병에서의 치매', code: 'F00*' },
  { mark: '나', name: '혈관성 치매', code: 'F01' },
  { mark: '다', name: '달리 분류된 기타 질환에서의 치매', code: 'F02*' },
  { mark: '라', name: '상세불명의 치매', code: 'F03' },
  { mark: '마', name: '알츠하이머병', code: 'G30' },
  { mark: '바', name: '지주막하출혈', code: 'I60' },
  { mark: '사', name: '뇌내출혈', code: 'I61' },
  { mark: '아', name: '기타 비외상성 두개내출혈', code: 'I62' },
  { mark: '자', name: '뇌경색증', code: 'I63' },
  { mark: '차', name: '출혈 또는 경색증으로 명시되지 않은 뇌졸중', code: 'I64' },
  { mark: '카', name: '뇌경색증을 유발하지 않은 뇌전동맥의 폐쇄 및 협착', code: 'I65' },
  { mark: '타', name: '뇌경색증을 유발하지 않은 대뇌동맥의 폐쇄 및 협착', code: 'I66' },
  { mark: '파', name: '기타 뇌혈관질환', code: 'I67' },
  { mark: '하', name: '달리 분류된 질환에서의 뇌혈관장애', code: 'I68*' },
  { mark: '거', name: '뇌혈관질환의 후유증', code: 'I69' },
  { mark: '너', name: '파킨슨병', code: 'G20' },
  { mark: '더', name: '이차성 파킨슨증', code: 'G21' },
  { mark: '러', name: '달리 분류된 질환에서의 파킨슨증', code: 'G22*' },
  { mark: '머', name: '기저핵의 기타 퇴행성 질환', code: 'G23' },
  { mark: '버', name: '중풍후유증', code: 'U23.4' },
  { mark: '서', name: '진전(震顫)', code: 'R25.1' },
  { mark: '어', name: '척수성 근위축 및 관련 증후군', code: 'G12' },
  { mark: '저', name: '달리 분류된 질환에서의 일차적으로 중추신경계통에 영향을 주는 계통성 위축', code: 'G13*' },
  { mark: '처', name: '다발경화증', code: 'G35' },
];

export interface GradeCriteriaSource {
  name: string;
  url: string;
}

export const GRADE_CRITERIA_SOURCES: ReadonlyArray<GradeCriteriaSource> = [
  {
    name: '노인장기요양보험법 시행령 (대통령령 제36325호, 2026.5.12. 시행) 제2조·제6조·제7조·제8조·제10조, 부칙 <제35626호> 제2조, [별표 1] 노인성 질병의 종류 <개정 2022. 12. 20.>',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법시행령',
  },
  {
    name: '노인장기요양보험법 (법률 제21690호, 2026.11.27. 시행) 제2조·제12조~제17조·제21조~제23조',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법',
  },
  {
    name: '노인장기요양보험법 시행규칙 (보건복지부령 제1138호, 2025.12.12. 시행) 제2조·제3조·제5조·제6조·제7조·제8조',
    url: 'https://www.law.go.kr/법령/노인장기요양보험법시행규칙',
  },
  {
    name: '장기요양등급판정기준에 관한 고시 (보건복지부고시 제2018-146호, 2018.8.1. 시행) 제2조·제3조',
    url: 'https://www.law.go.kr/행정규칙/장기요양등급판정기준에관한고시',
  },
  {
    name: '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 (보건복지부고시 제2026-189호, 2026.10.1. 시행) 제2조·제17조·제30조·제36조의2·제71조',
    url: 'https://www.law.go.kr/행정규칙/장기요양급여제공기준및급여비용산정방법등에관한고시',
  },
];
