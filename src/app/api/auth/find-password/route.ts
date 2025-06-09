import { NextRequest, NextResponse } from 'next/server';

// 백엔드 API URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// 기본 CORS 및 캐시 방지 헤더 설정
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// OPTIONS 요청에 대한 핸들러
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Frontend API] 비밀번호 찾기 요청 프록시 시작');
    
    // URL에서 email 파라미터 추출
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({
        error: 'email 파라미터가 필요합니다.'
      }, { status: 400, headers });
    }

    console.log('[Frontend API] 비밀번호 찾기 이메일:', email);

    // 백엔드로 요청 전달 (JWT 토큰 없이)
    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/find/password?email=${encodeURIComponent(email)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      console.error(`[Frontend API] 백엔드 응답 오류: ${backendResponse.status} ${backendResponse.statusText}`);
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json({
        error: errorData.error || errorData.message || `비밀번호 찾기 실패: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    
    console.log('[Frontend API] 비밀번호 찾기 백엔드 응답 성공');
    
    return NextResponse.json(data, { headers });
      
  } catch (error) {
    console.error('[Frontend API] 비밀번호 찾기 오류:', error);
    return NextResponse.json({
      error: '비밀번호 찾기 처리 중 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
} 