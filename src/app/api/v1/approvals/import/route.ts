import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 과거 결재 문서 확정 등록
export async function POST(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    const authHeader = request.headers.get('authorization');
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (authHeader) backendHeaders['Authorization'] = authHeader;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/approvals/import?companyId=${companyId}`, {
      method: 'POST',
      headers: backendHeaders,
      body: await request.text(),
    });

    const data = await backendResponse.json().catch(() => ({ error: '응답을 읽지 못했습니다.' }));
    return NextResponse.json(data, { status: backendResponse.status, headers });
  } catch (error) {
    console.error('[ApprovalImport API] POST 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
