'use client';

/** 운행표 제공 — 최근 3개월 달마다 제공 기록이 있는지(timetableMonths)와 최근 제공 기록. 기록 삭제는 여기서 한다. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { deleteGuideDelivery } from '@/lib/lab/labApi';
import type { GuideDelivery } from '@/lib/lab/labTypes';
import { timetableMonths } from '@/lib/lab/transportRules';
import { Chip, LabConfirm, SupportText, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText, monthLabel } from '@/components/lab/labFormat';
import { METHOD_LABEL } from './TransportDraft';
import styles from './labRecords.module.css';
import own from './Transport.module.css';

interface Props {
  deliveries: GuideDelivery[];
  rules: GuideDelivery[];
  months: string[];
  onChanged: () => void;
}

export default function TransportTimetable({ deliveries, rules, months, onChanged }: Props) {
  const notify = useNotify();
  const [confirm, setConfirm] = useState<GuideDelivery | null>(null);
  const [deleting, setDeleting] = useState(false);
  const result = timetableMonths(deliveries, months);
  const recent = [...deliveries, ...rules].sort((a, b) => b.deliveredOn.localeCompare(a.deliveredOn) || b.id - a.id).slice(0, 12);

  const remove = async () => {
    if (!confirm || deleting) return;
    setDeleting(true);
    try {
      await deleteGuideDelivery(confirm.id);
      notify('제공 기록을 삭제했습니다', 'success');
      setConfirm(null);
      onChanged();
    } catch (e) {
      notify(errorText(e, '제공 기록을 삭제하지 못했습니다'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card padding={4}>
      <div className={styles.stack}>
        <div className={own.chipRow}>
          <Text type="large" weight="semibold">
            운행표 제공
          </Text>
          <Chip tone={result.covered === months.length ? 'ok' : 'warn'} label={`최근 ${months.length}개월 중 ${result.covered}개월 제공`} />
        </div>
        <div className={own.chipRow}>
          {result.byMonth.map((m) => (
            <Chip key={m.month} tone={m.count > 0 ? 'ok' : 'neutral'} label={`${monthLabel(m.month)} ${m.count > 0 ? `${m.count}명 제공` : '제공 기록 없음'}`} />
          ))}
        </div>
        <SupportText>운행표·송영 시간 안내는 문자나 SNS로 보내도 기록으로 남길 수 있습니다. 월 1회 제공은 기관 기준이며 평가 문구의 주기는 확인하지 못했습니다(대조 필요).</SupportText>

        <Text type="label">최근 제공 기록</Text>
        {recent.length === 0 ? (
          <SupportText>아직 제공 기록이 없습니다.</SupportText>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>제공일</th>
                  <th>어르신</th>
                  <th>제공한 것</th>
                  <th>방법</th>
                  <th>메모</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id}>
                    <td>{dotDate(d.deliveredOn)}</td>
                    <td>{d.elderlyName}</td>
                    <td>{d.kind === 'TIMETABLE' ? '운행표·시간 안내' : '이동서비스 수칙'}</td>
                    <td>{METHOD_LABEL[d.method]}</td>
                    <td className={styles.wrap}>{d.note ?? '-'}</td>
                    <td>
                      <Button label="삭제" variant="ghost" size="sm" onClick={() => setConfirm(d)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <LabConfirm
        isOpen={confirm !== null}
        title="이 제공 기록을 삭제할까요?"
        description="삭제하면 그 어르신은 해당 제공을 받지 않은 것으로 다시 계산됩니다."
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirm(null)}
      />
    </Card>
  );
}
