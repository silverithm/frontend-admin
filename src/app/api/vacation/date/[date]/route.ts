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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    // URL에서 날짜 파라미터 추출
    const { date: dateParam } = await params;
    // role 파라미터 추출
    const roleParam = request.nextUrl.searchParams.get('role');
    const role = (roleParam === 'all' || roleParam === 'caregiver' || roleParam === 'office') 
      ? roleParam : 'caregiver';
    
    // nameFilter 파라미터 추출
    const nameFilter = request.nextUrl.searchParams.get('nameFilter');
    
    // companyId 파라미터 추출
    const companyId = request.nextUrl.searchParams.get('companyId');

    console.log(`[Frontend API] 날짜 ${dateParam}에 대한 휴가 요청 조회 프록시 시작 (role=${role}, nameFilter=${nameFilter || 'none'}, companyId=${companyId})`);

    // 유효한 날짜 형식인지 확인
    if (!dateParam.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.error(`[Frontend API] 잘못된 날짜 형식: ${dateParam}`);
      return NextResponse.json({ error: '잘못된 날짜 형식입니다.' }, { 
        status: 400, 
        headers 
      });
    }

    if (!companyId) {
      return NextResponse.json({
        error: 'companyId 파라미터가 필요합니다.'
      }, { status: 400, headers });
    }

    // JWT 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 백엔드 API URL 구성 (companyId 포함)
    let backendUrl = `${BACKEND_URL}/api/vacation/date/${dateParam}?role=${role}&companyId=${companyId}`;
    
    if (nameFilter) {
      backendUrl += `&nameFilter=${encodeURIComponent(nameFilter)}`;
    }

    console.log(`[Frontend API] 백엔드 요청 URL: ${backendUrl}`);

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
    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: backendHeaders,
    });

    if (!backendResponse.ok) {
      console.error(`[Frontend API] 백엔드 응답 오류: ${backendResponse.status} ${backendResponse.statusText}`);
      return NextResponse.json({
        error: `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    
    console.log(`[Frontend API] 날짜 ${dateParam} 백엔드 응답 성공: ${data.totalVacationers || 0}명의 휴가자`);
    
    return NextResponse.json(data, { 
      status: 200, 
      headers 
    });
      
  } catch (error) {
    console.error('[Frontend API] 오류 발생:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { 
      status: 500, 
      headers 
    });
  }
} 