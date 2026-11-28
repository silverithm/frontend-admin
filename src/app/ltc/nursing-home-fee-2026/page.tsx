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
import ScrollTable from '@/components/ltc/ScrollTable';
import {
  ADMISSION_DAY,
  DEMENTIA_FACILITY_FEES_2026,
  DEMENTIA_GRADE_CHANGE_DAYS,
  DEMENTIA_NO_TRAINING_PERCENT,
  FACILITY_COPAY_PERCENT,
  FACILITY_FEE_SOURCES,
  FACILITY_FEE_TABLES_2026,
  FACILITY_FEE_VERIFIED_AT,
  OVERNIGHT,
  facilityFee,
  facilityFeeTable,
  facilityGradeLabel,
  facilityMonth,
  percentOf,
  type FacilityFeeTable,
} from '@/lib/ltcFacilityFee';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/nursing-home-fee-2026';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '2026년 요양원 수가표';
const DESCRIPTION =
  '2026년 요양원(노인요양시설) 1일 수가는 요양보호사가 입소자 2.1명당 1명 이상이면 1등급 93,070원, 2등급 86,340원, 3~5등급 81,540원, 미만이면 88,520원·82,120원·77,540원입니다. 공동생활가정·치매전담실 수가, 본인부담 20%, 입소일·외박 산정, 30일·31일 본인부담금까지 고시 원문과 대조했습니다.';

const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

const NH1 = facilityFeeTable('nursingHome1');
const NH2 = facilityFeeTable('nursingHome2');
const GH = facilityFeeTable('groupHome');

// 예시 1 — 1등급, 제1호 시설, 30일
const EX1 = facilityMonth({ dailyFee: facilityFee('바-1'), fullDays: 30 });
// 예시 2 — 2등급, 제1호 시설, 31일 중 입원 외박 3일
const EX2_FULL = 28;
const EX2_OUT = 3;
const EX2 = facilityMonth({ dailyFee: facilityFee('바-2'), fullDays: EX2_FULL, overnightDays: EX2_OUT });
// 예시 3 — 3등급(등급판정위원회 인정), 제1호 시설, 15시 입소일 + 20일
const EX3_FULL = 20;
const EX3 = facilityMonth({ dailyFee: facilityFee('바-3'), fullDays: EX3_FULL, shortDays: 1 });

const COPAY_30 = (fee: number) => facilityMonth({ dailyFee: fee, fullDays: 30 }).copay;
const COPAY_31 = (fee: number) => facilityMonth({ dailyFee: fee, fullDays: 31 }).copay;

// 본인부담 표의 행 — 제44조 아홉 칸 + 제74조제2항 여섯 칸
const COPAY_ROWS: ReadonlyArray<{ key: string; place: string; grade: string; fee: number }> = [
  ...FACILITY_FEE_TABLES_2026.flatMap((table) =>
    table.rows.map((row) => ({
      key: row.code,
      place:
        table.id === 'nursingHome1'
          ? '노인요양시설 제1호'
          : table.id === 'nursingHome2'
            ? '노인요양시설 제2호'
            : '노인요양공동생활가정',
      grade: `${facilityGradeLabel(row.grade)} (${row.code})`,
      fee: row.fee,
    }))
  ),
  ...DEMENTIA_FACILITY_FEES_2026.flatMap((row) => {
    const grade = `${facilityGradeLabel(row.grade)} (${row.code})`;
    if (row.typeB === null) {
      return [{ key: `${row.code}-${row.grade}`, place: '치매전담형 공동생활가정', grade, fee: row.typeA }];
    }
    return [
      { key: `${row.code}-${row.grade}-a`, place: '치매전담실 가형', grade, fee: row.typeA },
      { key: `${row.code}-${row.grade}-b`, place: '치매전담실 나형', grade, fee: row.typeB },
    ];
  }),
];

export const metadata: Metadata = {
  title: `${TITLE} — 노인요양시설·공동생활가정 1일 급여비용`,
  description: DESCRIPTION,
  keywords:
    '2026 요양원 수가, 요양원 수가표, 노인요양시설 급여비용, 2026 장기요양 수가, 노인요양공동생활가정 수가, 치매전담실 수가, 요양원 본인부담금, 시설급여 본인부담, 요양원 외박',
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
    question: '2026년 요양원(노인요양시설) 수가는 얼마인가요?',
    answer:
      '1일당 급여비용은 요양보호사 수가 입소자 2.1명당 1명 이상이면 1등급 93,070원, 2등급 86,340원, 3~5등급 81,540원이고, 2.1명당 1명 미만이면 1등급 88,520원, 2등급 82,120원, 3~5등급 77,540원입니다(장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제44조제1항, 2026년 1월 1일 시행).',
  },
  {
    question: '요양원 본인부담금은 얼마인가요?',
    answer:
      '시설급여는 급여비용의 20%를 수급자가 냅니다(노인장기요양보험법 시행령 제15조의8제2호). 2.1명당 1명 이상인 노인요양시설에 30일 있으면 1등급 558,420원, 2등급 518,040원, 3~5등급 489,240원입니다. 식사재료비, 본인이 원해 1·2인실을 쓸 때의 상급침실 추가비용, 이·미용비는 비급여대상이라 이 금액과 별도입니다(시행규칙 제14조제1항). 의료급여법 제3조제1항제1호의 수급자는 본인부담금을 내지 않고, 감경 대상자는 본인부담금의 100분의 60 범위에서 차등 감경될 수 있습니다(법 제40조제2항·제4항).',
  },
  {
    question: '3~5등급도 요양원에 들어갈 수 있나요?',
    answer:
      '1·2등급은 재가급여 또는 시설급여를 이용할 수 있고, 3~5등급은 원칙적으로 재가급여만 이용합니다. 다만 주수발자인 가족구성원으로부터 수발이 곤란한 경우, 주거환경이 열악하여 시설입소가 불가피한 경우, 치매 등에 따른 문제행동으로 재가급여를 이용할 수 없는 경우에 등급판정위원회로부터 시설급여가 필요한 것으로 인정받으면 시설급여를 이용할 수 있습니다(고시 제2조제2항). 이때 급여비용은 제44조 표의 3~5등급 금액입니다.',
  },
  {
    question: '노인요양공동생활가정 수가는 얼마인가요?',
    answer:
      '1일당 1등급 74,590원, 2등급 69,210원, 3~5등급 63,800원입니다(고시 제44조제2항). 노인요양시설과 달리 요양보호사 배치 비율에 따라 금액이 나뉘지 않습니다. 치매전담형 노인요양공동생활가정은 2등급 85,790원, 3~5등급 79,100원입니다(제74조제2항).',
  },
  {
    question: '요양원 치매전담실 수가는 얼마인가요?',
    answer:
      '노인요양시설 내 치매전담실은 가형이 2등급 96,950원, 3~5등급 89,400원이고, 나형이 2등급 90,160원, 3~5등급 83,140원입니다(고시 제74조제2항). 1등급 금액은 표에 없습니다. 이용대상은 의사소견서에 치매상병이 있거나 최근 2년 이내 치매진료내역이 있는 2등급(시행령 제6조제1호 해당자 제외)부터 4등급까지의 수급자와 5등급 수급자입니다(제71조제1항).',
  },
  {
    question: '요양원 입소자가 병원에 입원하거나 외박하면 수가는 어떻게 되나요?',
    answer:
      '의료기관에 입원하거나 시설장의 허가를 받아 외박하면 급여비용의 50%를 외박비용으로 산정하고, 1회당 최대 10일, 1개월에 15일까지 산정할 수 있습니다. 밤 12시를 기준으로 수급자가 의료기관이나 가정 등에서 지낸 날을 셉니다(고시 제45조제2항).',
  },
  {
    question: '입소한 날과 퇴소한 날도 하루치 수가를 내나요?',
    answer:
      '시설급여 비용은 단기보호 산정방법을 준용합니다(고시 제45조제1항). 1일은 0시부터 24시까지이고, 입·퇴소 당일 급여제공 시간이 12시간 이상이면 급여비용의 100%, 12시간 미만이면 50%를 산정합니다(제38조제1항·제2항).',
  },
  {
    question: '요양원 식비는 수가에 들어 있나요?',
    answer:
      '식사재료비는 장기요양급여의 범위에서 제외되는 비급여대상이라 수가에 들어 있지 않습니다(노인장기요양보험법 시행규칙 제14조제1항제1호). 반대로 신체활동지원과 심신기능 유지·향상을 위한 교육·훈련비용은 시설급여 비용에 포함되어 수급자에게 따로 요구할 수 없습니다(고시 제44조제3항). 기관은 비급여대상과 항목별 비용을 수급자가 잘 볼 수 있는 곳에 게시해야 합니다(시행규칙 제15조).',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${URL}#dataset`,
  name: '2026년 요양원(노인요양시설)·노인요양공동생활가정 1일 급여비용(수가)표와 본인부담금',
  description:
    '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제44조의 노인요양시설(요양보호사 입소자 2.1명당 1명 이상·미만, 분류번호 바-1~바-6)과 노인요양공동생활가정(바-7~바-9) 1일당 급여비용, 제74조제2항의 치매전담실 가형·나형과 치매전담형 노인요양공동생활가정(아-1·아-2) 1일당 급여비용(2026년 1월 1일 시행)을 옮기고, 시행령 제15조의8 시설급여 본인부담률 20%로 1일·30일·31일 본인부담금을 계산한 표입니다.',
  url: URL,
  inLanguage: 'ko-KR',
  temporalCoverage: '2026',
  dateModified: FACILITY_FEE_VERIFIED_AT,
  isBasedOn: FACILITY_FEE_SOURCES.map((source) => source.url),
  variableMeasured: ['분류번호', '기관 유형', '장기요양등급', '1일당 급여비용(원)', '본인부담금(원)'],
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '케어브이' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: TITLE, path: PATH },
]);

function FeeTable({ table }: { table: FacilityFeeTable }) {
  return (
    <ScrollTable>
      <table className="carev-ltc-table">
        <thead>
          <tr>
            <th scope="col">분류번호</th>
            <th scope="col">분류</th>
            <th scope="col" className="carev-ltc-num carev-ltc-focus">1일 금액</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.code}>
              <th scope="row">{row.code}</th>
              <td>{row.grade === '3-5' ? '제2조제2항 단서에 따른 장기요양 3~5등급' : `장기요양 ${row.grade}등급`}</td>
              <td className="carev-ltc-num carev-ltc-focus">{won(row.fee)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}

export default function NursingHomeFee2026Page() {
  return (
    <>
      <script {...jsonLdScriptProps(datasetJsonLd)} />
      <script {...jsonLdScriptProps(buildLtcFaqJsonLd(URL, FAQ))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title={TITLE}
        verifiedAt={FACILITY_FEE_VERIFIED_AT}
        lede={
          <>
            <p>
              <strong>
                2026년 요양원(노인요양시설) 1일 수가는 요양보호사를 입소자 2.1명당 1명 이상 배치하면 1등급 93,070원, 2등급 86,340원,
                3~5등급 81,540원이고, 2.1명당 1명 미만이면 1등급 88,520원, 2등급 82,120원, 3~5등급 77,540원입니다.
              </strong>
            </p>
            <p>
              노인요양공동생활가정은 1등급 74,590원, 2등급 69,210원, 3~5등급 63,800원입니다(보건복지부 고시 제44조, 2026년 1월 1일
              시행). 본인부담은 이 금액의 20%라(의료급여 수급자·감경 대상은 다름) 2.1명당 1명 이상인 노인요양시설에 30일 있으면 1등급
              본인부담금은 {won(EX1.copay)}입니다. 식사재료비·상급침실 추가비용·이미용비는 비급여라 이와 별도로 냅니다.
            </p>
          </>
        }
      >
        <LtcBlock
          title="노인요양시설 1일 급여비용 — 고시 제44조제1항"
          description={
            <p>
              단위 원, 1일당. 노인요양시설은 배치한 요양보호사 수에 따라 두 표 중 하나로 산정합니다. &lsquo;입소자 2.1명당 1명&rsquo;은
              입소자 수를 2.1로 나눠 소수점 이하를 반올림한 값이고, 계산 결과가 0.5 미만이면 기본 1명을 배치해야 합니다(제44조제1항
              각 호 외의 부분). 입소자 수별 인원은 <Link href="/ltc/nursing-home-staffing-standard">요양원 인력배치기준</Link>에 계산해 두었습니다.
            </p>
          }
        >
          <div className="carev-ltc-prose">
            <h3>제1호 — {NH1.condition}</h3>
          </div>
          <FeeTable table={NH1} />
          <div className="carev-ltc-prose">
            <h3>제2호 — {NH2.condition}</h3>
          </div>
          <FeeTable table={NH2} />
          <div className="carev-ltc-prose">
            <ul>
              <li>
                제2호 금액은 제1호보다 1일 1등급 {won(facilityFee('바-1') - facilityFee('바-4'))}, 2등급{' '}
                {won(facilityFee('바-2') - facilityFee('바-5'))}, 3~5등급 {won(facilityFee('바-3') - facilityFee('바-6'))} 적습니다.
              </li>
              <li>
                제1호 또는 제2호에 따라 산정된 급여비용이 지급된 뒤에는 이미 적용된 호의 급여비용을 바꿔 다시 산정하지 못합니다(제44조제1항제3호).
              </li>
              <li>
                &lsquo;3~5등급&rsquo;은 등급판정위원회로부터 시설급여가 필요한 것으로 인정받은 3~5등급입니다(제2조제2항 단서 — 주수발자인
                가족구성원으로부터 수발이 곤란한 경우, 주거환경이 열악하여 시설입소가 불가피한 경우, 치매 등에 따른 문제행동으로 재가급여를
                이용할 수 없는 경우). 1·2등급은 재가급여 또는 시설급여를 이용할 수 있습니다.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title="노인요양공동생활가정 1일 급여비용 — 고시 제44조제2항"
          description={<p>단위 원, 1일당. 노인요양공동생활가정은 요양보호사 배치 비율에 따라 표가 나뉘지 않습니다.</p>}
        >
          <FeeTable table={GH} />
        </LtcBlock>

        <LtcBlock
          title="치매전담실·치매전담형 공동생활가정 — 고시 제74조제2항"
          description={
            <p>
              단위 원, 1일당. 제74조제2항은 노인요양시설 내 치매전담실 가형·나형과 치매전담형 노인요양공동생활가정의 1일당 급여비용이고,
              표의 &lsquo;노인요양시설&rsquo;(아-1)은 치매전담실, &lsquo;노인요양공동생활가정&rsquo;(아-2)은 치매전담형입니다. 치매전담형
              노인요양공동생활가정은 가형·나형 구분 없이 한 금액이고, 1등급 금액은 표에 없습니다. 가형·나형은 노인복지법 시행규칙 별표 4의 치매전담실 침실면적 구분입니다(가형: 1인실 9.9㎡ 이상, 2인실
              16.5㎡ 이상, 3인실 23.1㎡ 이상, 4인실 29.7㎡ 이상 / 나형: 1인실 9.9㎡ 이상, 다인실 1명당 6.6㎡ 이상).
            </p>
          }
        >
          <ScrollTable>
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">분류번호</th>
                  <th scope="col">분류</th>
                  <th scope="col">등급</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">가형</th>
                  <th scope="col" className="carev-ltc-num">나형</th>
                </tr>
              </thead>
              <tbody>
                {DEMENTIA_FACILITY_FEES_2026.map((row) => (
                  <tr key={`${row.code}-${row.grade}`}>
                    <th scope="row">{row.code}</th>
                    <td>{row.place}</td>
                    <td>{row.grade === '3-5' ? '장기요양 3등급~5등급' : '장기요양 2등급'}</td>
                    {row.typeB === null ? (
                      <td className="carev-ltc-num carev-ltc-focus" colSpan={2}>
                        {won(row.typeA)}
                      </td>
                    ) : (
                      <>
                        <td className="carev-ltc-num carev-ltc-focus">{won(row.typeA)}</td>
                        <td className="carev-ltc-num">{won(row.typeB)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>이용대상</strong> — 의사소견서에 &lsquo;치매상병&rsquo;이 기재되어 있거나 최근 2년 이내 치매진료내역이 있는
                2등급부터 4등급까지의 수급자(2등급 중 심신상태나 거동상태가 현저하게 불편해 의사소견서 제출을 면제받은 시행령 제6조제1호
                해당자는 제외)와 5등급 수급자입니다(제71조제1항). 인지지원등급은 치매전담형 기관 중에서는 주·야간보호 내 치매전담실만
                이용할 수 있습니다(같은 항 제3호). 제71조는 치매전담형 기관의 이용대상을 정한 조문이고, 3~5등급의 시설급여 이용에 관한 일반
                원칙은 제2조제2항입니다.
              </li>
              <li>
                <strong>입소 중 등급이 바뀌면</strong> — 노인요양시설 내 치매전담실이나 치매전담형 노인요양공동생활가정에 입소 중 1등급
                또는 2등급(시행령 제6조제1호 해당자)으로 바뀌면 바뀐 날부터 {DEMENTIA_GRADE_CHANGE_DAYS}일까지 그 기관을 이용할 수
                있고(제71조제2항), 이때는 제44조의 바-1·바-2(치매전담실) 또는 바-7·바-8(치매전담형 공동생활가정) 금액을 산정합니다(제75조제4항).
              </li>
              <li>
                <strong>치매전문교육</strong> — 치매전문교육을 이수한 시설장(관리책임자) 또는 프로그램관리자가 없거나 제72조제2항의 업무를
                수행하지 않으면 급여비용의 {DEMENTIA_NO_TRAINING_PERCENT}%를 산정합니다. 월 중 퇴사로 일부 업무를 못 한 경우는 예외입니다(제75조제1항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title="본인부담금 — 1일·30일·31일"
          description={
            <p>
              시설급여 본인부담률 {FACILITY_COPAY_PERCENT}%(노인장기요양보험법 시행령 제15조의8제2호)를 1일 급여비용에 적용해 케어브이가
              계산한 값입니다. 가산·감액, 외박·입소일 50% 산정, 비급여(식사재료비 등)는 넣지 않았습니다.
            </p>
          }
        >
          <ScrollTable>
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">구분</th>
                  <th scope="col">등급</th>
                  <th scope="col" className="carev-ltc-num">1일 급여비용</th>
                  <th scope="col" className="carev-ltc-num">1일 본인부담</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">30일 본인부담</th>
                  <th scope="col" className="carev-ltc-num">31일 본인부담</th>
                </tr>
              </thead>
              <tbody>
                {COPAY_ROWS.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.place}</th>
                    <td>{row.grade}</td>
                    <td className="carev-ltc-num">{won(row.fee)}</td>
                    <td className="carev-ltc-num">{won(percentOf(row.fee, FACILITY_COPAY_PERCENT))}</td>
                    <td className="carev-ltc-num carev-ltc-focus">{won(COPAY_30(row.fee))}</td>
                    <td className="carev-ltc-num">{won(COPAY_31(row.fee))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <div className="carev-ltc-prose">
            <ul>
              <li>
                「의료급여법」 제3조제1항제1호에 따른 수급자는 본인부담금을 내지 않고, 같은 항 제2호~제9호의 수급권자, 소득·재산 등이 고시
                금액 이하인 사람, 천재지변 등으로 생계가 곤란한 사람은 본인부담금의 100분의 60 범위에서 차등 감경될 수 있습니다(노인장기요양보험법 제40조제2항·제4항).
              </li>
              <li>
                시설급여의 월 한도액은 등급별 1일당 급여비용에 월간 일수를 곱해 산정합니다(노인장기요양보험법 시행규칙 제22조제2항, 법
                제28조). 재가급여(복지용구 제외)는 등급별로 고시한 금액이 월 한도액이며(시행규칙 제22조제1항){' '}
                <Link href="/ltc/monthly-limit-2026">2026년 장기요양 등급별 월 한도액</Link>에 있습니다.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="입소일·퇴소일·외박은 어떻게 세나 — 고시 제45조·제38조·제46조">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                시설급여 비용 산정은 단기보호 급여비용 산정 방법(제38조)을 준용합니다(제45조제1항). 급여비용은 일 단위로 산정하며 1일은
                0시부터 24시까지입니다(제38조제1항).
              </li>
              <li>
                입·퇴소 당일 급여제공 시간이 <strong>{ADMISSION_DAY.fullHours}시간 이상</strong>이면 급여비용의 100%,{' '}
                <strong>{ADMISSION_DAY.fullHours}시간 미만</strong>이면 {ADMISSION_DAY.shortPercent}%를 산정합니다(제38조제2항).
              </li>
              <li>
                수급자가 의료기관에 입원하거나 시설장의 허가를 받아 외박하면 급여비용의 <strong>{OVERNIGHT.percent}%</strong>를
                외박비용으로 산정하되, 1회당 최대 {OVERNIGHT.maxDaysPerStay}일(1개월에 {OVERNIGHT.maxDaysPerMonth}일)까지 산정할 수
                있습니다. 외박비용은 수급자가 의료기관이나 가정 등에서 지낸 날(기준시간은 밤 12시)에 산정하고, 급여계약 때 외박비용으로 생기는
                본인부담금을 미리 안내하며, 외박 시작·종료 일시와 사유를 급여제공기록지에 적어야 합니다(제45조제2항).
              </li>
              <li>
                외박 최초 10일간은 외박자 대신 다른 수급자를 입소시킬 수 없고, 10일을 넘긴 때부터 외박자를 대신해 다른 수급자(특례입소자)를
                입소시킬 수 있습니다. 이미 입소 중인 사람을 특례입소자로 바꿀 수는 없고, 특례입소자 수는 정원의 5%(소수점 이하 반올림, 정원
                10명 미만 시설은 1명) 범위이며 외박자 1명당 1명을 넘을 수 없습니다(제46조제1항~제3항).
              </li>
              <li>
                단기보호와 시설급여를 병설하는 기관이 같은 수급자에게 같은 달 단기보호와 시설급여를 모두 제공하면 한 종류의 급여비용만
                산정합니다(제38조제4항). 동일 부지 안에서 같은 대표자가 운영하는 주·야간보호기관·단기보호기관·시설급여기관이 같은 날 같은
                수급자에게 여러 급여를 제공하면 하나의 급여에 대해서만 급여비용을 산정합니다(제45조제3항, 제32조제9항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="수가에 들어 있는 것, 따로 내는 것">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                시설급여 비용은 신체활동지원과 심신기능 유지·향상을 위한 교육·훈련비용 등을 포함하며, 이를 수급자에게 따로 요구해서는 안
                됩니다(고시 제44조제3항).
              </li>
              <li>
                장기요양급여의 범위에서 제외되는 <strong>비급여대상</strong>은 ① 식사재료비 ② 상급침실 이용에 따른 추가비용(노인요양시설
                또는 노인요양공동생활가정에서 본인이 원해 1인실 또는 2인실을 이용하는 경우) ③ 이·미용비 ④ 그 밖에 일상생활에 통상 필요한
                것과 관련된 비용으로 보건복지부장관이 고시한 비용입니다(노인장기요양보험법 시행규칙 제14조제1항). 이 비용은 위 수가와
                본인부담 20%에 들어 있지 않습니다.
              </li>
              <li>
                장기요양기관은 비급여대상과 항목별 비용을 수급자가 잘 볼 수 있는 곳에 게시해야 합니다(시행규칙 제15조).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="제1호·제2호와 가산·감액">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                제2호(2.1명당 1명 미만)로 급여비용을 산정하는 노인요양시설의 요양보호사 인력배치기준 위반 감액은 입소자 2.3명당 1명 배치
                기준으로 따집니다(고시 제66조제4항). 제1호든 제2호든 감액은 지급받은 급여비용을 기준으로 적용합니다(제5항).
              </li>
              <li>
                요양보호사 초과 배치 한시 가산(제56조의2)은 제1호 급여비용을 산정하는 노인요양시설(치매전담실 제외)의 입소자 수가 줄어 전월
                대비 요양보호사 의무배치인원이 감소한 경우에 적용되며, 부칙에 따라 2026년 12월 31일까지 효력을 가집니다. 인력추가배치·간호사배치·야간직원배치 가산은{' '}
                <Link href="/ltc/nursing-home-staffing-bonus">요양원 인력추가배치 가산</Link>과{' '}
                <Link href="/ltc/group-home-staffing-bonus">노인요양공동생활가정 인력추가배치 가산</Link>에 정리했습니다.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title="계산 예시"
          description={
            <p>
              가산·감액과 비급여 없이 본인부담률 20%(일반)를 적용했습니다. 본인부담금은 그달 급여비용 합계의 20%입니다(시행령 제15조의8제2호).
            </p>
          }
        >
          <div className="carev-ltc-prose">
            <h3>예시 1 — 1등급, 2.1명당 1명 이상인 노인요양시설, 30일</h3>
            <ol>
              <li>급여비용: 93,070원 × 30일 = {won(EX1.totalFee)}.</li>
              <li>
                본인부담금: {won(EX1.totalFee)} × 20% = <strong>{won(EX1.copay)}</strong>, 공단 부담 {won(EX1.insurerShare)}.
              </li>
            </ol>

            <h3>예시 2 — 2등급, 같은 시설, 31일 중 병원 입원으로 외박 3일</h3>
            <ol>
              <li>
                밤 12시 기준으로 의료기관에서 지낸 날이 3일이고 나머지 {EX2_FULL}일은 시설에서 지냈다고 보면, 86,340원 × {EX2_FULL}일 ={' '}
                {won(facilityFee('바-2') * EX2_FULL)}, 외박비용 86,340원 × 50% = {won(percentOf(facilityFee('바-2'), OVERNIGHT.percent))} ×{' '}
                {EX2_OUT}일 = {won(percentOf(facilityFee('바-2'), OVERNIGHT.percent) * EX2_OUT)}.
              </li>
              <li>
                급여비용 합계 {won(EX2.totalFee)}, 본인부담금 {won(EX2.totalFee)} × 20% = <strong>{won(EX2.copay)}</strong>.
              </li>
            </ol>

            <h3>예시 3 — 3등급(등급판정위원회 인정), 같은 시설, 오후 3시 입소 + 20일</h3>
            <ol>
              <li>
                입소일 급여제공 시간은 15시~24시 9시간으로 12시간 미만이라 81,540원 × 50% ={' '}
                {won(percentOf(facilityFee('바-3'), ADMISSION_DAY.shortPercent))}.
              </li>
              <li>
                다음 날부터 {EX3_FULL}일: 81,540원 × {EX3_FULL}일 = {won(facilityFee('바-3') * EX3_FULL)}. 합계 {won(EX3.totalFee)}.
              </li>
              <li>
                본인부담금: {won(EX3.totalFee)} × 20% = <strong>{won(EX3.copay)}</strong>.
              </li>
            </ol>
            <p>
              위 금액에 식사재료비 등 비급여 비용이 더해집니다. 같은 계산을 주·야간보호에 적용한 예시는{' '}
              <Link href="/ltc/daycare-copay-calculator">본인부담금 계산기</Link>에 있습니다(재가급여 본인부담률은 15%).
            </p>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources
          sources={FACILITY_FEE_SOURCES}
          verifiedAt={FACILITY_FEE_VERIFIED_AT}
          note={
            <p>
              제44조와 제74조제2항의 표는 국가법령정보센터 본문(제2026-189호)에 그림으로만 실려 있어, 그림을 내려받아 확대해 칸마다 읽은 뒤
              국민건강보험공단 건강Law의 제2025-247호(2026년 1월 1일 시행) 개정전문 PDF와 한 칸씩 대조했습니다(15칸 모두 일치).
              제2026-189호(2026년 10월 1일 시행)의 개정 내용에는 시설급여 표가 없습니다. 본인부담금 표와 계산 예시는 원문 금액으로
              케어브이가 계산한 값입니다.
            </p>
          }
        />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
