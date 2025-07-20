import { NextRequest, NextResponse } from 'next/server';

// 백엔드 API URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// 기본 CORS 헤더 설정
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

// OPTIONS 요청에 대한 핸들러
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

export async function POST(request: NextRequest) {
  try {

    // 요청 본문 추출
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({
        error: 'email과 password가 필요합니다.'
      }, { status: 400, headers });
    }


    // 백엔드로 요청 전달
    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true', // ngrok 브라우저 경고 우회
      },
      body: JSON.stringify({ email, password }),
    });


    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('[Signin Proxy] 백엔드 오류 응답:', errorText);
      
      return NextResponse.json({
        error: `로그인 실패: ${backendResponse.status} ${backendResponse.statusText}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();

    return NextResponse.json(data, { headers });
      
  } catch (error) {
    console.error('[Signin Proxy] 요청 처리 중 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
} 