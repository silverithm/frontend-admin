import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 결재 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/approvals/${id}`, {
      method: 'GET',
      headers: backendHeaders,
    });

    if (!backendResponse.ok) {
      return NextResponse.json({ error: `백엔드 서버 오류: ${backendResponse.status}` }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Approval API] GET 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}

// 결재 승인/반려
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const action = url.searchParams.get('action'); // 'approve' or 'reject'
    const processedBy = url.searchParams.get('processedBy');
    const processedByName = url.searchParams.get('processedByName');

    if (!action || !processedBy || !processedByName) {
      return NextResponse.json({ error: 'action, processedBy, processedByName 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    let backendUrl = `${BACKEND_URL}/api/v1/approvals/${id}/${action}?processedBy=${processedBy}&processedByName=${encodeURIComponent(processedByName)}`;
    let backendBody = undefined;

    if (action === 'reject') {
      backendBody = JSON.stringify(await request.json());
    }

    const backendResponse = await fetch(backendUrl, {
      method: 'PUT',
      headers: backendHeaders,
      body: backendBody,
    });

    if (!backendResponse.ok) {
      return NextResponse.json({ error: `백엔드 서버 오류: ${backendResponse.status}` }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Approval API] PUT 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}

// 결재 취소
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/approvals/${id}`, {
      method: 'DELETE',
      headers: backendHeaders,
    });

    if (!backendResponse.ok) {
      return NextResponse.json({ error: `백엔드 서버 오류: ${backendResponse.status}` }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Approval API] DELETE 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
