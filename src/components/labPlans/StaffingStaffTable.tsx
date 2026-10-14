'use client';

/**
 * 직원별 근무시간 표 — 급여 기준(직종·이름·주 소정시간)에서 채우고, 직원을 더하고 빼고, 직종·시간을 고친다.
 * 근무시간은 그 달 실근무시간이다. 휴가·결근을 반영해 고치고, 연차유급휴가는 근무시간으로 인정한다(고시 제51조④).
 */
import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ErrorBanner, SupportText, useNotify } from '@/components/lab/LabUi';
import { errorText } from '@/components/lab/labFormat';
import { sanitizeDecimal, useAlive } from '@/components/labRecords/recordsFormat';
import { listPayrollProfiles } from '@/lib/lab/labApi';
import type { PayrollJobType, StaffJobType } from '@/lib/lab/labTypes';
import { STAFF_JOB_TYPES, prefillHours } from '@/lib/lab/staffingRules';
import { MAX_STAFF, MAX_STAFF_NAME, newRowKey } from './StaffingDraft';
import type { StaffDraftRow } from './StaffingDraft';
import styles from './labPlans.module.css';
import eight from './labPlans8.module.css';

interface Props {
  staff: StaffDraftRow[];
  standardHours: number;
  onChange: (staff: StaffDraftRow[]) => void;
  disabled: boolean;
}

/** 급여 기준의 직종을 배치 직종으로. 영양사·위생원은 배치 기준에 세지 않는다 */
const toStaffJob = (j: PayrollJobType): StaffJobType => (j === 'NUTRITIONIST' || j === 'SANITATION' ? 'OTHER' : j);

export default function StaffingStaffTable({ staff, standardHours, onChange, disabled }: Props) {
  const alive = useAlive();
  const notify = useNotify();
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (key: string, p: Partial<StaffDraftRow>) => onChange(staff.map((s) => (s.key === key ? { ...s, ...p } : s)));

  const fill = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const profiles = await listPayrollProfiles();
      if (!alive.current) return;
      if (profiles.length === 0) {
        setError('급여 기준에 등록된 직원이 없습니다. 급여 화면에서 직원 급여 기준을 먼저 등록하거나 아래에서 직접 더해 주세요');
        return;
      }
      const byMember = new Map(profiles.map((p) => [p.memberId, p]));
      const seen = new Set<number>();
      const next = staff.map((s) => {
        const p = s.memberId !== null ? byMember.get(s.memberId) : undefined;
        if (!p) return s;
        seen.add(p.memberId);
        return { ...s, name: p.memberName ?? s.name, jobType: toStaffJob(p.jobType), hoursText: String(prefillHours(p.weeklyHours, standardHours)) };
      });
      let added = 0;
      for (const p of profiles) {
        if (seen.has(p.memberId) || next.length >= MAX_STAFF) continue;
        next.push({ key: newRowKey(), memberId: p.memberId, name: (p.memberName ?? '이름 없음').slice(0, MAX_STAFF_NAME), jobType: toStaffJob(p.jobType), hoursText: String(prefillHours(p.weeklyHours, standardHours)) });
        added += 1;
      }
      onChange(next);
      notify(`급여 기준에서 채웠습니다 — 직원 ${profiles.length}명 (새로 ${added}명)`, 'success');
    } catch (err) {
      if (alive.current) setError(errorText(err, '급여 기준을 불러오지 못했습니다'));
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  };

  const add = () => {
    if (staff.length >= MAX_STAFF) return;
    onChange([...staff, { key: newRowKey(), memberId: null, name: '', jobType: 'CAREGIVER', hoursText: String(standardHours) }]);
  };

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Text type="label">직원별 근무시간 ({staff.length}명)</Text>
          <Button label="급여 기준에서 채우기" variant="secondary" isLoading={loading} isDisabled={disabled || loading} onClick={() => void fill()} />
          <Button label="직원 추가" variant="ghost" isDisabled={disabled || staff.length >= MAX_STAFF} onClick={add} />
        </HStack>
        {error && <ErrorBanner message={error} />}
        {staff.length === 0 ? (
          <Text type="supporting" color="secondary">
            아직 직원이 없습니다. ‘급여 기준에서 채우기’를 누르면 직원 급여 기준의 직종·이름·주 소정시간으로 이 달 근무시간(월 기준 {standardHours}시간 × 주 소정시간 ÷ 40)을 채웁니다.
          </Text>
        ) : (
          <div className={styles.tableScroll}>
            <table className={eight.staffTable}>
              <thead>
                <tr>
                  <th className={eight.colName}>이름</th>
                  <th className={eight.colJob}>직종</th>
                  <th className={eight.colHours}>근무시간 (시간)</th>
                  <th>월 기준 대비</th>
                  <th aria-label="삭제" />
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const h = s.hoursText.trim() === '' ? null : Number(s.hoursText);
                  const pct = h !== null && Number.isFinite(h) && standardHours > 0 ? Math.round((h / standardHours) * 100) : null;
                  return (
                    <tr key={s.key}>
                      <td>
                        <TextInput label="이름" isLabelHidden value={s.name} onChange={(v) => patch(s.key, { name: v.slice(0, MAX_STAFF_NAME) })} placeholder="직원 이름" isDisabled={disabled} />
                      </td>
                      <td>
                        <Selector
                          label="직종"
                          isLabelHidden
                          placeholder="직종 고르기"
                          options={STAFF_JOB_TYPES as unknown as Array<{ value: string; label: string }>}
                          value={s.jobType}
                          onChange={(v) => v && patch(s.key, { jobType: v as StaffJobType })}
                          isDisabled={disabled}
                        />
                      </td>
                      <td>
                        <TextInput label="근무시간" isLabelHidden value={s.hoursText} onChange={(v) => patch(s.key, { hoursText: sanitizeDecimal(v, 1) })} placeholder="예: 176" isDisabled={disabled} />
                      </td>
                      <td className={styles.num}>{pct === null ? '-' : `${pct}%`}</td>
                      <td>
                        <Button label="삭제" variant="ghost" isDisabled={disabled} onClick={() => onChange(staff.filter((x) => x.key !== s.key))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <SupportText>
          근무시간은 그 달 실제로 일한 시간입니다. 휴가·결근이 있으면 줄여서 고쳐 주세요. 연차유급휴가는 근무한 시간으로 인정하니 줄이지 않습니다. ‘기타’ 직종은 배치 기준에 세지 않습니다.
        </SupportText>
      </VStack>
    </Card>
  );
}
