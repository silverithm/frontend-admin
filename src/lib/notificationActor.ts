import type { PersonRef } from './memberDirectory';

/**
 * 알림 카드에 사진을 붙일 사람 — 서버가 적어 준 '일으킨 사람'(actorId, 2026-11-19 V1.111.0부터)이 먼저다.
 *
 * 그 전에 쌓인 알림(배포 전 휴가 신청 등)은 actorId가 비어 있어 아이콘만 떴다 — 2026-11-19 사용자
 * "한희정 조리원이 신청했습니다 뜨는데 왜 사진은 안 뜨나". 그래서 비어 있으면 알림 글에서 이름을 읽는다:
 * 채팅은 제목이 보낸 사람("한희정(조리원)"), 휴가 신청·결재·업무·회의록은 "한희정(조리원)님이 …" / "이수나님의 …".
 * 이름은 회사에 한 명뿐일 때만 사진첩에서 찾힌다(findPerson) — 동명이인이면 아이콘 그대로.
 *
 * 가입 요청은 읽지 않는다 — 아직 직원이 아닌 사람이라, 이름이 같은 기존 직원 얼굴이 붙으면 안 된다.
 */

type ActorSource = {
  type: string | null;
  title: string;
  message: string;
  actorId?: string | null;
};

/** "한희정(조리원)" → 한희정 — 이름은 글자·공백·가운뎃점만 */
const NAME = '([가-힣A-Za-z][가-힣A-Za-z ·]{0,18}?)\\s*(?:\\([^)]{1,20}\\))?';
const CHAT_SENDER = new RegExp(`^\\s*${NAME}\\s*$`);
const SENTENCE_SUBJECT = new RegExp(`^\\s*${NAME}\\s*님(?:이|의|께서)\\s`);

/** 이름을 읽어도 되는 알림 — 그 글의 주어가 알림을 일으킨 사람인 것만 */
const SUBJECT_IS_ACTOR = new Set(['VACATION_SUBMITTED', 'APPROVAL', 'WORK_TASK', 'MEETING_MINUTES']);

export function actorRefOf(n: ActorSource): PersonRef | null {
  const id = n.actorId?.trim();
  if (id) return { id };
  const type = n.type?.toUpperCase() ?? '';
  const match =
    type === 'CHAT' ? CHAT_SENDER.exec(n.title ?? '') : SUBJECT_IS_ACTOR.has(type) ? SENTENCE_SUBJECT.exec(n.message ?? '') : null;
  const name = match?.[1]?.trim();
  return name ? { name } : null;
}
