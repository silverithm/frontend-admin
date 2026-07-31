'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Divider } from '@astryxdesign/core/Divider';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import {
  IconArrowLeft,
  IconCheck,
  IconEye,
  IconFlag,
  IconMessageCircle,
  IconMessages,
  IconNews,
  IconPencil,
  IconPinned,
  IconPlus,
  IconThumbUp,
  IconThumbUpFilled,
  IconTrash,
} from '@tabler/icons-react';
import { FiSearch } from 'react-icons/fi';
import { useAlert } from '@/components/Alert';
import { useConfirm } from '@/components/ConfirmDialog';
import {
  BOARD_META,
  REPORT_REASONS,
  type BoardType,
  type PlazaComment,
  type PlazaPost,
  acceptComment,
  addComment,
  createPost,
  deleteComment,
  deletePost,
  displayAuthor,
  getBoardMeta,
  getCurrentUser,
  getPost,
  getPosts,
  incrementView,
  reportPost,
  toggleLike,
  updateComment,
  updatePost,
} from './plazaStore';
import { getNewsCategoryMeta, type NewsItem } from './newsMock';
import { duration } from '@/theme/motion';

type BoardFilter = 'all' | BoardType;
type SortKey = 'latest' | 'popular' | 'comments';

const PAGE_SIZE = 8;

const timeAgo = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ko });

interface PlazaBoardProps {
  /** 게시판 상단 "오늘의 요양 소식" 스트립에 노출할 뉴스 (없으면 스트립 숨김) */
  newsItems?: NewsItem[];
  /** 뉴스 "더보기" 클릭 시 요양 소식 탭으로 전환 */
  onGoToNews?: () => void;
}

export default function PlazaBoard({ newsItems = [], onGoToNews }: PlazaBoardProps) {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const user = getCurrentUser();

  const [version, setVersion] = useState(0); // 스토어 변경 후 리렌더 트리거
  const refresh = () => setVersion((v) => v + 1);

  const [boardFilter, setBoardFilter] = useState<BoardFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('latest');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // 글 작성/수정 다이얼로그
  const [writeOpen, setWriteOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [formBoard, setFormBoard] = useState<BoardType>('free');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formAnonymous, setFormAnonymous] = useState(false);

  // 신고 다이얼로그
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);

  // 댓글 입력 상태
  const [commentInput, setCommentInput] = useState('');
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  const allPosts = useMemo(() => getPosts(), [version]);

  const visiblePosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = allPosts.filter((p) => {
      if (p.isHidden) return false;
      if (boardFilter !== 'all' && p.board !== boardFilter) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.content.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorter: Record<SortKey, (a: PlazaPost, b: PlazaPost) => number> = {
      latest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      popular: (a, b) => b.likedBy.length - a.likedBy.length || b.createdAt.localeCompare(a.createdAt),
      comments: (a, b) => b.comments.length - a.comments.length || b.createdAt.localeCompare(a.createdAt),
    };
    return filtered.sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || sorter[sortKey](a, b));
  }, [allPosts, boardFilter, search, sortKey]);

  const totalPages = Math.max(1, Math.ceil(visiblePosts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagePosts = visiblePosts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedPost = selectedPostId ? getPost(selectedPostId) : undefined;

  // ── 액션 ──────────────────────────────────────────────

  const openPost = (post: PlazaPost) => {
    incrementView(post.id);
    setSelectedPostId(post.id);
    setCommentInput('');
    setReplyTargetId(null);
    setEditingCommentId(null);
    refresh();
  };

  const openWrite = () => {
    setEditingPostId(null);
    setFormBoard(boardFilter === 'all' ? 'free' : boardFilter);
    setFormTitle('');
    setFormContent('');
    setFormAnonymous(false);
    setWriteOpen(true);
  };

  const openEdit = (post: PlazaPost) => {
    setEditingPostId(post.id);
    setFormBoard(post.board);
    setFormTitle(post.title);
    setFormContent(post.content);
    setFormAnonymous(post.isAnonymous);
    setWriteOpen(true);
  };

  const submitPost = () => {
    if (!formTitle.trim() || !formContent.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '제목과 내용을 입력해주세요.' });
      return;
    }
    if (editingPostId) {
      updatePost(editingPostId, { board: formBoard, title: formTitle.trim(), content: formContent.trim(), isAnonymous: formAnonymous });
      showAlert({ type: 'success', title: '수정 완료', message: '게시글이 수정되었습니다.' });
    } else {
      const post = createPost({ board: formBoard, title: formTitle.trim(), content: formContent.trim(), isAnonymous: formAnonymous });
      showAlert({ type: 'success', title: '등록 완료', message: '게시글이 등록되었습니다.' });
      setSelectedPostId(post.id);
    }
    setWriteOpen(false);
    refresh();
  };

  const handleDeletePost = async (post: PlazaPost) => {
    const ok = await confirm({ title: '게시글 삭제', message: '이 게시글과 댓글이 모두 삭제됩니다. 삭제할까요?', type: 'danger', confirmText: '삭제' });
    if (!ok) return;
    deletePost(post.id);
    setSelectedPostId(null);
    showAlert({ type: 'success', title: '삭제 완료', message: '게시글이 삭제되었습니다.' });
    refresh();
  };

  const handleToggleLike = (post: PlazaPost) => {
    toggleLike(post.id);
    refresh();
  };

  const submitReport = () => {
    if (!reportTargetId) return;
    const result = reportPost(reportTargetId, reportReason);
    setReportTargetId(null);
    if (result === 'already') {
      showAlert({ type: 'info', title: '신고 안내', message: '이미 신고한 게시글입니다.' });
    } else if (result === 'hidden') {
      showAlert({ type: 'warning', title: '신고 접수', message: '신고가 누적되어 게시글이 숨김 처리되었습니다.' });
      setSelectedPostId(null);
    } else {
      showAlert({ type: 'success', title: '신고 접수', message: '신고가 접수되었습니다. 운영팀이 확인 후 조치합니다.' });
    }
    refresh();
  };

  const submitComment = (parentId: string | null) => {
    if (!selectedPost) return;
    const content = (parentId ? replyInput : commentInput).trim();
    if (!content) {
      showAlert({ type: 'warning', title: '입력 필요', message: '댓글 내용을 입력해주세요.' });
      return;
    }
    // 답글 입력에는 익명 옵션 UI가 없으므로 실명 고정
    addComment(selectedPost.id, content, parentId, parentId ? false : commentAnonymous);
    if (parentId) {
      setReplyInput('');
      setReplyTargetId(null);
    } else {
      setCommentInput('');
    }
    refresh();
  };

  const submitCommentEdit = (commentId: string) => {
    if (!selectedPost) return;
    if (!editingCommentText.trim()) return;
    updateComment(selectedPost.id, commentId, editingCommentText.trim());
    setEditingCommentId(null);
    refresh();
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedPost) return;
    const ok = await confirm({ title: '댓글 삭제', message: '댓글을 삭제할까요? 답글도 함께 삭제됩니다.', type: 'danger', confirmText: '삭제' });
    if (!ok) return;
    deleteComment(selectedPost.id, commentId);
    refresh();
  };

  const handleAccept = async (commentId: string) => {
    if (!selectedPost) return;
    const ok = await confirm({ title: '답변 채택', message: '이 답변을 채택할까요? 글당 하나의 답변만 채택됩니다.', confirmText: '채택' });
    if (!ok) return;
    acceptComment(selectedPost.id, commentId);
    showAlert({ type: 'success', title: '채택 완료', message: '답변이 채택되었습니다.' });
    refresh();
  };

  // ── 렌더 ──────────────────────────────────────────────

  const renderMeta = (post: PlazaPost) => (
    <HStack gap={3} vAlign="center" wrap="wrap">
      <Text type="supporting" color="secondary">{displayAuthor(post.isAnonymous, post.companyName, post.authorName)}</Text>
      <Text type="supporting" color="secondary">{timeAgo(post.createdAt)}{post.updatedAt ? ' (수정됨)' : ''}</Text>
      <HStack gap={1} vAlign="center">
        <Icon icon={IconEye} size="xsm" color="secondary" />
        <Text type="supporting" color="secondary">{post.viewedBy.length}</Text>
      </HStack>
      <HStack gap={1} vAlign="center">
        <Icon icon={IconThumbUp} size="xsm" color="secondary" />
        <Text type="supporting" color="secondary">{post.likedBy.length}</Text>
      </HStack>
      <HStack gap={1} vAlign="center">
        <Icon icon={IconMessageCircle} size="xsm" color="secondary" />
        <Text type="supporting" color="secondary">{post.comments.length}</Text>
      </HStack>
    </HStack>
  );

  const renderCommentBody = (comment: PlazaComment, isReply: boolean) => {
    const isMine = comment.authorId === user.id;
    const isPostAuthor = selectedPost?.authorId === user.id;
    const canAccept = !!selectedPost && selectedPost.board === 'qna' && isPostAuthor && !isReply && !comment.isAccepted && comment.authorId !== user.id;

    return (
      <div
        key={comment.id}
        style={{
          padding: 'var(--spacing-3)',
          borderRadius: 'var(--radius-element)',
          background: comment.isAccepted ? 'var(--color-background-green)' : isReply ? 'var(--color-background-muted)' : 'transparent',
          border: comment.isAccepted ? '1px solid var(--color-border-green)' : '1px solid transparent',
          marginLeft: isReply ? 'var(--spacing-8)' : 0,
        }}
      >
        <VStack gap={1}>
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={1}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              {comment.isAccepted && <Badge variant="green" icon={<Icon icon={IconCheck} size="xsm" />} label="채택된 답변" />}
              <Text type="body" weight="semibold" color="primary">
                {displayAuthor(comment.isAnonymous, comment.companyName, comment.authorName)}
              </Text>
              <Text type="supporting" color="secondary">{timeAgo(comment.createdAt)}{comment.updatedAt ? ' (수정됨)' : ''}</Text>
            </HStack>
            <HStack gap={1} vAlign="center">
              {canAccept && (
                <Button variant="ghost" size="sm" label="채택" icon={<Icon icon={IconCheck} size="xsm" color="success" />} onClick={() => handleAccept(comment.id)} />
              )}
              {!isReply && (
                <Button variant="ghost" size="sm" label="답글" onClick={() => { setReplyTargetId(replyTargetId === comment.id ? null : comment.id); setReplyInput(''); }} />
              )}
              {isMine && editingCommentId !== comment.id && (
                <>
                  <IconButton label="댓글 수정" variant="ghost" size="sm" icon={<Icon icon={IconPencil} size="xsm" color="secondary" />} onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content); }} />
                  <IconButton label="댓글 삭제" variant="ghost" size="sm" icon={<Icon icon={IconTrash} size="xsm" color="secondary" />} onClick={() => handleDeleteComment(comment.id)} />
                </>
              )}
            </HStack>
          </HStack>

          {editingCommentId === comment.id ? (
            <VStack gap={2}>
              <TextArea label="댓글 수정" isLabelHidden value={editingCommentText} onChange={(v) => setEditingCommentText(v)} rows={2} />
              <HStack gap={2} hAlign="end">
                <Button variant="ghost" size="sm" label="취소" onClick={() => setEditingCommentId(null)} />
                <Button variant="primary" size="sm" label="저장" onClick={() => submitCommentEdit(comment.id)} />
              </HStack>
            </VStack>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap' }}>
              <Text type="body" color="primary">{comment.content}</Text>
            </div>
          )}

          {/* 답글 입력 */}
          {replyTargetId === comment.id && (
            <HStack gap={2} vAlign="center">
              <div style={{ flex: 1 }}>
                <TextInput label="답글" isLabelHidden placeholder="답글을 입력하세요" value={replyInput} onChange={(v) => setReplyInput(v)} />
              </div>
              <Button variant="primary" size="sm" label="등록" onClick={() => submitComment(comment.id)} />
            </HStack>
          )}
        </VStack>
      </div>
    );
  };

  const renderDetail = (post: PlazaPost) => {
    const meta = getBoardMeta(post.board);
    const isMine = post.authorId === user.id;
    const liked = post.likedBy.includes(user.id);
    const topLevel = post.comments
      .filter((c) => !c.parentId)
      .sort((a, b) => Number(b.isAccepted) - Number(a.isAccepted) || a.createdAt.localeCompare(b.createdAt));

    return (
      <motion.div key={`detail-${post.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.fast }}>
        <VStack gap={3}>
          <div>
            <Button variant="ghost" size="sm" label="목록으로" icon={<Icon icon={IconArrowLeft} size="sm" />} onClick={() => { setSelectedPostId(null); refresh(); }} />
          </div>

          <Card padding={6}>
            <VStack gap={4}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  {post.isPinned && <Badge variant="neutral" icon={<Icon icon={IconPinned} size="xsm" />} label="고정" />}
                  <Badge variant={meta.badgeVariant} label={meta.label} />
                  <Heading level={3}>{post.title}</Heading>
                </HStack>
                {renderMeta(post)}
              </VStack>

              <Divider />

              <div style={{ whiteSpace: 'pre-wrap', minHeight: 80 }}>
                <Text type="body" color="primary">{post.content}</Text>
              </div>

              <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                <Button
                  variant={liked ? 'primary' : 'secondary'}
                  size="sm"
                  label={`좋아요 ${post.likedBy.length}`}
                  icon={<Icon icon={liked ? IconThumbUpFilled : IconThumbUp} size="sm" />}
                  onClick={() => handleToggleLike(post)}
                />
                <HStack gap={1} vAlign="center">
                  {isMine ? (
                    <>
                      <Button variant="ghost" size="sm" label="수정" icon={<Icon icon={IconPencil} size="xsm" />} onClick={() => openEdit(post)} />
                      <Button variant="ghost" size="sm" label="삭제" icon={<Icon icon={IconTrash} size="xsm" />} onClick={() => handleDeletePost(post)} />
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      label={post.reportedBy.includes(user.id) ? '신고됨' : '신고'}
                      icon={<Icon icon={IconFlag} size="xsm" />}
                      isDisabled={post.reportedBy.includes(user.id)}
                      onClick={() => { setReportReason(REPORT_REASONS[0]); setReportTargetId(post.id); }}
                    />
                  )}
                </HStack>
              </HStack>
            </VStack>
          </Card>

          {/* 댓글 */}
          <Card padding={6}>
            <VStack gap={3}>
              <Text type="body" weight="bold" color="primary">댓글 {post.comments.length}</Text>

              {topLevel.length === 0 ? (
                <Text type="supporting" color="secondary">
                  {post.board === 'qna' ? '아직 답변이 없습니다. 첫 답변을 남겨보세요.' : '아직 댓글이 없습니다. 첫 댓글을 남겨보세요.'}
                </Text>
              ) : (
                <VStack gap={1}>
                  {topLevel.map((comment) => (
                    <VStack key={comment.id} gap={1}>
                      {renderCommentBody(comment, false)}
                      {post.comments
                        .filter((c) => c.parentId === comment.id)
                        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                        .map((reply) => renderCommentBody(reply, true))}
                    </VStack>
                  ))}
                </VStack>
              )}

              <Divider />

              <VStack gap={2}>
                <TextArea
                  label={post.board === 'qna' ? '답변 작성' : '댓글 작성'}
                  placeholder={post.board === 'qna' ? '답변을 입력하세요' : '댓글을 입력하세요'}
                  value={commentInput}
                  onChange={(v) => setCommentInput(v)}
                  rows={3}
                />
                <HStack hAlign="between" vAlign="center">
                  <CheckboxInput label="익명으로 작성" value={commentAnonymous} onChange={(checked) => setCommentAnonymous(checked)} />
                  <Button variant="primary" size="sm" label="등록" onClick={() => submitComment(null)} />
                </HStack>
              </VStack>
            </VStack>
          </Card>
        </VStack>
      </motion.div>
    );
  };

  const renderList = () => (
    <motion.div key="list" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.fast }}>
      <VStack gap={3}>
        {/* 오늘의 요양 소식 — 게시판 상단 뉴스 스트립 */}
        {newsItems.length > 0 && (
          <Card padding={0}>
            <div style={{ padding: '12px 16px 4px' }}>
              <HStack hAlign="between" vAlign="center">
                <HStack gap={2} vAlign="center">
                  <Icon icon={IconNews} size="sm" color="secondary" />
                  <Text type="body" weight="bold" color="primary">오늘의 요양 소식</Text>
                </HStack>
                {onGoToNews && (
                  <Button
                    variant="ghost"
                    size="sm"
                    label="더보기"
                    endContent={<Icon icon="chevronRight" size="xsm" />}
                    onClick={onGoToNews}
                  />
                )}
              </HStack>
            </div>
            <div style={{ padding: '0 8px 8px' }}>
              <VStack gap={0}>
                {newsItems.slice(0, 3).map((news) => {
                  const newsMeta = getNewsCategoryMeta(news.category);
                  return (
                    <div
                      key={news.id}
                      className="carev-dash-row"
                      style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-element)' }}
                      onClick={() => window.open(news.url, '_blank', 'noopener,noreferrer')}
                    >
                      <div style={{ flexShrink: 0 }}>
                        <Badge variant={newsMeta.badgeVariant} label={newsMeta.label} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text type="body" weight="medium" color="primary" maxLines={1}>{news.title}</Text>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <Text type="supporting" color="secondary">
                          {news.source} · {formatDistanceToNow(news.publishedAt, { addSuffix: true, locale: ko })}
                        </Text>
                      </div>
                    </div>
                  );
                })}
              </VStack>
            </div>
          </Card>
        )}

        {/* 툴바 */}
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <SegmentedControl value={boardFilter} onChange={(v) => { setBoardFilter(v as BoardFilter); setPage(1); }} label="게시판 선택" size="sm">
            <SegmentedControlItem value="all" label="전체" />
            {BOARD_META.map((b) => (
              <SegmentedControlItem key={b.value} value={b.value} label={b.label} />
            ))}
          </SegmentedControl>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <div style={{ width: 130 }}>
              <Selector
                label="정렬"
                isLabelHidden
                value={sortKey}
                onChange={(v) => setSortKey((v as SortKey) || 'latest')}
                options={[
                  { value: 'latest', label: '최신순' },
                  { value: 'popular', label: '좋아요순' },
                  { value: 'comments', label: '댓글순' },
                ]}
              />
            </div>
            <div style={{ width: 220 }}>
              <TextInput label="검색" isLabelHidden placeholder="제목·내용 검색" startIcon={FiSearch} hasClear value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
            </div>
            <Button variant="primary" size="md" label="글쓰기" icon={<Icon icon={IconPlus} size="sm" />} onClick={openWrite} />
          </HStack>
        </HStack>

        {/* 목록 */}
        <Card padding={0}>
          {pagePosts.length === 0 ? (
            <div style={{ padding: 'var(--spacing-8)' }}>
              <EmptyState
                isCompact
                title={search ? '검색 결과가 없습니다' : '아직 게시글이 없습니다'}
                description={search ? '다른 검색어로 시도해보세요.' : '첫 게시글을 작성해보세요.'}
                icon={<Icon icon={IconMessages} size="lg" color="secondary" />}
              />
            </div>
          ) : (
            <VStack gap={0}>
              {pagePosts.map((post, idx) => {
                const meta = getBoardMeta(post.board);
                const hasAccepted = post.board === 'qna' && post.comments.some((c) => c.isAccepted);
                return (
                  <div
                    key={post.id}
                    className="carev-dash-row"
                    style={{ padding: 'var(--spacing-3) var(--spacing-4)', borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)' }}
                    onClick={() => openPost(post)}
                  >
                    <VStack gap={1}>
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        {post.isPinned && <Icon icon={IconPinned} size="xsm" color="secondary" />}
                        <Badge variant={meta.badgeVariant} label={meta.label} />
                        {hasAccepted && <Badge variant="green" icon={<Icon icon={IconCheck} size="xsm" />} label="채택 완료" />}
                        <div style={{ minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
                          <Text type="body" weight="semibold" color="primary" maxLines={1}>{post.title}</Text>
                        </div>
                        {post.comments.length > 0 && (
                          <span style={{ color: 'var(--color-text-accent)' }}>
                            <Text type="supporting" weight="bold" color="inherit">[{post.comments.length}]</Text>
                          </span>
                        )}
                      </HStack>
                      <Text as="p" type="supporting" color="secondary" maxLines={1}>{post.content}</Text>
                      {renderMeta(post)}
                    </VStack>
                  </div>
                );
              })}
            </VStack>
          )}
        </Card>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <HStack gap={2} hAlign="center" vAlign="center">
            <Button variant="secondary" size="sm" label="이전" isDisabled={safePage <= 1} onClick={() => setPage(safePage - 1)} />
            <Text type="supporting" color="secondary" hasTabularNumbers>{safePage} / {totalPages}</Text>
            <Button variant="secondary" size="sm" label="다음" isDisabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} />
          </HStack>
        )}
      </VStack>
    </motion.div>
  );

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />

      <AnimatePresence mode="wait">
        {selectedPost && !selectedPost.isHidden ? renderDetail(selectedPost) : renderList()}
      </AnimatePresence>

      {/* 글 작성/수정 다이얼로그 */}
      <Dialog isOpen={writeOpen} onOpenChange={(o) => { if (!o) setWriteOpen(false); }} purpose="form" width={560}>
        <Layout
          header={<DialogHeader title={editingPostId ? '게시글 수정' : '글쓰기'} onOpenChange={(o) => { if (!o) setWriteOpen(false); }} />}
          content={
            <LayoutContent>
              <VStack gap={4}>
                <Selector
                  label="게시판"
                  value={formBoard}
                  onChange={(v) => setFormBoard((v as BoardType) || 'free')}
                  options={BOARD_META.map((b) => ({ value: b.value, label: b.label }))}
                />
                <TextInput label="제목" placeholder="제목을 입력하세요" value={formTitle} onChange={(v) => setFormTitle(v)} />
                <TextArea label="내용" placeholder="내용을 입력하세요" value={formContent} onChange={(v) => setFormContent(v)} rows={8} />
                <CheckboxInput label="익명으로 작성 (기관명·이름 숨김)" value={formAnonymous} onChange={(checked) => setFormAnonymous(checked)} />
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button variant="ghost" label="취소" onClick={() => setWriteOpen(false)} />
                <Button variant="primary" label={editingPostId ? '수정' : '등록'} onClick={submitPost} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 신고 다이얼로그 */}
      <Dialog isOpen={!!reportTargetId} onOpenChange={(o) => { if (!o) setReportTargetId(null); }} purpose="form" width={420}>
        <Layout
          header={<DialogHeader title="게시글 신고" onOpenChange={(o) => { if (!o) setReportTargetId(null); }} />}
          content={
            <LayoutContent>
              <VStack gap={4}>
                <Text type="body" color="secondary">신고 사유를 선택해주세요. 신고가 누적되면 게시글이 자동으로 숨김 처리됩니다.</Text>
                <Selector
                  label="신고 사유"
                  value={reportReason}
                  onChange={(v) => setReportReason(v || REPORT_REASONS[0])}
                  options={REPORT_REASONS.map((r) => ({ value: r, label: r }))}
                />
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button variant="ghost" label="취소" onClick={() => setReportTargetId(null)} />
                <Button variant="destructive" label="신고하기" onClick={submitReport} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
