import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

function authHeaders(request: NextRequest): Record<string, string> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function relay(backendResponse: Response) {
  if (!backendResponse.ok) {
    const errorData = await backendResponse.json().catch(() => null);
    return NextResponse.json(
      { error: errorData?.error || errorData?.message || `백엔드 서버 오류: ${backendResponse.status}` },
      { status: backendResponse.status, headers }
    );
  }
  return NextResponse.json(await backendResponse.json(), { headers });
}

// 할 일 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const companyId = new URL(request.url).searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    return relay(await fetch(`${BACKEND_URL}/api/v1/schedules/${id}/tasks?companyId=${companyId}`, {
      method: 'GET',
      headers: authHeaders(request),
    }));
  } catch (error) {
    console.error('[Schedule Tasks API] GET 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}

// 할 일 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const companyId = new URL(request.url).searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    const body = await request.json();
    return relay(await fetch(`${BACKEND_URL}/api/v1/schedules/${id}/tasks?companyId=${companyId}`, {
      method: 'POST',
      headers: authHeaders(request),
      body: JSON.stringify(body),
    }));
  } catch (error) {
    console.error('[Schedule Tasks API] POST 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
