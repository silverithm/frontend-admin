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
  HOLIDAYS_2026,
  HOURS_PER_DAY,
  STANDARD_HOURS_SOURCES,
  STANDARD_HOURS_VERIFIED_AT,
  formatMonthDay,
  isWeekend,
  partTimeHeadcount,
  standardHours2026,
  weekdayLabel,
} from '@/lib/ltcStandardHours';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/monthly-standard-hours-2026';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '2026년 월 기준 근무시간';

const ROWS = standardHours2026();
const hoursOf = (month: number) => ROWS[month - 1].hours;
const TOTAL_WEEKDAYS = ROWS.reduce((sum, row) => sum + row.weekdays, 0);
const TOTAL_OFF = ROWS.reduce((sum, row) => sum + row.offWeekdays.length, 0);
const TOTAL_DAYS = ROWS.reduce((sum, row) => sum + row.workableDays, 0);
const TOTAL_HOURS = ROWS.reduce((sum, row) => sum + row.hours, 0);
const JULY = ROWS[6];
const PART_TIME_EXAMPLE_HOURS = 270;
const PART_TIME_EXAMPLE = partTimeHeadcount(PART_TIME_EXAMPLE_HOURS, JULY.hours);

const MONTHLY_LIST = ROWS.map((row) => `${row.month}월 ${row.hours}시간`).join(', ');

const DESCRIPTION = `2026년 장기요양 인력배치에 쓰는 근무인원 1명의 월 기준 근무시간은 1월 ${hoursOf(1)}시간, 2월 ${hoursOf(2)}시간, 7월 ${hoursOf(7)}시간 등입니다. 고시 제49조와 2026년 4월 개정된 관공서 공휴일 규정(노동절·제헌절)을 반영해 1~12월 근무가능일수와 시간을 정리했습니다.`;

export const metadata: Metadata = {
  title: `${TITLE} — 장기요양 근무인원 1명 월별 표(제헌절·노동절 반영)`,
  description: DESCRIPTION,
  keywords:
    '월 기준 근무시간, 2026 월 기준 근무시간, 장기요양 월 기준 근무시간, 근무가능일수, 인력배치 근무시간, 주간보호 근무인원 산정, 요양원 근무인원 산정, 2026 제헌절 공휴일, 노동절 공휴일',
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
    question: '2026년 7월 월 기준 근무시간은 몇 시간인가요?',
    answer: `${JULY.hours}시간입니다. 7월 평일(월~금)은 ${JULY.weekdays}일인데, 2026년부터 공휴일이 된 제헌절(7월 17일, 금요일)을 빼면 근무가능일수가 ${JULY.workableDays}일이고 ${JULY.workableDays} × ${HOURS_PER_DAY} = ${JULY.hours}시간입니다. 제헌절을 빼지 않고 세면 ${JULY.weekdays * HOURS_PER_DAY}시간으로 ${HOURS_PER_DAY}시간 많게 잡힙니다.`,
  },
  {
    question: '월 기준 근무시간은 어떻게 계산하나요?',
    answer:
      '그달에서 공휴일, 근로자의 날, 토요일을 뺀 근무가능일수에 8시간을 곱합니다(장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제49조제1항). 일요일은 「관공서의 공휴일에 관한 규정」 제2조제1호의 공휴일이므로 결국 월~금 가운데 공휴일·대체공휴일·근로자의 날이 아닌 날을 셉니다.',
  },
  {
    question: '대체공휴일도 근무가능일수에서 빼나요?',
    answer:
      '뺍니다. 고시는 「관공서의 공휴일에 관한 규정」에 따른 공휴일과 대체공휴일을 함께 \'공휴일\'로 부릅니다(제32조제3항제2호). 2026년 대체공휴일은 3월 2일, 5월 25일, 8월 17일, 10월 5일로 모두 월요일입니다.',
  },
  {
    question: '현충일(6월 6일)과 추석 다음 날(9월 26일)은 토요일인데 대체공휴일이 없나요?',
    answer:
      '없습니다. 현충일은 대체공휴일 대상이 아니고, 설·추석 연휴는 일요일과 겹칠 때만 대체공휴일이 생깁니다(관공서의 공휴일에 관한 규정 제3조제1항). 두 날 모두 토요일이라 원래 근무가능일이 아니므로 6월과 9월 숫자에는 영향이 없습니다.',
  },
  {
    question: '6월 3일 지방선거일도 빼나요?',
    answer: `뺍니다. 「공직선거법」 제34조에 따른 임기만료에 의한 선거의 선거일은 관공서 공휴일입니다(관공서의 공휴일에 관한 규정 제2조제10호의2). 제9회 전국동시지방선거일인 6월 3일(수)을 빼면 6월은 ${ROWS[5].workableDays}일 × ${HOURS_PER_DAY} = ${hoursOf(6)}시간입니다.`,
  },
  {
    question: '근로자의 날(노동절)은 어떻게 되나요?',
    answer:
      '고시 제49조가 근로자의 날을 따로 빼도록 정하고 있고, 2026년부터는 같은 날(5월 1일)이 노동절로 관공서 공휴일이기도 합니다(관공서의 공휴일에 관한 규정 제2조제6호, 2026년 5월 1일 시행). 어느 쪽으로 보든 5월 1일은 근무가능일에서 빠집니다.',
  },
  {
    question: '월 중간에 개업하거나 휴업·폐업한 달은 어떻게 세나요?',
    answer:
      '그달 중 사업을 운영한 기간에서 공휴일, 근로자의 날, 토요일을 뺀 근무가능일수에 8시간을 곱합니다(고시 제49조제2항).',
  },
  {
    question: '2026년에 임시공휴일이 있었나요?',
    answer:
      '2026년 11월 16일까지 인사혁신처가 낸 보도자료 가운데 2026년 임시공휴일 지정은 없습니다. 임시공휴일은 국무회의 심의를 거쳐 지정하며(관공서의 공휴일에 관한 규정 제2조제11호, 제4조), 지정되면 그날도 공휴일이라 근무가능일에서 빠집니다.',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${URL}#dataset`,
  name: '2026년 월별 장기요양 월 기준 근무시간(근무인원 1명)',
  description:
    '장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제49조제1항의 [공휴일·근로자의 날·토요일을 뺀 근무가능일수 × 8시간]을 2026년 달력에 적용한 표입니다. 공휴일은 2026년 4월 30일 개정된 관공서의 공휴일에 관한 규정(노동절·제헌절 포함)과 대체공휴일 규정을 따랐습니다.',
  url: URL,
  inLanguage: 'ko-KR',
  dateModified: STANDARD_HOURS_VERIFIED_AT,
  temporalCoverage: '2026-01-01/2026-12-31',
  isBasedOn: STANDARD_HOURS_SOURCES.map((source) => source.url),
  variableMeasured: ['월', '평일(월~금) 날수', '평일에 걸린 공휴일 수', '근무가능일수', '월 기준 근무시간(시간)'],
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '케어브이' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: TITLE, path: PATH },
]);

function offDaysText(month: number): string {
  const off = ROWS[month - 1].offWeekdays;
  if (off.length === 0) return '없음';
  // '1월 1일'처럼 이름이 곧 날짜인 공휴일은 날짜를 다시 붙이지 않는다
  return off
    .map((holiday) => (/^\d+월 \d+일$/.test(holiday.name) ? holiday.name : `${holiday.name} ${Number(holiday.date.slice(8))}일`))
    .join(', ');
}

function weekendNote(date: string): string {
  return weekdayLabel(date) === '토' ? '토요일 — 원래 빠지는 날' : '일요일 — 원래 빠지는 날';
}

export default function MonthlyStandardHours2026Page() {
  return (
    <>
      <script {...jsonLdScriptProps(datasetJsonLd)} />
      <script {...jsonLdScriptProps(buildLtcFaqJsonLd(URL, FAQ))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title={TITLE}
        badge="고시 제49조 · 2026년 공휴일 반영"
        verifiedAt={STANDARD_HOURS_VERIFIED_AT}
        lede={
          <>
            <p>
              <strong>2026년 장기요양 근무인원 1명의 월 기준 근무시간은 {MONTHLY_LIST}입니다.</strong>
            </p>
            <p>
              그달 평일(월~금)에서 공휴일·대체공휴일·근로자의 날을 뺀 날수에 8시간을 곱한 값입니다(고시 제49조제1항). 2026년부터
              노동절(5월 1일)과 제헌절(7월 17일)이 관공서 공휴일이 되어, 7월은 평일 {JULY.weekdays}일에서 제헌절을 빼{' '}
              {JULY.workableDays}일 × {HOURS_PER_DAY} = {JULY.hours}시간입니다.
            </p>
          </>
        }
      >
        <LtcBlock
          title="2026년 월별 월 기준 근무시간"
          description={
            <p>
              평일에 걸린 공휴일·대체공휴일·근로자의 날만 뺍니다. 토요일·일요일에 걸린 공휴일은 처음부터 근무가능일이 아니라 숫자가
              달라지지 않습니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">월</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">월 기준 근무시간</th>
                  <th scope="col" className="carev-ltc-num">근무가능일수</th>
                  <th scope="col" className="carev-ltc-num">평일(월~금)</th>
                  <th scope="col">빼는 평일 공휴일</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.month}>
                    <th scope="row">{row.month}월</th>
                    <td className="carev-ltc-num carev-ltc-focus">{row.hours}시간</td>
                    <td className="carev-ltc-num">{row.workableDays}일</td>
                    <td className="carev-ltc-num">{row.weekdays}일</td>
                    <td>{offDaysText(row.month)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">합계</th>
                  <td className="carev-ltc-num carev-ltc-focus">{TOTAL_HOURS.toLocaleString('ko-KR')}시간</td>
                  <td className="carev-ltc-num">{TOTAL_DAYS}일</td>
                  <td className="carev-ltc-num">{TOTAL_WEEKDAYS}일</td>
                  <td>{TOTAL_OFF}일</td>
                </tr>
              </tbody>
            </table>
          </div>
        </LtcBlock>

        <LtcBlock title="계산 규칙 — 고시 제49조">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>제49조제1항</strong> — &ldquo;급여비용의 가산 또는 감액산정을 위한 근무인원 1인당 월 기준 근무시간은 [해당 월에
                공휴일, 근로자의 날 및 토요일을 제외한 근무가능일수 × 8시간]으로 한다.&rdquo;
              </li>
              <li>
                <strong>공휴일의 뜻</strong> — 같은 고시 제32조제3항제2호가 「관공서의 공휴일에 관한 규정」에 따른 공휴일과
                대체공휴일을 &lsquo;공휴일&rsquo;로 줄여 부릅니다. 일요일도 이 규정의 공휴일(제2조제1호)입니다.
              </li>
              <li>
                <strong>월 중 개업·휴폐업</strong> — 그달 사업을 운영한 기간 안에서만 근무가능일수를 셉니다(제49조제2항).
              </li>
              <li>
                <strong>말일 밤부터 다음 날까지 이어진 근무</strong> — 근무가 시작된 달의 근무시간으로 셉니다(제49조제3항).
              </li>
              <li>
                제49조는 고시 제5장 제1절(급여비용의 가산 및 감액산정 일반원칙)에 있어, 주·야간보호만이 아니라 인력배치 가산·감액을
                따지는 장기요양기관이 같은 기준으로 근무인원을 셉니다.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="2026년에 달라진 점 — 노동절·제헌절이 공휴일로">
          <div className="carev-ltc-prose">
            <p>
              「관공서의 공휴일에 관한 규정」이 2026년 4월 30일 개정되었습니다(대통령령 제36290호). 노동절(5월 1일)이 공휴일로
              추가되었고(5월 1일 시행), 제2조제2호가 &lsquo;「국경일에 관한 법률」에 따른 국경일&rsquo;로 바뀌어 국경일인 제헌절(7월
              17일)도 공휴일이 되었습니다(5월 11일 시행). 인사혁신처는 제헌절이 2008년부터 공휴일에서 빠졌다가 18년 만에 다시
              공휴일이 됐다고 밝혔습니다.
            </p>
            <ul>
              <li>
                <strong>7월</strong> — 평일 {JULY.weekdays}일 중 제헌절(7월 17일, 금)을 빼 {JULY.workableDays}일, {JULY.hours}시간입니다.
                예전처럼 제헌절을 빼지 않으면 {JULY.weekdays * HOURS_PER_DAY}시간이 되어 근무인원 계산이 달라질 수 있습니다.
              </li>
              <li>
                <strong>5월</strong> — 5월 1일은 고시가 원래부터 &lsquo;근로자의 날&rsquo;로 빼던 날이라 숫자는 같습니다(평일{' '}
                {ROWS[4].weekdays}일 − 노동절·어린이날·부처님 오신 날 대체공휴일 = {ROWS[4].workableDays}일, {hoursOf(5)}시간).
              </li>
              <li>
                노동절과 제헌절에도 대체공휴일이 적용됩니다(규정 제3조제1항제1호). 2026년에는 두 날 모두 금요일이라 대체공휴일이
                생기지 않았습니다.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title="2026년 공휴일과 대체공휴일"
          description={
            <p>
              설날·부처님 오신 날·추석의 양력 날짜는 한국천문연구원 음양력으로, 지방선거일은 중앙선거관리위원회 선거일정으로
              확인했습니다. 근거는 「관공서의 공휴일에 관한 규정」 조항입니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">날짜</th>
                  <th scope="col">공휴일</th>
                  <th scope="col">근거</th>
                  <th scope="col">근무가능일수에서</th>
                </tr>
              </thead>
              <tbody>
                {HOLIDAYS_2026.map((holiday) => (
                  <tr key={holiday.date}>
                    <th scope="row">{formatMonthDay(holiday.date)}</th>
                    <td>{holiday.name}</td>
                    <td>{holiday.basis}</td>
                    <td className={isWeekend(holiday.date) ? undefined : 'carev-ltc-focus'}>
                      {isWeekend(holiday.date) ? weekendNote(holiday.date) : '뺌'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LtcBlock>

        <LtcBlock title="대체공휴일이 생기는 날과 안 생기는 날">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>생긴 날</strong> — 3·1절(3월 1일, 일) → 3월 2일, 부처님 오신 날(5월 24일, 일) → 5월 25일, 광복절(8월 15일, 토) →
                8월 17일, 개천절(10월 3일, 토) → 10월 5일. 국경일·부처님 오신 날·노동절·어린이날·기독탄신일이 토요일이나 일요일과
                겹치면 다음 첫 번째 비공휴일이 대체공휴일입니다(제3조제1항제1호).
              </li>
              <li>
                <strong>안 생긴 날</strong> — 현충일(6월 6일, 토)은 대체공휴일 대상이 아닙니다. 추석 다음 날(9월 26일, 토)은 설·추석
                연휴가 일요일과 겹칠 때만 대체공휴일이 생기므로(제3조제1항제2호) 해당하지 않습니다.
              </li>
              <li>
                <strong>임시공휴일</strong> — 정부가 국무회의 심의를 거쳐 지정합니다(제2조제11호, 제4조). 2026년 11월 16일까지 인사혁신처
                보도자료에 2026년 임시공휴일 지정은 없습니다. 지정되면 그달 숫자가 하루(8시간)씩 줄어듭니다.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="이 시간은 어디에 쓰나">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>근무인원 1명</strong> — 휴게시간을 빼고 신고한 직종으로 월 기준 근무시간 이상 실제 근무해야 1명으로 셉니다(고시
                제51조제1항).
              </li>
              <li>
                <strong>시간제 직원 합산</strong> — 월 기준 근무시간에 못 미치는 같은 직종 직원들의 근무시간을 합해 월 기준 근무시간으로
                나눕니다. 가산은 소수점 이하를 버리고, 감액은 소수점 둘째자리를 버린 뒤 첫째자리가 4 이하면 그것도 버립니다(제51조제3항).
                예를 들어 2026년 7월에 시간제 요양보호사들의 근무시간 합이 {PART_TIME_EXAMPLE_HOURS}시간이면{' '}
                {PART_TIME_EXAMPLE_HOURS} ÷ {JULY.hours} = {(PART_TIME_EXAMPLE_HOURS / JULY.hours).toFixed(2)}…이라 가산을 따질 때는{' '}
                {PART_TIME_EXAMPLE.forBonus}명, 감액을 따질 때는 {PART_TIME_EXAMPLE.forPenalty}명입니다.
              </li>
              <li>
                <strong>주·야간보호 보조원(운전사)</strong> — 근무시간을 모두 합해 월 기준 근무시간의 100분의 50 이상이면 1명으로
                봅니다(제51조제5항). 2026년 7월이면 {JULY.hours / 2}시간입니다.
              </li>
              <li>
                <strong>선임 요양보호사 수당</strong> — 입소자 25명 이상 노인요양시설이나 이용자 35명 이상 주·야간보호기관에서 월
                기준근무시간 이상 근무한 것이 요건 중 하나입니다(제11조의7제1항제1호).
              </li>
              <li>
                <strong>갑작스러운 퇴사</strong> — 요건을 갖추면 후임을 뽑을 때까지 30일 동안 1일 8시간(주·야간보호 보조원은 4시간)
                근무한 것으로 인정하는데, 이 30일도 공휴일·근로자의 날·토요일을 빼고 셉니다(제67조제2항).
              </li>
            </ul>
            <p>
              주·야간보호의 직종별 배치 인원과 이용자 수별 요양보호사 수는{' '}
              <Link href="/ltc/daycare-staffing-standard">주간보호센터 인력배치기준</Link>에, 근무표 짜는 순서는{' '}
              <Link href="/blog/day-care-center-work-schedule-guide">주간보호센터 근무표 작성법</Link>에 정리했습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources
          sources={STANDARD_HOURS_SOURCES}
          verifiedAt={STANDARD_HOURS_VERIFIED_AT}
          note={
            <p>
              공휴일 여부는 2026년 4월 30일 개정된 「관공서의 공휴일에 관한 규정」 원문을 따랐습니다. 임시공휴일이 지정되거나 고시
              제49조가 바뀌면 이 표를 고칩니다.
            </p>
          }
        />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
