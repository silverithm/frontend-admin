'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
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

export default function NoticeManagement() {
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

  // 로딩 중
  if (isLoading && notices.length === 0 && viewMode === 'list') {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="animate-spin h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {viewMode === 'list' ? (
          /* === 목록 뷰 === */
          <>
            {/* 헤더 */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">공지사항 관리</h2>
                    <p className="text-gray-600 text-sm mt-1">직원들에게 중요한 소식을 전달합니다</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={loadNotices} className="p-2 text-gray-600 hover:bg-white hover:text-blue-600 rounded-full transition-colors" disabled={isLoading}>
                    <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button onClick={() => router.push('/admin/notice/new')} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    새 공지 작성
                  </button>
                </div>
              </div>
            </div>

            {/* 탭 */}
            <div className="border-b border-gray-200">
              <nav className="flex">
                {[
                  { key: 'all', label: '전체', count: stats.total },
                  { key: 'published', label: '게시중', count: stats.published },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as TabType)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.key ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${activeTab === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </nav>
            </div>

            {/* 검색 */}
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="relative max-w-md">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제목, 내용 검색"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-500"
                />
              </div>
            </div>

            {/* 목록 */}
            <div className="p-6">
              {notices.length > 0 ? (
                <div className="space-y-4">
                  {notices.map((n) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer ${n.isPinned ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                      onClick={() => handleSelectNotice(n.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {n.isPinned && (
                              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            )}
                            <h3 className="text-lg font-medium text-gray-900">{n.title}</h3>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityStyle(n.priority)}`}>
                              {getPriorityText(n.priority)}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm line-clamp-2 mb-2">{n.content}</p>
                          <div className="flex items-center text-xs text-gray-500 space-x-4">
                            <span>작성자: {n.authorName}</span>
                            <span>작성일: {formatDate(n.createdAt, 'yyyy.MM.dd HH:mm')}</span>
                            <span className="flex items-center">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              {n.viewCount}
                            </span>
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">공지사항이 없습니다</h3>
                  <p className="text-gray-500 mb-4">새 공지사항을 작성해보세요.</p>
                  <button onClick={() => router.push('/admin/notice/new')} className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    새 공지 작성
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* === 상세 뷰 === */
          <>
            {/* 상세 헤더 */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <button onClick={handleBackToList} className="flex items-center text-blue-600 hover:text-blue-700 font-medium">
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  목록으로
                </button>
                <div className="flex items-center space-x-2">
                  {isEditing ? (
                    <>
                      <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                        취소
                      </button>
                      <button onClick={handleUpdate} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {isSubmitting ? '저장 중...' : '저장'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 text-sm font-medium text-red-600 border-2 border-gray-400 rounded-lg hover:bg-red-50 hover:border-red-400 bg-white">
                        삭제
                      </button>
                      <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        수정
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 상세 본문 */}
            <div className="p-6">
              {isLoadingDetail ? (
                <div className="flex justify-center items-center py-12">
                  <svg className="animate-spin h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : notice ? (
                <div className="space-y-6">
                  {isEditing ? (
                    /* 수정 모드 */
                    <>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 resize-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
                            <select value={priority} onChange={(e) => setPriority(e.target.value as NoticePriority)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900">
                              <option value="HIGH">긴급</option>
                              <option value="NORMAL">일반</option>
                              <option value="LOW">낮음</option>
                            </select>
                          </div>
                          <div className="flex items-center pt-8">
                            <label className="flex items-center cursor-pointer">
                              <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="w-5 h-5 text-blue-600 border-gray-300 rounded" />
                              <span className="ml-3 text-sm text-gray-700">상단 고정</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* 보기 모드 */
                    <>
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

                      {/* 읽은 사람 섹션 */}
                      <div className="mt-8 pt-8 border-t border-gray-200">
                        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          읽은 사람 {readers.length > 0 && <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-600 rounded-full">{readers.length}명</span>}
                        </h4>
                        {readers.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {readers.map((reader) => (
                              <div
                                key={reader.id}
                                className="flex items-center px-3 py-1.5 bg-gray-50 rounded-full border border-gray-200 text-sm"
                              >
                                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-2">
                                  <span className="text-xs font-medium text-green-600">
                                    {reader.userName?.charAt(0) || '?'}
                                  </span>
                                </div>
                                <span className="text-gray-700">{reader.userName}</span>
                                <span className="text-gray-400 text-xs ml-2">
                                  {formatDate(reader.readAt, 'MM.dd HH:mm')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500 text-sm">아직 읽은 사람이 없습니다</div>
                        )}
                      </div>

                      {/* 댓글 섹션 */}
                      <div className="mt-8 pt-8 border-t border-gray-200">
                        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          댓글 {comments.length > 0 && <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">{comments.length}</span>}
                        </h4>

                        {/* 댓글 작성 */}
                        <div className="flex space-x-3 mb-6">
                          <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="댓글을 입력하세요..." rows={2} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 resize-none" />
                          <button onClick={handleSubmitComment} disabled={isSubmittingComment || !newComment.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 self-end">
                            {isSubmittingComment ? '등록 중...' : '등록'}
                          </button>
                        </div>

                        {/* 댓글 목록 */}
                        {comments.length > 0 ? (
                          <div className="space-y-4">
                            {comments.map((comment) => (
                              <div key={comment.id} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold flex-shrink-0">
                                  {comment.authorName?.charAt(0) || '?'}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium text-gray-900">{comment.authorName}</span>
                                      <span className="text-xs text-gray-500">{formatDate(comment.createdAt, 'yyyy.MM.dd HH:mm')}</span>
                                    </div>
                                    <button onClick={() => handleDeleteComment(comment.id)} className="p-1 text-gray-400 hover:text-red-500">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </div>
                                  <p className="text-gray-700 mt-1">{comment.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">아직 댓글이 없습니다</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">공지사항을 찾을 수 없습니다</div>
              )}
            </div>
          </>
        )}
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
