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
  | 'CARE_PLAN_AGREEMENT'
  /** 이번 달 필수 점검(운영일마다·주 1회·월 1회)을 주기대로 한 비율 — 지표마다 보는 점검 종류가 다르다(safetyRules의 EVAL_SAFETY_KINDS) */
  | 'SAFETY_CHECKS'
  /** 올해 재난 대응 훈련을 상반기·하반기에 각 1회(연 2회) 했는가 */
  | 'DRILL_TWICE'
  /** 올해 사고·상태변화 기록 중 즉시 조치와 (필요한) 보호자 연락을 갖춘 비율 — 2026 '응급상황대응' */
  | 'CARE_EVENT_FOLLOWUP'
  /** 지난달 보호자 월간 안내를 보낸 어르신 비율 — 2026 '소통노력'의 기관 소식 월 1회. 보호자 상담(분기 1회)은 별도이며 일방향 안내만으로는 인정되지 않는다 */
  | 'GUARDIAN_NOTICE_MONTHLY'
  /** 올해 외부기관·지역자원 연계 건수(의료기관 진료 연계는 따로 셈) — 2026 '외부기관연계' 기준① */
  | 'RESOURCE_LINKS'
  /** 올해 지난 분기마다 일반 의약품 사용기한·보관상태 점검을 했고 보관함(냉장고 포함) 잠금을 확인했는가 — 2026 '투약 및 약품관리' 기준①② */
  | 'MEDICINE_QUARTERLY'
  /** 올해 퇴소한 수급자의 연계기록지를 퇴소일까지 작성·제공했는가(제공대장 포함) — 2026 '외부기관연계' 기준② */
  | 'DISCHARGE_REFERRAL'
  /** 진행 중 계약 중 급여제공계획을 급여제공 시작일까지 공단에 통보한 비율 — 2026 '급여제공계획 수립 및 제공' 기준② */
  | 'PLAN_NOTIFIED_BY_START'
  /** 신규 계약 중 급여제공 시작일부터 14일 안에 노인인권 지침을 안내한 비율 — 2026 '노인인권' 기준④ */
  | 'RIGHTS_GUIDE_14D';

export interface EvalIndicator {
  code: string;
  group: EvalGroup;
  title: string;
  requirements: string[];
  autoSource?: EvalAutoSource;
  /** 2025판에는 있었으나 2026판 평가에서 삭제된 지표. 점검표에는 남겨 두되 준비율 계산에서는 뺀다 */
  deletedIn2026?: boolean;
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
  SAFETY_CHECKS: '위생·안전 점검표의 이번 달 주기 이행 현황',
  DRILL_TWICE: '재난 대응 훈련의 올해 반기별 실시 현황',
  CARE_EVENT_FOLLOWUP: '상태변화·사고 기록의 즉시 조치·보호자 연락 현황 (올해)',
  GUARDIAN_NOTICE_MONTHLY: '보호자 월간 안내 발송 현황 (지난달) — 기관 소식 월 1회 근거이며, 보호자 상담은 분기 1회 별도로 있어야 하고 일방향 안내만으로는 인정되지 않음',
  RESOURCE_LINKS: '외부기관·지역자원 연계 기록 (올해, 의료기관 진료 연계 따로 셈 — 퇴소 연계기록지는 포함 안 됨)',
  MEDICINE_QUARTERLY: '약품 보관 점검의 올해 분기별 실시·잠금 확인 현황 (지난 분기마다 1회 이상, 사용기한 지난 약 보관 시 불인정 — 투약 6원칙 면담은 따로)',
  DISCHARGE_REFERRAL: '퇴소 연계기록지와 제공대장의 올해 작성·제공 현황 (퇴소일까지 작성·제공, 퇴소자가 없으면 충족)',
  PLAN_NOTIFIED_BY_START: '진행 중 계약의 급여제공계획 공단 통보 현황 (급여제공 시작일까지 통보 — 설명·확인서명은 따로 확인)',
  RIGHTS_GUIDE_14D: '신규 계약의 노인인권 지침 안내 현황 (급여제공 시작일부터 14일 이내 — 신규 수급자 기준)',
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
    autoSource: 'SAFETY_CHECKS',
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
    autoSource: 'SAFETY_CHECKS',
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
    autoSource: 'SAFETY_CHECKS',
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
    autoSource: 'SAFETY_CHECKS',
  },
  {
    code: 'SAFE-07',
    group: 'SAFETY',
    title: '재난 대응과 소방 안전',
    requirements: [
      '소방시설 점검 결과와 안전관리자 지정 기록이 있다',
      '재난(화재·지진) 대응 훈련을 연 2회(상반기·하반기 각 1회) 실시하고, 대피 경로·역할 분담·소요 시간·보완점을 기록했다',
      '비상 대피도와 대피 방법이 게시되어 있다',
    ],
    autoSource: 'DRILL_TWICE',
  },
  {
    code: 'SAFE-08',
    group: 'SAFETY',
    title: '응급상황 대응 체계 (2026 응급상황대응)',
    requirements: [
      '응급상황 매뉴얼에 응급상황 대처법·담당 역할(2026.1월부터 확인)·비상연락체계가 있고, 심정지·질식·경련·화상·낙상의 응급조치가 들어 있다',
      '위치를 알 수 있는 응급벨 또는 인터폰이 생활실·화장실(칸마다)·목욕실에 각 1개 이상 있고 정상 작동한다',
      '직원이 응급상황의 종류를 알고, 평가자가 제시하는 응급상황의 대응 방법을 말할 수 있다(면담)',
      '응급상황이 실제로 있었다면 대응과 보호자 연락(낙상은 가장 가까운 가족·보호자에게 반드시 알림)을 기록해 둔다 — 2026 지표에는 기록 필수사항이 없어 기관 자체 기록이며 서식은 대조 필요',
    ],
    autoSource: 'CARE_EVENT_FOLLOWUP',
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
    title: '급여 제공 계약 체결 (2026판 평가에서 삭제)',
    deletedIn2026: true,
    requirements: [
      '2026판 평가 지표에서는 삭제됐다(2025판 "계약체결 및 통보"). 계약은 시행규칙 제16조와 청구 요건으로 계속 지켜야 하며 계약·인정 도구의 알림으로 관리한다',
      '수급자(보호자)와 맺은 급여 제공 계약서가 모든 수급자에게 있다',
      '이용 요금·본인부담금·비급여 항목을 계약 전에 설명하고 동의받았다',
      '계약 내용이 바뀌면 변경 계약이나 동의 기록이 있다',
    ],
  },
  {
    code: 'SVC-02',
    group: 'SERVICE',
    title: '급여 개시·변경 사항 통보 (2026판 평가에서 삭제)',
    deletedIn2026: true,
    requirements: [
      '2026판 평가 지표에서는 삭제됐다(2025판 "계약체결 및 통보"의 전월 말일 통보). 다만 계약·변경은 지체 없이 공단에 통보해야 하고, 미이용일 급여비용은 급여 개시 전월 말일까지 통보돼야 청구할 수 있다(고시 제32조)',
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
  {
    code: 'SVC-08',
    group: 'SERVICE',
    title: '급여제공계획의 공단 통보 (2026 급여제공계획 수립 및 제공 기준②)',
    requirements: [
      '모든 급여제공계획에 대해 수급자 또는 보호자에게 설명하고 확인서명을 받았다(스마트장기요양 앱 모바일 동의도 인정, 비대면은 계획서 전문을 보낸 뒤 유선 안내를 기록)',
      '확인서명을 받은 급여제공계획을 급여제공 시작일까지 공단에 통보했다(\'급여제공 시작일까지\'는 2026.1월부터 확인)',
      '기능상태·욕구가 바뀌어 계획을 고칠 때는 사유를 기록하고 고친 계획대로 제공한다(급여내용·시간·횟수 등)',
    ],
    autoSource: 'PLAN_NOTIFIED_BY_START',
  },

  // ---------- 간호·건강 ----------
  {
    code: 'HLT-01',
    group: 'HEALTH',
    title: '투약 관리 (2026 투약 및 약품관리 기준③)',
    requirements: [
      '가족의 투약의뢰서와 의사 처방을 확인한 뒤 투약한다(2026 매뉴얼에는 의뢰서 서식 항목이 정해져 있지 않아 기관 자체 서식이며 대조 필요)',
      '수급자 이름·약물 이름·용량·투여경로·투약시간을 확인해 투약하고, 투약 후 수급자 상태와 처치 내용을 기록한다(투약자·시간 서식은 정해져 있지 않아 대조 필요)',
      '간호(조무)사가 투약 6원칙(정확한 대상자·약물·용량·경로·시간·기록)을 안다 — 면담으로 확인하며 간호(조무)사가 없으면 시설장과 면담한다',
      '투약 오류·누락이 있었다면 보고와 조치가 남아 있다',
    ],
  },
  {
    code: 'HLT-02',
    group: 'HEALTH',
    title: '약품 보관 관리 (2026 투약 및 약품관리 기준①②)',
    requirements: [
      '약품보관함에 잠금장치가 있고 열쇠로 잠가 수급자가 열 수 없다. 냉장고에 약을 보관하면 냉장고도 잠금장치가 있다',
      '일반 의약품의 사용기한과 보관상태를 분기별 1회 이상 점검하고 일자·의약품명·효능·사용기한·점검자명·폐기일자를 적는다(사용기한·폐기일자는 2026.1월부터 확인)',
      '점검은 해당 급여를 제공하는 직원이 작성해야 인정되고, 사용기한이 지난 약품을 보관하고 있으면 불인정이다',
      '냉장·실온 등 약품 취급방법에 따라 보관하는지 현장에서 확인한다(온도 기준 수치는 근거를 못 찾아 대조 필요)',
    ],
    autoSource: 'MEDICINE_QUARTERLY',
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
    title: '외부기관 연계 — 진료·지역자원 (2026 외부기관연계 기준①)',
    requirements: [
      '의료기관에서 진료받은 내용(급여제공시간 중 종사자와 동행한 진료)을 급여제공기록지·간호일지·상담일지 등에 기록한다',
      '지역 보건·복지기관(치매안심센터·복지관 등) 연계는 별도 지표가 없으나 연계 날짜·내용·결과를 기록해 사례관리 근거로 둔다(대조 필요)',
      '퇴소(계약 종료) 때 주는 연계기록지와 제공대장은 이 연계 기록으로 증명되지 않는다 — 아래 퇴소 연계기록지 지표에서 따로 확인한다',
    ],
    autoSource: 'RESOURCE_LINKS',
  },
  {
    code: 'HLT-05',
    group: 'HEALTH',
    title: '퇴소 연계기록지와 제공대장 (2026 외부기관연계 기준②)',
    requirements: [
      '계약 종료일까지 수급자(보호자)에게 연계기록지(작성일자·수급자명·등급·심신기능 상태·제공한 급여·퇴소 후 서비스 이용계획)를 작성해 주고 제공대장(제공일자·방법·제공자명·수령자명)을 남긴다',
      '제공자명은 2026.1월부터 확인한다. 퇴소일보다 작성일·제공일이 늦으면 상담기록지 등 관련 서류로 예외 인정될 수 있다',
      '지표 적용 기간에 퇴소자가 없으면 연계기록지 기준은 충족하고, 사망하거나 퇴소 없이 입원한 경우는 작성하지 않는다. 병설·같은 법인 기관으로 전원하거나 입원 후 퇴소(계약해지)하면 작성한다',
      '종료 상담은 수급자 본인과 하고, 인지기능 저하 등으로 어려우면 보호자와 한다(공개 법령에 연계기록지 서식 번호는 없어 기관 자체 서식 — 대조 필요)',
    ],
    autoSource: 'DISCHARGE_REFERRAL',
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
    title: '보호자 소통 (2026 소통노력)',
    requirements: [
      '모든 수급자(보호자)와 상담을 분기별 1회 이상 하고 상담일자·수급자명·상담직원명·상담대상자명(관계)·상담내용을 기록한다(내방·방문·전화 모두 인정)',
      '문자·SNS 정보 제공 같은 일방향 안내만으로는 상담으로 인정되지 않는다 — 보호자와 의견을 주고받은 양방향 기록이 있어야 한다',
      '월간 프로그램 계획표·식단표·기관 소식을 월 1회 이상 보호자에게 제공하고(온라인 또는 인편·우편) 제공한 기록이 남아 있다',
      '상담 결과를 연 1회 이상 급여에 반영하고, 상담일부터 30일 이내 반영한 내용이 급여제공계획서·상태변화기록지 등으로 확인된다',
    ],
    autoSource: 'GUARDIAN_NOTICE_MONTHLY',
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
      '신규 수급자에게 급여제공 시작일부터 14일 이내(토·공휴일 포함) 노인인권 8가지 지침을 안내하고 기록했다(2026 노인인권 기준④)',
    ],
    autoSource: 'RIGHTS_GUIDE_14D',
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
 * 점검 기록이 없는 지표는 "준비 안 됨"이고, 목록에 없는 코드(옛 지표)와 2026판에서 삭제된 지표(deletedIn2026)는 세지 않는다. 같은 코드가 둘이면 마지막 것을 쓴다.
 */
export function readinessSummary(checks: ReadonlyArray<Pick<EvalCheck, 'indicatorCode' | 'status'>>): ReadinessSummary {
  const byCode = new Map<string, EvalStatus>();
  for (const c of checks) byCode.set(c.indicatorCode, c.status);
  let ready = 0;
  let partial = 0;
  let notApplicable = 0;
  const active = EVAL_INDICATORS.filter((i) => !i.deletedIn2026);
  for (const indicator of active) {
    const status = byCode.get(indicator.code);
    if (status === 'READY') ready += 1;
    else if (status === 'PARTIAL') partial += 1;
    else if (status === 'NOT_APPLICABLE') notApplicable += 1;
  }
  const total = active.length - notApplicable;
  return {
    ready,
    partial,
    missing: total - ready - partial,
    total,
    percent: total === 0 ? 0 : Math.round((ready / total) * 100),
  };
}
