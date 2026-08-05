import { NextResponse, NextRequest } from 'next/server';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store'
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

function buildBackendHeaders(request: NextRequest): Record<string, string> {
  const backendHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  const authToken = request.headers.get('authorization');
  if (authToken) backendHeaders['Authorization'] = authToken;
  return backendHeaders;
}

// GET: 휴무 입력 마감일 설정 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다' }, { status: 400, headers });
    }

    const response = await fetch(`${backendUrl}/api/vacation/deadline-setting?companyId=${companyId}`, {
      headers: buildBackendHeaders(request),
      cache: 'no-store',
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers });
  } catch (error) {
    console.error('[API] 휴무 마감일 설정 조회 오류:', error);
    return NextResponse.json({ error: '휴무 마감일 설정 조회 중 오류가 발생했습니다' }, { status: 500, headers });
  }
}

// POST: 휴무 입력 마감일 설정 저장
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다' }, { status: 400, headers });
    }

    const body = await request.json();
    const response = await fetch(`${backendUrl}/api/vacation/deadline-setting?companyId=${companyId}`, {
      method: 'POST',
      headers: buildBackendHeaders(request),
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers });
  } catch (error) {
    console.error('[API] 휴무 마감일 설정 저장 오류:', error);
    return NextResponse.json({ error: '휴무 마감일 설정 저장 중 오류가 발생했습니다' }, { status: 500, headers });
  }
}
