'use client';

/** "대조 필요" 안내 — 확인 안 된 급여 기준값(PAYROLL_VERIFY_NOTES)과 간이세액표 버전을 접을 수 있게 보여 준다. */
import { Card } from '@astryxdesign/core/Card';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Text } from '@astryxdesign/core/Text';
import { PAYROLL_VERIFY_NOTES } from '@/lib/lab/payrollRules';
import { WITHHOLDING_TABLE_VERSION } from '@/lib/lab/withholdingTable';
import { SupportText } from '@/components/lab/LabUi';
import styles from './labRecords.module.css';

export default function PayrollNotes() {
  const v = WITHHOLDING_TABLE_VERSION;
  return (
    <Card padding={0}>
      <Collapsible trigger={<Text type="label">대조 필요 안내 · 간이세액표 버전 ({v.appliesFrom} 적용본)</Text>} defaultIsOpen={false}>
        <div style={{ padding: 'var(--spacing-4)' }}>
          <div className={styles.stackTight}>
            <SupportText>
              이 계산은 참고용입니다. 아래는 1차 출처로 확인하지 못한 값·규칙이며, 급여 신고·납부 전에 담당자나 세무사가 대조해 주세요.
            </SupportText>
            <ul className={styles.noteList}>
              {PAYROLL_VERIFY_NOTES.map((note) => (
                <li key={note}>
                  <Text type="supporting">{note}</Text>
                </li>
              ))}
            </ul>
            <SupportText>
              간이세액표: {v.law} · 개정 {v.amended} · 적용 {v.appliesFrom} · {v.note}
            </SupportText>
          </div>
        </div>
      </Collapsible>
    </Card>
  );
}
