import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
