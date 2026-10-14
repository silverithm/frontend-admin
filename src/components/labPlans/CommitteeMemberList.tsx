'use client';

/** 위원 명단과 현황 — 활동 위원 수(5~15명), 임기 만료 임박(60일 안)·만료 강조. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { COMMITTEE_MAX_MEMBERS, COMMITTEE_MIN_MEMBERS, committeeRoleLabel, committeeStatus } from '@/lib/lab/committeeRules';
import { daysBetween } from '@/lib/lab/labDate';
import type { CommitteeMember } from '@/lib/lab/labTypes';
import styles from './labPlans.module.css';

interface Props {
  members: CommitteeMember[];
  today: string;
  loading: boolean;
  error: string | null;
  busy: boolean;
  onRetry: () => void;
  onEdit: (m: CommitteeMember) => void;
  onDelete: (m: CommitteeMember) => void;
}

export default function CommitteeMemberList({ members, today, loading, error, busy, onRetry, onEdit, onDelete }: Props) {
  const status = committeeStatus(members, today);
  const soon = new Set(status.expiringSoon.map((m) => m.id));
  const expired = new Set(status.expired.map((m) => m.id));
  const sorted = [...members].sort((a, b) => Number(b.active) - Number(a.active) || a.termEnd.localeCompare(b.termEnd) || a.name.localeCompare(b.name, 'ko'));

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">위원 명단 ({members.length}명)</Text>
          {!loading && !error && <Chip tone={status.sizeOk ? 'ok' : 'danger'} label={`활동 위원 ${status.active}명`} />}
          {status.expiringSoon.length > 0 && <Chip tone="warn" label={`임기 만료 임박 ${status.expiringSoon.length}명`} />}
          {status.expired.length > 0 && <Chip tone="danger" label={`임기 만료 ${status.expired.length}명`} />}
        </HStack>
        {error && <ErrorBanner message={error} onRetry={onRetry} />}
        {!loading && !error && !status.sizeOk && (
          <SupportText tone="warn">
            활동 중이고 임기가 남은 위원이 {status.active}명입니다. 운영위원회는 위원장을 포함해 {COMMITTEE_MIN_MEMBERS}명 이상 {COMMITTEE_MAX_MEMBERS}명 이하로 구성합니다.
          </SupportText>
        )}
        {status.expired.length > 0 && <SupportText tone="warn">임기가 끝났는데 활동 중으로 남은 위원이 있습니다. 재위촉하면 임기를 새로 고치고, 아니면 ‘활동 중’을 해제해 주세요.</SupportText>}
        {loading && members.length === 0 ? (
          <Loading size="section" label="위원 명단을 불러오는 중..." />
        ) : members.length === 0 && !error ? (
          <Text type="supporting" color="secondary">등록된 위원이 없습니다. 위 양식에서 위원을 추가해 주세요.</Text>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>역할</th>
                  <th>임기</th>
                  <th>상태</th>
                  <th aria-label="작업" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((m) => {
                  const left = daysBetween(today, m.termEnd);
                  const isExpired = expired.has(m.id);
                  const tone = isExpired ? 'danger' : soon.has(m.id) ? 'warn' : undefined;
                  return (
                    <tr key={m.id} data-tone={tone}>
                      <td>{m.name}</td>
                      <td>{committeeRoleLabel(m.role)}</td>
                      <td className={styles.num}>
                        {dotDate(m.termStart)} ~ {dotDate(m.termEnd)}
                      </td>
                      <td>
                        {!m.active ? (
                          <Chip tone="neutral" label="활동 안 함" />
                        ) : isExpired ? (
                          <Chip tone="danger" label="임기 만료" />
                        ) : soon.has(m.id) ? (
                          <Chip tone="warn" label={left === 0 ? '오늘 만료' : `${left}일 뒤 만료`} />
                        ) : (
                          <Chip tone="ok" label="활동 중" />
                        )}
                      </td>
                      <td>
                        <HStack gap={1} wrap="nowrap">
                          <Button label="고치기" variant="ghost" isDisabled={busy} onClick={() => onEdit(m)} />
                          <Button label="삭제" variant="ghost" isDisabled={busy} onClick={() => onDelete(m)} />
                        </HStack>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </VStack>
    </Card>
  );
}
