'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Spinner } from '@astryxdesign/core/Spinner';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import {
  IconArrowLeft,
  IconCheck,
  IconEye,
  IconFlag,
  IconMessages,
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
import { BOARD_META, REPORT_REASONS, getBoardMeta, isLoggedIn, type BoardType } from './plazaStore';
import {
  type ApiComment,
  type ApiPostDetail,
  type ApiPostSummary,
  acceptComment,
  addComment,
  createPost,
  deleteComment,
  deletePost,
  fetchPost,
  fetchPosts,
  reportPost,
  toggleLike,
  updateComment,
  updatePost,
} from './plazaApi';
import { duration } from '@/theme/motion';

type BoardFilter = 'all' | BoardType;
type SortKey = 'latest' | 'popular' | 'comments';

const PAGE_SIZE = 10;

const timeAgo = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ko });

interface PlazaBoardProps {
  /** 표시할 보드 ('all' = 전체글). 카페형 셸(PlazaManagement)의 좌측 네비가 제어한다 */
  board?: BoardFilter;
  /** 외부(광장 홈 위젯)에서 특정 글 상세를 열 때 전달 */
  openPostId?: number | null;
  onOpenPostConsumed?: () => void;
  /** 값이 바뀔 때마다 글쓰기 다이얼로그를 연다 */
  writeSignal?: number;
}

export default function PlazaBoard({ board = 'all', openPostId, onOpenPostConsumed, writeSignal }: PlazaBoardProps) {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();

  const [posts, setPosts] = useState<ApiPostSummary[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const boardFilter = board;
  const [sortKey, setSortKey] = useState<SortKey>('latest');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  const [detail, setDetail] = useState<ApiPostDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // 글 작성/수정 다이얼로그
  const [writeOpen, setWriteOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [formBoard, setFormBoard] = useState<BoardType>('free');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formAnonymous, setFormAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 신고 다이얼로그
  const [reportTargetId, setReportTargetId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);

  // 댓글 입력 상태
  const [commentInput, setCommentInput] = useState('');
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  // 검색 디바운스
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 보드 전환 시 목록 상태 초기화
  useEffect(() => {
    setPage(0);
    setDetail(null);
  }, [board]);

  // 광장 홈 등 외부에서 특정 글 열기
  useEffect(() => {
    if (!openPostId) return;
    (async () => {
      setIsDetailLoading(true);
      await reloadDetail(openPostId);
      setIsDetailLoading(false);
      onOpenPostConsumed?.();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPostId]);

  // 좌측 네비 글쓰기 버튼 신호
  const writeSignalRef = useRef(writeSignal ?? 0);
  useEffect(() => {
    if (writeSignal !== undefined && writeSignal !== writeSignalRef.current) {
      writeSignalRef.current = writeSignal;
      openWrite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writeSignal]);

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPosts({ board: boardFilter, sort: sortKey, search: debouncedSearch || undefined, page, size: PAGE_SIZE });
      setPosts(data.content ?? []);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
    } catch (error) {
      console.error('[Plaza] 게시글 목록 조회 실패:', error);
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [boardFilter, sortKey, debouncedSearch, page]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const reloadDetail = async (postId: number) => {
    try {
      setDetail(await fetchPost(postId));
    } catch (error) {
      console.error('[Plaza] 게시글 조회 실패:', error);
      showAlert({ type: 'error', title: '조회 실패', message: error instanceof Error ? error.message : '게시글을 불러오지 못했습니다.' });
      setDetail(null);
    }
  };

  // ── 액션 ──────────────────────────────────────────────

  /** 쓰기 동작 공통 가드 — 비로그인이면 로그인 안내 후 차단 */
  const requireLogin = (): boolean => {
    if (isLoggedIn()) return true;
    showAlert({ type: 'info', title: '로그인 필요', message: '글쓰기·댓글·좋아요는 케어브이 로그인 후 이용할 수 있어요.' });
    return false;
  };

  const openPost = async (post: ApiPostSummary) => {
    setIsDetailLoading(true);
    setCommentInput('');
    setReplyTargetId(null);
    setEditingCommentId(null);
    await reloadDetail(post.id);
    setIsDetailLoading(false);
  };

  const closeDetail = () => {
    setDetail(null);
    loadPosts();
  };

  const openWrite = () => {
    if (!requireLogin()) return;
    setEditingPostId(null);
    setFormBoard(boardFilter === 'all' ? 'free' : boardFilter);
    setFormTitle('');
    setFormContent('');
    setFormAnonymous(false);
    setWriteOpen(true);
  };

  const openEdit = (post: ApiPostDetail) => {
    setEditingPostId(post.id);
    setFormBoard(post.board);
    setFormTitle(post.title);
    setFormContent(post.content);
    setFormAnonymous(post.isAnonymous);
    setWriteOpen(true);
  };

  const submitPost = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '제목과 내용을 입력해주세요.' });
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingPostId) {
        await updatePost(editingPostId, { board: formBoard, title: formTitle.trim(), content: formContent.trim(), isAnonymous: formAnonymous });
        showAlert({ type: 'success', title: '수정 완료', message: '게시글이 수정되었습니다.' });
        await reloadDetail(editingPostId);
      } else {
        const created = await createPost({ board: formBoard, title: formTitle.trim(), content: formContent.trim(), isAnonymous: formAnonymous });
        showAlert({ type: 'success', title: '등록 완료', message: '게시글이 등록되었습니다.' });
        await reloadDetail(created.id);
      }
      setWriteOpen(false);
      loadPosts();
    } catch (error) {
      showAlert({ type: 'error', title: '저장 실패', message: error instanceof Error ? error.message : '게시글 저장에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (post: ApiPostDetail) => {
    const ok = await confirm({ title: '게시글 삭제', message: '이 게시글과 댓글이 모두 삭제됩니다. 삭제할까요?', type: 'danger', confirmText: '삭제' });
    if (!ok) return;
    try {
      await deletePost(post.id);
      showAlert({ type: 'success', title: '삭제 완료', message: '게시글이 삭제되었습니다.' });
      closeDetail();
    } catch (error) {
      showAlert({ type: 'error', title: '삭제 실패', message: error instanceof Error ? error.message : '게시글 삭제에 실패했습니다.' });
    }
  };

  const handleToggleLike = async (post: ApiPostDetail) => {
    if (!requireLogin()) return;
    try {
      await toggleLike(post.id);
      await reloadDetail(post.id);
    } catch (error) {
      showAlert({ type: 'error', title: '실패', message: error instanceof Error ? error.message : '좋아요 처리에 실패했습니다.' });
    }
  };

  const submitReport = async () => {
    if (!reportTargetId) return;
    try {
      const result = await reportPost(reportTargetId, reportReason);
      setReportTargetId(null);
      if (result === 'already') {
        showAlert({ type: 'info', title: '신고 안내', message: '이미 신고한 게시글입니다.' });
      } else if (result === 'hidden') {
        showAlert({ type: 'warning', title: '신고 접수', message: '신고가 누적되어 게시글이 숨김 처리되었습니다.' });
        closeDetail();
        return;
      } else {
        showAlert({ type: 'success', title: '신고 접수', message: '신고가 접수되었습니다. 운영팀이 확인 후 조치합니다.' });
      }
      if (detail) await reloadDetail(detail.id);
    } catch (error) {
      setReportTargetId(null);
      showAlert({ type: 'error', title: '신고 실패', message: error instanceof Error ? error.message : '신고 처리에 실패했습니다.' });
    }
  };

  const submitComment = async (parentId: number | null) => {
    if (!detail) return;
    if (!requireLogin()) return;
    const content = (parentId ? replyInput : commentInput).trim();
    if (!content) {
      showAlert({ type: 'warning', title: '입력 필요', message: '댓글 내용을 입력해주세요.' });
      return;
    }
    try {
      // 답글 입력에는 익명 옵션 UI가 없으므로 실명 고정
      await addComment(detail.id, { parentId, content, isAnonymous: parentId ? false : commentAnonymous });
      if (parentId) {
        setReplyInput('');
        setReplyTargetId(null);
      } else {
        setCommentInput('');
      }
      await reloadDetail(detail.id);
    } catch (error) {
      showAlert({ type: 'error', title: '등록 실패', message: error instanceof Error ? error.message : '댓글 등록에 실패했습니다.' });
    }
  };

  const submitCommentEdit = async (commentId: number) => {
    if (!detail || !editingCommentText.trim()) return;
    try {
      await updateComment(commentId, editingCommentText.trim());
      setEditingCommentId(null);
      await reloadDetail(detail.id);
    } catch (error) {
      showAlert({ type: 'error', title: '수정 실패', message: error instanceof Error ? error.message : '댓글 수정에 실패했습니다.' });
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!detail) return;
    const ok = await confirm({ title: '댓글 삭제', message: '댓글을 삭제할까요? 답글도 함께 삭제됩니다.', type: 'danger', confirmText: '삭제' });
    if (!ok) return;
    try {
      await deleteComment(commentId);
      await reloadDetail(detail.id);
    } catch (error) {
      showAlert({ type: 'error', title: '삭제 실패', message: error instanceof Error ? error.message : '댓글 삭제에 실패했습니다.' });
    }
  };

  const handleAccept = async (commentId: number) => {
    if (!detail) return;
    const ok = await confirm({ title: '답변 채택', message: '이 답변을 채택할까요? 글당 하나의 답변만 채택됩니다.', confirmText: '채택' });
    if (!ok) return;
    try {
      await acceptComment(commentId);
      showAlert({ type: 'success', title: '채택 완료', message: '답변이 채택되었습니다.' });
      await reloadDetail(detail.id);
    } catch (error) {
      showAlert({ type: 'error', title: '채택 실패', message: error instanceof Error ? error.message : '답변 채택에 실패했습니다.' });
    }
  };

  // ── 렌더 ──────────────────────────────────────────────

  const renderCommentBody = (comment: ApiComment, isReply: boolean) => {
    const canAccept = !!detail && detail.board === 'qna' && detail.isMine && !isReply && !comment.isAccepted && !comment.isMine;

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
              <Text type="body" weight="semibold" color="primary">{comment.displayAuthor}</Text>
              <Text type="supporting" color="secondary">{timeAgo(comment.createdAt)}</Text>
            </HStack>
            <HStack gap={1} vAlign="center">
              {canAccept && (
                <Button variant="ghost" size="sm" label="채택" icon={<Icon icon={IconCheck} size="xsm" color="success" />} onClick={() => handleAccept(comment.id)} />
              )}
              {!isReply && (
                <Button variant="ghost" size="sm" label="답글" onClick={() => { setReplyTargetId(replyTargetId === comment.id ? null : comment.id); setReplyInput(''); }} />
              )}
              {comment.isMine && editingCommentId !== comment.id && (
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

  const renderDetail = (post: ApiPostDetail) => {
    const meta = getBoardMeta(post.board);
    const topLevel = post.comments
      .filter((c) => !c.parentId)
      .sort((a, b) => Number(b.isAccepted) - Number(a.isAccepted) || a.createdAt.localeCompare(b.createdAt));

    return (
      <motion.div key={`detail-${post.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: duration.fast }} style={{ height: '100%' }}>
        {/* 글이 짧아도 좌측 패널과 바닥이 맞도록 댓글 카드가 남은 높이를 채운다 (긴 글은 메인 영역이 스크롤) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', height: '100%' }}>
          <div>
            <Button variant="ghost" size="sm" label="목록으로" icon={<Icon icon={IconArrowLeft} size="sm" />} onClick={closeDetail} />
          </div>

          <Card padding={6}>
            <VStack gap={4}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  {post.isPinned && <Badge variant="neutral" icon={<Icon icon={IconPinned} size="xsm" />} label="고정" />}
                  <Badge variant={meta.badgeVariant} label={meta.label} />
                  <Heading level={3}>{post.title}</Heading>
                </HStack>
                <HStack gap={3} vAlign="center" wrap="wrap">
                  <Text type="supporting" color="secondary">{post.displayAuthor}</Text>
                  <Text type="supporting" color="secondary">{timeAgo(post.createdAt)}</Text>
                  <HStack gap={1} vAlign="center">
                    <Icon icon={IconEye} size="xsm" color="secondary" />
                    <Text type="supporting" color="secondary">{post.viewCount}</Text>
                  </HStack>
                </HStack>
              </VStack>

              <Divider />

              <div style={{ whiteSpace: 'pre-wrap', minHeight: 80 }}>
                <Text type="body" color="primary">{post.content}</Text>
              </div>

              <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                <Button
                  variant={post.likedByMe ? 'primary' : 'secondary'}
                  size="sm"
                  label={`좋아요 ${post.likeCount}`}
                  icon={<Icon icon={post.likedByMe ? IconThumbUpFilled : IconThumbUp} size="sm" />}
                  onClick={() => handleToggleLike(post)}
                />
                <HStack gap={1} vAlign="center">
                  {post.isMine ? (
                    <>
                      <Button variant="ghost" size="sm" label="수정" icon={<Icon icon={IconPencil} size="xsm" />} onClick={() => openEdit(post)} />
                      <Button variant="ghost" size="sm" label="삭제" icon={<Icon icon={IconTrash} size="xsm" />} onClick={() => handleDeletePost(post)} />
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      label={post.reportedByMe ? '신고됨' : '신고'}
                      icon={<Icon icon={IconFlag} size="xsm" />}
                      isDisabled={post.reportedByMe}
                      onClick={() => { if (!requireLogin()) return; setReportReason(REPORT_REASONS[0]); setReportTargetId(post.id); }}
                    />
                  )}
                </HStack>
              </HStack>
            </VStack>
          </Card>

          {/* 댓글 — 남은 높이를 채워 좌측 패널과 정렬 (내용이 더 크면 내용 크기 유지) */}
          <div style={{ flex: '1 0 auto' }}>
          <Card padding={6} height="100%">
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
          </div>
        </div>
      </motion.div>
    );
  };

  const renderList = () => (
    <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: duration.fast }} style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', height: '100%' }}>
        {/* 툴바 */}
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <Text type="body" weight="bold" color="primary">
            {boardFilter === 'all' ? '전체글' : getBoardMeta(boardFilter).label}
          </Text>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <div style={{ width: 130 }}>
              <Selector
                label="정렬"
                isLabelHidden
                value={sortKey}
                onChange={(v) => { setSortKey((v as SortKey) || 'latest'); setPage(0); }}
                options={[
                  { value: 'latest', label: '최신순' },
                  { value: 'popular', label: '좋아요순' },
                  { value: 'comments', label: '댓글순' },
                ]}
              />
            </div>
            <div style={{ width: 220 }}>
              <TextInput label="검색" isLabelHidden placeholder="제목·내용 검색" startIcon={FiSearch} hasClear value={search} onChange={(v) => setSearch(v)} />
            </div>
            <Button variant="primary" size="md" label="글쓰기" icon={<Icon icon={IconPlus} size="sm" />} onClick={openWrite} />
          </HStack>
        </HStack>

        {/* 목록 — 남은 높이를 채우고 내부 스크롤 */}
        <div style={{ flex: 1, minHeight: 0 }}>
        <Card padding={0} height="100%">
          <div style={{ height: '100%', overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: 'var(--spacing-8)', display: 'flex', justifyContent: 'center' }}>
              <Spinner size="md" label="불러오는 중..." />
            </div>
          ) : posts.length === 0 ? (
            <div style={{ padding: 'var(--spacing-8)' }}>
              <EmptyState
                isCompact
                title={debouncedSearch ? '검색 결과가 없습니다' : '아직 게시글이 없습니다'}
                description={debouncedSearch ? '다른 검색어로 시도해보세요.' : '첫 게시글을 작성해보세요.'}
                icon={<Icon icon={IconMessages} size="lg" color="secondary" />}
              />
            </div>
          ) : (
            <VStack gap={0}>
              {posts.map((post, idx) => {
                const meta = getBoardMeta(post.board);
                return (
                  <div
                    key={post.id}
                    className="carev-dash-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-2)',
                      padding: '9px var(--spacing-3)',
                      borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
                    }}
                    onClick={() => openPost(post)}
                  >
                    {/* 좌측: 말머리 + 제목 + 댓글수 */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                      {post.isPinned && <Icon icon={IconPinned} size="xsm" color="secondary" />}
                      {boardFilter === 'all' && (
                        <div style={{ flexShrink: 0 }}>
                          <Badge variant={meta.badgeVariant} label={meta.label} />
                        </div>
                      )}
                      {post.hasAccepted && <Icon icon={IconCheck} size="xsm" color="success" />}
                      <div style={{ minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
                        <Text type="body" weight={post.isPinned ? 'semibold' : 'medium'} color="primary" maxLines={1}>{post.title}</Text>
                      </div>
                      {post.commentCount > 0 && (
                        <span style={{ flexShrink: 0, color: 'var(--color-text-accent)' }}>
                          <Text type="supporting" weight="bold" color="inherit">[{post.commentCount}]</Text>
                        </span>
                      )}
                    </div>

                    {/* 우측: 작성자 · 시간 · 조회 · 추천 */}
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                      <span className="carev-plaza-rowmeta-wide">
                        <Text type="supporting" color="secondary">{post.displayAuthor}</Text>
                      </span>
                      <Text type="supporting" color="secondary">{timeAgo(post.createdAt)}</Text>
                      <span className="carev-plaza-rowmeta-wide" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-0-5)' }}>
                        <Icon icon={IconEye} size="xsm" color="secondary" />
                        <Text type="supporting" color="secondary" hasTabularNumbers>{post.viewCount}</Text>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-0-5)' }}>
                        <Icon icon={IconThumbUp} size="xsm" color="secondary" />
                        <Text type="supporting" color="secondary" hasTabularNumbers>{post.likeCount}</Text>
                      </span>
                    </div>
                  </div>
                );
              })}
            </VStack>
          )}
          </div>
        </Card>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <HStack gap={2} hAlign="center" vAlign="center">
            <Button variant="secondary" size="sm" label="이전" isDisabled={page <= 0} onClick={() => setPage(page - 1)} />
            <Text type="supporting" color="secondary" hasTabularNumbers>{page + 1} / {totalPages}</Text>
            <Button variant="secondary" size="sm" label="다음" isDisabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} />
          </HStack>
        )}
      </div>
    </motion.div>
  );

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />

      <AnimatePresence mode="wait">
        {detail ? renderDetail(detail) : isDetailLoading ? (
          <motion.div key="detail-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ padding: 'var(--spacing-8)', display: 'flex', justifyContent: 'center' }}>
              <Spinner size="md" label="불러오는 중..." />
            </div>
          </motion.div>
        ) : renderList()}
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
                <Button variant="primary" label={editingPostId ? '수정' : '등록'} isLoading={isSubmitting} onClick={submitPost} />
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
