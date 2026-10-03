import { Metadata } from 'next';
import Link from 'next/link';
import {
  DaysWithinLimitTable,
  LtcBlock,
  LtcFaq,
  LtcPage,
  LtcRelated,
  LtcSources,
  MonthlyLimitTable,
  buildLtcFaqJsonLd,
  type LtcFaqItem,
} from '@/components/ltc/LtcParts';
import { LTC_SOURCES, LTC_VERIFIED_AT } from '@/lib/ltc2026';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/monthly-limit-2026';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '2026년 장기요양 등급별 월 한도액';
const DESCRIPTION =
  '2026년 장기요양 재가급여 월 한도액은 1등급 2,512,900원, 4등급 1,409,700원, 인지지원등급 676,320원입니다. 2025년 대비 인상액, 한도 안 주·야간보호 이용 가능 일수, 추가 산정 조건을 고시 원문과 대조해 정리했습니다.';

export const metadata: Metadata = {
  title: `${TITLE} — 2025년 대비 인상액과 추가 산정`,
  description: DESCRIPTION,
  keywords:
    '2026 장기요양 월 한도액, 장기요양 등급별 한도액, 재가급여 월 한도액, 주야간보호 한도액, 인지지원등급 한도액, 장기요양 한도 초과, 월 한도액 추가 산정',
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
    question: '2026년 장기요양 월 한도액은 얼마인가요?',
    answer:
      '재가급여(복지용구 제외) 월 한도액은 1등급 2,512,900원, 2등급 2,331,200원, 3등급 1,528,200원, 4등급 1,409,700원, 5등급 1,208,900원, 인지지원등급 676,320원입니다(보건복지부고시 제2025-247호 제13조, 2026년 1월 1일 시행).',
  },
  {
    question: '2025년보다 얼마나 올랐나요?',
    answer:
      '1등급 206,500원, 2등급 247,800원, 3등급 42,500원, 4등급 39,100원, 5등급 31,900원, 인지지원등급 18,920원 올랐습니다.',
  },
  {
    question: '월 한도액을 넘으면 어떻게 되나요?',
    answer:
      '한도를 넘은 금액은 장기요양보험이 부담하지 않고 수급자가 전부 냅니다(고시 제13조제6항, 노인장기요양보험법 제40조제3항).',
  },
  {
    question: '주·야간보호를 많이 이용하면 한도가 늘어나나요?',
    answer:
      '하루 8시간 이상, 월 15일 이상 이용하면 1·2등급은 10%, 3~5등급은 20% 범위에서 월 한도액을 추가 산정할 수 있습니다. 치매전담실을 같은 조건으로 이용하면 50%, 인지지원등급이 치매전담실을 월 9일 이상 이용하면 30%입니다(고시 제13조제7항·제8항).',
  },
  {
    question: '달 중간에 등급이 바뀌면 어느 한도를 쓰나요?',
    answer: '월 중에 장기요양등급이 바뀌면 높은 등급의 월 한도액을 적용합니다(고시 제13조제5항).',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${URL}#dataset`,
  name: '2026년 장기요양 재가급여 등급별 월 한도액',
  description:
    '보건복지부고시 제2025-247호 제13조제1항에 정해진 장기요양 재가급여(복지용구 제외) 월 한도액을 1~5등급과 인지지원등급별로 옮기고, 2025년 한도액과 인상액을 함께 정리한 표입니다.',
  url: URL,
  inLanguage: 'ko-KR',
  temporalCoverage: '2026',
  dateModified: LTC_VERIFIED_AT,
  isBasedOn: LTC_SOURCES.feeNotice.url,
  variableMeasured: ['장기요양등급', '월 한도액(원)', '2025년 대비 인상액(원)'],
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '케어브이' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: TITLE, path: PATH },
]);

export default function MonthlyLimit2026Page() {
  return (
    <>
      <script {...jsonLdScriptProps(datasetJsonLd)} />
      <script {...jsonLdScriptProps(buildLtcFaqJsonLd(URL, FAQ))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title={TITLE}
        lede={
          <>
            <p>
              <strong>
                2026년 장기요양 재가급여 월 한도액은 1등급 2,512,900원, 2등급 2,331,200원, 3등급 1,528,200원, 4등급 1,409,700원,
                5등급 1,208,900원, 인지지원등급 676,320원입니다.
              </strong>
            </p>
            <p>
              2025년보다 등급별로 18,920원~247,800원 올랐습니다. 주·야간보호·방문요양 같은 재가급여를 한 달 동안 이 금액 안에서
              이용하고, 넘는 금액은 수급자가 전부 냅니다.
            </p>
          </>
        }
      >
        <LtcBlock
          title="등급별 월 한도액"
          description={<p>고시 제13조제1항. 복지용구를 뺀 재가급여에 적용하며, 매월 1일부터 말일까지가 한 단위입니다.</p>}
        >
          <MonthlyLimitTable />
        </LtcBlock>

        <LtcBlock
          title="한도 안에서 주·야간보호를 며칠까지 이용할 수 있나"
          description={
            <p>
              하루 8~10시간 이용 기준 1일 급여비용으로 월 한도액을 나눈 값입니다(가산·송영 제외). 4등급은 기본 한도로 24일, 월 15일
              이상 이용해 20% 추가 산정을 받으면 29일까지 한도 안에 들어갑니다.
            </p>
          }
        >
          <DaysWithinLimitTable />
        </LtcBlock>

        <LtcBlock title="월 한도액을 늘려 주는 추가 산정">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>주·야간보호 월 15일 이상(하루 8시간 이상)</strong> — 1·2등급 10%, 3~5등급 20% 범위에서 추가 산정합니다(제13조제7항제2호).
                가족인 요양보호사에게 방문요양을 받은 달은 제외됩니다.
              </li>
              <li>
                <strong>치매전담실 월 15일 이상(하루 8시간 이상)</strong> — 50% 범위에서 추가 산정합니다(제13조제7항제1호).
              </li>
              <li>
                <strong>인지지원등급의 치매전담실 월 9일 이상(하루 8시간 이상)</strong> — 30% 범위에서 추가 산정합니다(제13조제8항).
              </li>
              <li>
                <strong>부득이한 사유</strong> — 천재지변, 입원·사망, 기관의 폐업·지정취소·업무정지 등으로 이용하지 못한 날은 월 5일(인지지원등급
                치매전담실은 월 3일) 범위에서 이용일수에 넣을 수 있습니다.
              </li>
              <li>
                <strong>가정방문형 통합재가서비스</strong> — 요건을 채우면 10% 범위에서 추가 산정하며, 위 주·야간보호 추가 산정과 중복하지
                않습니다(제13조제10항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="한도액에 들어가지 않는 비용">
          <div className="carev-ltc-prose">
            <p>아래 비용은 월 한도액 계산에서 빠집니다(제13조제2항). 한도를 거의 다 쓴 달에도 따로 산정됩니다.</p>
            <ul>
              <li>주·야간보호 이동서비스(송영) 비용과 목욕서비스 가산금</li>
              <li>방문요양·방문간호 원거리교통비용, 방문간호 간호(조무)사 가산금</li>
              <li>방문요양 중증 수급자 가산</li>
              <li>단기보호 급여비용 일부와 장기요양 가족휴가제 급여비용</li>
              <li>의사소견서·방문간호지시서 발급비용</li>
              <li>인력추가배치 가산 등 고시 제5장제2절의 가산금</li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="함께 알아 둘 규칙">
          <div className="carev-ltc-prose">
            <ul>
              <li>처음 장기요양인정을 받았거나 시설급여에서 재가급여로 바꿔 달 중간에 시작해도 그달 한도액은 전액 적용합니다(제13조제4항).</li>
              <li>달 중간에 등급이 바뀌면 높은 등급의 한도액을 적용합니다(제13조제5항).</li>
              <li>한도를 넘는 비용은 수급자가 전부 부담합니다(제13조제6항).</li>
              <li>가족요양비 등 특별현금급여를 받다가 재가급여로 바꾸면, 이미 받은 금액을 뺀 나머지가 그달 한도액입니다(제13조제9항).</li>
            </ul>
            <p>
              한 달 본인부담금이 얼마인지는 <Link href="/ltc/daycare-copay-calculator">본인부담금 계산기</Link>로, 1일 금액은{' '}
              <Link href="/ltc/daycare-fee-2026">2026년 주·야간보호 수가표</Link>로 확인하세요.
            </p>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources sources={[LTC_SOURCES.feeNotice, LTC_SOURCES.feeNoticeNhis, LTC_SOURCES.act40]} />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
