'use client';

/** 올해 퇴소 연계기록지 목록 — 요건 칩과 요약, 작성 안 한 종료 계약. 휴대폰 폭에서는 카드처럼 쌓인다. */
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { dischargeReasonLabel, referralCompliance } from '@/lib/lab/dischargeRules';
import type { DischargeReferral } from '@/lib/lab/labTypes';
import { gradeText } from './ContractFormat';
import styles from './labPlans.module.css';
import six from './labPlans6.module.css';

interface Props {
  referrals: DischargeReferral[];
  isBusy: boolean;
  onEdit: (r: DischargeReferral) => void;
  onDelete: (r: DischargeReferral) => void;
  onPrint: (r: DischargeReferral) => void;
}

const SHORT: Record<string, string> = { FIELDS: '항목', WRITTEN_BY_DISCHARGE: '작성 기한', PROVIDED: '제공대장', PROVIDED_BY_DISCHARGE: '제공 기한' };

export default function ContractReferralList({ referrals, isBusy, onEdit, onDelete, onPrint }: Props) {
  if (referrals.length === 0) {
    return (
      <Text type="supporting" color="secondary">
        이 해에 적은 퇴소 연계기록지가 없습니다. 퇴소한 수급자가 없다면 평가 기준②는 충족으로 봅니다.
      </Text>
    );
  }
  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.table} ${styles.stackTable}`}>
        <thead>
          <tr>
            <th scope="col">퇴소일</th>
            <th scope="col">어르신</th>
            <th scope="col">사유</th>
            <th scope="col">평가 확인</th>
            <th scope="col">관리</th>
          </tr>
        </thead>
        <tbody>
          {referrals.map((r) => {
            const items = referralCompliance(r);
            const allOk = items.every((i) => i.ok);
            return (
              <tr key={r.id} data-tone={allOk ? undefined : items.some((i) => i.code === 'FIELDS' && !i.ok) ? 'danger' : 'warn'}>
                <td data-label="퇴소일">{dotDate(r.dischargeOn)}</td>
                <td data-label="어르신" className={styles.wrap}>
                  {r.elderlyName}
                  <div className={styles.mutedText}>{gradeText(r.careGrade)}</div>
                </td>
                <td data-label="사유" className={styles.wrap}>
                  {dischargeReasonLabel(r.reason)}
                </td>
                <td data-label="평가 확인" className={styles.wrap}>
                  <HStack gap={1} wrap="wrap">
                    {items.map((i) => (
                      <Chip key={i.code} tone={i.ok ? 'ok' : 'warn'} label={`${SHORT[i.code]} ${i.ok ? '충족' : '확인'}`} />
                    ))}
                  </HStack>
                </td>
                <td>
                  <HStack gap={1} wrap="wrap">
                    <Button label="고치기" size="sm" variant="secondary" isDisabled={isBusy} onClick={() => onEdit(r)} />
                    <Button label="연계기록지 인쇄" size="sm" variant="ghost" isDisabled={isBusy} onClick={() => onPrint(r)} />
                    <Button label="삭제" size="sm" variant="ghost" isDisabled={isBusy} onClick={() => onDelete(r)} />
                  </HStack>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface MissingProps {
  items: Array<{ contractId: number; elderlyId: number; name: string; endedOn: string; reasonLabel: string }>;
  isBusy: boolean;
  onWrite: (contractId: number) => void;
}

/** 종료한 계약 중 연계기록지가 아직 없는 것 */
export function ContractReferralMissing({ items, isBusy, onWrite }: MissingProps) {
  if (items.length === 0) return null;
  return (
    <VStack gap={2}>
      <Text type="label">연계기록지를 아직 안 쓴 종료 계약 ({items.length}건)</Text>
      <ul className={six.plainList}>
        {items.map((m) => (
          <li key={m.contractId} className={styles.rowCard}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Text type="body">{m.name}</Text>
              <Text type="supporting" color="secondary" hasTabularNumbers>
                {dotDate(m.endedOn)} 종료 · {m.reasonLabel}
              </Text>
              <Button label="쓰기" size="sm" variant="secondary" isDisabled={isBusy} onClick={() => onWrite(m.contractId)} />
            </HStack>
          </li>
        ))}
      </ul>
    </VStack>
  );
}
