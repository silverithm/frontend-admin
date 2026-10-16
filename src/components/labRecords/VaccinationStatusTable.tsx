'use client';

/** 진행 중 어르신별 인플루엔자 접종 상태 표 — 칩(접종·거부·제외·미확인), 접종일·기관·확인 방법·사유. 폭이 좁으면 표 안에서만 가로로 움직인다. */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { deleteVaccination } from '@/lib/lab/labApi';
import type { Vaccination, VaccinationStatus } from '@/lib/lab/labTypes';
import { Chip, LabConfirm, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText } from '@/components/lab/labFormat';
import { STATUS_LABEL, STATUS_TONE, VERIFIED_LABEL } from './VaccinationDraft';
import type { ActiveElder } from './VaccinationDraft';
import styles from './labRecords.module.css';

interface Props {
  year: number;
  elders: ActiveElder[];
  /** 그 연도의 인플루엔자 기록 */
  records: Vaccination[];
  onEdit: (elderId: number, record: Vaccination | null) => void;
  onChanged: () => void;
  /** 계약이 없을 때 계약·인정 도구로 가는 길 */
  onOpenContracts?: () => void;
}

export default function VaccinationStatusTable({ year, elders, records, onEdit, onChanged, onOpenContracts }: Props) {
  const notify = useNotify();
  const [confirm, setConfirm] = useState<Vaccination | null>(null);
  const [deleting, setDeleting] = useState(false);
  const byElder = useMemo(() => {
    // 같은 어르신 기록이 둘 이상이면(서버는 하나만 두지만) 센 상태를 보여 준다
    const rank: Record<VaccinationStatus, number> = { DONE: 4, REFUSED: 3, EXCLUDED: 2, UNKNOWN: 1 };
    const map = new Map<number, Vaccination>();
    for (const r of records) {
      const prev = map.get(r.elderlyId);
      if (!prev || rank[r.status] > rank[prev.status]) map.set(r.elderlyId, r);
    }
    return map;
  }, [records]);

  const remove = async () => {
    if (!confirm || deleting) return;
    setDeleting(true);
    try {
      await deleteVaccination(confirm.id);
      notify('접종 기록을 삭제했습니다', 'success');
      setConfirm(null);
      onChanged();
    } catch (e) {
      notify(errorText(e, '접종 기록을 삭제하지 못했습니다'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (elders.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState isCompact title="진행 중인 어르신이 없습니다" description="급여 계약이 진행 중인 어르신이 있어야 접종 현황을 볼 수 있습니다. 계약은 수급자 계약 화면에서 등록합니다." actions={onOpenContracts ? <Button label="계약·인정 열기" variant="secondary" onClick={onOpenContracts} /> : undefined} />
      </Card>
    );
  }

  return (
    <Card padding={0}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.stickyName}>어르신</th>
              <th>{year}년 상태</th>
              <th>접종일</th>
              <th>기관</th>
              <th>확인 방법</th>
              <th>사유·메모</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {elders.map((e) => {
              const r = byElder.get(e.id) ?? null;
              return (
                <tr key={e.id}>
                  <td className={styles.stickyName}>
                    <Text type="label">{e.name}</Text>
                  </td>
                  <td>{r ? <Chip tone={STATUS_TONE[r.status]} label={STATUS_LABEL[r.status]} /> : <Chip tone="neutral" label="미확인" />}</td>
                  <td>{r?.givenOn ? dotDate(r.givenOn) : '-'}</td>
                  <td>{r?.institution ?? '-'}</td>
                  <td>{r?.verifiedBy ? VERIFIED_LABEL[r.verifiedBy] : '-'}</td>
                  <td className={styles.wrap}>{[r?.reason, r?.note].filter(Boolean).join(' · ') || '-'}</td>
                  <td>
                    <span className={styles.chips}>
                      <Button label={r ? '고치기' : '기록하기'} variant="ghost" size="sm" onClick={() => onEdit(e.id, r)} />
                      {r && <Button label="삭제" variant="ghost" size="sm" onClick={() => setConfirm(r)} />}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <LabConfirm
        isOpen={confirm !== null}
        title="이 접종 기록을 삭제할까요?"
        description="삭제하면 이 어르신은 미확인으로 돌아가고 평가 접종률에도 반영됩니다."
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
