import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 기관의 관리자 계정 목록 — 회원관리에서 직원과 한 표에 놓기 위한 것
export async function GET(request: NextRequest) {
  try {
    const companyId = new URL(request.url).searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = { Accept: 'application/json' };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/users/admins?companyId=${companyId}`, {
      method: 'GET',
      headers: backendHeaders,
    });

    const raw = await backendResponse.text().catch(() => '');
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: raw || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }

    return NextResponse.json(raw ? JSON.parse(raw) : { admins: [] }, { headers });
  } catch (error) {
    console.error('[CompanyAdmins API] GET 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
