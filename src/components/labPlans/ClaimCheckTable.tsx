'use client';

/**
 * 대조 결과 표 — 청구·출석·청구서 일수, 청구·청구서 구간, 상태, 차이 사유, 한도 사용률. 줄마다 확인 사유를 적으면 "확인함"이 된다.
 * 표가 넓어 좁은 화면에서는 이 상자 안에서만 가로로 움직인다.
 */
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Chip, SupportText } from '@/components/lab/LabUi';
import { groupDigits } from '@/components/lab/labFormat';
import { MONTHLY_LIMIT_NOTE } from '@/lib/lab/claimRules';
import { bandShort, finalStatus, isBandOnly, MAX_REVIEW_NOTE } from './ClaimCheckFormat';
import type { CheckedRow } from './ClaimCheckFormat';
import styles from './labPlans.module.css';
import six from './labPlans6.module.css';

interface Props {
  rows: CheckedRow[];
  notes: Record<number, string>;
  onNote: (elderlyId: number, note: string) => void;
  isDisabled: boolean;
}

function StatusChip({ row, note }: { row: CheckedRow; note: string }) {
  const status = finalStatus(row, note);
  if (status === 'MATCH') return <Chip tone="ok" label="일치" />;
  if (status === 'RESOLVED') return <Chip tone="info" label="확인함" />;
  return <Chip tone="danger" label="차이" />;
}

export default function ClaimCheckTable({ rows, notes, onNote, isDisabled }: Props) {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <Text type="label">5. 대조 결과 ({rows.length}명)</Text>
        <div className={styles.tableScroll}>
          <table className={six.wideTable}>
            <thead>
              <tr>
                <th scope="col">어르신</th>
                <th scope="col">청구 일수</th>
                <th scope="col">출석 일수</th>
                <th scope="col">청구서 일수</th>
                <th scope="col">청구 구간</th>
                <th scope="col">청구서 구간</th>
                <th scope="col">상태</th>
                <th scope="col">한도 사용</th>
                <th scope="col">차이 사유와 확인 사유</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const note = notes[r.elderlyId] ?? '';
                const bandOnly = isBandOnly(r);
                return (
                  <tr key={r.elderlyId} data-tone={r.status === 'MATCH' ? undefined : note.trim() === '' ? 'danger' : undefined}>
                    <td className={six.colName}>{r.name}</td>
                    <td className={styles.num}>{r.claimedDays}일</td>
                    <td className={styles.num}>{r.attendanceUnknown ? '기록 없음' : `${r.attendedDays}일`}</td>
                    <td className={styles.num}>{r.billedDays === null ? '청구서 없음' : `${r.billedDays}일`}</td>
                    <td className={six.nowrap}>{bandShort(r.claimedBand)}</td>
                    <td className={six.nowrap}>{bandShort(r.billBand)}</td>
                    <td>
                      <StatusChip row={r} note={note} />
                    </td>
                    <td className={styles.num}>
                      {r.limit ? (
                        <VStack gap={1}>
                          <Text type="supporting" hasTabularNumbers>
                            {r.limit.rate}%
                          </Text>
                          <div className={styles.meter} role="img" aria-label={`월 한도 ${groupDigits(r.limit.limit)}원 중 ${r.limit.rate}% 사용`}>
                            <div className={styles.meterFill} data-over={r.limit.over ? 'true' : undefined} style={{ width: `${Math.min(100, r.limit.rate)}%` }} />
                          </div>
                          <Text type="supporting" color="secondary" hasTabularNumbers>
                            {groupDigits(r.limit.used)} / {groupDigits(r.limit.limit)}원
                          </Text>
                          {r.limit.over && <Chip tone="danger" label="한도 넘음" />}
                        </VStack>
                      ) : (
                        <Text type="supporting" color="secondary">
                          청구서 없음
                        </Text>
                      )}
                    </td>
                    <td className={six.colReason}>
                      <VStack gap={1}>
                        {r.reasons.length > 0 && (
                          <ul className={six.reasonList}>
                            {r.reasons.map((m) => (
                              <li key={m}>
                                <Text type="supporting">{m}</Text>
                              </li>
                            ))}
                          </ul>
                        )}
                        {r.status === 'MISMATCH' && (
                          <TextInput
                            label={`${r.name} 확인 사유`}
                            isLabelHidden
                            placeholder="확인한 사유 (예: 공단 재청구 예정)"
                            value={note}
                            onChange={(v) => onNote(r.elderlyId, v.slice(0, MAX_REVIEW_NOTE))}
                            isDisabled={isDisabled}
                          />
                        )}
                        {bandOnly && note.trim() === '' && <SupportText tone="warn">구간만 다릅니다. 사유를 적어야 저장합니다(서버는 일수만 비교합니다).</SupportText>}
                      </VStack>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <HStack gap={2} wrap="wrap">
          <SupportText>한도 사용은 본인부담금 청구서의 급여비용 합계를 등급별 월 한도와 견준 값입니다. 이동서비스비용·목욕 가산 등 한도 밖 금액이 청구서에 들어 있으면 실제보다 높게 나올 수 있습니다.</SupportText>
        </HStack>
        <SupportText tone="warn">{MONTHLY_LIMIT_NOTE}</SupportText>
      </VStack>
    </Card>
  );
}
