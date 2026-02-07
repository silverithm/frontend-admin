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

// 채팅방 목록 조회
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');
    const userId = url.searchParams.get('userId');

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    let backendUrl = `${BACKEND_URL}/api/v1/chat/rooms`;
    const params = new URLSearchParams();
    if (companyId) params.append('companyId', companyId);
    if (userId) params.append('userId', userId);
    if (params.toString()) backendUrl += `?${params.toString()}`;

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: backendHeaders,
    });

    if (!backendResponse.ok) {
      console.error(`[Chat API] 백엔드 응답 오류: ${backendResponse.status}`);
      return NextResponse.json({
        error: `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Chat API] GET 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}

// 채팅방 생성
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const body = await request.json();

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    let backendUrl = `${BACKEND_URL}/api/v1/chat/rooms`;
    if (companyId) backendUrl += `?companyId=${companyId}`;

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      console.error(`[Chat API] POST 백엔드 응답 오류: ${backendResponse.status}`);
      return NextResponse.json({
        error: `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Chat API] POST 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}
