import { NextResponse, NextRequest } from 'next/server';

// 휴무 일괄 삭제 프록시
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

export async function PUT(request: NextRequest) {
  try {
    const { vacationIds } = await request.json();
    if (!Array.isArray(vacationIds) || vacationIds.length === 0) {
      return NextResponse.json({ error: '삭제할 휴무 ID 목록이 필요합니다' }, { status: 400, headers });
    }

    const backendHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    const authHeader = request.headers.get('authorization');
    if (authHeader) backendHeaders['Authorization'] = authHeader;

    const response = await fetch(`${BACKEND_URL}/api/vacation/bulk-delete`, {
      method: 'PUT',
      headers: backendHeaders,
      body: JSON.stringify({ vacationIds }),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers });
  } catch (error) {
    console.error('[API] 휴무 일괄 삭제 오류:', error);
    return NextResponse.json({ error: '휴무 일괄 삭제 중 오류가 발생했습니다' }, { status: 500, headers });
  }
}
