import { NextResponse, NextRequest } from 'next/server';

// 근무조정 중요 행사 프록시 (목록 조회·등록)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

async function proxy(request: NextRequest, method: 'GET' | 'POST') {
  try {
    const search = new URL(request.url).search;
    const backendHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    const authHeader = request.headers.get('authorization');
    if (authHeader) backendHeaders['Authorization'] = authHeader;

    const response = await fetch(`${BACKEND_URL}/api/vacation/events${search}`, {
      method,
      headers: backendHeaders,
      body: method === 'POST' ? await request.text() : undefined,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers });
  } catch (error) {
    console.error('[API] 중요 행사 오류:', error);
    // 달력이 깨지지 않도록 조회 실패는 빈 목록으로 떨어뜨린다
    if (method === 'GET') {
      return NextResponse.json({ events: [] }, { headers });
    }
    return NextResponse.json({ error: '행사 처리 중 오류가 발생했습니다' }, { status: 500, headers });
  }
}

export async function GET(request: NextRequest) {
  return proxy(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxy(request, 'POST');
}
