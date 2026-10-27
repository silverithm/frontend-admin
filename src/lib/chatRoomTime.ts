/**
 * 대화방 목록의 마지막 활동 시각 — 채팅 화면과 말풍선 채팅이 같이 쓴다.
 * 앱 목록과 같은 표기: 방금 / N분 전 / N시간 전 / 어제 / N일 전 / M/D.
 * (date-fns 상대 시간 함수의 '약 15시간 전'은 '30분 전'·'2일 전'과 섞여 들쭉날쭉해 쓰지 않는다.
 *  Astryx Timestamp(format="auto")는 영어로 고정돼 있어 처음부터 직접 만든다.)
 */
export function formatRoomTime(value: string, now: number = Date.now()): string {
  const date = new Date(value);
  const diffSeconds = Math.max(0, (now - date.getTime()) / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 2) return '어제';
  if (days < 7) return `${days}일 전`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
