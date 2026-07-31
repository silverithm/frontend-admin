import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 내 할 일 목록 (대시보드 위젯 / 내 업무 필터)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    let backendUrl = `${BACKEND_URL}/api/v1/schedules/my-tasks?companyId=${companyId}`;
    if (startDate) backendUrl += `&startDate=${startDate}`;
    if (endDate) backendUrl += `&endDate=${endDate}`;

    const backendResponse = await fetch(backendUrl, { method: 'GET', headers: backendHeaders });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => null);
      return NextResponse.json(
        { error: errorData?.error || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers }
      );
    }

    return NextResponse.json(await backendResponse.json(), { headers });
  } catch (error) {
    console.error('[My Tasks API] GET 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
