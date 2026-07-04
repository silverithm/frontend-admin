'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiChevronLeft, FiEye, FiMessageSquare, FiStar, FiTrash2 } from 'react-icons/fi';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Badge } from '@astryxdesign/core/Badge';
import { Icon } from '@astryxdesign/core/Icon';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Spinner } from '@astryxdesign/core/Spinner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Divider } from '@astryxdesign/core/Divider';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import {
  getNoticeDetail,
  updateNotice,
  deleteNotice,
  getNoticeComments,
  createNoticeComment,
  deleteNoticeComment,
  getNoticeReaders,
} from '@/lib/apiService';
import { Notice, NoticeComment, NoticeReader, NoticePriority } from '@/types/notice';
import { useAlert } from '@/components/Alert';
import { useConfirm } from '@/components/ConfirmDialog';

type TabType = 'content' | 'comments' | 'readers';

export default function NoticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loginType = localStorage.getItem('loginType');
    setIsAdmin(loginType === 'admin');
  }, []);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [comments, setComments] = useState<NoticeComment[]>([]);
  const [readers, setReaders] = useState<NoticeReader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('content');
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

  // 데이터 로드
  useEffect(() => {
    loadNotice();
    loadComments();
    loadReaders();
  }, [id]);

  const loadNotice = async () => {
    setIsLoading(true);
    try {
      const response = await getNoticeDetail(id);
      const data = response.notice || response;
      setNotice(data);
      setTitle(data.title || '');
      setContent(data.content || '');
      setPriority(data.priority || 'NORMAL');
      setIsPinned(data.isPinned || false);
    } catch (error) {
      console.error('공지사항 로드 실패:', error);
      showAlert({ type: 'error', title: '오류', message: '공지사항을 불러오는데 실패했습니다.' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const data = await getNoticeComments(id);
      setComments(data.comments || []);
    } catch (error) {
      console.error('댓글 로드 실패:', error);
    }
  };

  const loadReaders = async () => {
    try {
      const data = await getNoticeReaders(id);
      setReaders(data.readers || []);
    } catch (error) {
      console.error('읽은 사람 목록 로드 실패:', error);
    }
  };

  // 수정 저장
  const handleUpdate = async () => {
    if (!title.trim() || !content.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '제목과 내용을 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateNotice(id, {
        title: title.trim(),
        content: content.trim(),
        priority,
        isPinned,
      });

      showAlert({ type: 'success', title: '수정 완료', message: '공지사항이 수정되었습니다.' });
      setIsEditing(false);
      loadNotice();
    } catch (error) {
      console.error('수정 실패:', error);
      showAlert({ type: 'error', title: '수정 실패', message: '공지사항 수정에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await deleteNotice(id);
      showAlert({ type: 'success', title: '삭제 완료', message: '공지사항이 삭제되었습니다.' });
      setTimeout(() => router.push(isAdmin ? '/admin?tab=notice' : '/employee?tab=notice'), 1000);
    } catch (error) {
      console.error('삭제 실패:', error);
      showAlert({ type: 'error', title: '삭제 실패', message: '공지사항 삭제에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  // 댓글 작성
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      await createNoticeComment(id, newComment.trim());
      setNewComment('');
      loadComments();
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
    const confirmed = await confirm({
      title: '댓글 삭제',
      message: '이 댓글을 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteNoticeComment(id, commentId);
      loadComments();
      showAlert({ type: 'success', title: '완료', message: '댓글이 삭제되었습니다.' });
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
      showAlert({ type: 'error', title: '실패', message: '댓글 삭제에 실패했습니다.' });
    }
  };

  const getPriorityVariant = (p: NoticePriority): 'red' | 'blue' | 'neutral' => {
    switch (p) {
      case 'HIGH': return 'red';
      case 'NORMAL': return 'blue';
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
      <div style={{ minHeight: '100vh', background: 'var(--color-background-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" aria-label="불러오는 중" />
      </div>
    );
  }

  if (!notice) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-background-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <VStack gap={4} align="center">
          <Text color="secondary" justify="center">공지사항을 찾을 수 없습니다.</Text>
          <Button label="돌아가기" variant="ghost" onClick={() => router.back()} />
        </VStack>
      </div>
    );
  }

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />
      <div style={{ minHeight: '100vh', background: 'var(--color-background-muted)' }}>
        {/* 헤더 */}
        <div style={{ background: 'var(--color-background-card)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 896, margin: '0 auto', padding: '16px 24px' }}>
            <HStack hAlign="between" vAlign="center">
              <HStack gap={4} vAlign="center">
                <Button
                  label="뒤로"
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  icon={<Icon icon={FiChevronLeft} size="sm" />}
                  onClick={() => router.push(isAdmin ? '/admin?tab=notice' : '/employee?tab=notice')}
                />
                <Heading level={3}>공지사항 상세</Heading>
              </HStack>
              {isAdmin && (
                <HStack gap={2} vAlign="center">
                  {isEditing ? (
                    <>
                      <Button label="취소" variant="secondary" size="sm" onClick={() => setIsEditing(false)} />
                      <Button
                        label={isSubmitting ? '저장 중...' : '저장'}
                        variant="primary"
                        size="sm"
                        onClick={handleUpdate}
                        isDisabled={isSubmitting}
                        isLoading={isSubmitting}
                      />
                    </>
                  ) : (
                    <>
                      <Button label="삭제" variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} />
                      <Button label="수정" variant="primary" size="sm" onClick={() => setIsEditing(true)} />
                    </>
                  )}
                </HStack>
              )}
            </HStack>
          </div>
        </div>

        {/* 탭 */}
        <div style={{ background: 'var(--color-background-card)', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ maxWidth: 896, margin: '0 auto', padding: '0 24px' }}>
            <TabList value={activeTab} onChange={(value) => setActiveTab(value as TabType)}>
              <Tab value="content" label="내용" />
              <Tab value="comments" label={`댓글 (${comments.length})`} />
              <Tab value="readers" label={`읽은 사람 (${readers.length})`} />
            </TabList>
          </div>
        </div>

        {/* 본문 */}
        <div style={{ maxWidth: 896, margin: '0 auto', padding: '32px 24px' }}>
          {activeTab === 'content' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {isEditing ? (
                /* 수정 모드 */
                <Card padding={6}>
                  <VStack gap={4} align="start" width="100%">
                    <div style={{ width: '100%' }}>
                      <TextInput label="제목" value={title} onChange={(value) => setTitle(value)} />
                    </div>
                    <div style={{ width: '100%' }}>
                      <TextArea label="내용" value={content} onChange={(value) => setContent(value)} rows={12} />
                    </div>
                    <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}>
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
                      <div style={{ paddingBottom: 8 }}>
                        <CheckboxInput label="상단 고정" value={isPinned} onChange={(checked) => setIsPinned(checked)} />
                      </div>
                    </div>
                  </VStack>
                </Card>
              ) : (
                /* 보기 모드 */
                <Card padding={6}>
                  <VStack gap={2} align="start" width="100%">
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
                    <div style={{ width: '100%', paddingTop: 8, paddingBottom: 8 }}>
                      <Divider />
                    </div>
                    <div style={{ width: '100%', whiteSpace: 'pre-wrap' }}>
                      <Text type="body" color="secondary" display="block">{notice.content}</Text>
                    </div>
                  </VStack>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === 'comments' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <VStack gap={6} align="start" width="100%">
                {/* 댓글 작성 */}
                <div style={{ width: '100%' }}>
                  <Card padding={6}>
                    <VStack gap={4} align="start" width="100%">
                      <Heading level={4}>댓글 작성</Heading>
                      <HStack gap={3} vAlign="end" width="100%">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <TextArea
                            label="댓글"
                            isLabelHidden
                            value={newComment}
                            onChange={(value) => setNewComment(value)}
                            placeholder="댓글을 입력하세요..."
                            rows={3}
                          />
                        </div>
                        <Button
                          label={isSubmittingComment ? '등록 중...' : '등록'}
                          variant="primary"
                          onClick={handleSubmitComment}
                          isDisabled={isSubmittingComment || !newComment.trim()}
                          isLoading={isSubmittingComment}
                        />
                      </HStack>
                    </VStack>
                  </Card>
                </div>

                {/* 댓글 목록 */}
                <div style={{ width: '100%' }}>
                  <Card padding={0}>
                    {comments.length > 0 ? (
                      <div>
                        {comments.map((comment, index) => (
                          <div key={comment.id}>
                            {index > 0 && <Divider />}
                            <div style={{ padding: 16 }}>
                              <HStack gap={3} vAlign="start" hAlign="between" width="100%">
                                <HStack gap={3} vAlign="start">
                                  <Avatar name={comment.authorName || '?'} size="small" />
                                  <VStack gap={1} align="start">
                                    <HStack gap={2} vAlign="center">
                                      <Text type="body" weight="medium">{comment.authorName}</Text>
                                      <Text type="supporting">{formatDate(comment.createdAt, 'yyyy.MM.dd HH:mm')}</Text>
                                    </HStack>
                                    <Text type="body" color="secondary" display="block" wordBreak="break-word">{comment.content}</Text>
                                  </VStack>
                                </HStack>
                                <Button
                                  label="댓글 삭제"
                                  variant="ghost"
                                  size="sm"
                                  isIconOnly
                                  icon={<Icon icon={FiTrash2} size="sm" />}
                                  onClick={() => handleDeleteComment(comment.id)}
                                />
                              </HStack>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '48px 24px' }}>
                        <EmptyState icon={<Icon icon={FiMessageSquare} size="lg" />} title="아직 댓글이 없습니다" />
                      </div>
                    )}
                  </Card>
                </div>
              </VStack>
            </motion.div>
          )}

          {activeTab === 'readers' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card padding={0}>
                <div style={{ padding: 16 }}>
                  <Heading level={4}>읽은 사람 ({readers.length}명)</Heading>
                </div>
                <Divider />
                {readers.length > 0 ? (
                  <div>
                    {readers.map((reader, index) => (
                      <div key={reader.id}>
                        {index > 0 && <Divider />}
                        <div style={{ padding: 16 }}>
                          <HStack gap={3} vAlign="center" hAlign="between" width="100%">
                            <HStack gap={3} vAlign="center">
                              <Avatar name={reader.userName || '?'} size="small" />
                              <Text type="body" weight="medium">{reader.userName}</Text>
                            </HStack>
                            <Text type="supporting">{formatDate(reader.readAt, 'yyyy.MM.dd HH:mm')}</Text>
                          </HStack>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '48px 24px' }}>
                    <EmptyState icon={<Icon icon={FiEye} size="lg" />} title="아직 읽은 사람이 없습니다" />
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <Dialog
        isOpen={showDeleteConfirm}
        onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }}
        purpose="form"
        width={440}
      >
        <Layout
          header={<DialogHeader title="공지사항 삭제" onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }} />}
          content={
            <LayoutContent>
              <HStack gap={3} vAlign="start">
                <div style={{ background: '#fee2e2', padding: 8, borderRadius: 9999, display: 'flex' }}>
                  <Icon icon="warning" size="md" color="error" />
                </div>
                <Text type="body" color="secondary">이 공지사항을 삭제하시겠습니까? 삭제된 공지사항은 복구할 수 없습니다.</Text>
              </HStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="취소" variant="secondary" onClick={() => setShowDeleteConfirm(false)} isDisabled={isSubmitting} />
                <Button
                  label={isSubmitting ? '삭제 중...' : '삭제'}
                  variant="destructive"
                  onClick={handleDelete}
                  isDisabled={isSubmitting}
                  isLoading={isSubmitting}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
