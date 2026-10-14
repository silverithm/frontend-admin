/** 보호자 월간 안내 — 보낸 방법 이름, 사실 묶음 읽기, 저장 전 검사, 지난달 기본값 */
import type { CopayStatus, GuardianNoticeMethod, NoticeFacts } from '@/lib/lab/labTypes';
import { currentMonth, shiftMonth, todayString } from '@/components/lab/labFormat';

export const NOTICE_METHODS: ReadonlyArray<{ value: GuardianNoticeMethod; label: string }> = [
  { value: 'SMS', label: '문자' },
  { value: 'KAKAO', label: '카카오톡' },
  { value: 'PRINT', label: '인쇄해서 전달' },
  { value: 'EMAIL', label: '이메일' },
  { value: 'VISIT', label: '방문 때 전달' },
  { value: 'OTHER', label: '기타' },
];

export const noticeMethodLabel = (m: string | null): string => NOTICE_METHODS.find((x) => x.value === m)?.label ?? (m ?? '');

export const COPAY_STATUS_LABEL: Record<CopayStatus, string> = { UNPAID: '미납', PARTIAL: '일부 납부', PAID: '납부 완료' };

export const NOTICE_TITLE_MAX = 100;
export const NOTICE_BODY_MAX = 4000;
export const NOTICE_FACTS_MAX = 8000;

/** 안내는 보통 월초에 지난달 것을 보낸다 — 10일까지는 지난달, 그 뒤는 이번 달을 기본으로 */
export function defaultNoticeMonth(): string {
  const today = todayString();
  return Number(today.slice(8, 10)) <= 10 ? shiftMonth(currentMonth(), -1) : currentMonth();
}

/** 저장해 둔 사실 묶음(JSON) 읽기. 모양이 틀리면 null */
export function parseFacts(json: string | null): NoticeFacts | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Partial<NoticeFacts> | null;
    if (v && typeof v === 'object' && typeof v.month === 'string' && v.vitals && v.programs && v.rehab && Array.isArray(v.events)) return v as NoticeFacts;
  } catch {
    /* 아래에서 null */
  }
  return null;
}

export function validateNotice(title: string, body: string, writer: string): string | null {
  if (title.trim() === '') return '제목을 적어 주세요';
  if (title.length > NOTICE_TITLE_MAX) return `제목은 ${NOTICE_TITLE_MAX}자까지 적을 수 있습니다`;
  if (body.trim() === '') return '본문을 적어 주세요';
  if (body.length > NOTICE_BODY_MAX) return `본문은 ${NOTICE_BODY_MAX.toLocaleString('ko-KR')}자까지 적을 수 있습니다`;
  if (writer.trim() === '') return '작성자 이름을 적어 주세요';
  return null;
}
