'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getOrganizationProfile, updateOrganizationProfile } from '@/lib/apiService';
import { motion } from 'framer-motion';

interface OrganizationProfileData {
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  // 기타 필요한 회사 정보 필드들
}

export default function OrganizationProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<OrganizationProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<OrganizationProfileData | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchProfile();
  }, [router]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const data = await getOrganizationProfile();
      setProfile(data);
      setFormData(data);
    } catch (err) {
      setError('회사 정보를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (formData) {
      setFormData({
        ...formData,
        [e.target.name]: e.target.value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      await updateOrganizationProfile(formData);
      setProfile(formData);
      setIsEditing(false);
      setSuccessMessage('회사 정보가 성공적으로 업데이트되었습니다.');
    } catch (err) {
      setError('회사 정보 업데이트에 실패했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p>회사 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <p className="text-red-500">{error}</p>
            <button onClick={() => router.push('/admin')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                관리자 홈으로
            </button>
        </div>
      </div>
    );
  }
  
  if (!profile) { // profile이 null이고, 에러도 없고, 로딩도 아닌 경우 (이론상 발생하기 어려움)
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <p>회사 정보를 찾을 수 없습니다.</p>
             <button onClick={() => router.push('/admin')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                관리자 홈으로
            </button>
        </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-lg"
      >
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-800">회사 정보</h1>
          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition duration-300"
            >
              정보 수정
            </button>
          )}
        </div>

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
            {successMessage}
          </div>
        )}
        {error && !successMessage && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
            </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">회사명</label>
              <input type="text" name="name" id="name" value={formData?.name || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">주소</label>
              <input type="text" name="address" id="address" value={formData?.address || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">대표 이메일</label>
              <input type="email" name="contactEmail" id="contactEmail" value={formData?.contactEmail || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">대표 전화번호</label>
              <input type="tel" name="contactPhone" id="contactPhone" value={formData?.contactPhone || ''} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            {/* 추가적인 회사 정보 필드들 */} 
            <div className="flex justify-end gap-4 pt-4">
              <button 
                type="button" 
                onClick={() => { setIsEditing(false); setError(''); setSuccessMessage(''); setFormData(profile);}} 
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition duration-300"
              >
                취소
              </button>
              <button 
                type="submit" 
                disabled={isLoading}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow transition duration-300 disabled:opacity-50"
              >
                {isLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-gray-500">회사명</h2>
              <p className="text-lg text-gray-800">{profile.name}</p>
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-500">주소</h2>
              <p className="text-lg text-gray-800">{profile.address || '-'}</p>
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-500">대표 이메일</h2>
              <p className="text-lg text-gray-800">{profile.contactEmail || '-'}</p>
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-500">대표 전화번호</h2>
              <p className="text-lg text-gray-800">{profile.contactPhone || '-'}</p>
            </div>
            {/* 추가적인 회사 정보 표시 */} 
            <div className="pt-6 text-right">
                 <button onClick={() => router.push('/admin')} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-300">
                    관리자 홈으로
                </button>
            </div>
          </div>
        )}
      </motion.div>
    </main>
  );
} 