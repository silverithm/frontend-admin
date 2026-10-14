'use client';

/**
 * 상담일지 — 어르신별(왼쪽에서 어르신을 고르고 오른쪽에서 작성·목록) 또는 월별 전체 보기.
 * 어르신 목록에는 이번 달 상담 횟수가 보여, 아직 상담하지 않은 분을 바로 알 수 있다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { listConsultationsByElder, listConsultationsByMonth } from '@/lib/lab/labApi';
import type { Consultation } from '@/lib/lab/labTypes';
import { Chip, ErrorBanner, MonthStepper, useNotify } from '@/components/lab/LabUi';
import { currentMonth, errorText, monthLabel } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import ConsultationCarePlanConsultEditor from './ConsultationCarePlanConsultEditor';
import ConsultationCarePlanConsultList from './ConsultationCarePlanConsultList';
import styles from './labRecords.module.css';

type Mode = 'elder' | 'month';

interface EditState {
  elderId: number;
  elderName: string;
  item: Consultation | null;
}

interface ViewProps {
  elders: LabElder[];
  eldersLoading: boolean;
}

export default function ConsultationCarePlanConsultView({ elders, eldersLoading }: ViewProps) {
  const notify = useNotify();
  const [mode, setMode] = useState<Mode>('elder');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [elderItems, setElderItems] = useState<Consultation[]>([]);
  const [monthItems, setMonthItems] = useState<Consultation[]>([]);
  const [thisMonth, setThisMonth] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const elderSeq = useRef(0);
  const monthSeq = useRef(0);
  const thisSeq = useRef(0);

  const loadElder = useCallback(async (id: number) => {
    const n = ++elderSeq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listConsultationsByElder(id);
      if (n !== elderSeq.current) return; // 어르신을 빨리 바꿀 때 늦게 온 응답은 버린다
      setElderItems(list);
    } catch (e) {
      if (n !== elderSeq.current) return;
      setElderItems([]);
      setError(errorText(e, '상담일지를 불러오지 못했습니다'));
    } finally {
      if (n === elderSeq.current) setLoading(false);
    }
  }, []);

  const loadMonth = useCallback(async (target: string) => {
    const n = ++monthSeq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listConsultationsByMonth(target);
      if (n !== monthSeq.current) return;
      setMonthItems(list);
    } catch (e) {
      if (n !== monthSeq.current) return;
      setMonthItems([]);
      setError(errorText(e, '월간 상담일지를 불러오지 못했습니다'));
    } finally {
      if (n === monthSeq.current) setLoading(false);
    }
  }, []);

  const loadThisMonth = useCallback(async () => {
    const n = ++thisSeq.current;
    try {
      const list = await listConsultationsByMonth(currentMonth());
      if (n === thisSeq.current) setThisMonth(list);
    } catch {
      // 이번 달 횟수 표시는 부가 정보라 실패해도 화면을 막지 않는다
    }
  }, []);

  useEffect(() => {
    void loadThisMonth();
    return () => {
      thisSeq.current += 1;
    };
  }, [loadThisMonth]);

  useEffect(() => {
    if (mode !== 'elder' || selectedId === null) return;
    void loadElder(selectedId);
    return () => {
      elderSeq.current += 1;
    };
  }, [mode, selectedId, loadElder]);

  useEffect(() => {
    if (mode !== 'month') return;
    void loadMonth(month);
    return () => {
      monthSeq.current += 1;
    };
  }, [mode, month, loadMonth]);

  const countByElder = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of thisMonth) map.set(c.elderlyId, (map.get(c.elderlyId) ?? 0) + 1);
    return map;
  }, [thisMonth]);

  const selected = elders.find((e) => e.id === selectedId) ?? null;

  const afterChange = () => {
    setEditing(null);
    void loadThisMonth();
    if (mode === 'elder' && selectedId !== null) void loadElder(selectedId);
    if (mode === 'month') void loadMonth(month);
  };

  const editor = editing && (
    <ConsultationCarePlanConsultEditor
      key={editing.item?.id ?? `new-${editing.elderId}`}
      elderId={editing.elderId}
      elderName={editing.elderName}
      consultation={editing.item}
      onSaved={(_, isNew) => {
        notify(isNew ? '상담일지를 저장했습니다' : '상담일지를 수정했습니다', 'success');
        afterChange();
      }}
      onDeleted={() => afterChange()}
      onClose={() => setEditing(null)}
    />
  );

  return (
    <div className={styles.stack}>
      <SegmentedControl label="상담일지 보기" value={mode} onChange={(v) => { setEditing(null); setMode(v as Mode); }}>
        <SegmentedControlItem value="elder" label="어르신별" />
        <SegmentedControlItem value="month" label="월별 전체" />
      </SegmentedControl>

      {error && <ErrorBanner message={error} onRetry={() => (mode === 'elder' && selectedId !== null ? void loadElder(selectedId) : void loadMonth(month))} />}

      {mode === 'month' ? (
        editor || (
          <>
            <div className={styles.toolbar}>
              <MonthStepper value={month} onChange={(m) => { setMonthItems([]); setMonth(m); }} isDisabled={loading} />
              <Text type="supporting" color="secondary">
                {monthLabel(month)} 상담 {monthItems.length}건 — 새 상담은 ‘어르신별’에서 쓸 수 있습니다.
              </Text>
            </div>
            {loading && monthItems.length === 0 ? (
              <Loading size="inline" label="상담일지를 불러오는 중..." />
            ) : monthItems.length === 0 && !error ? (
              <Card padding={6}>
                <EmptyState isCompact title={`${monthLabel(month)}에는 상담일지가 없습니다`} description="어르신별 보기에서 첫 상담을 남겨 보세요." />
              </Card>
            ) : (
              <Card padding={0}>
                <ConsultationCarePlanConsultList items={monthItems} showElderName onEdit={(c) => setEditing({ elderId: c.elderlyId, elderName: c.elderlyName, item: c })} />
              </Card>
            )}
          </>
        )
      ) : eldersLoading ? (
        <Loading size="inline" label="어르신 목록을 불러오는 중..." />
      ) : elders.length === 0 ? (
        <EmptyState title="등록된 어르신이 없습니다" description="회원관리 탭에서 어르신을 먼저 등록해 주세요." />
      ) : (
        <div className={styles.split} data-has-selection={selected ? 'true' : 'false'}>
          <div className={styles.splitList}>
            <Card padding={0}>
              <nav aria-label="어르신 목록" className={styles.listScroll}>
                {elders.map((elder) => {
                  const count = countByElder.get(elder.id) ?? 0;
                  return (
                    <button
                      key={elder.id}
                      type="button"
                      className={styles.elderButton}
                      aria-current={elder.id === selectedId}
                      onClick={() => {
                        setEditing(null);
                        if (elder.id !== selectedId) setElderItems([]); // 앞 어르신의 목록이 잠깐 비치지 않게
                        setSelectedId(elder.id);
                      }}
                    >
                      <Text type="body" weight="medium">
                        {elder.name}
                      </Text>
                      <Chip tone={count > 0 ? 'ok' : 'neutral'} label={count > 0 ? `이번 달 ${count}회` : '이번 달 없음'} />
                    </button>
                  );
                })}
              </nav>
            </Card>
          </div>
          <div className={styles.splitDetail}>
            {selected ? (
              <div className={styles.stack}>
                <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
                  <HStack gap={2} vAlign="center">
                    <span className={styles.onlyNarrow}>
                      <Button label="목록으로" variant="ghost" onClick={() => { setEditing(null); setSelectedId(null); }} />
                    </span>
                    <Text type="large" weight="semibold">
                      {selected.name}
                    </Text>
                  </HStack>
                  {!editing && <Button label="상담 쓰기" variant="primary" onClick={() => setEditing({ elderId: selected.id, elderName: selected.name, item: null })} />}
                </HStack>
                {editor}
                {!editing &&
                  (loading && elderItems.length === 0 ? (
                    <Loading size="inline" label="상담일지를 불러오는 중..." />
                  ) : elderItems.length === 0 && !error ? (
                    <Card padding={6}>
                      <EmptyState isCompact title="아직 상담일지가 없습니다" description="보호자와 통화했다면 ‘상담 쓰기’로 메모부터 남겨 보세요." />
                    </Card>
                  ) : (
                    <Card padding={0}>
                      <ConsultationCarePlanConsultList items={elderItems} onEdit={(c) => setEditing({ elderId: c.elderlyId, elderName: selected.name, item: c })} />
                    </Card>
                  ))}
              </div>
            ) : (
              <Card padding={6}>
                <EmptyState isCompact title="왼쪽에서 어르신을 골라 주세요" description="이번 달 상담이 없는 분부터 확인해 보세요." />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
