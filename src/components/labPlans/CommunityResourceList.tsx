'use client';

/** 그 해 자원연계 목록 — 후속 확인이 지난 건은 노랗게, 휴대폰 폭에서는 카드로 쌓인다. */
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Chip } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { resourceTypeLabel } from '@/lib/lab/communityRules';
import type { ResourceLink } from '@/lib/lab/labTypes';
import styles from './labPlans.module.css';

interface Props {
  links: ResourceLink[];
  /** 후속 확인이 지난 연계의 id */
  dueIds: ReadonlySet<number>;
  isBusy: boolean;
  onEdit: (link: ResourceLink) => void;
  onDelete: (link: ResourceLink) => void;
}

export default function CommunityResourceList({ links, dueIds, isBusy, onEdit, onDelete }: Props) {
  if (links.length === 0) {
    return (
      <Text type="supporting" color="secondary">
        이 해에 적은 자원연계가 없습니다. 위 양식에서 연계한 내용을 적어 보세요.
      </Text>
    );
  }
  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.table} ${styles.stackTable}`}>
        <thead>
          <tr>
            <th scope="col">연계 날짜</th>
            <th scope="col">대상</th>
            <th scope="col">자원·기관</th>
            <th scope="col">내용·결과</th>
            <th scope="col">후속 확인</th>
            <th scope="col">관리</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => {
            const due = dueIds.has(l.id);
            return (
              <tr key={l.id} data-tone={due ? 'warn' : undefined}>
                <td data-label="연계 날짜">{dotDate(l.linkedOn)}</td>
                <td data-label="대상" className={styles.wrap}>
                  {l.elderlyId === null ? '기관 전체' : l.elderlyName ?? '(이름 없음)'}
                </td>
                <td data-label="자원·기관" className={styles.wrap}>
                  <div>{resourceTypeLabel(l.resourceType)}</div>
                  <div className={styles.mutedText}>
                    {l.institution}
                    {l.contactPerson ? ` · ${l.contactPerson}` : ''}
                  </div>
                </td>
                <td data-label="내용·결과" className={styles.wrap}>
                  <div className={styles.pre}>{l.content}</div>
                  <div className={`${styles.mutedText} ${styles.pre}`}>{l.outcome ? `결과: ${l.outcome}` : '결과 아직 없음'}</div>
                  <HStack gap={1} wrap="wrap">
                    {l.referralGiven ? <Chip tone="ok" label="보호자에게 알림" /> : <Chip tone="neutral" label="보호자 안내 전" />}
                  </HStack>
                </td>
                <td data-label="후속 확인">
                  {l.followUpOn ? dotDate(l.followUpOn) : '-'}
                  {due ? (
                    <div>
                      <Chip tone="warn" label="확인 필요" />
                    </div>
                  ) : null}
                </td>
                <td>
                  <HStack gap={1} wrap="wrap">
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
