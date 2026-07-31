import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 결재선 지정 가능 결재자 후보 목록
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/v1/approvals/approver-candidates?companyId=${companyId}`,
      { method: 'GET', headers: backendHeaders },
    );

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => '');
      let errorMessage = `백엔드 서버 오류: ${backendResponse.status}`;
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed.error || parsed.message || errorMessage;
      } catch { /* JSON이 아니면 기본 메시지 유지 */ }
      return NextResponse.json({ error: errorMessage }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[ApproverCandidates API] GET 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
