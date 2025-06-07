import { NextResponse, NextRequest } from 'next/server';

// 응답 헤더를 추가하여 캐시 방지
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store'
};

// OPTIONS 요청에 대한 핸들러 추가
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

function isValidDateFormat(dateStr: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

// GET: 기간 내 휴가 제한 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // 날짜 유효성 검사
    if (!start || !end || !isValidDateFormat(start) || !isValidDateFormat(end)) {
      console.warn(`[API] 휴가 제한 조회 요청 실패: 잘못된 날짜 형식 (start: ${start}, end: ${end})`);
      return NextResponse.json(
        { error: '유효한 start 및 end 날짜가 필요합니다 (YYYY-MM-DD 형식)' },
        { status: 400 }
      );
    }

    console.log(`[API] 휴가 제한 조회 요청: ${start} ~ ${end}`);
    
    // 클라이언트에서 전달받은 JWT 토큰 가져오기
    const authToken = request.headers.get('authorization');
    
    // 백엔드 API URL
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const apiUrl = `${backendUrl}/api/vacation/limits?start=${start}&end=${end}`;
    
    // 백엔드로 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authToken) {
      backendHeaders['Authorization'] = authToken;
    }
    
    console.log(`[API] 백엔드 요청: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: backendHeaders,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] 백엔드 응답 오류:', response.status, errorText);
      throw new Error(`백엔드 API 오류: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[API] 휴가 제한 조회 결과: ${data.limits?.length || 0}건 반환`);
    
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[API] 휴가 제한 조회 오류:', error);
    return NextResponse.json(
      { error: '휴가 제한 조회 중 오류가 발생했습니다' },
      { status: 500, headers }
    );
  }
}

// POST: 휴가 제한 설정
export async function POST(request: NextRequest) {
  try {
    // 요청 본문에서 데이터 추출
    const body = await request.json();
    const { limits } = body;
    
    console.log(`[Limits API] POST 요청 받음, ${limits?.length || 0}개 항목, 현재 시간: ${new Date().toISOString()}`);
    
    if (!limits || !Array.isArray(limits)) {
      console.error('[Limits API] 잘못된 요청 형식:', body);
      return NextResponse.json(
        { error: '올바른 형식의 휴가 제한 데이터가 필요합니다' },
        { status: 400, headers }
      );
    }
    
    // 클라이언트에서 전달받은 JWT 토큰 가져오기
    const authToken = request.headers.get('authorization');
    
    // 백엔드 API URL
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const apiUrl = `${backendUrl}/api/vacation/limits`;
    
    // 백엔드로 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authToken) {
      backendHeaders['Authorization'] = authToken;
    }
    
    console.log(`[API] 백엔드 요청: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify({ limits }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] 백엔드 응답 오류:', response.status, errorText);
      throw new Error(`백엔드 API 오류: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[Limits API] 저장 완료, 타임스탬프: ${Date.now()}`);
    
    // 캐시 방지 헤더를 포함한 성공 응답
    const responseHeaders = {
      ...headers,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'x-timestamp': Date.now().toString()
    };
    
    return NextResponse.json(data, { headers: responseHeaders });
  } catch (error) {
    console.error('[Limits API] 휴가 제한 저장 중 오류:', error);
    
    return NextResponse.json(
      {
        error: '휴가 제한 저장 중 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: Date.now()
      },
      { status: 500, headers }
    );
  }
} 