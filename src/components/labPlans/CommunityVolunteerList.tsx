'use client';

/** 그 달 봉사 일지 목록 — 휴대폰 폭에서는 카드처럼 쌓인다. 30일 지난 VMS 미등록은 붉게. */
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { VMS_REGISTER_DAYS } from '@/lib/lab/communityRules';
import { addDays } from '@/lib/lab/programRules';
import type { VolunteerLog } from '@/lib/lab/labTypes';
import { activityLabel, minutesText } from './CommunityVolunteerDraft';
import styles from './labPlans.module.css';

interface Props {
  logs: VolunteerLog[];
  today: string;
  isBusy: boolean;
  onEdit: (log: VolunteerLog) => void;
  onDelete: (log: VolunteerLog) => void;
  onMarkVms: (log: VolunteerLog) => void;
}

/** 미등록이고 활동일 + 30일이 지났다 */
export function isVmsOverdue(log: Pick<VolunteerLog, 'activityDate' | 'vmsRegistered'>, today: string): boolean {
  if (log.vmsRegistered) return false;
  const due = addDays(log.activityDate, VMS_REGISTER_DAYS);
  return due !== null && today > due;
}

export default function CommunityVolunteerList({ logs, today, isBusy, onEdit, onDelete, onMarkVms }: Props) {
  if (logs.length === 0) {
    return (
      <Text type="supporting" color="secondary">
        이 달에 적은 봉사 일지가 없습니다. 위 양식에서 봉사 활동을 적어 보세요.
      </Text>
    );
  }
  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.table} ${styles.stackTable}`}>
        <thead>
          <tr>
            <th scope="col">날짜</th>
            <th scope="col">봉사자</th>
            <th scope="col">활동</th>
            <th scope="col">시간</th>
            <th scope="col">VMS</th>
            <th scope="col">확인자</th>
            <th scope="col">관리</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => {
            const overdue = isVmsOverdue(l, today);
            return (
              <tr key={l.id} data-tone={overdue ? 'danger' : undefined}>
                <td data-label="날짜">{dotDate(l.activityDate)}</td>
                <td data-label="봉사자" className={styles.wrap}>
                  {l.volunteerName}
                  {l.organization ? <span className={styles.mutedText}> · {l.organization}</span> : null}
                </td>
                <td data-label="활동" className={styles.wrap}>
                  {activityLabel(l.activityType)}
                  {l.content ? <div className={`${styles.mutedText} ${styles.pre}`}>{l.content}</div> : null}
                </td>
                <td data-label="시간">
                  {l.startTime}~{l.endTime} ({minutesText(l.minutes)})
                </td>
                <td data-label="VMS">
                  {l.vmsRegistered ? <Chip tone="ok" label="등록함" /> : overdue ? <Chip tone="danger" label="30일 지남" /> : <Chip tone="warn" label="미등록" />}
                </td>
                <td data-label="확인자">{l.confirmerName}</td>
                <td>
                  <HStack gap={1} wrap="wrap">
                    {!l.vmsRegistered && <Button label="VMS 등록함" size="sm" variant="secondary" isDisabled={isBusy} onClick={() => onMarkVms(l)} />}
                    <Button label="고치기" size="sm" variant="ghost" isDisabled={isBusy} onClick={() => onEdit(l)} />
                    <Button label="삭제" size="sm" variant="ghost" isDisabled={isBusy} onClick={() => onDelete(l)} />
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
