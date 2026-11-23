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
import { requiredCaregivers } from '@/lib/ltcStaffing';
import {
  BASE_AMOUNT_PERCENT,
  BONUS_SOURCES,
  BONUS_VERIFIED_AT,
  CAP_BANDS,
  COOK_POINTS,
  EXTRA_CAP_BANDS,
  POINTS_PER_ADDED,
  SERVICE_TYPE_POINTS,
  bandLabel,
  bonusAmountWon,
  bonusPoints,
  bonusStartBands,
  capFor,
  formatHundredths,
  formatPoints,
  perHeadHundredths,
} from '@/lib/ltcStaffingBonus';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/daycare-staffing-bonus';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '주간보호센터 인력추가배치 가산';
const DESCRIPTION =
  '주간보호센터(주·야간보호)는 인력배치기준보다 직원을 더 두고 요양보호사 1인당 이용자가 6.4명 미만(치매전담실 3.9명 미만)이면 인력추가배치 가산을 받습니다. 직종별 가산점수, 이용자 수별 인정범위, 가산금액 계산식과 예시를 장기요양 고시 제55·56조 원문과 대조해 정리했습니다.';

const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
const points = (tenths: number) => `${formatPoints(tenths)}점`;

const GENERAL_BANDS = bonusStartBands('general', 70);
const TWO_MORE_USERS = GENERAL_BANDS.filter((band) => band.firstBonus - band.required >= 2)
  .map((band) => (band.from === band.to ? `${band.from}명` : `${band.from}~${band.to}명`))
  .join('·');

// 예시 1 — 이용자 30명, 요양보호사 6명, 급여비용 합 4,500만 원
const EX1 = { users: 30, caregivers: 6, cost: 45_000_000 };
const EX1_REQUIRED = requiredCaregivers(EX1.users, 'general');
const EX1_ADDED = EX1.caregivers - EX1_REQUIRED;
const EX1_POINTS = bonusPoints({ users: EX1.users, added: { caregiver: EX1_ADDED } });
const EX1_BASE = (EX1.cost * BASE_AMOUNT_PERCENT) / 100;
const EX1_AMOUNT = bonusAmountWon(EX1.cost, EX1_POINTS.total, EX1.users, SERVICE_TYPE_POINTS.general);

// 예시 2 — 이용자 25명, 요양보호사 7명, 사회복지사·조리원 1명씩 추가, 급여비용 합 3,750만 원
const EX2 = { users: 25, caregivers: 7, cost: 37_500_000 };
const EX2_REQUIRED = requiredCaregivers(EX2.users, 'general');
const EX2_ADDED = EX2.caregivers - EX2_REQUIRED;
const EX2_POINTS = bonusPoints({ users: EX2.users, added: { caregiver: EX2_ADDED, socialWorker: 1 }, cookAdded: true });
const EX2_BASE = (EX2.cost * BASE_AMOUNT_PERCENT) / 100;
const EX2_AMOUNT = bonusAmountWon(EX2.cost, EX2_POINTS.total, EX2.users, SERVICE_TYPE_POINTS.general);

// 함정 — 이용자 45명
const TRAP_REQUIRED = requiredCaregivers(45, 'general');

export const metadata: Metadata = {
  title: `${TITLE} — 요건·가산점수·인정범위와 계산 예시(고시 제55·56조)`,
  description: DESCRIPTION,
  keywords:
    '인력추가배치 가산, 주간보호센터 인력추가배치 가산, 주야간보호 가산, 주간보호 요양보호사 추가배치, 요양보호사 6.4명 미만, 가산점수 인정범위, 서비스유형점수, 인력추가배치 가산금액 계산',
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
    question: '주간보호센터 인력추가배치 가산을 받으려면 요양보호사가 몇 명이어야 하나요?',
    answer:
      '인력배치기준(이용자 7명당 1명, 소수점 이하 반올림)보다 많이 두고, 이용자 수를 요양보호사 근무인원 수로 나눈 값(소수점 셋째자리에서 절사)이 6.4명 미만이어야 합니다. 치매전담실은 3.9명 미만입니다(장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제55조제1항).',
  },
  {
    question: '요양보호사를 1명 더 두면 가산점수는 몇 점인가요?',
    answer:
      '1.2점입니다. 간호(조무)사도 1명당 1.2점, 사회복지사·물리(작업)치료사는 1명당 1.4점, 조리원은 인원수와 관계없이 1.2점입니다(고시 제56조제1항제2호).',
  },
  {
    question: '인력추가배치 가산금액은 어떻게 계산하나요?',
    answer:
      '가산금액 = 해당 월 가산 기준금액 × [가산점수의 합/입소자수] × 서비스유형점수입니다. 주·야간보호의 기준금액은 그달 수급자별 급여비용 합의 85%, 서비스유형점수는 1.5점(치매전담실만 있으면 1.3점)이고, 10원 미만은 반올림합니다(고시 제56조제1항, 제52조제2항).',
  },
  {
    question: '이용자 30명인 주간보호센터의 가산점수 인정범위는 몇 점인가요?',
    answer:
      '30명 이상 50명 미만 구간이라 6.4점 이하입니다. 가산점수의 합이 이를 넘으면 요양보호사를 4명 추가 배치한 경우 1.2점, 5명 이상 추가 배치한 경우 2.4점을 인정범위에 더합니다(고시 제56조제2항·제4항).',
  },
  {
    question: '이용자 45명인데 요양보호사를 7명 두면 가산을 받나요?',
    answer:
      '요양보호사 가산은 받지 못합니다. 의무 인원은 45 ÷ 7 = 6.43을 반올림한 6명이고, 7명이면 1인당 이용자 수가 6.42명이라 6.4명 미만이 아닙니다. 8명(5.62명)부터 요건을 채우고, 이때 추가 배치 인원은 2명입니다.',
  },
  {
    question: '조리원 가산점수도 인정범위에 들어가나요?',
    answer:
      '들어가지 않습니다. 주·야간보호의 조리원 가산점수 1.2점은 가산점수 인정범위에 포함하지 않으므로 범위와 따로 더합니다(고시 제56조제2항 단서). 급식을 위탁한 기관은 조리원 가산 대상이 아닙니다(제55조제3항제1호).',
  },
  {
    question: '시간제 요양보호사도 가산 인원으로 셀 수 있나요?',
    answer:
      '월 기준 근무시간에 못 미치는 같은 직종 직원들의 근무시간을 합해 월 기준 근무시간으로 나눈 값을 근무인원 수로 칠 수 있고, 가산을 따질 때는 소수점 이하를 버립니다(고시 제51조제3항제1호). 겸직 직원, 출산전후휴가 중인 직원, 유산·사산휴가를 30일 넘게 쓰는 직원, 퇴사특례를 적용받는 직원은 가산 근무인원수에 넣지 않습니다(제54조제5항).',
  },
  {
    question: '인력배치기준을 위반한 달에도 가산을 받을 수 있나요?',
    answer:
      '위반 감액이 적용되는 달에는 위반한 직종의 인력추가배치 가산을 적용하지 않고, 3개 직종 이상 위반하면 모든 직종에 적용하지 않습니다. 일부 직종만 기준에 못 미쳤다면 기준을 채운 다른 직종의 가산은 인정합니다(고시 제54조제1항·제3항).',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${URL}#dataset`,
  name: '주·야간보호 인력추가배치 가산 — 직종별 가산점수, 이용자 수별 가산점수 인정범위·추가산정, 가산 요건을 채우는 요양보호사 근무인원',
  description:
    '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제55조·제56조의 주·야간보호 인력추가배치 가산 요건, 직종별 가산점수, 서비스유형점수, 가산점수 인정범위(제2항)와 추가산정(제4항) 표를 옮기고, 제48조의 의무 인원과 제55조의 1인당 이용자 수 기준(6.4명 미만, 치매전담형 3.9명 미만)으로 이용자 수별 가산 요건을 채우는 요양보호사 최소 근무인원을 계산한 표입니다.',
  url: URL,
  inLanguage: 'ko-KR',
  dateModified: BONUS_VERIFIED_AT,
  isBasedOn: BONUS_SOURCES.map((source) => source.url),
  variableMeasured: ['직종', '추가 배치 1명당 가산점수', '이용자 수', '가산점수 인정범위(점)', '요양보호사 의무 인원(명)', '가산 요건을 채우는 요양보호사 근무인원(명)'],
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '케어브이' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: TITLE, path: PATH },
]);

const ROLE_ROWS: ReadonlyArray<{ role: string; points: string; rule: string }> = [
  { role: '요양보호사', points: points(POINTS_PER_ADDED.caregiver), rule: '1인당 이용자 6.4명 미만(치매전담형 3.9명 미만)' },
  { role: '간호(조무)사', points: points(POINTS_PER_ADDED.nurse), rule: '1인당 이용자 19.0명 미만' },
  { role: '사회복지사', points: points(POINTS_PER_ADDED.socialWorker), rule: '인력배치기준 초과 배치' },
  { role: '물리(작업)치료사', points: points(POINTS_PER_ADDED.therapist), rule: '인력배치기준 초과 배치' },
  { role: '조리원', points: `인원수와 관계없이 ${points(COOK_POINTS)}`, rule: '인력배치기준 초과해 1명 이상 추가(급식위탁기관 제외)' },
];

export default function DaycareStaffingBonusPage() {
  return (
    <>
      <script {...jsonLdScriptProps(datasetJsonLd)} />
      <script {...jsonLdScriptProps(buildLtcFaqJsonLd(URL, FAQ))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title={TITLE}
        badge="고시 제55·56조 · 제2026-189호 기준"
        verifiedAt={BONUS_VERIFIED_AT}
        lede={
          <>
            <p>
              <strong>
                주간보호센터(주·야간보호)는 인력배치기준보다 직원을 더 두고, 요양보호사 1인당 이용자가 6.4명 미만(치매전담실 3.9명
                미만)이면 인력추가배치 가산을 받습니다. 추가 1명당 가산점수는 요양보호사·간호(조무)사 1.2점, 사회복지사·물리(작업)치료사
                1.4점입니다.
              </strong>
            </p>
            <p>
              가산금액은 그달 수급자별 급여비용 합의 85% × (가산점수의 합 ÷ 이용자 수) × 서비스유형점수 1.5점(치매전담실만 있으면
              1.3점)입니다. 가산점수는 이용자 수 구간별 인정범위까지만 인정하고(30명 이상 50명 미만은 6.4점 이하), 조리원 1.2점은 그와
              따로 더합니다.
            </p>
          </>
        }
      >
        <LtcBlock
          title="가산 요건 — 고시 제55조"
          description={
            <p>
              고시는 주·야간보호 이용자도 &lsquo;입소자&rsquo;라고 부릅니다. 이 페이지의 이용자 수는 고시 제47조로 센 그달의 입소자
              수(날짜별로 이용자가 가장 많은 시간대 기준, 월평균 반올림)입니다.
            </p>
          }
        >
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>요양보호사</strong> — 인력배치기준보다 많이 두고, 요양보호사 1인당 이용자 수가 6.4명 미만이어야 합니다.
                치매전담형(주·야간보호 내 치매전담실, 제70조)은 3.9명 미만입니다(제55조제1항제1호다목).
              </li>
              <li>
                <strong>간호(조무)사</strong> — 인력배치기준보다 많이 두고, 1인당 이용자 수가 19.0명 미만이어야 합니다(제55조제1항제2호).
              </li>
              <li>
                <strong>사회복지사·물리(작업)치료사</strong> — 인력배치기준을 넘겨 추가 배치한 경우입니다. 제55조제1항 각 호에 이 두
                직종의 1인당 이용자 수 기준은 없습니다.
              </li>
              <li>
                <strong>1인당 이용자 수</strong>는 이용자 수를 근무인원 수로 나누고 소수점 셋째자리에서 절사합니다(제55조제1항제3호).
                45 ÷ 7 = 6.428…은 {formatHundredths(perHeadHundredths(45, 7))}명입니다.
              </li>
              <li>
                <strong>조리원</strong> — 인력배치기준을 넘겨 1명 이상 더 둔 경우 가산하며, 급식위탁기관은 제외합니다(제55조제3항제1호).
              </li>
              <li>치매전담실만 있는 주·야간보호는 요양보호사 인력추가배치 가산을 실별로 적용합니다(제55조제4항).</li>
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
          title="직종별 가산점수 — 고시 제56조제1항제2호"
          description={<p>기준을 넘겨 추가로 배치한 사람 1명당 점수입니다. 조리원만 인원수와 관계없이 한 번 받습니다.</p>}
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">직종</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">추가 1명당 가산점수</th>
                  <th scope="col">요건(제55조)</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_ROWS.map((row) => (
                  <tr key={row.role}>
                    <th scope="row">{row.role}</th>
                    <td className="carev-ltc-num carev-ltc-focus">{row.points}</td>
                    <td>{row.rule}</td>
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
                <strong>해당 월 가산 기준금액</strong> — 주·야간보호 같은 재가급여는 그달 수급자별 급여비용 합의 85%입니다(제1호). 가산을 계산하는
                급여비용은 월 한도액 범위 안의 비용만입니다(제52조제1항).
              </li>
              <li>
                <strong>가산점수의 합</strong> — 직종별 가산점수를 더하되 아래 인정범위까지만 인정하고, 조리원 점수는 범위와 따로
                더합니다(제2호, 제2항).
              </li>
              <li>
                <strong>서비스유형점수</strong> — 주·야간보호기관 1.5점, 치매전담실만 있는 주·야간보호기관 1.3점입니다(제3호나목).
              </li>
              <li>계산한 금액에 10원 미만 단수가 있으면 반올림합니다(제52조제2항).</li>
            </ul>
            <p>
              계산식은 국가법령정보센터 고시 본문에 그림으로 실려 있어, 케어브이가 그림을 내려받아 확대해 읽은 문장을 그대로 옮겼습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcBlock
          title="가산점수 인정범위 — 고시 제56조제2항"
          description={
            <p>
              고시 표 가운데 노인요양공동생활가정·주·야간보호기관·단기보호기관 칸입니다. 주·야간보호의 조리원 가산점수는 이 범위에
              포함하지 않고(제2항 단서), 치매전담실이 있는 주·야간보호는 전체 입소자 수로 구간을 정합니다(제2항 본문). 같은 표의
              노인요양시설 칸은 <Link href="/ltc/nursing-home-staffing-bonus">요양원 인력추가배치 가산</Link>에 있습니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">이용자 수</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">가산점수 인정범위</th>
                </tr>
              </thead>
              <tbody>
                {CAP_BANDS.map((band) => (
                  <tr key={band.from}>
                    <th scope="row">{bandLabel(band)}</th>
                    <td className="carev-ltc-num carev-ltc-focus">{points(band.cap)} 이하</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LtcBlock>

        <LtcBlock
          title="인정범위 추가산정 — 고시 제56조제4항"
          description={
            <p>
              이용자 10명 이상인 주·야간보호기관이 가산점수 인정범위를 넘은 경우, 요양보호사 추가 배치 인원수에 따라 인정범위를 더
              늘려 줍니다. 예를 들어 이용자 25명(인정범위 4.0점 이하)이 요양보호사를 3명 추가 배치했다면 인정범위는 5.2점 이하가
              됩니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">이용자 수</th>
                  <th scope="col" className="carev-ltc-num">요양보호사 추가 배치 인원</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">인정범위에 더하는 점수</th>
                </tr>
              </thead>
              <tbody>
                {EXTRA_CAP_BANDS.flatMap((band) =>
                  band.steps.map((step) => (
                    <tr key={`${band.from}-${step.caregivers}`}>
                      <th scope="row">{bandLabel(band)}</th>
                      <td className="carev-ltc-num">
                        {step.caregivers}명{step.orMore ? ' 이상' : ''}
                      </td>
                      <td className="carev-ltc-num carev-ltc-focus">{points(step.extra)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </LtcBlock>

        <LtcBlock
          title="이용자 수별 — 가산 요건을 채우는 요양보호사 근무인원"
          description={
            <>
              <p>
                의무 인원(이용자 수 ÷ 7, 소수점 이하 반올림, 0.5 미만은 1명 — 고시 제48조제1항)보다 많고, 1인당 이용자 수가 6.4명
                미만이 되는 가장 작은 근무인원입니다. 이용자 70명까지 대부분 의무 인원보다 1명만 더 두면 되지만 {TWO_MORE_USERS}은
                2명을 더 둬야 합니다.
              </p>
              <p>
                예를 들어 이용자 45명은 의무 인원이 {TRAP_REQUIRED}명(45 ÷ 7 = 6.43, 반올림)입니다. 요양보호사를 7명 두면 1인당 이용자
                수가 6.428…을 절사한 {formatHundredths(perHeadHundredths(45, 7))}명이라 6.4명 미만이 아닙니다. 8명이면{' '}
                {formatHundredths(perHeadHundredths(45, 8))}명으로 요건을 채웁니다. 이용자 64명은 10명이면 정확히{' '}
                {formatHundredths(perHeadHundredths(64, 10))}명이라 &lsquo;미만&rsquo;이 아니어서 11명부터입니다.
              </p>
            </>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">이용자 수</th>
                  <th scope="col" className="carev-ltc-num">의무 인원</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">가산 요건을 채우는 최소 근무인원</th>
                  <th scope="col" className="carev-ltc-num">의무 인원보다 더 둘 인원</th>
                </tr>
              </thead>
              <tbody>
                {GENERAL_BANDS.map((band) => (
                  <tr key={band.from}>
                    <th scope="row">{band.from === band.to ? `${band.from}명` : `${band.from}~${band.to}명`}</th>
                    <td className="carev-ltc-num">{band.required}명</td>
                    <td className="carev-ltc-num carev-ltc-focus">{band.firstBonus}명</td>
                    <td className="carev-ltc-num">{band.firstBonus - band.required}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <p>
              치매전담실은 의무 인원이 이용자 4명당 1명이고 요건이 3.9명 미만입니다. 이용자 1~25명을 모두 계산해 보면 어느 경우든 의무
              인원보다 1명 더 두면 3.9명 미만이 됩니다. 의무 인원 구간은{' '}
              <Link href="/ltc/daycare-staffing-standard">주간보호센터 인력배치기준</Link>에 있습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcBlock
          title="계산 예시"
          description={
            <p>
              일반실만 있는 주간보호센터를 가정했습니다. 급여비용 합은 계산 과정을 보이려고 정한 값이며, 월 한도액 범위 안의 금액이라고
              봅니다.
            </p>
          }
        >
          <div className="carev-ltc-prose">
            <h3>예시 1 — 이용자 30명, 요양보호사 6명, 급여비용 합 4,500만 원</h3>
            <ol>
              <li>
                의무 인원: 30 ÷ 7 = 4.29 → {EX1_REQUIRED}명. 1인당 이용자 수: 30 ÷ 6 ={' '}
                {formatHundredths(perHeadHundredths(EX1.users, EX1.caregivers))}명으로 6.4명 미만이라 요건을 채웁니다.
              </li>
              <li>
                가산점수: 추가 {EX1_ADDED}명 × 1.2점 = {points(EX1_POINTS.raw)}. 인정범위(30명 이상 50명 미만)는{' '}
                {points(capFor(EX1.users))} 이하라 그대로 인정합니다.
              </li>
              <li>
                기준금액: 45,000,000원 × 85% = {won(EX1_BASE)}.
              </li>
              <li>
                가산금액: {won(EX1_BASE)} × ({formatPoints(EX1_POINTS.total)} ÷ {EX1.users}) × 1.5 = <strong>{won(EX1_AMOUNT)}</strong>.
              </li>
            </ol>

            <h3>예시 2 — 이용자 25명, 요양보호사 7명, 사회복지사·조리원 1명씩 추가, 급여비용 합 3,750만 원</h3>
            <ol>
              <li>
                의무 인원: 25 ÷ 7 = 3.57 → {EX2_REQUIRED}명. 1인당 이용자 수: 25 ÷ 7 ={' '}
                {formatHundredths(perHeadHundredths(EX2.users, EX2.caregivers))}명으로 요건을 채우고, 요양보호사 추가 배치는 {EX2_ADDED}
                명입니다.
              </li>
              <li>
                가산점수: 요양보호사 {EX2_ADDED}명 × 1.2점 = {points(EX2_ADDED * POINTS_PER_ADDED.caregiver)}, 사회복지사 1명 × 1.4점 ={' '}
                {points(POINTS_PER_ADDED.socialWorker)}, 합{' '}
                {points(EX2_POINTS.raw)}.
              </li>
              <li>
                인정범위: 10명 이상 30명 미만은 {points(EX2_POINTS.cap)} 이하라 넘습니다. 요양보호사를 {EX2_ADDED}명 추가 배치했으므로
                제4항에 따라 {points(EX2_POINTS.extraCap)}을 더해 {points(EX2_POINTS.cap + EX2_POINTS.extraCap)} 이하가 되고,{' '}
                {points(EX2_POINTS.recognized)}을 모두 인정합니다.
              </li>
              <li>
                조리원 {points(EX2_POINTS.cook)}은 인정범위와 따로 더해 가산점수의 합은 {points(EX2_POINTS.total)}입니다.
              </li>
              <li>기준금액: 37,500,000원 × 85% = {won(EX2_BASE)}.</li>
              <li>
                가산금액: {won(EX2_BASE)} × ({formatPoints(EX2_POINTS.total)} ÷ {EX2.users}) × 1.5 = <strong>{won(EX2_AMOUNT)}</strong>.
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
                <strong>정원초과 감액</strong>이 적용되는 달은 급여 제공일수 중 정원초과가 생긴 날의 비율만큼 인력추가배치 가산을 빼고
                적용합니다(제54조제2항).
              </li>
              <li>
                <strong>인력배치기준 위반 감액</strong>이 적용되는 달은 위반한 직종의 가산을 적용하지 않고, 3개 직종 이상 위반하면 전
                직종에 적용하지 않습니다. 일반실과 치매전담실이 있는(치매전담실만 있는 경우 포함) 주·야간보호는 한 실에서 요양보호사
                위반 감액이 생겨도 다른 실의 요양보호사 추가 배치 가산을 적용할 수 있습니다(제54조제3항).
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

        <LtcBlock title="치매전담실이 있으면">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>치매전담실과 일반실이 함께 있는 주·야간보호</strong> — 기준금액은 그달 일반실 수급자별 급여비용 합의 85%이고,
                계산식의 입소자 수는 일반실 입소자 수입니다(제56조제1항제1호가목). 인정범위 구간은 전체 입소자 수로 정합니다(제2항).
              </li>
              <li>
                <strong>치매전담실만 있는 주·야간보호</strong> — 기준금액은 치매전담실 수급자별 급여비용 합의 85%, 입소자 수는 전체
                치매전담실 입소자 수(제56조제1항제1호나목)이고, 서비스유형점수는 1.3점입니다(제3호나목). 요양보호사 가산은 실별로
                적용합니다(제55조제4항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="주·야간보호의 다른 가산">
          <div className="carev-ltc-prose">
            <p>고시 제53조 표에서 주·야간보호기관에 적용되는 가산 유형은 인력 추가 배치, 간호사 배치, 맞춤형서비스 제공입니다.</p>
            <ul>
              <li>
                <strong>간호사배치 가산</strong> — 간호사를 배치한 경우 간호사 1인당 0.6점으로, 계산식은 제56조제1항을
                준용합니다(제59조제1항).
              </li>
              <li>
                <strong>맞춤형서비스제공 가산</strong> — 관련 자격증을 가진 외부강사가 맞춤형 프로그램을 주 4회 또는 월 16회 이상(1회
                60분 이상) 제공하면 0.5점, 주 2~3회 또는 월 8회 이상이면 0.25점입니다. 치매전담형 기관은 대상이 아닙니다(제62조).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="근무표에 옮길 때">
          <div className="carev-ltc-prose">
            <p>
              가산은 그달 근무인원으로 따지므로, 이용자 수 구간마다 요건을 채우는 인원을 먼저 정하고 휴무·결원이 생겨도 그 아래로
              내려가지 않는지 봅니다. 시간제 직원이 많으면 근무시간 합을 월 기준 근무시간으로 나눠 소수점 이하를 버리므로 생각보다
              인원이 적게 잡힐 수 있습니다. 달마다 다른 월 기준 근무시간은{' '}
              <Link href="/ltc/monthly-standard-hours-2026">2026년 월 기준 근무시간</Link>에, 근무표 짜는 순서는{' '}
              <Link href="/blog/day-care-center-work-schedule-guide">주간보호센터 근무표 작성법</Link>에 정리했습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources
          sources={BONUS_SOURCES}
          verifiedAt={BONUS_VERIFIED_AT}
          note={
            <p>
              제56조제1항의 계산식과 제2항·제4항의 표는 고시 본문에 그림으로만 실려 있어, 그림을 내려받아 확대한 뒤 흐린 숫자는 화소
              단위로 확인했습니다. 이 페이지의 &lsquo;가산 요건을 채우는 근무인원&rsquo; 표와 계산 예시는 원문 규칙을 적용해 케어브이가
              계산한 값입니다.
            </p>
          }
        />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
