'use client';

/** 지난 대조 결과 — 그 달 저장한 줄을 다시 본다. 단추로 펼치고 접는다. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner } from '@/components/lab/LabUi';
import { monthLabel } from '@/components/lab/labFormat';
import type { ClaimReview } from '@/lib/lab/labTypes';
import { bandShort } from './ClaimCheckFormat';
import styles from './labPlans.module.css';
import six from './labPlans6.module.css';

interface Props {
  month: string;
  reviews: ClaimReview[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
}

const TONE = { MATCH: 'ok', RESOLVED: 'info', MISMATCH: 'danger' } as const;
const LABEL = { MATCH: '일치', RESOLVED: '확인함', MISMATCH: '차이' } as const;

export default function ClaimCheckHistory({ month, reviews, loading, error, onReload }: Props) {
  const [open, setOpen] = useState(false);
  const sorted = [...reviews].sort((a, b) => a.elderlyName.localeCompare(b.elderlyName, 'ko'));
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">지난 대조 결과 ({monthLabel(month)})</Text>
          {!loading && !error && <Chip tone="neutral" label={`${reviews.length}명`} />}
          <Button label={open ? '접기' : '지난 대조 결과 보기'} size="sm" variant="secondary" onClick={() => setOpen((v) => !v)} />
        </HStack>
        {open && (
          <>
            {error && <ErrorBanner message={error} onRetry={onReload} />}
            {loading ? (
              <Loading size="section" label="지난 대조 결과를 불러오는 중..." />
            ) : !error && sorted.length === 0 ? (
              <Text type="supporting" color="secondary">
                이 달에 저장한 대조 결과가 없습니다.
              </Text>
            ) : (
              !error && (
                <div className={styles.tableScroll}>
                  <table className={six.wideTable} style={{ minWidth: 760 }}>
                    <thead>
                      <tr>
                        <th scope="col">어르신</th>
                        <th scope="col">청구</th>
                        <th scope="col">출석</th>
                        <th scope="col">청구서</th>
                        <th scope="col">청구 구간</th>
                        <th scope="col">상태</th>
                        <th scope="col">확인 사유</th>
                        <th scope="col">확인자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r) => (
                        <tr key={r.id} data-tone={r.status === 'MISMATCH' ? 'danger' : undefined}>
                          <td className={six.colName}>{r.elderlyName}</td>
                          <td className={styles.num}>{r.claimedDays}일</td>
                          <td className={styles.num}>{r.attendedDays}일</td>
                          <td className={styles.num}>{r.billedDays === null ? '-' : `${r.billedDays}일`}</td>
                          <td>{bandShort(r.claimedBand)}</td>
                          <td>
                            <Chip tone={TONE[r.status]} label={LABEL[r.status]} />
                          </td>
                          <td className={six.colReason}>{r.note ?? ''}</td>
                          <td>{r.reviewerName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </>
        )}
      </VStack>
    </Card>
  );
}
