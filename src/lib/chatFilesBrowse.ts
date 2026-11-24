/**
 * 채팅 '파일 모아보기'의 순수 로직 — 종류 구분, 날짜 묶음, 이름표, 옛 서버용 화면 안 거르기.
 *
 * 예전 패널은 방의 사진·파일 5천여 건을 이름 한 줄짜리 단추로 통째로 늘어놓았다(사용자 "검색도 날짜별도
 * 안 되고 한 줄로만 쭉 나온다"). 이제 서버가 종류·검색어·달로 걸러 한 쪽씩 준다(GET /files?size=…).
 * 서버가 아직 옛 버전이면 통째로 오는데, 그때도 같은 규칙으로 화면에서 거른다 — 규칙은 서버
 * SharedMediaBrowser·앱 chat_files_browse.dart와 같다.
 */
import { chatMediaType } from './chatMessageGrouping.ts';

export type ChatFilesKind = 'IMAGE' | 'VIDEO' | 'FILE';
export const CHAT_FILES_KINDS: ChatFilesKind[] = ['IMAGE', 'VIDEO', 'FILE'];
export const CHAT_FILES_KIND_LABEL: Record<ChatFilesKind, string> = { IMAGE: '사진', VIDEO: '동영상', FILE: '파일' };

/** 거르기에 필요한 만큼만 — 화면의 메시지 타입이 이걸 넘치게 갖고 있어도 된다 */
export interface ChatFileLike {
    id: number;
    type: string;
    senderName?: string;
    fileName?: string;
    mimeType?: string;
    mediaType?: string;
    createdAt: string;
    isDeleted?: boolean;
}

export interface ChatFilesMonth { month: string; count: number }

export interface ChatFilesPage<T> {
    items: T[];
    hasMore: boolean;
    counts: Record<ChatFilesKind, number>;
    months: ChatFilesMonth[];
}

export function chatFilesKindOf(m: ChatFileLike): ChatFilesKind {
    const k = chatMediaType(m);
    return k === 'IMAGE' || k === 'VIDEO' ? k : 'FILE';
}

/** 새 서버 응답({files, hasMore, counts, months})인지 — 옛 서버는 files만 준다 */
export function isPagedChatFilesResponse(json: unknown): boolean {
    return !!json && typeof json === 'object' && 'hasMore' in (json as Record<string, unknown>);
}

const emptyCounts = (): Record<ChatFilesKind, number> => ({ IMAGE: 0, VIDEO: 0, FILE: 0 });

export function parseChatFilesPage<T>(json: Record<string, unknown>): ChatFilesPage<T> {
    const counts = emptyCounts();
    const rawCounts = json.counts as Record<string, unknown> | undefined;
    if (rawCounts && typeof rawCounts === 'object') {
        for (const k of CHAT_FILES_KINDS) {
            const v = rawCounts[k];
            if (typeof v === 'number') counts[k] = v;
        }
    }
    const months: ChatFilesMonth[] = Array.isArray(json.months)
        ? (json.months as Array<Record<string, unknown>>)
            .filter((r) => r && typeof r.month === 'string' && typeof r.count === 'number')
            .map((r) => ({ month: r.month as string, count: r.count as number }))
        : [];
    return {
        items: Array.isArray(json.files) ? (json.files as T[]) : [],
        hasMore: json.hasMore === true,
        counts,
        months,
    };
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** 옛 서버가 통째로 준 목록을 서버와 같은 규칙으로 거르고 자른다 */
export function browseChatFilesLocally<T extends ChatFileLike>(
    all: T[],
    opts: { kind: ChatFilesKind; query?: string; month?: string | null; beforeId?: number | null; size?: number },
): ChatFilesPage<T> {
    const needle = (opts.query ?? '').trim().toLowerCase();
    const sorted = [...all].sort((a, b) => {
        const t = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return t !== 0 ? t : b.id - a.id;
    });
    const matched = sorted.filter((m) => {
        if (m.isDeleted) return false;
        if (m.type !== 'IMAGE' && m.type !== 'FILE') return false;
        if (!needle) return true;
        return (m.fileName ?? '').toLowerCase().includes(needle) || (m.senderName ?? '').toLowerCase().includes(needle);
    });

    const counts = emptyCounts();
    for (const m of matched) counts[chatFilesKindOf(m)] += 1;

    const ofKind = matched.filter((m) => chatFilesKindOf(m) === opts.kind);
    const byMonth = new Map<string, number>();
    for (const m of ofKind) {
        const key = monthKey(new Date(m.createdAt));
        byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    const months = [...byMonth.entries()].map(([month, count]) => ({ month, count }));

    let start = 0;
    if (opts.beforeId != null) {
        const idx = ofKind.findIndex((m) => m.id === opts.beforeId);
        if (idx >= 0) start = idx + 1;
        else {
            const next = ofKind.findIndex((m) => m.id < (opts.beforeId as number));
            start = next >= 0 ? next : ofKind.length;
        }
    } else if (opts.month) {
        const [y, mo] = opts.month.split('-').map(Number);
        if (Number.isInteger(y) && Number.isInteger(mo) && mo >= 1 && mo <= 12) {
            const nextMonthStart = new Date(y, mo, 1).getTime();
            const idx = ofKind.findIndex((m) => new Date(m.createdAt).getTime() < nextMonthStart);
            start = idx >= 0 ? idx : ofKind.length;
        }
    }
    const size = Math.max(1, Math.min(opts.size ?? 60, 200));
    const end = Math.min(start + size, ofKind.length);
    return { items: ofKind.slice(start, end), hasMore: end < ofKind.length, counts, months };
}

export interface ChatFilesDay<T> { key: string; day: Date; items: T[] }

/** 같은 날끼리 — 입력은 최신순, 결과도 최신 날 먼저 */
export function groupChatFilesByDay<T extends { createdAt: string }>(newestFirst: T[]): ChatFilesDay<T>[] {
    const out: ChatFilesDay<T>[] = [];
    for (const m of newestFirst) {
        const t = new Date(m.createdAt);
        const day = new Date(t.getFullYear(), t.getMonth(), t.getDate());
        const key = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
        const last = out[out.length - 1];
        if (last && last.key === key) last.items.push(m);
        else out.push({ key, day, items: [m] });
    }
    return out;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** '오늘' · '어제' · '11월 24일 (월)' · 올해가 아니면 '2025년 12월 3일 (수)' */
export function formatChatFilesDay(day: Date, now: Date = new Date()): string {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
    if (diff === 0) return '오늘';
    if (diff === 1) return '어제';
    const wd = WEEKDAYS[d.getDay()];
    return d.getFullYear() === now.getFullYear()
        ? `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`
        : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
}

/** "2026-11" → '11월'(올해) / '2025년 12월' */
export function formatChatFilesMonth(month: string, now: Date = new Date()): string {
    const [y, m] = month.split('-').map(Number);
    if (!Number.isInteger(y) || !Number.isInteger(m)) return month;
    return y === now.getFullYear() ? `${m}월` : `${y}년 ${m}월`;
}

export function formatChatFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
