import { Metadata } from 'next';
import Link from 'next/link';
import {
  CaregiverBandTable,
  DaycareStaffRoleTable,
  LtcBlock,
  LtcFaq,
  LtcPage,
  LtcRelated,
  LtcSources,
  buildLtcFaqJsonLd,
  type LtcFaqItem,
} from '@/components/ltc/LtcParts';
import { DEMENTIA_UNIT_MAX_USERS, STAFFING_SOURCES, STAFFING_VERIFIED_AT, monthlyStandardHours } from '@/lib/ltcStaffing';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/daycare-staffing-standard';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '주간보호센터 인력배치기준';
const DESCRIPTION =
  '주간보호센터(주·야간보호)는 이용자 7명당 요양보호사 1명 이상, 치매전담실은 4명당 1명 이상을 둬야 합니다. 이용자 수별 필요 인원, 직종별 배치 기준, 근무인원 세는 법을 노인복지법 시행규칙 별표 9와 장기요양 고시 원문과 대조해 정리했습니다.';

const NOV_2026_HOURS = monthlyStandardHours(2026, 11, []);
const DEC_2026_HOURS = monthlyStandardHours(2026, 12, [25]);

export const metadata: Metadata = {
  title: `${TITLE} — 이용자 수별 요양보호사 인원과 직종별 기준`,
  description: DESCRIPTION,
  keywords:
    '주간보호센터 인력배치기준, 주야간보호 인력기준, 주간보호 요양보호사 배치기준, 주간보호센터 요양보호사 인원, 치매전담실 요양보호사, 주간보호센터 직원배치기준, 인력배치기준 위반 감액',
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
    question: '주간보호센터 요양보호사는 이용자 몇 명당 1명인가요?',
    answer:
      '일반 주·야간보호는 이용자 7명당 1명 이상, 치매전담실은 이용자 4명당 1명 이상입니다(노인복지법 시행규칙 별표 9 제4호 가목).',
  },
  {
    question: '이용자 20명이면 요양보호사는 몇 명이 필요한가요?',
    answer:
      '20 ÷ 7 = 2.86이고 소수점 이하를 반올림하므로 3명입니다. 계산 결과가 0.5 미만이면 기본 1명을 둡니다(장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제48조제1항).',
  },
  {
    question: '이용자가 10명 미만이면 사회복지사를 꼭 둬야 하나요?',
    answer:
      '별표 9 표에서 이용자 10명 미만 행의 사회복지사 칸은 비어 있습니다. 시설장, 간호사·간호조무사·물리치료사·작업치료사 중 1명 이상, 요양보호사(7명당 1명), 조리원을 둡니다.',
  },
  {
    question: '시간제 직원도 근무인원으로 셀 수 있나요?',
    answer:
      '월 기준 근무시간에 못 미치는 같은 직종 직원들의 근무시간을 합해 월 기준 근무시간으로 나눈 값을 근무인원 수로 칠 수 있습니다. 가산을 따질 때는 소수점 이하를 버리고, 감액을 따질 때는 소수점 둘째자리를 버린 뒤 첫째자리가 4 이하면 그것도 버립니다(고시 제51조제3항).',
  },
  {
    question: '연차를 쓴 날도 근무시간으로 인정되나요?',
    answer:
      '근로기준법에 따른 연차 유급휴가 등 국민건강보험공단 이사장이 정하는 사유는 근무시간으로 인정합니다(고시 제51조제4항). 인정 사유의 세부 목록은 공단 기준을 확인해야 합니다.',
  },
  {
    question: '직원이 갑자기 그만둬서 기준을 못 맞추면 바로 감액되나요?',
    answer:
      '퇴사자가 직전 3개월 동안 월 기준 근무시간 이상 일했고, 채용 노력을 했으나 뽑지 못한 입증자료를 공단에 내고, 그동안 이용자가 적정한 서비스를 받도록 조치했다면, 후임을 뽑을 때까지 근무종료일 다음 날부터 30일(공휴일·근로자의 날·토요일 제외) 동안 그 직종 1명이 하루 8시간 근무한 것으로 인정합니다. 주·야간보호 보조원(운전사)은 하루 4시간입니다(고시 제67조제2항).',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${URL}#dataset`,
  name: '주·야간보호(주간보호센터) 직종별 인력배치기준과 이용자 수별 요양보호사 최소 인원',
  description:
    '노인복지법 시행규칙 별표 9 제4호 가목의 주·야간보호 직종별 배치 기준을 옮기고, 장기요양 급여비용 고시 제48조제1항의 반올림 규칙을 적용해 일반실(이용자 7명당 1명)과 치매전담실(4명당 1명)의 이용자 수별 요양보호사 최소 인원을 계산한 표입니다.',
  url: URL,
  inLanguage: 'ko-KR',
  dateModified: STAFFING_VERIFIED_AT,
  isBasedOn: STAFFING_SOURCES.map((source) => source.url),
  variableMeasured: ['직종', '이용자 수', '요양보호사 최소 인원(명)'],
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '케어브이' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: TITLE, path: PATH },
]);

export default function DaycareStaffingStandardPage() {
  return (
    <>
      <script {...jsonLdScriptProps(datasetJsonLd)} />
      <script {...jsonLdScriptProps(buildLtcFaqJsonLd(URL, FAQ))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title={TITLE}
        badge="별표 9 · 고시 제2026-189호 기준"
        verifiedAt={STAFFING_VERIFIED_AT}
        lede={
          <>
            <p>
              <strong>
                주간보호센터(주·야간보호)는 이용자 7명당 요양보호사 1명 이상을 둬야 하고, 치매전담실은 이용자 4명당 1명 이상입니다.
              </strong>
            </p>
            <p>
              이용자 10명 이상이면 시설장·사회복지사·조리원·보조원(운전사)과 간호사·간호조무사·물리치료사·작업치료사 중 1명 이상을 두고,
              25명 이상이면 사무원 1명을 더 둡니다. 요양보호사 수는 이용자 수를 7(치매전담실은 4)로 나눠 소수점 이하를 반올림하고, 0.5
              미만이면 1명입니다.
            </p>
          </>
        }
      >
        <LtcBlock
          title="직종별 배치 기준"
          description={
            <p>
              노인복지법 시행규칙 별표 9 제4호 가목 표의 주·야간보호 두 행입니다. 노인장기요양보험법 시행규칙 제23조제2항제1호에 따라
              재가급여를 하는 장기요양기관도 이 별표의 인력을 갖춰야 합니다.
            </p>
          }
        >
          <DaycareStaffRoleTable />
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>간호사·간호조무사·물리치료사·작업치료사</strong>는 네 직종을 합쳐 1명 이상이면 됩니다(별표 9 비고 8).
              </li>
              <li>
                <strong>시설장</strong>은 상근(1일 8시간, 월 20일 이상 근무)해야 합니다(제4호 나목).
              </li>
              <li>
                <strong>겸직 금지</strong> — 사회복지사, 간호사, 간호조무사, 물리치료사, 작업치료사, 요양보호사 1급은 다른 업무를 겸할 수
                없습니다(제4호 라목). 단독주택·공동주택에서 이용자 10명 미만으로 운영하면 시설장이 간호사·간호조무사·물리치료사·작업치료사·요양보호사
                1급 자격을 가진 경우 그 직종을 겸할 수 있고, 이때 상시 근무자는 시설장을 포함해 2명 이상(조리원 제외)이어야 합니다(마목).
              </li>
              <li>
                <strong>조리원</strong>은 영양사와 조리원이 있는 업체에 급식을 위탁하거나, 함께 운영하는 사회복지시설에 급식을 위탁하면 두지
                않을 수 있습니다(비고 7).
              </li>
              <li>
                <strong>치매전담실</strong>은 1실당 이용정원이 {DEMENTIA_UNIT_MAX_USERS}명 이하이고(제1호 나목), 프로그램관리자를 둬야
                하며, 시설장·요양보호사·프로그램관리자는 치매전문교육을 이수해야 합니다(비고 5·6).
              </li>
              <li>모든 종사자는 시설 설치·운영자와 근로계약을 맺은 사람이어야 합니다(제4호 바목).</li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title="이용자 수별 요양보호사 최소 인원 — 일반 주·야간보호"
          description={
            <p>
              이용자 수를 7로 나눠 소수점 이하를 반올림합니다. 계산 결과가 0.5 미만이면 기본 1명입니다(고시 제48조제1항). 예를 들어
              이용자 20명은 2.86이라 3명, 30명은 4.29라 4명입니다.
            </p>
          }
        >
          <CaregiverBandTable unit="general" maxUsers={59} />
        </LtcBlock>

        <LtcBlock
          title="이용자 수별 요양보호사 최소 인원 — 치매전담실"
          description={
            <p>
              이용자 수를 4로 나눠 반올림합니다. 6명은 1.5라 2명, 10명은 2.5라 3명입니다. 치매전담실과 일반실은 이용자 수와 요양보호사를
              따로 셉니다(고시 제47조제2항제5호, 제51조제3항).
            </p>
          }
        >
          <CaregiverBandTable unit="dementia" maxUsers={DEMENTIA_UNIT_MAX_USERS} />
        </LtcBlock>

        <LtcBlock title="이용자 수는 어떻게 세나">
          <div className="carev-ltc-prose">
            <p>급여비용 가산·감액을 따질 때 이용자 수는 정원이 아니라 고시 제47조에 따라 센 그달의 이용자 수입니다.</p>
            <ul>
              <li>하루 이용자 수는 그날 이용자가 가장 많은 시간대를 기준으로 셉니다(제47조제2항제2호).</li>
              <li>
                월 이용자 수는 날짜별 이용자 수를 모두 더해 그달 급여제공일수로 나누고 소수점 이하를 반올림합니다(제47조제2항제1호).
              </li>
              <li>장기요양 수급자뿐 아니라 등급외자도 포함합니다(제47조제1항제1호).</li>
              <li>미이용일 급여비용이 산정되는 수급자는 그날 이용자 수에 넣습니다(제47조제1항제3호).</li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="근무인원 1명은 어떻게 세나">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>월 기준 근무시간</strong>은 그달의 공휴일·근로자의 날·토요일을 뺀 근무가능일수 × 8시간입니다(제49조제1항). 2026년
                11월은 공휴일이 없어 21일 × 8 = {NOV_2026_HOURS}시간, 12월은 성탄절(25일)을 빼고 22일 × 8 = {DEC_2026_HOURS}시간입니다.
                임시공휴일이 지정되면 그만큼 줄어듭니다. 1~12월 값은{' '}
                <Link href="/ltc/monthly-standard-hours-2026">2026년 월 기준 근무시간</Link>에 정리했습니다.
              </li>
              <li>
                휴게시간을 뺀 실제 근무시간이 월 기준 근무시간 이상이고, 지자체에 신고한 직종으로 근무해야 1명으로 셉니다(제50조제1항,
                제51조제1항).
              </li>
              <li>
                월 기준 근무시간에 못 미치는 같은 직종 직원들은 근무시간을 합해 월 기준 근무시간으로 나눈 값으로 셀 수 있습니다. 가산은
                소수점 이하를 버리고, 감액은 소수점 둘째자리를 버린 뒤 첫째자리가 4 이하면 그것도 버립니다(제51조제3항).
              </li>
              <li>연차 유급휴가 등 공단 이사장이 정하는 사유는 근무시간으로 인정합니다(제51조제4항).</li>
              <li>보조원(운전사)은 근무시간을 모두 합해 월 기준 근무시간의 절반 이상이면 1명으로 봅니다(제51조제5항).</li>
              <li>
                치매전담형 기관에서 치매전문요양보호사가 아닌 요양보호사가 일하면 1명을 0.5명으로 셉니다. 치매전문교육을 이수한 날이 속한
                달은 치매전문요양보호사로 근무한 것으로 봅니다(제51조제1항 단서).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="기준을 못 맞추면">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>인력배치기준 위반 감액</strong> — 위반한 기간의 급여비용을 감액합니다. 시설장, 요양보호사, 간호(조무)사,
                사회복지사, 물리(작업)치료사, 영양사, 조리원, 위생원, 보조원(운전사) 9개 직종에 적용하고, 치매전담실 요양보호사는 실별로
                따집니다(제66조제1항·제2항). 직종별 감산점수 표는 고시 제66조 원문에 있습니다.
              </li>
              <li>
                <strong>연속 위반</strong> — 2개월 이상 이어지면 그달 감산점수를 이용자 30명 미만은 1.2배, 30명 이상은 1.5배로
                산정합니다(제66조제3항).
              </li>
              <li>
                <strong>가산도 빠진다</strong> — 위반한 직종은 그달 인력추가배치 가산을 받지 못하고, 3개 직종 이상 위반하면 모든 직종의
                가산이 빠집니다(제54조제3항). 가산 요건과 점수는{' '}
                <Link href="/ltc/daycare-staffing-bonus">주간보호센터 인력추가배치 가산</Link>에 정리했습니다.
              </li>
              <li>
                <strong>이용자가 늘어난 달</strong> — 요양보호사·간호(조무)사·사회복지사·물리(작업)치료사는 전월에 그 직종 기준을 지켰고
                그달 정원을 넘지 않았다면, 늘어난 이용자 때문에 생긴 위반을 직종별로 반기 1회 감액하지 않습니다(제67조제1항).
              </li>
              <li>
                <strong>정원을 넘긴 날</strong> — 인력배치와 별개로, 정원을 넘겨 운영한 날은 그날 수급자 전원의 급여비용을 정원
                초과비율에 따라 90%(5% 미만)~50%(30% 이상)만 산정합니다(제65조). 표와 인원 세는 법은{' '}
                <Link href="/ltc/daycare-over-capacity">주·야간보호 정원초과 감액</Link>에 정리했습니다.
              </li>
              <li>
                <strong>갑작스러운 퇴사</strong> — 요건을 갖추면 후임을 뽑을 때까지 30일(공휴일·근로자의 날·토요일 제외) 동안 1일
                8시간(주·야간보호 보조원은 4시간) 근무한 것으로 인정합니다. 채용 공고를 2회 이상, 회당 10일 이상 냈다면 기관당 연 2회까지
                10일을 더 인정하되 1회 최대 40일입니다(제67조제2항·제3항).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="근무표에 옮길 때">
          <div className="carev-ltc-prose">
            <p>
              그달 예상 이용자 수로 직종별 의무 인원을 먼저 구하고, 휴무·결원이 생겨도 직종별 근무인원이 그 아래로 내려가지 않는지 보면서
              근무표를 짭니다. 월 기준 근무시간을 채우지 못하는 직원이 많을수록 근무시간 합계로 따져야 하므로 여유가 줄어듭니다.
            </p>
            <p>
              케어브이 근무조정에서는 날짜마다 직종별 휴무 인원 한도를 정해 두고, 캘린더에서 날짜별 휴무 인원을 &lsquo;휴무 인원/한도&rsquo;로
              봅니다. 한도가 찬 날은 빨간색으로 표시됩니다. 케어브이가 법정 배치기준을 대신 판단하지는 않으므로 한도 값은 위 기준으로
              기관이 정합니다. 근무표 짜는 순서는{' '}
              <Link href="/blog/day-care-center-work-schedule-guide">주간보호센터 근무표 작성법</Link>에 정리했습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources sources={STAFFING_SOURCES} verifiedAt={STAFFING_VERIFIED_AT} />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
