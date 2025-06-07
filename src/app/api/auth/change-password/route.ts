import { NextRequest, NextResponse } from 'next/server';

// 백엔드 API URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://69af-211-177-230-196.ngrok-free.app';

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
    console.log('[Frontend API] 비밀번호 변경 요청 프록시 시작');
    
    // 요청 바디 파싱
    const requestBody = await request.json();
    
    console.log('[Frontend API] 비밀번호 변경 데이터:', { 
      email: requestBody.email 
    });

    // JWT 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 백엔드 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // JWT 토큰이 있으면 Authorization 헤더 추가
    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    // 백엔드로 요청 전달
    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/change/password`, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify(requestBody),
    });

    if (!backendResponse.ok) {
      console.error(`[Frontend API] 백엔드 응답 오류: ${backendResponse.status} ${backendResponse.statusText}`);
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json({
        error: errorData.error || errorData.message || `비밀번호 변경 실패: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    
    console.log('[Frontend API] 비밀번호 변경 백엔드 응답 성공');
    
    return NextResponse.json(data, { headers });
      
  } catch (error) {
    console.error('[Frontend API] 비밀번호 변경 오류:', error);
    return NextResponse.json({
      error: '비밀번호 변경 처리 중 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
} 