'use client';

/** 제공 기록 — 어르신 여러 명을 골라 수칙 또는 운행표·송영 시간 안내를 한 번에 기록한다(제공일·방법 같음). 저장 단추는 한 번만 저장된다. */
import { useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { createGuideDeliveries } from '@/lib/lab/labApi';
import type { GuideKind, GuideMethod } from '@/lib/lab/labTypes';
import { ErrorBanner, LabDateInput, useNotify } from '@/components/lab/LabUi';
import { errorText, todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import PersonPicker from './PersonPicker';
import { useAlive } from './recordsFormat';
import { METHOD_OPTIONS } from './TransportDraft';
import styles from './labRecords.module.css';

interface Props {
  elders: LabElder[];
  /** 처음에 골라 둘 어르신(미제공 어르신 등) */
  initialIds: number[];
  initialKind: GuideKind;
  /** 우선 그룹에 올릴 어르신(탑승 어르신) */
  riderIds: number[];
  onSaved: () => void;
  onClose: () => void;
}

const KIND_OPTIONS: ReadonlyArray<{ value: GuideKind; label: string }> = [
  { value: 'TRANSPORT_RULES', label: '이동서비스 수칙' },
  { value: 'TIMETABLE', label: '운행표·송영 시간 안내' },
];

export default function TransportDeliveryForm({ elders, initialIds, initialKind, riderIds, onSaved, onClose }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const busy = useRef(false);
  const [kind, setKind] = useState<GuideKind>(initialKind);
  const [date, setDate] = useState(todayString());
  const [method, setMethod] = useState<GuideMethod>('FACE');
  const [note, setNote] = useState('');
  const [ids, setIds] = useState<number[]>(initialIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const riderSet = useMemo(() => new Set(riderIds), [riderIds]);
  const items = useMemo(() => elders.map((e) => ({ id: e.id, name: e.name, priority: riderSet.has(e.id) })), [elders, riderSet]);

  const save = async () => {
    if (busy.current) return;
    const problem = date === '' ? '제공일을 골라 주세요' : date > todayString() ? '오늘 이후 날짜는 기록할 수 없습니다' : ids.length === 0 ? '제공한 어르신을 한 명 이상 골라 주세요' : null;
    if (problem) {
      setError(problem);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const made = await createGuideDeliveries({ kind, deliveredOn: date, method, note: note.trim() === '' ? null : note.trim(), elderlyIds: ids });
      notify(`${made.length}명의 ${kind === 'TRANSPORT_RULES' ? '수칙' : '운행표'} 제공을 기록했습니다`, 'success');
      onSaved();
      onClose();
    } catch (e) {
      if (alive.current) setError(errorText(e, '제공 기록을 저장하지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <VStack gap={0.5}>
            <Text type="large" weight="semibold">
              여러 어르신 한 번에 제공 기록
            </Text>
            <Text type="supporting" color="secondary">
              같은 날, 같은 방법으로 전한 어르신(또는 보호자)을 고르고 한 번만 적습니다
            </Text>
          </VStack>
          <Button label="닫기" variant="ghost" isDisabled={saving} onClick={onClose} />
        </HStack>
        <div className={styles.fieldGrid}>
          <Selector label="제공한 것" placeholder="제공한 것 고르기" options={KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} value={kind} onChange={(v) => v && setKind(v as GuideKind)} isDisabled={saving} />
          <LabDateInput label="제공일" value={date} onChange={setDate} max={todayString()} />
          <Selector label="방법" placeholder="방법 고르기" options={METHOD_OPTIONS} value={method} onChange={(v) => v && setMethod(v as GuideMethod)} isDisabled={saving} />
        </div>
        <TextInput label="메모 (선택)" placeholder="예: 10월 개정본으로 전달" value={note} onChange={(v) => setNote(v.slice(0, 200))} isDisabled={saving} />
        <PersonPicker label="어르신" items={items} selected={ids} onChange={setIds} priorityLabel="탑승" max={100} isDisabled={saving} emptyText="등록된 어르신이 없습니다" />
        {error && <ErrorBanner message={error} />}
        <div className={styles.stickyBar}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <Text type="supporting" color="secondary">
              {ids.length}명 선택
            </Text>
            <Button label={ids.length > 0 ? `${ids.length}명 제공 기록하기` : '제공 기록하기'} variant="primary" isLoading={saving} isDisabled={saving} onClick={() => void save()} />
          </HStack>
        </div>
      </VStack>
    </Card>
  );
}
