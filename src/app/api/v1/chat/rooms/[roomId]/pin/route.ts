import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

/**
 * 채팅방 상단 고정/해제 — body: {"pinned": true|false}, 응답: {success, pinned}.
 *
 * 고정은 사람마다 다르다 — 누구의 목록인지는 쿼리의 userId(채팅 식별자, 관리자는 admin_ 접두사)로
 * 백엔드에 넘긴다. 나가기와 같은 모양이다.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const userId = request.nextUrl.searchParams.get('userId');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '고정 여부(pinned)가 필요합니다.' }, { status: 400, headers });
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
      `${BACKEND_URL}/api/v1/chat/rooms/${roomId}/pin${query}`,
      {
        method: 'PUT',
        headers: backendHeaders,
        body: JSON.stringify(body),
      }
    );

    const data = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      console.error(`[Chat API] 고정 백엔드 응답 오류: ${backendResponse.status}`);
      return NextResponse.json({
        error: data.error || `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Chat API] 고정 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}
