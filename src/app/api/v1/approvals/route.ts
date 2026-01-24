import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 결재 목록 조회
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');
    const requesterId = url.searchParams.get('requesterId');
    const status = url.searchParams.get('status');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const searchQuery = url.searchParams.get('searchQuery');

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    // 내 결재 조회 (직원용)
    if (requesterId) {
      const backendResponse = await fetch(`${BACKEND_URL}/api/v1/approvals/my?requesterId=${requesterId}`, {
        method: 'GET',
        headers: backendHeaders,
      });

      if (!backendResponse.ok) {
        return NextResponse.json({ error: `백엔드 서버 오류: ${backendResponse.status}` }, { status: backendResponse.status, headers });
      }

      const data = await backendResponse.json();
      return NextResponse.json(data, { headers });
    }

    // 전체 결재 조회 (관리자용)
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 또는 requesterId 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    let backendUrl = `${BACKEND_URL}/api/v1/approvals?companyId=${companyId}`;
    if (status) backendUrl += `&status=${status}`;
    if (startDate) backendUrl += `&startDate=${startDate}`;
    if (endDate) backendUrl += `&endDate=${endDate}`;
    if (searchQuery) backendUrl += `&searchQuery=${encodeURIComponent(searchQuery)}`;

    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: backendHeaders,
    });

    if (!backendResponse.ok) {
      return NextResponse.json({ error: `백엔드 서버 오류: ${backendResponse.status}` }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Approvals API] GET 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}

// 결재 요청 생성
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId');
    const requesterId = url.searchParams.get('requesterId');
    const requesterName = url.searchParams.get('requesterName');

    if (!companyId || !requesterId || !requesterName) {
      return NextResponse.json({ error: 'companyId, requesterId, requesterName 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const body = await request.json();

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendUrl = `${BACKEND_URL}/api/v1/approvals?companyId=${companyId}&requesterId=${requesterId}&requesterName=${encodeURIComponent(requesterName)}`;

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      return NextResponse.json({ error: `백엔드 서버 오류: ${backendResponse.status}` }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Approvals API] POST 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}

// 일괄 승인/반려
export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action'); // 'bulk-approve' or 'bulk-reject'
    const processedBy = url.searchParams.get('processedBy');
    const processedByName = url.searchParams.get('processedByName');

    if (!action || !processedBy || !processedByName) {
      return NextResponse.json({ error: 'action, processedBy, processedByName 파라미터가 필요합니다.' }, { status: 400, headers });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const body = await request.json();

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendUrl = `${BACKEND_URL}/api/v1/approvals/${action}?processedBy=${processedBy}&processedByName=${encodeURIComponent(processedByName)}`;

    const backendResponse = await fetch(backendUrl, {
      method: 'PUT',
      headers: backendHeaders,
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      return NextResponse.json({ error: `백엔드 서버 오류: ${backendResponse.status}` }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers });

  } catch (error) {
    console.error('[Approvals API] PUT 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
