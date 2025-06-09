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

export async function GET(request: NextRequest) {
  try {
    console.log('[Admin Proxy] 대기중인 사용자 목록 요청');
    
    // URL에서 검색 파라미터 추출
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({
        error: 'companyId 파라미터가 필요합니다.'
      }, { status: 400, headers });
    }

    // JWT 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    console.log('[Admin Proxy] 백엔드로 요청 전달:', { companyId });

    // 백엔드로 요청 전달 (적절한 엔드포인트 사용)
    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/members/join-requests/pending?companyId=${companyId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    console.log('[Admin Proxy] 백엔드 응답 상태:', backendResponse.status);

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('[Admin Proxy] 백엔드 오류 응답:', errorText);
      
      return NextResponse.json({
        error: `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    console.log('[Admin Proxy] 백엔드 응답 성공');
    
    return NextResponse.json(data, { headers });
      
  } catch (error) {
    console.error('[Admin Proxy] 요청 처리 중 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
} 