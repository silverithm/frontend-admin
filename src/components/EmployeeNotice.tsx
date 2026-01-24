'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getPublishedNotices, incrementNoticeViewCount, getNoticeDetail, getNoticeComments, createNoticeComment, deleteNoticeComment, getNoticeReaders } from '@/lib/apiService';
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
      // 조회수 증가
      await incrementNoticeViewCount(notice.id);
      // 상세 정보 로드 (attachments 포함)
      const response = await getNoticeDetail(notice.id);
      const detailData = response.notice || response;
      setSelectedNotice({ ...detailData, viewCount: (detailData.viewCount || notice.viewCount) + 1 });
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
      setComments(response.comments || response || []);
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
      setReaders(response.readers || response || []);
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

  const getPriorityStyle = (priority: NoticePriority) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'NORMAL':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'LOW':
        return 'bg-gray-100 text-gray-600 border-gray-200';
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
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="flex justify-center items-center py-20">
          <svg className="animate-spin h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </div>
    );
  }

  // 공지사항 상세 보기
  if (selectedNotice) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
      >
        {/* 상세 헤더 */}
        <div className="p-6 border-b border-gray-100">
          <button
            onClick={handleBackToList}
            className="flex items-center text-blue-600 hover:text-blue-700 font-medium mb-4 transition-colors"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            목록
          </button>
          <div className="flex items-center gap-2 mb-3">
            {selectedNotice.isPinned && (
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            )}
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getPriorityStyle(selectedNotice.priority)}`}>
              {getPriorityText(selectedNotice.priority)}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{selectedNotice.title}</h2>
          <div className="flex items-center text-sm text-gray-500 mt-3 space-x-4">
            <span className="font-medium">{selectedNotice.authorName}</span>
            <span>{formatDate(selectedNotice.publishedAt || selectedNotice.createdAt, 'yyyy년 M월 d일 HH:mm')}</span>
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {selectedNotice.viewCount}
            </span>
          </div>
        </div>

        {/* 상세 내용 */}
        <div className="p-6">
          <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-base min-h-[100px]">
            {selectedNotice.content}
          </div>
        </div>

        {/* 읽은 사람 섹션 */}
        <div className="px-6 pb-4">
          <button
            onClick={handleToggleReaders}
            className="flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            읽은 사람 보기 {readers.length > 0 && `(${readers.length}명)`}
            <svg className={`w-4 h-4 ml-1 transition-transform ${showReaders ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showReaders && (
            <div className="mt-3 p-4 bg-gray-50 rounded-lg">
              {isLoadingReaders ? (
                <div className="flex justify-center py-4">
                  <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : readers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {readers.map((reader) => (
                    <div
                      key={reader.id}
                      className="flex items-center px-3 py-1.5 bg-white rounded-full border border-gray-200 text-sm"
                    >
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                        <span className="text-xs font-medium text-blue-600">
                          {reader.userName?.charAt(0) || '?'}
                        </span>
                      </div>
                      <span className="text-gray-700">{reader.userName}</span>
                      <span className="text-gray-400 text-xs ml-2">
                        {reader.readAt && formatDate(reader.readAt, 'MM.dd HH:mm')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-2">아직 읽은 사람이 없습니다</p>
              )}
            </div>
          )}
        </div>

        {/* 댓글 섹션 */}
        <div className="border-t border-gray-100">
          <div className="p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              댓글 {comments.length > 0 && `(${comments.length})`}
            </h4>

            {/* 댓글 입력 */}
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isSubmittingComment && handleSubmitComment()}
                placeholder="댓글을 입력하세요..."
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white"
              />
              <button
                onClick={handleSubmitComment}
                disabled={isSubmittingComment || !newComment.trim()}
                className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingComment ? (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  '등록'
                )}
              </button>
            </div>

            {/* 댓글 목록 */}
            {isLoadingComments ? (
              <div className="flex justify-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-blue-600">
                        {comment.authorName?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 text-sm">{comment.authorName}</span>
                        <span className="text-xs text-gray-400">
                          {comment.createdAt && formatDate(comment.createdAt, 'MM.dd HH:mm')}
                        </span>
                        {comment.authorId === currentUserId && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-xs text-red-500 hover:text-red-600 ml-auto"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm break-words">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-gray-500 text-sm">첫 댓글을 남겨보세요</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // 공지사항 목록
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">공지사항</h2>
            <p className="text-gray-500 text-sm mt-1">회사의 중요한 소식을 확인하세요</p>
          </div>
        </div>
      </div>

      {/* 공지사항 목록 */}
      <div className="divide-y divide-gray-100">
        {notices.length > 0 ? (
          notices.map((notice, index) => (
            <motion.div
              key={notice.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleOpenNotice(notice)}
              className={`p-5 hover:bg-gray-50 cursor-pointer transition-all duration-200 group ${
                notice.isPinned ? 'bg-blue-50/50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {notice.isPinned && (
                      <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                    )}
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getPriorityStyle(notice.priority)}`}>
                      {getPriorityText(notice.priority)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                    {notice.title}
                  </h3>
                  <p className="text-gray-500 text-sm line-clamp-1 mt-1">{notice.content}</p>
                  <div className="flex items-center text-xs text-gray-400 space-x-3 mt-2">
                    <span>{formatDate(notice.publishedAt || notice.createdAt, 'yyyy.MM.dd')}</span>
                    <span className="flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {notice.viewCount}
                    </span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-20">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-gray-500 font-medium">공지사항이 없습니다</p>
            <p className="text-gray-400 text-sm mt-1">아직 등록된 공지사항이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
