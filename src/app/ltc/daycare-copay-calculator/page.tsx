import { Metadata } from 'next';
import Link from 'next/link';
import CopayCalculator from '@/components/ltc/CopayCalculator';
import {
  LtcBlock,
  LtcFaq,
  LtcPage,
  LtcRelated,
  LtcSources,
  buildLtcFaqJsonLd,
  type LtcFaqItem,
} from '@/components/ltc/LtcParts';
import { CARE_GRADES, LTC_SOURCES, calcDaycareCopay, formatWon } from '@/lib/ltc2026';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/daycare-copay-calculator';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '주·야간보호 본인부담금 계산기 (2026년 수가)';
const DESCRIPTION =
  '장기요양등급·하루 이용시간·이용일수·감경 여부를 고르면 2026년 수가로 주·야간보호 한 달 급여비용과 본인부담금, 월 한도 초과분을 계산합니다. 4등급 8~10시간 20일이면 본인부담금 174,030원입니다.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords:
    '주야간보호 본인부담금 계산, 주간보호 본인부담금, 장기요양 본인부담금 계산기, 주간보호센터 비용, 장기요양 본인부담 15%, 본인부담금 감경, 2026 주간보호 비용',
  openGraph: {
    title: `${TITLE} | 케어브이`,
    description: DESCRIPTION,
    url: URL,
    type: 'website',
    images: OG_IMAGES,
  },
  alternates: { canonical: PATH },
};

const FAQ: LtcFaqItem[] = [
  {
    question: '주·야간보호 본인부담금은 어떻게 계산하나요?',
    answer:
      '한 달 급여비용(1일 급여비용 × 이용일수) 가운데 월 한도액 안의 금액에 본인부담률을 곱하고, 한도를 넘는 금액이 있으면 그 금액을 전부 더합니다. 일반 수급자의 본인부담률은 15%입니다(노인장기요양보험법 시행령 제15조의8).',
  },
  {
    question: '4등급이 하루 8~10시간씩 20일 다니면 본인부담금은 얼마인가요?',
    answer:
      '2026년 1일 급여비용 58,010원 × 20일 = 1,160,200원이 한 달 급여비용이고, 4등급 월 한도액 1,409,700원 안이므로 15%인 174,030원을 냅니다. 식사재료비 같은 비급여와 야간·공휴일 가산은 별도입니다.',
  },
  {
    question: '본인부담금 감경은 누가 받나요?',
    answer:
      '60% 감경(본인부담 6%)은 의료급여법 제3조제1항제2호~제9호 수급권자, 건강보험 본인부담액 경감 인정자, 천재지변 등으로 생계가 곤란한 자, 건강보험료 순위 0~25% 이하인 자가 받습니다. 40% 감경(본인부담 9%)은 건강보험료 순위 25% 초과~50% 이하인 자가 받습니다. 직장가입자는 재산 기준도 함께 봅니다(장기요양 본인부담금 감경에 관한 고시 제2조).',
  },
  {
    question: '송영비도 본인부담금에 들어가나요?',
    answer:
      '아닙니다. 이동서비스(송영) 비용과 주 1회 목욕서비스 가산금은 수급자가 부담하지 않고(고시 제34조제3항, 제35조제1항), 월 한도액 계산에서도 빠집니다(고시 제13조제2항).',
  },
  {
    question: '결석한 날도 비용이 나오나요?',
    answer:
      '월 15일 이상 이용하기로 계약하고 전월 말일까지 공단에 계약이 통보된 경우, 본인 사정으로 이용하지 않은 평일은 월 5일 범위에서 이용 예정 급여비용의 50%(라-3 금액의 50% 한도)를 산정합니다(고시 제32조제3항). 이 계산기에는 넣지 않았습니다.',
  },
];

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: '주·야간보호 본인부담금 계산기', path: PATH },
]);

/** 등급별 예시 — 하루 8~10시간, 월 20일, 일반(15%). 계산기와 같은 함수로 서버에서 만든다. */
const EXAMPLE_ROWS = CARE_GRADES.map((grade) => ({
  grade,
  result: calcDaycareCopay({ grade: grade.id, unit: 'general', band: 'h8to10', days: 20, copayClass: 'standard' }),
}));

export default function DaycareCopayCalculatorPage() {
  return (
    <>
      <script {...jsonLdScriptProps(buildLtcFaqJsonLd(URL, FAQ))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title="주·야간보호 본인부담금 계산기"
        lede={
          <>
            <p>
              <strong>
                주·야간보호 본인부담금은 한 달 급여비용 가운데 월 한도액 안 금액의 15%에, 한도를 넘는 금액을 더한 값입니다.
              </strong>
            </p>
            <p>
              예를 들어 4등급이 하루 8~10시간씩 20일 이용하면 급여비용 1,160,200원 중 본인부담금은 174,030원입니다. 아래에서 등급과
              이용일수를 바꿔 2026년 수가로 계산해 보세요.
            </p>
          </>
        }
      >
        <LtcBlock title="계산기">
          <CopayCalculator />
        </LtcBlock>

        <LtcBlock title="계산 방법">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>한 달 급여비용</strong> = 1일 급여비용 × 이용일수. 1일 급여비용은{' '}
                <Link href="/ltc/daycare-fee-2026">2026년 주·야간보호 수가표</Link>의 금액입니다.
              </li>
              <li>
                <strong>적용 월 한도액</strong> = 등급별 <Link href="/ltc/monthly-limit-2026">월 한도액</Link>. 하루 8시간 이상·월 15일 이상
                이용하면 추가 산정 비율만큼 늘어납니다.
              </li>
              <li>
                <strong>한도 안 본인부담금</strong> = 한도 안 급여비용 × 본인부담률(일반 15%, 감경 9%·6%, 의료급여 수급자 0%).
              </li>
              <li>
                <strong>한도 초과분</strong> = 한도를 넘은 급여비용 전액. 수급자가 모두 냅니다(노인장기요양보험법 제40조제3항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title="등급별 예시 — 하루 8~10시간, 월 20일, 일반 15%"
          description={
            <p>
              1~5등급은 20일을 이용해도 월 한도액 안이라 급여비용의 15%만 냅니다. 인지지원등급은 월 한도액 676,320원이 8~10시간 기준 12일치라,
              넘는 금액 450,880원을 전부 내게 됩니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  {/* 본인부담금을 등급 바로 옆에 둔다 — 좁은 화면에서 표를 밀지 않아도 답이 보이게 */}
                  <th scope="col">등급</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">본인부담금</th>
                  <th scope="col" className="carev-ltc-num">한 달 급여비용</th>
                  <th scope="col" className="carev-ltc-num">공단 부담금</th>
                  <th scope="col" className="carev-ltc-num">한도 초과분</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLE_ROWS.map(({ grade, result }) =>
                  result ? (
                    <tr key={grade.id}>
                      <th scope="row">{grade.label}</th>
                      <td className="carev-ltc-num carev-ltc-focus">{formatWon(result.totalCopay)}</td>
                      <td className="carev-ltc-num">{formatWon(result.totalFee)}</td>
                      <td className="carev-ltc-num">{formatWon(result.insurerShare)}</td>
                      <td className="carev-ltc-num">{result.overLimit > 0 ? formatWon(result.overLimit) : '없음'}</td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>
        </LtcBlock>

        <LtcBlock title="계산에 넣지 않은 것">
          <div className="carev-ltc-prose">
            <ul>
              <li>야간(18~22시) 20%·공휴일 30% 가산(고시 제33조) — 가산분도 급여비용이라 본인부담률이 함께 적용됩니다.</li>
              <li>송영(이동서비스) 비용과 목욕서비스 가산금 — 수급자가 부담하지 않습니다.</li>
              <li>식사재료비 등 비급여 — 장기요양급여 범위 밖이라 급여비용과 별도입니다(시행규칙 제14조).</li>
              <li>미이용일(결석) 급여비용과 3시간 미만 이용 — 산정 조건이 따로 있습니다(고시 제32조).</li>
              <li>원 단위 끝전 — 계산기는 원 미만을 버립니다. 실제 청구서와 몇 원 차이가 날 수 있습니다.</li>
              <li>방문요양 등 다른 재가급여를 같은 달에 함께 쓰면 월 한도액을 나눠 쓰게 됩니다. 계산기는 주·야간보호만 이용한다고 봅니다.</li>
            </ul>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources
          sources={[
            LTC_SOURCES.feeNotice,
            LTC_SOURCES.decree15_8,
            LTC_SOURCES.act40,
            LTC_SOURCES.reductionNotice,
            LTC_SOURCES.rule14,
          ]}
        />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
