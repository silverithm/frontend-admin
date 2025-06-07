import { NextResponse, NextRequest } from 'next/server';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store'
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// GET: 전체 휴무 요청 조회
export async function GET(request: NextRequest) {
  try {
    console.log('[API] 전체 휴무 요청 조회 시작');
    
    // 클라이언트에서 전달받은 JWT 토큰 가져오기
    const authToken = request.headers.get('authorization');
    
    // 백엔드 API URL
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const apiUrl = `${backendUrl}/api/vacation/requests`;
    
    // 백엔드로 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authToken) {
      backendHeaders['Authorization'] = authToken;
    }
    
    console.log(`[API] 백엔드 요청: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: backendHeaders,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] 백엔드 응답 오류:', response.status, errorText);
      throw new Error(`백엔드 API 오류: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[API] 전체 휴무 요청 조회 결과: ${data?.length || 0}건 반환`);
    
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[API] 전체 휴무 요청 조회 오류:', error);
    return NextResponse.json(
      { error: '전체 휴무 요청 조회 중 오류가 발생했습니다' },
      { status: 500, headers }
    );
  }
} 