'use client';

/**
 * 수급자 계약·인정 — 두 보기. 계약·인정(계약 표·알림·편집기)과 퇴소 연계기록지(평가 30 기준②).
 * 보기를 바꿔도 입력 중인 내용이 사라지지 않게 숨기기만 한다. 종료한 계약에서 "퇴소 연계기록지 쓰기"를 누르면 두 번째 보기로 이어진다.
 */
import { useState } from 'react';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { SupportText } from '@/components/lab/LabUi';
import { useLabElders } from '@/components/lab/useLabElders';
import ContractRecordsLab from './ContractRecordsLab';
import ContractReferralLab from './ContractReferralLab';
import type { ReferralSeed } from './ContractReferralDraft';
import styles from './labPlans.module.css';

type View = 'contract' | 'referral';

export default function ContractLab() {
  const [view, setView] = useState<View>('contract');
  const [seed, setSeed] = useState<ReferralSeed | null>(null);
  /** 계약이 바뀔 때마다 올려서 연계기록지 보기가 계약 목록을 다시 읽게 한다 */
  const [contractsVersion, setContractsVersion] = useState(0);
  const { elders, isLoading, error } = useLabElders();

  return (
    <div className={styles.stack}>
      <SegmentedControl label="보기" value={view} onChange={(v) => setView(v as View)}>
        <SegmentedControlItem value="contract" label="계약·인정" />
        <SegmentedControlItem value="referral" label="퇴소 연계기록지" />
      </SegmentedControl>
      <SupportText>계약·인정은 수급자 계약서와 장기요양 인정 유효기간, 갱신 신청 기간, 공단 통보를 관리합니다. 퇴소 연계기록지는 계약이 끝나는 수급자에게 써서 드리는 기록입니다.</SupportText>
      <div hidden={view !== 'contract'}>
        <ContractRecordsLab
          elders={elders}
          eldersLoading={isLoading}
          eldersError={error}
          onChanged={() => setContractsVersion((v) => v + 1)}
          onStartReferral={(next) => {
            setSeed((cur) => ({ ...next, key: (cur?.key ?? 0) + 1 }));
            setView('referral');
          }}
        />
      </div>
      <div hidden={view !== 'referral'}>
        <ContractReferralLab elders={elders} eldersLoading={isLoading} eldersError={error} seed={seed} contractsVersion={contractsVersion} />
      </div>
    </div>
  );
}
