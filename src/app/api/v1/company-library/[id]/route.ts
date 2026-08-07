import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 자료 수정 (제목·설명·분류)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const body = await request.json();

    const backendHeaders: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (authHeader) backendHeaders.Authorization = authHeader;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/company-library/${id}`, {
      method: 'PUT',
      headers: backendHeaders,
      body: JSON.stringify(body),
    });

    const data = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: data.error || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Company Library API] PUT 오류:', error);
    return NextResponse.json({ error: '자료 수정 중 오류가 발생했습니다.' }, { status: 500, headers });
  }
}

// 자료 삭제
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/company-library/${id}`, {
      method: 'DELETE',
      headers: authHeader ? { Authorization: authHeader, Accept: 'application/json' } : { Accept: 'application/json' },
    });

    const data = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: data.error || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[Company Library API] DELETE 오류:', error);
    return NextResponse.json({ error: '자료 삭제 중 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
