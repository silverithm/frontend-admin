'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createNotice } from '@/lib/apiService';
import { NoticePriority } from '@/types/notice';
import { useAlert } from '@/components/Alert';

export default function NewNoticePage() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<NoticePriority>('NORMAL');
  const [isPinned, setIsPinned] = useState(false);
  const [sendPushNotification, setSendPushNotification] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 등록 핸들러
  const handleSubmit = async () => {
    if (!title.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '제목을 입력해주세요.' });
      return;
    }
    if (!content.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '내용을 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createNotice({
        title: title.trim(),
        content: content.trim(),
        priority,
        isPinned,
        sendPushNotification,
      });

      showAlert({
        type: 'success',
        title: '등록 완료',
        message: sendPushNotification
          ? '공지사항이 등록되었습니다. 직원들에게 알림이 발송됩니다.'
          : '공지사항이 등록되었습니다.'
      });

      // 목록으로 돌아가기
      setTimeout(() => {
        router.push('/admin?tab=notice');
      }, 1000);
    } catch (error) {
      console.error('공지사항 등록 실패:', error);
      showAlert({ type: 'error', title: '등록 실패', message: '공지사항 등록에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AlertContainer />
      <div className="min-h-screen bg-gray-50">
        {/* 헤더 */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.back()}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="text-xl font-bold text-gray-900">새 공지사항 작성</h1>
              </div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    등록 중...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    등록하기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* 기본 정보 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>

              <div className="space-y-4">
                {/* 제목 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제목 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="공지사항 제목을 입력하세요"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                  />
                </div>

                {/* 내용 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    내용 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="공지사항 내용을 입력하세요"
                    rows={12}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 resize-none"
                  />
                </div>

                {/* 우선순위 & 상단고정 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as NoticePriority)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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

            {/* 알림 설정 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendPushNotification}
                  onChange={(e) => setSendPushNotification(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-gray-900 flex items-center">
                    <svg className="w-4 h-4 mr-1.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    직원들에게 푸시 알림 발송
                  </span>
                  <p className="text-xs text-gray-500 mt-1">등록 시 모든 직원에게 알림이 발송됩니다.</p>
                </div>
              </label>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
