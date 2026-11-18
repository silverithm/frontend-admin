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
import { MONTHLY_LIMIT_2026, gradeLabel } from '@/lib/ltc2026';
import {
  ALL_DAY_HOME_CARE,
  FAMILY_CAREGIVER,
  HOME_CARE_FEES_2026,
  HOME_CARE_GRADES,
  HOME_CARE_SOURCES,
  HOME_CARE_VERIFIED_AT,
  SEVERE_ADD_ON_DAILY_CAP,
  homeCareFee,
  homeCareMonth,
  visitsWithinLimit,
  type HomeCareCode,
} from '@/lib/ltcHomeCare';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/home-care-fee-2026';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '2026년 방문요양 수가표';
const DESCRIPTION =
  '2026년 방문요양 수가를 1회 급여제공시간별로 정리했습니다. 60분 25,320원, 120분 43,430원, 180분 57,020원, 240분 70,080원. 등급별 제한, 하루 횟수, 1·2등급 중증 가산, 심야·일요일·유급휴일 가산, 가족인 요양보호사, 월 한도액 안 이용 횟수까지 보건복지부 고시 원문과 대조했습니다.';

const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

// 월 한도액 안 횟수 표의 열 — 가장 많이 쓰는 60·120·180·240분
const LIMIT_CODES: ReadonlyArray<{ code: HomeCareCode; label: string }> = [
  { code: '가-2', label: '60분 이상 (가-2)' },
  { code: '가-4', label: '120분 이상 (가-4)' },
  { code: '가-6', label: '180분 이상 (가-6)' },
  { code: '가-8', label: '240분 이상 (가-8)' },
];

// 예시 1 — 3등급, 1회 180분, 한 달 22회(주 5일)
const EX1 = homeCareMonth('3', '가-6', 22);
// 예시 2 — 1등급, 1회 240분, 30일 매일
const EX2 = homeCareMonth('1', '가-8', 30);
const EX2_SEVERE = SEVERE_ADD_ON_DAILY_CAP * 30;
// 예시 3 — 4등급, 1회 180분, 한 달 26회 (한도 초과)
const EX3 = homeCareMonth('4', '가-6', 26);
// 1·2등급이 240분을 31일 매일 받을 때
const DAILY_240_31 = homeCareFee('가-8') * 31;

export const metadata: Metadata = {
  title: `${TITLE} — 급여제공시간별 1회 급여비용`,
  description: DESCRIPTION,
  keywords:
    '2026 방문요양 수가, 방문요양 수가표, 방문요양 급여비용, 2026 장기요양 수가, 방문요양 시간별 수가, 방문요양 본인부담금, 가족요양 수가, 방문요양 중증 가산, 종일 방문요양',
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
    question: '2026년 방문요양 수가는 얼마인가요?',
    answer:
      '1회 방문의 급여제공시간에 따라 30분 이상 17,450원, 60분 이상 25,320원, 90분 이상 34,120원, 120분 이상 43,430원, 150분 이상 50,640원, 180분 이상 57,020원, 210분 이상 63,530원, 240분 이상 70,080원입니다(장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제18조, 2026년 1월 1일 시행).',
  },
  {
    question: '방문요양 수가는 등급마다 다른가요?',
    answer:
      '금액은 등급과 관계없이 1회 급여제공시간으로만 정해집니다. 다만 210분 이상(가-7)과 240분 이상(가-8)은 1·2등급만 1일 1회 산정하고(고시 제19조제2항, 3·4등급은 특별한 요청이 있을 때 월 4일 예외), 5등급은 인지활동형 방문요양과 종일 방문요양 외의 방문요양을 원칙적으로 받을 수 없으며(제17조제7항), 인지지원등급은 방문요양 중 종일 방문요양만 이용할 수 있습니다(제2조제3항).',
  },
  {
    question: '방문요양은 하루에 몇 번까지 받을 수 있나요?',
    answer:
      '식사도움, 외출 시 동행 등이 필요하면 같은 수급자에게 가-1~가-6(30분 이상~180분 이상 구간)을 1일 3회까지 산정할 수 있습니다. 방문 간격은 2시간 이상이어야 하고, 2시간 미만이면 각 급여제공시간을 합산해 1회로 산정합니다(고시 제19조제1항).',
  },
  {
    question: '1·2등급 중증 수급자 가산은 얼마인가요?',
    answer:
      '요양보호사가 1·2등급 수급자에게 방문요양을 제공하면 1회 60분 이상 120분 미만 2,000원, 120분 이상 180분 미만 4,000원, 180분 이상 6,000원을 더하며, 수급자 1인당 1일 6,000원을 넘을 수 없습니다. 이 가산은 수급자가 부담하지 않고, 기관은 해당 요양보호사에게 지급해야 하며, 월 한도액에도 포함되지 않습니다(고시 제19조의2, 제13조제2항제6호).',
  },
  {
    question: '밤이나 일요일·공휴일에 방문요양을 받으면 수가가 달라지나요?',
    answer:
      '22시 이후 06시 이전에 제공하면 표 금액의 30%(인지활동형 방문요양은 제외), 일요일은 30%, 근로기준법상 유급휴일과 근로자의 날은 50%를 가산합니다. 동시에 해당해도 중복하지 않고, 일요일과 유급휴일이 겹치면 50%를 적용합니다(고시 제20조제1항).',
  },
  {
    question: '가족인 요양보호사가 방문요양을 하면 수가는 얼마인가요?',
    answer:
      '1일 60분 이상 제공해도 가-2(25,320원)를 산정하고 가산은 적용하지 않으며, 1일 1회 매월 20일 범위에서 산정합니다. 65세 이상 요양보호사가 배우자에게 제공하거나, 수급자가 인정조사표에 폭력성향 등 문제행동이 표시되고 치매상병(또는 최근 2년 이내 치매진료내역)이 있으면 가-3(34,120원)을 월 20일을 넘겨 산정할 수 있습니다(고시 제23조제4항~제6항).',
  },
  {
    question: '3등급이 하루 3시간씩 주 5일 방문요양을 받으면 본인부담금은 얼마인가요?',
    answer:
      '180분 이상(57,020원)을 한 달 22회 받으면 급여비용은 1,254,440원으로 3등급 월 한도액 1,528,200원 안이고, 본인부담 15%는 188,166원입니다. 일요일·심야 가산이나 다른 재가급여를 함께 쓰면 금액이 달라집니다.',
  },
  {
    question: '종일 방문요양(가족휴가제)은 얼마인가요?',
    answer:
      '1·2등급 또는 치매가 있는 수급자가 연간 12일 이내에서 월 한도액과 관계없이 1회 12시간 이용하는 방문요양으로, 2회를 1일로 셉니다. 급여비용은 1회당 기본 98,860원이고, 이와 별도로 1회 제공당 78,820원의 가산금을 산정하며 이 가산금은 수급자가 부담하지 않습니다(고시 제36조의2·제36조의3).',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${URL}#dataset`,
  name: '2026년 방문요양 1회 급여비용(수가)표와 등급별 월 한도액 안 이용 횟수',
  description:
    '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제18조의 방문요양 1회 방문당 급여비용(분류번호 가-1~가-8, 2026년 1월 1일 시행)을 급여제공시간별로 옮기고, 제19조의2 중증 수급자 가산, 제20조 시간·날짜 가산, 제23조 가족인 요양보호사 산정 기준, 제36조의3 종일 방문요양 급여비용을 정리한 뒤, 제13조제1항 월 한도액으로 등급별 이용 가능 횟수를 계산한 표입니다.',
  url: URL,
  inLanguage: 'ko-KR',
  temporalCoverage: '2026',
  dateModified: HOME_CARE_VERIFIED_AT,
  isBasedOn: HOME_CARE_SOURCES.map((source) => source.url),
  variableMeasured: ['분류번호', '1회 급여제공시간', '1회 방문당 급여비용(원)', '장기요양등급', '월 한도액 안 이용 횟수(회)'],
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '케어브이' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: TITLE, path: PATH },
]);

const GRADE_ROWS: ReadonlyArray<{ grade: string; scope: string; basis: string }> = [
  {
    grade: '1·2등급',
    scope:
      '가-1~가-8. 가-7·가-8은 1일 1회만, 같은 날 가-1~가-6과 함께 산정하지 않음. 240분 이상 270분 미만은 가-8. 특별한 요청이 있으면 월 8일까지 270분 이상 연속 제공',
    basis: '제19조제2항~제5항',
  },
  {
    grade: '3·4등급',
    scope: '가-1~가-6. 특별한 요청이 있으면 월 4일까지 210분 이상 연속 제공 — 210분 이상은 가-7, 240분 이상 270분 미만은 가-8',
    basis: '제19조제4항·제5항제2호',
  },
  {
    grade: '5등급',
    scope:
      '인지활동형 방문요양과 종일 방문요양만. 주·야간보호를 1일 8시간 이상 이용한 날 등은 그 전후로 1일 2회, 1회 2시간까지 가-1~가-4',
    basis: '제17조제7항, 제19조제8항',
  },
  {
    grade: '인지지원등급',
    scope: '방문요양 중 종일 방문요양만(주·야간보호, 가족휴가제 단기보호, 기타재가급여와 함께)',
    basis: '제2조제3항',
  },
];

export default function HomeCareFee2026Page() {
  return (
    <>
      <script {...jsonLdScriptProps(datasetJsonLd)} />
      <script {...jsonLdScriptProps(buildLtcFaqJsonLd(URL, FAQ))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title={TITLE}
        verifiedAt={HOME_CARE_VERIFIED_AT}
        lede={
          <>
            <p>
              <strong>
                2026년 방문요양 1회 수가는 30분 이상 17,450원, 60분 이상 25,320원, 90분 이상 34,120원, 120분 이상 43,430원, 150분
                이상 50,640원, 180분 이상 57,020원, 210분 이상 63,530원, 240분 이상 70,080원입니다.
              </strong>
            </p>
            <p>
              금액은 등급과 관계없이 1회 방문의 급여제공시간으로 정해지고(보건복지부 고시 제18조, 2026년 1월 1일 시행), 210분·240분
              이상(가-7·가-8)은 원칙적으로 1·2등급만 산정합니다. 수급자는 이 금액의 15%를 내고, 한 달 합계가 월 한도액을 넘으면 넘는
              금액은 전부 냅니다.
            </p>
          </>
        }
      >
        <LtcBlock
          title="방문요양 1회 급여비용"
          description={
            <p>
              단위 원, 1회 방문당. 고시 제18조 표(분류번호 가-1~가-8). 급여제공시간은 요양보호사가 수급자의 가정에 도착했을 때부터
              준비·제공·마무리에 걸린 총 시간이고(제16조제1항), 이동 교통비는 이 금액에 포함되어 있습니다(제16조제2항).
            </p>
          }
        >
          <ScrollTable>
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">분류번호</th>
                  <th scope="col">1회 급여제공시간</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">금액</th>
                </tr>
              </thead>
              <tbody>
                {HOME_CARE_FEES_2026.map((row) => (
                  <tr key={row.code}>
                    <th scope="row">{row.code}</th>
                    <td>{row.minutes}분 이상</td>
                    <td className="carev-ltc-num carev-ltc-focus">{won(row.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </LtcBlock>

        <LtcBlock
          title="등급별로 받을 수 있는 방문요양"
          description={<p>표의 금액은 등급과 관계없이 같지만, 어떤 분류를 산정할 수 있는지는 등급에 따라 다릅니다.</p>}
        >
          <ScrollTable>
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">등급</th>
                  <th scope="col">산정할 수 있는 방문요양</th>
                  <th scope="col">근거</th>
                </tr>
              </thead>
              <tbody>
                {GRADE_ROWS.map((row) => (
                  <tr key={row.grade}>
                    <th scope="row">{row.grade}</th>
                    <td>{row.scope}</td>
                    <td>{row.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>인지활동형 방문요양</strong> — 의사소견서에 치매상병이 있거나 최근 2년 이내 치매진료내역이 있는 1~5등급 수급자에게
                치매전문교육을 이수한 요양보호사가 제공합니다. 1일 1회, 1회 120분 이상 180분 이하이며 그중 60분은 인지자극활동이어야
                합니다(제17조제4항·제5항). 동 시간대에 2명 이상에게 제공할 수 없고(제15조제3항), 5등급 치매수급자에게는 주·야간보호와
                같은 날 제공하지 않습니다(제17조제8항).
              </li>
              <li>
                <strong>270분 이상 연속 제공(1·2등급)</strong> — 최초 270분은 가-8, 270분을 넘는 나머지 시간은 그 시간에 맞는 분류의
                금액으로 2회로 나눠 산정하고, 480분 이상이면 가-8을 2회 산정합니다. 이 산정은 1일 1회이며 같은 날 다른 방문요양 급여비용은
                산정하지 않습니다(제19조제5항제1호·제3호). 급여제공기록지에 수급자 등의 동의 내용과 요청 사유를 적어야 합니다(제4항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="하루 여러 번 받을 때 — 고시 제19조">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                식사도움, 외출 시 동행 등이 필요하면 같은 수급자에게 가-1~가-6을 <strong>1일 3회</strong>까지 산정할 수 있습니다. 방문
                간격은 <strong>2시간 이상</strong>이어야 하고, 2시간 미만이면 각 급여제공시간을 합산해 1회로 산정합니다. 급여제공기록지에
                수급자 등의 동의 내용과 요청 사유를 적습니다(제1항).
              </li>
              <li>급여 제공 중 날짜가 바뀌면 시작한 날의 급여비용으로 산정하고, 다음 날 방문 간격도 2시간 이상이어야 합니다(제6항).</li>
              <li>
                수급자의 신체적·정신적 상태 때문에 같은 기관 요양보호사 2명이 동시에 제공할 수밖에 없으면 요양보호사별로 가-1~가-5를 각각
                산정하고, 그 상태를 급여제공기록지에 적습니다(제7항).
              </li>
              <li>
                같은 시간에 두 종류 이상의 재가급여를 함께 제공할 수 없습니다. 응급처치 등 부득이한 경우 방문요양과 방문간호는 함께 제공할
                수 있고, 그 사유를 기록합니다(제14조).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="수가에 더해지는 것">
          <ScrollTable>
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">구분</th>
                  <th scope="col">금액</th>
                  <th scope="col">수급자 부담 면제 규정</th>
                  <th scope="col">근거</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">22시 이후 06시 이전</th>
                  <td>표 금액의 30% (인지활동형 제외)</td>
                  <td>없음</td>
                  <td>제20조제1항제2호</td>
                </tr>
                <tr>
                  <th scope="row">일요일</th>
                  <td>표 금액의 30%</td>
                  <td>없음</td>
                  <td>제20조제1항제3호</td>
                </tr>
                <tr>
                  <th scope="row">유급휴일·근로자의 날</th>
                  <td>표 금액의 50% (일요일과 겹치면 50%)</td>
                  <td>없음</td>
                  <td>제20조제1항제4호</td>
                </tr>
                <tr>
                  <th scope="row">1·2등급 중증 수급자 가산</th>
                  <td>1회 60분 이상 120분 미만 2,000원, 120분 이상 180분 미만 4,000원, 180분 이상 6,000원 — 1일 6,000원까지</td>
                  <td>수급자가 부담하지 않음</td>
                  <td>제19조의2</td>
                </tr>
                <tr>
                  <th scope="row">원거리교통비용</th>
                  <td>거리별 방문당 금액(고시 제21조 표). 섬 안에 방문요양·방문간호 기관이 없으면 거리와 관계없이 1일 15,000원</td>
                  <td>수급자가 부담하지 않음</td>
                  <td>제21조·제22조</td>
                </tr>
              </tbody>
            </table>
          </ScrollTable>
          <div className="carev-ltc-prose">
            <ul>
              <li>
                시간·날짜 가산은 동시에 해당해도 중복하지 않습니다. 제20조제1항의 시간 가산은 22시 이후 06시 이전 한 구간이고(제1호는
                삭제), 구체적인 계산법은 국민건강보험공단 이사장이 정합니다(제20조제2항). 가산하는 날·시간에 급여가 필요한 사유는 급여제공
                계획서나 급여제공기록지에 적어야 합니다(제3항).
              </li>
              <li>
                중증 수급자 가산은 기관이 해당 요양보호사에게 지급해야 합니다(제19조의2제2항). 원거리교통비용은 별표 1 점수 합계가 7점
                이상이거나 섬·벽지 지역에 사는 수급자가 대상이고, 방문한 종사자가 수급자와 가족이거나 5km 미만의 거리에 거주하면 산정하지
                않습니다(제21조제1항, 제22조제1항).
              </li>
              <li>
                제13조제2항의 &lsquo;월 한도액에 포함되지 않는 비용&rsquo; 가운데 방문요양과 관련된 것은 원거리교통비용(제1호), 종일 방문요양 등
                가족휴가제 급여비용(제5호), 중증 수급자 가산(제6호)입니다. 심야·일요일·유급휴일 가산(제20조)은 이 목록에 없습니다.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="가족인 요양보호사가 돌볼 때 — 고시 제23조">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                가족인 요양보호사가 방문요양(인지활동형 포함)을 1일 60분 이상 제공해도 <strong>가-2({won(homeCareFee(FAMILY_CAREGIVER.code))})</strong>를
                산정하고 가산은 적용하지 않습니다(제4항).
              </li>
              <li>1일 1회에 한해 매월 {FAMILY_CAREGIVER.daysPerMonth}일 범위에서 산정합니다(제5항).</li>
              <li>
                65세 이상 요양보호사가 배우자에게 제공하는 경우, 또는 수급자가 인정조사표 행동변화 영역의 해당 항목(폭력성향, 피해망상,
                부적절한 성적 행동 같은 문제행동)에 표시되고 치매상병이나 최근 2년 이내 치매진료내역이 있는 경우에는 1일당{' '}
                <strong>가-3({won(homeCareFee(FAMILY_CAREGIVER.exceptionCode))})</strong>을 월 20일을 넘겨 산정할 수 있고, 가산은 적용하지
                않습니다(제6항).
              </li>
              <li>
                가족인 요양보호사가 소속 직장(장기요양기관 포함)에서 일한 시간의 합이 월 {FAMILY_CAREGIVER.otherJobHours}시간 이상이면
                가족인 수급자에게 제공한 급여비용을 산정하지 않습니다. 이때 가족인 수급자에게 제공한 시간은 근무시간에 넣지 않습니다(제3항). 기관은 수급자와 요양보호사의 가족관계를 확인해 공단에 통보해야 합니다(제2항).
              </li>
              <li>
                가족인 요양보호사에게 방문요양을 받은 달에는 주·야간보호 이용에 따른 월 한도액 추가 산정을 하지 않습니다(제13조제7항제2호
                단서).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="종일 방문요양(장기요양 가족휴가제) — 고시 제36조의2·제36조의3">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                1·2등급 수급자 또는 치매가 있는 수급자는 가족의 휴식을 위해 연간 {ALL_DAY_HOME_CARE.daysPerYear}일 이내에서 월 한도액과
                관계없이 방문요양을 1회 {ALL_DAY_HOME_CARE.hoursPerVisit}시간 동안 이용할 수 있고, 2회를 이용하면 1일로 셉니다. 인지지원등급도
                이용할 수 있습니다(제2조제3항).
              </li>
              <li>
                급여비용은 1회당 기본 <strong>{won(ALL_DAY_HOME_CARE.baseWon)}</strong>이고, 22시~06시·일요일 30%, 유급휴일·근로자의 날 50%를
                가산합니다(중복 없음, 가산 시간은 최대 12시간).
              </li>
              <li>
                이와 별도로 1회 제공당 <strong>{won(ALL_DAY_HOME_CARE.extraWon)}</strong>을 가산금으로 산정하며, 이 가산금은 수급자가 부담하지
                않습니다.
              </li>
              <li>
                같은 가정에 사는 대상 수급자 2명을 요양보호사 1명이 돌보면 각 수급자의 급여비용은 {ALL_DAY_HOME_CARE.twoRecipientsPercent}%를
                적용하고, 가산금은 1명만 산정합니다. 가족인 요양보호사나 생계를 같이하는 사람이 제공하면 산정하지 않습니다(제36조의3제2항·제3항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title="월 한도액으로 몇 번 받을 수 있나"
          description={
            <p>
              2026년 등급별 월 한도액(고시 제13조제1항)을 1회 금액으로 나눠 소수점 이하를 버린 횟수입니다. 가산, 다른 재가급여, 한도액
              추가 산정 없이 같은 시간으로만 받는다고 보고 케어브이가 계산했습니다.
            </p>
          }
        >
          <ScrollTable>
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">등급</th>
                  <th scope="col" className="carev-ltc-num">월 한도액</th>
                  {LIMIT_CODES.map((c) => (
                    <th key={c.code} scope="col" className={c.code === '가-6' ? 'carev-ltc-num carev-ltc-focus' : 'carev-ltc-num'}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOME_CARE_GRADES.map((grade) => (
                  <tr key={grade}>
                    <th scope="row">{gradeLabel(grade)}</th>
                    <td className="carev-ltc-num">{won(MONTHLY_LIMIT_2026[grade])}</td>
                    {LIMIT_CODES.map((c) => {
                      const visits = visitsWithinLimit(grade, c.code);
                      return (
                        <td key={c.code} className={c.code === '가-6' ? 'carev-ltc-num carev-ltc-focus' : 'carev-ltc-num'}>
                          {visits === null ? '—' : `${visits}회`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <div className="carev-ltc-prose">
            <ul>
              <li>
                가-1~가-6은 1일 3회, 가-7·가-8은 1일 1회까지 산정하므로 그 달 날수에 따라 실제 횟수는 표보다 적을 수 있습니다. 3·4등급의
                240분(가-8)은 월 4일 예외만 있어 &lsquo;—&rsquo;로 두었습니다.
              </li>
              <li>
                1·2등급은 240분을 31일 매일 받아도 {won(DAILY_240_31)}으로 월 한도액 안입니다. 180분(가-6)은 3등급 26회, 4등급 24회까지
                한도 안이라, 하루 3시간씩 주 5일(한 달 20~23회)은 두 등급 모두 한도 안에 들어갑니다.
              </li>
              <li>
                월 한도액은 방문요양만이 아니라 주·야간보호·방문목욕·방문간호 등 재가급여(복지용구 제외)를 합한 금액에 적용됩니다. 등급별
                한도액과 추가 산정 조건은 <Link href="/ltc/monthly-limit-2026">2026년 장기요양 등급별 월 한도액</Link>에 있습니다.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title="계산 예시"
          description={
            <p>
              가산 없이 방문요양만 이용하고 본인부담률 15%(일반)를 적용했습니다. 본인부담금은 월 한도액 안 금액의 15%에 한도를 넘는 금액
              전부를 더한 값입니다(시행령 제15조의8, 고시 제13조제6항).
            </p>
          }
        >
          <div className="carev-ltc-prose">
            <h3>예시 1 — 3등급, 1회 180분, 주 5일(한 달 22회)</h3>
            <ol>
              <li>
                급여비용: 57,020원 × 22회 = {won(EX1.totalFee)}. 3등급 월 한도액 {won(EX1.limit)} 안입니다.
              </li>
              <li>
                본인부담금: {won(EX1.totalFee)} × 15% = <strong>{won(EX1.copayWithinLimit)}</strong>, 공단 부담 {won(EX1.insurerShare)}.
              </li>
            </ol>

            <h3>예시 2 — 1등급, 1회 240분, 30일 매일</h3>
            <ol>
              <li>
                급여비용: 70,080원 × 30회 = {won(EX2.totalFee)}. 1등급 월 한도액 {won(EX2.limit)} 안입니다.
              </li>
              <li>
                본인부담금: {won(EX2.totalFee)} × 15% = <strong>{won(EX2.copayWithinLimit)}</strong>.
              </li>
              <li>
                중증 수급자 가산: 180분 이상이라 1회 6,000원 × 30회 = {won(EX2_SEVERE)}. 수급자가 부담하지 않고 월 한도액에도 들어가지
                않으며, 기관이 요양보호사에게 지급합니다.
              </li>
            </ol>

            <h3>예시 3 — 4등급, 1회 180분, 한 달 26회 (한도 초과)</h3>
            <ol>
              <li>
                급여비용: 57,020원 × 26회 = {won(EX3.totalFee)}. 4등급 월 한도액 {won(EX3.limit)}을 {won(EX3.overLimit)} 넘습니다.
              </li>
              <li>
                본인부담금: 한도 안 {won(EX3.coveredFee)} × 15% = {won(EX3.copayWithinLimit)}에 초과분 {won(EX3.overLimit)}을 더해{' '}
                <strong>{won(EX3.totalCopay)}</strong>.
              </li>
            </ol>
            <p>
              「의료급여법」 제3조제1항제1호에 따른 수급자는 본인부담금을 내지 않고, 감경 대상자는 본인부담금이 감경됩니다(노인장기요양보험법
              제40조제2항·제4항). 감경률별 계산 방법은 <Link href="/ltc/daycare-copay-calculator">본인부담금 계산기</Link> 페이지에
              정리했습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources
          sources={HOME_CARE_SOURCES}
          verifiedAt={HOME_CARE_VERIFIED_AT}
          note={
            <p>
              제18조의 수가표와 제13조제1항의 월 한도액표는 국가법령정보센터 본문에 그림으로만 실려 있어, 그림을 내려받아 확대해 칸마다
              읽은 뒤 국민건강보험공단 건강Law의 개정전문 PDF와 한 칸씩 대조했습니다(두 원문 모두 일치). 이 페이지의 &lsquo;월 한도액으로 몇
              번 받을 수 있나&rsquo; 표와 계산 예시는 원문 금액으로 케어브이가 계산한 값입니다.
            </p>
          }
        />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
