import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 기관 홈페이지 목록 조회 (사이드바 '우리 기관' + 프로필 화면)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/users/company-homepage`, {
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
    console.error('[Company Homepage API] GET 오류:', error);
    return NextResponse.json({ error: '홈페이지 주소를 불러오지 못했습니다.' }, { status: 500, headers });
  }
}

// 대표 홈페이지 주소 단건 저장 (구버전 호환)
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const body = await request.json();

    const backendHeaders: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (authHeader) backendHeaders.Authorization = authHeader;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/users/company-homepage`, {
      method: 'PUT',
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
    console.error('[Company Homepage API] PUT 오류:', error);
    return NextResponse.json({ error: '홈페이지 주소 저장 중 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
