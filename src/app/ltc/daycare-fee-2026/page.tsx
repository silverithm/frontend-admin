import { Metadata } from 'next';
import Link from 'next/link';
import {
  DaycareFeeTable,
  LtcBlock,
  LtcFaq,
  LtcPage,
  LtcRelated,
  LtcSources,
  buildLtcFaqJsonLd,
  type LtcFaqItem,
} from '@/components/ltc/LtcParts';
import { LTC_SOURCES, LTC_VERIFIED_AT } from '@/lib/ltc2026';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/daycare-fee-2026';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '2026년 주·야간보호 수가표';
const DESCRIPTION =
  '2026년 1월 1일 시행 주·야간보호 수가를 등급·이용시간별로 정리했습니다. 8~10시간 기준 1등급 69,730원, 4등급 58,010원. 치매전담실 수가, 야간·공휴일 가산, 본인부담률까지 보건복지부 고시 원문과 대조했습니다.';

export const metadata: Metadata = {
  title: `${TITLE} — 등급·이용시간별 1일 급여비용`,
  description: DESCRIPTION,
  keywords:
    '2026 주야간보호 수가, 주간보호 수가표, 주야간보호 급여비용, 2026 장기요양 수가, 치매전담실 수가, 주간보호센터 수가, 장기요양 고시 제2025-247호',
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
    question: '2026년 주·야간보호 수가는 얼마인가요?',
    answer:
      '등급과 하루 이용시간에 따라 다릅니다. 가장 많이 쓰는 8시간 이상 10시간 미만 구간은 1등급 69,730원, 2등급 64,590원, 3등급 59,640원, 4등급 58,010원, 5등급 56,360원, 인지지원등급 56,360원입니다(보건복지부고시 제2025-247호 제31조, 2026년 1월 1일 시행).',
  },
  {
    question: '치매전담실 수가는 일반 주·야간보호와 다른가요?',
    answer:
      '다릅니다. 치매전담실은 고시 제74조에 따로 정해져 있고, 8시간 이상 10시간 미만 기준 2등급 81,270원, 3등급 75,010원, 4등급 72,980원, 5등급과 인지지원등급 70,890원입니다. 고시 표에 1등급 금액은 없습니다.',
  },
  {
    question: '저녁이나 공휴일에 이용하면 수가가 달라지나요?',
    answer:
      '18시 이후 22시 이전에 급여를 제공하면 표 금액의 20%를, 공휴일에 제공하면 30%를 가산합니다. 두 가산이 함께 해당돼도 중복해서 더하지 않습니다(고시 제33조).',
  },
  {
    question: '송영비와 식사비도 수가에 들어 있나요?',
    answer:
      '아닙니다. 송영(이동서비스) 비용은 수가와 따로 산정하며 수급자가 부담하지 않습니다(고시 제34조). 식사재료비는 장기요양급여 범위에서 제외되는 비급여 항목이라 수가에 들어 있지 않습니다(노인장기요양보험법 시행규칙 제14조).',
  },
  {
    question: '수급자는 수가 중 얼마를 내나요?',
    answer:
      '주·야간보호는 재가급여라 급여비용의 15%를 수급자가 냅니다(노인장기요양보험법 시행령 제15조의8). 감경 대상자는 9% 또는 6%를 내고, 국민기초생활보장 의료급여 수급자는 내지 않습니다. 월 한도액을 넘는 금액은 수급자가 전부 냅니다(법 제40조).',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${URL}#dataset`,
  name: '2026년 주·야간보호 1일 급여비용(수가)표',
  description:
    '보건복지부고시 제2025-247호 제31조와 제74조에 정해진 주·야간보호 및 주·야간보호 내 치매전담실의 1일당 급여비용을 장기요양등급과 하루 이용시간 구간별로 옮긴 표입니다. 2026년 1월 1일 시행분입니다.',
  url: URL,
  inLanguage: 'ko-KR',
  temporalCoverage: '2026',
  dateModified: LTC_VERIFIED_AT,
  isBasedOn: LTC_SOURCES.feeNotice.url,
  variableMeasured: ['장기요양등급', '하루 이용시간', '1일당 급여비용(원)'],
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '케어브이' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: TITLE, path: PATH },
]);

export default function DaycareFee2026Page() {
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
                2026년 주·야간보호 1일 수가는 하루 8~10시간 이용 기준 1등급 69,730원, 2등급 64,590원, 3등급 59,640원,
                4등급 58,010원, 5등급 56,360원, 인지지원등급 56,360원입니다.
              </strong>
            </p>
            <p>
              보건복지부고시 제2025-247호(2026년 1월 1일 시행) 제31조의 표를 그대로 옮겼습니다. 수급자는 이 금액의 15%를 내고,
              나머지는 국민건강보험공단이 부담합니다.
            </p>
          </>
        }
      >
        <LtcBlock
          title="일반 주·야간보호 1일 급여비용"
          description={<p>단위 원, 1일당. 고시 제31조제1항 표(분류번호 라-1~라-5). 가장 많이 쓰는 8~10시간 열을 옅게 표시했습니다.</p>}
        >
          <DaycareFeeTable unit="general" />
        </LtcBlock>

        <LtcBlock
          title="치매전담실 1일 급여비용"
          description={
            <p>
              단위 원, 1일당. 고시 제74조제1항 표(분류번호 사-1~사-5). 주·야간보호기관 안에 따로 둔 치매전담실의 금액이며, 고시 표에
              1등급 금액은 없습니다.
            </p>
          }
        >
          <DaycareFeeTable unit="dementia" />
        </LtcBlock>

        <LtcBlock title="수가에 더해지거나 따로 계산되는 것">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>야간 가산 20%</strong> — 18시 이후 22시 이전에 급여를 제공하면 위 표 금액의 20%를 더합니다(제33조제1항제1호).
              </li>
              <li>
                <strong>공휴일 가산 30%</strong> — 공휴일에 급여를 제공하면 30%를 더합니다(제33조제1항제3호). 두 가산은 중복하지 않습니다.
              </li>
              <li>
                <strong>3시간 미만 이용</strong> — 라-1 금액의 80%를 산정할 수 있습니다(제32조제6항).
              </li>
              <li>
                <strong>송영(이동서비스)·목욕</strong> — 송영 비용과 주 1회 목욕서비스 가산금(3,000원)은 따로 산정하며 수급자가
                부담하지 않습니다(제34조제3항, 제35조제1항).
              </li>
              <li>
                <strong>프로그램·교육 비용</strong> — 신체활동지원과 심신기능 유지·향상을 위한 교육·훈련 비용은 수가에 포함되어 있어
                수급자에게 따로 요구할 수 없습니다(제31조제2항).
              </li>
              <li>
                <strong>식사재료비</strong> — 장기요양급여 범위에서 제외되는 비급여 항목이라 수가에 들어 있지 않습니다(시행규칙 제14조제1항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="수급자는 얼마를 내나요">
          <div className="carev-ltc-prose">
            <p>
              주·야간보호는 재가급여라 급여비용의 <strong>15%</strong>가 본인부담입니다. 본인부담금 감경 대상자는 <strong>9%</strong>(40%
              감경) 또는 <strong>6%</strong>(60% 감경)를, 국민기초생활보장 의료급여 수급자는 본인부담 없이 이용합니다. 한 달 급여비용이
              등급별 월 한도액을 넘으면 넘는 금액은 수급자가 전부 냅니다.
            </p>
            <p>
              등급과 이용일수를 넣어 직접 계산하려면 <Link href="/ltc/daycare-copay-calculator">본인부담금 계산기</Link>를, 한도액은{' '}
              <Link href="/ltc/monthly-limit-2026">2026년 월 한도액</Link>을 보세요.
            </p>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources
          sources={[
            LTC_SOURCES.feeNotice,
            LTC_SOURCES.feeNoticeNhis,
            LTC_SOURCES.decree15_8,
            LTC_SOURCES.act40,
            LTC_SOURCES.rule14,
          ]}
        />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
