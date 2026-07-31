import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '케어브이 - 주간보호센터, 장기요양기관 근무표',
    short_name: '케어브이',
    description: '근무표 작성, 이제 5분이면 끝! 요양기관 근무표·휴무 관리 서비스',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#10B981',
    lang: 'ko',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/images/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/images/carev-favicon.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
  }
}
