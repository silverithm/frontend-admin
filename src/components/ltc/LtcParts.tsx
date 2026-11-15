// 장기요양 기준표(/ltc) 페이지 공통 부품.
// 서버 컴포넌트다 — 표와 문답이 자바스크립트 없이 받은 HTML에 그대로 있어야 검색엔진과 AI가 읽는다.
// 계산기처럼 상호작용이 필요한 부분만 별도 클라이언트 컴포넌트로 둔다.

import { Section } from '@astryxdesign/core/Section';
import { Card } from '@astryxdesign/core/Card';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@astryxdesign/core/Link';
import { Icon } from '@astryxdesign/core/Icon';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import Navbar from '@/components/Navbar';
import {
  CARE_GRADES,
  DAYCARE_UNITS,
  HOUR_BANDS,
  LTC_EFFECTIVE_FROM,
  LTC_VERIFIED_AT,
  MONTHLY_LIMIT_2025,
  MONTHLY_LIMIT_2026,
  dailyFee,
  daysWithinLimit,
  formatWon,
  limitAddOn,
  type DaycareUnit,
} from '@/lib/ltc2026';
import { LTC_HUB_PATH, LTC_PAGES } from '@/lib/ltcPages';
import { DAYCARE_STAFF_ROWS, caregiverBands, type CareUnit } from '@/lib/ltcStaffing';

const contentWidth: React.CSSProperties = {
  width: '100%',
  maxWidth: 800,
  margin: '0 auto',
};

/** "2026-01-01" → "2026년 1월 1일" */
export function formatKoreanDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

export function LtcPage({
  title,
  lede,
  showBackLink = true,
  badge = `${formatKoreanDate(LTC_EFFECTIVE_FROM)} 시행분`,
  verifiedAt = LTC_VERIFIED_AT,
  children,
}: {
  title: string;
  /** 첫 화면 직답 — 질문에 대한 답을 한두 문장으로. 답변엔진이 이 문단을 추출한다. */
  lede: React.ReactNode;
  showBackLink?: boolean;
  /** 제목 위 배지 — 수가처럼 연도별로 바뀌는 표는 시행일, 아닌 표는 그 표에 맞는 기준을 쓴다. */
  badge?: string;
  /** 이 페이지의 원문 대조일. 페이지마다 원문이 달라 대조한 날도 다를 수 있다. */
  verifiedAt?: string;
  children: React.ReactNode;
}) {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-background-surface)' }}>
      <Navbar />

      <Section variant="transparent" padding={4} paddingBlock={8}>
        <div style={contentWidth}>
          <VStack gap={4}>
            {showBackLink && (
              <Link href={LTC_HUB_PATH}>
                <HStack gap={1} vAlign="center">
                  <Icon icon="chevronLeft" size="sm" color="inherit" />
                  <Text color="inherit">장기요양 기준표</Text>
                </HStack>
              </Link>
            )}

            <HStack gap={2} vAlign="center" wrap="wrap">
              <Badge variant="teal" label={badge} />
              <Text type="supporting" color="secondary">
                원문 대조 <time dateTime={verifiedAt}>{formatKoreanDate(verifiedAt)}</time>
              </Text>
            </HStack>

            <Heading level={1} type="display-2">
              {title}
            </Heading>

            <div className="carev-ltc-prose" style={{ fontSize: 'var(--font-size-lg)' }}>
              {lede}
            </div>
          </VStack>
        </div>
      </Section>

      <Section variant="transparent" padding={4} paddingBlock={4}>
        <div style={contentWidth}>
          <VStack gap={10}>{children}</VStack>
        </div>
      </Section>
    </main>
  );
}

/** 페이지 안의 한 덩어리. 제목은 h2라 문서 개요가 h1 → h2로 이어진다. */
export function LtcBlock({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <VStack gap={3}>
        <VStack gap={1}>
          <Heading level={2}>{title}</Heading>
          {description && (
            <div className="carev-ltc-prose">
              {description}
            </div>
          )}
        </VStack>
        {children}
      </VStack>
    </section>
  );
}

/** 주·야간보호 1일 급여비용 표 — 고시 표의 행·열 순서를 그대로 둔다. */
export function DaycareFeeTable({ unit }: { unit: DaycareUnit }) {
  const prefix = DAYCARE_UNITS.find((u) => u.id === unit)?.codePrefix ?? '라';
  const grades = CARE_GRADES.filter((g) => dailyFee(g.id, unit, 'h3to6') !== null);

  return (
    <div className="carev-ltc-tablewrap">
      <table className="carev-ltc-table">
        <thead>
          <tr>
            <th scope="col">등급</th>
            {HOUR_BANDS.map((band, index) => (
              <th
                key={band.id}
                scope="col"
                className={band.id === 'h8to10' ? 'carev-ltc-num carev-ltc-focus' : 'carev-ltc-num'}
              >
                {prefix}-{index + 1}
                <br />
                {band.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grades.map((grade) => (
            <tr key={grade.id}>
              <th scope="row">{grade.label}</th>
              {HOUR_BANDS.map((band) => (
                <td key={band.id} className={band.id === 'h8to10' ? 'carev-ltc-num carev-ltc-focus' : 'carev-ltc-num'}>
                  {dailyFee(grade.id, unit, band.id)?.toLocaleString('ko-KR')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 등급별 월 한도액 — 2026년, 2025년, 인상액. */
export function MonthlyLimitTable() {
  return (
    <div className="carev-ltc-tablewrap">
      <table className="carev-ltc-table">
        <thead>
          <tr>
            <th scope="col">등급</th>
            <th scope="col" className="carev-ltc-num carev-ltc-focus">2026년 월 한도액</th>
            <th scope="col" className="carev-ltc-num">2025년 월 한도액</th>
            <th scope="col" className="carev-ltc-num">인상액</th>
          </tr>
        </thead>
        <tbody>
          {CARE_GRADES.map((grade) => (
            <tr key={grade.id}>
              <th scope="row">{grade.label}</th>
              <td className="carev-ltc-num carev-ltc-focus">{formatWon(MONTHLY_LIMIT_2026[grade.id])}</td>
              <td className="carev-ltc-num">{formatWon(MONTHLY_LIMIT_2025[grade.id])}</td>
              <td className="carev-ltc-num">+{formatWon(MONTHLY_LIMIT_2026[grade.id] - MONTHLY_LIMIT_2025[grade.id])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 한도 안에서 8~10시간 주·야간보호를 며칠까지 이용할 수 있는지 (1일 급여비용만으로 계산). */
export function DaysWithinLimitTable() {
  return (
    <div className="carev-ltc-tablewrap">
      <table className="carev-ltc-table">
        <thead>
          <tr>
            <th scope="col">등급</th>
            <th scope="col" className="carev-ltc-num">1일 급여비용<br />(8~10시간)</th>
            <th scope="col" className="carev-ltc-num">월 한도액 안<br />이용 가능 일수</th>
            <th scope="col" className="carev-ltc-num">추가 산정 비율</th>
            <th scope="col" className="carev-ltc-num carev-ltc-focus">추가 산정 시<br />이용 가능 일수</th>
          </tr>
        </thead>
        <tbody>
          {CARE_GRADES.map((grade) => {
            const fee = dailyFee(grade.id, 'general', 'h8to10');
            const days = daysWithinLimit(grade.id, 'general', 'h8to10');
            const addOn = limitAddOn(grade.id, 'general', 'h8to10', 31);
            if (fee === null || days === null) return null;
            return (
              <tr key={grade.id}>
                <th scope="row">{grade.label}</th>
                <td className="carev-ltc-num">{formatWon(fee)}</td>
                <td className="carev-ltc-num">{formatDays(days.base)}</td>
                <td className="carev-ltc-num">{addOn.percent > 0 ? `${addOn.percent}%` : '없음'}</td>
                <td className="carev-ltc-num carev-ltc-focus">{formatDays(days.withAddOn)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatDays(days: number): string {
  return days >= 31 ? '31일 (한 달 전부)' : `${days}일`;
}

export interface LtcFaqItem {
  question: string;
  answer: string;
}

/** 자주 묻는 질문 — 화면 문장과 FAQPage 구조화 데이터가 같은 배열에서 나온다. */
export function LtcFaq({ items }: { items: ReadonlyArray<LtcFaqItem> }) {
  return (
    <LtcBlock title="자주 묻는 질문">
      <Card padding={6}>
        <VStack gap={5}>
          {items.map((item) => (
            <VStack key={item.question} gap={1}>
              <Heading level={3}>{item.question}</Heading>
              <Text color="secondary">{item.answer}</Text>
            </VStack>
          ))}
        </VStack>
      </Card>
    </LtcBlock>
  );
}

export function buildLtcFaqJsonLd(pageUrl: string, items: ReadonlyArray<LtcFaqItem>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    inLanguage: 'ko-KR',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/** 출처 — 원문 링크와 확인일. 1차 출처를 밝히는 것이 이 페이지들이 인용되는 이유다. */
export function LtcSources({
  sources,
  note,
  verifiedAt = LTC_VERIFIED_AT,
}: {
  sources: ReadonlyArray<{ name: string; url: string }>;
  note?: React.ReactNode;
  verifiedAt?: string;
}) {
  return (
    <LtcBlock title="출처">
      <Card variant="muted" padding={5}>
        <div className="carev-ltc-prose">
          <ul>
            {sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
          <p>
            케어브이가 위 원문을 직접 내려받아 표의 숫자를 한 칸씩 대조했습니다(
            <time dateTime={verifiedAt}>{formatKoreanDate(verifiedAt)}</time> 확인). 고시가 바뀌면 이 페이지도 함께 고칩니다.
          </p>
          {note}
        </div>
      </Card>
    </LtcBlock>
  );
}

/** 다른 기준표로 가는 길 + 서비스 소개. */
export function LtcRelated({ currentPath }: { currentPath: string }) {
  const others = LTC_PAGES.filter((page) => page.path !== currentPath);
  return (
    <LtcBlock title="함께 보는 기준표">
      <VStack gap={3}>
        {others.map((page) => (
          <Card key={page.path} padding={5}>
            <VStack gap={1}>
              <Link href={page.path}>
                <Text weight="semibold" color="inherit">{page.title}</Text>
              </Link>
              <Text type="supporting" color="secondary">{page.summary}</Text>
            </VStack>
          </Card>
        ))}
        <Card variant="teal" padding={6}>
          <VStack gap={3}>
            <VStack gap={1}>
              <Text weight="semibold">센터 운영은 케어브이로</Text>
              <Text color="secondary">
                주간보호센터 근무표, 휴무 승인, 배차, 전자결재를 한곳에서 관리합니다. 결제 수단 등록 없이 30일 무료로 써 볼 수 있습니다.
              </Text>
            </VStack>
            <HStack gap={2} wrap="wrap">
              <Button label="무료로 시작하기" variant="primary" href="/signup" />
              <Button label="기능 둘러보기" variant="secondary" href="/#features" />
            </HStack>
          </VStack>
        </Card>
      </VStack>
    </LtcBlock>
  );
}

/** 주·야간보호 직종별 배치 기준 — 노인복지법 시행규칙 별표 9 제4호 가목 표의 두 행(이용자 10명 이상·미만). */
export function DaycareStaffRoleTable() {
  return (
    <div className="carev-ltc-tablewrap">
      <table className="carev-ltc-table">
        <thead>
          <tr>
            <th scope="col">직종</th>
            <th scope="col" className="carev-ltc-focus">이용자 10명 이상</th>
            <th scope="col">이용자 10명 미만</th>
          </tr>
        </thead>
        <tbody>
          {DAYCARE_STAFF_ROWS.map((row) => (
            <tr key={row.role}>
              <th scope="row">{row.role}</th>
              <td className="carev-ltc-focus">{row.tenOrMore}</td>
              <td>{row.underTen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 이용자 수 구간별 요양보호사 의무 인원 — 고시 제48조제1항의 반올림·기본 1명 규칙을 적용한 값. */
export function CaregiverBandTable({ unit, maxUsers }: { unit: CareUnit; maxUsers: number }) {
  return (
    <div className="carev-ltc-tablewrap">
      <table className="carev-ltc-table">
        <thead>
          <tr>
            <th scope="col">이용자 수</th>
            <th scope="col" className="carev-ltc-num carev-ltc-focus">요양보호사 최소 인원</th>
          </tr>
        </thead>
        <tbody>
          {caregiverBands(unit, maxUsers).map((band) => (
            <tr key={band.from}>
              <th scope="row">{band.from === band.to ? `${band.from}명` : `${band.from}~${band.to}명`}</th>
              <td className="carev-ltc-num carev-ltc-focus">{band.caregivers}명</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
