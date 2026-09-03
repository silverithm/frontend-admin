import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

/**
 * 채팅방 나가기.
 *
 * 이 파일이 없어서 "컴퓨터로는 나가기가 안 된다"는 이야기가 나왔다. 화면에도 API 함수에도
 * 나가기가 멀쩡히 있었는데, 중간 프록시 경로만 빠져 있어 요청이 백엔드에 닿기 전에 404가 났다.
 * 서버 로그에 나가기 기록이 아예 없던 게 그 증거다.
 *
 * userId는 쿼리와 본문 양쪽으로 간다 — 백엔드가 둘 다 받고, 앱과 웹의 호출 모양이 다르다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const userId = request.nextUrl.searchParams.get('userId');

    // 본문이 없어도 나갈 수 있어야 한다 — 쿼리의 userId만으로도 백엔드가 처리한다
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = userId ? { userId } : {};
    }

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/v1/chat/rooms/${roomId}/leave${query}`,
      {
        method: 'POST',
        headers: backendHeaders,
        body: JSON.stringify(body),
      }
    );

    if (!backendResponse.ok) {
      console.error(`[Chat API] 나가기 백엔드 응답 오류: ${backendResponse.status}`);
      return NextResponse.json({
        error: `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Chat API] 나가기 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}
