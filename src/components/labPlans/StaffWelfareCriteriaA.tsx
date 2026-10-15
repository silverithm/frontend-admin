'use client';

/** 기준 ① 5대 보험, ② 가산금 — 자동으로 셀 수 있는 부분과 서류로 확인할 부분을 나눠 보여 준다. */
import { Text } from '@astryxdesign/core/Text';
import { ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { bonusFundStatus } from '@/lib/lab/welfareRules';
import type { BonusFund, PayrollProfile } from '@/lib/lab/labTypes';
import { wonText } from './StaffWelfareFormat';
import StaffWelfareCard from './StaffWelfareCard';

export function InsuranceCard({ profiles, loading, error, onRetry }: { profiles: PayrollProfile[]; loading: boolean; error: string | null; onRetry: () => void }) {
  const total = profiles.length;
  const nps = profiles.filter((p) => p.npsEnrolled).length;
  const health = profiles.filter((p) => p.healthEnrolled).length;
  const emp = profiles.filter((p) => p.employmentEnrolled).length;
  const lacking = profiles
    .map((p) => ({ name: p.memberName ?? '이름 없음', miss: [p.npsEnrolled ? '' : '국민연금', p.healthEnrolled ? '' : '건강', p.employmentEnrolled ? '' : '고용'].filter(Boolean) }))
    .filter((p) => p.miss.length > 0);
  const allIn = total > 0 && lacking.length === 0;
  return (
    <StaffWelfareCard no="①" title="5대 보험 가입·완납" points="0.5" tone={error || loading ? 'neutral' : total === 0 ? 'warn' : allIn ? 'info' : 'warn'} verdict={loading ? '불러오는 중' : error ? '확인 못 함' : total === 0 ? '급여 기준 직원 없음' : allIn ? '서류 확인 필요' : '미가입 직원 있음'}>
      {error && <ErrorBanner message={error} onRetry={onRetry} />}
      {!loading && !error && (
        <>
          <Text hasTabularNumbers>급여 기준에 등록된 직원 {total}명 중 국민연금 {nps}명 · 건강보험 {health}명 · 고용보험 {emp}명 가입</Text>
          {total === 0 && <SupportText tone="warn">급여 기준에 직원이 없어 셀 수 없습니다. ‘급여 명세’의 급여 기준에서 직원을 등록해 주세요.</SupportText>}
          {lacking.length > 0 && (
            <SupportText tone="warn">
              가입 표시가 빠진 직원: {lacking.slice(0, 5).map((p) => `${p.name}(${p.miss.join('·')})`).join(', ')}{lacking.length > 5 ? ` 외 ${lacking.length - 5}명` : ''}. 가입 대상이 아니면 사유를 서류로 남겨 두세요.
            </SupportText>
          )}
        </>
      )}
      <SupportText>완납은 사업개시월부터 평가일까지 체납이 없다는 뜻입니다. 사회보험통합징수포털에서 발급한 완납증명서(발급용도: 조달청 제출)로 서류 확인합니다.</SupportText>
      <SupportText>산재보험은 사업장 단위로 가입해 직원별로 셀 수 없습니다. 가입 서류로 확인해 주세요.</SupportText>
    </StaffWelfareCard>
  );
}

export function BonusFundCard({ funds, loading, error, onRetry }: { funds: BonusFund[]; loading: boolean; error: string | null; onRetry: () => void }) {
  const s = bonusFundStatus(funds);
  const tone = loading || error ? 'neutral' : s.state === 'NOT_USED' ? 'danger' : 'ok';
  const verdict = loading ? '불러오는 중' : error ? '확인 못 함' : s.state === 'NOT_RECEIVED' ? '받은 가산금 없음 — 충족 처리' : s.state === 'USED' ? '사용 내역 있음' : '사용 내역 없음';
  return (
    <StaffWelfareCard no="②" title="가산금 사용" points="0.5" tone={tone} verdict={verdict}>
      {error && <ErrorBanner message={error} onRetry={onRetry} />}
      {!loading && !error && (
        <>
          <Text hasTabularNumbers>2026년부터 받은 가산금 {wonText(s.received)} · 쓴 금액 {wonText(s.spent)}</Text>
          {s.ownerSpent > 0 && <SupportText>그중 대표자 겸 시설장·직원에게 쓴 {wonText(s.ownerSpent)}은 빼고 {wonText(s.countedSpent)}만 셉니다.</SupportText>}
          {s.state === 'NOT_USED' && <SupportText tone="warn">가산금을 받았는데 직원 처우개선에 쓴 기록이 없습니다. 쓴 내역을 영수증·이체내역과 함께 남겨 주세요.</SupportText>}
          {s.state !== 'NOT_RECEIVED' && <Text type="supporting" color="secondary" hasTabularNumbers>직원에게 쓴 비율 {s.ratio === null ? '-' : `${s.ratio}%`} (참고)</Text>}
        </>
      )}
      <SupportText>가산금을 받지 않았다면 충족으로 칩니다. ‘80% 이상 사용’ 비율은 2026 평가종료월 다음 해부터 적용돼(Q&amp;A는 ’29~’30 정기평가) 지금은 참고로만 보입니다. 원문과 대조가 필요합니다.</SupportText>
    </StaffWelfareCard>
  );
}
