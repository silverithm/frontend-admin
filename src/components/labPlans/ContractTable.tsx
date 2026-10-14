'use client';

/** 계약 표 — 어르신·등급·유효기간·갱신 신청 창·감경 구분·월 계약 일수·서명/교부/통보 칩. 휴대폰 폭에서는 카드처럼 쌓인다. */
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { missedDayEligible, renewalWindow } from '@/lib/lab/contractRules';
import type { ContractAlert } from '@/lib/lab/contractRules';
import type { ElderContract } from '@/lib/lab/labTypes';
import { ALERT_TONE, copayText, endReasonLabel, gradeText } from './ContractFormat';
import styles from './labPlans.module.css';

interface Props {
  contracts: ElderContract[];
  alerts: ContractAlert[];
  today: string;
  isBusy: boolean;
  emptyText: string;
  onEdit: (c: ElderContract) => void;
  onDelete: (c: ElderContract) => void;
}

function stateChips(c: ElderContract) {
  return (
    <HStack gap={1} wrap="wrap">
      {c.signedOn ? <Chip tone="ok" label="서명함" /> : <Chip tone="warn" label="서명 전" />}
      {c.signedOn && (c.copyGiven ? <Chip tone="ok" label="교부함" /> : <Chip tone="warn" label="교부 전" />)}
      {c.signedOn && (c.contractNotifiedOn ? <Chip tone="ok" label="통보함" /> : <Chip tone="warn" label="통보 전" />)}
      {c.planNotifiedOn ? <Chip tone="ok" label="계획 통보함" /> : <Chip tone="neutral" label="계획 통보 없음" />}
    </HStack>
  );
}

export default function ContractTable({ contracts, alerts, today, isBusy, emptyText, onEdit, onDelete }: Props) {
  if (contracts.length === 0) {
    return (
      <Text type="supporting" color="secondary">
        {emptyText}
      </Text>
    );
  }
  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.table} ${styles.stackTable}`}>
        <thead>
          <tr>
            <th scope="col">어르신</th>
            <th scope="col">등급</th>
            <th scope="col">인정 유효기간</th>
            <th scope="col">갱신 신청 창</th>
            <th scope="col">감경 구분</th>
            <th scope="col">월 계약 일수</th>
            <th scope="col">계약서</th>
            <th scope="col">관리</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => {
            const window = renewalWindow(c.validTo);
            const worst = alerts.find((a) => a.contractId === c.id);
            const inWindow = window !== null && c.status === 'ACTIVE' && today >= window.opensOn && today <= window.closesOn;
            return (
              <tr key={c.id} data-tone={worst?.level === 'DANGER' ? 'danger' : worst?.level === 'WARN' ? 'warn' : undefined}>
                <td data-label="어르신" className={styles.wrap}>
                  {c.elderlyName}
                  <div className={styles.mutedText}>
                    <Text type="supporting" color="secondary" hasTabularNumbers>
                      {dotDate(c.contractStart)} ~ {c.contractEnd ? dotDate(c.contractEnd) : ''}
                      {c.status === 'ENDED' && c.endReason ? ` (${endReasonLabel(c.endReason)})` : ''}
                    </Text>
                  </div>
                </td>
                <td data-label="등급">{gradeText(c.careGrade)}</td>
                <td data-label="인정 유효기간">
                  {dotDate(c.validFrom)} ~ {dotDate(c.validTo)}
                  <div className={styles.mutedText}>{c.renewalCount >= 1 ? `갱신 ${c.renewalCount}회` : '최초 인정'}</div>
                </td>
                <td data-label="갱신 신청 창">
                  {window ? (
                    <>
                      {dotDate(window.opensOn)} ~ {dotDate(window.closesOn)}
                      {inWindow && (
                        <div>
                          <Chip tone={ALERT_TONE.WARN} label="신청 기간" />
                        </div>
                      )}
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                <td data-label="감경 구분" className={styles.wrap}>
                  {copayText(c.copayClass)}
                </td>
                <td data-label="월 계약 일수">
                  {c.plannedDaysPerMonth === null ? '-' : `${c.plannedDaysPerMonth}일`}
                  {missedDayEligible(c) && (
                    <div>
                      <Chip tone="info" label="미이용일 대상" />
                    </div>
                  )}
                </td>
                <td data-label="계약서" className={styles.wrap}>
                  {stateChips(c)}
                </td>
                <td>
                  <HStack gap={1} wrap="wrap">
                    <Button label="고치기" size="sm" variant="secondary" isDisabled={isBusy} onClick={() => onEdit(c)} />
                    <Button label="삭제" size="sm" variant="ghost" isDisabled={isBusy} onClick={() => onDelete(c)} />
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
