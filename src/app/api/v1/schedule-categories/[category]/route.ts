import { NextRequest, NextResponse } from 'next/server';

// 백엔드 API URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// 기본 CORS 및 캐시 방지 헤더 설정
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// OPTIONS 요청에 대한 핸들러
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 기본 일정 구분의 이름·색·숨김 변경
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({
        error: 'companyId 파라미터가 필요합니다.'
      }, { status: 400, headers });
    }

    // JWT 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const body = await request.json();

    // 백엔드 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/v1/schedule-categories/${category}?companyId=${companyId}`,
      {
        method: 'PUT',
        headers: backendHeaders,
        body: JSON.stringify(body),
      }
    );

    const data = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      console.error(`[Schedule Categories API] PUT 백엔드 응답 오류: ${backendResponse.status}`);
      return NextResponse.json(
        data?.error ? data : { error: `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers }
      );
    }

    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Schedule Categories API] PUT 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}

// 기본 일정 구분 설정을 기본값으로 되돌리기
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({
        error: 'companyId 파라미터가 필요합니다.'
      }, { status: 400, headers });
    }

    // JWT 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 백엔드 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/v1/schedule-categories/${category}?companyId=${companyId}`,
      {
        method: 'DELETE',
        headers: backendHeaders,
      }
    );

    const data = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      console.error(`[Schedule Categories API] DELETE 백엔드 응답 오류: ${backendResponse.status}`);
      return NextResponse.json(
        data?.error ? data : { error: `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers }
      );
    }

    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Schedule Categories API] DELETE 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}
