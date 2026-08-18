'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Text } from '@astryxdesign/core/Text';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Loading } from '@/components/Loading';
import MemberItem from '@/components/MemberItem';
import { getViewerCandidates } from '@/lib/apiService';
import {
  ApprovalViewerEntry,
  ApproverCandidate,
  ViewerPositionCandidate,
} from '@/types/approval';

interface ViewerSelectorProps {
  value: ApprovalViewerEntry[];
  onChange: (viewers: ApprovalViewerEntry[]) => void;
  /** 라벨 위에 붙는 설명 — 양식 설정과 기안 화면의 문구가 다르다 */
  description?: string;
}

function entryKey(entry: { viewerType: string; refId: number }) {
  return `${entry.viewerType}:${entry.refId}`;
}

/**
 * 열람 대상 지정 UI. 직책을 체크하면 그 직책을 가진 직원 전원이 대상이 되고,
 * 개인은 따로 찍어서 더할 수 있다.
 *
 * 관리자·기안자 본인·결재선 참여자는 여기서 고르지 않아도 항상 열람할 수 있으므로
 * 후보에 섞여 있어도 굳이 막지 않는다 (중복 지정은 서버가 걸러낸다).
 */
export default function ViewerSelector({ value, onChange, description }: ViewerSelectorProps) {
  const [positions, setPositions] = useState<ViewerPositionCandidate[]>([]);
  const [people, setPeople] = useState<ApproverCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getViewerCandidates();
        if (!cancelled) {
          setPositions(response.positions);
          setPeople(response.people);
        }
      } catch (error) {
        console.error('열람 대상 후보 로드 실패:', error);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedKeys = useMemo(() => new Set(value.map(entryKey)), [value]);

  const selectedPositionIds = useMemo(
    () => value.filter((v) => v.viewerType === 'POSITION').map((v) => String(v.refId)),
    [value],
  );

  // 선택된 개인 — 후보 목록에서 이름을 찾아 칩으로 보여준다
  const selectedPeople = useMemo(
    () =>
      value
        .filter((v) => v.viewerType !== 'POSITION')
        .map((v) => ({
          entry: v,
          candidate: people.find(
            (person) => person.approverType === v.viewerType && person.approverId === v.refId,
          ),
        })),
    [value, people],
  );

  const filteredPeople = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return people.filter((person) => {
      if (selectedKeys.has(`${person.approverType}:${person.approverId}`)) return false;
      if (!term) return true;
      return (
        person.name.toLowerCase().includes(term) ||
        (person.position ?? '').toLowerCase().includes(term)
      );
    });
  }, [people, selectedKeys, searchTerm]);

  const handlePositionsChange = (positionIds: string[]) => {
    const nextPositions: ApprovalViewerEntry[] = positionIds.map((id) => ({
      viewerType: 'POSITION',
      refId: Number(id),
    }));
    onChange([...nextPositions, ...value.filter((v) => v.viewerType !== 'POSITION')]);
  };

  const addPerson = (person: ApproverCandidate) => {
    onChange([...value, { viewerType: person.approverType, refId: person.approverId }]);
  };

  const removeEntry = (entry: ApprovalViewerEntry) => {
    onChange(value.filter((v) => entryKey(v) !== entryKey(entry)));
  };

  if (isLoading) {
    return <Loading size="inline" label="열람 대상 후보를 불러오는 중..." />;
  }

  if (loadError) {
    return <Banner status="error" title="열람 대상 후보를 불러오지 못했습니다." />;
  }

  return (
    <VStack gap={3}>
      <VStack gap={1}>
        <Text type="label" weight="medium" color="primary">열람 대상</Text>
        <Text type="supporting" color="secondary">
          {description ?? '지정한 직책·직원이 이 문서를 열람하고 검색할 수 있습니다.'}
        </Text>
        <Text type="supporting" color="secondary">
          기관 관리자, 기안자 본인, 결재선에 포함된 사람은 지정하지 않아도 항상 볼 수 있습니다.
        </Text>
      </VStack>

      {/* 직책 — 체크하면 그 직책 전원이 대상 */}
      {positions.length === 0 ? (
        <Banner
          status="info"
          container="section"
          title="등록된 직책이 없습니다."
          description="정보관리에서 직책을 먼저 등록하면 직책 단위로 열람 대상을 지정할 수 있습니다."
        />
      ) : (
        <div
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-inner)',
            padding: 'var(--spacing-2)',
          }}
        >
          <CheckboxList
            label="직책으로 지정"
            density="compact"
            value={selectedPositionIds}
            onChange={handlePositionsChange}
          >
            {positions.map((position) => (
              <CheckboxListItem
                key={position.id}
                value={String(position.id)}
                label={`${position.name} (${position.memberCount}명)`}
              />
            ))}
          </CheckboxList>
        </div>
      )}

      {/* 개인 지정 */}
      <VStack gap={2}>
        <Text type="label" weight="medium" color="primary">개인 지정</Text>

        {selectedPeople.length > 0 && (
          <HStack gap={1} style={{ flexWrap: 'wrap' }}>
            {selectedPeople.map(({ entry, candidate }) => (
              <span
                key={entryKey(entry)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-1)',
                  padding: '2px 2px 2px var(--spacing-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-inner)',
                  background: 'var(--color-background-muted)',
                }}
              >
                <Text type="supporting">{candidate?.name ?? `#${entry.refId}`}</Text>
                <IconButton
                  label={`${candidate?.name ?? '대상'} 제거`}
                  variant="ghost"
                  size="sm"
                  icon={<FiX />}
                  onClick={() => removeEntry(entry)}
                />
              </span>
            ))}
          </HStack>
        )}

        <TextInput
          label="직원 검색"
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
          {filteredPeople.length === 0 ? (
            <div style={{ padding: 'var(--spacing-3)', textAlign: 'center' }}>
              <Text type="supporting" color="secondary">
                {people.length === 0 ? '지정 가능한 직원이 없습니다.' : '검색 결과가 없습니다.'}
              </Text>
            </div>
          ) : (
            filteredPeople.map((person) => (
              <div
                key={`${person.approverType}:${person.approverId}`}
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <MemberItem
                  name={person.name}
                  imageUrl={person.profileImageUrl}
                  density="compact"
                  onClick={() => addPerson(person)}
                  endContent={
                    <Badge
                      variant={person.approverType === 'ADMIN' ? 'purple' : 'neutral'}
                      label={person.position || (person.approverType === 'ADMIN' ? '관리자' : '직원')}
                    />
                  }
                />
              </div>
            ))
          )}
        </div>
      </VStack>
    </VStack>
  );
}
