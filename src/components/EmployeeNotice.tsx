'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiChevronLeft, FiEye, FiMessageSquare, FiUsers, FiBell, FiStar } from 'react-icons/fi';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Badge } from '@astryxdesign/core/Badge';
import { Icon } from '@astryxdesign/core/Icon';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Spinner } from '@astryxdesign/core/Spinner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Divider } from '@astryxdesign/core/Divider';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { getPublishedNotices, incrementNoticeViewCount, getNoticeDetail, getNoticeComments, createNoticeComment, deleteNoticeComment, getNoticeReaders, markNoticeAsRead } from '@/lib/apiService';
import { Notice, NoticePriority, NoticeComment, NoticeReader } from '@/types/notice';

export default function EmployeeNotice() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  // 댓글 관련 상태
  const [comments, setComments] = useState<NoticeComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // 읽은 사람 관련 상태
  const [readers, setReaders] = useState<NoticeReader[]>([]);
  const [showReaders, setShowReaders] = useState(false);
  const [isLoadingReaders, setIsLoadingReaders] = useState(false);

  // 현재 사용자 정보
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    loadNotices();
    if (typeof window !== 'undefined') {
      setCurrentUserId(localStorage.getItem('userId') || '');
    }
  }, []);

  const loadNotices = async () => {
    setIsLoading(true);
    try {
      const response = await getPublishedNotices();
      setNotices(response.notices || []);
    } catch (error) {
      console.error('공지사항 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenNotice = async (notice: Notice) => {
    try {
      // 조회수 증가 + 읽음 기록 동시 호출
      await Promise.all([
        incrementNoticeViewCount(notice.id),
        markNoticeAsRead(notice.id),
      ]);
      // 상세 정보 로드 (attachments 포함)
      const response = await getNoticeDetail(notice.id);
      const detailData = response.notice || response;
      setSelectedNotice(detailData);
      loadComments(notice.id);
    } catch (error) {
      console.error('공지사항 상세 로드 실패:', error);
      setSelectedNotice(notice);
      loadComments(notice.id);
    }
  };

  const handleBackToList = () => {
    setSelectedNotice(null);
    setComments([]);
    setReaders([]);
    setShowReaders(false);
    setNewComment('');
  };

  const loadComments = async (noticeId: string) => {
    setIsLoadingComments(true);
    try {
      const response = await getNoticeComments(noticeId);
      const list = response.comments || (Array.isArray(response) ? response : []);
      setComments(list);
    } catch (error) {
      console.error('댓글 로드 실패:', error);
      setComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const loadReaders = async (noticeId: string) => {
    setIsLoadingReaders(true);
    try {
      const response = await getNoticeReaders(noticeId);
      const list = response.readers || (Array.isArray(response) ? response : []);
      setReaders(list);
    } catch (error) {
      console.error('읽은 사람 목록 로드 실패:', error);
      setReaders([]);
    } finally {
      setIsLoadingReaders(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!selectedNotice || !newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      await createNoticeComment(selectedNotice.id, newComment.trim());
      setNewComment('');
      loadComments(selectedNotice.id);
    } catch (error) {
      console.error('댓글 등록 실패:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedNotice) return;

    try {
      await deleteNoticeComment(selectedNotice.id, commentId);
      loadComments(selectedNotice.id);
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
    }
  };

  const handleToggleReaders = () => {
    if (!showReaders && selectedNotice) {
      loadReaders(selectedNotice.id);
    }
    setShowReaders(!showReaders);
  };

  const getPriorityVariant = (priority: NoticePriority): 'red' | 'blue' | 'neutral' => {
    switch (priority) {
      case 'HIGH':
        return 'red';
      case 'NORMAL':
        return 'blue';
      case 'LOW':
        return 'neutral';
    }
  };

  const getPriorityText = (priority: NoticePriority) => {
    switch (priority) {
      case 'HIGH': return '긴급';
      case 'NORMAL': return '일반';
      case 'LOW': return '낮음';
    }
  };

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

  if (isLoading) {
    return (
      <Card padding={0}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0' }}>
          <Spinner size="lg" aria-label="불러오는 중" />
        </div>
      </Card>
    );
  }

  // 공지사항 상세 보기
  if (selectedNotice) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
      >
        <Card padding={0}>
          {/* 상세 헤더 */}
          <div style={{ padding: 24 }}>
            <VStack gap={3} align="start">
              <Button
                label="목록"
                variant="ghost"
                size="sm"
                icon={<Icon icon="chevronLeft" size="sm" />}
                onClick={handleBackToList}
              />
              <HStack gap={2} vAlign="center">
                {selectedNotice.isPinned && <Icon icon={FiStar} size="sm" color="accent" />}
                <Badge variant={getPriorityVariant(selectedNotice.priority)} label={getPriorityText(selectedNotice.priority)} />
              </HStack>
              <Heading level={2}>{selectedNotice.title}</Heading>
              <HStack gap={4} vAlign="center" wrap="wrap">
                <Text type="supporting" weight="medium">{selectedNotice.authorName}</Text>
                <Text type="supporting">{formatDate(selectedNotice.publishedAt || selectedNotice.createdAt, 'yyyy년 M월 d일 HH:mm')}</Text>
                <HStack gap={1} vAlign="center">
                  <Icon icon={FiEye} size="sm" color="secondary" />
                  <Text type="supporting">{selectedNotice.viewCount}</Text>
                </HStack>
              </HStack>
            </VStack>
          </div>

          <Divider />

          {/* 상세 내용 */}
          <div style={{ padding: 24, whiteSpace: 'pre-wrap', minHeight: 100 }}>
            <Text type="large">{selectedNotice.content}</Text>
          </div>

          {/* 읽은 사람 섹션 */}
          <div style={{ padding: '0 24px 16px' }}>
            <VStack gap={3} align="start">
              <Button
                label={`읽은 사람 보기${readers.length > 0 ? ` (${readers.length}명)` : ''}`}
                variant="ghost"
                size="sm"
                icon={<Icon icon={FiUsers} size="sm" />}
                endContent={<Icon icon="chevronDown" size="sm" />}
                onClick={handleToggleReaders}
              />

              {showReaders && (
                <div style={{ width: '100%' }}>
                  <Card variant="muted" padding={4}>
                    {isLoadingReaders ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                        <Spinner size="sm" aria-label="불러오는 중" />
                      </div>
                    ) : readers.length > 0 ? (
                      <HStack gap={2} wrap="wrap">
                        {readers.map((reader) => (
                          <div
                            key={reader.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 12px',
                              background: 'var(--color-background-card)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 9999,
                            }}
                          >
                            <Avatar name={reader.userName || '?'} size="xsmall" />
                            <Text type="body">{reader.userName}</Text>
                            {reader.readAt && (
                              <Text type="supporting">{formatDate(reader.readAt, 'MM.dd HH:mm')}</Text>
                            )}
                          </div>
                        ))}
                      </HStack>
                    ) : (
                      <Text type="supporting" justify="center">아직 읽은 사람이 없습니다</Text>
                    )}
                  </Card>
                </div>
              )}
            </VStack>
          </div>

          <Divider />

          {/* 댓글 섹션 */}
          <div style={{ padding: 24 }}>
            <VStack gap={4} align="start" width="100%">
              <HStack gap={2} vAlign="center">
                <Icon icon={FiMessageSquare} size="md" color="secondary" />
                <Heading level={4}>댓글 {comments.length > 0 && `(${comments.length})`}</Heading>
              </HStack>

              {/* 댓글 입력 */}
              <HStack gap={3} vAlign="stretch" width="100%">
                <div
                  style={{ flex: '1 1 auto', minWidth: 0 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && !isSubmittingComment) {
                      e.preventDefault();
                      handleSubmitComment();
                    }
                  }}
                >
                  <TextInput
                    label="댓글"
                    isLabelHidden
                    value={newComment}
                    onChange={(value) => setNewComment(value)}
                    placeholder="댓글을 입력하세요..."
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
              {isLoadingComments ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0', width: '100%' }}>
                  <Spinner size="md" aria-label="불러오는 중" />
                </div>
              ) : comments.length > 0 ? (
                <VStack gap={4} align="start" width="100%">
                  {comments.map((comment) => (
                    <HStack key={comment.id} gap={3} vAlign="start" width="100%">
                      <Avatar name={comment.authorName || '?'} size="small" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <HStack gap={2} vAlign="center">
                          <Text type="body" weight="medium">{comment.authorName}</Text>
                          <Text type="supporting">
                            {comment.createdAt && formatDate(comment.createdAt, 'MM.dd HH:mm')}
                          </Text>
                          {comment.authorId === currentUserId && (
                            <div style={{ marginLeft: 'auto' }}>
                              <Button
                                label="삭제"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteComment(comment.id)}
                              />
                            </div>
                          )}
                        </HStack>
                        <Text type="body" display="block" wordBreak="break-word">{comment.content}</Text>
                      </div>
                    </HStack>
                  ))}
                </VStack>
              ) : (
                <div style={{ width: '100%' }}>
                  <EmptyState
                    icon={<Icon icon={FiMessageSquare} size="lg" />}
                    title="첫 댓글을 남겨보세요"
                  />
                </div>
              )}
            </VStack>
          </div>
        </Card>
      </motion.div>
    );
  }

  // 공지사항 목록
  return (
    <Card padding={0}>
      {/* 헤더 */}
      <div style={{ padding: 24 }}>
        <VStack gap={1} align="start">
          <Heading level={2}>공지사항</Heading>
          <Text type="supporting">회사의 중요한 소식을 확인하세요</Text>
        </VStack>
      </div>

      <Divider />

      {/* 공지사항 목록 */}
      {notices.length > 0 ? (
        <div>
          {notices.map((notice, index) => (
            <div key={notice.id}>
              {index > 0 && <Divider />}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleOpenNotice(notice)}
                className="carev-empnotice-item"
                style={{
                  padding: 20,
                  cursor: 'pointer',
                  background: notice.isPinned ? 'var(--color-background-teal)' : undefined,
                }}
              >
                <HStack gap={3} vAlign="center">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <VStack gap={2} align="start">
                      <HStack gap={2} vAlign="center">
                        {notice.isPinned && <Icon icon={FiStar} size="sm" color="accent" />}
                        <Badge variant={getPriorityVariant(notice.priority)} label={getPriorityText(notice.priority)} />
                      </HStack>
                      <Heading level={4} maxLines={1}>{notice.title}</Heading>
                      <Text type="supporting" maxLines={1}>{notice.content}</Text>
                      <HStack gap={3} vAlign="center">
                        <Text type="supporting">{formatDate(notice.publishedAt || notice.createdAt, 'yyyy.MM.dd')}</Text>
                        <HStack gap={1} vAlign="center">
                          <Icon icon={FiEye} size="sm" color="secondary" />
                          <Text type="supporting">{notice.viewCount}</Text>
                        </HStack>
                      </HStack>
                    </VStack>
                  </div>
                  <Icon icon="chevronRight" size="md" color="tertiary" />
                </HStack>
              </motion.div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '48px 24px' }}>
          <EmptyState
            icon={<Icon icon={FiBell} size="lg" />}
            title="공지사항이 없습니다"
            description="아직 등록된 공지사항이 없습니다"
          />
        </div>
      )}
    </Card>
  );
}
