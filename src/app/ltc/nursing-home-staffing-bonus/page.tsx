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
import { requiredStaff } from '@/lib/ltcNursingHomeStaffing';
import {
  BASE_AMOUNT_PERCENT,
  DEMENTIA_UNIT_MAX_ADDED,
  NURSING_HOME_BONUS_SOURCES,
  NURSING_HOME_BONUS_VERIFIED_AT,
  NURSING_HOME_CAP_BANDS,
  POINTS,
  SERVICE_TYPE_POINTS,
  TEMP_BONUS_EXPIRES,
  bonusAmountWon,
  capBandLabel,
  capFor,
  dementiaUnitPoints,
  formatPoints,
  nurseBonusBands,
  nursingHomeBonusPoints,
  requiredNurses,
  tempBonusLimit,
  tempBonusPoints,
} from '@/lib/ltcNursingHomeBonus';
import { formatHundredths, perHeadHundredths } from '@/lib/ltcStaffingBonus';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/nursing-home-staffing-bonus';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '요양원 인력추가배치 가산';
const DESCRIPTION =
  '요양원(노인요양시설)은 일반실 요양보호사를 기준보다 더 둬도 인력추가배치 가산점수가 없고, 치매전담실 요양보호사는 실별 최대 2명까지 1명당 1.3점입니다. 간호(조무)사·사회복지사·조리원 가산점수, 입소자 수별 인정범위, 2026년 12월 31일까지인 한시 가산, 간호사·야간직원배치 가산을 장기요양 고시 원문과 대조해 정리했습니다.';

const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
const points = (tenths: number) => `${formatPoints(tenths)}점`;
const EXPIRES_LABEL = formatKoreanDate(TEMP_BONUS_EXPIRES);

const NURSE_BANDS = nurseBonusBands(10, 100);
const NURSE_TWO_MORE = NURSE_BANDS.filter((band) => band.firstBonus - band.required >= 2)
  .map((band) => `${band.from}~${band.to}명`)
  .join('·');

// 예시 1 — 입소자 50명, 요양보호사 26명, 간호(조무)사 3명, 사회복지사 2명, 조리원 3명, 급여비용 합 1억 2,000만 원
const EX1 = { residents: 50, caregivers: 26, nurses: 3, socialWorkers: 2, cooks: 3, cost: 120_000_000 };
const EX1_CAREGIVERS_REQUIRED = requiredStaff(EX1.residents, 'nursingHome');
const EX1_NURSES_REQUIRED = requiredNurses(EX1.residents);
const EX1_COOKS_REQUIRED = requiredStaff(EX1.residents, 'perTwentyFive');
const EX1_POINTS = nursingHomeBonusPoints({
  residents: EX1.residents,
  added: { nurse: EX1.nurses - EX1_NURSES_REQUIRED, socialWorker: EX1.socialWorkers - 1 },
  cookAdded: EX1.cooks > EX1_COOKS_REQUIRED,
});
const EX1_BASE = (EX1.cost * BASE_AMOUNT_PERCENT) / 100;
const EX1_AMOUNT = bonusAmountWon(EX1.cost, EX1_POINTS.total, EX1.residents, SERVICE_TYPE_POINTS.general);

// 예시 2 — 입소자 45명, 간호(조무)사 4명, 물리치료사 2명, 사회복지사 2명, 급여비용 합 1억 원
const EX2 = { residents: 45, nurses: 4, therapists: 2, socialWorkers: 2, cost: 100_000_000 };
const EX2_NURSES_REQUIRED = requiredNurses(EX2.residents);
const EX2_NURSES_ADDED = EX2.nurses - EX2_NURSES_REQUIRED;
const EX2_POINTS = nursingHomeBonusPoints({
  residents: EX2.residents,
  added: { nurse: EX2_NURSES_ADDED, therapist: EX2.therapists - 1, socialWorker: EX2.socialWorkers - 1 },
});
const EX2_BASE = (EX2.cost * BASE_AMOUNT_PERCENT) / 100;
const EX2_AMOUNT = bonusAmountWon(EX2.cost, EX2_POINTS.total, EX2.residents, SERVICE_TYPE_POINTS.general);

// 한시 가산 — 입소자 수가 줄어든 달의 한도
const TEMP_CASES: ReadonlyArray<{ base: number; now: number }> = [
  { base: 30, now: 28 },
  { base: 40, now: 39 },
  { base: 41, now: 40 },
  { base: 60, now: 55 },
  { base: 100, now: 97 },
];

export const metadata: Metadata = {
  title: `${TITLE} — 요양보호사 미산정·치매전담실 1.3점·한시 가산·야간직원(고시 제55~60조)`,
  description: DESCRIPTION,
  keywords:
    '요양원 인력추가배치 가산, 노인요양시설 인력추가배치 가산, 요양원 가산점수, 요양원 가산점수 인정범위, 요양보호사 초과 배치 한시 가산, 치매전담실 요양보호사 가산, 요양원 야간직원배치 가산, 요양원 간호사배치 가산',
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
    question: '요양원 요양보호사를 기준보다 더 두면 인력추가배치 가산을 받나요?',
    answer:
      '일반실 요양보호사는 받지 못합니다. 노인요양시설은 요양보호사 가산점수를 산정하지 않고, 치매전담실에 인력배치기준을 넘겨 요양보호사를 더 둔 경우에만 실별 최대 2명까지 1명당 1.3점을 가산합니다(장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제56조제1항제2호마목).',
  },
  {
    question: '요양원 간호조무사를 1명 더 두면 가산점수는 몇 점인가요?',
    answer:
      '인력배치기준보다 많고 간호(조무)사 1인당 입소자 수가 19.0명 미만이면 추가 1명당 1.2점입니다. 1인당 입소자 수는 입소자 수를 근무인원 수로 나누고 소수점 셋째자리에서 절사합니다(고시 제55조제1항제2호·제3호, 제56조제1항제2호가목).',
  },
  {
    question: '요양원 인력추가배치 가산금액은 어떻게 계산하나요?',
    answer:
      '가산금액 = 해당 월 가산 기준금액 × [가산점수의 합/입소자수] × 서비스유형점수입니다. 시설급여의 기준금액은 그달 수급자별 급여비용 합의 80%, 서비스유형점수는 1점(치매전담실만 있는 노인요양시설은 0.9점)이고, 10원 미만은 반올림합니다(고시 제56조제1항, 제52조제2항).',
  },
  {
    question: '입소자 50명 요양원의 가산점수 인정범위는 몇 점인가요?',
    answer:
      '50명 이상 70명 미만 구간이라 5.2점 이하입니다. 조리원 가산점수, 치매전담실 요양보호사 가산점수, 요양보호사 초과 배치 한시 가산은 인정범위에 포함하지 않습니다(고시 제56조제2항). 주·야간보호기관과 단기보호기관에 있는 인정범위 추가산정(제56조제4항)은 노인요양시설에 적용되지 않습니다.',
  },
  {
    question: '요양보호사 초과 배치 한시 가산은 무엇인가요?',
    answer:
      '요양보호사 입소자 2.1명당 1명 이상 급여비용(제44조제1항제1호)을 산정하는 노인요양시설(치매전담실 제외)의 입소자가 줄어 전월 대비 요양보호사 의무 인원이 줄었을 때, 기준을 넘겨 둔 요양보호사 1명당 1.3점을 줄어든 의무 인원 수까지 가산합니다. 최대 3개월 연속, 연간 6개월 한도이며, 이 조항은 2026년 12월 31일까지 효력을 가집니다(고시 제56조의2, 부칙).',
  },
  {
    question: '요양원 야간직원배치 가산은 몇 점인가요?',
    answer:
      '야간(22시부터 다음날 06시)에 요양보호사 또는 간호(조무)사가 1명 이상 근무하면 기관당 0.9점입니다. 야간근무 직원 1인당 입소자 20인 이하이고 주간에 근무하는 요양보호사와 간호(조무)사 수의 합이 야간직원의 2배 이상(입소자 20인 미만은 동수 가능)이면 야간직원 1인당 0.9점을 받을 수 있습니다(고시 제60조제1항).',
  },
  {
    question: '요양원 간호사배치 가산은 몇 점인가요?',
    answer:
      '간호사 1인당 0.6점이고, 입소자 50인 이상 노인요양시설은 0.2점을 더하여 산정합니다. 금액은 인력추가배치 가산과 같은 계산식(제56조제1항)으로 셈합니다(고시 제59조).',
  },
  {
    question: '입소자 57명인데 간호조무사를 3명 두면 가산을 받나요?',
    answer:
      '받지 못합니다. 의무 인원은 57 ÷ 25 = 2.28을 반올림한 2명이고, 3명이면 1인당 입소자 수가 19.00명이라 19.0명 미만이 아닙니다. 4명(14.25명)부터 요건을 채우고, 이때 추가 배치 인원은 2명입니다.',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${URL}#dataset`,
  name: '요양원(노인요양시설) 급여비용 가산 — 직종별 가산점수, 입소자 수별 가산점수 인정범위, 간호(조무)사 가산 요건 근무인원, 한시 가산 한도',
  description:
    '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제55조·제56조·제56조의2·제59조·제60조·제62조의 노인요양시설 가산 요건과 가산점수, 서비스유형점수, 제56조제2항 노인요양시설 가산점수 인정범위 표를 옮기고, 노인복지법 시행규칙 별표 4의 의무 인원과 제55조의 1인당 입소자 수 기준(19.0명 미만)으로 입소자 수별 간호(조무)사 가산 요건 근무인원과, 입소자 수가 줄어든 달의 요양보호사 초과 배치 한시 가산 한도를 계산한 표입니다.',
  url: URL,
  inLanguage: 'ko-KR',
  dateModified: NURSING_HOME_BONUS_VERIFIED_AT,
  isBasedOn: NURSING_HOME_BONUS_SOURCES.map((source) => source.url),
  variableMeasured: ['가산 유형', '가산점수', '입소자 수', '가산점수 인정범위(점)', '간호(조무)사 의무 인원(명)', '가산 요건을 채우는 간호(조무)사 근무인원(명)', '한시 가산 한도(명)'],
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '케어브이' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: TITLE, path: PATH },
]);

const SUMMARY_ROWS: ReadonlyArray<{ kind: string; rule: string; score: string; article: string }> = [
  { kind: '인력추가배치 — 요양보호사(일반실)', rule: '—', score: '산정하지 않음', article: '제56조제1항제2호마목' },
  {
    kind: '인력추가배치 — 요양보호사(치매전담실)',
    rule: '인력배치기준 초과 추가배치',
    score: `1명당 ${points(POINTS.dementiaCaregiver)}, 실별 최대 ${DEMENTIA_UNIT_MAX_ADDED}명`,
    article: '제56조제1항제2호마목 단서',
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
    rule: '기준 초과해 1명 이상 추가(급식위탁기관 제외)',
    score: `인원수와 관계없이 ${points(POINTS.cook)}`,
    article: '제55조제3항제1호, 제56조제1항제2호다목',
  },
  {
    kind: '요양보호사 초과 배치 한시 가산',
    rule: `입소자가 줄어 의무 인원이 준 달(치매전담실 제외), ${EXPIRES_LABEL}까지`,
    score: `1명당 ${points(POINTS.tempCaregiver)}, 줄어든 의무 인원 수까지`,
    article: '제56조의2',
  },
  {
    kind: '간호사배치',
    rule: '간호사를 배치',
    score: `간호사 1인당 ${points(POINTS.registeredNurse)}, 입소자 50인 이상은 ${points(POINTS.registeredNurse50Plus)}을 더함`,
    article: '제59조',
  },
  {
    kind: '야간직원배치',
    rule: '22시~다음날 06시 요양보호사 또는 간호(조무)사 1명 이상 근무',
    score: `기관당 ${points(POINTS.night)}, 또는 요건을 채우면 야간직원 1인당 ${points(POINTS.night)}`,
    article: '제60조제1항',
  },
  {
    kind: '맞춤형서비스제공',
    rule: '외부강사 맞춤형 프로그램(치매전담형 기관 제외)',
    score: '주 4회 또는 월 16회 이상 0.5점, 주 2~3회 또는 월 8회 이상 0.25점',
    article: '제62조',
  },
];

export default function NursingHomeStaffingBonusPage() {
  return (
    <>
      <script {...jsonLdScriptProps(datasetJsonLd)} />
      <script {...jsonLdScriptProps(buildLtcFaqJsonLd(URL, FAQ))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title={TITLE}
        badge="고시 제55~62조 · 제2026-189호 기준"
        verifiedAt={NURSING_HOME_BONUS_VERIFIED_AT}
        lede={
          <>
            <p>
              <strong>
                요양원(노인요양시설)은 일반실 요양보호사를 인력배치기준보다 더 둬도 인력추가배치 가산점수를 산정하지 않습니다.
                치매전담실에 요양보호사를 더 두면 실별 최대 2명까지 1명당 1.3점입니다.
              </strong>
            </p>
            <p>
              간호(조무)사는 1인당 입소자 19.0명 미만이면 추가 1명당 1.2점, 사회복지사·물리(작업)치료사는 1.4점, 조리원은 인원수와
              관계없이 1점입니다. 입소자가 줄어 요양보호사 의무 인원이 줄어든 달에는 기준을 넘겨 둔 요양보호사 1명당 1.3점(줄어든 의무
              인원 수까지, 치매전담실 제외)의 한시 가산이 있고, 이 조항은 {EXPIRES_LABEL}까지 효력을 가집니다. 가산금액은 그달 수급자별 급여비용 합의
              80% × (가산점수의 합 ÷ 입소자 수) × 서비스유형점수 1점(치매전담실만 있으면 0.9점)입니다.
            </p>
          </>
        }
      >
        <LtcBlock
          title="요양원에 적용되는 가산 한눈에"
          description={
            <p>
              고시 제53조 표에서 시설급여기관에 적용되는 가산 유형은 인력 추가 배치, 간호사 배치, 야간직원배치, 맞춤형서비스
              제공입니다(맞춤형서비스 제공은 제70조의 치매전담형 장기요양기관 제외). 요양보호사 초과 배치 한시 가산은 제56조의2에 따로
              있습니다. 간호사배치·야간직원배치·맞춤형서비스제공 가산도 금액은 제56조제1항의 계산식으로 셈합니다(제59조제1항,
              제60조제1항, 제62조제2항).
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

        <LtcBlock title="요양보호사 — 일반실은 점수가 없고 치매전담실만 1.3점">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                고시 제56조제1항제2호마목은 &ldquo;가목에도 불구하고 노인요양시설의 경우 가목의 요양보호사 가산점수를 산정하지
                아니한다. 다만, 노인요양시설 내 치매전담실에 제48조의 인력배치기준을 초과하여 요양보호사를 추가배치한 경우 각 실별
                최대 2명까지 요양보호사 1인당 1.3점을 가산한다.&rdquo;라고 정합니다.
              </li>
              <li>
                그래서 일반실 요양보호사를 입소자 2.1명당 1명 기준보다 더 둬도 인력추가배치 가산점수는 없습니다. 요양보호사 1인당
                입소자 수 기준(제55조제1항제1호)에도 노인요양공동생활가정(2.4명 미만), 주·야간보호기관(6.4명 미만, 치매전담형 3.9명
                미만), 단기보호기관(3.75명 미만)만 있고 가목은 삭제돼 있습니다.
              </li>
              <li>
                <strong>치매전담실</strong>에 인력배치기준(입소자 2명당 1명)을 넘겨 요양보호사를 더 두면 실마다 2명까지 1명당
                1.3점입니다. 추가 1명이면 {points(dementiaUnitPoints(1))}, 2명 이상이면 {points(dementiaUnitPoints(2))}입니다. 이
                점수는 가산점수 인정범위에 포함하지 않습니다(제56조제2항 단서).
              </li>
              <li>
                치매전담실만 있는 노인요양시설은 요양보호사 인력추가배치 가산을 실별로 적용합니다(제55조제4항). 치매전담형
                장기요양기관에서 치매전문요양보호사가 아닌 요양보호사가 일하면 1명을 0.5명으로 셉니다(제51조제1항 단서).
              </li>
              <li>
                일반실·치매전담실 의무 인원 표는 <Link href="/ltc/nursing-home-staffing-standard">요양원 인력배치기준</Link>에
                있습니다.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="간호(조무)사·사회복지사·물리(작업)치료사·조리원 — 고시 제55조">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>간호(조무)사</strong> — 인력배치기준보다 많이 두고, 1인당 입소자 수가 19.0명 미만이어야 합니다(제55조제1항제2호).
                1인당 입소자 수는 입소자 수를 근무인원 수로 나누고 소수점 셋째자리에서 절사합니다(제3호). 57 ÷ 3 = 19.00은 19.0명
                미만이 아닙니다.
              </li>
              <li>
                <strong>사회복지사·물리(작업)치료사</strong> — 인력배치기준을 넘겨 추가 배치한 경우 1명당 1.4점입니다. 제55조제1항 각
                호에 이 두 직종의 1인당 입소자 수 기준은 없습니다.
              </li>
              <li>
                <strong>조리원</strong> — 노인요양시설이 인력배치기준을 넘겨 조리원을 1명 이상 더 두면 인원수와 관계없이 1점이고,
                급식위탁기관은 제외합니다(제55조제3항제1호, 제56조제1항제2호다목). 조리원 점수는 인정범위에 포함하지 않습니다.
              </li>
              <li>
                근무인원은 인력배치기준과 같은 방법(제51조)으로 셉니다. 월 기준 근무시간에 못 미치는 직원들의 근무시간을 합해 셀 때
                가산은 소수점 이하를 버립니다(제51조제3항제1호).
              </li>
              <li>
                겸직 직원, 출산전후휴가 중인 직원, 유산·사산휴가를 30일 넘게 쓰고 있는 직원, 퇴사특례(제67조제2항·제3항)를 적용받는
                직원은 그 직종의 가산 근무인원수에 넣지 않습니다(제54조제5항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title="입소자 수별 — 간호(조무)사 가산 요건을 채우는 근무인원"
          description={
            <>
              <p>
                치매전담실이 없는 노인요양시설에서 간호사 또는 간호조무사 의무 인원(입소자 30명 미만 10명 이상 1명, 30명 이상 입소자
                25명당 1명을 반올림 — 노인복지법 시행규칙 별표 4 제6호, 고시 제48조제1항)보다 많고, 1인당 입소자 수가 19.0명 미만이
                되는 가장 작은 근무인원입니다.
              </p>
              <p>
                입소자 {NURSE_TWO_MORE}은 의무 인원보다 2명을 더 둬야 합니다. 예를 들어 입소자 57명은 의무 인원이{' '}
                {requiredNurses(57)}명(57 ÷ 25 = 2.28)이고, 3명을 두면 1인당 {formatHundredths(perHeadHundredths(57, 3))}명이라
                &lsquo;미만&rsquo;이 아니어서 4명({formatHundredths(perHeadHundredths(57, 4))}명)부터입니다.
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
                  <th scope="col" className="carev-ltc-num">의무 인원보다 더 둘 인원</th>
                </tr>
              </thead>
              <tbody>
                {NURSE_BANDS.map((band) => (
                  <tr key={band.from}>
                    <th scope="row">{`${band.from}~${band.to}명`}</th>
                    <td className="carev-ltc-num">{band.required}명</td>
                    <td className="carev-ltc-num carev-ltc-focus">{band.firstBonus}명</td>
                    <td className="carev-ltc-num">{band.firstBonus - band.required}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <strong>가산점수의 합</strong> — 간호(조무)사·사회복지사·물리(작업)치료사 점수는 아래 인정범위까지만 인정합니다.
                조리원(제2호다목), 치매전담실 요양보호사(마목), 한시 가산(제56조의2) 점수는 인정범위에 포함하지 않습니다(제2항 단서).
              </li>
              <li>
                <strong>서비스유형점수</strong> — 시설급여기관 1점, 치매전담실만 있는 노인요양시설 0.9점입니다(제3호가목).
              </li>
              <li>계산한 금액에 10원 미만 단수가 있으면 반올림합니다(제52조제2항).</li>
            </ul>
            <p>
              계산식은 국가법령정보센터 고시 본문에 그림으로 실려 있어, 케어브이가 그림을 내려받아 확대해 읽은 문장을 그대로 옮겼습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcBlock
          title="가산점수 인정범위 — 노인요양시설(고시 제56조제2항)"
          description={
            <p>
              고시 표 가운데 노인요양시설 칸입니다. 치매전담실이 있는 노인요양시설은 전체 입소자 수로 구간을 정합니다(제2항 본문).
              인정범위를 넘을 때 요양보호사 추가 배치 인원에 따라 범위를 늘려 주는 추가산정(제4항)은 주·야간보호기관과 단기보호기관에만
              있습니다. 노인요양공동생활가정은 같은 표의 다른 칸을 따르며, 그 칸과 공동생활가정에만 있는 0.4점·0.25점은{' '}
              <Link href="/ltc/group-home-staffing-bonus">노인요양공동생활가정 인력추가배치 가산</Link>에 정리했습니다.
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
                {NURSING_HOME_CAP_BANDS.map((band) => (
                  <tr key={band.from}>
                    <th scope="row">{capBandLabel(band)}</th>
                    <td className="carev-ltc-num carev-ltc-focus">{points(band.cap)} 이하</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LtcBlock>

        <LtcBlock title="치매전담실이 있으면">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>치매전담실과 일반실이 함께 있는 노인요양시설</strong> — 기준금액은 그달 일반실 수급자별 급여비용 합의 80%이고,
                계산식의 입소자 수는 일반실 입소자 수입니다(제56조제1항제1호가목). 인정범위 구간은 전체 입소자 수로 정합니다(제2항).
              </li>
              <li>
                <strong>치매전담실만 있는 노인요양시설</strong> — 기준금액은 치매전담실 수급자별 급여비용 합의 80%, 입소자 수는 전체
                치매전담실 입소자 수(제56조제1항제1호나목)이고, 서비스유형점수는 0.9점입니다(제3호가목).
              </li>
              <li>
                일반실과 치매전담실이 있는 노인요양시설은 어느 한 실에서 요양보호사 인력배치기준 위반 감액이 생겨도 다른 실의 요양보호사
                추가 배치 가산을 적용할 수 있습니다(제54조제3항 단서).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title={`요양보호사 초과 배치 한시 가산 — 고시 제56조의2(${EXPIRES_LABEL}까지)`}
          description={
            <p>
              제56조의2는 부칙(제2024-295호 제4조, 제2025-115호 제3조)에 따라 {EXPIRES_LABEL}까지 효력을 가집니다. 2027년 이후에도
              이어지는지는 다음 고시 개정에서 확인해야 하며, 새 고시가 나오면 이 페이지에 반영합니다.
            </p>
          }
        >
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>대상</strong> — 제44조제1항제1호의 급여비용(요양보호사 수가 입소자 2.1명당 1명 이상)을 산정하는 노인요양시설.
                치매전담실은 제외합니다.
              </li>
              <li>
                <strong>언제</strong> — 입소자 수가 줄어 전월(기준월)보다 요양보호사 의무배치인원이 줄어든 달입니다. 한시 가산이 이어지면
                연속 가산을 시작한 달의 전월(기준월)과 비교합니다(본문).
              </li>
              <li>
                <strong>점수</strong> — 인력배치기준을 넘겨 배치된 요양보호사 1명당 1.3점이고, 인정하는 인원은 전월(기준월)보다 줄어든
                의무배치인원 수까지입니다(제1호). 이 점수는 가산점수 인정범위에 포함하지 않습니다(제56조제2항 단서).
              </li>
              <li>
                <strong>기간</strong> — 해당 월을 포함해 최대 3개월 연속 적용하고, 연간 6개월 한도입니다(제2호).
              </li>
              <li>
                <strong>제외</strong> — 치매전담실과 일반실이 있는 노인요양시설에서 입소자가 실 사이를 옮겨 일반실 입소자가 줄어든
                경우(제3호), 입소자 수가 3개월을 넘겨 연속으로 줄어드는 노인요양시설(제4호).
              </li>
            </ul>
          </div>
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">입소자 수(기준월 → 해당 월)</th>
                  <th scope="col" className="carev-ltc-num">요양보호사 의무 인원</th>
                  <th scope="col" className="carev-ltc-num">줄어든 의무 인원(한도)</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">최대 한시 가산점수</th>
                </tr>
              </thead>
              <tbody>
                {TEMP_CASES.map(({ base, now }) => {
                  const limit = tempBonusLimit(base, now);
                  return (
                    <tr key={`${base}-${now}`}>
                      <th scope="row">
                        {base}명 → {now}명
                      </th>
                      <td className="carev-ltc-num">
                        {requiredStaff(base, 'nursingHome')}명 → {requiredStaff(now, 'nursingHome')}명
                      </td>
                      <td className="carev-ltc-num">{limit}명</td>
                      <td className="carev-ltc-num carev-ltc-focus">{limit === 0 ? '대상 아님' : points(limit * POINTS.tempCaregiver)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <p>
              의무 인원은 입소자 수를 2.1로 나눠 소수점 이하를 반올림한 값입니다(제44조제1항). 입소자가 40명에서 39명으로 줄어도
              의무 인원은 19명 그대로라 한시 가산 대상이 아닙니다. 표의 최대 점수는 기준을 넘긴 요양보호사가 한도 이상일 때이고,
              60명에서 55명으로 줄었는데 요양보호사를 27명 두면 기준(26명)을 넘긴 인원이 1명이라 {points(tempBonusPoints(60, 55, 27))}입니다.
            </p>
          </div>
        </LtcBlock>

        <LtcBlock title="간호사배치 가산 — 고시 제59조">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                시설급여기관이 간호사를 배치한 경우 간호사 1인당 0.6점이고, 가산금액은 제56조제1항을 준용해 셈합니다(제59조제1항).
              </li>
              <li>간호사배치 가산이 적용되는 입소자 50인 이상 노인요양시설은 0.2점을 더하여 산정합니다(제59조제2항).</li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="야간직원배치 가산 — 고시 제60조">
          <div className="carev-ltc-prose">
            <p>
              노인요양시설은 야간(22시부터 다음날 06시)에 요양보호사 또는 간호(조무)사가 1명 이상 근무한 경우 다음 두 방식 중 하나로
              가산하고, 가산금액은 제56조제1항을 준용해 셈합니다(제60조제1항).
            </p>
            <ol>
              <li>야간에 요양보호사 또는 간호(조무)사 1명 이상이 근무한 경우 — 기관당 0.9점.</li>
              <li>
                다음을 모두 채운 경우 — 야간직원 1인당 0.9점. 가. 야간근무 직원 1인당 입소자 20인 이하. 나. 주간(24시간 중 야간을 뺀
                시간)에 근무하는 요양보호사와 간호(조무)사 수의 합이 야간직원의 2배 이상. 입소자 20인 미만 기관은 동수로 배치해도
                됩니다.
              </li>
            </ol>
            <ul>
              <li>야간·주간에 배치한 인력수의 계산 등은 국민건강보험공단 이사장이 정합니다(제60조제4항).</li>
              <li>기관의 장은 공단에서 받은 야간직원배치 가산금을 야간에 근무한 종사자에게 지급해야 합니다(제60조제5항).</li>
              <li>노인요양공동생활가정은 야간에 요양보호사 또는 간호(조무)사 1명 이상이 근무하면 기관당 0.9점입니다(제60조제2항).</li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="맞춤형서비스제공 가산 — 고시 제62조">
          <div className="carev-ltc-prose">
            <p>
              관련 자격증을 가진 외부강사가 수급자 상태별 맞춤형 프로그램을 주 4회 또는 월 16회 이상(프로그램별 1회 60분 이상)
              제공하면 0.5점, 주 2~3회 또는 월 8회 이상이면 0.25점입니다. 맞춤형 프로그램을 2회 이상 제공하는 주에는 종류가 최소 2가지
              이상이어야 하고, 제70조의 치매전담형 장기요양기관은 가산하지 않습니다(제62조).
            </p>
          </div>
        </LtcBlock>

        <LtcBlock
          title="계산 예시 — 인력추가배치 가산"
          description={
            <p>
              치매전담실이 없는 노인요양시설을 가정했습니다. 급여비용 합은 계산 과정을 보이려고 정한 값이고, 간호사배치·야간직원배치
              등 다른 가산은 넣지 않았습니다.
            </p>
          }
        >
          <div className="carev-ltc-prose">
            <h3>예시 1 — 입소자 50명, 급여비용 합 1억 2,000만 원</h3>
            <ol>
              <li>
                요양보호사 {EX1.caregivers}명: 의무 인원 {EX1_CAREGIVERS_REQUIRED}명(50 ÷ 2.1 = 23.81)보다{' '}
                {EX1.caregivers - EX1_CAREGIVERS_REQUIRED}명 많지만 노인요양시설 일반실이라 가산점수는 없습니다.
              </li>
              <li>
                간호(조무)사 {EX1.nurses}명: 의무 인원 {EX1_NURSES_REQUIRED}명(50 ÷ 25 = 2), 1인당 입소자{' '}
                {formatHundredths(perHeadHundredths(EX1.residents, EX1.nurses))}명으로 19.0명 미만 → 추가 1명 × 1.2점 ={' '}
                {points(POINTS.nurse)}.
              </li>
              <li>
                사회복지사 {EX1.socialWorkers}명: 의무 인원 1명 → 추가 1명 × 1.4점 = {points(POINTS.socialWorker)}.
              </li>
              <li>
                합 {points(EX1_POINTS.raw)}은 인정범위(50명 이상 70명 미만) {points(capFor(EX1.residents))} 이하라 그대로 인정합니다.
                조리원 {EX1.cooks}명(의무 {EX1_COOKS_REQUIRED}명)은 {points(EX1_POINTS.cook)}을 따로 더해 가산점수의 합은{' '}
                {points(EX1_POINTS.total)}입니다.
              </li>
              <li>기준금액: 120,000,000원 × 80% = {won(EX1_BASE)}.</li>
              <li>
                가산금액: {won(EX1_BASE)} × ({formatPoints(EX1_POINTS.total)} ÷ {EX1.residents}) × 1 ={' '}
                <strong>{won(EX1_AMOUNT)}</strong>.
              </li>
            </ol>

            <h3>예시 2 — 입소자 45명, 인정범위를 넘는 경우, 급여비용 합 1억 원</h3>
            <ol>
              <li>
                간호(조무)사 {EX2.nurses}명: 의무 인원 {EX2_NURSES_REQUIRED}명(45 ÷ 25 = 1.8, 반올림), 1인당 입소자{' '}
                {formatHundredths(perHeadHundredths(EX2.residents, EX2.nurses))}명 → 추가 {EX2_NURSES_ADDED}명 × 1.2점 ={' '}
                {points(EX2_NURSES_ADDED * POINTS.nurse)}.
              </li>
              <li>
                물리치료사 {EX2.therapists}명·사회복지사 {EX2.socialWorkers}명: 의무 인원 각 1명 → 1.4점 + 1.4점 ={' '}
                {points(POINTS.therapist + POINTS.socialWorker)}.
              </li>
              <li>
                합 {points(EX2_POINTS.raw)}은 인정범위(30명 이상 50명 미만) {points(EX2_POINTS.cap)} 이하를 넘어{' '}
                {points(EX2_POINTS.recognized)}만 인정합니다. 노인요양시설에는 인정범위 추가산정이 없습니다.
              </li>
              <li>기준금액: 100,000,000원 × 80% = {won(EX2_BASE)}.</li>
              <li>
                가산금액: {won(EX2_BASE)} × ({formatPoints(EX2_POINTS.total)} ÷ {EX2.residents}) × 1 = 7,111,111.1…원 → 10원 미만
                반올림 <strong>{won(EX2_AMOUNT)}</strong>.
              </li>
            </ol>
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
                합니다(제54조제6항). 가산 지급기준·절차·방법 등 세부사항은 국민건강보험공단 이사장이 정합니다(제54조제7항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="근무표에 옮길 때">
          <div className="carev-ltc-prose">
            <p>
              가산은 그달 근무인원으로 따지므로, 입소자 수 구간마다 의무 인원과 가산 요건을 채우는 인원을 먼저 정하고 휴무·결원이 생겨도
              그 아래로 내려가지 않는지 봅니다. 야간직원배치 가산을 야간직원 1인당 방식으로 받으려면 야간 인원과 주간 요양보호사·간호(조무)사
              수의 비율도 근무표에서 맞춰야 합니다. 달마다 다른 월 기준 근무시간은{' '}
              <Link href="/ltc/monthly-standard-hours-2026">2026년 월 기준 근무시간</Link>에, 교대 형태별 편성 순서와 야간 배분은{' '}
              <Link href="/blog/nursing-home-three-shift-schedule">요양원 근무표 짜는 법</Link>에 정리했습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources
          sources={NURSING_HOME_BONUS_SOURCES}
          verifiedAt={NURSING_HOME_BONUS_VERIFIED_AT}
          note={
            <p>
              제53조 가산 유형 표, 제56조제1항의 계산식, 제2항의 인정범위 표는 고시 본문에 그림으로만 실려 있어, 그림을 내려받아 확대한
              뒤 흐린 숫자는 화소 단위로 확인했습니다. 추가 배치 인원은 인력배치기준을 초과해 배치한 인원(근무인원에서 의무 인원을 뺀
              수)으로 셈했습니다. 이 페이지의 간호(조무)사 근무인원 표, 한시 가산 한도 표, 계산 예시는 원문 규칙을 적용해 케어브이가
              계산한 값입니다.
            </p>
          }
        />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
