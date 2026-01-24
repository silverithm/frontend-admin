import { NextResponse, NextRequest } from 'next/server';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// PUT: 휴무 일괄 거부
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { vacationIds } = body;

    if (!vacationIds || !Array.isArray(vacationIds) || vacationIds.length === 0) {
      return NextResponse.json(
        { error: '거부할 휴무 ID 목록이 필요합니다' },
        { status: 400, headers }
      );
    }

    // 클라이언트에서 전달받은 JWT 토큰 가져오기
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 백엔드 API URL
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';
    const apiUrl = `${backendUrl}/api/vacation/bulk-reject`;

    // 백엔드로 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: backendHeaders,
      body: JSON.stringify({ vacationIds }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] 백엔드 응답 오류:', response.status, errorText);
      throw new Error(`백엔드 API 오류: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('[API] 휴무 일괄 거부 오류:', error);
    return NextResponse.json(
      { error: '휴무 일괄 거부 중 오류가 발생했습니다' },
      { status: 500, headers }
    );
  }
}