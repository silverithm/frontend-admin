'use client';

/** 기준 ③ 분기 복지, ④ 고충처리, ⑤ 퇴직금. */
import { Text } from '@astryxdesign/core/Text';
import { Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { POLICY_ITEMS } from '@/lib/lab/policyDocRules';
import { welfareQuarters } from '@/lib/lab/welfareRules';
import type { GrievanceSummary, PolicyDoc, StaffWelfare } from '@/lib/lab/labTypes';
import { quarterName } from './StaffWelfareFormat';
import StaffWelfareCard from './StaffWelfareCard';
import styles from './StaffWelfare.module.css';

export function QuarterCard({ entries, today, loading, error, onRetry }: { entries: StaffWelfare[]; today: string; loading: boolean; error: string | null; onRetry: () => void }) {
  const q = welfareQuarters(entries, '2026-Q1', today);
  const missed = q.quarters.filter((x) => x.state === 'NOT_MET').length;
  const tone = loading || error ? 'neutral' : missed > 0 ? 'danger' : 'ok';
  const verdict = loading ? '불러오는 중' : error ? '확인 못 함' : missed > 0 ? `${missed}개 분기 비어 있음` : '지난 분기 모두 충족';
  return (
    <StaffWelfareCard no="③" title="분기별 복지(포상) 제공" points="1" tone={tone} verdict={verdict}>
      {error && <ErrorBanner message={error} onRetry={onRetry} />}
      {!loading && !error && (
        <div className={styles.chipLine}>
          {q.quarters.map((x) => (
            <Chip key={x.quarter} tone={x.state === 'MET' ? 'ok' : x.state === 'NOT_MET' ? 'danger' : 'warn'} label={`${quarterName(x.quarter)} ${x.state === 'MET' ? `충족 (인정 ${x.ok}건)` : x.state === 'NOT_MET' ? `미충족 (기록 ${x.entries}건)` : '진행 중'}`} />
          ))}
        </div>
      )}
      <SupportText>분기마다 인정되는 복지를 1건 이상, 제공일·수령인 서명·이체내역이나 영수증과 함께 남겨야 합니다. 제공대장은 2026년 1분기부터 봅니다.</SupportText>
      <SupportText>분기는 1~3월, 4~6월처럼 달력 분기로 셉니다. 회계연도 기준인지는 대조가 필요합니다.</SupportText>
    </StaffWelfareCard>
  );
}

export function GrievanceCard({ year, summary, docs, loading, error, docsError, onRetry }: { year: number; summary: GrievanceSummary | null; docs: PolicyDoc[]; loading: boolean; error: string | null; docsError: string | null; onRetry: () => void }) {
  const guide = docs.find((d) => d.kind === 'GRIEVANCE_GUIDE') ?? null;
  const items = POLICY_ITEMS.GRIEVANCE_GUIDE;
  const done = guide ? items.filter((i) => guide.checks[i.key] === true).length : 0;
  const complete = done === items.length;
  const tone = loading || error || docsError ? 'neutral' : complete ? 'ok' : 'warn';
  const verdict = loading ? '불러오는 중' : error || docsError ? '확인 못 함' : complete ? '고충처리지침 세 요소 갖춤' : guide ? `고충처리지침 ${done}/${items.length}` : '고충처리지침 등록 전';
  return (
    <StaffWelfareCard no="④" title="고충처리" points="1" tone={tone} verdict={verdict}>
      {(error || docsError) && <ErrorBanner message={(error ?? docsError) as string} onRetry={onRetry} />}
      {!loading && !docsError && (
        <div className={styles.chipLine}>
          {items.map((i) => (
            <Chip key={i.key} tone={guide?.checks[i.key] === true ? 'ok' : 'warn'} label={`${i.label} ${guide?.checks[i.key] === true ? '있음' : '확인 전'}`} />
          ))}
        </div>
      )}
      {!loading && !docsError && !guide && <SupportText tone="warn">규정·지침 대장에 고충처리지침이 없습니다. ‘규정·지침 대장’에서 등록하고 세 요소를 확인해 주세요.</SupportText>}
      {summary && !error && (
        <>
          <Text hasTabularNumbers>{year}년 접수 {summary.total}건 (익명 {summary.anonymous}건) · 접수 {summary.received} · 검토 중 {summary.inReview} · 보류 {summary.onHold} · 조치완료 {summary.resolved} · 답변 {summary.replied}건</Text>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            답변까지 걸린 날 중앙값 {summary.medianReplyDays === null ? '-' : `${summary.medianReplyDays}일`} · 조치완료 전 가장 오래된 건 {summary.oldestOpenDays === null ? '-' : `${summary.oldestOpenDays}일째`}
          </Text>
        </>
      )}
      <SupportText>건수만 셉니다. 제목·내용·작성자는 이곳에 가져오지 않으니 ‘고충·건의함’ 메뉴에서 확인하세요. 접수·처리 기록(고충처리대장)은 평가 때 기록으로 봅니다.</SupportText>
    </StaffWelfareCard>
  );
}

export function SeveranceCard() {
  return (
    <StaffWelfareCard no="⑤" title="퇴직금 제도" points="1" tone="info" verdict="서류 확인 필요">
      <SupportText>퇴직급여제도(DB·DC·중소기업퇴직연금기금)를 두었는지, 또는 기관 이름의 퇴직금 통장을 직접 운영하는지 봅니다. 현황은 ‘퇴직금 추계’에서 확인하세요.</SupportText>
      <SupportText>직접 운영하면 이체확인증을, 퇴직연금이면 가입·납입 서류를 준비합니다. 월 급여에 퇴직급여를 섞어 주는 것은 인정되지 않습니다.</SupportText>
    </StaffWelfareCard>
  );
}
