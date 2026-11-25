import { Metadata } from 'next';
import Link from 'next/link';
import {
  LtcBlock,
  LtcFaq,
  LtcPage,
  LtcRelated,
  LtcSources,
  buildLtcFaqJsonLd,
  type LtcFaqItem,
} from '@/components/ltc/LtcParts';
import {
  OVER_CAPACITY_BANDS,
  OVER_CAPACITY_SOURCES,
  OVER_CAPACITY_VERIFIED_AT,
  bonusKeptFraction,
  excessPercentLabel,
  excessRangesFor,
  payPercentFor,
  payableWon,
  tenPercentOfCapacity,
  type ExcessRange,
} from '@/lib/ltcOverCapacity';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/daycare-over-capacity';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '주·야간보호 정원초과 감액';
const DESCRIPTION =
  '주·야간보호기관이 정원을 넘긴 날은 그날 수급자 전원의 급여비용을 정원 초과비율에 따라 90%(5% 미만)~50%(30% 이상)만 산정합니다. 인원 세는 법, 정원별 초과 인원표, 인지지원등급 10%, 가산 제외를 장기요양 고시 제65조 원문과 대조해 정리했습니다.';

const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

/** 정원별 표에 싣는 정원 — 10명부터 5명 간격, 60명 위로는 10·20명 간격. */
const CAPACITIES: ReadonlyArray<number> = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 100];

function rangeText(range: ExcessRange): string {
  if (range.from === null) return '—';
  if (range.to === null) return `${range.from}명 이상`;
  return range.from === range.to ? `${range.from}명` : `${range.from}~${range.to}명`;
}

/** 정원 × 10%를 소수 한 자리까지 — "2.5명" */
function tenPercentRaw(capacity: number): string {
  return `${capacity % 10 === 0 ? capacity / 10 : (capacity / 10).toFixed(1)}명`;
}

// 예시 1 — 정원 30명, 그날 가장 많은 시간대 32명, 그날 수급자 전원 급여비용 합 200만 원
const EX1 = { capacity: 30, residents: 32, cost: 2_000_000 };
const EX1_EXCESS = EX1.residents - EX1.capacity;
const EX1_PAY = payPercentFor(EX1.capacity, EX1.residents);
const EX1_PAYABLE = payableWon(EX1.cost, EX1_PAY);

// 예시 2 — 같은 날 정원을 넘긴 2명이 인지지원등급 수급자(월 한도액 범위 안)
const EX2_ALLOWED = tenPercentOfCapacity(EX1.capacity);
const EX2_COUNTED = EX1.residents - EX1_EXCESS;
const EX2_PAY = payPercentFor(EX1.capacity, EX2_COUNTED);

// 예시 3 — 그달 급여 제공일수 22일 중 2일 정원초과
const EX3 = { serviceDays: 22, overDays: 2 };
const EX3_KEPT = bonusKeptFraction(EX3.serviceDays, EX3.overDays);

export const metadata: Metadata = {
  title: `${TITLE} — 초과비율별 급여비용 90~50%·인지지원등급 10%(고시 제65조)`,
  description: DESCRIPTION,
  keywords:
    '주야간보호 정원초과 감액, 주간보호센터 정원초과, 정원초과 감액, 정원 초과비율, 장기요양 정원초과 감액 기준, 인지지원등급 정원 초과, 주간보호 정원 10%, 정원초과 가산 제외',
  openGraph: {
    title: `${TITLE} | 케어브이`,
    description: DESCRIPTION,
    url: URL,
    type: 'article',
    images: OG_IMAGES,
  },
  alternates: { canonical: PATH },
};

const FAQ: LtcFaqItem[] = [
  {
    question: '주간보호센터가 정원을 1명만 넘겨도 감액되나요?',
    answer:
      '감액됩니다. 정원 초과비율이 5% 미만이어도 그날 수급자 전원의 급여비용을 90%만 산정합니다(장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제65조제1항). 정원 11~20명이면 1명만 넘겨도 초과비율이 5% 이상이라 80%이고, 정원 10명은 1명이 10%라 70%입니다.',
  },
  {
    question: '정원초과 감액 비율은 어떻게 되나요?',
    answer:
      '정원 초과비율 5% 미만 90%, 5% 이상~10% 미만 80%, 10% 이상~20% 미만 70%, 20% 이상~30% 미만 60%, 30% 이상 50%로 그날 수급자 전원의 급여비용을 산정합니다. 시설급여기관(요양원·노인요양공동생활가정)·주·야간보호기관·단기보호기관이 같은 표를 씁니다(고시 제65조제1항).',
  },
  {
    question: '정원을 넘었는지는 어떤 인원으로 따지나요?',
    answer:
      '고시가 감액을 ‘해당일의 급여비용’(제65조제1항)으로, 가산 제외를 ‘정원초과 발생일수’(제54조제2항)로 적고 있어 날마다 센 입소자 수로 따집니다. 주·야간보호기관의 일자별 입소자 수는 하루 중 입소자 수가 가장 많은 시간대를 기준으로 세고, 수급자와 등급외자를 함께 넣으며, 미이용일 급여비용이 산정되는 수급자도 그날 입소자 수에 넣습니다(고시 제47조제1항제1호·제3호, 제2항제2호).',
  },
  {
    question: '인지지원등급 수급자는 정원을 넘겨 받을 수 있나요?',
    answer:
      '주·야간보호기관이 인지지원등급 수급자에게 월 한도액 범위 안에서 급여를 제공한 경우 정원의 10%(소수점 이하 반올림)까지 정원을 넘겨 운영할 수 있고, 정원을 넘긴 인원은 인지지원등급 수급자여야 하며 입소자 수에 넣지 않습니다(고시 제47조제1항제7호). 노인돌봄대상자(제6호)와 합쳐 정원을 넘겨 운영할 수 있는 최대 범위도 정원의 10%입니다(제8호).',
  },
  {
    question: '정원을 넘긴 날이 있으면 인력추가배치 가산은 어떻게 되나요?',
    answer:
      '정원초과 감액이 적용되는 달은 인력추가배치·간호사배치·야간직원배치·맞춤형서비스제공 가산을 급여 제공일수 중 정원초과 발생일수의 비율만큼 빼고 적용합니다(고시 제54조제2항). 급여 제공일수 22일 중 정원초과 발생일수가 2일이면 가산의 2/22를 뺍니다.',
  },
  {
    question: '정원초과 감액과 인력배치기준 위반 감액이 겹치면 어떻게 되나요?',
    answer:
      '감액이 겹치면 급여비용 산정제외 금액을 합산하되, 정원초과 감액과 인력배치기준 위반 감액의 합이 급여비용의 50%를 넘으면 급여비용의 50%를 산정합니다(고시 제64조). 또 그달 정원을 넘긴 기관은 입소자가 늘어 생긴 인력배치기준 위반 감액을 직종별 반기 1회 적용하지 않는 특례(제67조제1항)를 받지 못합니다.',
  },
  {
    question: '치매전담실이 있는 주간보호센터는 정원을 어떻게 따지나요?',
    answer:
      '치매전담실이 있는 주·야간보호기관은 각 실별 정원을 기준으로 구분해 산정합니다(고시 제65조제2항). 입소자 수도 치매전담실과 일반실을 각각 구분해 셉니다(제47조제1항제8호, 제2항제5호).',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${URL}#dataset`,
  name: '장기요양 정원초과 감액 — 정원 초과비율별 급여비용 산정비율, 정원별 초과 인원 구간, 정원의 10% 인원',
  description:
    '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제65조제1항의 정원 초과비율별 급여비용 산정비율 표(5% 미만 90%~30% 이상 50%)를 옮기고, 초과비율을 (그날 입소자 수 − 정원) ÷ 정원으로 계산해 정원 10~100명별로 각 산정비율이 되는 초과 인원을, 제47조제1항제6~8호의 정원의 10%(소수점 이하 반올림)를 정원별 인원으로 계산한 표입니다.',
  url: URL,
  inLanguage: 'ko-KR',
  dateModified: OVER_CAPACITY_VERIFIED_AT,
  isBasedOn: OVER_CAPACITY_SOURCES.map((source) => source.url),
  variableMeasured: ['정원 초과비율(%)', '급여비용 산정비율(%)', '정원(명)', '초과 인원(명)', '정원의 10%(명)'],
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '케어브이' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: TITLE, path: PATH },
]);

export default function DaycareOverCapacityPage() {
  return (
    <>
      <script {...jsonLdScriptProps(datasetJsonLd)} />
      <script {...jsonLdScriptProps(buildLtcFaqJsonLd(URL, FAQ))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title={TITLE}
        badge="고시 제65조 · 제2026-189호 기준"
        verifiedAt={OVER_CAPACITY_VERIFIED_AT}
        lede={
          <>
            <p>
              <strong>
                주·야간보호기관이 정원을 넘겨 운영한 날은 그날 수급자 전원의 급여비용을 정원 초과비율에 따라 90%(5% 미만)부터
                50%(30% 이상)까지만 산정합니다. 1명만 넘겨도 그날 급여비용이 10% 이상 줄어듭니다.
              </strong>
            </p>
            <p>
              초과 인원은 그날 이용자가 가장 많은 시간대로 세고, 등급외자와 미이용일 급여비용을 산정하는 수급자도 넣습니다.
              주·야간보호기관은 인지지원등급 수급자를 월 한도액 범위 안에서 정원의 10%(소수점 이하 반올림)까지 넘겨 받을 수 있고, 그
              인원은 입소자 수에 넣지 않습니다. 정원초과 감액이 적용된 날이 있는 달은 인력추가배치·간호사배치·야간직원배치·맞춤형서비스제공
              가산이 그 날수 비율만큼 빠집니다(고시 제47조·제54조·제65조). 요양원·노인요양공동생활가정(시설급여기관)과 단기보호기관도
              같은 감액 표를 씁니다.
            </p>
          </>
        }
      >
        <LtcBlock
          title="감액 표 — 고시 제65조제1항"
          description={
            <p>
              &ldquo;시설급여기관, 주ㆍ야간보호기관 및 단기보호기관이 규칙 제23조에 따른 정원을 초과하여 운영한 경우, 수급자 전원에
              대하여 해당일의 급여비용을 그 초과비율에 따라 다음과 같이 산정한다.&rdquo; 여기서 규칙은 노인장기요양보험법 시행규칙입니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">정원 초과비율</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">급여비용 산정비율</th>
                  <th scope="col" className="carev-ltc-num">줄어드는 몫</th>
                </tr>
              </thead>
              <tbody>
                {OVER_CAPACITY_BANDS.map((band) => (
                  <tr key={band.label}>
                    <th scope="row">{band.label}</th>
                    <td className="carev-ltc-num carev-ltc-focus">{band.payPercent}%</td>
                    <td className="carev-ltc-num">{100 - band.payPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <ul>
              <li>감액은 정원을 넘긴 날의 급여비용에 적용합니다(&lsquo;해당일의 급여비용&rsquo;).</li>
              <li>정원을 넘긴 사람만이 아니라 그날 수급자 전원의 급여비용을 이 비율로 산정합니다.</li>
              <li>
                감액이 적용되는 급여비용은 월 한도액 범위 안의 비용만입니다. 다만 제13조제2항제2호·제5호에 해당하는 비용은
                포함합니다(제52조제1항).
              </li>
              <li>
                표는 국가법령정보센터 고시 본문에 그림으로만 실려 있어, 케어브이가 그림을 내려받아 확대해 칸마다 읽고 국민건강보험공단
                건강Law에 올라 있는 같은 고시 개정전문(제2025-247호) PDF의 표와 대조했습니다.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="초과비율과 인원 세는 법 — 고시 제47조">
          <div className="carev-ltc-prose">
            <p>
              고시는 &lsquo;그 초과비율에 따라&rsquo;라고만 쓰고 계산식을 따로 적지 않습니다. 이 페이지는 표 머리말 &lsquo;정원
              초과비율&rsquo; 그대로 <strong>초과비율 = (그날 입소자 수 − 정원) ÷ 정원</strong>으로 계산했습니다. 사람 수는 고시 제47조의
              &lsquo;급여비용의 가산 또는 감액산정을 위한 입소자의 범위&rsquo;로 셉니다. 주·야간보호기관에서는 다음과 같습니다.
            </p>
            <ul>
              <li>
                주·야간보호기관의 각 일자별 입소자 수는 하루 중 입소자 수가 가장 많은 시간대를 기준으로 산정합니다(제47조제2항제2호).
              </li>
              <li>입소자에는 수급자와 등급외자 등도 포함합니다(제1항제1호).</li>
              <li>
                미이용일 급여비용이 산정되는 수급자는 그날 오지 않았어도 그날 입소자 수에 넣습니다(제1항제3호). 미이용일 급여비용은
                수급자 본인의 사정으로 이용하지 않은 날의 급여비용으로, 월 15일 이상 이용 계약을 하고 급여가 개시되는 달의 전월 말일까지
                공단에 급여계약통보가 된 경우에 평일 기준 월 5일 범위에서 산정합니다(제32조제3항).
              </li>
              <li>일자별 입소자 수에는 입소한 사람은 넣고 퇴소한 사람은 넣지 않습니다(제2항제3호).</li>
              <li>
                「노인복지법」 제28조제1항제2호·제3호에 따라 보건복지부장관이나 지방자치단체장의 위탁으로 정원을 넘겨 입소한 사람은
                입소자에 넣지 않고, 다른 입소자가 퇴소해 정원초과가 풀리면 바로 넣습니다(제1항제4호).
              </li>
              <li>치매전담실과 일반실은 정원과 입소자 수를 각각 구분합니다(제1항제8호, 제2항제5호, 제65조제2항).</li>
              <li>
                노인돌봄서비스 제공기관으로 지정된 주·야간보호기관을 이용하는 노인돌봄대상자는 정원의 10%(소수점 이하 반올림) 범위까지
                입소자에 넣지 않습니다(제1항제6호).
              </li>
            </ul>
            <p>
              정원초과 감액은 &lsquo;해당일의 급여비용&rsquo;을 산정하고 가산 제외도 &lsquo;정원초과 발생일수&rsquo;로 세므로(제54조제2항),
              월 평균 입소자 수(제2항제1호)가 아니라 날마다 센 입소자 수로 따집니다. 이용 계획을 짤 때는 날짜별로 가장 많이 겹치는
              시간대 인원에 미이용일 급여비용을 산정하는 수급자까지 더해 정원과 비교합니다.
            </p>
          </div>
        </LtcBlock>

        <LtcBlock
          title="정원별 — 몇 명 넘기면 몇 %인가"
          description={
            <p>
              이 페이지 계산식(초과 인원 ÷ 정원)으로는 정원 N명에서 k명을 넘기면 초과비율이 k ÷ N입니다. 각 칸은 그 산정비율이 되는 초과
              인원입니다. 치매전담실은 실별 정원으로 이 표를 봅니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">정원</th>
                  {OVER_CAPACITY_BANDS.map((band) => (
                    <th key={band.label} scope="col" className="carev-ltc-num">
                      {band.payPercent}% 산정
                      <br />({band.label})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPACITIES.map((capacity) => (
                  <tr key={capacity}>
                    <th scope="row">{capacity}명</th>
                    {excessRangesFor(capacity).map((range) => (
                      <td key={range.band.label} className="carev-ltc-num">
                        {rangeText(range)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <p>
              &lsquo;—&rsquo;는 그 산정비율이 되는 초과 인원이 없다는 뜻입니다. 정원 20명은 1명만 넘겨도 초과비율이 정확히{' '}
              {excessPercentLabel(20, 1)}라 80% 칸이고, 정원 21명부터 1명 초과가 5% 미만(1 ÷ 21 = {excessPercentLabel(21, 1)})이라
              90%입니다. 정원 10명은 1명 초과가 {excessPercentLabel(10, 1)}라 바로 70%입니다.
            </p>
          </div>
        </LtcBlock>

        <LtcBlock
          title="인지지원등급·노인돌봄대상자 — 정원의 10%까지"
          description={
            <p>
              주·야간보호기관에만 있는 규정입니다(고시 제47조제1항제6~8호). 10%는 소수점 이하를 반올림합니다.
            </p>
          }
        >
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>인지지원등급</strong> — &ldquo;주ㆍ야간보호기관이 인지지원등급 수급자에게 제13조의 월한도액 범위 내에서 급여를
                제공한 경우, 정원의 10%(소수점 이하 반올림) 범위까지 초과하여 운영할 수 있다. 이 경우 정원을 초과한 인원은
                인지지원등급 수급자이어야 하며, 동 수급자는 입소자 수에 포함하지 아니한다.&rdquo;(제7호)
              </li>
              <li>
                <strong>노인돌봄대상자</strong> — 노인돌봄서비스 제공기관으로 지정된 주·야간보호기관을 이용하는 노인돌봄대상자는 정원의
                10%(소수점 이하 반올림) 범위까지 입소자에 넣지 않습니다(제6호).
              </li>
              <li>
                <strong>합쳐서 10%</strong> — 제6호와 제7호에 따라 주·야간보호기관이 정원을 초과하여 운영할 수 있는 최대 범위는 정원의
                10%(소수점 이하 반올림)까지입니다(제8호).
              </li>
            </ul>
          </div>
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">정원</th>
                  <th scope="col" className="carev-ltc-num">정원 × 10%</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">정원을 넘겨 운영할 수 있는 최대 인원</th>
                </tr>
              </thead>
              <tbody>
                {CAPACITIES.map((capacity) => (
                  <tr key={capacity}>
                    <th scope="row">{capacity}명</th>
                    <td className="carev-ltc-num">{tenPercentRaw(capacity)}</td>
                    <td className="carev-ltc-num carev-ltc-focus">{tenPercentOfCapacity(capacity)}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <p>
              10% 범위를 넘긴 인원이 있을 때 어떻게 세는지(넘긴 몫만 입소자로 셀지 등)는 고시 문장에 없어 이 페이지에서 계산하지
              않았습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcBlock
          title="계산 예시"
          description={
            <p>
              치매전담실이 없는 주·야간보호기관을 가정했습니다. 급여비용 합은 계산 과정을 보이려고 정한 값이고, 모두 월 한도액 범위 안의
              비용으로 봤습니다(제52조제1항).
            </p>
          }
        >
          <div className="carev-ltc-prose">
            <h3>예시 1 — 정원 30명, 그날 가장 많은 시간대 32명</h3>
            <ol>
              <li>
                초과 {EX1_EXCESS}명, 초과비율 {EX1_EXCESS} ÷ {EX1.capacity} = {excessPercentLabel(EX1.capacity, EX1_EXCESS)} → 5% 이상~10%
                미만 → {EX1_PAY}%.
              </li>
              <li>
                그날 수급자 전원의 급여비용 합 {won(EX1.cost)} × {EX1_PAY}% = <strong>{won(EX1_PAYABLE)}</strong>. 그날{' '}
                {won(EX1.cost - EX1_PAYABLE)}이 줄어듭니다.
              </li>
            </ol>

            <h3>예시 2 — 같은 날 정원을 넘긴 2명이 인지지원등급 수급자(월 한도액 범위 안)</h3>
            <ol>
              <li>
                정원의 10%는 {EX2_ALLOWED}명({EX1.capacity} × 10% = {EX2_ALLOWED})이라 {EX1_EXCESS}명은 범위 안입니다.
              </li>
              <li>
                두 사람은 입소자 수에 넣지 않아 그날 입소자 수는 {EX2_COUNTED}명입니다. 정원초과가 아니어서 급여비용을 {EX2_PAY}%
                산정합니다.
              </li>
            </ol>

            <h3>예시 3 — 정원을 넘긴 날이 있는 달의 가산</h3>
            <ol>
              <li>
                그달 급여 제공일수 {EX3.serviceDays}일 가운데 {EX3.overDays}일 정원초과가 생겨 정원초과 감액이 적용됐다면,
                인력추가배치 가산 등은{' '}
                {EX3.overDays}/{EX3.serviceDays}를 빼고 {EX3_KEPT.numerator}/{EX3_KEPT.denominator}만 적용합니다(제54조제2항).
              </li>
            </ol>
          </div>
        </LtcBlock>

        <LtcBlock title="다른 감액·가산과 겹칠 때 — 고시 제54조·제64조·제67조">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>가산</strong> — &ldquo;제65조의 정원초과 감액이 적용되는 시설급여기관, 주ㆍ야간보호기관 및 단기보호기관은 해당
                월에 제55조의 인력추가배치 가산, 제59조의 간호사배치 가산, 제60조의 야간직원배치 가산 및 제62조의 맞춤형서비스제공
                가산을 급여 제공일수 중 정원초과 발생일수의 비율만큼 제외하고 적용한다.&rdquo;(제54조제2항) 주·야간보호 가산 요건과
                점수는 <Link href="/ltc/daycare-staffing-bonus">주간보호센터 인력추가배치 가산</Link>에 정리했습니다.
              </li>
              <li>
                <strong>감액 상한</strong> — 감액이 겹치면 제65조·제66조·제68조의 급여비용 산정제외 금액을 합산하되, 정원초과 감액과
                인력배치기준 위반 감액의 합이 급여비용의 50%를 넘으면 급여비용의 50%를 산정합니다(제64조).
              </li>
              <li>
                <strong>인력배치기준 위반 감액 특례</strong> — 입소자가 늘어 요양보호사·간호(조무)사·사회복지사·물리(작업)치료사 의무
                인원이 바뀐 달에, 늘어난 입소자 때문에 생긴 위반 감액을 직종별 반기 1회 적용하지 않는 특례는 전월에 그 직종 기준을 지켰고
                그달 정원을 넘지 않았을 때만 받습니다(제67조제1항). 인력배치기준과 위반 감액은{' '}
                <Link href="/ltc/daycare-staffing-standard">주간보호센터 인력배치기준</Link>에 있습니다.
              </li>
              <li>가산 또는 감액으로 산출된 금액에 10원 미만 단수가 있으면 반올림합니다(제52조제2항).</li>
              <li>고시 제63조의 감액 유형 표에서 정원초과는 시설급여기관, 주·야간보호기관 및 단기보호기관에 적용됩니다.</li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="요양원·공동생활가정(시설급여기관)·단기보호기관이면">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                감액 표는 같습니다(제65조제1항). 치매전담실이 있는 노인요양시설도 실별 정원을 기준으로 구분해 산정합니다(제65조제2항).
              </li>
              <li>
                시설급여기관 외박자는 외박비용을 산정하는 기간에는 입소자 수에 넣고, 그 기간이 지나면 넣지 않습니다(제47조제1항제2호).
              </li>
              <li>
                시설급여기관은 외박이 10일을 넘긴 때부터 외박자 대신 특례입소자를 정원의 5%(소수점 이하 반올림, 정원 10명 미만인
                시설은 1인) 범위에서 받을 수 있습니다. 외박자가 돌아와 일시적으로 정원을 넘기면 특례입소자 입소일부터 90일이 되는 날
                또는 다른 입소자 퇴소로 정원초과가 풀리는 날 중 먼저 오는 날까지 정원을 넘겨 운영할 수 있고, 그 기간에는 특례입소자를
                입소자에 넣지 않습니다(제46조, 제47조제1항제5호).
              </li>
              <li>
                요양원 인력 기준은 <Link href="/ltc/nursing-home-staffing-standard">요양원 인력배치기준</Link>에 정리했습니다.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources
          sources={OVER_CAPACITY_SOURCES}
          verifiedAt={OVER_CAPACITY_VERIFIED_AT}
          note={
            <p>
              제65조제1항 표와 제63조 감액 유형 표는 고시 본문에 그림으로만 실려 있어, 그림을 내려받아 확대해 읽었습니다. 초과비율은
              고시에 계산식이 따로 없어 표 머리말 &lsquo;정원 초과비율&rsquo; 그대로 (그날 입소자 수 − 정원) ÷ 정원으로 셈했습니다. 이
              페이지의 정원별 초과 인원 표, 정원의 10% 표, 계산 예시는 원문 규칙을 적용해 케어브이가 계산한 값입니다.
            </p>
          }
        />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
