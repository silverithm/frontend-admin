'use client';

/** 투약의뢰서 — 어르신별 목록(진행 중·끝남, 확인할 점), 새로 쓰기·고치기·끝내기·인쇄. */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { updateMedicationRequest } from '@/lib/lab/labApi';
import type { MedicationRequest } from '@/lib/lab/labTypes';
import { relationLabel, requestIssues, slotLabel, timingLabel } from '@/lib/lab/medicationRules';
import { Chip, ErrorBanner, LabConfirm, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText, todayString } from '@/components/lab/labFormat';
import type { LabElder } from '@/components/lab/useLabElders';
import { endedInput } from './MedicationDraft';
import MedicationRequestEditor from './MedicationRequestEditor';
import MedicationRequestSheet from './MedicationRequestSheet';
import { usePrintJob } from './MedicationPrintJob';
import styles from './labRecords.module.css';
import own from './MedicationBath.module.css';

interface Props {
  elders: LabElder[];
  eldersLoading: boolean;
  requests: MedicationRequest[];
  requestsLoading: boolean;
  onChanged: () => void;
}

type Mode = { type: 'list' } | { type: 'edit'; request: MedicationRequest | null };

export default function MedicationRequests({ elders, eldersLoading, requests, requestsLoading, onChanged }: Props) {
  const notify = useNotify();
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [showEnded, setShowEnded] = useState(false);
  const [ending, setEnding] = useState<MedicationRequest | null>(null);
  const [endBusy, setEndBusy] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [printing, print] = usePrintJob<MedicationRequest>();
  const today = todayString();

  const groups = useMemo(() => {
    const visible = requests.filter((r) => showEnded || r.status === 'ACTIVE');
    const byElder = new Map<number, MedicationRequest[]>();
    for (const r of visible) byElder.set(r.elderlyId, [...(byElder.get(r.elderlyId) ?? []), r]);
    const order = new Map(elders.map((e, i) => [e.id, i]));
    return [...byElder.entries()]
      .sort((a, b) => (order.get(a[0]) ?? 9999) - (order.get(b[0]) ?? 9999) || a[0] - b[0])
      .map(([elderlyId, list]) => ({ elderlyId, name: list[0].elderlyName, list: list.sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id - a.id) }));
  }, [requests, elders, showEnded]);

  const activeCount = requests.filter((r) => r.status === 'ACTIVE').length;
  const endedCount = requests.length - activeCount;

  const finish = async () => {
    if (!ending || endBusy) return;
    setEndBusy(true);
    setEndError(null);
    try {
      await updateMedicationRequest(ending.id, endedInput(ending, today));
      notify(`${ending.elderlyName} 어르신의 투약의뢰서를 끝냈습니다`, 'success');
      setEnding(null);
      onChanged();
    } catch (e) {
      setEndError(errorText(e, '투약의뢰서를 끝내지 못했습니다'));
      setEnding(null);
    } finally {
      setEndBusy(false);
    }
  };

  if (mode.type === 'edit') {
    return (
      <MedicationRequestEditor
        key={mode.request?.id ?? 'new'}
        elders={elders}
        request={mode.request}
        onSaved={onChanged}
        onClose={() => setMode({ type: 'list' })}
      />
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <Text type="supporting" color="secondary">
          진행 중 {activeCount}건{endedCount > 0 ? ` · 끝남 ${endedCount}건` : ''}
        </Text>
        <div className={styles.spacer}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)', alignItems: 'center' }}>
            <Switch label="끝난 의뢰서도 보기" value={showEnded} onChange={setShowEnded} />
            <Button label="새 투약의뢰서" variant="primary" isDisabled={eldersLoading || elders.length === 0} onClick={() => setMode({ type: 'edit', request: null })} />
          </div>
        </div>
      </div>
      {endError && <ErrorBanner message={endError} />}

      {requestsLoading && requests.length === 0 ? (
        <Loading size="inline" label="투약의뢰서를 불러오는 중..." />
      ) : groups.length === 0 ? (
        <Card padding={6}>
          <EmptyState
            isCompact
            title={showEnded || endedCount === 0 ? '투약의뢰서가 없습니다' : '진행 중인 투약의뢰서가 없습니다'}
            description="보호자가 약을 맡기면 의뢰서를 써 두세요. 그러면 매일 오늘 투약에 먹일 약이 시간대별로 나옵니다."
            actions={<Button label="새 투약의뢰서" variant="secondary" isDisabled={eldersLoading || elders.length === 0} onClick={() => setMode({ type: 'edit', request: null })} />}
          />
        </Card>
      ) : (
        <Card padding={0}>
          {groups.map((g) => (
            <section key={g.elderlyId} aria-label={`${g.name} 투약의뢰서`}>
              <div className={own.groupHead}>{g.name}</div>
              {g.list.map((r) => {
                const issues = r.status === 'ACTIVE' ? requestIssues(r, today) : [];
                return (
                  <div className={`${own.requestCard} ${r.status === 'ENDED' ? own.dimmed : ''}`} key={r.id}>
                    <div className={styles.rowHead}>
                      <span className={styles.chips} style={{ justifyContent: 'flex-start' }}>
                        <Chip tone={r.status === 'ACTIVE' ? 'ok' : 'neutral'} label={r.status === 'ACTIVE' ? '진행 중' : '끝남'} />
                        {issues.length > 0 && <Chip tone="warn" label={`확인할 점 ${issues.length}`} />}
                        <Text type="supporting" color="secondary">
                          {dotDate(r.startDate)} ~ {r.endDate ? dotDate(r.endDate) : '정해지지 않음'}
                        </Text>
                      </span>
                      <span className={styles.chips}>
                        <Button label="고치기" variant="ghost" onClick={() => setMode({ type: 'edit', request: r })} />
                        <Button label="인쇄" variant="ghost" onClick={() => print(r)} />
                        {r.status === 'ACTIVE' && <Button label="끝내기" variant="secondary" onClick={() => setEnding(r)} />}
                      </span>
                    </div>
                    <Text type="supporting" color="secondary">
                      의뢰 {dotDate(r.requestedOn)} · {r.requesterName || '이름 없음'} ({relationLabel(r.requesterRelation)}) · 받은 직원 {r.writerName}
                    </Text>
                    <ul className={own.medList}>
                      {r.medicines.map((m, i) => (
                        <li key={`${m.name}-${i}`}>
                          <strong>{m.name}</strong>
                          {m.dose ? ` ${m.dose}` : ''} · {m.slots.length > 0 ? m.slots.map(slotLabel).join('·') : '시간대 없음'} · {timingLabel(m.timing)}
                        </li>
                      ))}
                    </ul>
                    {issues.length > 0 && (
                      <div className={own.warnBlock}>
                        <ul style={{ margin: 0, paddingInlineStart: 'var(--spacing-4)' }}>
                          {issues.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </Card>
      )}

      <LabConfirm
        isOpen={ending !== null}
        title="이 투약의뢰서를 끝낼까요?"
        description={ending ? `${ending.elderlyName} 어르신의 의뢰서를 오늘(${dotDate(today)})로 끝냅니다. 끝낸 뒤에도 기간 안의 투약 기록은 남습니다.` : ''}
        actionLabel="끝내기"
        isLoading={endBusy}
        onConfirm={() => void finish()}
        onClose={() => setEnding(null)}
      />
      {printing && <MedicationRequestSheet request={printing} />}
    </div>
  );
}
