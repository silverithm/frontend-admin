'use client';

/**
 * 입소자 수 — 그 달 출결로 급여제공일수와 일자별 입소자 합을 채우고(고칠 수 있다),
 * 미이용일 급여비용 대상 등 더한 인원과 사유를 적는다. 월 입소자 수 = 합 ÷ 급여제공일수(반올림, 고시 제47조②).
 */
import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ErrorBanner, NumField, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText, monthLabel } from '@/components/lab/labFormat';
import { useAlive } from '@/components/labRecords/recordsFormat';
import { monthlyUsers } from '@/lib/lab/staffingRules';
import { fetchAttendanceFill } from './StaffingData';
import { MAX_EXTRA_NOTE, MAX_USERS_SUM, totalSum } from './StaffingDraft';
import type { StaffingDraft } from './StaffingDraft';
import styles from './labPlans.module.css';

interface Props {
  draft: StaffingDraft;
  onChange: (patch: Partial<StaffingDraft>) => void;
  disabled: boolean;
}

export default function StaffingUsersCard({ draft, onChange, disabled }: Props) {
  const alive = useAlive();
  const notify = useNotify();
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const users = monthlyUsers(totalSum(draft), draft.serviceDays ?? 0);

  const fill = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    const month = draft.month;
    try {
      const result = await fetchAttendanceFill(month);
      if (!alive.current) return;
      if (result === null) {
        setError(`${monthLabel(month)}에는 출석 기록이 없습니다. 출결을 먼저 적었는지 확인하거나 아래 칸에 직접 적어 주세요`);
      } else {
        onChange({ serviceDays: result.serviceDays, baseSum: result.usersSum });
        notify(`출결로 채웠습니다 — 급여제공일수 ${result.serviceDays}일, 입소자 합 ${result.usersSum.toLocaleString('ko-KR')}명`, 'success');
      }
    } catch (err) {
      if (alive.current) setError(errorText(err, '출결을 불러오지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  };

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Text type="label">입소자 수</Text>
          <Button label="출결로 채우기" variant="secondary" isLoading={loading} isDisabled={disabled || loading} onClick={() => void fill()} />
        </HStack>
        {error && <ErrorBanner message={error} />}
        <div className={styles.fieldGrid}>
          <NumField label="급여제공일수 (일)" value={draft.serviceDays} onChange={(v) => onChange({ serviceDays: v })} max={31} grouped={false} placeholder="예: 22" isDisabled={disabled} />
          <NumField label="일자별 입소자 수의 합 (명)" value={draft.baseSum} onChange={(v) => onChange({ baseSum: v })} max={MAX_USERS_SUM} placeholder="예: 440" isDisabled={disabled} description="날짜마다 그날 이용한 인원을 더한 값" />
          <NumField label="더한 인원 (명)" value={draft.extraSum} onChange={(v) => onChange({ extraSum: v })} max={MAX_USERS_SUM} placeholder="없으면 비워 둠" isDisabled={disabled} description="미이용일 급여비용 대상 등" />
        </div>
        <TextInput label="더한 사유 (선택)" value={draft.extraReason} onChange={(v) => onChange({ extraReason: v.slice(0, MAX_EXTRA_NOTE - 12) })} placeholder="예: 결석했지만 급여비용을 청구한 날" isDisabled={disabled} />
        <HStack gap={4} vAlign="center" wrap="wrap">
          <Text type="label">월 입소자 수</Text>
          <span className={styles.statBox}>
            <Text type="large" hasTabularNumbers>
              {users}명
            </Text>
          </span>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {draft.serviceDays ? `합 ${totalSum(draft).toLocaleString('ko-KR')} ÷ ${draft.serviceDays}일, 소수점 첫째 자리에서 반올림` : '급여제공일수를 적으면 계산합니다'}
          </Text>
        </HStack>
        <SupportText>출결은 그날 출석한 인원을 셉니다. 고시는 하루 중 가장 많은 시간대의 인원을 세므로 시간대별 이용이 다르면 직접 고쳐 주세요. 출석이 있는 날만 급여제공일로 셉니다.</SupportText>
      </VStack>
    </Card>
  );
}
