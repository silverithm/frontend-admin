'use client';

/** 직원별 근속·보수교육·건강검진 현황표 A4 인쇄본 — 화면에서는 보이지 않고, 그려지면 인쇄 창을 연다. 끝나거나 취소하면 onDone. 출생연도는 싣지 않는다. */
import { useEffect, useMemo } from 'react';
import { continuingEduRate, continuingEduStatus, experiencedRatio, healthCheckRate, healthCheckStatus, tenureMonths } from '@/lib/lab/staffHrRules';
import type { StaffCert } from '@/lib/lab/labTypes';
import { companyNameStored, dotDate } from '@/components/lab/labFormat';
import { jobLabel } from './PayrollDraft';
import { EDU_STATUS_LABEL, HEALTH_STATUS_LABEL, percentText, scoreText, tenureText, toHrCert, toHrProfile } from './StaffHrDraft';
import type { HrPerson } from './StaffHrDraft';
import RecordsPrintPortal from './RecordsPrint';
import { yearOf, useLatest } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './StaffHr.module.css';

interface Props {
  people: HrPerson[];
  certs: StaffCert[];
  today: string;
  /** 기관 개설일(없으면 빈 글자) */
  openedOn: string;
  onDone: () => void;
}

export default function StaffHrSheet({ people, certs, today, openedOn, onDone }: Props) {
  const done = useLatest(onDone);
  useEffect(() => {
    const finish = () => done.current();
    window.addEventListener('afterprint', finish);
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
    };
  }, [done]);

  const year = yearOf(today);
  const data = useMemo(() => {
    const withProfile = people.filter((p) => p.profile !== null);
    const profiles = withProfile.map((p) => toHrProfile(p.profile!));
    const hrCerts = certs.map(toHrCert);
    return {
      rows: withProfile.map((p) => {
        const hp = toHrProfile(p.profile!);
        return { person: p, hp, edu: continuingEduStatus(hp, hrCerts, year, today), health: healthCheckStatus(hp, hrCerts, today) };
      }),
      exp: experiencedRatio(profiles, today, openedOn || null),
      edu: continuingEduRate(profiles, hrCerts, year, today),
      health: healthCheckRate(profiles, hrCerts, today),
    };
  }, [people, certs, today, year, openedOn]);
  const company = companyNameStored();

  return (
    <RecordsPrintPortal landscape>
      <h1 className={styles.printTitle}>직원 인사 현황표</h1>
      <div className={styles.printMeta}>
        {company && <span>기관: {company}</span>}
        <span>기준일: {dotDate(today)}</span>
      </div>
      <div className={own.sheetSummary}>
        <span>
          경력직 비율({data.exp.threshold}개월 이상): {percentText(data.exp.ratio)} ({data.exp.eligible}/{data.exp.total}명, 평가 4 {scoreText(data.exp.score)} 추정)
        </span>
        <span>
          {year}년 보수교육 이수율: {percentText(data.edu.rate)} (평가 5 {scoreText(data.edu.score)} 추정)
        </span>
        <span>
          건강검진률: {percentText(data.health.rate)} (평가 15 {scoreText(data.health.score)} 추정)
        </span>
      </div>
      <table className={own.sheetTable}>
        <thead>
          <tr>
            <th>이름</th>
            <th>직종</th>
            <th>입사일</th>
            <th>근속</th>
            <th>{year}년 보수교육</th>
            <th>건강검진 상태</th>
            <th>마지막 검진일</th>
            <th>다음 기한</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map(({ person, hp, edu, health }) => (
            <tr key={person.memberId}>
              <td>{person.name}</td>
              <td>{jobLabel(hp.jobType)}</td>
              <td>{dotDate(hp.hireDate)}</td>
              <td>{tenureText(tenureMonths(hp.hireDate, today))}</td>
              <td>{edu.status === 'NOT_REQUIRED' ? '-' : `${EDU_STATUS_LABEL[edu.status]} (${edu.hours}시간)`}</td>
              <td>{HEALTH_STATUS_LABEL[health.status]}</td>
              <td>{health.lastOn ? dotDate(health.lastOn) : '-'}</td>
              <td>{health.dueOn ? dotDate(health.dueOn) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.printNote}>
        직원 기준과 이수·검진 기록으로 센 지금 기준 추정입니다. 평가 4·5는 공단 전산의 산정 기간·이수내역이 기준이므로 운영지침 원문과 대조가 필요합니다. 출력일 {dotDate(today)}
      </p>
    </RecordsPrintPortal>
  );
}
