'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBriefcase, FiPlus, FiEdit2, FiTrash2, FiSearch, FiRefreshCw, FiUsers, FiCheck, FiX } from 'react-icons/fi';
import { getPositions, createPosition, updatePosition, deletePosition, assignPositionToMember, getMemberUsers } from '@/lib/apiService';
import type { Position } from '@/types/position';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Spinner } from '@astryxdesign/core/Spinner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';

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
            onNotification('역할명을 입력해주세요.', 'error');
            return;
        }
        setIsProcessing(true);
        try {
            await createPosition({
                name: formName.trim(),
                description: formDescription.trim() || undefined,
            });
            await fetchData();
            resetForm();
            onNotification('역할이 등록되었습니다.', 'success');
        } catch (error) {
            console.error('역할 생성 오류:', error);
            onNotification(error instanceof Error ? error.message : '역할 등록에 실패했습니다.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdatePosition = async () => {
        if (!editingId || !formName.trim()) return;
        setIsProcessing(true);
        try {
            await updatePosition(editingId, {
                name: formName.trim(),
                description: formDescription.trim() || undefined,
            });
            await fetchData();
            resetForm();
            onNotification('역할이 수정되었습니다.', 'success');
        } catch (error) {
            console.error('역할 수정 오류:', error);
            onNotification(error instanceof Error ? error.message : '역할 수정에 실패했습니다.', 'error');
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
            onNotification('역할이 삭제되었습니다.', 'success');
        } catch (error) {
            console.error('역할 삭제 오류:', error);
            onNotification(error instanceof Error ? error.message : '역할 삭제에 실패했습니다.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAssignPosition = async (memberId: string, positionId: number | null) => {
        setIsProcessing(true);
        try {
            await assignPositionToMember(memberId, positionId);
            await fetchData();
            onNotification('역할이 배정되었습니다.', 'success');
        } catch (error) {
            console.error('역할 배정 오류:', error);
            onNotification(error instanceof Error ? error.message : '역할 배정에 실패했습니다.', 'error');
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
        resetForm();
    };

    const resetForm = () => {
        setEditingId(null);
        setShowAddForm(false);
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
            <HStack hAlign="center" vAlign="center" style={{ height: 256 }}>
                <Spinner size="md" />
            </HStack>
        );
    }

    return (
        <VStack gap={4}>
            {/* 헤더 */}
            <HStack hAlign="between" vAlign="center">
                <HStack gap={2} vAlign="center">
                    <Icon icon={FiBriefcase} size="md" color="accent" />
                    <Heading level={2}>역할 관리</Heading>
                    {organizationName && (
                        <Text type="supporting" color="secondary">({organizationName})</Text>
                    )}
                </HStack>
                <IconButton
                    label="새로고침"
                    icon={<Icon icon={FiRefreshCw} />}
                    variant="ghost"
                    onClick={fetchData}
                />
            </HStack>

            {/* 탭 */}
            <SegmentedControl
                value={activeTab}
                onChange={(value) => setActiveTab(value as 'positions' | 'assign')}
                label="역할 관리 탭"
            >
                <SegmentedControlItem value="positions" label={`역할 목록 (${positions.length})`} />
                <SegmentedControlItem value="assign" label={`역할 배정 (${members.filter(m => !m.position).length}명 미배정)`} />
            </SegmentedControl>

            <AnimatePresence mode="wait">
                {activeTab === 'positions' ? (
                    <motion.div
                        key="positions"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                    >
                        <VStack gap={4}>
                            {/* 추가 버튼 */}
                            {isAdmin && !showAddForm && !editingId && (
                                <HStack hAlign="start">
                                    <Button
                                        label="새 역할 추가"
                                        variant="primary"
                                        icon={<Icon icon={FiPlus} />}
                                        onClick={() => { resetForm(); setShowAddForm(true); }}
                                    />
                                </HStack>
                            )}

                            {/* 추가 폼 */}
                            {showAddForm && (
                                <Card padding={5}>
                                    <VStack gap={3}>
                                        <Heading level={3}>새 역할 추가</Heading>
                                        <TextInput
                                            label="역할명"
                                            value={formName}
                                            onChange={(value) => setFormName(value)}
                                            placeholder="역할명 (예: 팀장, 사회복지사)"
                                            hasAutoFocus
                                        />
                                        <TextInput
                                            label="설명"
                                            value={formDescription}
                                            onChange={(value) => setFormDescription(value)}
                                            placeholder="설명 (선택사항)"
                                            isOptional
                                        />
                                        <HStack gap={2}>
                                            <Button
                                                label={isProcessing ? '등록 중...' : '등록'}
                                                variant="primary"
                                                onClick={handleCreatePosition}
                                                isLoading={isProcessing}
                                                isDisabled={isProcessing || !formName.trim()}
                                            />
                                            <Button
                                                label="취소"
                                                variant="secondary"
                                                onClick={resetForm}
                                            />
                                        </HStack>
                                    </VStack>
                                </Card>
                            )}

                            {/* 역할 목록 */}
                            {positions.length === 0 ? (
                                <Card padding={8}>
                                    <EmptyState
                                        icon={<Icon icon={FiBriefcase} size="lg" />}
                                        title="등록된 역할이 없습니다."
                                        description="새 역할을 추가해주세요."
                                    />
                                </Card>
                            ) : (
                                <VStack gap={2}>
                                    {positions.map((pos) => (
                                        <Card key={pos.id} padding={4}>
                                            {editingId === pos.id ? (
                                                <VStack gap={2}>
                                                    <TextInput
                                                        label="역할명"
                                                        value={formName}
                                                        onChange={(value) => setFormName(value)}
                                                        hasAutoFocus
                                                    />
                                                    <TextInput
                                                        label="설명"
                                                        value={formDescription}
                                                        onChange={(value) => setFormDescription(value)}
                                                        placeholder="설명 (선택사항)"
                                                        isOptional
                                                    />
                                                    <HStack gap={2}>
                                                        <IconButton
                                                            label="저장"
                                                            icon={<Icon icon={FiCheck} />}
                                                            variant="primary"
                                                            onClick={handleUpdatePosition}
                                                            isDisabled={isProcessing || !formName.trim()}
                                                        />
                                                        <IconButton
                                                            label="취소"
                                                            icon={<Icon icon={FiX} />}
                                                            variant="ghost"
                                                            onClick={cancelEdit}
                                                        />
                                                    </HStack>
                                                </VStack>
                                            ) : (
                                                <HStack hAlign="between" vAlign="center">
                                                    <VStack gap={0.5}>
                                                        <HStack gap={2} vAlign="center">
                                                            <Text weight="medium">{pos.name}</Text>
                                                            <Badge variant="teal" label={`${getMemberCountForPosition(pos.name)}명`} />
                                                        </HStack>
                                                        {pos.description && (
                                                            <Text type="supporting" color="secondary">{pos.description}</Text>
                                                        )}
                                                    </VStack>
                                                    {isAdmin && (
                                                        <HStack gap={1}>
                                                            <IconButton
                                                                label="수정"
                                                                icon={<Icon icon={FiEdit2} />}
                                                                variant="ghost"
                                                                onClick={() => startEdit(pos)}
                                                            />
                                                            <IconButton
                                                                label="삭제"
                                                                icon={<Icon icon={FiTrash2} />}
                                                                variant="ghost"
                                                                onClick={() => { setSelectedPosition(pos); setShowDeleteModal(true); }}
                                                            />
                                                        </HStack>
                                                    )}
                                                </HStack>
                                            )}
                                        </Card>
                                    ))}
                                </VStack>
                            )}
                        </VStack>
                    </motion.div>
                ) : (
                    <motion.div
                        key="assign"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                    >
                        <VStack gap={4}>
                            {/* 검색 및 필터 */}
                            <HStack gap={2} vAlign="end">
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <TextInput
                                        label="회원 검색"
                                        isLabelHidden
                                        value={searchTerm}
                                        onChange={(value) => setSearchTerm(value)}
                                        placeholder="이름 또는 이메일 검색..."
                                        startIcon={FiSearch}
                                    />
                                </div>
                                <div style={{ minWidth: 160 }}>
                                    <Selector
                                        label="역할 필터"
                                        isLabelHidden
                                        value={positionFilter}
                                        onChange={(value) => setPositionFilter(value)}
                                        options={[
                                            { value: 'all', label: '전체 역할' },
                                            { value: 'unassigned', label: '미배정' },
                                            ...positions.map(pos => ({ value: pos.name, label: pos.name })),
                                        ]}
                                    />
                                </div>
                            </HStack>

                            {/* 회원 목록 */}
                            {filteredMembers.length === 0 ? (
                                <Card padding={8}>
                                    <EmptyState
                                        icon={<Icon icon={FiUsers} size="lg" />}
                                        title="표시할 회원이 없습니다."
                                    />
                                </Card>
                            ) : (
                                <VStack gap={2}>
                                    {filteredMembers.map((member) => (
                                        <Card key={member.id} padding={4}>
                                            <HStack hAlign="between" vAlign="center">
                                                <VStack gap={0.5}>
                                                    <HStack gap={2} vAlign="center">
                                                        <Text weight="medium">{member.name}</Text>
                                                        <Badge variant="neutral" label={getRoleLabel(member.role)} />
                                                    </HStack>
                                                    <Text type="supporting" color="secondary">{member.email}</Text>
                                                </VStack>
                                                <div style={{ minWidth: 140 }}>
                                                    <Selector
                                                        label="역할 배정"
                                                        isLabelHidden
                                                        value={member.positionId?.toString() || ''}
                                                        onChange={(value) => {
                                                            handleAssignPosition(member.id, value ? parseInt(value) : null);
                                                        }}
                                                        isDisabled={isProcessing}
                                                        placeholder="미배정"
                                                        options={[
                                                            { value: '', label: '미배정' },
                                                            ...positions.map(pos => ({ value: pos.id.toString(), label: pos.name })),
                                                        ]}
                                                    />
                                                </div>
                                            </HStack>
                                        </Card>
                                    ))}
                                </VStack>
                            )}
                        </VStack>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 삭제 확인 모달 */}
            <Dialog
                isOpen={showDeleteModal && !!selectedPosition}
                onOpenChange={(o) => { if (!o) { setShowDeleteModal(false); setSelectedPosition(null); } }}
                purpose="required"
                width={440}
            >
                <Layout
                    header={
                        <DialogHeader
                            title="역할 삭제"
                            onOpenChange={(o) => { if (!o) { setShowDeleteModal(false); setSelectedPosition(null); } }}
                        />
                    }
                    content={
                        <LayoutContent>
                            <VStack gap={3}>
                                {selectedPosition && (
                                    <Text>
                                        <Text as="span" weight="semibold">{selectedPosition.name}</Text> 역할을 삭제하시겠습니까?
                                    </Text>
                                )}
                                {selectedPosition && getMemberCountForPosition(selectedPosition.name) > 0 && (
                                    <Banner
                                        status="warning"
                                        title={`현재 ${getMemberCountForPosition(selectedPosition.name)}명의 회원이 이 역할을 사용 중입니다.`}
                                        description="삭제 시 해당 회원들의 역할이 미배정으로 변경됩니다."
                                    />
                                )}
                            </VStack>
                        </LayoutContent>
                    }
                    footer={
                        <LayoutFooter hasDivider>
                            <HStack gap={2} hAlign="end">
                                <Button
                                    label="취소"
                                    variant="secondary"
                                    onClick={() => { setShowDeleteModal(false); setSelectedPosition(null); }}
                                />
                                <Button
                                    label={isProcessing ? '삭제 중...' : '삭제'}
                                    variant="destructive"
                                    onClick={handleDeletePosition}
                                    isLoading={isProcessing}
                                    isDisabled={isProcessing}
                                />
                            </HStack>
                        </LayoutFooter>
                    }
                />
            </Dialog>
        </VStack>
    );
};

export default PositionManagement;
