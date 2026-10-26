import { format, formatDistance } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 대화방 목록의 마지막 활동 시각 — 채팅 화면과 말풍선 채팅이 같이 쓴다.
 * Astryx Timestamp(format="auto")는 상대 시간 문구가 "13 hours ago"처럼 영어로 고정돼 있어
 * (라이브러리 내부 하드코딩, locale prop 없음) date-fns ko 로케일로 직접 포맷한다.
 * 일주일이 넘으면 절대 날짜로 바꾼다.
 */
export function formatRoomTime(value: string, now: number = Date.now()): string {
  const date = new Date(value);
  const diffSeconds = (now - date.getTime()) / 1000;
  if (diffSeconds > 604800) {
    return format(date, 'yyyy.MM.dd', { locale: ko });
  }
  return formatDistance(date, now, { addSuffix: true, locale: ko });
}
