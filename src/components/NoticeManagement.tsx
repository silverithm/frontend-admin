'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiChevronLeft, FiEye, FiMessageSquare, FiUsers, FiBell, FiStar, FiSearch, FiRefreshCw, FiPlus, FiTrash2, FiAlertTriangle } from 'react-icons/fi';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Badge } from '@astryxdesign/core/Badge';
import { Icon } from '@astryxdesign/core/Icon';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Spinner } from '@astryxdesign/core/Spinner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Divider } from '@astryxdesign/core/Divider';
import { VStack, HStack, StackItem } from '@astryxdesign/core/Stack';
import { Center } from '@astryxdesign/core/Center';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import {
  getNotices,
  getNoticeDetail,
  updateNotice,
  deleteNotice,
  getNoticeComments,
  createNoticeComment,
  deleteNoticeComment,
  getNoticeReaders,
} from '@/lib/apiService';
import { Notice, NoticeComment, NoticeReader, NoticePriority, NoticeStatus } from '@/types/notice';
import { useAlert } from './Alert';
import { useConfirm } from './ConfirmDialog';

type ViewMode = 'list' | 'detail';
type TabType = 'all' | 'published';

interface NoticeData {
  id: string;
  title: string;
  content: string;
  priority: NoticePriority;
  status: NoticeStatus;
  isPinned: boolean;
  authorId: string;
  authorName: string;
  companyId: string;
  viewCount: number;
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

interface NoticeStats {
  total: number;
  published: number;
}

interface NoticeManagementProps {
  isAdmin?: boolean;
}

export default function NoticeManagement({ isAdmin = true }: NoticeManagementProps) {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();

  // 뷰 모드
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);

  // 목록 상태
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [notices, setNotices] = useState<NoticeData[]>([]);
  const [stats, setStats] = useState<NoticeStats>({ total: 0, published: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 상세 상태
  const [notice, setNotice] = useState<Notice | null>(null);
  const [comments, setComments] = useState<NoticeComment[]>([]);
  const [readers, setReaders] = useState<NoticeReader[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 수정 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<NoticePriority>('NORMAL');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 댓글 상태
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // 삭제 확인 모달
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatDate = (dateStr: string | null | undefined, formatStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      return format(date, formatStr, { locale: ko });
    } catch {
      return '-';
    }
  };

  // 목록 로드
  const loadNotices = async () => {
    setIsLoading(true);
    try {
      const filter: { status?: string; searchQuery?: string } = {};
      if (activeTab === 'published') filter.status = 'PUBLISHED';
      if (searchQuery) filter.searchQuery = searchQuery;

      const response = await getNotices(filter);
      if (response.notices) {
        const filteredNotices = response.notices.filter(
          (n: NoticeData) => n.status === 'PUBLISHED' || activeTab === 'all'
        );
        setNotices(filteredNotices);
      }
      if (response.stats) {
        setStats({ total: response.stats.total || 0, published: response.stats.published || 0 });
      }
    } catch (error) {
      console.error('공지사항 목록 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 상세 로드
  const loadNoticeDetail = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await getNoticeDetail(id);
      const data = response.notice || response; // API가 { notice: {...} } 형태로 반환
      setNotice(data);
      setTitle(data.title || '');
      setContent(data.content || '');
      setPriority(data.priority || 'NORMAL');
      setIsPinned(data.isPinned || false);

      // 댓글과 읽은 사람 로드
      loadComments(id);
      loadReaders(id);
    } catch (error) {
      console.error('공지사항 로드 실패:', error);
      showAlert({ type: 'error', title: '오류', message: '공지사항을 불러오는데 실패했습니다.' });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const loadComments = async (id: string) => {
    try {
      const data = await getNoticeComments(id);
      setComments(data.comments || []);
    } catch (error) {
      console.error('댓글 로드 실패:', error);
    }
  };

  const loadReaders = async (id: string) => {
    try {
      const data = await getNoticeReaders(id);
      setReaders(data.readers || []);
    } catch (error) {
      console.error('읽은 사람 목록 로드 실패:', error);
    }
  };

  useEffect(() => {
    loadNotices();
  }, [activeTab, searchQuery]);

  // 공지사항 선택
  const handleSelectNotice = (id: string) => {
    setSelectedNoticeId(id);
    setViewMode('detail');
    setIsEditing(false);
    loadNoticeDetail(id);
  };

  // 목록으로 돌아가기
  const handleBackToList = () => {
    setViewMode('list');
    setSelectedNoticeId(null);
    setNotice(null);
    setIsEditing(false);
    loadNotices();
  };

  // 삭제
  const handleDelete = async () => {
    if (!selectedNoticeId) return;
    setIsSubmitting(true);
    try {
      await deleteNotice(selectedNoticeId);
      showAlert({ type: 'success', title: '삭제 완료', message: '공지사항이 삭제되었습니다.' });
      setShowDeleteConfirm(false);
      handleBackToList();
    } catch (error) {
      console.error('삭제 실패:', error);
      showAlert({ type: 'error', title: '삭제 실패', message: '공지사항 삭제에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 수정 저장
  const handleUpdate = async () => {
    if (!selectedNoticeId || !title.trim() || !content.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '제목과 내용을 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateNotice(selectedNoticeId, {
        title: title.trim(),
        content: content.trim(),
        priority,
        isPinned,
      });

      showAlert({ type: 'success', title: '수정 완료', message: '공지사항이 수정되었습니다.' });
      setIsEditing(false);
      loadNoticeDetail(selectedNoticeId);
    } catch (error) {
      console.error('수정 실패:', error);
      showAlert({ type: 'error', title: '수정 실패', message: '공지사항 수정에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 댓글 작성
  const handleSubmitComment = async () => {
    if (!selectedNoticeId || !newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      await createNoticeComment(selectedNoticeId, newComment.trim());
      setNewComment('');
      loadComments(selectedNoticeId);
      showAlert({ type: 'success', title: '완료', message: '댓글이 등록되었습니다.' });
    } catch (error) {
      console.error('댓글 등록 실패:', error);
      showAlert({ type: 'error', title: '실패', message: '댓글 등록에 실패했습니다.' });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId: string) => {
    if (!selectedNoticeId) return;
    const confirmed = await confirm({
      title: '댓글 삭제',
      message: '이 댓글을 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteNoticeComment(selectedNoticeId, commentId);
      loadComments(selectedNoticeId);
      showAlert({ type: 'success', title: '완료', message: '댓글이 삭제되었습니다.' });
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
      showAlert({ type: 'error', title: '실패', message: '댓글 삭제에 실패했습니다.' });
    }
  };

  const getPriorityVariant = (p: NoticePriority): 'red' | 'neutral' => {
    switch (p) {
      case 'HIGH': return 'red';
      case 'NORMAL': return 'neutral';
      case 'LOW': return 'neutral';
    }
  };

  const getPriorityText = (p: NoticePriority) => {
    switch (p) {
      case 'HIGH': return '긴급';
      case 'NORMAL': return '일반';
      case 'LOW': return '낮음';
    }
  };

  // 로딩 중
  if (isLoading && notices.length === 0 && viewMode === 'list') {
    return (
      <Card padding={0}>
        <Center height="200px">
          <Spinner size="lg" aria-label="불러오는 중" />
        </Center>
      </Card>
    );
  }

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />

      {viewMode === 'list' ? (
        /* === 목록 뷰 === */
        <VStack gap={4} align="start" width="100%">
          {/* 헤더 */}
          <HStack gap={3} hAlign="between" vAlign="center" width="100%">
            <VStack gap={0.5} align="start">
              <Heading level={2}>공지사항</Heading>
              <Text type="supporting">직원들에게 중요한 소식을 전달합니다</Text>
            </VStack>
            <HStack gap={2} vAlign="center">
              <Button
                label="새로고침"
                variant="ghost"
                size="sm"
                isIconOnly
                icon={<Icon icon={FiRefreshCw} size="sm" />}
                onClick={loadNotices}
                isDisabled={isLoading}
                isLoading={isLoading}
              />
              {isAdmin && (
                <Button
                  label="새 공지 작성"
                  variant="primary"
                  size="sm"
                  icon={<Icon icon={FiPlus} size="sm" />}
                  onClick={() => router.push('/admin/notice/new')}
                />
              )}
            </HStack>
          </HStack>

          {/* 카드: 탭 + 검색 + 목록 */}
          <div style={{ width: '100%' }}>
            <Card padding={0}>
              {/* 탭 */}
              <div style={{ padding: 'var(--spacing-4)' }}>
                <SegmentedControl
                  value={activeTab}
                  onChange={(v) => setActiveTab(v as TabType)}
                  label="공지 필터"
                >
                  <SegmentedControlItem value="all" label={`전체 (${stats.total})`} />
                  <SegmentedControlItem value="published" label={`게시중 (${stats.published})`} />
                </SegmentedControl>
              </div>

              <Divider />

              {/* 검색 */}
              <div style={{ padding: 'var(--spacing-4)' }}>
                <div style={{ maxWidth: 420 }}>
                  <TextInput
                    label="검색"
                    isLabelHidden
                    value={searchQuery}
                    onChange={(value) => setSearchQuery(value)}
                    placeholder="제목, 내용 검색"
                    startIcon={FiSearch}
                  />
                </div>
              </div>

              <Divider />

              {/* 목록 */}
              <div style={{ padding: 'var(--spacing-5)' }}>
                {notices.length > 0 ? (
                  <VStack gap={2} align="start" width="100%">
                    {notices.map((n) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => handleSelectNotice(n.id)}
                        style={{
                          width: '100%',
                          padding: 'var(--spacing-4)',
                          border: `1px solid ${n.isPinned ? 'var(--color-border-teal)' : 'var(--color-border)'}`,
                          borderRadius: 'var(--radius-element)',
                          cursor: 'pointer',
                          background: n.isPinned ? 'var(--color-background-teal)' : 'var(--color-background-card)',
                        }}
                      >
                        <HStack gap={3} vAlign="start">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <VStack gap={2} align="start">
                              <HStack gap={2} vAlign="center" wrap="wrap">
                                {n.isPinned && <Icon icon={FiStar} size="sm" color="accent" />}
                                <Heading level={4} maxLines={1}>{n.title}</Heading>
                                <Badge variant={getPriorityVariant(n.priority)} label={getPriorityText(n.priority)} />
                              </HStack>
                              <Text type="supporting" maxLines={2}>{n.content}</Text>
                              <HStack gap={3} vAlign="center" wrap="wrap">
                                <Text type="supporting">작성자: {n.authorName}</Text>
                                <Text type="supporting">작성일: {formatDate(n.createdAt, 'yyyy.MM.dd HH:mm')}</Text>
                                <HStack gap={1} vAlign="center">
                                  <Icon icon={FiEye} size="sm" color="secondary" />
                                  <Text type="supporting">{n.viewCount}</Text>
                                </HStack>
                              </HStack>
                            </VStack>
                          </div>
                          <Icon icon="chevronRight" size="md" color="tertiary" />
                        </HStack>
                      </motion.div>
                    ))}
                  </VStack>
                ) : (
                  <VStack gap={4} align="center" width="100%">
                    <div style={{ width: '100%' }}>
                      <EmptyState
                        icon={<Icon icon={FiBell} size="lg" />}
                        title="공지사항이 없습니다"
                        description="아직 등록된 공지사항이 없습니다"
                      />
                    </div>
                    {isAdmin && (
                      <Button
                        label="새 공지 작성"
                        variant="primary"
                        icon={<Icon icon={FiPlus} size="sm" />}
                        onClick={() => router.push('/admin/notice/new')}
                      />
                    )}
                  </VStack>
                )}
              </div>
            </Card>
          </div>
        </VStack>
      ) : (
        /* === 상세 뷰 === */
        <Card padding={0}>
          {/* 상세 헤더 */}
          <div style={{ padding: 'var(--spacing-4)' }}>
            <HStack gap={3} hAlign="between" vAlign="center" width="100%">
              <Button
                label="목록으로"
                variant="ghost"
                size="sm"
                icon={<Icon icon="chevronLeft" size="sm" />}
                onClick={handleBackToList}
              />
              {isEditing ? (
                <HStack gap={2} vAlign="center">
                  <Button label="취소" variant="secondary" onClick={() => setIsEditing(false)} isDisabled={isSubmitting} />
                  <Button label="저장" variant="primary" onClick={handleUpdate} isLoading={isSubmitting} isDisabled={isSubmitting} />
                </HStack>
              ) : (
                <HStack gap={2} vAlign="center">
                  {isAdmin && (
                    <Button label="삭제" variant="destructive" onClick={() => setShowDeleteConfirm(true)} />
                  )}
                  {isAdmin && (
                    <Button label="수정" variant="primary" onClick={() => setIsEditing(true)} />
                  )}
                </HStack>
              )}
            </HStack>
          </div>

          <Divider />

          {/* 상세 본문 */}
          <div style={{ padding: 'var(--spacing-5)' }}>
            {isLoadingDetail ? (
              <Center height="160px">
                <Spinner size="lg" aria-label="불러오는 중" />
              </Center>
            ) : notice ? (
              isEditing ? (
                /* 수정 모드 */
                <VStack gap={4} align="start" width="100%">
                  <div style={{ width: '100%' }}>
                    <TextInput label="제목" value={title} onChange={(value) => setTitle(value)} />
                  </div>
                  <div style={{ width: '100%' }}>
                    <TextArea label="내용" value={content} onChange={(value) => setContent(value)} rows={10} />
                  </div>
                  <HStack gap={4} vAlign="end" wrap="wrap" width="100%">
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <Selector
                        label="우선순위"
                        value={priority}
                        onChange={(value) => setPriority(value as NoticePriority)}
                        options={[
                          { value: 'HIGH', label: '긴급' },
                          { value: 'NORMAL', label: '일반' },
                          { value: 'LOW', label: '낮음' },
                        ]}
                      />
                    </div>
                    <div style={{ flex: '1 1 200px', minWidth: 0, paddingBottom: 'var(--spacing-2)' }}>
                      <CheckboxInput label="상단 고정" value={isPinned} onChange={(checked) => setIsPinned(checked)} />
                    </div>
                  </HStack>
                </VStack>
              ) : (
                /* 보기 모드 */
                <VStack gap={4} align="start" width="100%">
                  <HStack gap={2} vAlign="center">
                    {notice.isPinned && <Icon icon={FiStar} size="sm" color="accent" />}
                    <Badge variant={getPriorityVariant(notice.priority)} label={getPriorityText(notice.priority)} />
                  </HStack>
                  <Heading level={2}>{notice.title}</Heading>
                  <HStack gap={4} vAlign="center" wrap="wrap">
                    <Text type="supporting">작성자: {notice.authorName}</Text>
                    <Text type="supporting">{formatDate(notice.createdAt, 'yyyy.MM.dd HH:mm')}</Text>
                    <HStack gap={1} vAlign="center">
                      <Icon icon={FiEye} size="sm" color="secondary" />
                      <Text type="supporting">{notice.viewCount}</Text>
                    </HStack>
                  </HStack>

                  <div style={{ width: '100%' }}>
                    <Divider />
                  </div>

                  <div style={{ width: '100%', whiteSpace: 'pre-wrap' }}>
                    <Text type="body">{notice.content}</Text>
                  </div>

                  {/* 읽은 사람 섹션 */}
                  <div style={{ width: '100%' }}>
                    <Divider />
                  </div>
                  <VStack gap={3} align="start" width="100%">
                    <HStack gap={2} vAlign="center">
                      <Icon icon={FiUsers} size="md" color="secondary" />
                      <Heading level={4}>읽은 사람 {readers.length > 0 && `(${readers.length}명)`}</Heading>
                    </HStack>
                    {readers.length > 0 ? (
                      <HStack gap={3} wrap="wrap">
                        {readers.map((reader) => (
                          <HStack key={reader.id} gap={1.5} vAlign="center">
                            <Avatar name={reader.userName || '?'} size="xsmall" />
                            <Text type="body">{reader.userName}</Text>
                            <Text type="supporting">{formatDate(reader.readAt, 'MM.dd HH:mm')}</Text>
                          </HStack>
                        ))}
                      </HStack>
                    ) : (
                      <Text type="supporting">아직 읽은 사람이 없습니다</Text>
                    )}
                  </VStack>

                  {/* 댓글 섹션 */}
                  <div style={{ width: '100%' }}>
                    <Divider />
                  </div>
                  <VStack gap={4} align="start" width="100%">
                    <HStack gap={2} vAlign="center">
                      <Icon icon={FiMessageSquare} size="md" color="secondary" />
                      <Heading level={4}>댓글 {comments.length > 0 && `(${comments.length})`}</Heading>
                    </HStack>

                    {/* 댓글 작성 */}
                    <HStack gap={3} vAlign="end" width="100%">
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <TextArea
                          label="댓글"
                          isLabelHidden
                          value={newComment}
                          onChange={(value) => setNewComment(value)}
                          placeholder="댓글을 입력하세요..."
                          rows={2}
                        />
                      </div>
                      <Button
                        label="등록"
                        variant="primary"
                        onClick={handleSubmitComment}
                        isDisabled={isSubmittingComment || !newComment.trim()}
                        isLoading={isSubmittingComment}
                      />
                    </HStack>

                    {/* 댓글 목록 */}
                    {comments.length > 0 ? (
                      <VStack gap={4} align="start" width="100%">
                        {comments.map((comment) => (
                          <HStack key={comment.id} gap={3} vAlign="start" width="100%">
                            <Avatar name={comment.authorName || '?'} size="small" />
                            <StackItem size="fill">
                              <HStack gap={2} vAlign="center" width="100%">
                                <Text type="body" weight="medium">{comment.authorName}</Text>
                                <StackItem size="fill">
                                  <Text type="supporting">{formatDate(comment.createdAt, 'yyyy.MM.dd HH:mm')}</Text>
                                </StackItem>
                                <Button
                                  label="삭제"
                                  variant="ghost"
                                  size="sm"
                                  isIconOnly
                                  icon={<Icon icon={FiTrash2} size="sm" />}
                                  onClick={() => handleDeleteComment(comment.id)}
                                />
                              </HStack>
                              <Text type="body">{comment.content}</Text>
                            </StackItem>
                          </HStack>
                        ))}
                      </VStack>
                    ) : (
                      <Center width="100%" height="64px">
                        <Text type="supporting">아직 댓글이 없습니다</Text>
                      </Center>
                    )}
                  </VStack>
                </VStack>
              )
            ) : (
              <Center width="100%" height="160px">
                <Text type="supporting">공지사항을 찾을 수 없습니다</Text>
              </Center>
            )}
          </div>
        </Card>
      )}

      {/* 삭제 확인 모달 */}
      <Dialog
        isOpen={showDeleteConfirm}
        onOpenChange={(o) => { if (!o) setShowDeleteConfirm(false); }}
        purpose="required"
        width={440}
      >
        <Layout
          header={<DialogHeader title="공지사항 삭제" onOpenChange={(o) => { if (!o) setShowDeleteConfirm(false); }} />}
          content={
            <LayoutContent>
              <HStack gap={3} vAlign="start">
                <Icon icon={FiAlertTriangle} size="md" color="error" />
                <Text type="body">이 공지사항을 삭제하시겠습니까? 삭제된 공지사항은 복구할 수 없습니다.</Text>
              </HStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="취소" variant="secondary" onClick={() => setShowDeleteConfirm(false)} isDisabled={isSubmitting} />
                <Button label="삭제" variant="destructive" onClick={handleDelete} isLoading={isSubmitting} isDisabled={isSubmitting} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
