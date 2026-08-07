import { FormSchema } from '@/types/formSchema';

/**
 * 기본 제공 전자결재 양식 세트.
 *
 * 어느 기관이 가입하든 바로 기안할 수 있도록, 복지시설에서 널리 쓰는
 * 표준 기안 양식을 온라인 폼(FormSchema)으로 정의해둔다.
 * 양식 관리 화면에서 등록된 양식이 하나도 없으면 자동으로 시딩되고,
 * "기본 양식 불러오기" 버튼으로 언제든 다시 추가할 수 있다(이름이 같은 양식은 건너뜀).
 */

/** 기본 대분류 목록 — 기관이 직접 입력해 새 분류를 만들 수도 있다 */
export const DEFAULT_TEMPLATE_CATEGORIES = ['공문', '교육', '인사', '운영'] as const;

/** 대분류 미지정 양식을 묶을 라벨 */
export const UNCATEGORIZED_LABEL = '미분류';

export interface DefaultTemplateDef {
  name: string;
  description: string;
  category: string;
  schema: FormSchema;
}

const schema = (fields: FormSchema['fields']): FormSchema => ({ version: 1, fields });

export const DEFAULT_APPROVAL_TEMPLATES: DefaultTemplateDef[] = [
  // ── 공문 ─────────────────────────────────────────────
  {
    name: '대외 공문',
    description: '외부 기관 발송용 표준 공문 (수신·참조·본문)',
    category: '공문',
    schema: schema([
      { id: 'recipient', type: 'text', label: '수신', placeholder: '예: ○○구청장', required: true, width: 'half' },
      { id: 'reference', type: 'text', label: '참조', placeholder: '예: 복지정책과장', required: false, width: 'half' },
      { id: 'subject', type: 'text', label: '제목', placeholder: '공문 제목', required: true, width: 'full' },
      { id: 'body', type: 'textarea', label: '본문', placeholder: '1. 귀 기관의 무궁한 발전을 기원합니다.\n2. …', required: true, width: 'full' },
      { id: 'effective_date', type: 'date', label: '시행일자', required: false, width: 'half' },
    ]),
  },
  {
    name: '품의서',
    description: '물품 구매·지출 승인 요청 (내역·금액 자동 합계)',
    category: '공문',
    schema: schema([
      { id: 'subject', type: 'text', label: '건명', placeholder: '예: 프로그램 재료 구입의 건', required: true, width: 'full' },
      { id: 'reason', type: 'textarea', label: '품의 사유', placeholder: '구매/지출이 필요한 사유를 적어주세요', required: true, width: 'full' },
      {
        id: 'items', type: 'repeater', label: '내역', required: true, width: 'full',
        repeater: {
          addLabel: '내역 추가',
          minRows: 1,
          fields: [
            { id: 'item_name', type: 'text', label: '품목', required: true, width: 'third' },
            { id: 'item_qty', type: 'number', label: '수량', required: true, width: 'third' },
            { id: 'item_amount', type: 'number', label: '금액(원)', required: true, width: 'third' },
          ],
        },
      },
      {
        id: 'total_amount', type: 'computed', label: '합계 금액', required: false, width: 'half',
        computed: { operation: 'sum', sourceRepeaterId: 'items', sourceRepeaterFieldId: 'item_amount', unit: '원' },
      },
      { id: 'note', type: 'text', label: '비고', required: false, width: 'half' },
    ]),
  },
  {
    name: '업무일지',
    description: '일일 업무 내용·특이사항 보고',
    category: '공문',
    schema: schema([
      { id: 'work_date', type: 'date', label: '일자', required: true, width: 'half' },
      { id: 'writer_role', type: 'text', label: '담당 업무', placeholder: '예: 요양보호(주간)', required: false, width: 'half' },
      { id: 'today_work', type: 'textarea', label: '금일 업무 내용', required: true, width: 'full' },
      { id: 'issues', type: 'textarea', label: '특이사항', placeholder: '어르신 상태 변화, 민원, 사고 등', required: false, width: 'full' },
      { id: 'tomorrow_plan', type: 'textarea', label: '명일 계획', required: false, width: 'full' },
    ]),
  },
  // ── 교육 ─────────────────────────────────────────────
  {
    name: '교육 기획서',
    description: '직원·어르신 대상 교육/프로그램 기획',
    category: '교육',
    schema: schema([
      { id: 'edu_name', type: 'text', label: '교육명', required: true, width: 'full' },
      { id: 'edu_date', type: 'date', label: '교육 일시', required: true, width: 'half' },
      { id: 'edu_place', type: 'text', label: '장소', required: false, width: 'half' },
      { id: 'edu_target', type: 'text', label: '교육 대상', placeholder: '예: 전 직원, 요양보호사', required: true, width: 'half' },
      { id: 'edu_lecturer', type: 'text', label: '강사', required: false, width: 'half' },
      { id: 'edu_content', type: 'textarea', label: '교육 내용', required: true, width: 'full' },
      { id: 'edu_budget', type: 'number', label: '소요 예산(원)', required: false, width: 'half' },
    ]),
  },
  {
    name: '교육 결과 보고서',
    description: '실시한 교육의 결과·평가 보고',
    category: '교육',
    schema: schema([
      { id: 'edu_name', type: 'text', label: '교육명', required: true, width: 'full' },
      { id: 'edu_date', type: 'date', label: '실시일', required: true, width: 'half' },
      { id: 'edu_attendee_count', type: 'number', label: '참석 인원(명)', required: true, width: 'half' },
      { id: 'edu_content', type: 'textarea', label: '교육 내용 요약', required: true, width: 'full' },
      { id: 'edu_review', type: 'textarea', label: '평가 및 개선사항', required: false, width: 'full' },
    ]),
  },
  // ── 인사 ─────────────────────────────────────────────
  {
    name: '연차 사용 계획서',
    description: '연간 연차 사용 계획 제출',
    category: '인사',
    schema: schema([
      { id: 'plan_year', type: 'text', label: '해당 연도', placeholder: '예: 2026년', required: true, width: 'half' },
      { id: 'total_days', type: 'number', label: '보유 연차(일)', required: true, width: 'half' },
      {
        id: 'plans', type: 'repeater', label: '사용 계획', required: true, width: 'full',
        repeater: {
          addLabel: '계획 추가',
          minRows: 1,
          fields: [
            { id: 'plan_date', type: 'date', label: '사용 예정일', required: true, width: 'half' },
            { id: 'plan_days', type: 'number', label: '일수', required: true, width: 'quarter' },
            { id: 'plan_note', type: 'text', label: '비고', required: false, width: 'quarter' },
          ],
        },
      },
      {
        id: 'plan_total', type: 'computed', label: '계획 합계', required: false, width: 'half',
        computed: { operation: 'sum', sourceRepeaterId: 'plans', sourceRepeaterFieldId: 'plan_days', unit: '일' },
      },
    ]),
  },
  {
    name: '경위서',
    description: '업무 중 발생한 사안의 경위 보고',
    category: '인사',
    schema: schema([
      { id: 'incident_date', type: 'date', label: '발생 일자', required: true, width: 'half' },
      { id: 'incident_place', type: 'text', label: '발생 장소', required: false, width: 'half' },
      { id: 'incident_detail', type: 'textarea', label: '경위', placeholder: '사안의 경위를 시간 순서대로 구체적으로 적어주세요', required: true, width: 'full' },
      { id: 'incident_action', type: 'textarea', label: '조치 사항', required: false, width: 'full' },
      { id: 'incident_opinion', type: 'textarea', label: '본인 의견', required: false, width: 'full' },
    ]),
  },
  // ── 운영 ─────────────────────────────────────────────
  {
    name: '지출결의서',
    description: '운영비 지출 결의 (항목별 내역·합계)',
    category: '운영',
    schema: schema([
      { id: 'spend_date', type: 'date', label: '지출일', required: true, width: 'half' },
      {
        id: 'method', type: 'select', label: '결제 수단', required: true, width: 'half',
        options: [
          { label: '법인카드', value: 'corp_card' },
          { label: '계좌이체', value: 'transfer' },
          { label: '현금', value: 'cash' },
        ],
      },
      {
        id: 'spend_items', type: 'repeater', label: '지출 내역', required: true, width: 'full',
        repeater: {
          addLabel: '내역 추가',
          minRows: 1,
          fields: [
            { id: 'spend_item', type: 'text', label: '항목', required: true, width: 'third' },
            { id: 'spend_detail', type: 'text', label: '내용', required: false, width: 'third' },
            { id: 'spend_amount', type: 'number', label: '금액(원)', required: true, width: 'third' },
          ],
        },
      },
      {
        id: 'spend_total', type: 'computed', label: '합계 금액', required: false, width: 'half',
        computed: { operation: 'sum', sourceRepeaterId: 'spend_items', sourceRepeaterFieldId: 'spend_amount', unit: '원' },
      },
      { id: 'spend_note', type: 'text', label: '비고', required: false, width: 'half' },
    ]),
  },
  {
    name: '회의록',
    description: '회의 내용·결정사항 기록',
    category: '운영',
    schema: schema([
      { id: 'meeting_name', type: 'text', label: '회의명', required: true, width: 'full' },
      { id: 'meeting_date', type: 'date', label: '일시', required: true, width: 'half' },
      { id: 'meeting_place', type: 'text', label: '장소', required: false, width: 'half' },
      { id: 'attendees', type: 'textarea', label: '참석자', placeholder: '참석자 이름을 적어주세요', required: true, width: 'full' },
      { id: 'agenda', type: 'textarea', label: '안건 및 논의 내용', required: true, width: 'full' },
      { id: 'decisions', type: 'textarea', label: '결정 사항', required: false, width: 'full' },
      { id: 'next_meeting', type: 'text', label: '차기 회의 일정', required: false, width: 'half' },
    ]),
  },
];
