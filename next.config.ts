import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 같은 저장소에서 dev 서버와 build를 동시에 돌리면 .next를 서로 덮어써 런타임이 깨진다.
  // NEXT_DIST_DIR로 각자 다른 디렉터리를 쓰게 해두면 병행 작업이 가능하다. (기본값은 그대로 .next)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'silverithm.site',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN', // DENY에서 SAMEORIGIN으로 변경하여 링크 미리보기 허용
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // 관리자 및 결제 페이지에만 강한 보안 적용
        source: '/(admin|payment)/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY', // 민감한 페이지는 여전히 DENY 유지
          },
        ],
      },
      {
        // 셀프호스팅 rhwp-studio의 해시된 에셋(wasm/js/css) — 파일명에 해시가 있어 영구 캐시 가능
        source: '/rhwp-studio/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 결제 페이지에 대한 추가 보안 헤더
        source: '/payment/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      // 로그인 이후에만 의미가 있는 화면은 검색결과에 노출되지 않도록 한다.
      // robots.txt의 Disallow는 크롤링만 막을 뿐, 외부 링크로 발견되면 URL이 색인될 수 있다.
      ...['/admin', '/employee', '/payment', '/subscription', '/subscription-check', '/dev-sched-preview'].flatMap(
        (path) => [
          {
            source: path,
            headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
          },
          {
            source: `${path}/:path*`,
            headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
          },
        ]
      ),
    ];
  },
  async redirects() {
    return [
      // www는 같은 사이트를 그대로 서빙해 중복 문서가 된다. 대표 호스트로 통합.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.carev.kr' }],
        destination: 'https://carev.kr/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
