'use client';

/** 약품 대장 — 이름·효능·수량·보관·사용기한·개봉일·폐기일. 사용기한이 지났거나 30일 안에 오는 약을 눈에 띄게 보여 준다. */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { updateMedicineStock } from '@/lib/lab/labApi';
import type { MedicineStock } from '@/lib/lab/labTypes';
import { expiringStock } from '@/lib/lab/medicationRules';
import { Chip, ErrorBanner, LabConfirm, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText, todayString } from '@/components/lab/labFormat';
import { draftFromStock, stockInput } from './MedicationDraft';
import MedicationStockForm from './MedicationStockForm';
import styles from './labRecords.module.css';
import own from './MedicationBath.module.css';

interface Props {
  stock: MedicineStock[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
}

export default function MedicationStockLedger({ stock, loading, error, onReload }: Props) {
  const notify = useNotify();
  const today = todayString();
  const [showDisposed, setShowDisposed] = useState(false);
  const [editing, setEditing] = useState<{ stock: MedicineStock | null } | null>(null);
  const [disposing, setDisposing] = useState<MedicineStock | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { expired, soon } = useMemo(() => expiringStock(stock, today), [stock, today]);
  const expiredIds = useMemo(() => new Set(expired.map((s) => s.id)), [expired]);
  const soonIds = useMemo(() => new Set(soon.map((s) => s.id)), [soon]);
  const rows = useMemo(
    () => stock.filter((s) => showDisposed || !s.disposedOn).sort((a, b) => a.expiresOn.localeCompare(b.expiresOn) || a.name.localeCompare(b.name, 'ko')),
    [stock, showDisposed],
  );
  const live = stock.filter((s) => !s.disposedOn).length;

  const dispose = async () => {
    if (!disposing || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await updateMedicineStock(disposing.id, { ...stockInput(draftFromStock(disposing)), disposedOn: today });
      notify(`${disposing.name}을(를) 오늘 폐기한 것으로 적었습니다`, 'success');
      onReload();
    } catch (e) {
      setActionError(errorText(e, '폐기 처리를 하지 못했습니다'));
    } finally {
      setBusy(false);
      setDisposing(null);
    }
  };

  if (editing) {
    return <MedicationStockForm key={editing.stock?.id ?? 'new'} stock={editing.stock} onSaved={onReload} onClose={() => setEditing(null)} />;
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <Text type="large" weight="semibold">
          약품 대장
        </Text>
        <div className={styles.chips} style={{ justifyContent: 'flex-start' }}>
          <Chip tone="neutral" label={`보관 중 ${live}종`} />
          {expired.length > 0 && <Chip tone="danger" label={`사용기한 지남 ${expired.length}종`} />}
          {soon.length > 0 && <Chip tone="warn" label={`30일 안 임박 ${soon.length}종`} />}
        </div>
        <div className={styles.spacer}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)', alignItems: 'center' }}>
            <Switch label="폐기한 약도 보기" value={showDisposed} onChange={setShowDisposed} />
            <Button label="약품 등록" variant="primary" onClick={() => setEditing({ stock: null })} />
          </div>
        </div>
      </div>

      {expired.length > 0 && (
        <div className={own.dangerBlock}>
          사용기한이 지난 약이 보관 중입니다: {expired.map((s) => s.name).join(', ')}. 평가에서 사용기한이 지난 약을 보관하면 인정되지 않으니 폐기하고 폐기일을 적어 주세요.
        </div>
      )}
      {error && <ErrorBanner message={error} onRetry={onReload} />}
      {actionError && <ErrorBanner message={actionError} />}

      {loading && stock.length === 0 ? (
        <Loading size="inline" label="약품 대장을 불러오는 중..." />
      ) : rows.length === 0 && !error ? (
        <Card padding={6}>
          <EmptyState isCompact title="대장에 약품이 없습니다" description="상비약·비상약을 등록해 두면 사용기한을 알려 드리고 분기 점검에 쓸 수 있습니다." actions={<Button label="약품 등록" variant="secondary" onClick={() => setEditing({ stock: null })} />} />
        </Card>
      ) : (
        <Card padding={0}>
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.stackTable}`}>
              <thead>
                <tr>
                  <th scope="col">약품</th>
                  <th scope="col">효능</th>
                  <th scope="col" className={styles.num}>수량</th>
                  <th scope="col">보관</th>
                  <th scope="col">사용기한</th>
                  <th scope="col">개봉일</th>
                  <th scope="col">폐기일</th>
                  <th scope="col">
                    <span className={styles.srOnly}>관리</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className={s.disposedOn ? own.dimmed : undefined}>
                    <td data-label="약품" className={styles.wrap}>
                      {s.name}
                      {s.note ? <div className={styles.mutedText}>{s.note}</div> : null}
                    </td>
                    <td data-label="효능" className={styles.wrap}>
                      {s.efficacy}
                    </td>
                    <td className={styles.num} data-label="수량">
                      {s.quantity.toLocaleString('ko-KR')}
                      {s.unit}
                    </td>
                    <td data-label="보관">{s.storage === 'FRIDGE' ? '냉장' : '실온'}</td>
                    <td data-label="사용기한" className={expiredIds.has(s.id) ? own.expiredCell : soonIds.has(s.id) ? own.soonCell : undefined}>
                      {dotDate(s.expiresOn)}
                      {expiredIds.has(s.id) && ' · 지남'}
                      {soonIds.has(s.id) && ' · 임박'}
                    </td>
                    <td data-label="개봉일">{s.openedOn ? dotDate(s.openedOn) : '-'}</td>
                    <td data-label="폐기일">{s.disposedOn ? dotDate(s.disposedOn) : '-'}</td>
                    <td>
                      <div className={own.doseActions}>
                        <Button label="고치기" variant="ghost" onClick={() => setEditing({ stock: s })} />
                        {!s.disposedOn && <Button label="폐기 처리" variant="secondary" onClick={() => setDisposing(s)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <LabConfirm
        isOpen={disposing !== null}
        title="폐기한 것으로 적을까요?"
        description={disposing ? `${disposing.name}의 폐기일을 오늘(${dotDate(today)})로 적습니다. 대장에는 남고 사용기한 알림에서는 빠집니다.` : ''}
        actionLabel="폐기 처리"
        isLoading={busy}
        onConfirm={() => void dispose()}
        onClose={() => setDisposing(null)}
      />
    </div>
  );
}
