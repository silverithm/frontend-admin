'use client';

/**
 * 건강검진 보기 — 직원별 검진 상태(정상·30일 안 만료·지남·기록 없음)·마지막 검진일·다음 기한, 검진률(평가 15 점수 추정), 검진 기록 목록.
 * 지남·임박은 위로 올려 강조한다.
 */
import { useMemo } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { daysBetween } from '@/lib/lab/labDate';
import { healthCheckRate, healthCheckStatus } from '@/lib/lab/staffHrRules';
import { Chip } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import { HEALTH_STATUS_LABEL, HEALTH_STATUS_ORDER, HEALTH_STATUS_TONE, percentText, scoreText, toHrCert, toHrProfile } from './StaffHrDraft';
import StaffHrCertList from './StaffHrCertList';
import { HrGuide, PendingPeople, SummaryItem } from './StaffHrShared';
import type { HrViewProps } from './StaffHrShared';
import styles from './labRecords.module.css';
import own from './StaffHr.module.css';

export default function StaffHrHealth({ people, certs, today, onEditProfile, onAddCert, onEditCert }: HrViewProps) {
  const hrCerts = useMemo(() => certs.map(toHrCert), [certs]);
  const withProfile = useMemo(() => people.filter((p) => p.profile !== null), [people]);
  const rows = useMemo(
    () =>
      withProfile
        .map((p) => ({ person: p, result: healthCheckStatus(toHrProfile(p.profile!), hrCerts, today) }))
        .sort((a, b) => HEALTH_STATUS_ORDER[a.result.status] - HEALTH_STATUS_ORDER[b.result.status] || a.person.name.localeCompare(b.person.name, 'ko')),
    [withProfile, hrCerts, today],
  );
  const rate = useMemo(() => healthCheckRate(withProfile.map((p) => toHrProfile(p.profile!)), hrCerts, today), [withProfile, hrCerts, today]);
  const urgent = rows.filter((r) => r.result.status !== 'OK').length;
  const scoreNote = rate.score === 0 ? '75% 미만 점수는 매뉴얼에 없음 — 대조 필요' : undefined;

  return (
    <div className={styles.stack}>
      <HrGuide title="건강검진 기준 안내">
        <p>결핵 검사를 포함해 매년 받습니다. 사무직은 2년마다입니다(산업안전보건법 시행규칙 제197조). 신규 직원은 입사 전 1년 안에 받은 결과를 근무 시작일까지 내면 됩니다.</p>
        <p>평가 15 점수 추정: 전원 충족 3점, 75% 이상 2.25점. 결과통보서에 결핵 포함 항목이 모두 있는지는 서류로 따로 확인하세요. 평가는 표본 직원으로 보므로 이 비율은 전체 직원 기준의 참고용입니다.</p>
      </HrGuide>
      <PendingPeople people={people} onRegister={onEditProfile} />
      <div className={styles.toolbar}>
        <Text type="supporting" color="secondary">
          {urgent > 0 ? `기한이 지났거나 기록이 없거나 곧 만료되는 직원 ${urgent}명` : '모든 직원이 검진 기한 안에 있습니다'}
        </Text>
        <div className={styles.spacer}>
          <Button label="검진 기록 추가" variant="primary" onClick={() => onAddCert(null)} />
        </div>
      </div>
      <div className={own.summaryBox}>
        <SummaryItem label="검진률" value={percentText(rate.rate)} hint={rate.rate === null ? '근무 중인 직원 없음' : `${rate.ok}명 / 근무 중 ${rate.total}명`} />
        <SummaryItem label="평가 15 점수 (추정)" value={scoreText(rate.score)} hint={scoreNote} />
      </div>

      {rows.length === 0 ? (
        <Card padding={6}>
          <EmptyState isCompact title="등록된 직원 기준이 없습니다" description="직원 기준에 입사일과 사무직 여부를 등록하면 검진 기한을 계산해 드립니다." />
        </Card>
      ) : (
        <Card padding={0}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.stickyName}>이름</th>
                  <th>상태</th>
                  <th>마지막 검진일</th>
                  <th>다음 기한</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ person, result }) => {
                  const left = result.dueOn ? daysBetween(today, result.dueOn) : null;
                  return (
                    <tr key={person.memberId} className={result.status === 'OVERDUE' || result.status === 'MISSING' ? own.rowDanger : result.status === 'DUE_SOON' ? own.rowWarn : undefined}>
                      <td className={styles.stickyName}>
                        <Text type="label">{person.name}</Text>{' '}
                        {person.profile!.officeWorker && (
                          <Text type="supporting" color="secondary">
                            사무직(2년)
                          </Text>
                        )}
                      </td>
                      <td>
                        <Chip tone={HEALTH_STATUS_TONE[result.status]} label={HEALTH_STATUS_LABEL[result.status]} />
                      </td>
                      <td>{result.lastOn ? dotDate(result.lastOn) : '-'}</td>
                      <td>
                        {result.dueOn ? dotDate(result.dueOn) : '-'}
                        {left !== null && left >= 0 && result.status === 'DUE_SOON' ? ` (${left}일 남음)` : ''}
                        {left !== null && left < 0 ? ` (${-left}일 지남)` : ''}
                      </td>
                      <td>
                        <span className={styles.chips} style={{ justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
                          <Button label="검진 기록" variant="ghost" size="sm" onClick={() => onAddCert(person.memberId)} />
                          <Button label="기준 고치기" variant="ghost" size="sm" onClick={() => onEditProfile(person.memberId)} />
                        </span>
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
        검진 기록
      </Text>
      <StaffHrCertList kind="HEALTH_CHECK" certs={certs} onEdit={onEditCert} onAdd={() => onAddCert(null)} />
    </div>
  );
}
