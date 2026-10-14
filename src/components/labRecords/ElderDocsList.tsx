'use client';

/** 어르신 목록 — 줄마다 서류 갖춤 요약(갖춤·자동·만료·없음 수). 한 분을 열면 서류별 줄이 아래에 펼쳐진다. */
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import type { ElderDocStatusRow } from '@/lib/lab/elderDocRules';
import type { ElderDocument } from '@/lib/lab/labTypes';
import { Chip } from '@/components/lab/LabUi';
import type { LabElder } from '@/components/lab/useLabElders';
import ElderDocsElder from './ElderDocsElder';
import { summarize } from './ElderDocsStatus';
import type { ElderDocsSource } from './ElderDocsStatus';
import { statusRowsOf } from './ElderDocsStatus';
import styles from './labRecords.module.css';
import own from './ElderDocs.module.css';

interface Props {
  elders: LabElder[];
  isLoading: boolean;
  source: ElderDocsSource;
  today: string;
  openId: number | null;
  onToggle: (id: number) => void;
  onChanged: () => void;
  onPrint: (elder: LabElder, rows: Array<ElderDocStatusRow<ElderDocument>>) => void;
  onlyProblems: boolean;
}

export default function ElderDocsList({ elders, isLoading, source, today, openId, onToggle, onChanged, onPrint, onlyProblems }: Props) {
  if (isLoading && elders.length === 0) return <Loading size="inline" label="서류 현황을 불러오는 중..." />;
  if (elders.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState isCompact title="등록된 어르신이 없습니다" description="어르신을 등록하면 이곳에서 서류 갖춤 현황을 볼 수 있습니다." />
      </Card>
    );
  }
  const items = elders.map((e) => {
    const rows = statusRowsOf(e.id, source, today);
    return { elder: e, rows, sum: summarize(rows, today) };
  });
  const shown = onlyProblems ? items.filter((i) => i.sum.expired + i.sum.missing + i.sum.soon > 0 || i.elder.id === openId) : items;
  if (shown.length === 0) {
    return (
      <Card padding={6}>
        <EmptyState isCompact title="서류가 빠지거나 만료된 어르신이 없습니다" description="모든 어르신의 서류가 갖춰져 있습니다. 만료가 다가오면 이곳에 다시 나옵니다." />
      </Card>
    );
  }
  return (
    <Card padding={0}>
      {shown.map(({ elder, rows, sum }) => (
        <section key={elder.id} aria-label={`${elder.name} 서류`}>
          <button type="button" className={own.elderRow} aria-expanded={openId === elder.id} onClick={() => onToggle(elder.id)}>
            <Text type="label">
              {elder.name}
              {elder.careGrade ? <span className={styles.mutedText}> · {elder.careGrade}</span> : null}
            </Text>
            <span className={styles.chips}>
              <Chip tone="ok" label={`갖춤 ${sum.ok}`} />
              <Chip tone="info" label={`자동 ${sum.auto}`} />
              {sum.expired > 0 && <Chip tone="danger" label={`만료 ${sum.expired}`} />}
              {sum.missing > 0 && <Chip tone="danger" label={`없음 ${sum.missing}`} />}
              {sum.soon > 0 && <Chip tone="warn" label={`곧 만료 ${sum.soon}`} />}
            </span>
          </button>
          {openId === elder.id && (
            <ElderDocsElder
              elderId={elder.id}
              elderName={elder.name}
              rows={rows}
              docs={source.docs.filter((d) => d.elderlyId === elder.id)}
              today={today}
              onChanged={onChanged}
              onPrint={() => onPrint(elder, rows)}
            />
          )}
        </section>
      ))}
    </Card>
  );
}
