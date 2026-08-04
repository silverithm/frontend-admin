import { NextRequest, NextResponse } from 'next/server';

// 고충·신고 + 건의함 (VoiceBox) API 프록시
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

async function proxy(request: NextRequest, path: string[] | undefined) {
  try {
    const url = new URL(request.url);
    const suffix = path && path.length > 0 ? `/${path.join('/')}` : '';
    const target = `${BACKEND_URL}/api/v1/voice-box${suffix}${url.search}`;

    const backendHeaders: Record<string, string> = { Accept: 'application/json' };
    const authHeader = request.headers.get('authorization');
    if (authHeader) backendHeaders['Authorization'] = authHeader;

    let body: BodyInit | undefined;
    if (request.method !== 'GET') {
      backendHeaders['Content-Type'] = 'application/json';
      body = await request.text();
    }

    const backendResponse = await fetch(target, { method: request.method, headers: backendHeaders, body });
    const data = await backendResponse.json().catch(() => ({ error: '응답 처리 중 오류가 발생했습니다.' }));
    return NextResponse.json(data, { status: backendResponse.status, headers });
  } catch (error) {
    console.error('[VoiceBox API] 프록시 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}

export async function POST(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}
