import { NextRequest, NextResponse } from 'next/server';

// 회의록 API 프록시 — 모든 하위 경로를 백엔드로 그대로 넘긴다.
// (엔드포인트가 많아 경로별 프록시 파일 대신 catch-all 하나로 둔다)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

async function forward(request: NextRequest, pathSegments: string[] | undefined, method: string) {
  try {
    const path = pathSegments && pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '';
    const url = new URL(request.url);
    const target = `${BACKEND_URL}/api/v1/meeting-minutes${path}${url.search}`;

    const backendHeaders: Record<string, string> = { Accept: 'application/json' };
    const auth = request.headers.get('authorization');
    if (auth) backendHeaders['Authorization'] = auth;

    const init: RequestInit = { method, headers: backendHeaders };
    if (method !== 'GET' && method !== 'DELETE') {
      backendHeaders['Content-Type'] = 'application/json';
      init.body = await request.text();
    }

    const backendResponse = await fetch(target, init);
    const text = await backendResponse.text();
    try {
      return NextResponse.json(JSON.parse(text), { status: backendResponse.status, headers });
    } catch {
      return new NextResponse(text, { status: backendResponse.status, headers });
    }
  } catch (error) {
    console.error('회의록 프록시 오류:', error);
    return NextResponse.json({ error: '서버에 연결하지 못했습니다.' }, { status: 502, headers });
  }
}

type Context = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return forward(request, path, 'GET');
}

export async function POST(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return forward(request, path, 'POST');
}

export async function PUT(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return forward(request, path, 'PUT');
}

export async function DELETE(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return forward(request, path, 'DELETE');
}
