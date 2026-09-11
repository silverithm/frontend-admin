/**
 * 어르신 케어 정보 갱신 프록시 — 이름·주소는 건드리지 않고 careProfile만 바꾼다.
 * 본문에 평문 주민번호가 실릴 수 있어 응답을 캐시하지 않는다.
 */
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const body = await request.json();
    // merge=true는 엑셀 채우기 — 값이 없는 칸은 저장된 값을 그대로 둔다.
    // 이 한 글자가 빠지면 자리 시트만 올려도 투약이 지워진다.
    const merge = request.nextUrl.searchParams.get('merge') === 'true' ? '?merge=true' : '';

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/elders/company/elder/${id}/care-profile${merge}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });

    const text = await backendResponse.text();
    if (!backendResponse.ok) {
      return NextResponse.json({ error: `백엔드 서버 오류: ${backendResponse.status}` }, { status: backendResponse.status, headers });
    }

    // 서버가 갱신된 careProfile을 돌려준다 — JSON이면 그대로 넘기고, 아니면 메시지로 감싼다
    try {
      return NextResponse.json(JSON.parse(text), { headers });
    } catch {
      return NextResponse.json({ message: text }, { headers });
    }
  } catch {
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
