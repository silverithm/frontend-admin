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

export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const memberId = url.searchParams.get('memberId');
    const positionId = url.searchParams.get('positionId');

    if (!memberId) {
      return NextResponse.json({ error: 'memberId 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendUrl = positionId
      ? `${BACKEND_URL}/api/v1/positions/assign?memberId=${memberId}&positionId=${positionId}`
      : `${BACKEND_URL}/api/v1/positions/assign?memberId=${memberId}`;

    const backendResponse = await fetch(backendUrl, {
      method: 'PUT',
      headers: backendHeaders,
    });

    if (!backendResponse.ok) {
      console.error(`[Position Assign API] PUT 백엔드 응답 오류: ${backendResponse.status}`);
      return NextResponse.json({ error: `백엔드 서버 오류: ${backendResponse.status}` }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Position Assign API] PUT 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
