'use client';

/** "대조 필요" 안내 — 계정표 출처와 확인 안 된 장부 규칙(LEDGER_VERIFY_NOTES)을 접을 수 있게 보여 준다. */
import { Card } from '@astryxdesign/core/Card';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Text } from '@astryxdesign/core/Text';
import { SupportText } from '@/components/lab/LabUi';
import { LEDGER_VERIFY_NOTES } from '@/lib/lab/ledgerRules';
import styles from './labRecords.module.css';

export default function LedgerNotes() {
  return (
    <Card padding={0}>
      <Collapsible trigger={<Text type="label">대조 필요 안내 · 계정 과목 출처</Text>} defaultIsOpen={false}>
        <div style={{ padding: 'var(--spacing-4)' }}>
          <div className={styles.stackTight}>
            <SupportText>이 장부는 참고용입니다. 결산서를 내기 전에 담당자나 세무사가 과목과 금액을 대조해 주세요.</SupportText>
            <ul className={styles.noteList}>
              {LEDGER_VERIFY_NOTES.map((note) => (
                <li key={note}>
                  <Text type="supporting">{note}</Text>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Collapsible>
    </Card>
  );
}
