import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

// 큰 첨부(최대 20MB) 업로드 시간을 확보한다
export const maxDuration = 60;

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 방에서 주고받은 파일·사진 모아보기
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const type = request.nextUrl.searchParams.get('type');
    const authHeader = request.headers.get('authorization');

    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/chat/rooms/${roomId}/files${query}`, {
      headers: authHeader ? { Authorization: authHeader, Accept: 'application/json' } : { Accept: 'application/json' },
    });

    const data = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: data.error || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Chat Files API] GET 오류:', error);
    return NextResponse.json({ error: '파일 목록을 불러오지 못했습니다.' }, { status: 500, headers });
  }
}

/**
 * 채팅 파일·사진 전송 프록시.
 *
 * multipart 본문을 그대로 백엔드에 넘긴다 — Content-Type은 boundary가 붙어야 하므로
 * 직접 지정하지 않고 FormData를 다시 실어 fetch가 새로 만들게 둔다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const authHeader = request.headers.get('authorization');

    const formData = await request.formData();

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/chat/rooms/${roomId}/files`, {
      method: 'POST',
      headers: authHeader ? { Authorization: authHeader } : {},
      body: formData,
    });

    const data = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: data.error || data.message || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Chat Files API] POST 오류:', error);
    return NextResponse.json({ error: '파일 전송 중 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
