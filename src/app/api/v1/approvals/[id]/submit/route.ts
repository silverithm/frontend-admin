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

// 임시저장 문서 상신 — 백엔드가 이 시점에 결재선을 검증하고 알림을 보낸다
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/approvals/${id}/submit`, {
      method: 'POST',
      headers: backendHeaders,
      body: await request.text(),
    });

    const raw = await backendResponse.text().catch(() => '');
    if (!backendResponse.ok) {
      // "결재선은 최대 N단계" 같은 검증 실패 이유를 그대로 넘긴다
      let message = `백엔드 서버 오류: ${backendResponse.status}`;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.error === 'string' && parsed.error.trim()) message = parsed.error.trim();
      } catch {
        if (raw.trim()) message = raw.trim();
      }
      return NextResponse.json({ error: message }, { status: backendResponse.status, headers });
    }

    return NextResponse.json(raw ? JSON.parse(raw) : { success: true }, { headers });
  } catch (error) {
    console.error('[ApprovalSubmit API] POST 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
