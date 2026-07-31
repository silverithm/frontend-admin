import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 할 일 수행완료 토글 (담당자 본인 또는 관리자)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
    const companyId = new URL(request.url).searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const body = await request.json();
    const backendResponse = await fetch(
      `${BACKEND_URL}/api/v1/schedules/${id}/tasks/${taskId}/completion?companyId=${companyId}`,
      { method: 'PUT', headers: backendHeaders, body: JSON.stringify(body) }
    );

    // 권한 오류(403) 메시지는 그대로 전달한다
    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => null);
      return NextResponse.json(
        { error: errorData?.error || errorData?.message || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers }
      );
    }

    return NextResponse.json(await backendResponse.json(), { headers });
  } catch (error) {
    console.error('[Schedule Task Completion API] PUT 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
