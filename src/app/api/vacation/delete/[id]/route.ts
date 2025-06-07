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

// OPTIONS 요청에 대한 핸들러
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// Next.js 15.3.1에서는 라우트 파라미터 처리 방식이 변경됨
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: '휴가 ID가 누락되었습니다' },
        { status: 400 }
      );
    }
    
    // 요청 바디 파싱 (삭제 요청 정보)
    const requestBody = await request.json();
    
    console.log(`[Frontend API] 휴가 삭제 요청 프록시: ID=${id}`, requestBody);

    // 백엔드로 요청 전달
    const backendResponse = await fetch(`${BACKEND_URL}/api/vacation/delete/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!backendResponse.ok) {
      console.error(`[Frontend API] 백엔드 응답 오류: ${backendResponse.status} ${backendResponse.statusText}`);
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json({
        error: errorData.error || `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    
    console.log(`[Frontend API] 휴가 삭제 백엔드 응답 성공: ID=${id}`);
    
    return NextResponse.json(data, { headers });
      
  } catch (error) {
    console.error('[Frontend API] 휴가 삭제 오류:', error);
    return NextResponse.json({
      error: '휴가 삭제 처리 중 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
} 