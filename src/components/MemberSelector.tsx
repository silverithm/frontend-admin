"use client";
import React, { useState, useEffect } from 'react';
import { FiSearch, FiUser, FiUsers, FiBriefcase } from 'react-icons/fi';

interface Member {
  id: string;
  name: string;
  email: string;
  role: 'caregiver' | 'office' | 'admin';
  status: string;
}

interface MemberSelectorProps {
  onSelect: (member: Member) => void;
  selectedMember: Member | null;
}

const MemberSelector: React.FC<MemberSelectorProps> = ({ onSelect, selectedMember }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'caregiver' | 'office'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [searchTerm, roleFilter, members]);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const companyId = localStorage.getItem('companyId');
      const token = localStorage.getItem('authToken');

      if (!companyId) {
        throw new Error('회사 ID를 찾을 수 없습니다.');
      }

      const response = await fetch(`/api/admin/users/members?companyId=${companyId}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error('직원 목록을 불러오는데 실패했습니다.');
      }

      const data = await response.json();

      // 백엔드 응답이 {members: [...]} 구조인 경우 처리
      const membersArray = data?.members || data || [];
      const validMembers = Array.isArray(membersArray) ? membersArray : [];

      setMembers(validMembers);
      setFilteredMembers(validMembers);
    } catch (err) {
      console.error('직원 목록 조회 오류:', err);
      setError(err instanceof Error ? err.message : '직원 목록을 불러오는데 실패했습니다.');
      setMembers([]);
      setFilteredMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterMembers = () => {
    let filtered = [...members];

    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(member =>
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 역할 필터
    if (roleFilter !== 'all') {
      filtered = filtered.filter(member => member.role === roleFilter);
    }

    // active 상태인 멤버만 표시 (status가 없거나 'active'인 경우 모두 표시)
    filtered = filtered.filter(member => {
      return !member.status || member.status === 'active';
    });

    setFilteredMembers(filtered);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'caregiver':
        return <FiUser className="w-4 h-4" />;
      case 'office':
        return <FiBriefcase className="w-4 h-4" />;
      case 'admin':
        return <FiUsers className="w-4 h-4" />;
      default:
        return <FiUser className="w-4 h-4" />;
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'caregiver':
        return '요양보호사';
      case 'office':
        return '사무직';
      case 'admin':
        return '관리자';
      default:
        return role;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-200 border-t-teal-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 font-medium">{error}</p>
        <button
          onClick={fetchMembers}
          className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-medium"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 검색 및 필터 영역 */}
      <div className="space-y-3">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="이름 또는 이메일로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-gray-900 placeholder-gray-400"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              roleFilter === 'all'
                ? 'bg-teal-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setRoleFilter('caregiver')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              roleFilter === 'caregiver'
                ? 'bg-teal-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            요양보호사
          </button>
          <button
            onClick={() => setRoleFilter('office')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              roleFilter === 'office'
                ? 'bg-teal-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            사무직
          </button>
        </div>
      </div>

      {/* 직원 목록 */}
      <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
        {filteredMembers.length === 0 ? (
          <div className="text-center py-8">
            <FiUser className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-400">조건에 맞는 직원이 없습니다.</p>
          </div>
        ) : (
          filteredMembers.map((member) => (
            <div
              key={member.id}
              onClick={() => onSelect(member)}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedMember?.id === member.id
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 hover:border-teal-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${
                    member.role === 'caregiver' ? 'bg-blue-50 text-blue-700' :
                    member.role === 'office' ? 'bg-green-50 text-green-700' :
                    'bg-purple-50 text-purple-700'
                  }`}>
                    {getRoleIcon(member.role)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{member.name}</p>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  member.role === 'caregiver' ? 'bg-blue-50 text-blue-700' :
                  member.role === 'office' ? 'bg-green-50 text-green-700' :
                  'bg-purple-50 text-purple-700'
                }`}>
                  {getRoleText(member.role)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedMember && (
        <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
          <p className="text-sm text-teal-800">
            <span className="font-medium">선택된 직원:</span> {selectedMember.name} ({getRoleText(selectedMember.role)})
          </p>
        </div>
      )}
    </div>
  );
};

export default MemberSelector;