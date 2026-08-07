import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 기관 자료 목록
export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다.' }, { status: 400, headers });
    }
    const authHeader = request.headers.get('authorization');

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/company-library?companyId=${companyId}`, {
      headers: authHeader ? { Authorization: authHeader, Accept: 'application/json' } : { Accept: 'application/json' },
    });

    const data = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: data.error || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Company Library API] GET 오류:', error);
    return NextResponse.json({ error: '자료를 불러오지 못했습니다.' }, { status: 500, headers });
  }
}

// 자료 등록
export async function POST(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다.' }, { status: 400, headers });
    }
    const authHeader = request.headers.get('authorization');
    const body = await request.json();

    const backendHeaders: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (authHeader) backendHeaders.Authorization = authHeader;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/company-library?companyId=${companyId}`, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify(body),
    });

    const data = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: data.error || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Company Library API] POST 오류:', error);
    return NextResponse.json({ error: '자료 등록 중 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
