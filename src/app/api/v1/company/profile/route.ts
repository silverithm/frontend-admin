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

// 기관 프로필 조회
export async function GET(request: NextRequest) {
  try {

    // JWT 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 백엔드 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // JWT 토큰이 있으면 Authorization 헤더 추가
    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    // 백엔드로 요청 전달
    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/company/profile`, {
      method: 'GET',
      headers: backendHeaders,
    });

    if (!backendResponse.ok) {
      console.error(`[Frontend API] 백엔드 응답 오류: ${backendResponse.status} ${backendResponse.statusText}`);
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json({
        error: errorData.error || `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    

    return NextResponse.json(data, { headers });
      
  } catch (error) {
    console.error('[Frontend API] 기관 프로필 조회 오류:', error);
    return NextResponse.json({
      error: '기관 프로필 조회 중 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}

// 기관 프로필 업데이트
export async function PUT(request: NextRequest) {
  try {

    // JWT 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 요청 본문 읽기
    const body = await request.json();

    // 백엔드 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // JWT 토큰이 있으면 Authorization 헤더 추가
    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    // 백엔드로 요청 전달
    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/company/profile`, {
      method: 'PUT',
      headers: backendHeaders,
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      console.error(`[Frontend API] 백엔드 응답 오류: ${backendResponse.status} ${backendResponse.statusText}`);
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json({
        error: errorData.error || `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    

    return NextResponse.json(data, { headers });
      
  } catch (error) {
    console.error('[Frontend API] 기관 프로필 업데이트 오류:', error);
    return NextResponse.json({
      error: '기관 프로필 업데이트 중 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
} 