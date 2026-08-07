import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 방 안 메시지 검색
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const keyword = request.nextUrl.searchParams.get('keyword') || '';
    const authHeader = request.headers.get('authorization');

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/v1/chat/rooms/${roomId}/messages/search?keyword=${encodeURIComponent(keyword)}`,
      { headers: authHeader ? { Authorization: authHeader, Accept: 'application/json' } : { Accept: 'application/json' } },
    );

    const data = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: data.error || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Chat Search API] GET 오류:', error);
    return NextResponse.json({ error: '메시지 검색 중 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
