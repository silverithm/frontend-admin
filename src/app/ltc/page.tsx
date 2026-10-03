import { Metadata } from 'next';
import { Card } from '@astryxdesign/core/Card';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/Stack';
import { LtcBlock, LtcPage, LtcSources } from '@/components/ltc/LtcParts';
import { LTC_SOURCES } from '@/lib/ltc2026';
import { LTC_HUB_PATH, LTC_PAGES } from '@/lib/ltcPages';
import { OG_IMAGES, SITE_URL, buildBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo';

const URL = `${SITE_URL}${LTC_HUB_PATH}`;
const DESCRIPTION =
  '2026년 1월 1일부터 적용되는 장기요양 주·야간보호 수가, 등급별 월 한도액, 본인부담금 계산법을 보건복지부 고시 원문과 대조해 한곳에 정리했습니다.';

export const metadata: Metadata = {
  title: '장기요양 기준표 2026 — 수가·월 한도액·본인부담금',
  description: DESCRIPTION,
  keywords: '장기요양 기준표, 2026 장기요양 수가, 장기요양 월 한도액, 장기요양 본인부담금, 주간보호 수가, 주야간보호 비용',
  openGraph: {
    title: '장기요양 기준표 2026 | 케어브이',
    description: DESCRIPTION,
    url: URL,
    type: 'website',
    images: OG_IMAGES,
  },
  alternates: { canonical: LTC_HUB_PATH },
};

const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${URL}#collection`,
  name: '장기요양 기준표 2026',
  description: DESCRIPTION,
  url: URL,
  inLanguage: 'ko-KR',
  isPartOf: { '@id': `${SITE_URL}/#website` },
  publisher: { '@id': `${SITE_URL}/#organization` },
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: LTC_PAGES.map((page, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: page.title,
      url: `${SITE_URL}${page.path}`,
    })),
  },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([{ name: '장기요양 기준표', path: LTC_HUB_PATH }]);

export default function LtcHubPage() {
  return (
    <>
      <script {...jsonLdScriptProps(collectionJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <LtcPage
        title="장기요양 기준표 (2026년)"
        showBackLink={false}
        lede={
          <p>
            2026년 1월 1일부터 적용되는 장기요양 주·야간보호 수가, 등급별 월 한도액, 본인부담금 계산법을 보건복지부 고시 원문과 한 칸씩
            대조해 정리했습니다. 주간보호센터에서 상담·청구 때 매달 확인하는 숫자들입니다.
          </p>
        }
      >
        <LtcBlock title="기준표 목록">
          <VStack gap={3}>
            {LTC_PAGES.map((page) => (
              <Card key={page.path} padding={5}>
                <VStack gap={1}>
                  <Link href={page.path}>
                    <Text type="large" weight="semibold" color="inherit">
                      {page.title}
                    </Text>
                  </Link>
                  <Text color="secondary">{page.summary}</Text>
                </VStack>
              </Card>
            ))}
          </VStack>
        </LtcBlock>

        <LtcSources sources={[LTC_SOURCES.feeNotice, LTC_SOURCES.decree15_8, LTC_SOURCES.act40, LTC_SOURCES.reductionNotice]} />
      </LtcPage>
    </>
  );
}
