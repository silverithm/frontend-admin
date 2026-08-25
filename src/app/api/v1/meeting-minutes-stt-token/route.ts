import { NextRequest, NextResponse } from 'next/server';

// 회의 녹음 실시간 전사(Deepgram)용 단명 토큰 발급.
// 마스터 키(DEEPGRAM_API_KEY)는 서버 전용 — 브라우저에는 30초짜리 JWT만 내려간다.
// 브라우저는 이 토큰으로 wss://api.deepgram.com/v1/listen 에 직접 연결한다
// (연결 수립에만 쓰이고, 연결이 열린 뒤에는 만료돼도 세션이 유지된다).
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function POST(request: NextRequest) {
  try {
    if (!DEEPGRAM_API_KEY) {
      return NextResponse.json(
        { error: 'DEEPGRAM_API_KEY가 서버에 설정되지 않았습니다.' },
        { status: 500, headers },
      );
    }

    // 로그인한 사용자만 — 토큰을 백엔드에 실제 검증해서 키 무단 사용을 막는다 (ai-post와 동일)
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401, headers });
    }
    const verifyResponse = await fetch(`${BACKEND_URL}/api/v1/users/info`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: authHeader },
    });
    if (!verifyResponse.ok) {
      return NextResponse.json({ error: '로그인이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401, headers });
    }

    const grantResponse = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
    });

    if (!grantResponse.ok) {
      const errorText = await grantResponse.text();
      console.error('Deepgram 토큰 발급 오류:', grantResponse.status, errorText.slice(0, 300));
      return NextResponse.json(
        { error: '전사 서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 502, headers },
      );
    }

    const grant = await grantResponse.json();
    return NextResponse.json(
      { accessToken: grant.access_token, expiresIn: grant.expires_in },
      { headers },
    );
  } catch (error) {
    console.error('STT 토큰 발급 처리 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
