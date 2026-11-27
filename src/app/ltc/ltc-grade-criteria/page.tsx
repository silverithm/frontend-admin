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
  ASSESSMENT_DOMAINS,
  DECISION_DAYS,
  DEMENTIA_ADJUST_BELOW,
  GERIATRIC_DISEASES,
  GRADE_CRITERIA,
  GRADE_CRITERIA_SOURCES,
  GRADE_CRITERIA_VERIFIED_AT,
  INITIAL_VALIDITY_YEARS,
  RENEWAL_WINDOW_DAYS,
  VALIDITY_ADJUST_MONTHS,
  dementiaAdjustedScore,
  domainItemCount,
  gradeById,
  gradeFor,
  rawScoreRange,
  scoreRangeLabel,
  totalItemCount,
  type LtcGradeId,
} from '@/lib/ltcGradeCriteria';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const PATH = '/ltc/ltc-grade-criteria';
const URL = `${SITE_URL}${PATH}`;
const TITLE = '장기요양등급 판정기준';
const DESCRIPTION =
  '장기요양등급은 장기요양인정 점수로 나눕니다. 1등급 95점 이상, 2등급 75~95점 미만, 3등급 60~75점 미만, 4등급 51~60점 미만, 치매환자만 받는 5등급 45~51점 미만·인지지원등급 45점 미만. 52개 조사항목, 등급별 이용 급여, 유효기간을 시행령·고시 원문과 대조했습니다.';

const gradeLabel = (id: LtcGradeId | null) => (id === null ? '해당 등급 없음' : gradeById(id).label);

/** 점수 구간을 대표하는 점수 — 구간의 아래 끝(인지지원등급은 0점) */
const representative = (minScore: number | null) => minScore ?? 0;

/** 치매 보정 표에 싣는 등급 — 75점 미만인 3등급·4등급·5등급·인지지원등급 */
const ADJUSTABLE = GRADE_CRITERIA.filter((g) => g.belowScore !== null && g.belowScore <= DEMENTIA_ADJUST_BELOW);

const TOTAL_ITEMS = totalItemCount();

export const metadata: Metadata = {
  title: `${TITLE} — 1~5등급·인지지원등급 점수 구간과 등급별 이용 급여`,
  description: DESCRIPTION,
  keywords:
    '장기요양등급 판정기준, 장기요양등급 점수, 장기요양 1등급 2등급 3등급 4등급 5등급, 인지지원등급이란, 치매 5등급, 장기요양인정 점수, 장기요양 52개 항목, 장기요양등급 유효기간, 노인성 질병',
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
    question: '장기요양등급은 몇 점이면 몇 등급인가요?',
    answer:
      '장기요양인정 점수가 95점 이상이면 1등급, 75점 이상 95점 미만 2등급, 60점 이상 75점 미만 3등급, 51점 이상 60점 미만 4등급입니다. 치매환자는 45점 이상 51점 미만이면 5등급, 45점 미만이면 인지지원등급입니다(노인장기요양보험법 시행령 제7조제1항).',
  },
  {
    question: '인지지원등급이란 무엇인가요?',
    answer:
      '치매(시행령 제2조에 따른 노인성 질병에 해당하는 치매로 한정)환자로서 장기요양인정 점수가 45점 미만인 사람의 등급입니다(시행령 제7조제1항제6호). 주·야간보호(치매전담실 포함), 장기요양 가족휴가제의 단기보호·종일 방문요양, 기타재가급여만 이용할 수 있습니다(장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제2조제3항). 유효기간은 처음 인정과 갱신 모두 2년이고, 등급판정위원회가 6개월 범위에서 늘리거나 줄일 수 있습니다(시행령 제8조).',
  },
  {
    question: '치매가 없어도 5등급을 받을 수 있나요?',
    answer:
      '받을 수 없습니다. 5등급과 인지지원등급은 시행령 별표 1의 노인성 질병에 해당하는 치매가 있는 사람만 받습니다. 치매가 아니면 51점 이상이어야 4등급이고, 51점 미만이면 시행령 제7조제1항의 어느 등급에도 해당하지 않습니다.',
  },
  {
    question: '3등급이면 요양원에 들어갈 수 있나요?',
    answer:
      '3~5등급은 원칙적으로 재가급여만 이용합니다. 다만 주수발자인 가족구성원으로부터 수발이 곤란한 경우, 주거환경이 열악하여 시설입소가 불가피한 경우, 치매 등에 따른 문제행동으로 재가급여를 이용할 수 없는 경우에 등급판정위원회로부터 시설급여가 필요한 것으로 인정받으면 시설급여를 이용할 수 있습니다(고시 제2조제2항). 1·2등급은 재가급여 또는 시설급여를 이용할 수 있습니다.',
  },
  {
    question: '5등급은 방문요양을 받을 수 있나요?',
    answer:
      '인지활동형 방문요양과 가족휴가제의 종일 방문요양만 받을 수 있습니다. 다만 주·야간보호를 1일 8시간 이상 이용하거나 천재지변·입원·사망 등으로 1일 8시간 미만 이용한 경우에는 주·야간보호 제공시간 전·후로 가정에서 옷 벗고 입기·식사도움 등 방문요양을 1일 2회 범위에서 1회 2시간까지 받을 수 있습니다(고시 제17조제7항).',
  },
  {
    question: '장기요양등급 유효기간은 몇 년인가요?',
    answer:
      '처음 인정받으면 2년입니다. 갱신되면 1등급 5년, 2~4등급 4년, 5등급·인지지원등급 2년이고, 등급판정위원회가 6개월 범위에서 늘리거나 줄일 수 있습니다(시행령 제8조). 유효기간은 원칙적으로 장기요양인정서가 수급자에게 도달한 날부터 세고, 갱신 신청은 유효기간이 끝나기 90일 전부터 30일 전까지 합니다(시행규칙 제7조·제8조제1항).',
  },
  {
    question: '장기요양인정 점수는 52개 항목 점수를 더한 것인가요?',
    answer:
      '아닙니다. 52개 항목 점수를 영역별로 더한 원점수를 100점 환산점수로 바꾸고, 이를 청결·배설·식사·기능보조·행동변화대응·간접지원·간호처치·재활훈련 8개 서비스 군의 수형분석도에 적용해 나온 서비스 군별 점수를 더합니다. 75점 미만이고 치매 요건과 회귀모형 기준을 충족하면 한 단계 위 등급의 최저점수로 합니다(장기요양등급판정기준에 관한 고시 제2조).',
  },
  {
    question: '장기요양등급 판정은 얼마나 걸리나요?',
    answer:
      '등급판정위원회는 신청서를 낸 날부터 30일 이내에 판정을 마쳐야 합니다. 정밀조사가 필요한 경우 등 부득이한 사유가 있으면 30일 이내 범위에서 연장할 수 있고, 이때 공단은 신청인과 대리인에게 내용·사유·기간을 알립니다(노인장기요양보험법 제16조).',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${URL}#dataset`,
  name: '장기요양등급 판정기준 — 1~5등급·인지지원등급 장기요양인정 점수 구간, 유효기간, 52개 조사항목, 노인성 질병',
  description:
    '노인장기요양보험법 시행령 제7조제1항의 등급별 장기요양인정 점수 구간과 치매 요건, 제8조의 유효기간, 별표 1의 노인성 질병 24개를 옮기고, 장기요양등급판정기준에 관한 고시 제2조의 52개 조사항목·영역별 점수표·치매 보정 규칙을 정리해 점수·치매 여부별 등급, 영역별 원점수 범위, 치매 보정 후 점수를 계산한 표입니다.',
  url: URL,
  inLanguage: 'ko-KR',
  dateModified: GRADE_CRITERIA_VERIFIED_AT,
  isBasedOn: GRADE_CRITERIA_SOURCES.map((source) => source.url),
  variableMeasured: ['장기요양등급', '장기요양인정 점수', '갱신 후 유효기간(년)', '조사항목', '영역별 원점수', '질병코드'],
  creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '케어브이' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: '장기요양 기준표', path: '/ltc' },
  { name: TITLE, path: PATH },
]);

export default function LtcGradeCriteriaPage() {
  return (
    <>
      <script {...jsonLdScriptProps(datasetJsonLd)} />
      <script {...jsonLdScriptProps(buildLtcFaqJsonLd(URL, FAQ))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title={TITLE}
        badge="시행령 제7조 · 등급판정기준 고시 기준"
        verifiedAt={GRADE_CRITERIA_VERIFIED_AT}
        lede={
          <>
            <p>
              <strong>
                장기요양등급은 장기요양인정 점수로 나눕니다. 1등급 95점 이상, 2등급 75점 이상 95점 미만, 3등급 60점 이상 75점 미만,
                4등급 51점 이상 60점 미만이고, 5등급(45점 이상 51점 미만)과 인지지원등급(45점 미만)은 치매환자만 받습니다.
              </strong>
            </p>
            <p>
              점수는 국민건강보험공단 직원이 장기요양인정조사표로 조사한 {TOTAL_ITEMS}개 항목(신체기능·인지기능·행동변화·간호처치·재활)을
              장기요양등급판정기준에 관한 고시의 방법으로 산정하고, 등급판정위원회가 신청서를 낸 날부터 {DECISION_DAYS}일 이내에(부득이하면{' '}
              {DECISION_DAYS}일 이내에서 연장) 판정합니다(노인장기요양보험법 시행령 제7조, 법 제14~16조). 1·2등급은 재가급여 또는 시설급여를
              이용할 수 있고, 3~5등급은
              재가급여만 이용하되 등급판정위원회가 인정하면 시설급여도 이용할 수 있으며, 인지지원등급은 주·야간보호, 가족휴가제 단기보호·종일
              방문요양, 기타재가급여만 이용할 수 있습니다.
            </p>
          </>
        }
      >
        <LtcBlock
          title="등급별 판정기준 — 시행령 제7조제1항"
          description={
            <p>
              시행령 각 호의 문장을 그대로 옮겼습니다. &lsquo;이상&rsquo;은 그 점수를 포함하고 &lsquo;미만&rsquo;은 포함하지 않으므로, 정확히
              75점이면 2등급, 60점이면 3등급, 51점이면 4등급입니다. 갱신 후 유효기간은 시행령 제8조제1항 각 호입니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">등급</th>
                  <th scope="col" className="carev-ltc-focus">장기요양인정 점수</th>
                  <th scope="col">원문 기준</th>
                  <th scope="col" className="carev-ltc-num">갱신 후 유효기간</th>
                </tr>
              </thead>
              <tbody>
                {GRADE_CRITERIA.map((grade) => (
                  <tr key={grade.id}>
                    <th scope="row">{grade.label}</th>
                    <td className="carev-ltc-focus">{scoreRangeLabel(grade)}</td>
                    <td>{grade.condition}로서</td>
                    <td className="carev-ltc-num">{grade.renewedValidityYears}년</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <ul>
              <li>
                등급판정위원회는 신청인이 신청자격요건을 충족하고 6개월 이상 동안 혼자서 일상생활을 수행하기 어렵다고 인정하는 경우 이
                기준에 따라 수급자로 판정합니다(법 제15조제2항).
              </li>
              <li>
                장기요양인정 점수는 &ldquo;장기요양이 필요한 정도를 나타내는 점수로서 보건복지부장관이 정하여 고시하는 심신의 기능 저하 상태를
                측정하는 방법에 따라 산정&rdquo;합니다(시행령 제7조제2항). 그 고시가 아래 &lsquo;장기요양등급판정기준에 관한 고시&rsquo;입니다.
              </li>
              <li>
                처음 받은 장기요양인정의 유효기간은 등급과 관계없이 {INITIAL_VALIDITY_YEARS}년입니다(시행령 제8조제1항 본문).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock
          title="같은 점수라도 치매 여부로 갈리는 구간"
          description={
            <p>
              1~4등급에는 치매 요건이 없어 치매가 있어도 점수대로 정해집니다(점수는 아래 고시 제2조제5호 치매 보정을 거친 값). 51점 미만은
              치매환자일 때만 등급이 있습니다. 여기서 치매는
              시행령 제2조의 노인성 질병(별표 1)에 해당하는 치매로 한정합니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">장기요양인정 점수</th>
                  <th scope="col" className="carev-ltc-focus">치매환자</th>
                  <th scope="col">치매가 아닌 경우</th>
                </tr>
              </thead>
              <tbody>
                {GRADE_CRITERIA.map((grade) => (
                  <tr key={grade.id}>
                    <th scope="row">{scoreRangeLabel(grade)}</th>
                    <td className="carev-ltc-focus">{gradeLabel(gradeFor(representative(grade.minScore), true))}</td>
                    <td>{gradeLabel(gradeFor(representative(grade.minScore), false))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <p>
              &lsquo;해당 등급 없음&rsquo;은 시행령 제7조제1항 여섯 호 어디에도 해당하지 않는다는 뜻입니다. 이 표는 원문 기준을 점수·치매
              여부로 나눠 케어브이가 정리한 것입니다.
            </p>
          </div>
        </LtcBlock>

        <LtcBlock
          title="장기요양인정 점수는 어떻게 매기나 — 장기요양등급판정기준에 관한 고시"
          description={
            <p>
              공단 직원은 장기요양인정조사표(시행규칙 별지 제5호서식)에 따라 조사결과서를 작성하고(시행규칙 제5조), 점수는 그 조사 결과로
              다음 순서에 따라 산정합니다(장기요양등급판정기준에 관한 고시 제2조).
            </p>
          }
        >
          <div className="carev-ltc-prose">
            <ol>
              <li>
                {TOTAL_ITEMS}개 항목마다 영역별 판단기준에 따라 점수를 매기고, 영역별로 더해 &lsquo;영역별 원점수&rsquo;를 냅니다(제1호).
              </li>
              <li>영역별 원점수를 &lsquo;영역별 100점 득점 환산표&rsquo;에 따라 &lsquo;영역별 100점 환산점수&rsquo;로 바꿉니다(제2호).</li>
              <li>
                {TOTAL_ITEMS}개 항목 조사 결과와 영역별 100점 환산점수를 청결·배설·식사·기능보조·행동변화대응·간접지원·간호처치·재활훈련
                8개 서비스 군의 수형분석도(고시 별표 1)에 적용해 서비스 군별 요양인정점수를 냅니다(제3호).
              </li>
              <li>8개 서비스 군의 요양인정점수를 모두 더한 값이 그 신청인의 요양인정점수입니다(제4호).</li>
              <li>
                75점 미만이고 조사표에서 치매가 있다고 조사되며 일상생활 자립도(치매노인) 요건을 갖춘 신청인은 회귀모형 값이 0.5 이상이면 한
                단계 위 등급의 최저점수로 합니다(제5호, 아래 &lsquo;치매 보정&rsquo;).
              </li>
            </ol>
            <p>
              그래서 {TOTAL_ITEMS}개 항목 점수를 그대로 더한 값이 장기요양인정 점수가 아닙니다. 고시는 수형분석도를 &ldquo;각 서비스
              군별로 실제 서비스 제공시간을 52개의 장기요양인정 항목과 영역별 100점 환산점수에 의한 심신상태의 패턴에 따라 적절하게
              분류하는 수형분석의 통계기법을 활용한 것&rdquo;이라고 설명합니다.
            </p>
            <h3>{TOTAL_ITEMS}개 조사항목</h3>
          </div>
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">영역</th>
                  <th scope="col" className="carev-ltc-num">항목 수</th>
                  <th scope="col">항목</th>
                </tr>
              </thead>
              <tbody>
                {ASSESSMENT_DOMAINS.map((domain) => (
                  <tr key={domain.name}>
                    <th scope="row">{domain.name}</th>
                    <td className="carev-ltc-num">{domainItemCount(domain)}개</td>
                    <td>
                      {domain.groups.map((group, index) => (
                        <span key={group.name ?? domain.name}>
                          {index > 0 && <br />}
                          {group.name ? `${group.name}(${group.items.length}개): ` : ''}
                          {group.items.join(' / ')}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <h3>영역별 판단기준과 점수</h3>
          </div>
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">영역</th>
                  <th scope="col">판단기준</th>
                  <th scope="col">점수</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">영역별 원점수 범위</th>
                </tr>
              </thead>
              <tbody>
                {ASSESSMENT_DOMAINS.map((domain) => {
                  const range = rawScoreRange(domain);
                  return (
                    <tr key={domain.name}>
                      <th scope="row">{domain.name}</th>
                      <td>
                        {domain.groups.map((group, index) => (
                          <span key={group.scale.criterion}>
                            {index > 0 && <br />}
                            {group.scale.criterion}
                          </span>
                        ))}
                      </td>
                      <td>
                        {domain.groups.map((group, index) => (
                          <span key={group.scale.criterion}>
                            {index > 0 && <br />}
                            {group.scale.options.map((option) => `${option.label} ${option.score}`).join(' · ')}
                          </span>
                        ))}
                      </td>
                      <td className="carev-ltc-num carev-ltc-focus">
                        {range.min}~{range.max}점
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <p>
              원점수 범위는 항목 수에 판단기준의 가장 낮은·높은 점수를 곱해 케어브이가 계산한 값입니다. 고시의 &lsquo;영역별 100점 득점
              환산표&rsquo;도 원점수 칸이 같은 범위로 되어 있고, 영역마다 가장 낮은 원점수는 0점, 가장 높은 원점수는 100점으로 바뀝니다.
              그 사이 환산점수와 수형분석도(별표 1)는 이 페이지에 싣지 않았습니다.
            </p>
            <h3>치매 보정 — 제5호</h3>
            <p>
              제1~4호로 산정한 점수에도 불구하고, 다음에 모두 해당하는 사람에게 회귀모형(고시 별표 2)을 적용해 그 값이 0.5 이상이면
              &ldquo;당해 신청인의 개별 요양인정점수는 한 단계 위 등급의 최저점수로 한다&rdquo;.
            </p>
            <ul>
              <li>가. 제1호에서 제4호까지의 순서에 따라 산정된 요양인정점수가 {DEMENTIA_ADJUST_BELOW}점 미만에 해당하는 자</li>
              <li>나. 「장기요양인정조사표」중 질병 및 증상에 치매가 있다고 조사된 자</li>
              <li>
                다. 「장기요양인정조사표」의 일상생활 자립도 중 치매노인(인지증) 항목이 불완전자립·부분의존 또는 완전의존에 해당하는 자
              </li>
            </ul>
          </div>
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">보정 전 점수</th>
                  <th scope="col">보정 전 등급</th>
                  <th scope="col" className="carev-ltc-num carev-ltc-focus">보정 후 점수</th>
                  <th scope="col">보정 후 등급</th>
                </tr>
              </thead>
              <tbody>
                {ADJUSTABLE.map((grade) => {
                  const adjusted = dementiaAdjustedScore(representative(grade.minScore));
                  return (
                    <tr key={grade.id}>
                      <th scope="row">{scoreRangeLabel(grade)}</th>
                      <td>{grade.label}</td>
                      <td className="carev-ltc-num carev-ltc-focus">{adjusted}점</td>
                      <td>{adjusted === null ? '—' : gradeLabel(gradeFor(adjusted, true))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <p>
              한 단계 위 등급의 최저점수를 시행령 제7조제1항 점수 구간에 대입해 케어브이가 정리한 표입니다. 회귀모형(별표 2)은 이
              페이지에서 계산하지 않았습니다.
            </p>
          </div>
        </LtcBlock>

        <LtcBlock
          title="등급별로 이용할 수 있는 급여 — 급여 고시 제2조"
          description={
            <p>
              장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시(보건복지부고시 제2026-189호) 제2조제2항·제3항입니다. 재가급여는
              방문요양·방문목욕·방문간호·주·야간보호·단기보호·기타재가급여이고, 시설급여는 노인요양시설·노인요양공동생활가정에 입소해 받는
              급여입니다(법 제23조제1항, 시행령 제10조).
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">등급</th>
                  <th scope="col">재가급여</th>
                  <th scope="col">시설급여</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">1·2등급</th>
                  <td>이용할 수 있음</td>
                  <td>이용할 수 있음</td>
                </tr>
                <tr>
                  <th scope="row">3~5등급</th>
                  <td>이용할 수 있음 (5등급 방문요양은 아래 제한)</td>
                  <td>등급판정위원회로부터 시설급여가 필요한 것으로 인정받은 경우만</td>
                </tr>
                <tr>
                  <th scope="row">인지지원등급</th>
                  <td>주·야간보호(치매전담실 포함), 가족휴가제 단기보호·종일 방문요양, 기타재가급여만</td>
                  <td>제2조제3항 목록에 없음</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>3~5등급의 시설급여</strong> — &ldquo;1. 주수발자인 가족구성원으로부터 수발이 곤란한 경우 2. 주거환경이 열악하여
                시설입소가 불가피한 경우 3. 치매 등에 따른 문제행동으로 재가급여를 이용할 수 없는 경우&rdquo; 중 하나에 해당해
                등급판정위원회로부터 시설급여가 필요한 것으로 인정받으면 이용할 수 있습니다(제2조제2항 단서).
              </li>
              <li>
                <strong>5등급의 방문요양</strong> — 인지활동형 방문요양과 종일 방문요양이 아닌 방문요양급여는 제공할 수 없습니다. 다만
                주·야간보호를 1일 8시간 이상 이용하거나 천재지변·입원·사망 등으로 8시간 미만 이용한 경우, 주·야간보호 제공시간 전·후로
                가정에서 옷 벗고 입기·식사도움 등을 1일 2회 범위에서 1회 2시간까지 제공할 수 있습니다(제17조제7항). 인지활동형 방문요양은
                5등급 치매수급자에게 주·야간보호와 같은 날 제공하지 않습니다(제8항). 방문요양 수가와 등급별 산정 범위는{' '}
                <Link href="/ltc/home-care-fee-2026">2026년 방문요양 수가표</Link>에 있습니다.
              </li>
              <li>
                <strong>주·야간보호의 인지활동형 프로그램</strong> — 5등급과 인지지원등급 수급자가 주·야간보호를 이용할 때마다 제공해야 하고,
                1~4등급 치매수급자에게는 제공할 수 있습니다(제30조제5항·제6항). 등급별 1일 급여비용은{' '}
                <Link href="/ltc/daycare-fee-2026">2026년 주·야간보호 수가표</Link>에 있습니다.
              </li>
              <li>
                <strong>치매전담형 장기요양기관</strong> — 의사소견서에 치매상병이 있거나 최근 2년 이내 치매진료내역이 있는
                2~4등급(2등급 중 시행령 제6조제1호 해당자 제외), 5등급, 인지지원등급(주·야간보호 내 치매전담실만)이 이용할 수
                있습니다(제71조제1항).
              </li>
              <li>
                <strong>장기요양 가족휴가제</strong> — 1·2등급 수급자 또는 치매가 있는 수급자는 연간 12일 이내에서 월 한도액과 관계없이
                단기보호를 이용하거나 방문요양을 1회 12시간 동안(종일 방문요양) 이용할 수 있고, 종일 방문요양 2회를 1일로 셉니다(제36조의2제1항).
              </li>
              <li>통합재가서비스 제공기관은 1~5등급 수급자에게 장기요양급여를 제공할 수 있습니다(제2조제4항).</li>
              <li>
                재가급여를 한 달에 얼마까지 쓸 수 있는지는 등급마다 다릅니다 —{' '}
                <Link href="/ltc/monthly-limit-2026">2026년 장기요양 등급별 월 한도액</Link>.
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="유효기간과 갱신 — 시행령 제8조, 시행규칙 제7조·제8조">
          <div className="carev-ltc-prose">
            <ul>
              <li>
                <strong>유효기간</strong> — 처음 인정은 {INITIAL_VALIDITY_YEARS}년입니다. 장기요양인정이 갱신되면 1등급{' '}
                {gradeById('1').renewedValidityYears}년, 2등급부터 4등급까지 {gradeById('2').renewedValidityYears}년, 5등급 및
                인지지원등급 {gradeById('5').renewedValidityYears}년입니다(시행령 제8조제1항).
              </li>
              <li>
                등급판정위원회는 신청인의 심신상태 등을 고려해 유효기간을 {VALIDITY_ADJUST_MONTHS}개월 범위에서 늘리거나 줄일 수
                있습니다(제8조제2항).
              </li>
              <li>
                시행령 제8조제1항은 2025년 7월 1일 개정됐고(대통령령 제35626호), 개정규정은 그 전에 갱신돼 유효기간이 아직 끝나지 않은
                경우에도 적용합니다(부칙 제2조).
              </li>
              <li>유효기간은 장기요양인정서가 수급자에게 도달한 날부터 셉니다(시행규칙 제7조 본문).</li>
              <li>
                <strong>갱신 신청</strong> — 유효기간이 끝나기 {RENEWAL_WINDOW_DAYS.from}일 전부터 {RENEWAL_WINDOW_DAYS.until}일 전까지
                갱신신청서에 의사소견서를 붙여 공단에 냅니다(시행규칙 제8조제1항). 공단이 업무 중에 수급자의 갱신 의사를 확인하면 갱신을
                신청한 것으로 보고, 이때도 의사소견서는 내야 합니다(제2항).
              </li>
              <li>
                <strong>갱신 조사 생략</strong> — 다음을 모두 충족하면 갱신 조사를 생략합니다(장기요양등급판정기준에 관한 고시 제3조). ①
                이번 갱신 신청으로 갱신 신청 횟수가 연속 2회 이상 ② 갱신 신청 당시 1~4등급 ③ 유효기간 종료 6개월 전 심신기능 상태 확인
                결과 세수하기·양치질하기·옮겨 앉기·화장실 사용하기·소변 조절하기의 기능자립정도가 직전 조사 결과와 일치 ④ 직전 갱신 때 낸
                의사소견서에서 노인성 질병이 확인됐거나, 갱신 신청일부터 거슬러 1등급은 최근 4년·2~4등급은 최근 3년 이내 노인성 질병
                진료내역이 있음. 갱신 신청 당시 요양인정점수가 105점 이상이면 ③·④를 충족한 것으로 봅니다. 수급자가 조사를 요청하면 생략하지
                않습니다(시행규칙 제8조제3항 단서).
              </li>
              <li>
                <strong>등급 변경</strong> — 등급이나 급여 종류·내용을 바꾸려는 수급자는 공단에 변경신청을 하고, 변경절차에는 처음 신청의
                신청·조사·판정 규정(법 제12조~제19조)을 준용합니다(법 제21조).
              </li>
            </ul>
          </div>
        </LtcBlock>

        <LtcBlock title="신청부터 판정까지 — 법 제12조~제17조">
          <div className="carev-ltc-prose">
            <ol>
              <li>
                <strong>신청 자격</strong> — 65세 이상 노인 또는 65세 미만으로 노인성 질병을 가진 사람(법 제2조제1호)으로서
                장기요양보험가입자·피부양자 또는 의료급여수급권자(제12조).
              </li>
              <li>
                <strong>신청</strong> — 장기요양인정신청서에 의사소견서를 붙여 공단에 냅니다. 의사소견서는 공단이 등급판정위원회에 자료를
                내기 전까지 내도 됩니다(제13조제1항). 65세 미만이 신청할 때 의사소견서를 내지 않으면 노인성 질병을 확인할 수 있는 진단서
                등을 신청서에 붙입니다(시행규칙 제2조제2항). 공단 조사 결과 1·2등급이 예상되는 거동불편자(보건복지부장관 고시)와 도서·벽지
                거주자(보건복지부장관 고시)는 의사소견서를 내지 않아도 됩니다(제13조제2항, 시행령 제6조, 시행규칙 제3조).
              </li>
              <li>
                <strong>조사</strong> — 공단 소속 직원이 신청인의 심신상태와 필요한 장기요양급여의 종류·내용 등을 조사하고, 2명 이상이
                조사할 수 있도록 노력해야 합니다. 조사일시·장소·담당자는 미리 알립니다(제14조).
              </li>
              <li>
                <strong>판정</strong> — 등급판정위원회가 신청서를 낸 날부터 {DECISION_DAYS}일 이내에 판정합니다. 정밀조사가 필요한 경우
                등 부득이하면 {DECISION_DAYS}일 이내 범위에서 연장할 수 있습니다(제16조제1항).
              </li>
              <li>
                <strong>통보</strong> — 공단은 장기요양등급, 장기요양급여의 종류·내용, 유효기간 등이 적힌 장기요양인정서와 월 한도액 범위
                안의 개인별장기요양이용계획서를 보냅니다(제17조제1항·제3항, 시행규칙 제6조). 수급자로 판정받지 못한 신청인에게는 그 내용과
                사유를 알립니다(제17조제2항).
              </li>
            </ol>
            <p>
              본인이 직접 신청할 수 없으면 가족·친족·이해관계인이 대리할 수 있고, 본인 또는 가족의 동의를 받아 사회복지전담공무원과
              (치매환자인 경우) 치매안심센터의 장도 대리할 수 있습니다(제22조).
            </p>
          </div>
        </LtcBlock>

        <LtcBlock
          title="노인성 질병의 종류 — 시행령 별표 1"
          description={
            <p>
              65세 미만은 이 질병이 있어야 신청할 수 있고(법 제2조제1호), 5등급·인지지원등급의 &lsquo;치매&rsquo;도 이 별표에 해당하는
              치매로 한정됩니다(시행령 제7조제1항제5호·제6호). 별표에서 질병명에 &lsquo;치매&rsquo;가 들어간 항목은 가~라입니다.
            </p>
          }
        >
          <div className="carev-ltc-tablewrap">
            <table className="carev-ltc-table">
              <thead>
                <tr>
                  <th scope="col">구분</th>
                  <th scope="col">질병명</th>
                  <th scope="col">질병코드</th>
                </tr>
              </thead>
              <tbody>
                {GERIATRIC_DISEASES.map((disease) => (
                  <tr key={disease.mark}>
                    <th scope="row">{disease.mark}</th>
                    <td>{disease.name}</td>
                    <td>{disease.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="carev-ltc-prose">
            <p>
              별표 비고: 1. 질병명 및 질병코드는 「통계법」 제22조에 따라 고시된 한국표준질병·사인분류에 따른다. 2. 진전은
              보건복지부장관이 정하여 고시하는 범위로 한다. 질병코드의 * 표시는 별표 원문 그대로입니다.
            </p>
          </div>
        </LtcBlock>

        <LtcFaq items={FAQ} />

        <LtcSources
          sources={GRADE_CRITERIA_SOURCES}
          verifiedAt={GRADE_CRITERIA_VERIFIED_AT}
          note={
            <p>
              장기요양등급판정기준에 관한 고시의 52개 항목 표와 영역별 조사항목 점수표는 고시 본문에 그림으로만 실려 있어, 그림을 내려받아
              확대해 칸마다 읽었습니다. 시행령 별표 1은 PDF 글자와 그림을 대조했습니다. 점수·치매 여부별 등급 표, 영역별 원점수 범위,
              치매 보정 표는 원문 규칙을 적용해 케어브이가 계산한 값입니다.
            </p>
          }
        />

        <LtcRelated currentPath={PATH} />
      </LtcPage>
    </>
  );
}
