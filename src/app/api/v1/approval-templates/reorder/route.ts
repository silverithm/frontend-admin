import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

/**
 * 결재 양식 순서 저장.
 *
 * 채팅 나가기·메시지 수정과 같은 누락이었다 — 양식을 끌어 순서를 바꿔도 프록시 경로가 없어
 * 저장이 조용히 실패했다. 화면은 새로고침 전까지 바뀐 순서를 보여주니 알아채기 어렵다.
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const companyId = request.nextUrl.searchParams.get('companyId');

    const body = await request.json();

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/v1/approval-templates/reorder${query}`,
      {
        method: 'PUT',
        headers: backendHeaders,
        body: JSON.stringify(body),
      }
    );

    if (!backendResponse.ok) {
      console.error(`[Approval Template API] 순서 저장 백엔드 응답 오류: ${backendResponse.status}`);
      return NextResponse.json({
        error: `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Approval Template API] 순서 저장 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}
