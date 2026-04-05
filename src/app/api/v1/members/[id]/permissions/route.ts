import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/v1/members/${id}/permissions`,
      { method: 'GET', headers: backendHeaders }
    );

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Member Permissions API] GET 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류' }, { status: 500, headers });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const body = await request.json();

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/v1/members/${id}/permissions`,
      { method: 'PUT', headers: backendHeaders, body: JSON.stringify(body) }
    );

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Member Permissions API] PUT 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류' }, { status: 500, headers });
  }
}
