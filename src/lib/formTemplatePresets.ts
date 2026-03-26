import { FormSchema } from '@/types/formSchema';

export interface FormPreset {
  id: string;
  name: string;
  description: string;
  schema: FormSchema;
}

export const formPresets: FormPreset[] = [
  {
    id: 'leave-request',
    name: '휴가 신청서',
    description: '연차, 반차, 병가 등 휴가 신청',
    schema: {
      version: 1,
      fields: [
        {
          id: 'leave-type',
          type: 'select',
          label: '휴가 유형',
          required: true,
          options: [
            { label: '연차', value: 'annual' },
            { label: '반차(오전)', value: 'half-am' },
            { label: '반차(오후)', value: 'half-pm' },
            { label: '병가', value: 'sick' },
            { label: '경조사', value: 'family' },
            { label: '기타', value: 'other' },
          ],
          width: 'half',
        },
        { id: 'start-date', type: 'date', label: '시작일', required: true, width: 'half' },
        { id: 'end-date', type: 'date', label: '종료일', required: true, width: 'half' },
        {
          id: 'reason',
          type: 'textarea',
          label: '사유',
          required: true,
          placeholder: '휴가 사유를 입력하세요',
        },
      ],
    },
  },
  {
    id: 'business-trip',
    name: '출장비 정산서',
    description: '출장 교통비, 숙박비, 식비 정산',
    schema: {
      version: 1,
      fields: [
        { id: 'destination', type: 'text', label: '출장지', required: true, width: 'half' },
        { id: 'purpose', type: 'text', label: '출장 목적', required: true, width: 'half' },
        { id: 'trip-start', type: 'date', label: '출장 시작일', required: true, width: 'half' },
        { id: 'trip-end', type: 'date', label: '출장 종료일', required: true, width: 'half' },
        { id: 'section-expense', type: 'section', label: '비용 내역', required: false },
        {
          id: 'transport-cost',
          type: 'number',
          label: '교통비',
          required: false,
          width: 'half',
          placeholder: '원',
          validation: { min: 0 },
        },
        {
          id: 'accommodation-cost',
          type: 'number',
          label: '숙박비',
          required: false,
          width: 'half',
          placeholder: '원',
          validation: { min: 0 },
        },
        {
          id: 'meal-cost',
          type: 'number',
          label: '식비',
          required: false,
          width: 'half',
          placeholder: '원',
          validation: { min: 0 },
        },
        {
          id: 'other-cost',
          type: 'number',
          label: '기타 비용',
          required: false,
          width: 'half',
          placeholder: '원',
          validation: { min: 0 },
        },
        {
          id: 'total',
          type: 'number',
          label: '합계',
          required: true,
          placeholder: '원',
          validation: { min: 0 },
        },
        {
          id: 'receipt',
          type: 'file',
          label: '영수증 첨부',
          required: false,
          description: '영수증 파일을 첨부하세요',
        },
        { id: 'note', type: 'textarea', label: '비고', required: false },
      ],
    },
  },
  {
    id: 'supply-request',
    name: '물품 구매 신청서',
    description: '업무용 물품 구매 요청',
    schema: {
      version: 1,
      fields: [
        { id: 'item-name', type: 'text', label: '품명', required: true, width: 'half' },
        {
          id: 'quantity',
          type: 'number',
          label: '수량',
          required: true,
          width: 'half',
          validation: { min: 1 },
        },
        {
          id: 'unit-price',
          type: 'number',
          label: '단가',
          required: true,
          width: 'half',
          placeholder: '원',
          validation: { min: 0 },
        },
        {
          id: 'total-price',
          type: 'number',
          label: '합계 금액',
          required: true,
          width: 'half',
          placeholder: '원',
          validation: { min: 0 },
        },
        {
          id: 'usage',
          type: 'textarea',
          label: '용도',
          required: true,
          placeholder: '물품 사용 목적을 입력하세요',
        },
        {
          id: 'purchase-link',
          type: 'text',
          label: '구매 링크',
          required: false,
          placeholder: 'https://',
        },
      ],
    },
  },
  {
    id: 'overtime-report',
    name: '초과근무 신청서',
    description: '야근, 휴일근무 등 초과근무 신청',
    schema: {
      version: 1,
      fields: [
        {
          id: 'overtime-type',
          type: 'select',
          label: '근무 유형',
          required: true,
          options: [
            { label: '연장근무(야근)', value: 'overtime' },
            { label: '휴일근무', value: 'holiday' },
            { label: '야간근무', value: 'night' },
          ],
          width: 'half',
        },
        { id: 'work-date', type: 'date', label: '근무일', required: true, width: 'half' },
        {
          id: 'start-time',
          type: 'text',
          label: '시작 시간',
          required: true,
          width: 'half',
          placeholder: 'HH:MM',
        },
        {
          id: 'end-time',
          type: 'text',
          label: '종료 시간',
          required: true,
          width: 'half',
          placeholder: 'HH:MM',
        },
        {
          id: 'reason',
          type: 'textarea',
          label: '사유',
          required: true,
          placeholder: '초과근무 사유를 입력하세요',
        },
      ],
    },
  },
  {
    id: 'general-report',
    name: '업무 보고서',
    description: '일반 업무 보고 양식',
    schema: {
      version: 1,
      fields: [
        {
          id: 'report-type',
          type: 'select',
          label: '보고 유형',
          required: true,
          options: [
            { label: '일일 보고', value: 'daily' },
            { label: '주간 보고', value: 'weekly' },
            { label: '월간 보고', value: 'monthly' },
            { label: '특별 보고', value: 'special' },
          ],
          width: 'half',
        },
        { id: 'report-date', type: 'date', label: '보고일', required: true, width: 'half' },
        {
          id: 'content',
          type: 'textarea',
          label: '보고 내용',
          required: true,
          placeholder: '업무 내용을 상세히 작성하세요',
        },
        {
          id: 'issues',
          type: 'textarea',
          label: '특이사항',
          required: false,
          placeholder: '특이사항이 있으면 기재하세요',
        },
        { id: 'attachment', type: 'file', label: '첨부파일', required: false },
      ],
    },
  },
];
