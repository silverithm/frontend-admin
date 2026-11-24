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
  BASE_AMOUNT_PERCENT,
  GROUP_HOME_BONUS_SOURCES,
  GROUP_HOME_BONUS_VERIFIED_AT,
  GROUP_HOME_CAP_BANDS,
  POINTS,
  SERVICE_TYPE_POINTS,
  bonusAmountWon,
  capFor,
  firstBonusCaregivers,
  formatPoints,
  groupHomeBonusPoints,
  requiredCaregivers,
} from '@/lib/ltcGroupHomeBonus';
import { bandLabel, formatHundredths, perHeadHundredths } from '@/lib/ltcStaffingBonus';
import { GROUP_HOME_RESIDENTS } from '@/lib/ltcNursingHomeStaffing';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/group-home-staffing-bonus';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '노인요양공동생활가정 인력추가배치 가산';
const DESCRIPTION =
  '노인요양공동생활가정은 요양보호사를 기준(입소자 3명당 1명)보다 더 두고 1인당 입소자 수가 2.4명 미만이면 추가 1명당 1.2점이고, 요양보호사가 포함되면 가산점수의 합에 0.4점(포함되지 않으면 0.25점)을 인정범위 밖에서 더합니다. 조리원 1.2점, 인정범위, 야간직원배치 0.9점을 장기요양 고시 원문과 대조해 정리했습니다.';

const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
const points = (hundredths: number) => `${formatPoints(hundredths)}점`;

const RESIDENTS: ReadonlyArray<number> = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const ADDED_CAREGIVERS: ReadonlyArray<number> = [1, 2, 3];
/** 인정범위 두 구간을 대표하는 입소자 수 — 5명 미만은 4명, 5명 이상 10명 미만은 9명으로 셈한다(구간 안에서 값이 같다). */
const CAP_SAMPLE_RESIDENTS: ReadonlyArray<number> = [4, 9];

// 예시 1 — 입소자 9명, 요양보호사 4명, 조리원 1명, 급여비용 합 2,000만 원
const EX1 = { residents: 9, caregivers: 4, cost: 20_000_000 };
const EX1_REQUIRED = requiredCaregivers(EX1.residents, 'general');
const EX1_POINTS = groupHomeBonusPoints({ residents: EX1.residents, added: { caregiver: EX1.caregivers - EX1_REQUIRED }, cook: true });
const EX1_BASE = (EX1.cost * BASE_AMOUNT_PERCENT) / 100;
const EX1_AMOUNT = bonusAmountWon(EX1.cost, EX1_POINTS.total, EX1.residents, SERVICE_TYPE_POINTS.general);

// 예시 2 — 입소자 9명, 요양보호사 6명(인정범위를 넘는 경우), 급여비용 합 2,000만 원
const EX2 = { residents: 9, caregivers: 6, cost: 20_000_000 };
const EX2_REQUIRED = requiredCaregivers(EX2.residents, 'general');
const EX2_ADDED = EX2.caregivers - EX2_REQUIRED;
const EX2_POINTS = groupHomeBonusPoints({ residents: EX2.residents, added: { caregiver: EX2_ADDED } });
const EX2_BASE = (EX2.cost * BASE_AMOUNT_PERCENT) / 100;
const EX2_AMOUNT = bonusAmountWon(EX2.cost, EX2_POINTS.total, EX2.residents, SERVICE_TYPE_POINTS.general);
const EX2_TWO_POINTS = groupHomeBonusPoints({ residents: EX2.residents, added: { caregiver: EX2_ADDED - 1 } });
const EX2_TWO_AMOUNT = bonusAmountWon(EX2.cost, EX2_TWO_POINTS.total, EX2.residents, SERVICE_TYPE_POINTS.general);

export const metadata: Metadata = {
  title: `${TITLE} — 요양보호사 2.4명 미만·0.4점·조리원 1.2점·야간 0.9점(고시 제55~60조)`,
  description: DESCRIPTION,
  keywords:
    '노인요양공동생활가정 인력추가배치 가산, 공동생활가정 가산, 공동생활가정 가산점수, 공동생활가정 요양보호사 2.4명, 공동생활가정 0.4점, 공동생활가정 조리원 가산, 공동생활가정 야간직원배치 가산, 공동생활가정 가산점수 인정범위',
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
    question: '노인요양공동생활가정도 요양보호사를 더 두면 인력추가배치 가산을 받나요?',
    answer:
      '받습니다. 인력배치기준(입소자 3명당 1명, 치매전담형 2.5명당 1명)보다 많이 두고 요양보호사 1인당 입소자 수가 2.4명 미만이면 추가 1명당 1.2점입니다(장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제55조제1항제1호나목, 제56조제1항제2호가목). 노인요양시설(요양원)이 일반실 요양보호사 가산점수를 산정하지 않는 것과 다릅니다.',
  },
  {
    question: '공동생활가정 가산점수의 합에 더하는 0.4점은 무엇인가요?',
    answer:
      '인력추가배치가산이 적용되는 노인요양공동생활가정은 가산점수의 합에 요양보호사가 포함된 경우 0.4점, 포함되지 않은 경우 0.25점을 더하여 산정하고, 이 점수는 가산점수 인정범위 안에 포함하지 않습니다(고시 제56조제3항).',
  },
  {
    question: '입소자 9명 공동생활가정은 요양보호사를 몇 명 두면 가산을 받나요?',
    answer:
      '의무 인원은 9 ÷ 3 = 3명이고, 4명을 두면 1인당 입소자 수가 2.25명이라 2.4명 미만이어서 4명부터 가산 요건을 채웁니다. 치매전담형은 의무 인원이 9 ÷ 2.5 = 3.6을 반올림한 4명이고, 5명(1인당 1.80명)부터입니다.',
  },
  {
    question: '공동생활가정 조리원 가산은 몇 점인가요?',
    answer:
      '노인요양공동생활가정에서 조리원을 1명 이상 배치한 경우 인원수와 관계없이 1.2점입니다(고시 제55조제3항제2호, 제56조제1항제2호다목). 노인요양시설과 주·야간보호기관은 인력배치기준을 초과해 조리원을 1명 이상 추가 배치해야 하고(급식위탁기관 제외), 노인요양시설은 1점입니다.',
  },
  {
    question: '공동생활가정 가산점수 인정범위는 몇 점인가요?',
    answer:
      '입소자 5명 미만은 1.4점 이하, 5명 이상 10명 미만은 2.6점 이하입니다. 고시 제56조제2항 표에서 노인요양공동생활가정은 주·야간보호기관·단기보호기관과 같은 칸을 씁니다. 요양보호사 포함 0.4점·미포함 0.25점(제56조제3항)은 이 범위에 포함하지 않습니다.',
  },
  {
    question: '공동생활가정 야간직원배치 가산은 몇 점인가요?',
    answer:
      '야간(22시부터 다음날 06시)에 요양보호사 또는 간호(조무)사 1명 이상이 근무한 경우 기관당 0.9점이고, 가산금액은 제56조제1항의 산정식을 준용합니다(고시 제60조제2항).',
  },
  {
    question: '공동생활가정 인력추가배치 가산금액은 어떻게 계산하나요?',
    answer:
      '가산금액 = 해당 월 가산 기준금액 × [가산점수의 합/입소자수] × 서비스유형점수입니다. 시설급여의 기준금액은 그달 수급자별 급여비용 합의 80%, 서비스유형점수는 1점(치매전담형 노인요양공동생활가정은 0.9점)이고, 10원 미만은 반올림합니다(고시 제56조제1항, 제52조제2항).',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${URL}#dataset`,
  name: '노인요양공동생활가정 급여비용 가산 — 직종별 가산점수, 입소자 수별 가산점수 인정범위, 요양보호사 가산 요건 근무인원',
  description:
    '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제55조·제56조·제59조·제60조·제62조의 노인요양공동생활가정 가산 요건과 가산점수, 제56조제3항의 0.4점·0.25점, 서비스유형점수, 제56조제2항 가산점수 인정범위 표를 옮기고, 노인복지법 시행규칙 별표 4의 의무 인원(입소자 3명당 1명, 치매전담형 2.5명당 1명)과 제55조의 1인당 입소자 수 기준(2.4명 미만)으로 입소자 수별 요양보호사 가산 요건 근무인원과 요양보호사 추가 인원별 가산점수의 합을 계산한 표입니다.',
  url: URL,
  inLanguage: 'ko-KR',
  dateModified: GROUP_HOME_BONUS_VERIFIED_AT,
  isBasedOn: GROUP_HOME_BONUS_SOURCES.map((source) => source.url),
  variableMeasured: ['가산 유형', '가산점수', '입소자 수', '가산점수 인정범위(점)', '요양보호사 의무 인원(명)', '가산 요건을 채우는 요양보호사 근무인원(명)'],
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '케어브이' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: TITLE, path: PATH },
]);

const SUMMARY_ROWS: ReadonlyArray<{ kind: string; rule: string; score: string; article: string }> = [
  {
    kind: '인력추가배치 — 요양보호사',
    rule: '기준(3명당 1명, 치매전담형 2.5명당 1명) 초과, 1인당 입소자 2.4명 미만',
    score: `1명당 ${points(POINTS.caregiver)}`,
    article: '제55조제1항제1호나목, 제56조제1항제2호가목',
  },
  {
    kind: '인력추가배치 — 간호(조무)사',
    rule: '기준 초과, 1인당 입소자 19.0명 미만',
    score: `1명당 ${points(POINTS.nurse)}`,
    article: '제55조제1항제2호, 제56조제1항제2호가목',
  },
  { kind: '인력추가배치 — 사회복지사', rule: '기준 초과 배치', score: `1명당 ${points(POINTS.socialWorker)}`, article: '제56조제1항제2호나목' },
  { kind: '인력추가배치 — 물리(작업)치료사', rule: '기준 초과 배치', score: `1명당 ${points(POINTS.therapist)}`, article: '제56조제1항제2호나목' },
  {
    kind: '인력추가배치 — 조리원',
    rule: '조리원을 1명 이상 배치',
    score: `인원수와 관계없이 ${points(POINTS.cook)}`,
    article: '제55조제3항제2호, 제56조제1항제2호다목',
  },
  {
    kind: '공동생활가정 추가 점수',
    rule: '인력추가배치가산이 적용될 때',
    score: `요양보호사 포함 ${points(POINTS.withCaregiver)}, 미포함 ${points(POINTS.withoutCaregiver)} (인정범위 밖)`,
    article: '제56조제3항',
  },
  { kind: '간호사배치', rule: '간호사를 배치', score: `간호사 1인당 ${points(POINTS.registeredNurse)}`, article: '제59조제1항' },
  {
    kind: '야간직원배치',
    rule: '22시~다음날 06시 요양보호사 또는 간호(조무)사 1명 이상 근무',
    score: `기관당 ${points(POINTS.night)}`,
    article: '제60조제2항',
  },
  {
    kind: '맞춤형서비스제공',
    rule: '외부강사 맞춤형 프로그램(치매전담형 기관 제외)',
    score: `주 4회 또는 월 16회 이상 ${points(POINTS.customLong)}, 주 2~3회 또는 월 8회 이상 ${points(POINTS.customShort)}`,
    article: '제62조',
  },
];

export default function GroupHomeStaffingBonusPage() {
  return (
    <>
      <script {...jsonLdScriptProps(datasetJsonLd)} />
      <script {...jsonLdScriptProps(buildLtcFaqJsonLd(URL, FAQ))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title={TITLE}
        badge="고시 제55~62조 · 제2026-189호 기준"
        verifiedAt={GROUP_HOME_BONUS_VERIFIED_AT}
        lede={
          <>
            <p>
              <strong>
                노인요양공동생활가정은 요양보호사를 인력배치기준(입소자 3명당 1명)보다 더 두고 요양보호사 1인당 입소자 수가 2.4명
                미만이면 추가 1명당 1.2점입니다. 요양보호사가 포함되면 가산점수의 합에 0.4점을 더하고, 이 0.4점은 인정범위에 포함하지
                않습니다.
              </strong>
            </p>
            <p>
              조리원은 1명 이상 배치하면 인원수와 관계없이 1.2점, 간호(조무)사는 1.2점, 사회복지사·물리(작업)치료사는 1.4점이고,
              인력추가배치가산이 적용되는데 요양보호사가 포함되지 않은 경우에는 0.25점을 더합니다. 가산점수 인정범위는 입소자 5명 미만
              1.4점 이하, 5명 이상 10명 미만 2.6점 이하입니다. 가산금액은 그달 수급자별 급여비용 합의 80% × (가산점수의 합 ÷ 입소자 수) × 서비스유형점수
              1점(치매전담형 0.9점)입니다. 노인요양시설(요양원)은 일반실 요양보호사 가산점수를 산정하지 않는 것과 다릅니다.
            </p>
          </>
        }
      >
        <LtcBlock
          title="공동생활가정에 적용되는 가산 한눈에"
          description={
            <p>
              고시 제53조 표에서 시설급여기관에 적용되는 가산 유형은 인력 추가 배치, 간호사 배치, 야간직원배치, 맞춤형서비스
              제공입니다(맞춤형서비스 제공은 제70조의 치매전담형 장기요양기관 제외). 요양보호사 초과 배치 한시 가산(제56조의2)은
              노인요양시설 조항이라 공동생활가정에는 없습니다. 간호사배치·야간직원배치·맞춤형서비스제공 가산도 금액은 제56조제1항의
              계산식으로 셈합니다(제59조제1항, 제60조제2항, 제62조제2항).
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">가산</th>
                  <th scope="col">요건</th>
                  <th scope="col" className="carev-ltc-focus">가산점수</th>
                  <th scope="col">조문</th>
                </tr>
              </thead>
              <tbody>
                {SUMMARY_ROWS.map((row) => (
                  <tr key={row.kind}>
                    <th scope="row">{row.kind}</th>
                    <td>{row.rule}</td>
                    <td className="carev-ltc-focus">{row.score}</td>
                    <td>{row.article}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LtcBlock>

        <LtcBlock
          title="요양보호사 — 1인당 입소자 2.4명 미만"
          description={
            <>
              <p>
                요양보호사는 인력배치기준을 초과해 배치하고, 1인당 입소자 수가 &ldquo;노인요양공동생활가정 : 2.4명 미만&rdquo;이어야
                합니다(제55조제1항 본문·제1호나목). 1인당 입소자 수는 입소자 수를 근무인원 수로 나누고 소수점 셋째자리에서
                절사합니다(제3호). 의무 인원은 입소자 3명당 1명(치매전담형 2.5명당 1명)을 반올림하고, 0.5 미만이면 기본 1명입니다(노인복지법
                시행규칙 별표 4 제6호, 고시 제48조제1항).
              </p>
              <p>
                입소정원은 {GROUP_HOME_RESIDENTS.from}~{GROUP_HOME_RESIDENTS.to}명이지만 월 입소자 수(제47조)는 그보다 적을 수 있어
                1명부터 계산했습니다. 입소자 1~9명에서는 의무 인원보다 근무인원 1명만 더 두면 2.4명 미만이 됩니다(근무인원은 아래처럼
                제51조로 센 수입니다). 가장 빠듯한 7명도 3명을 두면 7 ÷
                3 = {formatHundredths(perHeadHundredths(7, 3))}명입니다.
              </p>
            </>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">입소자 수</th>
                  <th scope="col" className="carev-ltc-num">의무 인원</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">가산 요건을 채우는 최소 근무인원</th>
                  <th scope="col" className="carev-ltc-num">치매전담형 의무 인원</th>
                  <th scope="col" className="carev-ltc-num">치매전담형 최소 근무인원</th>
                </tr>
              </thead>
              <tbody>
                {RESIDENTS.map((residents) => {
                  const first = firstBonusCaregivers(residents, 'general');
                  const firstDementia = firstBonusCaregivers(residents, 'dementia');
                  return (
                    <tr key={residents}>
                      <th scope="row">{residents}명</th>
                      <td className="carev-ltc-num">{requiredCaregivers(residents, 'general')}명</td>
                      <td className="carev-ltc-num carev-ltc-focus">
                        {first}명 (1인당 {formatHundredths(perHeadHundredths(residents, first))}명)
                      </td>
                      <td className="carev-ltc-num">{requiredCaregivers(residents, 'dementia')}명</td>
                      <td className="carev-ltc-num">
                        {firstDementia}명 (1인당 {formatHundredths(perHeadHundredths(residents, firstDementia))}명)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <ul>
              <li>
                제55조제1항제1호나목에는 치매전담형 기준이 따로 없어 치매전담형 노인요양공동생활가정도 2.4명 미만으로 표를 계산했습니다
                (주·야간보호기관은 다목에 치매전담형 3.9명 미만이 따로 있습니다).
              </li>
              <li>
                근무인원은 제51조로 셉니다. 월 기준 근무시간에 못 미치는 직원들의 근무시간을 합해 셀 때 가산은 소수점 이하를
                버리고(제51조제3항제1호), 치매전담형 장기요양기관에서 치매전문요양보호사가 아닌 요양보호사가 일하면 1명을 0.5명으로
                셉니다(제51조제1항 단서).
              </li>
              <li>
                요양원(노인요양시설)은 일반실 요양보호사의 인력추가배치 가산점수를 산정하지 않고 치매전담실만 1.3점이며(제56조제1항제2호마목),
                입소자가 줄어든 달의 요양보호사 초과 배치 한시 가산(제56조의2, 2026년 12월 31일까지)이 따로 있습니다 —{' '}
                <Link href="/ltc/nursing-home-staffing-bonus">요양원 인력추가배치 가산</Link>.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title="인정범위와 0.4점 — 고시 제56조제2항·제3항"
          description={
            <p>
              가산점수 인정범위는 고시 제56조제2항 표에서 노인요양공동생활가정·주·야간보호기관·단기보호기관이 함께 쓰는 칸을
              따릅니다. 입소정원이 9명 이하라 두 구간만 옮겼고, 10명 이상 구간은{' '}
              <Link href="/ltc/daycare-staffing-bonus">주간보호센터 인력추가배치 가산</Link>에 있습니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">입소자 수</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">가산점수 인정범위</th>
                </tr>
              </thead>
              <tbody>
                {GROUP_HOME_CAP_BANDS.map((band) => (
                  <tr key={band.from}>
                    <th scope="row">{bandLabel(band)}</th>
                    <td className="carev-ltc-num carev-ltc-focus">{points(band.cap * 10)} 이하</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <ul>
              <li>
                제56조제3항은 &ldquo;제1항 및 제2항에도 불구하고 인력추가배치가산이 적용되는 노인요양공동생활가정의 경우 가산점수의
                합에 다음 각 호에 따른 가산점수를 더하여 산정하며, 해당 가산점수는 제2항의 가산점수 인정범위 안에 포함하지
                않는다.&rdquo;라고 정하고, 제1호 &ldquo;요양보호사가 포함된 경우 0.4점&rdquo;, 제2호 &ldquo;요양보호사가 포함되지 않은
                경우 0.25점&rdquo;을 둡니다.
              </li>
              <li>
                제56조제2항 단서가 인정범위에 포함하지 않는 조리원 점수(제1항제2호다목)는 &lsquo;노인요양시설 및 주ㆍ야간보호기관&rsquo;의
                것입니다. 노인요양공동생활가정은 이 단서에 없어, 이 페이지는 공동생활가정의 조리원 1.2점을 인정범위 안에서 셉니다.
                조리원 점수까지 더해 인정범위를 넘는 경우는 이 페이지에서 계산하지 않았으니 국민건강보험공단의 가산 지급기준(제54조제7항)으로
                확인하세요.
              </li>
              <li>
                인정범위를 넘을 때 요양보호사 추가 배치 인원에 따라 범위를 늘려 주는 추가산정(제56조제4항)은 입소자 10인 이상의
                주·야간보호기관과 단기보호기관에만 있습니다.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title="요양보호사만 추가 배치했을 때 가산점수의 합"
          description={
            <p>
              다른 직종·조리원 점수 없이 요양보호사만 가산 요건을 채워 더 둔 경우입니다. 인정범위까지 인정한 직종 점수에 제56조제3항의
              0.4점을 더했습니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">요양보호사 추가 인원</th>
                  <th scope="col" className="carev-ltc-num">직종 점수</th>
                  <th scope="col" className="carev-ltc-num">입소자 5명 미만</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">입소자 5명 이상 10명 미만</th>
                </tr>
              </thead>
              <tbody>
                {ADDED_CAREGIVERS.map((added) => (
                  <tr key={added}>
                    <th scope="row">{added}명</th>
                    <td className="carev-ltc-num">{points(added * POINTS.caregiver)}</td>
                    {CAP_SAMPLE_RESIDENTS.map((residents) => {
                      const sum = groupHomeBonusPoints({ residents, added: { caregiver: added } });
                      return (
                        <td key={residents} className={`carev-ltc-num${residents >= 5 ? ' carev-ltc-focus' : ''}`}>
                          {formatPoints(sum.recognized)} + {formatPoints(sum.groupHomeExtra)} = {points(sum.total)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <p>
              인정범위({points(capFor(4))}·{points(capFor(9))})를 넘는 점수는 인정하지 않고, 0.4점은 그 뒤에 더합니다. 입소자 5명 이상
              10명 미만에서 요양보호사를 3명 더 두면 직종 점수 3.6점 가운데 2.6점만 인정해 합이 3.0점입니다.
            </p>
          </div>
        </LtcBlock>

        <LtcBlock title="간호(조무)사·사회복지사·물리(작업)치료사·조리원 — 고시 제55조">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>간호(조무)사</strong> — 인력배치기준보다 많이 두고 1인당 입소자 수가 19.0명 미만이면 추가 1명당 1.2점입니다(제55조제1항제2호,
                제56조제1항제2호가목). 입소자 9명 이하에서는 1명만 둬도 1인당 입소자 수가 19.0명 미만입니다.
              </li>
              <li>
                <strong>사회복지사·물리(작업)치료사</strong> — 인력배치기준을 넘겨 추가 배치한 경우 1명당 1.4점입니다(제56조제1항제2호나목).
                제55조제1항 각 호에 이 두 직종의 1인당 입소자 수 기준은 없습니다.
              </li>
              <li>
                <strong>별표 4의 합친 칸</strong> — 노인복지법 시행규칙 별표 4 제6호 표는 노인요양공동생활가정의 간호사 또는
                간호조무사·물리치료사 또는 작업치료사 두 칸을 합쳐 &lsquo;1명&rsquo;, 시설의 장·사무국장·사회복지사 세 칸을 합쳐
                &lsquo;1명&rsquo;으로 적습니다. 합친 칸을 넘겨 둔 직원을 어느 직종의 추가 배치로 셀지는 고시 문장에 없어, 이 페이지는 이
                직종들의 점수만 옮기고 인원 표는 만들지 않았습니다. 가산 지급기준·절차 등 세부사항은 국민건강보험공단 이사장이
                정합니다(제54조제7항). 합친 칸은 <Link href="/ltc/nursing-home-staffing-standard">요양원 인력배치기준</Link> 표에서 볼 수
                있습니다.
              </li>
              <li>
                <strong>조리원</strong> — &ldquo;노인요양공동생활가정에서 조리원을 1명 이상 배치한 경우&rdquo;(제55조제3항제2호) 인원수와
                관계없이 1.2점입니다(제56조제1항제2호다목). 노인요양시설·주·야간보호기관은 인력배치기준을 초과해 조리원을 1명 이상 추가
                배치해야 하고 급식위탁기관은 제외되지만(제55조제3항제1호), 공동생활가정 조항은 &lsquo;배치한 경우&rsquo;이고 별표 4의
                공동생활가정 조리원 칸은 비어 있습니다.
              </li>
              <li>
                겸직 직원, 출산전후휴가 중인 직원, 유산·사산휴가를 30일 넘게 쓰고 있는 직원, 퇴사특례(제67조제2항·제3항)를 적용받는
                직원은 그 직종의 가산 근무인원수에 넣지 않습니다(제54조제5항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="가산금액 계산식 — 고시 제56조제1항">
          <div className="carev-ltc-prose">
            <p>
              <strong>가산금액 = 해당 월 가산 기준금액 × [가산점수의 합/입소자수] × 서비스유형점수</strong>
            </p>
            <ul>
              <li>
                <strong>해당 월 가산 기준금액</strong> — 시설급여는 그달 수급자별 급여비용 합의 80%입니다(제1호).
              </li>
              <li>
                <strong>가산점수의 합</strong> — 직종별 점수를 인정범위까지 인정하고(조리원 점수를 범위 안에서 세는 이유는 위
                &lsquo;인정범위와 0.4점&rsquo;), 제56조제3항의 0.4점 또는 0.25점을 더합니다.
              </li>
              <li>
                <strong>서비스유형점수</strong> — 시설급여기관 1점, 치매전담형 노인요양공동생활가정 0.9점입니다(제3호가목).
              </li>
              <li>계산한 금액에 10원 미만 단수가 있으면 반올림합니다(제52조제2항).</li>
            </ul>
            <p>
              계산식은 국가법령정보센터 고시 본문에 그림으로 실려 있어, 케어브이가 그림을 내려받아 확대해 읽은 문장을 그대로 옮겼습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcBlock
          title="계산 예시 — 인력추가배치 가산"
          description={
            <p>
              치매전담형이 아닌 노인요양공동생활가정을 가정했습니다. 급여비용 합은 계산 과정을 보이려고 정한 값이고, 간호사배치·야간직원배치
              등 다른 가산은 넣지 않았습니다.
            </p>
          }
        >
          <div className="carev-ltc-prose">
            <h3>예시 1 — 입소자 9명, 요양보호사 4명·조리원 1명, 급여비용 합 2,000만 원</h3>
            <ol>
              <li>
                요양보호사 {EX1.caregivers}명: 의무 인원 {EX1_REQUIRED}명(9 ÷ 3 = 3), 1인당 입소자{' '}
                {formatHundredths(perHeadHundredths(EX1.residents, EX1.caregivers))}명으로 2.4명 미만 → 추가 1명 × 1.2점 ={' '}
                {points(POINTS.caregiver)}.
              </li>
              <li>조리원 1명 배치 → {points(POINTS.cook)}.</li>
              <li>
                합 {points(EX1_POINTS.raw)}은 인정범위(5명 이상 10명 미만) {points(EX1_POINTS.cap)} 이하라 그대로 인정합니다. 요양보호사가
                포함돼 {points(EX1_POINTS.groupHomeExtra)}을 더해 가산점수의 합은 {points(EX1_POINTS.total)}입니다.
              </li>
              <li>기준금액: 20,000,000원 × 80% = {won(EX1_BASE)}.</li>
              <li>
                가산금액: {won(EX1_BASE)} × ({formatPoints(EX1_POINTS.total)} ÷ {EX1.residents}) × 1 = 4,977,777.7…원 → 10원 미만 반올림{' '}
                <strong>{won(EX1_AMOUNT)}</strong>.
              </li>
            </ol>

            <h3>예시 2 — 입소자 9명, 요양보호사 6명(인정범위를 넘는 경우), 급여비용 합 2,000만 원</h3>
            <ol>
              <li>
                요양보호사 {EX2.caregivers}명: 의무 인원 {EX2_REQUIRED}명, 1인당 입소자{' '}
                {formatHundredths(perHeadHundredths(EX2.residents, EX2.caregivers))}명 → 추가 {EX2_ADDED}명 × 1.2점 ={' '}
                {points(EX2_POINTS.raw)}.
              </li>
              <li>
                {points(EX2_POINTS.raw)}은 인정범위 {points(EX2_POINTS.cap)} 이하를 넘어 {points(EX2_POINTS.recognized)}만 인정하고,{' '}
                {points(EX2_POINTS.groupHomeExtra)}을 더해 가산점수의 합은 {points(EX2_POINTS.total)}입니다.
              </li>
              <li>기준금액: 20,000,000원 × 80% = {won(EX2_BASE)}.</li>
              <li>
                가산금액: {won(EX2_BASE)} × ({formatPoints(EX2_POINTS.total)} ÷ {EX2.residents}) × 1 = 5,333,333.3…원 → 10원 미만 반올림{' '}
                <strong>{won(EX2_AMOUNT)}</strong>.
              </li>
              <li>
                요양보호사를 {EX2_ADDED - 1}명만 더 두면 {points(EX2_TWO_POINTS.total)}({won(EX2_TWO_AMOUNT)})이라, 세 번째 추가 인원으로 늘어나는
                점수는 0.2점입니다.
              </li>
            </ol>
          </div>
        </LtcBlock>

        <LtcBlock title="간호사배치·야간직원배치·맞춤형서비스제공 가산 — 고시 제59조·제60조·제62조">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>간호사배치</strong> — 시설급여기관이 간호사를 배치한 경우 간호사 1인당 0.6점이고, 가산금액은 제56조제1항을
                준용해 셈합니다(제59조제1항). 0.2점을 더하는 제2항은 입소자 50인 이상 노인요양시설 조항입니다.
              </li>
              <li>
                <strong>야간직원배치</strong> — &ldquo;노인요양공동생활가정의 야간직원배치 가산은 야간(22시부터 다음날 06시)에 요양보호사
                또는 간호(조무)사 1명 이상이 근무한 경우 기관당 0.9점의 가산점수를 부여&rdquo;하고, 가산금액 산정식은 제56조제1항을
                준용합니다(제60조제2항). 야간직원 1인당 0.9점 방식(제1항제2호)은 노인요양시설과 단기보호기관(제3항)에만 있습니다. 야간·주간에 배치한 인력수의
                계산 등은 공단 이사장이 정하고(제4항), 기관의 장은 받은 야간직원배치 가산금을 야간에 근무한 종사자에게 지급해야
                합니다(제5항).
              </li>
              <li>
                <strong>맞춤형서비스제공</strong> — 관련 자격증을 가진 외부강사가 수급자 상태별 맞춤형 프로그램을 주 4회 또는 월 16회
                이상(프로그램별 1회 60분 이상) 제공하면 0.5점, 주 2~3회 또는 월 8회 이상이면 0.25점입니다. 제70조의 치매전담형
                장기요양기관(치매전담형 노인요양공동생활가정 포함)은 가산하지 않습니다(제62조).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="치매전담형 노인요양공동생활가정이면">
          <div className="carev-ltc-prose">
            <ul>
              <li>요양보호사 의무 인원은 입소자 2.5명당 1명입니다(별표 4 제6호). 위 표의 오른쪽 두 열이 이 기준입니다.</li>
              <li>서비스유형점수는 0.9점입니다(제56조제1항제3호가목).</li>
              <li>
                치매전문요양보호사가 아닌 요양보호사가 월 기준 근무시간 이상 일하면 1명을 0.5명으로 세고, 치매전문교육을 이수한 날이 속한
                달은 치매전문요양보호사로 근무한 것으로 봅니다(제51조제1항 단서).
              </li>
              <li>
                치매전담형 장기요양기관은 치매전문교육을 이수한 시설장, 프로그램관리자, 치매전문요양보호사를 각각 갖춰야 하고, 단독으로
                운영하는 노인요양공동생활가정은 시설장이 프로그램관리자를 겸임할 수 있습니다(제72조제1항).
              </li>
              <li>맞춤형서비스제공 가산은 받지 않습니다(제62조제1항 단서).</li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="가산이 빠지거나 줄어드는 달 — 고시 제52조·제54조">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                인력추가배치 가산은 인력배치기준을 충족해야 받습니다. 일부 직종이 기준에 못 미쳐도 기준을 채운 다른 직종의 가산은
                인정합니다(제54조제1항).
              </li>
              <li>
                <strong>정원초과 감액</strong>이 적용되는 달은 인력추가배치·간호사배치·야간직원배치·맞춤형서비스제공 가산을 급여
                제공일수 중 정원초과가 생긴 날의 비율만큼 빼고 적용합니다(제54조제2항).
              </li>
              <li>
                <strong>인력배치기준 위반 감액</strong>이 적용되는 달은 위반한 직종의 인력추가배치 가산을 적용하지 않고, 3개 직종 이상
                위반하면 전 직종에 적용하지 않습니다(제54조제3항).
              </li>
              <li>
                월 중 업무정지·지정취소·기관유형 변경이 있거나 월 단위 1일 평균 입소자가 1명 미만이면 가산을 적용하지 않습니다. 월 중
                첫날에 기관유형이 바뀐 경우는 예외입니다(제52조제3항).
              </li>
              <li>
                공단은 가산을 받은 기관의 서비스 제공 적정성을 확인하려고 서비스 모니터링을 하고, 기관은 현장 확인 요구에 응해야
                합니다(제54조제6항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="근무표에 옮길 때">
          <div className="carev-ltc-prose">
            <p>
              가산은 그달 근무인원으로 따지므로, 예상 입소자 수로 요양보호사 의무 인원과 가산 요건을 채우는 인원을 먼저 정하고 휴무·결원이
              생겨도 그 아래로 내려가지 않는지 봅니다. 야간직원배치 가산은 22시~다음날 06시에 요양보호사 또는 간호(조무)사가 1명 이상
              있어야 하므로 야간 근무를 비우는 날이 없는지도 확인합니다. 직종별 의무 인원은{' '}
              <Link href="/ltc/nursing-home-staffing-standard">요양원 인력배치기준</Link>에, 달마다 다른 월 기준 근무시간은{' '}
              <Link href="/ltc/monthly-standard-hours-2026">2026년 월 기준 근무시간</Link>에 정리했습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources
          sources={GROUP_HOME_BONUS_SOURCES}
          verifiedAt={GROUP_HOME_BONUS_VERIFIED_AT}
          note={
            <p>
              제53조 가산 유형 표, 제56조제1항의 계산식, 제2항의 인정범위 표는 고시 본문에 그림으로만 실려 있어, 그림을 내려받아 확대해
              읽었습니다. 추가 배치 인원은 인력배치기준을 초과해 배치한 인원(근무인원에서 의무 인원을 뺀 수)으로 셈했습니다. 이 페이지의
              요양보호사 근무인원 표, 추가 인원별 가산점수 표, 계산 예시는 원문 규칙을 적용해 케어브이가 계산한 값입니다.
            </p>
          }
        />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
