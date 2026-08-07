import { NextResponse, NextRequest } from 'next/server';

// 근무조정 중요 행사 프록시 (수정·삭제)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

async function proxy(request: NextRequest, eventId: string, method: 'PUT' | 'DELETE') {
  try {
    const search = new URL(request.url).search;
    const backendHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    const authHeader = request.headers.get('authorization');
    if (authHeader) backendHeaders['Authorization'] = authHeader;

    const response = await fetch(`${BACKEND_URL}/api/vacation/events/${eventId}${search}`, {
      method,
      headers: backendHeaders,
      body: method === 'PUT' ? await request.text() : undefined,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers });
  } catch (error) {
    console.error('[API] 중요 행사 수정/삭제 오류:', error);
    return NextResponse.json({ error: '행사 처리 중 오류가 발생했습니다' }, { status: 500, headers });
  }
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  return proxy(request, (await ctx.params).eventId, 'PUT');
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  return proxy(request, (await ctx.params).eventId, 'DELETE');
}
