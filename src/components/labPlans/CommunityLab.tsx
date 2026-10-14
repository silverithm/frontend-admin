'use client';

/**
 * 봉사·자원연계 — 두 보기. 봉사 일지(봉사자 활동, VMS 등록, 활동 확인서)와 외부기관·자원 연계(어르신 욕구 → 자원 종류 제안, 후속 확인).
 * 보기를 바꿔도 입력 중인 내용이 사라지지 않게 숨기기만 한다.
 */
import { useState } from 'react';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { SupportText } from '@/components/lab/LabUi';
import CommunityResourceLab from './CommunityResourceLab';
import CommunityVolunteerLab from './CommunityVolunteerLab';
import styles from './labPlans.module.css';

type View = 'volunteer' | 'resource';

export default function CommunityLab() {
  const [view, setView] = useState<View>('volunteer');
  return (
    <div className={styles.stack}>
      <SegmentedControl label="보기" value={view} onChange={(v) => setView(v as View)}>
        <SegmentedControlItem value="volunteer" label="봉사 일지" />
        <SegmentedControlItem value="resource" label="외부기관·자원 연계" />
      </SegmentedControl>
      <SupportText>봉사 일지는 VMS(1365) 등록과 활동 확인서용 기관 기록입니다. 외부기관 연계는 어르신별 진료 동행 기록·후속 확인·보호자 안내를 관리합니다.</SupportText>
      <div hidden={view !== 'volunteer'}>
        <CommunityVolunteerLab />
      </div>
      <div hidden={view !== 'resource'}>
        <CommunityResourceLab />
      </div>
    </div>
  );
}
