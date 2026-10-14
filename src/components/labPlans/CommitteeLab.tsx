'use client';

/**
 * 운영위원회 — 두 보기. ① 위원 명단(역할·임기·활동 여부, 5~15명·임기 3년·만료 임박), ② 회의(올해 현황·목록·회의록 편집·AI 정리·A4 인쇄).
 * 두 보기를 함께 그려 두고 하나만 보여 주므로, 보기를 바꿔도 적던 내용이 남는다.
 */
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { useState } from 'react';
import { todayString } from '@/components/lab/labFormat';
import { useCommitteeMembers } from './CommitteeData';
import CommitteeMeetingsPanel from './CommitteeMeetingsPanel';
import CommitteeMembersPanel from './CommitteeMembersPanel';
import { CommitteeIntro, CommitteeVerify } from './CommitteeNotes';
import styles from './labPlans.module.css';

type View = 'members' | 'meetings';

export default function CommitteeLab() {
  const today = todayString();
  const [view, setView] = useState<View>('members');
  const { members, loading, error, reload } = useCommitteeMembers();

  return (
    <div className={styles.stack}>
      <SegmentedControl value={view} onChange={(v) => setView(v as View)} label="운영위원회 보기" layout="fill">
        <SegmentedControlItem value="members" label="위원 명단" />
        <SegmentedControlItem value="meetings" label="회의" />
      </SegmentedControl>
      <CommitteeIntro />
      <div hidden={view !== 'members'}>
        <CommitteeMembersPanel members={members} loading={loading} error={error} today={today} onReload={reload} />
      </div>
      <div hidden={view !== 'meetings'}>
        <CommitteeMeetingsPanel members={members} today={today} />
      </div>
      <CommitteeVerify />
    </div>
  );
}
