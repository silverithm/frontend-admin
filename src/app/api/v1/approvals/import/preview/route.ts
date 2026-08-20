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

// 이관 색인(엑셀) 읽어보기 — 저장하지 않는다
export async function POST(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    // multipart는 파싱해서 그대로 넘긴다 (Content-Type 경계는 fetch가 다시 만든다)
    const formData = await request.formData();

    const authHeader = request.headers.get('authorization');
    const backendHeaders: Record<string, string> = {};
    if (authHeader) backendHeaders['Authorization'] = authHeader;

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/v1/approvals/import/preview?companyId=${companyId}`,
      { method: 'POST', headers: backendHeaders, body: formData },
    );

    const data = await backendResponse.json().catch(() => ({ error: '응답을 읽지 못했습니다.' }));
    return NextResponse.json(data, { status: backendResponse.status, headers });
  } catch (error) {
    console.error('[ApprovalImportPreview API] POST 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
