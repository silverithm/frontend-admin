/**
 * 주민번호 전체 보기 프록시 — 관리자만 통과한다(권한 판정은 백엔드가 하고 403을 준다).
 * 평문 PII가 지나가는 경로라 캐시를 막고 상태 코드를 그대로 전달한다.
 */
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/elders/company/elder/${id}/resident-number`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      cache: 'no-store',
    });

    const text = await backendResponse.text();
    if (!backendResponse.ok) {
      // 403은 '권한 없음'으로 화면에서 따로 안내해야 해서 상태 코드를 그대로 넘긴다
      return NextResponse.json(
        { error: backendResponse.status === 403 ? '주민번호를 볼 권한이 없습니다.' : `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }

    try {
      return NextResponse.json(JSON.parse(text), { headers });
    } catch {
      return NextResponse.json({ residentNumber: text }, { headers });
    }
  } catch {
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
