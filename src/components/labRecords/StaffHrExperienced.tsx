'use client';

/**
 * 경력직 보기 — 직원별 입사일·근속 개월·기준(24개월, 운영 2년 미만 기관은 12개월) 충족 여부와 경력직 비율(평가 4 점수 추정).
 * 평가는 공단 전산의 산정 기간(연속 근무) 기준이라 여기 값은 "지금 기준 추정"이다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { daysBetween, isValidYmd } from '@/lib/lab/labDate';
import { experiencedRatio, tenureMonths } from '@/lib/lab/staffHrRules';
import { Chip, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { dotDate, readStored, writeStored } from '@/components/lab/labFormat';
import { jobLabel } from './PayrollDraft';
import { OPENED_ON_KEY, percentText, scoreText, tenureText, toHrProfile } from './StaffHrDraft';
import { HrGuide, PendingPeople, SummaryItem } from './StaffHrShared';
import type { HrViewProps } from './StaffHrShared';
import styles from './labRecords.module.css';
import own from './StaffHr.module.css';

function storedOpenedOn(): string {
  const raw = readStored(OPENED_ON_KEY);
  return raw && isValidYmd(raw) ? raw : '';
}

export default function StaffHrExperienced({ people, today, onEditProfile }: HrViewProps) {
  const [openedOn, setOpenedOn] = useState(storedOpenedOn);
  const changeOpened = (v: string) => {
    setOpenedOn(v);
    writeStored(OPENED_ON_KEY, v);
  };
  const withProfile = useMemo(() => people.filter((p) => p.profile !== null), [people]);
  const result = useMemo(() => experiencedRatio(withProfile.map((p) => toHrProfile(p.profile!)), today, openedOn || null), [withProfile, today, openedOn]);

  const score = result.score === null ? '해당없음' : scoreText(result.score);
  const scoreNote = result.score === 0 ? '30% 미만 점수는 매뉴얼 표에 없음 — 대조 필요' : undefined;

  return (
    <div className={styles.stack}>
      <HrGuide title="경력직 기준 안내">
        <p>평가 4(경력직 비율)는 같은 기관에서 연속해 24개월 이상 근무한 직원의 비율을 봅니다. 기관 운영이 2년 미만이면 12개월을 기준으로 합니다.</p>
        <p>점수 추정: 50% 이상 1점, 30~50% 미만 0.75점. 30% 미만의 점수는 매뉴얼 표에 없어 평가 매뉴얼 원문과 대조가 필요합니다.</p>
        <p>평가는 공단 전산의 산정 기간(연속 근무) 기준입니다. 여기 값은 입사일부터 지금까지 이어 근무했다고 보고 센 지금 기준 추정이며, 재입사·휴업·제외 사유는 반영하지 않습니다.</p>
      </HrGuide>
      <PendingPeople people={people} onRegister={onEditProfile} />
      <div className={own.summaryBox}>
        <SummaryItem label="경력직 비율" value={percentText(result.ratio)} hint={`${result.eligible}명 / 근무 중 ${result.total}명`} />
        <SummaryItem label="평가 4 점수 (추정)" value={score} hint={scoreNote} />
        <SummaryItem label="근속 기준" value={`${result.threshold}개월 이상`} hint={openedOn ? '기관 개설일 기준' : '개설일을 넣지 않아 24개월'} />
      </div>
      <div className={styles.fieldGridWide}>
        <div>
          <LabDateInput label="기관 개설일 (선택)" value={openedOn} onChange={changeOpened} />
          <SupportText>운영 2년 미만 기관을 12개월 기준으로 계산할 때만 씁니다. 이 브라우저에만 기억합니다.</SupportText>
        </div>
        {openedOn !== '' && <Button label="개설일 지우기" variant="ghost" onClick={() => changeOpened('')} />}
      </div>

      {withProfile.length === 0 ? (
        <Card padding={6}>
          <EmptyState isCompact title="등록된 직원 기준이 없습니다" description="위의 직원 기준 편집에서 직원의 입사일을 등록하면 근속 개월을 계산해 드립니다." />
        </Card>
      ) : (
        <Card padding={0}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.stickyName}>이름</th>
                  <th>직종</th>
                  <th>입사일</th>
                  <th className={styles.num}>근속</th>
                  <th>{result.threshold}개월 이상</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {withProfile.map((p) => {
                  const hire = p.profile!.hireDate.slice(0, 10);
                  const upcoming = (daysBetween(hire, today) ?? 0) < 0;
                  const months = tenureMonths(hire, today);
                  return (
                    <tr key={p.memberId}>
                      <td className={styles.stickyName}>
                        <Text type="label">{p.name}</Text>
                      </td>
                      <td>{jobLabel(p.profile!.jobType)}</td>
                      <td>{dotDate(hire)}</td>
                      <td className={styles.num}>{upcoming ? '-' : tenureText(months)}</td>
                      <td>{upcoming ? <Chip tone="neutral" label="입사 예정" /> : months >= result.threshold ? <Chip tone="ok" label="충족" /> : <Chip tone="neutral" label="미달" />}</td>
                      <td>
                        <Button label="기준 고치기" variant="ghost" size="sm" onClick={() => onEditProfile(p.memberId)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
