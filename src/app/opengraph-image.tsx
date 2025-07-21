import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '케어브이 - 주간보호센터, 장기요양기관 근무표 휴무관리 프로그램'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #1e40af 50%, #4f46e5 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: 'white',
            padding: '60px',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              marginBottom: 40,
              background: 'linear-gradient(135deg, #ffffff 0%, #93c5fd 100%)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            케어브이
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: '600',
              marginBottom: 30,
              color: '#dbeafe',
            }}
          >
            주간보호센터, 장기요양기관 근무표 작성 서비스
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#bfdbfe',
              textAlign: 'center',
            }}
          >
            효율적인 휴무관리와 인력관리로 업무 부담을 줄여보세요
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}