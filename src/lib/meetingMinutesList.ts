import type { MeetingMinutes } from '@/types/meetingMinutes';

export interface MinutesSection {
  key: string;
  label: string;
  items: MeetingMinutes[];
}

/** 제목 검색 — 공백 구분 단어가 모두 들어 있어야 한다(대소문자 무시). 빈 검색어면 그대로 돌려준다. */
export function filterMinutesByTitle(items: MeetingMinutes[], query: string): MeetingMinutes[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const title = item.title.toLowerCase();
    return words.every((word) => title.includes(word));
  });
}

/** '2026-11-03T10:00:00' → '2026년 11월'. 형식이 어긋나면 '날짜 없음'. */
export function monthLabel(meetingStartAt: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(meetingStartAt || '');
  return match ? `${match[1]}년 ${Number(match[2])}월` : '날짜 없음';
}

/**
 * 월별로 묶는다 — 들어온 순서(최신순)를 그대로 지키고 월이 바뀔 때마다 새 묶음을 연다.
 * pinned가 있으면 조건에 맞는 항목을 월 묶음 앞의 별도 묶음(pinnedLabel)으로 먼저 보낸다.
 */
export function groupMinutesByMonth(
  items: MeetingMinutes[],
  pinned?: { label: string; predicate: (item: MeetingMinutes) => boolean },
): MinutesSection[] {
  const sections: MinutesSection[] = [];
  const pinnedItems = pinned ? items.filter(pinned.predicate) : [];
  if (pinned && pinnedItems.length > 0) {
    sections.push({ key: '__pinned__', label: pinned.label, items: pinnedItems });
  }
  const byMonth = new Map<string, MinutesSection>();
  for (const item of items) {
    if (pinned?.predicate(item)) continue;
    const label = monthLabel(item.meetingStartAt);
    let section = byMonth.get(label);
    if (!section) {
      section = { key: label, label, items: [] };
      byMonth.set(label, section);
      sections.push(section);
    }
    section.items.push(item);
  }
  return sections;
}
