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
  companyAddressName?: string;
  adminName?: string;
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
      // localStorage에서 회사 정보 가져오기
      const companyName = localStorage.getItem('companyName') || '';
      const companyAddressName = localStorage.getItem('companyAddressName') || '';
      const userName = localStorage.getItem('userName') || '';
      
      const profileData: OrganizationProfileData = {
        name: companyName,
        address: companyAddressName,
        contactEmail: '', // 현재 API에서 제공되지 않음
        contactPhone: '', // 현재 API에서 제공되지 않음
        companyAddressName,
        adminName: userName
      };
      
      setProfile(profileData);
      setFormData(profileData);
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
      // localStorage 업데이트 (실제 백엔드 API가 없으므로)
      if (formData.name) {
        localStorage.setItem('companyName', formData.name);
      }
      if (formData.address) {
        localStorage.setItem('companyAddressName', formData.address);
      }
      
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
    <div className="min-h-screen bg-gray-50">
      {/* 모던 헤더 */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">기관 프로필</h1>
                  <p className="text-blue-100 text-sm font-medium">기관 정보 관리</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => router.push('/admin')} 
              className="px-4 py-2.5 text-sm font-medium text-blue-600 bg-white/90 backdrop-blur-sm border border-white/20 rounded-lg shadow-sm hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200"
            >
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                관리자 홈으로
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <div className="p-6 sm:p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">기관 정보</h2>
                <p className="text-gray-600 mt-1">기관의 기본 정보를 관리할 수 있습니다</p>
              </div>
              {!isEditing && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    정보 수정
                  </span>
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
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">회사명</label>
                  <input 
                    type="text" 
                    name="name" 
                    id="name" 
                    value={formData?.name || ''} 
                    onChange={handleInputChange} 
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
                    required 
                  />
                </div>
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">회사 주소</label>
                  <input 
                    type="text" 
                    name="address" 
                    id="address" 
                    value={formData?.address || ''} 
                    onChange={handleInputChange} 
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
                  />
                </div>
                <div>
                  <label htmlFor="adminName" className="block text-sm font-medium text-gray-700 mb-2">관리자명</label>
                  <input 
                    type="text" 
                    name="adminName" 
                    id="adminName" 
                    value={formData?.adminName || ''} 
                    onChange={handleInputChange} 
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" 
                    disabled 
                  />
                  <p className="text-xs text-gray-500 mt-1">관리자명은 수정할 수 없습니다.</p>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                  <button 
                    type="button" 
                    onClick={() => { setIsEditing(false); setError(''); setSuccessMessage(''); setFormData(profile);}} 
                    className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    취소
                  </button>
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isLoading ? '저장 중...' : '저장'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* 기관 정보 카드 */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">회사명</h3>
                        <p className="text-lg font-semibold text-gray-900">{profile.name || '정보 없음'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* 위치 정보 카드 */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">회사 주소</h3>
                        <p className="text-lg font-semibold text-gray-900">{profile.address || '정보 없음'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* 관리자 정보 카드 */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">관리자명</h3>
                        <p className="text-lg font-semibold text-gray-900">{profile.adminName || '정보 없음'}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-6 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">기관 정보 관리</p>
                    <p className="text-xs text-gray-400 mt-1">기관의 기본 정보를 확인하고 수정할 수 있습니다.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </main>

      {/* 푸터 */}
      <footer className="py-10 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0 text-center md:text-left">
              <h3 className="text-2xl font-bold">케어베케이션</h3>
              <p className="text-gray-400 mt-1">효율적인 휴무 관리를 위한 최고의 솔루션</p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400">&copy; {new Date().getFullYear()} 케어베케이션. 모든 권리 보유.</p>
              <p className="text-gray-500 text-sm mt-1">
                <a 
                  href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  개인정보처리방침
                </a> | <a 
                  href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  이용약관
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 