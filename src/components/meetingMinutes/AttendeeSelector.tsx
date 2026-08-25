'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiSearch, FiX } from 'react-icons/fi';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Text } from '@astryxdesign/core/Text';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import { Loading } from '@/components/Loading';
import MemberItem from '@/components/MemberItem';
import { getViewerCandidates } from '@/lib/apiService';
import { ApproverCandidate, ViewerPositionCandidate } from '@/types/approval';
import { MinutesAttendeeEntry } from '@/types/meetingMinutes';

interface AttendeeSelectorProps {
  value: MinutesAttendeeEntry[];
  onChange: (attendees: MinutesAttendeeEntry[]) => void;
}

function entryKey(entry: MinutesAttendeeEntry) {
  return entry.attendeeType === 'EXTERNAL'
    ? `EXTERNAL:${entry.name}`
    : `${entry.attendeeType}:${entry.refId}`;
}

/**
 * 회의 참석자 지정 UI — 열람 대상 지정(ViewerSelector)과 같은 문법.
 * 직책을 체크하면 그 직책 재직 직원 전원이 참석자가 되고(서버에서 펼침),
 * 개인은 따로 찍고, 계정 없는 외부 참석자는 이름으로 추가한다.
 */
export default function AttendeeSelector({ value, onChange }: AttendeeSelectorProps) {
  const [positions, setPositions] = useState<ViewerPositionCandidate[]>([]);
  const [people, setPeople] = useState<ApproverCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [externalName, setExternalName] = useState('');

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
        console.error('참석자 후보 로드 실패:', error);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedKeys = useMemo(() => new Set(value.map(entryKey)), [value]);

  const selectedPositionIds = useMemo(
    () => value.filter((v) => v.attendeeType === 'POSITION').map((v) => String(v.refId)),
    [value],
  );

  const selectedPeople = useMemo(
    () =>
      value
        .filter((v) => v.attendeeType === 'ADMIN' || v.attendeeType === 'MEMBER')
        .map((v) => ({
          entry: v,
          candidate: people.find(
            (person) => person.approverType === v.attendeeType && person.approverId === v.refId,
          ),
        })),
    [value, people],
  );

  const externals = useMemo(
    () => value.filter((v) => v.attendeeType === 'EXTERNAL'),
    [value],
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
    const nextPositions: MinutesAttendeeEntry[] = positionIds.map((id) => ({
      attendeeType: 'POSITION',
      refId: Number(id),
    }));
    onChange([...nextPositions, ...value.filter((v) => v.attendeeType !== 'POSITION')]);
  };

  const addPerson = (person: ApproverCandidate) => {
    onChange([...value, { attendeeType: person.approverType, refId: person.approverId }]);
  };

  const addExternal = () => {
    const name = externalName.trim();
    if (!name) return;
    if (selectedKeys.has(`EXTERNAL:${name}`)) {
      setExternalName('');
      return;
    }
    onChange([...value, { attendeeType: 'EXTERNAL', name }]);
    setExternalName('');
  };

  const removeEntry = (entry: MinutesAttendeeEntry) => {
    onChange(value.filter((v) => entryKey(v) !== entryKey(entry)));
  };

  if (isLoading) {
    return <Loading size="inline" label="참석자 후보를 불러오는 중..." />;
  }

  if (loadError) {
    return <Banner status="error" title="참석자 후보를 불러오지 못했습니다." />;
  }

  return (
    <VStack gap={3}>
      <VStack gap={1}>
        <Text type="label" weight="medium" color="primary">참석자</Text>
        <Text type="supporting" color="secondary">
          등록하면 참석자들에게 알림이 가고, 각자 앱에서 회의록을 확인하고 서명합니다.
        </Text>
      </VStack>

      {/* 직책 — 체크하면 그 직책 재직 직원 전원이 참석자 */}
      {positions.length > 0 && (
        <div
          style={{
            maxHeight: 180,
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

      {/* 선택된 개인·외부 참석자 칩 */}
      {(selectedPeople.length > 0 || externals.length > 0) && (
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
                label={`${candidate?.name ?? '참석자'} 제거`}
                variant="ghost"
                size="sm"
                icon={<FiX />}
                onClick={() => removeEntry(entry)}
              />
            </span>
          ))}
          {externals.map((entry) => (
            <span
              key={entryKey(entry)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-1)',
                padding: '2px 2px 2px var(--spacing-2)',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-inner)',
              }}
            >
              <Text type="supporting">{entry.name} (외부)</Text>
              <IconButton
                label={`${entry.name} 제거`}
                variant="ghost"
                size="sm"
                icon={<FiX />}
                onClick={() => removeEntry(entry)}
              />
            </span>
          ))}
        </HStack>
      )}

      {/* 개인 검색 추가 */}
      <VStack gap={2}>
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
            maxHeight: 160,
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

      {/* 외부 참석자 — 계정이 없어 이름만 남고, 서명은 관리자 화면에서 현장 서명으로 받는다 */}
      <HStack gap={2} vAlign="end">
        <StackItem size="fill">
          <TextInput
            label="외부 참석자 추가"
            value={externalName}
            onChange={(nextValue) => setExternalName(nextValue)}
            placeholder="이름 (예: ○○구청 담당자)"
          />
        </StackItem>
        <Button label="추가" variant="secondary" icon={<FiPlus />} onClick={addExternal} />
      </HStack>
    </VStack>
  );
}
