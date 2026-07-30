import { NextRequest, NextResponse } from 'next/server';

// 백엔드 API URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// 기본 CORS 및 캐시 방지 헤더 설정
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// OPTIONS 요청에 대한 핸들러
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 일정 수행완료 상태 변경 (진행도 체크)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const body = await request.json();

    // 백엔드 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/v1/schedules/${id}/completion?companyId=${companyId}`,
      {
        method: 'PUT',
        headers: backendHeaders,
        body: JSON.stringify(body),
      }
    );

    // 권한 오류(403) 등은 백엔드 메시지를 그대로 전달한다
    if (!backendResponse.ok) {
      console.error(`[Schedule Completion API] 백엔드 응답 오류: ${backendResponse.status}`);
      const errorData = await backendResponse.json().catch(() => null);
      return NextResponse.json({
        error: errorData?.error || errorData?.message || `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Schedule Completion API] PUT 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}
