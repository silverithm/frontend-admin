'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBriefcase, FiPlus, FiEdit2, FiTrash2, FiSearch, FiRefreshCw, FiUsers, FiCheck, FiX } from 'react-icons/fi';
import { getPositions, createPosition, updatePosition, deletePosition, assignPositionToMember, getMemberUsers } from '@/lib/apiService';
import type { Position } from '@/types/position';

interface Member {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    position?: string;
    positionId?: number;
}

interface PositionManagementProps {
    organizationName?: string;
    onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
    isAdmin?: boolean;
}

const PositionManagement: React.FC<PositionManagementProps> = ({ organizationName, onNotification, isAdmin = true }) => {
    const [activeTab, setActiveTab] = useState<'positions' | 'assign'>('positions');
    const [positions, setPositions] = useState<Position[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // 직책 폼
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');

    // 삭제 확인
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

    // 배정 관련
    const [searchTerm, setSearchTerm] = useState('');
    const [positionFilter, setPositionFilter] = useState<string>('all');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [posData, memData] = await Promise.all([
                getPositions(),
                getMemberUsers(),
            ]);

            const posArray = posData?.positions || [];
            setPositions(posArray);

            const memArray = memData?.members || [];
            setMembers(memArray);
        } catch (error) {
            console.error('데이터 로드 오류:', error);
            onNotification('데이터를 불러오는데 실패했습니다.', 'error');
            setPositions([]);
            setMembers([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreatePosition = async () => {
        if (!formName.trim()) {
            onNotification('직책명을 입력해주세요.', 'error');
            return;
        }
        setIsProcessing(true);
        try {
            await createPosition({ name: formName.trim(), description: formDescription.trim() || undefined });
            await fetchData();
            setFormName('');
            setFormDescription('');
            setShowAddForm(false);
            onNotification('직책이 등록되었습니다.', 'success');
        } catch (error) {
            console.error('직책 생성 오류:', error);
            onNotification(error instanceof Error ? error.message : '직책 등록에 실패했습니다.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdatePosition = async () => {
        if (!editingId || !formName.trim()) return;
        setIsProcessing(true);
        try {
            await updatePosition(editingId, { name: formName.trim(), description: formDescription.trim() || undefined });
            await fetchData();
            setEditingId(null);
            setFormName('');
            setFormDescription('');
            onNotification('직책이 수정되었습니다.', 'success');
        } catch (error) {
            console.error('직책 수정 오류:', error);
            onNotification(error instanceof Error ? error.message : '직책 수정에 실패했습니다.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeletePosition = async () => {
        if (!selectedPosition) return;
        setIsProcessing(true);
        try {
            await deletePosition(selectedPosition.id);
            await fetchData();
            setShowDeleteModal(false);
            setSelectedPosition(null);
            onNotification('직책이 삭제되었습니다.', 'success');
        } catch (error) {
            console.error('직책 삭제 오류:', error);
            onNotification(error instanceof Error ? error.message : '직책 삭제에 실패했습니다.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAssignPosition = async (memberId: string, positionId: number | null) => {
        setIsProcessing(true);
        try {
            await assignPositionToMember(memberId, positionId);
            await fetchData();
            onNotification('직책이 배정되었습니다.', 'success');
        } catch (error) {
            console.error('직책 배정 오류:', error);
            onNotification(error instanceof Error ? error.message : '직책 배정에 실패했습니다.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const startEdit = (pos: Position) => {
        setEditingId(pos.id);
        setFormName(pos.name);
        setFormDescription(pos.description || '');
        setShowAddForm(false);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormName('');
        setFormDescription('');
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin': return '관리자';
            case 'caregiver': return '요양보호사';
            case 'office': return '사무직';
            default: return role;
        }
    };

    const filteredMembers = members.filter(member => {
        const matchesSearch = !searchTerm ||
            member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPosition = positionFilter === 'all' ||
            (positionFilter === 'unassigned' && !member.position) ||
            member.position === positionFilter;
        return matchesSearch && matchesPosition;
    });

    const getMemberCountForPosition = (posName: string) => {
        return members.filter(m => m.position === posName).length;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-200 border-t-teal-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FiBriefcase className="text-teal-500" size={20} />
                    <h2 className="text-lg font-bold text-gray-900">직책 관리</h2>
                    {organizationName && (
                        <span className="text-sm text-gray-500">({organizationName})</span>
                    )}
                </div>
                <button
                    onClick={fetchData}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="새로고침"
                >
                    <FiRefreshCw size={16} />
                </button>
            </div>

            {/* 탭 */}
            <div className="flex gap-2 border-b border-gray-200 pb-2">
                <button
                    onClick={() => setActiveTab('positions')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                        activeTab === 'positions'
                            ? 'text-teal-700 bg-teal-50 border-b-2 border-teal-500'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <FiBriefcase className="inline mr-1" size={14} />
                    직책 목록 ({positions.length})
                </button>
                <button
                    onClick={() => setActiveTab('assign')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                        activeTab === 'assign'
                            ? 'text-teal-700 bg-teal-50 border-b-2 border-teal-500'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <FiUsers className="inline mr-1" size={14} />
                    직책 배정 ({members.filter(m => !m.position).length}명 미배정)
                </button>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'positions' ? (
                    <motion.div
                        key="positions"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4"
                    >
                        {/* 추가 버튼 */}
                        {isAdmin && !showAddForm && !editingId && (
                            <button
                                onClick={() => { setShowAddForm(true); setFormName(''); setFormDescription(''); }}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                            >
                                <FiPlus size={16} />
                                새 직책 추가
                            </button>
                        )}

                        {/* 추가 폼 */}
                        {showAddForm && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
                                <h3 className="text-sm font-bold text-gray-900">새 직책 추가</h3>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="직책명 (예: 요양보호사, 간호사)"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    autoFocus
                                />
                                <input
                                    type="text"
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="설명 (선택사항)"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCreatePosition}
                                        disabled={isProcessing || !formName.trim()}
                                        className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 disabled:opacity-50 transition-colors"
                                    >
                                        {isProcessing ? '등록 중...' : '등록'}
                                    </button>
                                    <button
                                        onClick={() => { setShowAddForm(false); setFormName(''); setFormDescription(''); }}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        취소
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 직책 목록 */}
                        {positions.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                                <FiBriefcase className="mx-auto text-gray-400" size={40} />
                                <p className="mt-2 text-sm text-gray-500">등록된 직책이 없습니다.</p>
                                <p className="text-xs text-gray-400">새 직책을 추가해주세요.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {positions.map((pos) => (
                                    <div
                                        key={pos.id}
                                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between hover:border-teal-200 transition-colors"
                                    >
                                        {editingId === pos.id ? (
                                            <div className="flex-1 space-y-2">
                                                <input
                                                    type="text"
                                                    value={formName}
                                                    onChange={(e) => setFormName(e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                                    autoFocus
                                                />
                                                <input
                                                    type="text"
                                                    value={formDescription}
                                                    onChange={(e) => setFormDescription(e.target.value)}
                                                    placeholder="설명 (선택사항)"
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleUpdatePosition}
                                                        disabled={isProcessing || !formName.trim()}
                                                        className="p-1.5 text-teal-600 hover:bg-teal-50 rounded transition-colors"
                                                        title="저장"
                                                    >
                                                        <FiCheck size={16} />
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                                                        title="취소"
                                                    >
                                                        <FiX size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-gray-900">{pos.name}</span>
                                                        <span className="px-2 py-0.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-full">
                                                            {getMemberCountForPosition(pos.name)}명
                                                        </span>
                                                    </div>
                                                    {pos.description && (
                                                        <p className="text-xs text-gray-400 mt-0.5">{pos.description}</p>
                                                    )}
                                                </div>
                                                {isAdmin && (
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => startEdit(pos)}
                                                            className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                                                            title="수정"
                                                        >
                                                            <FiEdit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => { setSelectedPosition(pos); setShowDeleteModal(true); }}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                            title="삭제"
                                                        >
                                                            <FiTrash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="assign"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4"
                    >
                        {/* 검색 및 필터 */}
                        <div className="flex gap-2 flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="이름 또는 이메일 검색..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                            </div>
                            <select
                                value={positionFilter}
                                onChange={(e) => setPositionFilter(e.target.value)}
                                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            >
                                <option value="all">전체 직책</option>
                                <option value="unassigned">미배정</option>
                                {positions.map(pos => (
                                    <option key={pos.id} value={pos.name}>{pos.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* 회원 목록 */}
                        {filteredMembers.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                                <FiUsers className="mx-auto text-gray-400" size={40} />
                                <p className="mt-2 text-sm text-gray-500">표시할 회원이 없습니다.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredMembers.map((member) => (
                                    <div
                                        key={member.id}
                                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between hover:border-teal-200 transition-colors"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900 truncate">{member.name}</span>
                                                <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded">
                                                    {getRoleLabel(member.role)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 truncate">{member.email}</p>
                                        </div>
                                        <div className="ml-3">
                                            <select
                                                value={member.positionId?.toString() || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    handleAssignPosition(member.id, val ? parseInt(val) : null);
                                                }}
                                                disabled={isProcessing}
                                                className={`px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                                                    member.position
                                                        ? 'border-teal-200 text-teal-700 bg-teal-50'
                                                        : 'border-gray-200 text-gray-500'
                                                }`}
                                            >
                                                <option value="">미배정</option>
                                                {positions.map(pos => (
                                                    <option key={pos.id} value={pos.id.toString()}>{pos.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 삭제 확인 모달 */}
            <AnimatePresence>
                {showDeleteModal && selectedPosition && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setShowDeleteModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                    <FiTrash2 className="text-red-600" size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">직책 삭제</h3>
                            </div>
                            <p className="text-sm text-gray-500 mb-1">
                                <span className="font-medium text-red-600">{selectedPosition.name}</span> 직책을 삭제하시겠습니까?
                            </p>
                            {getMemberCountForPosition(selectedPosition.name) > 0 && (
                                <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-lg mt-2">
                                    현재 {getMemberCountForPosition(selectedPosition.name)}명의 회원이 이 직책을 사용 중입니다.
                                    삭제 시 해당 회원들의 직책이 미배정으로 변경됩니다.
                                </p>
                            )}
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={handleDeletePosition}
                                    disabled={isProcessing}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                                >
                                    {isProcessing ? '삭제 중...' : '삭제'}
                                </button>
                                <button
                                    onClick={() => { setShowDeleteModal(false); setSelectedPosition(null); }}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    취소
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PositionManagement;
