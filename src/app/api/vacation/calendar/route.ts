import { NextRequest, NextResponse } from 'next/server';

// 백엔드 API URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://69af-211-177-230-196.ngrok-free.app';

// 기본 CORS 및 캐시 방지 헤더 설정
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// OPTIONS 요청에 대한 핸들러 추가
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

export async function GET(request: NextRequest) {
  try {
    // URL에서 검색 파라미터 추출
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const roleFilter = url.searchParams.get('roleFilter') || 'all';
    const nameFilter = url.searchParams.get('nameFilter');
    const timestamp = url.searchParams.get('_t');
    const requestId = url.searchParams.get('_r');
    const retryCount = url.searchParams.get('_retry') || '0';

    console.log(`[Frontend API] 휴가 캘린더 요청 프록시 - ID: ${requestId || 'unknown'}, 시도: ${retryCount}`);
    console.log(`[Frontend API] 백엔드로 전달: ${startDate} ~ ${endDate}, 역할: ${roleFilter}, 이름: ${nameFilter || 'none'}`);

    // 파라미터 유효성 검사
    if (!startDate || !endDate) {
      return NextResponse.json({
        error: 'startDate와 endDate 파라미터가 필요합니다.'
      }, { status: 400, headers });
    }

    // 백엔드 API URL 구성
    let backendUrl = `${BACKEND_URL}/api/vacation/calendar?startDate=${startDate}&endDate=${endDate}&roleFilter=${roleFilter}`;
    
    if (nameFilter) {
      backendUrl += `&nameFilter=${encodeURIComponent(nameFilter)}`;
    }

    console.log(`[Frontend API] 백엔드 요청 URL: ${backendUrl}`);

    // 백엔드로 요청 전달
    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      console.error(`[Frontend API] 백엔드 응답 오류: ${backendResponse.status} ${backendResponse.statusText}`);
      return NextResponse.json({
        error: `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    
    console.log(`[Frontend API] 백엔드 응답 성공 - ID: ${requestId || 'unknown'}, 날짜 수: ${Object.keys(data.dates || {}).length}`);
    
    return NextResponse.json(data, { headers });
      
  } catch (error) {
    console.error('[Frontend API] 요청 처리 중 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
} 