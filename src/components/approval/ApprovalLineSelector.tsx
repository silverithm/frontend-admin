'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiSearch, FiX } from 'react-icons/fi';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Spinner } from '@astryxdesign/core/Spinner';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { getApproverCandidates } from '@/lib/apiService';
import { ApproverCandidate } from '@/types/approval';

const MAX_STEPS = 5;

interface ApprovalLineSelectorProps {
  value: ApproverCandidate[];
  onChange: (line: ApproverCandidate[]) => void;
}

function candidateKey(candidate: ApproverCandidate) {
  return `${candidate.approverType}:${candidate.approverId}`;
}

/**
 * 결재선 지정 UI. 후보(회사 관리자 + 결재 권한 보유 직원)에서 순서대로 선택한다.
 * 마지막 단계가 최종 결재자(결재), 그 앞은 검토자(검토)로 자동 배정된다.
 */
export default function ApprovalLineSelector({ value, onChange }: ApprovalLineSelectorProps) {
  const [candidates, setCandidates] = useState<ApproverCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getApproverCandidates();
        if (!cancelled) {
          setCandidates(Array.isArray(response?.candidates) ? response.candidates : []);
        }
      } catch (error) {
        console.error('결재자 후보 로드 실패:', error);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedKeys = useMemo(() => new Set(value.map(candidateKey)), [value]);

  const filteredCandidates = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (selectedKeys.has(candidateKey(candidate))) return false;
      if (!term) return true;
      return (
        candidate.name.toLowerCase().includes(term) ||
        (candidate.position ?? '').toLowerCase().includes(term)
      );
    });
  }, [candidates, selectedKeys, searchTerm]);

  const addApprover = (candidate: ApproverCandidate) => {
    if (value.length >= MAX_STEPS) return;
    onChange([...value, candidate]);
  };

  const removeApprover = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const moveApprover = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <VStack gap={3}>
      <VStack gap={1}>
        <Text type="label" weight="medium" color="primary">결재선 지정</Text>
        <Text type="supporting" color="secondary">
          순서대로 승인이 진행됩니다. 마지막 사람이 최종 결재자가 됩니다. (최대 {MAX_STEPS}명)
        </Text>
      </VStack>

      {/* 선택된 결재선 */}
      {value.length > 0 && (
        <VStack gap={1}>
          {value.map((approver, index) => {
            const isLast = index === value.length - 1;
            return (
              <div
                key={candidateKey(approver)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2)',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-inner)',
                  background: 'var(--color-background-muted)',
                }}
              >
                <Badge variant={isLast ? 'teal' : 'neutral'} label={`${index + 1}. ${isLast ? '결재' : '검토'}`} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="medium">{approver.name}</Text>
                  {approver.position && (
                    <Text as="span" type="supporting" color="secondary"> · {approver.position}</Text>
                  )}
                </span>
                <IconButton
                  label="위로"
                  variant="ghost"
                  size="sm"
                  icon={<FiChevronUp />}
                  isDisabled={index === 0}
                  onClick={() => moveApprover(index, -1)}
                />
                <IconButton
                  label="아래로"
                  variant="ghost"
                  size="sm"
                  icon={<FiChevronDown />}
                  isDisabled={isLast}
                  onClick={() => moveApprover(index, 1)}
                />
                <IconButton
                  label="제거"
                  variant="ghost"
                  size="sm"
                  icon={<FiX />}
                  onClick={() => removeApprover(index)}
                />
              </div>
            );
          })}
        </VStack>
      )}

      {value.length === 0 && (
        <Banner status="warning" title="결재선을 지정해주세요." description="최소 1명의 결재자가 필요합니다." />
      )}

      {/* 후보 목록 */}
      {isLoading ? (
        <HStack hAlign="center" style={{ padding: 'var(--spacing-3)' }}>
          <Spinner size="sm" />
        </HStack>
      ) : loadError ? (
        <Banner status="error" title="결재자 목록을 불러오지 못했습니다." />
      ) : (
        <VStack gap={2}>
          <TextInput
            label="결재자 검색"
            isLabelHidden
            value={searchTerm}
            onChange={(nextValue) => setSearchTerm(nextValue)}
            placeholder="이름 또는 직책 검색..."
            startIcon={FiSearch}
          />
          <div
            style={{
              maxHeight: 180,
              overflowY: 'auto',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-inner)',
            }}
          >
            {filteredCandidates.length === 0 ? (
              <div style={{ padding: 'var(--spacing-3)', textAlign: 'center' }}>
                <Text type="supporting" color="secondary">
                  {candidates.length === 0 ? '지정 가능한 결재자가 없습니다.' : '검색 결과가 없습니다.'}
                </Text>
              </div>
            ) : (
              filteredCandidates.map((candidate) => {
                const disabled = value.length >= MAX_STEPS;
                return (
                  <div
                    key={candidateKey(candidate)}
                    className="carev-member-item"
                    onClick={() => { if (!disabled) addApprover(candidate); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-2)',
                      padding: 'var(--spacing-2) var(--spacing-3)',
                      borderBottom: '1px solid var(--color-border)',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <Text weight="medium">{candidate.name}</Text>
                    </span>
                    <Badge
                      variant={candidate.approverType === 'ADMIN' ? 'purple' : 'neutral'}
                      label={candidate.position || (candidate.approverType === 'ADMIN' ? '관리자' : '직원')}
                    />
                  </div>
                );
              })
            )}
          </div>
          {value.length >= MAX_STEPS && (
            <Text type="supporting" color="secondary">최대 {MAX_STEPS}명까지 지정할 수 있습니다.</Text>
          )}
        </VStack>
      )}
    </VStack>
  );
}
