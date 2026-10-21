'use client';

/** 그 달 기록 목록 — 날짜·(어르신)·작성자·확인 항목 칩·내용. 고치기·인쇄 단추. 현금영수증은 금액과 월 합계를 보인다. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import type { RecordLog, RecordLogKind } from '@/lib/lab/labTypes';
import { RECORD_LOG_KINDS, checkLabel, formatWon, josa, receiptTotal } from '@/lib/lab/recordLogRules';
import { Chip } from '@/components/lab/LabUi';
import { dateLabel, monthLabel } from '@/components/lab/labFormat';
import styles from './labRecords.module.css';
import own from './RecordLog.module.css';

interface Props {
  kind: RecordLogKind;
  month: string;
  logs: RecordLog[];
  isLoading: boolean;
  onCreate: () => void;
  onOpen: (log: RecordLog) => void;
  onPrint: (logs: RecordLog[]) => void;
}

export default function RecordLogList({ kind, month, logs, isLoading, onCreate, onOpen, onPrint }: Props) {
  const rule = RECORD_LOG_KINDS[kind];
  if (isLoading && logs.length === 0) return <Loading size="inline" label="기록을 불러오는 중..." />;
  if (logs.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState isCompact title={`${monthLabel(month)}에 기록된 ${josa(rule.label, '이', '가')} 없습니다`} description="쓰는 대로 이곳에 쌓이고, 월 단위로 모아 인쇄할 수 있습니다." actions={<Button label={`새 ${rule.label}`} variant="secondary" onClick={onCreate} />} />
      </Card>
    );
  }
  return (
    <Card padding={0}>
      {kind === 'CASH_RECEIPT' && (
        <div className={own.statusRow}>
          <Text type="supporting" color="secondary">
            {monthLabel(month)} {logs.length}건 · 합계 {formatWon(receiptTotal(logs))}
          </Text>
        </div>
      )}
      {logs.map((l) => (
        <div className={own.logRow} key={l.id}>
          <div className={styles.rowHead}>
            <Text type="label">
              {dateLabel(l.entryDate)}
              {rule.perElder ? ` · ${l.elderlyName}` : ''}
              <span className={styles.mutedText}> · {l.authorName}</span>
              {kind === 'CASH_RECEIPT' ? <span className={styles.mutedText}> · {formatWon(l.amount)}</span> : null}
            </Text>
            <span className={styles.chips}>
              <Button label="고치기" variant="ghost" onClick={() => onOpen(l)} />
              <Button label="인쇄" variant="ghost" onClick={() => onPrint([l])} />
            </span>
          </div>
          {l.checks.length > 0 && (
            <span className={styles.chips} style={{ justifyContent: 'flex-start' }}>
              {l.checks.map((c) => (
                <Chip key={c} tone="info" label={checkLabel(kind, c)} />
              ))}
            </span>
          )}
          {l.body && (
            <Text type="supporting" color="secondary">
              <span className={own.logBody}>{l.body}</span>
            </Text>
          )}
          {l.action && (
            <Text type="supporting" color="secondary">
              <span className={own.logBody}>조치: {l.action}</span>
            </Text>
          )}
          {kind === 'CASH_RECEIPT' && l.extra && (
            <Text type="supporting" color="secondary">
              승인번호 {l.extra}
            </Text>
          )}
        </div>
      ))}
    </Card>
  );
}
