'use client';

/** 그날 쓴 운행일지 목록 — 고치기·삭제·A4 인쇄. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { deleteTransportLog } from '@/lib/lab/labApi';
import type { TransportLog } from '@/lib/lab/labTypes';
import { LabConfirm, useNotify } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { DIRECTION_LABEL } from './TransportDraft';
import styles from './labRecords.module.css';

interface Props {
  logs: TransportLog[];
  onEdit: (log: TransportLog) => void;
  onPrint: (logs: TransportLog[]) => void;
  onChanged: () => void;
}

export default function TransportLogList({ logs, onEdit, onPrint, onChanged }: Props) {
  const notify = useNotify();
  const [confirm, setConfirm] = useState<TransportLog | null>(null);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (!confirm || deleting) return;
    setDeleting(true);
    try {
      await deleteTransportLog(confirm.id);
      notify('운행일지를 삭제했습니다', 'success');
      setConfirm(null);
      onChanged();
    } catch (e) {
      notify(errorText(e, '운행일지를 삭제하지 못했습니다'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (logs.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState isCompact title="이 날 쓴 운행일지가 없습니다" description="위에서 등원·하원과 차량을 고르고 일지를 써 주세요." />
      </Card>
    );
  }
  return (
    <Card padding={0}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>구분</th>
              <th>차량</th>
              <th>운전원</th>
              <th>동승자</th>
              <th className={styles.num}>탑승</th>
              <th>작성</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>
                  <Text type="label">{DIRECTION_LABEL[l.direction]}</Text>
                </td>
                <td>{l.vehicleNo}</td>
                <td>{l.driverName || '-'}</td>
                <td>{l.escortName ?? '-'}</td>
                <td className={styles.num}>
                  {l.riders.filter((r) => r.boarded).length}/{l.riders.length}명
                </td>
                <td>{l.writerName ?? '-'}</td>
                <td>
                  <span className={styles.chips}>
                    <Button label="고치기" variant="ghost" size="sm" onClick={() => onEdit(l)} />
                    <Button label="인쇄" variant="ghost" size="sm" onClick={() => onPrint([l])} />
                    <Button label="삭제" variant="ghost" size="sm" onClick={() => setConfirm(l)} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LabConfirm
        isOpen={confirm !== null}
        title="이 운행일지를 삭제할까요?"
        description="삭제하면 되돌릴 수 없고, 그날 운행일지 작성률에서도 빠집니다. 운행일지는 고시 제34조에 따라 보관해야 하는 기록입니다."
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
