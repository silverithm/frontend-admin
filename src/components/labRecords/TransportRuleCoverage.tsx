'use client';

/** 수칙 제공 현황 — 최근 3개월 탑승한 어르신 중 수칙을 못 받은 분(ruleDeliveryCoverage). 수칙이 바뀌면 다시 제공해야 한다. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import type { RuleDeliveryCoverage } from '@/lib/lab/transportRules';
import { Chip, SupportText } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import styles from './labRecords.module.css';
import own from './Transport.module.css';

interface Props {
  coverage: RuleDeliveryCoverage;
  names: Map<number, string>;
  revisedOn: string | null;
  from: string;
  today: string;
  onSelectMissing: () => void;
}

export default function TransportRuleCoverage({ coverage, names, revisedOn, from, today, onSelectMissing }: Props) {
  return (
    <Card padding={4}>
      <div className={styles.stackTight}>
        <div className={own.chipRow}>
          <Text type="large" weight="semibold">
            수칙 제공 현황
          </Text>
          {coverage.total === 0 ? <Chip tone="neutral" label="탑승 기록 없음" /> : coverage.missing.length === 0 ? <Chip tone="ok" label="모두 제공함" /> : <Chip tone="warn" label={`미제공 ${coverage.missing.length}명`} />}
        </div>
        <Text type="supporting" color="secondary">
          {dotDate(from)}부터 {dotDate(today)}까지 운행일지에 탑승한 어르신 {coverage.total}명 중 {coverage.delivered}명이 수칙을 받았습니다.
          {revisedOn ? ` 수칙 개정일(${dotDate(revisedOn)}) 이후에 제공한 기록만 인정합니다.` : ' 수칙 개정일이 없어 언제든 제공한 기록이 있으면 받은 것으로 봅니다.'}
        </Text>
        <SupportText>수칙이 바뀌면 다시 제공해 주세요. 개정일을 규정·지침 화면에 입력해 두면 다시 제공해야 할 분이 여기에 나타납니다.</SupportText>
        {coverage.missing.length > 0 && (
          <>
            <div className={own.chipRow}>
              {coverage.missing.map((id) => (
                <Chip key={id} tone="warn" label={names.get(id) ?? '이름 없음'} />
              ))}
            </div>
            <div>
              <Button label="미제공 어르신 선택해 기록하기" variant="secondary" size="sm" onClick={onSelectMissing} />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
