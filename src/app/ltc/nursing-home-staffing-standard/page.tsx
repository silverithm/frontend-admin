import { Metadata } from 'next';
import Link from 'next/link';
import {
  LtcBlock,
  LtcFaq,
  LtcPage,
  LtcRelated,
  LtcSources,
  buildLtcFaqJsonLd,
  formatKoreanDate,
  type LtcFaqItem,
} from '@/components/ltc/LtcParts';
import { monthlyStandardHours } from '@/lib/ltcStaffing';
import {
  DEMENTIA_UNIT_MAX_RESIDENTS,
  GROUP_HOME_RESIDENTS,
  NURSING_HOME_MIN_RESIDENTS,
  NURSING_HOME_ROLE_ROWS,
  NURSING_HOME_SOURCES,
  NURSING_HOME_VERIFIED_AT,
  RATIO_CHANGE_DEADLINE,
  RATIO_CHANGE_EFFECTIVE,
  bandLabel,
  nursingHomeExample,
  requiredStaff,
  staffBands,
  type RoleCell,
} from '@/lib/ltcNursingHomeStaffing';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/nursing-home-staffing-standard';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '요양원 인력배치기준';
const DESCRIPTION =
  '요양원(노인요양시설)은 입소자 2.1명당 요양보호사 1명 이상, 치매전담실은 2명당 1명 이상을 둬야 합니다. 2025년 1월 1일 2.3명당에서 바뀐 기준으로, 그 전부터 운영하던 시설은 2026년 12월 31일까지 갖춰야 합니다. 입소자 수별 인원과 직종별 기준을 노인복지법 시행규칙 별표 4·장기요양 고시 원문과 대조해 정리했습니다.';

const MAX_TABLE_RESIDENTS = 100;
const GENERAL_BANDS = staffBands('nursingHome', NURSING_HOME_MIN_RESIDENTS, MAX_TABLE_RESIDENTS);
const DEMENTIA_BANDS = staffBands('dementiaUnit', 1, DEMENTIA_UNIT_MAX_RESIDENTS);
const GROUP_HOME_SIZES = Array.from(
  { length: GROUP_HOME_RESIDENTS.to - GROUP_HOME_RESIDENTS.from + 1 },
  (_, index) => GROUP_HOME_RESIDENTS.from + index,
);

const COMPARE_RESIDENTS = [30, 50, 70, 100];
const EXAMPLE_RESIDENTS = [29, 30, 50, 70, 100];
const EXAMPLE_ROWS = nursingHomeExample(EXAMPLE_RESIDENTS);

const NOV_2026_HOURS = monthlyStandardHours(2026, 11, []);
const DEC_2026_HOURS = monthlyStandardHours(2026, 12, [25]);

const EFFECTIVE_LABEL = formatKoreanDate(RATIO_CHANGE_EFFECTIVE);
const DEADLINE_LABEL = formatKoreanDate(RATIO_CHANGE_DEADLINE);

export const metadata: Metadata = {
  title: `${TITLE} — 노인요양시설 요양보호사 2.1명당 1명과 직종별 기준`,
  description: DESCRIPTION,
  keywords:
    '요양원 인력배치기준, 노인요양시설 인력배치기준, 요양원 요양보호사 배치기준, 요양보호사 2.1명당 1명, 요양보호사 2.3명 2.1명, 치매전담실 요양보호사, 노인요양공동생활가정 인력기준, 요양원 직원배치기준',
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
    question: '요양원 요양보호사는 입소자 몇 명당 1명인가요?',
    answer:
      '노인요양시설은 입소자 2.1명당 1명 이상, 치매전담실은 입소자 2명당 1명 이상입니다. 노인요양공동생활가정은 입소자 3명당 1명(치매전담형은 2.5명당 1명)입니다(노인복지법 시행규칙 별표 4 제6호).',
  },
  {
    question: '입소자 50명이면 요양보호사는 몇 명이 필요한가요?',
    answer:
      '50 ÷ 2.1 = 23.81이고 소수점 이하를 반올림하므로 24명입니다. 계산 결과가 0.5 미만이면 기본 1명을 둡니다(장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제44조제1항·제48조제1항).',
  },
  {
    question: '요양보호사 2.3명당 1명이 2.1명당 1명으로 언제 바뀌었나요?',
    answer:
      '2024년 12월 31일 개정된 노인복지법 시행규칙 별표 4(보건복지부령 제1082호)가 2025년 1월 1일부터 시행되면서 바뀌었습니다. 그 전부터 설치·운영하던 노인요양시설은 2026년 12월 31일까지 개정된 직원배치기준을 갖춰야 합니다(같은 부령 부칙 제2조).',
  },
  {
    question: '요양보호사가 입소자 2.1명당 1명에 못 미치면 급여비용은 어떻게 되나요?',
    answer:
      '노인요양시설의 1일당 급여비용은 요양보호사 수가 입소자 2.1명당 1명 이상이면 고시 제44조제1항제1호, 미만이면 제2호의 금액으로 산정합니다. 제2호로 산정하는 경우 요양보호사 인력배치기준 위반 감액은 입소자 2.3명당 1명 기준으로 따집니다(제66조제4항).',
  },
  {
    question: '입소자 30명 미만 요양원은 어떤 직원을 둬야 하나요?',
    answer:
      '별표 4 표의 입소자 30명 미만 10명 이상 행은 시설의 장 1명, 사무국장·사회복지사가 합쳐진 칸 1명, 의사 또는 계약의사 1명, 간호사 또는 간호조무사 1명, 요양보호사 입소자 2.1명당 1명(치매전담실은 2명당 1명), 조리원 1명입니다. 물리치료사 또는 작업치료사, 사무원, 영양사, 위생원, 관리인 칸은 비어 있습니다.',
  },
  {
    question: '요양원 간호사(간호조무사)는 몇 명 둬야 하나요?',
    answer:
      '입소자 30명 이상이면 입소자 25명당 1명이고, 30명 미만 10명 이상은 1명입니다(별표 4 제6호). 급여비용 가산·감액을 따질 때는 소수점 이하를 반올림하므로 30~37명은 1명, 38~62명은 2명, 63~87명은 3명입니다(장기요양 급여비용 고시 제48조제1항).',
  },
  {
    question: '치매전담실 요양보호사는 일반실과 따로 세나요?',
    answer:
      '따로 셉니다. 입소자 수는 치매전담실 가형·나형과 일반실을 각각 나눠 세고, 요양보호사 위반 감액도 실별로 적용합니다(고시 제47조제2항제4호, 제66조제2항). 치매전담형 장기요양기관(노인요양시설 내 치매전담실 가형·나형 등, 제70조)에서 치매전문요양보호사가 아닌 요양보호사가 일하면 1명을 0.5명으로 셉니다(제51조제1항 단서).',
  },
  {
    question: '야간 근무가 다음 달 1일로 넘어가면 어느 달 근무시간으로 세나요?',
    answer:
      '근무시간이 매월 말일에서 다음 날 1일까지 이어지면 근무가 시작된 달의 근무시간으로 셉니다(고시 제49조제3항).',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${URL}#dataset`,
  name: '요양원(노인요양시설·노인요양공동생활가정) 직종별 인력배치기준과 입소자 수별 요양보호사 최소 인원',
  description:
    '노인복지법 시행규칙 별표 4 제6호의 노인요양시설(입소자 30명 이상, 30명 미만 10명 이상)과 노인요양공동생활가정 직종별 배치 기준을 옮기고, 장기요양 급여비용 고시 제44조제1항·제48조제1항의 반올림 규칙을 적용해 일반실(입소자 2.1명당 1명), 치매전담실(2명당 1명), 노인요양공동생활가정(3명당 1명, 치매전담형 2.5명당 1명)의 입소자 수별 요양보호사 최소 인원과 개정 전 2.3명당 기준을 계산한 표입니다.',
  url: URL,
  inLanguage: 'ko-KR',
  dateModified: NURSING_HOME_VERIFIED_AT,
  isBasedOn: NURSING_HOME_SOURCES.map((source) => source.url),
  variableMeasured: ['직종', '입소자 수', '요양보호사 최소 인원(명)'],
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '케어브이' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: TITLE, path: PATH },
]);

function RoleTd({ cell, focus }: { cell: RoleCell; focus?: boolean }) {
  if (cell.covered) return null;
  return (
    <td rowSpan={cell.rowSpan} className={focus ? 'carev-ltc-focus' : undefined}>
      {cell.text}
    </td>
  );
}

export default function NursingHomeStaffingStandardPage() {
  return (
    <>
      <script {...jsonLdScriptProps(datasetJsonLd)} />
      <script {...jsonLdScriptProps(buildLtcFaqJsonLd(URL, FAQ))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title={TITLE}
        badge="별표 4 · 고시 제2026-189호 기준"
        verifiedAt={NURSING_HOME_VERIFIED_AT}
        lede={
          <>
            <p>
              <strong>
                요양원(노인요양시설)은 입소자 2.1명당 요양보호사 1명 이상을 둬야 하고, 치매전담실은 입소자 2명당 1명 이상입니다.
              </strong>
            </p>
            <p>
              노인요양공동생활가정은 입소자 3명당 1명(치매전담형은 2.5명당 1명)입니다. 2.1명당 기준은 {EFFECTIVE_LABEL}부터 시행된
              개정으로 2.3명당에서 바뀌었고, 그 전부터 운영하던 노인요양시설은 {DEADLINE_LABEL}까지 갖춰야 합니다. 장기요양 급여비용
              고시에서 요양보호사 수는 입소자 수를 2.1(치매전담실은 2)로 나눠 소수점 이하를 반올림하고, 0.5 미만이면 1명입니다(제44조제1항·제48조제1항).
            </p>
          </>
        }
      >
        <LtcBlock
          title="직종별 배치 기준"
          description={
            <p>
              노인복지법 시행규칙 별표 4 제6호 표를 직종이 행이 되도록 옮겼습니다. 괄호 안 글자는 원문 그대로이고, &lsquo;—&rsquo;는 원문
              칸이 비어 있는 곳입니다. 노인장기요양보험법 시행규칙 제23조제2항제2호에 따라 시설급여를 하는 장기요양기관도 이 별표의
              인력을 갖춰야 합니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">직종</th>
                  <th scope="col" className="carev-ltc-focus">
                    노인요양시설
                    <br />
                    입소자 30명 이상
                  </th>
                  <th scope="col">
                    노인요양시설
                    <br />
                    입소자 30명 미만 10명 이상
                  </th>
                  <th scope="col">노인요양공동생활가정</th>
                </tr>
              </thead>
              <tbody>
                {NURSING_HOME_ROLE_ROWS.map((row) => (
                  <tr key={row.role}>
                    <th scope="row">{row.role}</th>
                    <RoleTd cell={row.over30} focus />
                    <RoleTd cell={row.under30} />
                    <RoleTd cell={row.groupHome} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>합쳐진 칸</strong> — 원문 표에서 입소자 30명 미만 10명 이상 행은 사무국장·사회복지사 두 칸이 하나로 합쳐져
                &lsquo;1명&rsquo;입니다. 노인요양공동생활가정은 시설의 장·사무국장·사회복지사 세 칸이 합쳐진 한 칸이 &lsquo;1명&rsquo;,
                간호사 또는 간호조무사·물리치료사 또는 작업치료사 두 칸이 합쳐진 한 칸이 &lsquo;1명&rsquo;입니다.
              </li>
              <li>
                <strong>입소정원</strong> — 노인요양시설은 10명 이상이고 치매전담실은 1실당 정원 {DEMENTIA_UNIT_MAX_RESIDENTS}명
                이하, 노인요양공동생활가정은 {GROUP_HOME_RESIDENTS.from}명 이상 {GROUP_HOME_RESIDENTS.to}명 이하입니다(별표 4
                제1호가목).
              </li>
              <li>
                <strong>의사</strong>는 한의사를 포함하고, <strong>계약의사</strong>는 의사·한의사·치과의사를 포함합니다. 의료기관과
                협약을 맺어 의료연계체계를 구축하면 의사 또는 계약의사를 두지 않을 수 있습니다(비고 3·4). 의료기관의 일부를 시설로
                신고했다면 의료인인 의료기관의 장이 시설의 장을 겸할 수 있습니다(비고 1).
              </li>
              <li>
                <strong>위탁</strong> — 영양사와 조리원이 소속된 업체에 급식을 위탁하면 영양사·조리원을, 세탁물을 전량 위탁하면
                위생원을 두지 않을 수 있습니다(비고 6·7).
              </li>
              <li>
                <strong>치매전담실·치매전담형</strong> — 보건복지부장관이 정하는 자격을 갖춘 프로그램관리자를 둬야 하고, 시설의 장·
                요양보호사·프로그램관리자는 치매전문교육을 이수해야 합니다(비고 9·10, 고시 제72조제1항).
              </li>
              <li>모든 종사자는 시설 설치·운영자와 근로계약을 맺은 사람이어야 합니다(비고 8).</li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title={`2.3명당에서 2.1명당으로 — 기존 시설은 ${DEADLINE_LABEL}까지`}
          description={
            <p>
              별표 4 제6호의 노인요양시설 요양보호사 기준은 2024년 12월 31일 개정(보건복지부령 제1082호)으로 &lsquo;입소자 2.3명당
              1명&rsquo;에서 &lsquo;입소자 2.1명당 1명&rsquo;이 됐고 {EFFECTIVE_LABEL}부터 시행됐습니다. 직전 별표(2022년 8월 31일
              개정)와 글자를 맞춰 보면 바뀐 곳은 입소자 30명 이상 행과 30명 미만 10명 이상 행의 요양보호사 두 칸뿐입니다.
              치매전담실(2명당 1명)과 노인요양공동생활가정(3명당 1명, 치매전담형 2.5명당 1명)은 그대로입니다.
            </p>
          }
        >
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>유예 기한</strong> — 개정 규칙 시행 당시 종전 규정에 따라 설치·운영 중인 노인요양시설은 {DEADLINE_LABEL}까지
                개정된 직원배치기준을 충족해야 합니다(보건복지부령 제1082호 부칙 제2조).
              </li>
              <li>
                <strong>급여비용</strong> — 노인요양시설의 1일당 급여비용은 요양보호사 수가 입소자 2.1명당 1명 이상이면 고시
                제44조제1항제1호, 미만이면 제2호의 금액으로 산정합니다. 한 번 지급된 뒤에는 제1호·제2호를 바꿔 다시 산정하지
                못합니다(제44조제1항제3호).
              </li>
              <li>
                <strong>감액 기준</strong> — 제2호로 급여비용을 산정하는 노인요양시설의 요양보호사 인력배치기준 위반 감액은 입소자
                2.3명당 1명 기준으로 따지고, 감액은 지급받은 급여비용을 기준으로 적용합니다(제66조제4항·제5항).
              </li>
            </ul>
          </div>
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">입소자 수</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">
                    2.1명당 1명
                    <br />
                    (현행)
                  </th>
                  <th scope="col" className="carev-ltc-num">
                    2.3명당 1명
                    <br />
                    (개정 전·제66조제4항)
                  </th>
                  <th scope="col" className="carev-ltc-num">차이</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_RESIDENTS.map((residents) => {
                  const now = requiredStaff(residents, 'nursingHome');
                  const before = requiredStaff(residents, 'nursingHomeBefore2025');
                  return (
                    <tr key={residents}>
                      <th scope="row">{residents}명</th>
                      <td className="carev-ltc-num carev-ltc-focus">{now}명</td>
                      <td className="carev-ltc-num">{before}명</td>
                      <td className="carev-ltc-num">{now - before}명</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </LtcBlock>

        <LtcBlock
          title="입소자 수별 요양보호사 최소 인원 — 노인요양시설"
          description={
            <p>
              입소자 수를 2.1로 나눠 소수점 이하를 반올림합니다(고시 제44조제1항·제48조제1항). 예를 들어 입소자 29명은 13.81이라
              14명, 50명은 23.81이라 24명입니다. {MAX_TABLE_RESIDENTS + 1}명 이상도 같은 방법으로 계산합니다. 치매전담실 입소자는
              빼고 일반실 입소자만 셉니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">입소자 수</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">요양보호사 최소 인원</th>
                </tr>
              </thead>
              <tbody>
                {GENERAL_BANDS.map((band) => (
                  <tr key={band.from}>
                    <th scope="row">{bandLabel(band)}</th>
                    <td className="carev-ltc-num carev-ltc-focus">{band.staff}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LtcBlock>

        <LtcBlock
          title="치매전담실 — 입소자 2명당 1명"
          description={
            <p>
              입소자 수를 2로 나눠 반올림합니다. 3명은 1.5라 2명, 13명은 6.5라 7명입니다. 치매전담실 가형·나형과 일반실은 입소자 수를
              각각 세고, 요양보호사 위반 감액도 실별로 따집니다(고시 제47조제2항제4호, 제66조제2항). 1실당 정원이{' '}
              {DEMENTIA_UNIT_MAX_RESIDENTS}명 이하라 그 범위만 계산했습니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">치매전담실 입소자 수</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">요양보호사 최소 인원</th>
                </tr>
              </thead>
              <tbody>
                {DEMENTIA_BANDS.map((band) => (
                  <tr key={band.from}>
                    <th scope="row">{bandLabel(band)}</th>
                    <td className="carev-ltc-num carev-ltc-focus">{band.staff}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LtcBlock>

        <LtcBlock
          title="노인요양공동생활가정 — 입소자 3명당 1명"
          description={
            <p>
              입소정원이 {GROUP_HOME_RESIDENTS.from}~{GROUP_HOME_RESIDENTS.to}명이라 그 범위를 모두 계산했습니다. 입소자 7명은 7 ÷ 3
              = 2.33이라 2명, 치매전담형은 7 ÷ 2.5 = 2.8이라 3명입니다. 그 밖의 직원은 원문 표에서 시설의 장·사무국장·사회복지사 세
              칸을 합친 칸이 1명, 간호사 또는 간호조무사·물리치료사 또는 작업치료사 두 칸을 합친 칸이 1명이고, 나머지 직종 칸은 비어
              있습니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">입소자 수</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">요양보호사 (3명당 1명)</th>
                  <th scope="col" className="carev-ltc-num">치매전담형 (2.5명당 1명)</th>
                </tr>
              </thead>
              <tbody>
                {GROUP_HOME_SIZES.map((residents) => (
                  <tr key={residents}>
                    <th scope="row">{residents}명</th>
                    <td className="carev-ltc-num carev-ltc-focus">{requiredStaff(residents, 'groupHome')}명</td>
                    <td className="carev-ltc-num">{requiredStaff(residents, 'groupHomeDementia')}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LtcBlock>

        <LtcBlock
          title="입소자 수별 직종 인원 예시 — 노인요양시설"
          description={
            <p>
              치매전담실이 없는 노인요양시설에 별표 4 제6호를 적용하고 25명당·2.1명당 기준은 소수점 이하를 반올림했습니다(고시
              제48조제1항). 29명은 &lsquo;30명 미만 10명 이상&rsquo; 행, 30명부터는 &lsquo;30명 이상&rsquo; 행을 따릅니다. 급식·세탁을
              위탁하거나 의료기관과 협약을 맺었다면 위 비고에 따라 두지 않아도 되는 직종이 있습니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">직종</th>
                  {EXAMPLE_RESIDENTS.map((residents) => (
                    <th key={residents} scope="col" className="carev-ltc-num">
                      입소자 {residents}명
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXAMPLE_ROWS.map((row) => (
                  <tr key={row.role}>
                    <th scope="row">{row.role}</th>
                    {row.values.map((value, index) => (
                      <td key={EXAMPLE_RESIDENTS[index]} className="carev-ltc-num">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LtcBlock>

        <LtcBlock title="입소자 수는 어떻게 세나">
          <div className="carev-ltc-prose">
            <p>급여비용 가산·감액을 따질 때 입소자 수는 정원이 아니라 고시 제47조에 따라 센 그달의 입소자 수입니다.</p>
            <ul>
              <li>
                월 입소자 수는 날짜별 입소자 수를 모두 더해 그달 급여제공일수로 나누고 소수점 이하를 반올림합니다(제47조제2항제1호).
              </li>
              <li>날짜별 입소자 수에는 입소한 사람은 넣고 퇴소한 사람은 넣지 않습니다(제47조제2항제3호).</li>
              <li>장기요양 수급자뿐 아니라 등급외자 등도 포함합니다(제47조제1항제1호).</li>
              <li>
                외박한 입소자는 외박비용을 산정하는 기간에는 넣고, 그 기간을 넘으면 넣지 않습니다(제47조제1항제2호). 외박비용은 1회
                최대 10일, 1개월에 15일까지 산정합니다(제45조제2항제1호).
              </li>
              <li>
                특례입소자는 넣되, 외박자가 돌아와 일시적으로 정원을 넘긴 기간에는 넣지 않습니다(제47조제1항제5호).
              </li>
              <li>치매전담실 가형·나형과 일반실은 각각 나눠 셉니다(제47조제2항제4호).</li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="근무인원 1명은 어떻게 세나">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>월 기준 근무시간</strong>은 그달의 공휴일·근로자의 날·토요일을 뺀 근무가능일수 × 8시간입니다(제49조제1항).
                2026년 11월은 21일 × 8 = {NOV_2026_HOURS}시간, 12월은 성탄절(25일)을 빼고 22일 × 8 = {DEC_2026_HOURS}시간입니다.
                1~12월 값은 <Link href="/ltc/monthly-standard-hours-2026">2026년 월 기준 근무시간</Link>에 정리했습니다.
              </li>
              <li>
                근무시간이 매월 말일에서 다음 날 1일까지 이어지면 근무가 시작된 달의 근무시간으로 셉니다(제49조제3항). 말일 밤에
                시작한 야간 근무는 그달 근무시간입니다.
              </li>
              <li>
                휴게시간을 뺀 실제 근무시간이 월 기준 근무시간 이상이고, 지자체에 신고한 직종으로 근무해야 1명으로 셉니다(제50조제1항,
                제51조제1항).
              </li>
              <li>
                월 기준 근무시간에 못 미치는 같은 직종 직원들은 근무시간을 합해 월 기준 근무시간으로 나눈 값으로 셀 수 있습니다.
                치매전담실과 일반실의 요양보호사는 나눠 세고, 가산은 소수점 이하를 버리고, 감액은 소수점 둘째자리를 버린 뒤
                첫째자리가 4 이하면 그것도 버립니다(제51조제3항).
              </li>
              <li>
                조리원·위생원·사무원·관리인 등이 없거나 일손이 필요해 다른 직원이 그 업무를 일부 맡아도, 그 직원은 신고한 직종으로
                실근무한 것으로 봅니다(제51조제2항).
              </li>
              <li>연차 유급휴가 등 공단 이사장이 정하는 사유는 근무시간으로 인정합니다(제51조제4항).</li>
              <li>
                치매전담형 장기요양기관(노인요양시설 내 치매전담실 가형·나형, 치매전담형 노인요양공동생활가정 등 — 제70조)에서
                치매전문요양보호사가 아닌 요양보호사가 일하면 1명을 0.5명으로 셉니다. 치매전문교육을 이수한 날이 속한 달은
                치매전문요양보호사로 근무한 것으로 봅니다(제51조제1항 단서).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="기준을 못 맞추면">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>인력배치기준 위반 감액</strong> — 위반한 기간의 급여비용을 감액합니다. 시설장, 요양보호사, 간호(조무)사,
                사회복지사, 물리(작업)치료사, 영양사, 조리원, 위생원, 보조원(운전사) 9개 직종에 적용하고, 치매전담실 요양보호사는
                실별로 따집니다(제66조제1항·제2항). 직종별 감산점수 표는 고시 제66조 원문에 있습니다. 별표 4의 사무국장, 의사 또는
                계약의사, 사무원, 관리인은 이 9개 직종에 없지만, 별표 4의 배치기준은 그대로 갖춰야 합니다.
              </li>
              <li>
                <strong>연속 위반</strong> — 2개월 이상 이어지면 그달 감산점수를 입소자 30명 미만은 1.2배, 30명 이상은 1.5배로
                산정합니다(제66조제3항).
              </li>
              <li>
                <strong>감액 상한</strong> — 정원초과 감액과 인력배치기준 위반 감액의 합이 급여비용의 50%를 넘으면 급여비용의
                50%를 산정합니다(제64조).
              </li>
              <li>
                <strong>입소자가 늘어난 달</strong> — 요양보호사·간호(조무)사·사회복지사·물리(작업)치료사는 전월에 그 직종 기준을
                지켰고 그달 정원을 넘지 않았다면, 늘어난 입소자 때문에 생긴 위반을 직종별로 반기 1회 감액하지 않습니다. 이때 노인요양시설
                요양보호사 의무 인원은 직전 달 배치기준으로 계산합니다(제67조제1항).
              </li>
              <li>
                <strong>갑작스러운 퇴사</strong> — 요건을 갖추면 후임을 뽑을 때까지 30일(공휴일·근로자의 날·토요일 제외) 동안 그 직종
                1명이 하루 8시간 근무한 것으로 인정합니다. 채용 공고를 2회 이상, 회당 10일 이상 냈다면 기관당 연 2회까지 10일을 더
                인정하되 1회 최대 40일입니다(제67조제2항·제3항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="근무표에 옮길 때">
          <div className="carev-ltc-prose">
            <p>
              그달 예상 입소자 수로 직종별 의무 인원을 먼저 구하고, 직원마다 한 달 실근무시간(휴게시간 제외)이 월 기준 근무시간에
              닿는지 확인합니다. 교대 형태별 편성 순서와 야간 배분은{' '}
              <Link href="/blog/nursing-home-three-shift-schedule">요양원 근무표 짜는 법</Link>에 정리했습니다. 기준보다 직원을 더 둘
              때 받는 가산과 점수는 <Link href="/ltc/nursing-home-staffing-bonus">요양원 인력추가배치 가산</Link>에 정리했습니다.
            </p>
            <p>
              케어브이 근무조정에서는 직종별 휴무 인원 한도를 정해 두면, 직종을 하나 골랐을 때 캘린더에서 휴무자가 있는 날짜마다
              &lsquo;휴무 인원/한도&rsquo;가 보이고 한도가 찬 날은 빨간색으로 표시됩니다. 케어브이가 법정 배치기준을 대신 판단하지는
              않으므로 한도 값은 위 기준으로 기관이 정합니다. 주간보호센터 기준은{' '}
              <Link href="/ltc/daycare-staffing-standard">주간보호센터 인력배치기준</Link>에 따로 정리했습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources sources={NURSING_HOME_SOURCES} verifiedAt={NURSING_HOME_VERIFIED_AT} />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
