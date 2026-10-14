'use client';

/**
 * 위험도 평가 — 욕창(Braden)·낙상(Morse). 반기(1~6월·7~12월)마다 모든 수급자를 한 번 이상 평가해야 한다.
 * 위쪽은 이번 반기 진행 현황, 아래는 어르신별 마지막 평가와 "평가가 필요한 분"을 한눈에 보는 표다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { StatRow, StatTile } from '@/components/StatTile';
import { listRiskLatest } from '@/lib/lab/labApi';
import { currentHalfLabel, daysUntilHalfEnd, halfYearStatus } from '@/lib/lab/riskScales';
import type { RiskKind, RiskLatest } from '@/lib/lab/labTypes';
import { ErrorBanner } from './LabUi';
import RiskElderDialog from './RiskElderDialog';
import type { RiskDialogView } from './RiskElderDialog';
import { RiskCell } from './RiskParts';
import { errorText } from './labFormat';
import styles from './lab.module.css';

interface DialogState {
  elder: RiskLatest;
  view: RiskDialogView;
  kind: RiskKind;
}

export default function RiskAssessmentLab() {
  const [latest, setLatest] = useState<RiskLatest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyDue, setOnlyDue] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const seq = useRef(0);
  // 화면을 연 시각 기준으로 반기를 판정한다(자정을 넘겨 열어 두면 새로 불러오기 때 갱신됨)
  const [today, setToday] = useState(() => new Date());

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listRiskLatest();
      if (n !== seq.current) return;
      setLatest([...list].sort((a, b) => a.elderlyName.localeCompare(b.elderlyName, 'ko')));
      setToday(new Date());
    } catch (e) {
      if (n !== seq.current) return;
      setError(errorText(e, '위험도 평가 현황을 불러오지 못했습니다'));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  const stats = useMemo(() => {
    const braden = latest.filter((l) => halfYearStatus(l.braden?.assessedOn, today) === 'DONE').length;
    const morse = latest.filter((l) => halfYearStatus(l.morse?.assessedOn, today) === 'DONE').length;
    return { braden, morse };
  }, [latest, today]);

  const needs = useCallback(
    (l: RiskLatest) => halfYearStatus(l.braden?.assessedOn, today) !== 'DONE' || halfYearStatus(l.morse?.assessedOn, today) !== 'DONE',
    [today],
  );
  const visible = onlyDue ? latest.filter(needs) : latest;
  const daysLeft = daysUntilHalfEnd(today);
  const dueCount = latest.filter(needs).length;

  const open = (elder: RiskLatest, view: RiskDialogView) => {
    // 이번 반기에 욕창을 마쳤고 낙상이 남았다면 낙상부터 연다
    const bradenDone = halfYearStatus(elder.braden?.assessedOn, today) === 'DONE';
    const morseDone = halfYearStatus(elder.morse?.assessedOn, today) === 'DONE';
    setDialog({ elder, view, kind: bradenDone && !morseDone ? 'MORSE' : 'BRADEN' });
  };

  return (
    <div className={styles.stack}>
      <StatRow>
        <StatTile value={`${stats.braden}/${latest.length}`} label="욕창(Braden) 완료" tone={latest.length > 0 && stats.braden === latest.length ? 'success' : 'neutral'} />
        <StatTile value={`${stats.morse}/${latest.length}`} label="낙상(Morse) 완료" tone={latest.length > 0 && stats.morse === latest.length ? 'success' : 'neutral'} />
        <StatTile value={`${daysLeft}일`} label={`${currentHalfLabel(today)} 마감까지`} tone={daysLeft <= 30 && dueCount > 0 ? 'warning' : 'neutral'} />
      </StatRow>

      {dueCount > 0 && !loading && (
        <Banner
          status="warning"
          title={`${currentHalfLabel(today)} 평가가 필요한 어르신이 ${dueCount}분 있습니다`}
          description="평가 기준일은 한국 날짜입니다. 반기가 끝나기 전에 욕창·낙상을 한 번씩 평가해 주세요."
        />
      )}

      <div className={styles.toolbar}>
        <Switch label="평가가 필요한 어르신만" value={onlyDue} onChange={setOnlyDue} />
        <div style={{ marginInlineStart: 'auto' }}>
          <Button label="새로 불러오기" variant="ghost" isDisabled={loading} onClick={() => void load()} />
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {loading && latest.length === 0 ? (
        <Loading size="section" label="평가 현황을 불러오는 중..." />
      ) : latest.length === 0 && !error ? (
        <EmptyState title="등록된 어르신이 없습니다" description="회원관리 탭에서 어르신을 먼저 등록해 주세요." />
      ) : visible.length === 0 && !error ? (
        <EmptyState title="평가가 필요한 어르신이 없습니다" description="이번 반기 평가를 모두 마쳤습니다. 다음 반기에 다시 확인해 주세요." />
      ) : (
        <Card padding={0}>
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.stackTable}`}>
              <thead>
                <tr>
                  <th scope="col">어르신</th>
                  <th scope="col">욕창 (Braden)</th>
                  <th scope="col">낙상 (Morse)</th>
                  <th scope="col">
                    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>작업</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => (
                  <tr key={l.elderlyId}>
                    <td>
                      <Text type="body" weight="medium">
                        {l.elderlyName}
                      </Text>
                    </td>
                    <td data-label="욕창 (Braden)">
                      <RiskCell entry={l.braden} today={today} />
                    </td>
                    <td data-label="낙상 (Morse)">
                      <RiskCell entry={l.morse} today={today} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                        <Button label="평가" size="sm" variant="secondary" onClick={() => open(l, 'assess')} />
                        <Button label="이력" size="sm" variant="ghost" onClick={() => open(l, 'history')} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {dialog && (
        <RiskElderDialog
          key={`${dialog.elder.elderlyId}-${dialog.view}`}
          elderId={dialog.elder.elderlyId}
          elderName={dialog.elder.elderlyName}
          initialView={dialog.view}
          initialKind={dialog.kind}
          onClose={() => setDialog(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}
