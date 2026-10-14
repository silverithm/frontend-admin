'use client';

/** 연간 봉사 요약 — 봉사자별 횟수·시간·하루 8시간 인정 한도 시간, 월별 합, VMS 미등록 건수와 30일 지난 건수. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Banner } from '@astryxdesign/core/Banner';
import { SupportText } from '@/components/lab/LabUi';
import type { VolunteerSummary } from '@/lib/lab/communityRules';
import { minutesText } from './CommunityVolunteerDraft';
import styles from './labPlans.module.css';

interface Props {
  year: number;
  summary: VolunteerSummary;
  onCertificate: (volunteerName: string) => void;
}

export default function CommunityVolunteerSummary({ year, summary, onCertificate }: Props) {
  const months = Object.keys(summary.byMonth).sort();
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Text type="label">{year}년 봉사 요약</Text>
        <div className={styles.toolbar}>
          <div className={styles.statBox}>
            <Text type="supporting" color="secondary">
              봉사자
            </Text>
            <Text type="label" hasTabularNumbers>
              {summary.byVolunteer.length}명
            </Text>
          </div>
          <div className={styles.statBox}>
            <Text type="supporting" color="secondary">
              총 봉사 시간
            </Text>
            <Text type="label" hasTabularNumbers>
              {minutesText(summary.totalMinutes)}
            </Text>
          </div>
          <div className={styles.statBox}>
            <Text type="supporting" color="secondary">
              VMS 미등록
            </Text>
            <Text type="label" hasTabularNumbers>
              {summary.vmsPending}건
            </Text>
          </div>
        </div>
        {summary.vmsOverdue > 0 && (
          <Banner status="warning" title={`VMS 등록 기한(활동일로부터 30일)이 지난 건이 ${summary.vmsOverdue}건 있습니다`} description="목록에서 붉게 표시된 건을 확인하세요. 기한이 지난 건은 활동일지로 입증하면 관할 관리본부가 판단합니다." />
        )}

        {summary.byVolunteer.length === 0 ? (
          <Text type="supporting" color="secondary">
            이 해에 적은 봉사 활동이 없습니다.
          </Text>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={`${styles.table} ${styles.stackTable}`}>
                <thead>
                  <tr>
                    <th scope="col">봉사자</th>
                    <th scope="col" className={styles.num}>
                      횟수
                    </th>
                    <th scope="col" className={styles.num}>
                      활동 시간
                    </th>
                    <th scope="col" className={styles.num}>
                      인정 시간 (하루 8시간 한도)
                    </th>
                    <th scope="col">활동 확인서</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byVolunteer.map((p) => (
                    <tr key={p.volunteerName}>
                      <td data-label="봉사자">{p.volunteerName === '' ? '(이름 없음)' : p.volunteerName}</td>
                      <td data-label="횟수" className={styles.num}>
                        {p.count}회
                      </td>
                      <td data-label="활동 시간" className={styles.num}>
                        {minutesText(p.minutes)} ({p.hours}시간)
                      </td>
                      <td data-label="인정 시간" className={styles.num}>
                        {minutesText(p.certifiableMinutes)}
                        {p.certifiableMinutes < p.minutes ? <span className={styles.warnText}> · 한도로 줄었음</span> : null}
                      </td>
                      <td>
                        <Button label="확인서 인쇄" size="sm" variant="secondary" onClick={() => onCertificate(p.volunteerName)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">월</th>
                    {months.map((m) => (
                      <th key={m} scope="col" className={styles.num}>
                        {Number(m.slice(5, 7))}월
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">봉사 시간</th>
                    {months.map((m) => (
                      <td key={m} className={styles.num}>
                        {minutesText(summary.byMonth[m])}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
        <SupportText>
          2026년 장기요양 평가에서는 자원봉사 지표가 빠졌습니다. 이 일지는 평가용이 아니라 VMS(1365) 등록과 기관 자체 관리, 봉사자에게 드리는 활동 확인서용입니다. 인정 시간의 분 단위 반올림 기준은 1365·관리본부에 확인해 주세요(대조 필요).
        </SupportText>
      </VStack>
    </Card>
  );
}
