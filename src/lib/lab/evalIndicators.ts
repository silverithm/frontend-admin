/**
 * 2026 장기요양기관 평가(재가급여 · 주야간보호) 준비 점검표의 지표 목록.
 *
 * ⚠ 공개 매뉴얼(「2026년 장기요양기관 재가급여(주야간보호) 평가 매뉴얼」 2025.9, 2025.12 개정) 요약본이다.
 * 지표 번호·배점은 대응하지 않고 우리 식으로 묶었으며, 문구는 요건을 풀어 쓴 것이다 — 실제 평가 전에는 반드시 매뉴얼 원문과 대조해야 한다.
 * 이 점검표는 "기관이 스스로 준비 상태를 확인하는 도구"이지 평가 결과를 예측하거나 보장하지 않는다.
 *
 * 평가는 지표마다 표본 기록·증빙을 확인해 우수·양호·보통·미흡으로 매긴다. 그래서 각 지표에는 "무엇을 보여줘야 하는가"를
 * 요건 문장으로 적어 두었고, 케어브이에 이미 쌓이는 기록으로 근거가 자동으로 잡히는 지표에는 autoSource를 붙였다.
 */
import type { EvalCheck, EvalStatus } from './labTypes.ts';

export type EvalGroup = 'OPERATION' | 'SAFETY' | 'SERVICE' | 'HEALTH' | 'TRANSPORT' | 'PROGRAM' | 'RIGHTS';

/** 케어브이 기록에서 근거를 자동으로 가져올 수 있는 지표 */
export type EvalAutoSource =
  | 'RISK_HALF_YEAR'
  | 'CARE_RECORD_DELIVERY'
  | 'CARE_RECORD_QUALITY'
  /** 최근 4주(끝난 주) 중 인지 프로그램을 주 3회 이상 연 주 수 */
  | 'PROGRAM_COGNITIVE_WEEKLY'
  /** 올해 법정 교육 다섯 범주를 모두 들은 직원 비율 */
  | 'TRAINING_COVERAGE'
  /** 올해 급여제공계획이 있고 보호자 동의를 받은 어르신 비율 */
  | 'CARE_PLAN_AGREEMENT';

export interface EvalIndicator {
  code: string;
  group: EvalGroup;
  title: string;
  requirements: string[];
  autoSource?: EvalAutoSource;
}

export const EVAL_GROUPS: ReadonlyArray<{ id: EvalGroup; label: string }> = [
  { id: 'OPERATION', label: '운영' },
  { id: 'SAFETY', label: '안전·위생' },
  { id: 'SERVICE', label: '급여제공' },
  { id: 'HEALTH', label: '간호·건강' },
  { id: 'TRANSPORT', label: '이동서비스' },
  { id: 'PROGRAM', label: '프로그램' },
  { id: 'RIGHTS', label: '권익·소통' },
];

export const EVAL_AUTO_SOURCE_LABEL: Readonly<Record<EvalAutoSource, string>> = {
  RISK_HALF_YEAR: '위험도 평가 반기 점검 결과',
  CARE_RECORD_DELIVERY: '급여제공기록 제공대장',
  CARE_RECORD_QUALITY: '급여제공기록 문구 점검',
  PROGRAM_COGNITIVE_WEEKLY: '프로그램 일지의 인지 프로그램 주 3회 운영',
  TRAINING_COVERAGE: '직원 교육 일지의 법정 교육 이수 현황',
  CARE_PLAN_AGREEMENT: '급여제공계획의 보호자 동의 현황',
};

export const EVAL_INDICATORS: readonly EvalIndicator[] = [
  // ---------- 운영 ----------
  {
    code: 'OPS-01',
    group: 'OPERATION',
    title: '운영규정과 연간 사업계획',
    requirements: [
      '기관 운영규정이 있고 최근 개정일이 적혀 있다',
      '해당 연도 사업계획서가 있고 프로그램·행사·교육 일정이 들어 있다',
      '직원이 규정과 계획을 볼 수 있게 공유한 기록(회의록·열람 확인)이 있다',
    ],
  },
  {
    code: 'OPS-02',
    group: 'OPERATION',
    title: '인력 배치 기준 준수',
    requirements: [
      '직종별(시설장·사회복지사·간호(조무)사·요양보호사·사무원·조리원·운전원) 배치 현황이 인원 기준에 맞다',
      '근무표와 출퇴근 기록이 배치 현황과 일치한다',
      '자격증 사본과 채용·계약 서류가 갖춰져 있다',
    ],
  },
  {
    code: 'OPS-03',
    group: 'OPERATION',
    title: '종사자 보수교육 이수 (신설)',
    requirements: [
      '보수교육 대상 종사자 명단이 있다',
      '대상자별 이수 증빙(수료증·이수 확인)이 있다',
      '미이수자의 이수 예정일과 관리 방법이 있다',
    ],
  },
  {
    code: 'OPS-04',
    group: 'OPERATION',
    title: '직원 교육 실시',
    requirements: [
      '연간 직원 교육계획이 있다',
      '교육일지(일시·내용·참석자 서명)가 계획대로 남아 있다',
      '법정 교육(노인학대 예방, 성희롱 예방, 감염관리 등)이 빠짐없이 들어 있다',
    ],
    autoSource: 'TRAINING_COVERAGE',
  },
  {
    code: 'OPS-05',
    group: 'OPERATION',
    title: '직원 권익 보호',
    requirements: [
      '근로계약서가 직원 전원에 대해 작성되어 있다',
      '직원 고충 처리 절차와 담당자가 안내되어 있다',
      '고충이 접수되면 처리 결과를 남기는 양식이 있다',
    ],
  },

  // ---------- 안전·위생 ----------
  {
    code: 'SAFE-01',
    group: 'SAFETY',
    title: '개인정보 보호',
    requirements: [
      '개인정보 처리방침이 보기 쉬운 곳에 게시되어 있다',
      '수급자·보호자 개인정보 수집·이용 동의서가 있다',
      '개인정보가 든 서류·전산의 접근 권한과 보관 방법이 정해져 있다',
    ],
  },
  {
    code: 'SAFE-02',
    group: 'SAFETY',
    title: '시설 위생 관리',
    requirements: [
      '시설 청소·소독 점검표가 정해진 주기대로 기록되어 있다',
      '화장실·목욕실·휴게 공간의 점검 기록이 있다',
      '점검에서 지적된 사항의 조치 내용이 남아 있다',
    ],
  },
  {
    code: 'SAFE-03',
    group: 'SAFETY',
    title: '식품 위생과 급식 관리',
    requirements: [
      '주간 식단표가 게시되어 있고 실제 급식과 맞다',
      '조리·배식·보관의 위생 점검 기록이 있다',
      '조리원 건강진단결과서와 위생교육 기록이 유효하다',
    ],
  },
  {
    code: 'SAFE-04',
    group: 'SAFETY',
    title: '감염 예방·관리',
    requirements: [
      '감염관리 지침이 있고 직원이 알고 있다',
      '손 위생, 소독, 환기 등 일상 감염관리 기록이 있다',
      '감염 의심 증상 수급자·직원의 분리와 보고 절차가 있다',
    ],
  },
  {
    code: 'SAFE-05',
    group: 'SAFETY',
    title: '감염병 대응 체계 (신설)',
    requirements: [
      '감염병 유행 시 대응 매뉴얼(비상연락망, 격리 공간, 방문 제한)이 있다',
      '감염병 대응 훈련·교육을 한 기록이 있다',
      '개인보호장비와 소독 물품의 비축 현황을 점검한다',
    ],
  },
  {
    code: 'SAFE-06',
    group: 'SAFETY',
    title: '안전한 시설 환경(낙상 예방)',
    requirements: [
      '바닥 미끄럼 방지, 손잡이, 조명 등 낙상 예방 환경 점검 기록이 있다',
      '점검에서 발견한 위험 요소를 고친 기록이 있다',
      '이동 동선과 비상 통로에 장애물이 없다',
    ],
  },
  {
    code: 'SAFE-07',
    group: 'SAFETY',
    title: '재난 대응과 소방 안전',
    requirements: [
      '소방시설 점검 결과와 안전관리자 지정 기록이 있다',
      '연간 재난(화재·지진) 대응 훈련을 정해진 횟수만큼 실시했다',
      '비상 대피도와 대피 방법이 게시되어 있다',
    ],
  },
  {
    code: 'SAFE-08',
    group: 'SAFETY',
    title: '응급상황 대응 체계',
    requirements: [
      '응급 연락망(보호자·병원·119)과 대응 절차가 게시되어 있다',
      '직원의 응급처치 교육 기록이 있다',
      '응급상황이 실제로 있었다면 대응과 보고 내용이 기록되어 있다',
    ],
  },
  {
    code: 'SAFE-09',
    group: 'SAFETY',
    title: '위험도 평가 (욕창·낙상·인지기능) 반기 실시',
    requirements: [
      '모든 수급자에 대해 욕창·낙상·인지기능 위험도를 반기(1~6월, 7~12월)마다 1회 이상 평가했다',
      '검증된 도구(욕창 Braden, 낙상 Morse Fall Scale, 인지기능 K-MMSE·CIST 등)를 썼고 도구의 모든 항목·점수가 기록되어 있다',
      '외부기관 검사나 치매 진단(진단서·소견서)으로 인지기능을 확인한 경우 기관명과 판정이 기록되어 있다',
      '수급자명, 평가일, 작성자명이 기록되어 있고 해당 급여 직원이 직접 평가했다',
      '신규 수급자는 급여 시작일까지 평가했다',
    ],
    autoSource: 'RISK_HALF_YEAR',
  },

  // ---------- 급여제공 ----------
  {
    code: 'SVC-01',
    group: 'SERVICE',
    title: '급여 제공 계약 체결',
    requirements: [
      '수급자(보호자)와 맺은 급여 제공 계약서가 모든 수급자에게 있다',
      '이용 요금·본인부담금·비급여 항목을 계약 전에 설명하고 동의받았다',
      '계약 내용이 바뀌면 변경 계약이나 동의 기록이 있다',
    ],
  },
  {
    code: 'SVC-02',
    group: 'SERVICE',
    title: '급여 개시·변경 사항 통보',
    requirements: [
      '급여 개시·종료·변경 사항을 정해진 기한 안에 공단에 통보한 기록이 있다',
      '통보 내용이 실제 이용 현황과 일치한다',
    ],
  },
  {
    code: 'SVC-03',
    group: 'SERVICE',
    title: '욕구사정(초기·정기)',
    requirements: [
      '급여 시작 전 수급자의 신체·인지·사회적 욕구를 사정한 기록이 있다',
      '정기적으로(또는 상태가 바뀔 때) 다시 사정했다',
      '사정 내용에 수급자·보호자의 요구가 적혀 있다',
    ],
  },
  {
    code: 'SVC-04',
    group: 'SERVICE',
    title: '급여제공계획 수립',
    requirements: [
      '욕구사정에 근거한 개인별 급여제공계획이 있다',
      '계획 수립·변경 때 수급자 또는 보호자에게 설명하고 동의받은 기록이 있다',
      '계획의 목표와 서비스 내용이 구체적이다',
    ],
    autoSource: 'CARE_PLAN_AGREEMENT',
  },
  {
    code: 'SVC-05',
    group: 'SERVICE',
    title: '급여제공기록의 구체성',
    requirements: [
      '기록에 그날 제공한 서비스와 수급자의 반응·상태가 구체적으로 적혀 있다',
      '"특이사항 없음", "지난주와 동일" 같은 형식적 문구로 채우지 않았다',
      '실제 서비스를 제공한 직원이 기록했다',
    ],
    autoSource: 'CARE_RECORD_QUALITY',
  },
  {
    code: 'SVC-06',
    group: 'SERVICE',
    title: '급여제공기록 월 1회 이상 제공',
    requirements: [
      '주·야간보호 급여 제공 기록지를 수급자(보호자)에게 월 1회 이상 제공했다',
      '제공대장에 제공 일자·방법(방문·우편·모사전송·전자)·수령자가 적혀 있다',
      '전자 열람으로 제공한 경우 열람 기록이 남는다',
    ],
    autoSource: 'CARE_RECORD_DELIVERY',
  },
  {
    code: 'SVC-07',
    group: 'SERVICE',
    title: '상태 변화·욕구의 계획 반영',
    requirements: [
      '수급자의 상태가 바뀌었을 때 그 사실이 기록되어 있다',
      '상태 변화에 따라 급여제공계획을 고치거나 보호자와 상의한 기록이 있다',
    ],
  },

  // ---------- 간호·건강 ----------
  {
    code: 'HLT-01',
    group: 'HEALTH',
    title: '투약 관리',
    requirements: [
      '처방 내용과 투약 의뢰(보호자 요청·동의)가 확인된다',
      '투약 기록(일시·약명·용량·투약자)이 빠짐없이 있다',
      '투약 오류·누락이 있었다면 보고와 조치가 남아 있다',
    ],
  },
  {
    code: 'HLT-02',
    group: 'HEALTH',
    title: '약품 보관 관리',
    requirements: [
      '약품이 잠금 장치가 있는 곳에 수급자별로 구분되어 보관된다',
      '유효기간과 보관 상태를 점검한 기록이 있다',
    ],
  },
  {
    code: 'HLT-03',
    group: 'HEALTH',
    title: '수급자 건강·안전 관리',
    requirements: [
      '이용 때마다 건강 상태(혈압·체온 등)를 확인한 기록이 있다',
      '상태 변화·낙상 등 사고가 났을 때 보고와 조치 기록이 있다',
      '보호자에게 알린 기록이 있다',
    ],
  },
  {
    code: 'HLT-04',
    group: 'HEALTH',
    title: '외부 의료·지역기관 연계',
    requirements: [
      '협약 의료기관이나 지역 보건·복지기관과의 연계 현황이 있다',
      '실제 연계(진료 의뢰·정보 공유)를 한 기록이 있다',
    ],
  },

  // ---------- 이동서비스 ----------
  {
    code: 'TRN-01',
    group: 'TRANSPORT',
    title: '이동서비스 안전수칙',
    requirements: [
      '차량 이용 안전수칙이 마련되어 있고 보호자·수급자에게 안내했다',
      '운전원과 동승자의 역할, 승하차 도움 절차가 정해져 있다',
      '차량 보험·안전장치(안전벨트, 리프트) 점검 기록이 있다',
    ],
  },
  {
    code: 'TRN-02',
    group: 'TRANSPORT',
    title: '이동서비스 제공 기록',
    requirements: [
      '운행일지에 일자·노선·탑승자·운전원·동승자가 기록되어 있다',
      '실제 이용 현황(출석)과 운행 기록이 일치한다',
    ],
  },

  // ---------- 프로그램 ----------
  {
    code: 'PRG-01',
    group: 'PROGRAM',
    title: '인지기능 프로그램 주 3회 이상',
    requirements: [
      '인지기능 향상 프로그램을 주 3회 이상 운영했다',
      '프로그램 일지에 일시·내용·참여자·담당자가 기록되어 있다',
      '수급자 수준에 맞춘 프로그램이다(집단 구분 또는 개별 조정)',
    ],
    autoSource: 'PROGRAM_COGNITIVE_WEEKLY',
  },
  {
    code: 'PRG-02',
    group: 'PROGRAM',
    title: '프로그램 계획·평가',
    requirements: [
      '월별(또는 분기별) 프로그램 계획표가 있다',
      '프로그램 실시 후 참여 반응과 효과를 평가한 기록이 있다',
      '평가 결과를 다음 계획에 반영했다',
    ],
  },

  // ---------- 권익·소통 ----------
  {
    code: 'RGT-01',
    group: 'RIGHTS',
    title: '보호자 소통',
    requirements: [
      '보호자 상담·연락 내용을 기록하는 양식이 있고 실제 사용된다',
      '수급자 상태·행사·변경 사항을 보호자에게 정기적으로 알린 기록이 있다',
    ],
  },
  {
    code: 'RGT-02',
    group: 'RIGHTS',
    title: '사례관리(회의)',
    requirements: [
      '수급자별 사례를 검토하는 직원 회의가 정기적으로 열렸다',
      '회의록에 참석자·논의 내용·결정 사항이 있다',
    ],
  },
  {
    code: 'RGT-03',
    group: 'RIGHTS',
    title: '노인 인권 보호',
    requirements: [
      '노인학대 예방 교육을 직원에게 실시했다',
      '학대 의심 사례 신고 절차와 신고 의무가 게시·안내되어 있다',
      '수급자의 권리(존엄, 사생활, 자기결정)를 지키는 기관 지침이 있다',
    ],
  },
  {
    code: 'RGT-04',
    group: 'RIGHTS',
    title: '수급자 등급·이용 현황 관리',
    requirements: [
      '수급자별 장기요양 등급과 인정 유효기간을 관리한다',
      '등급 변경·갱신 때 바뀐 내용을 반영한 기록이 있다',
    ],
  },
  {
    code: 'RGT-05',
    group: 'RIGHTS',
    title: '만족도 조사와 결과 반영',
    requirements: [
      '수급자(보호자) 만족도 조사를 정해진 주기로 실시했다',
      '결과를 분석하고 개선 조치를 한 기록이 있다',
    ],
  },
  {
    code: 'RGT-06',
    group: 'RIGHTS',
    title: '예방접종 현황 관리 (신설)',
    requirements: [
      '수급자와 종사자의 예방접종(독감·폐렴구균 등) 접종 현황을 파악한다',
      '접종률을 높이기 위한 안내·권유 기록이 있다',
    ],
  },
];

export function indicatorByCode(code: string): EvalIndicator | undefined {
  return EVAL_INDICATORS.find((i) => i.code === code);
}

export function groupLabel(group: EvalGroup): string {
  return EVAL_GROUPS.find((g) => g.id === group)?.label ?? group;
}

export function indicatorsByGroup(): Array<{ id: EvalGroup; label: string; indicators: EvalIndicator[] }> {
  return EVAL_GROUPS.map((g) => ({ ...g, indicators: EVAL_INDICATORS.filter((i) => i.group === g.id) }));
}

export const EVAL_STATUS_LABEL: Readonly<Record<EvalStatus, string>> = {
  READY: '준비 완료',
  PARTIAL: '일부 준비',
  MISSING: '준비 안 됨',
  NOT_APPLICABLE: '해당 없음',
};

export interface ReadinessSummary {
  ready: number;
  partial: number;
  missing: number;
  /** 해당 없음을 뺀 대상 지표 수 */
  total: number;
  /** 준비 완료 비율(0~100). 일부 준비는 넣지 않는다 — 평가에서는 부분 충족이 점수가 아니라 보완 대상이기 때문 */
  percent: number;
}

/**
 * 저장된 점검 상태를 지표 목록과 맞춰 요약한다.
 * 점검 기록이 없는 지표는 "준비 안 됨"이고, 목록에 없는 코드(옛 지표)는 세지 않는다. 같은 코드가 둘이면 마지막 것을 쓴다.
 */
export function readinessSummary(checks: ReadonlyArray<Pick<EvalCheck, 'indicatorCode' | 'status'>>): ReadinessSummary {
  const byCode = new Map<string, EvalStatus>();
  for (const c of checks) byCode.set(c.indicatorCode, c.status);
  let ready = 0;
  let partial = 0;
  let notApplicable = 0;
  for (const indicator of EVAL_INDICATORS) {
    const status = byCode.get(indicator.code);
    if (status === 'READY') ready += 1;
    else if (status === 'PARTIAL') partial += 1;
    else if (status === 'NOT_APPLICABLE') notApplicable += 1;
  }
  const total = EVAL_INDICATORS.length - notApplicable;
  return {
    ready,
    partial,
    missing: total - ready - partial,
    total,
    percent: total === 0 ? 0 : Math.round((ready / total) * 100),
  };
}
