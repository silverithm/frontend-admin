import { NextRequest, NextResponse } from 'next/server';

// 백엔드 API URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// 기본 CORS 및 캐시 방지 헤더 설정
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// OPTIONS 요청에 대한 핸들러
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 공지사항 목록 조회 (관리자)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const searchQuery = url.searchParams.get('searchQuery');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    if (!companyId) {
      return NextResponse.json({
        error: 'companyId 파라미터가 필요합니다.'
      }, { status: 400, headers });
    }

    // JWT 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 백엔드 API URL 구성
    let backendUrl = `${BACKEND_URL}/api/v1/notices?companyId=${companyId}`;
    if (status) backendUrl += `&status=${status}`;
    if (priority) backendUrl += `&priority=${priority}`;
    if (searchQuery) backendUrl += `&searchQuery=${encodeURIComponent(searchQuery)}`;
    if (startDate) backendUrl += `&startDate=${startDate}`;
    if (endDate) backendUrl += `&endDate=${endDate}`;

    // 백엔드 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: backendHeaders,
    });

    if (!backendResponse.ok) {
      console.error(`[Notices API] 백엔드 응답 오류: ${backendResponse.status}`);
      return NextResponse.json({
        error: `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Notices API] GET 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}

// 공지사항 등록 (관리자)
export async function POST(request: NextRequest) {
  try {
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

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/notices?companyId=${companyId}`, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      console.error(`[Notices API] POST 백엔드 응답 오류: ${backendResponse.status}`);
      return NextResponse.json({
        error: `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Notices API] POST 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}
