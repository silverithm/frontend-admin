'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
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
      setTimeout(() => router.push('/admin?tab=notice'), 1000);
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

  const getPriorityStyle = (p: NoticePriority) => {
    switch (p) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'NORMAL': return 'bg-blue-100 text-blue-800';
      case 'LOW': return 'bg-gray-100 text-gray-800';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">공지사항을 찾을 수 없습니다.</p>
          <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />
      <div className="min-h-screen bg-gray-50">
        {/* 헤더 */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/admin?tab=notice')}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="text-xl font-bold text-gray-900">공지사항 상세</h1>
              </div>
              <div className="flex items-center space-x-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleUpdate}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isSubmitting ? '저장 중...' : '저장'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      삭제
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      수정
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              {[
                { key: 'content', label: '내용' },
                { key: 'comments', label: '댓글', count: comments.length },
                { key: 'readers', label: '읽은 사람', count: readers.length },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as TabType)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                      activeTab === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* 본문 */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'content' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {isEditing ? (
                /* 수정 모드 */
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={12}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
                        <select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as NoticePriority)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        >
                          <option value="HIGH">긴급</option>
                          <option value="NORMAL">일반</option>
                          <option value="LOW">낮음</option>
                        </select>
                      </div>
                      <div className="flex items-center pt-8">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isPinned}
                            onChange={(e) => setIsPinned(e.target.checked)}
                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-3 text-sm text-gray-700">상단 고정</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* 보기 모드 */
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    {notice.isPinned && (
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    )}
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getPriorityStyle(notice.priority)}`}>
                      {getPriorityText(notice.priority)}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{notice.title}</h2>
                  <div className="flex items-center text-sm text-gray-500 space-x-4 mb-6">
                    <span>작성자: {notice.authorName}</span>
                    <span>{formatDate(notice.createdAt, 'yyyy.MM.dd HH:mm')}</span>
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      {notice.viewCount}
                    </span>
                  </div>
                  <hr className="mb-6" />
                  <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">{notice.content}</div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'comments' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* 댓글 작성 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">댓글 작성</h3>
                <div className="flex space-x-3">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="댓글을 입력하세요..."
                    rows={3}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 resize-none"
                  />
                  <button
                    onClick={handleSubmitComment}
                    disabled={isSubmittingComment || !newComment.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
                  >
                    {isSubmittingComment ? '등록 중...' : '등록'}
                  </button>
                </div>
              </div>

              {/* 댓글 목록 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {comments.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {comments.map((comment) => (
                      <div key={comment.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                              {comment.authorName.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-gray-900">{comment.authorName}</span>
                                <span className="text-xs text-gray-500">
                                  {formatDate(comment.createdAt, 'yyyy.MM.dd HH:mm')}
                                </span>
                              </div>
                              <p className="text-gray-700 mt-1">{comment.content}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <p className="text-gray-500">아직 댓글이 없습니다</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'readers' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">읽은 사람 ({readers.length}명)</h3>
                </div>
                {readers.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {readers.map((reader) => (
                      <div key={reader.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-semibold">
                            {reader.userName.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{reader.userName}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatDate(reader.readAt, 'yyyy.MM.dd HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    <p className="text-gray-500">아직 읽은 사람이 없습니다</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start mb-4">
                <div className="bg-red-100 p-2 rounded-full mr-3">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">공지사항 삭제</h3>
                  <p className="text-gray-600 text-sm">이 공지사항을 삭제하시겠습니까?<br />삭제된 공지사항은 복구할 수 없습니다.</p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200" disabled={isSubmitting}>
                  취소
                </button>
                <button onClick={handleDelete} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {isSubmitting ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
