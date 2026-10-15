'use client';

/**
 * 보수교육 보기 — 연도를 고르고 요양보호사별 보수교육 상태·그 해 이수 시간, 이수율(평가 5 점수 추정), 이수 기록 목록.
 * 매 2년 8시간 이상, 출생연도 홀짝으로 대상 연도가 갈린다. 출생연도 숫자는 표에 보이지 않고 홀·짝만 보인다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { CONTINUING_EDU_MIN_HOURS, continuingEduRate, continuingEduStatus } from '@/lib/lab/staffHrRules';
import { Chip } from '@/components/lab/LabUi';
import { yearOf } from './recordsFormat';
import { YearStepper } from './RecordsUi';
import { EDU_STATUS_LABEL, EDU_STATUS_TONE, percentText, scoreText, toHrCert, toHrProfile } from './StaffHrDraft';
import StaffHrCertList from './StaffHrCertList';
import { HrGuide, PendingPeople, SummaryItem } from './StaffHrShared';
import type { HrViewProps } from './StaffHrShared';
import styles from './labRecords.module.css';
import own from './StaffHr.module.css';

export default function StaffHrEdu({ people, certs, today, onEditProfile, onAddCert, onEditCert }: HrViewProps) {
  const thisYear = yearOf(today);
  const [year, setYear] = useState(thisYear);
  const hrCerts = useMemo(() => certs.map(toHrCert), [certs]);
  const caregivers = useMemo(() => people.filter((p) => p.profile?.jobType === 'CAREGIVER'), [people]);
  const rows = useMemo(
    () => caregivers.map((p) => ({ person: p, result: continuingEduStatus(toHrProfile(p.profile!), hrCerts, year, today) })),
    [caregivers, hrCerts, year, today],
  );
  const rate = useMemo(() => continuingEduRate(caregivers.map((p) => toHrProfile(p.profile!)), hrCerts, year, today), [caregivers, hrCerts, year, today]);
  const scoreNote = rate.score === 0 ? '75% 미만 점수는 매뉴얼에 없음 — 대조 필요' : undefined;
  // 올해는 아직 기한(연말) 전인 대상자가 있다 — 지금 이수율이 낮아도 미이수가 아니다
  const dueCount = rows.filter((r) => r.result.status === 'DUE').length;

  return (
    <div className={styles.stack}>
      <HrGuide title="보수교육 기준 안내">
        <p>요양보호사는 매 2년마다 8시간 이상 보수교육을 받아야 합니다. 출생연도의 홀짝이 그 해와 같으면 대상 연도입니다(2025년은 홀수년생). 자격시험 합격 후 2년이 지나지 않았으면 면제입니다. (노인장기요양보험법 제23조②, 시행규칙 제11조의3·4)</p>
        <p>평가 5 점수 추정: 이수율 95% 이상 1점, 75% 이상 0.75점, 대상자가 없으면 해당없음입니다. 이 화면의 상태는 직원 기준과 이수 기록으로 센 추정이며, 운영지침 원문과 대조가 필요합니다.</p>
      </HrGuide>
      <PendingPeople people={people} onRegister={onEditProfile} />
      <div className={styles.toolbar}>
        <YearStepper value={year} onChange={setYear} max={thisYear} />
        <div className={styles.spacer}>
          <Button label="이수 기록 추가" variant="primary" onClick={() => onAddCert(null)} />
        </div>
      </div>
      <div className={own.summaryBox}>
        <SummaryItem label={`${year}년 이수율`} value={percentText(rate.rate)} hint={rate.rate === null ? '대상 요양보호사 없음' : `${rate.done}명 / 대상 ${rate.required}명${dueCount > 0 ? ` · 진행 중 ${dueCount}명은 연말까지 이수하면 됩니다` : ''}`} />
        <SummaryItem label="평가 5 점수 (추정)" value={scoreText(rate.score)} hint={scoreNote} />
      </div>

      {rows.length === 0 ? (
        <Card padding={6}>
          <EmptyState isCompact title="직종이 요양보호사인 직원 기준이 없습니다" description="직원 기준을 등록하면 보수교육 대상 여부와 이수 시간을 보여 드립니다." />
        </Card>
      ) : (
        <Card padding={0}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.stickyName}>이름</th>
                  <th>{year}년 상태</th>
                  <th className={styles.num}>이수 시간</th>
                  <th>대상 연도</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ person, result }) => {
                  const birth = person.profile!.birthYear;
                  return (
                    <tr key={person.memberId} className={result.status === 'MISSED' ? own.rowDanger : result.status === 'UNKNOWN' || result.status === 'DUE' ? own.rowWarn : undefined}>
                      <td className={styles.stickyName}>
                        <Text type="label">{person.name}</Text>
                      </td>
                      <td>
                        <Chip tone={EDU_STATUS_TONE[result.status]} label={EDU_STATUS_LABEL[result.status]} />
                      </td>
                      <td className={styles.num}>
                        {result.status === 'DONE' || result.status === 'DUE' || result.status === 'MISSED' ? `${result.hours}시간 / ${CONTINUING_EDU_MIN_HOURS}시간` : `${result.hours}시간`}
                      </td>
                      <td>{birth === null ? '출생연도를 등록해 주세요' : birth % 2 === 1 ? '홀수년생(홀수 해)' : '짝수년생(짝수 해)'}</td>
                      <td>
                        <HStackButtons onRecord={() => onAddCert(person.memberId)} onProfile={() => onEditProfile(person.memberId)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Text type="large" weight="semibold">
        {year}년 이수 기록
      </Text>
      <StaffHrCertList kind="CONTINUING_EDU" certs={certs} year={year} onEdit={onEditCert} onAdd={() => onAddCert(null)} />
    </div>
  );
}

function HStackButtons({ onRecord, onProfile }: { onRecord: () => void; onProfile: () => void }) {
  return (
    <span className={styles.chips} style={{ justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
      <Button label="이수 기록" variant="ghost" size="sm" onClick={onRecord} />
      <Button label="기준 고치기" variant="ghost" size="sm" onClick={onProfile} />
    </span>
  );
}
