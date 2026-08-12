import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 관리자 본인 직책 변경 — 백엔드는 { positionId, position }을 돌려준다 (해제 시 둘 다 null)
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/users/position`, {
      method: 'PUT',
      headers: backendHeaders,
      body: await request.text(),
    });

    const raw = await backendResponse.text().catch(() => '');

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: raw || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }

    // 바뀐 직책을 화면이 그대로 써야 하므로 응답 본문을 버리지 않는다
    try {
      return NextResponse.json(JSON.parse(raw), { headers });
    } catch {
      return NextResponse.json({ success: true }, { headers });
    }
  } catch (error) {
    console.error('[UserPosition API] PUT 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
