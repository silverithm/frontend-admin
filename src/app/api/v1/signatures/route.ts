import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

async function proxy(request: NextRequest, method: 'POST' | 'DELETE') {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    let body: string | undefined;
    if (method === 'POST') {
      body = await request.text();
    }

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/signatures`, {
      method,
      headers: backendHeaders,
      body,
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
    console.error('[Signature API] 프록시 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}

// 내 서명 등록
export async function POST(request: NextRequest) {
  return proxy(request, 'POST');
}

// 내 서명 삭제
export async function DELETE(request: NextRequest) {
  return proxy(request, 'DELETE');
}
