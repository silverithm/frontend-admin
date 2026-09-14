import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 지정한 날짜의 첫 메시지 id를 조회한다 — 카톡처럼 "날짜로 이동" 검색에 쓴다.
// around 라우트와 마찬가지로 원본 쿼리스트링을 그대로 백엔드에 전달한다.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const url = new URL(request.url);

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendUrl = new URL(`${BACKEND_URL}/api/v1/chat/rooms/${roomId}/messages/first-on-date`);
    url.searchParams.forEach((value, key) => backendUrl.searchParams.set(key, value));

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: backendHeaders,
    });

    if (!backendResponse.ok) {
      const data = await backendResponse.json().catch(() => ({}));
      console.error(`[Chat API] first-on-date 백엔드 응답 오류: ${backendResponse.status}`);
      return NextResponse.json({
        error: data?.error || `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Chat API] first-on-date GET 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}
