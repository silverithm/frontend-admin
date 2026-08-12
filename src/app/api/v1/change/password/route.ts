import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 관리자 비밀번호 변경 — 백엔드는 성공 시 문자열을 돌려준다
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/change/password`, {
      method: 'POST',
      headers: backendHeaders,
      body: await request.text(),
    });

    const raw = await backendResponse.text().catch(() => '');

    if (!backendResponse.ok) {
      // "현재 비밀번호가 다릅니다" 같은 이유가 화면에 그대로 보여야 한다
      return NextResponse.json(
        { error: raw || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }

    try {
      return NextResponse.json(JSON.parse(raw), { headers });
    } catch {
      return NextResponse.json({ success: true, message: raw || '비밀번호가 변경되었습니다.' }, { headers });
    }
  } catch (error) {
    console.error('[ChangePassword API] POST 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
