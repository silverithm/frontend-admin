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

// 양식 버전 기록 — 저장할 때마다 남은 그때 모습, 최근 것부터 (2026-11-16)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const backendHeaders: Record<string, string> = { Accept: 'application/json' };
    if (token) backendHeaders.Authorization = `Bearer ${token}`;

    const res = await fetch(`${BACKEND_URL}/api/v1/approval-templates/${encodeURIComponent(id)}/versions`, {
      method: 'GET',
      headers: backendHeaders,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data.error || `백엔드 서버 오류: ${res.status}` }, { status: res.status, headers });
    }
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[ApprovalTemplate API] 버전 기록 GET 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
