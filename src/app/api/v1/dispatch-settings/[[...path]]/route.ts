import { NextRequest, NextResponse } from 'next/server';

// 배차 설정 API 프록시 (조회·저장·운전자 역할 조회·이전)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

async function proxy(request: NextRequest, path: string[]) {
  try {
    const url = new URL(request.url);
    const suffix = path.length > 0 ? `/${path.join('/')}` : '';
    const target = `${BACKEND_URL}/api/v1/dispatch-settings${suffix}${url.search}`;

    const backendHeaders: Record<string, string> = { Accept: 'application/json' };
    const authHeader = request.headers.get('authorization');
    if (authHeader) backendHeaders['Authorization'] = authHeader;

    let body: string | undefined;
    if (request.method !== 'GET') {
      backendHeaders['Content-Type'] = 'application/json';
      body = await request.text();
    }

    const backendResponse = await fetch(target, { method: request.method, headers: backendHeaders, body });
    const data = await backendResponse.json().catch(() => ({}));

    if (!backendResponse.ok) {
      console.error(`[배차설정 API] 백엔드 응답 오류: ${backendResponse.status}`);
      return NextResponse.json(data, { status: backendResponse.status, headers });
    }
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[배차설정 API] 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return proxy(request, path ?? []);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return proxy(request, path ?? []);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return proxy(request, path ?? []);
}
