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

// 어르신 대량 등록 — 엑셀 업로드에서 검증을 마친 명단을 한 번에 백엔드로 넘긴다
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const body = await request.json();

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/elders/company/${companyId}/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });

    // 실패 사유(인원 한도 초과 등)를 그대로 전달한다 — 상태 코드는 폴백 판단에 쓰인다
    if (!backendResponse.ok) {
      const errorBody = await backendResponse.json().catch(() => null);
      return NextResponse.json(
        { error: errorBody?.message || errorBody?.error || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }

    const data = await backendResponse.json().catch(() => ({}));
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
