'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FiFileText, FiPlay, FiSearch } from 'react-icons/fi';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { SegmentedControl } from '@/components/ui/SlidingSegmentedControl';
import { ChatImage } from '@/components/chat/ChatImage';
import { fetchChatFilesPage } from '@/lib/apiService';
import { chatListImageUrl } from '@/lib/chatAttachments';
import {
    CHAT_FILES_KINDS,
    CHAT_FILES_KIND_LABEL,
    browseChatFilesLocally,
    formatChatFileSize,
    formatChatFilesDay,
    formatChatFilesMonth,
    groupChatFilesByDay,
    isPagedChatFilesResponse,
    parseChatFilesPage,
    type ChatFileLike,
    type ChatFilesKind,
    type ChatFilesMonth,
} from '@/lib/chatFilesBrowse';

/** 화면에 그리는 데 필요한 만큼 — ChatManagement의 메시지 타입이 그대로 들어온다 */
export interface ChatFileItem extends ChatFileLike {
    fileUrl?: string;
    thumbnailUrl?: string;
    fileSize?: number;
}

const PAGE_SIZE = 60;
const countText = (n: number) => n.toLocaleString('ko-KR');

/**
 * 채팅 '파일 모아보기' — 검색 · 사진/동영상/파일 · 달로 이동 · 날짜별 묶음 · 이어 받기.
 *
 * 예전에는 방의 사진·파일 5천여 건이 썸네일 없이 이름 한 줄짜리 단추로 통째로 나왔다(사용자 "검색도
 * 날짜별도 안 되고 한 줄로만 쭉 나온다"). 사진·동영상은 날짜별 바둑판, 파일은 날짜별 목록으로 보이고
 * 끝까지 내리면 다음 쪽을 받는다. 앱 ChatFilesBrowser와 같은 규칙이다.
 */
export function ChatFilesBrowser<T extends ChatFileItem>({
    roomId,
    onOpenPhoto,
    onOpenOther,
    maxHeight,
}: {
    roomId: number;
    /** 사진을 누르면 — 지금까지 받은 사진 전체와 누른 위치(좌우로 넘겨 본다) */
    onOpenPhoto: (photos: T[], index: number) => void;
    /** 동영상·문서를 누르면 — 여는 방식은 채팅 화면이 정한다(말풍선과 같게) */
    onOpenOther: (message: T) => void;
    /** 목록 부분 높이 상한 */
    maxHeight: string | number;
}) {
    const [kind, setKind] = useState<ChatFilesKind>('IMAGE');
    const [queryInput, setQueryInput] = useState('');
    const [query, setQuery] = useState('');
    const [month, setMonth] = useState<string | null>(null);
    const [items, setItems] = useState<T[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [counts, setCounts] = useState<Record<ChatFilesKind, number>>({ IMAGE: 0, VIDEO: 0, FILE: 0 });
    const [months, setMonths] = useState<ChatFilesMonth[]>([]);

    /** 옛 서버가 통째로 준 목록 — 있으면 화면에서 거른다 */
    const legacyAllRef = useRef<T[] | null>(null);
    /** 늦게 온 옛 응답이 새 결과를 덮지 않게 요청마다 센다 */
    const generationRef = useRef(0);
    /** 처음 열 때·검색할 때만, 고른 탭이 비고 다른 탭에 있으면 그 탭으로 옮긴다 */
    const hopRef = useRef(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

    // 검색어는 잠깐 멈췄을 때 반영
    useEffect(() => {
        const t = setTimeout(() => {
            const next = queryInput.trim();
            if (next === query) return;
            hopRef.current = next.length > 0;
            setMonth(null);
            setQuery(next);
        }, 300);
        return () => clearTimeout(t);
    }, [queryInput, query]);

    const fetchPage = useCallback(
        async (opts: { kind: ChatFilesKind; query: string; month: string | null; beforeId?: number }) => {
            const legacy = legacyAllRef.current;
            if (legacy) {
                return browseChatFilesLocally(legacy, { ...opts, size: PAGE_SIZE });
            }
            const json = await fetchChatFilesPage(roomId, {
                kind: opts.kind,
                q: opts.query || undefined,
                beforeId: opts.beforeId,
                month: opts.beforeId == null ? opts.month ?? undefined : undefined,
                size: PAGE_SIZE,
            });
            if (!isPagedChatFilesResponse(json)) {
                // 옛 서버 — 통째로 왔다. 이후로는 서버를 다시 부르지 않고 화면에서 거른다
                const all = (Array.isArray(json?.files) ? json.files : []) as T[];
                legacyAllRef.current = all;
                return browseChatFilesLocally(all, { ...opts, size: PAGE_SIZE });
            }
            return parseChatFilesPage<T>(json);
        },
        [roomId],
    );

    // 종류·검색어·달이 바뀌면 처음 쪽부터
    useEffect(() => {
        const gen = ++generationRef.current;
        setIsLoading(true);
        setHasError(false);
        setItems([]);
        setHasMore(false);
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        fetchPage({ kind, query, month })
            .then((page) => {
                if (gen !== generationRef.current) return;
                setCounts(page.counts);
                setMonths(page.months);
                const hop = hopRef.current;
                hopRef.current = false;
                if (hop && page.items.length === 0) {
                    const other = CHAT_FILES_KINDS.find((k) => page.counts[k] > 0);
                    if (other && other !== kind) {
                        setKind(other);
                        return; // 바뀐 종류로 다시 부른다
                    }
                }
                setItems(page.items);
                setHasMore(page.hasMore);
                setIsLoading(false);
            })
            .catch((error) => {
                if (gen !== generationRef.current) return;
                console.error('[ChatFilesBrowser] 불러오기 실패:', error);
                setHasError(true);
                setIsLoading(false);
            });
    }, [fetchPage, kind, query, month]);

    const loadMore = useCallback(() => {
        if (!hasMore || isLoading || isLoadingMore || items.length === 0) return;
        const gen = generationRef.current;
        setIsLoadingMore(true);
        fetchPage({ kind, query, month, beforeId: items[items.length - 1].id })
            .then((page) => {
                if (gen !== generationRef.current) return;
                setItems((prev) => [...prev, ...page.items]);
                setHasMore(page.hasMore);
                setCounts(page.counts);
            })
            .catch((error) => {
                // 더 불러오기 실패는 목록을 지우지 않는다 — 다시 내리면 또 시도한다
                console.error('[ChatFilesBrowser] 더 불러오기 실패:', error);
            })
            .finally(() => {
                if (gen === generationRef.current) setIsLoadingMore(false);
            });
    }, [fetchPage, hasMore, isLoading, isLoadingMore, items, kind, query, month]);

    // 목록 끝이 보이면 다음 쪽
    useEffect(() => {
        const root = scrollRef.current;
        const target = sentinelRef.current;
        if (!root || !target || !hasMore) return;
        const io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) loadMore();
        }, { root, rootMargin: '400px 0px' });
        io.observe(target);
        return () => io.disconnect();
    }, [hasMore, loadMore]);

    const photos = kind === 'IMAGE' ? items : [];
    const days = groupChatFilesByDay(items);
    const label = CHAT_FILES_KIND_LABEL[kind];

    return (
        <div className="carev-chat-files">
            <div className="carev-chat-files-head">
                <TextInput
                    label="파일 검색"
                    isLabelHidden
                    placeholder="파일 이름·보낸 사람으로 찾기"
                    startIcon={FiSearch}
                    hasClear
                    value={queryInput}
                    onChange={(v) => setQueryInput(v)}
                />
                <SegmentedControl value={kind} onChange={(v) => { setMonth(null); setKind(v as ChatFilesKind); }} label="파일 종류" size="sm">
                    {CHAT_FILES_KINDS.map((k) => (
                        <SegmentedControlItem key={k} value={k} label={`${CHAT_FILES_KIND_LABEL[k]} ${countText(counts[k])}`} />
                    ))}
                </SegmentedControl>
                {months.length > 1 && (
                    <div className="carev-chat-files-months" role="group" aria-label="달로 이동">
                        <Button size="sm" variant={month === null ? 'secondary' : 'ghost'} label="최신" onClick={() => setMonth(null)} />
                        {months.map((m) => (
                            <Button
                                key={m.month}
                                size="sm"
                                variant={month === m.month ? 'secondary' : 'ghost'}
                                label={`${formatChatFilesMonth(m.month)} (${countText(m.count)})`}
                                onClick={() => setMonth(m.month)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div ref={scrollRef} className="carev-chat-files-body" style={{ maxHeight }}>
                {isLoading && items.length === 0 ? (
                    <Text type="supporting" color="secondary">불러오는 중...</Text>
                ) : hasError && items.length === 0 ? (
                    <Text type="supporting" color="secondary">파일 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요</Text>
                ) : items.length === 0 ? (
                    <Text type="supporting" color="secondary">
                        {query ? `'${query}'에 맞는 ${label}이 없습니다` : `아직 주고받은 ${label}이 없습니다`}
                    </Text>
                ) : (
                    days.map((day) => (
                        <section key={day.key} className="carev-chat-files-day" aria-label={formatChatFilesDay(day.day)}>
                            <Text type="supporting" weight="semibold" color="secondary">{formatChatFilesDay(day.day)}</Text>
                            {kind === 'FILE' ? (
                                <div className="carev-chat-files-rows">
                                    {day.items.map((m) => (
                                        <button key={m.id} type="button" className="carev-chat-files-row" onClick={() => onOpenOther(m)}>
                                            <Icon icon={FiFileText} size="sm" color="secondary" />
                                            <span style={{ minWidth: 0, flex: 1 }}>
                                                <Text type="supporting" weight="semibold" color="primary" maxLines={1}>{m.fileName || '파일'}</Text>
                                                <Text type="supporting" color="secondary" maxLines={1}>
                                                    {[m.senderName, formatChatFileSize(m.fileSize), new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })].filter(Boolean).join(' · ')}
                                                </Text>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="carev-chat-files-grid">
                                    {day.items.map((m) => {
                                        const isVideo = kind === 'VIDEO';
                                        const thumb = isVideo ? m.thumbnailUrl : chatListImageUrl(m);
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                className="carev-chat-files-tile"
                                                aria-label={`${isVideo ? '동영상' : '사진'}, ${m.senderName ?? ''} 보냄`}
                                                onClick={() => (isVideo ? onOpenOther(m) : onOpenPhoto(photos, photos.indexOf(m)))}
                                            >
                                                {thumb ? (
                                                    <ChatImage src={thumb} alt="" className="carev-chat-photo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                ) : (
                                                    <span className="carev-chat-files-tile-empty" />
                                                )}
                                                {isVideo && (
                                                    <span className="carev-chat-files-play" aria-hidden>
                                                        <Icon icon={FiPlay} size="sm" />
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    ))
                )}
                {hasMore && <div ref={sentinelRef} className="carev-chat-files-more"><Text type="supporting" color="secondary">불러오는 중...</Text></div>}
            </div>
        </div>
    );
}
