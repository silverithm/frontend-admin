import { NextResponse, NextRequest } from 'next/server';

// 백엔드 API URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

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

    // URL에서 companyId 파라미터 추출
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');
    
    if (!companyId) {
      console.error('[API] companyId 파라미터가 필요합니다');
      return NextResponse.json(
        { error: 'companyId 파라미터가 필요합니다' },
        { status: 400, headers }
      );
    }
    
    // 클라이언트에서 전달받은 JWT 토큰 가져오기
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // 백엔드 API URL (companyId 포함)
    const apiUrl = `${BACKEND_URL}/api/vacation/requests?companyId=${companyId}`;

    // 백엔드로 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    // 타임아웃 설정 (30초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: backendHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] 백엔드 응답 오류:', response.status, errorText);
      throw new Error(`백엔드 API 오류: ${response.status}`);
    }
    
    const data = await response.json();

    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[API] 휴무 요청 조회 타임아웃');
      return NextResponse.json(
        { error: '서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.' },
        { status: 504, headers }
      );
    }
    console.error('[API] 전체 휴무 요청 조회 오류:', error);
    return NextResponse.json(
      { error: '전체 휴무 요청 조회 중 오류가 발생했습니다' },
      { status: 500, headers }
    );
  }
} 