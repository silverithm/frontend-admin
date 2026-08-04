import { NextRequest, NextResponse } from 'next/server';

// 케어브이 커뮤니티 API 공용 프록시 (게시판·자료실 전 경로)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

async function proxy(request: NextRequest, path: string[]) {
  try {
    const url = new URL(request.url);
    const target = `${BACKEND_URL}/api/v1/plaza/${path.join('/')}${url.search}`;

    const backendHeaders: Record<string, string> = { Accept: 'application/json, */*' };
    const authHeader = request.headers.get('authorization');
    if (authHeader) backendHeaders['Authorization'] = authHeader;

    let body: BodyInit | undefined;
    if (request.method !== 'GET' && request.method !== 'DELETE') {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('multipart/form-data')) {
        body = await request.formData();
      } else {
        backendHeaders['Content-Type'] = 'application/json';
        body = await request.text();
      }
    }

    const backendResponse = await fetch(target, { method: request.method, headers: backendHeaders, body });

    const responseContentType = backendResponse.headers.get('content-type') || '';
    if (responseContentType.includes('application/json')) {
      const data = await backendResponse.json();
      return NextResponse.json(data, { status: backendResponse.status, headers });
    }

    // 파일 다운로드 등 바이너리 응답
    const buffer = await backendResponse.arrayBuffer();
    const passHeaders = new Headers(headers);
    passHeaders.set('Content-Type', responseContentType || 'application/octet-stream');
    const disposition = backendResponse.headers.get('content-disposition');
    if (disposition) passHeaders.set('Content-Disposition', disposition);
    return new NextResponse(buffer, { status: backendResponse.status, headers: passHeaders });
  } catch (error) {
    console.error('[Plaza API Proxy] 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await ctx.params).path);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await ctx.params).path);
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await ctx.params).path);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await ctx.params).path);
}
